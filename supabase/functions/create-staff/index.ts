// ============================================================
// EventPass Edge Function: create-staff
// Creates a new auth user and maps them to an organization immediately
// ============================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orgId, fullName, email, role, tempPassword } = await req.json();

    if (!orgId || !fullName || !email || !role || !tempPassword) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize regular client to verify calling user's permissions
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify calling user is an admin or owner of the organization
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: memberCheck, error: memberCheckError } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', callingUser.id)
      .eq('is_active', true)
      .single();

    if (memberCheckError || !memberCheck || !['owner', 'admin'].includes(memberCheck.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only organization admins can create members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if a member with this email already exists in the organization
    const { data: existingMember } = await adminClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('invite_email', email.toLowerCase().trim())
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      return new Response(JSON.stringify({ error: 'A member with this email already exists or is pending' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the user in Supabase Auth directly (confirmed automatically, bypasses email verification)
    const { data: authUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true, // Flag to force password change on first login
      },
    });

    if (createAuthError) {
      return new Response(JSON.stringify({ error: createAuthError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link the created user to the organization immediately
    const { data: member, error: insertError } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: authUser.user.id,
        role: role,
        invite_email: email.toLowerCase().trim(),
        is_active: true,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup the auth user if member insertion failed
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Write audit log
    await adminClient.rpc('write_audit_log', {
      p_organization_id: orgId,
      p_action: 'member.created_directly',
      p_resource_type: 'organization_member',
      p_resource_id: member.id,
      p_after_data: { email, role, user_id: authUser.user.id },
      p_ip_address: req.headers.get('x-real-ip') || 'unknown',
      p_user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return new Response(JSON.stringify({ success: true, member }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('create-staff function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
