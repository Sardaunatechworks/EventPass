// ============================================================
// EventPass Edge Function: verify-ticket
// Validates QR ticket payload for attendance check-in
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

// Simple rate limiter using in-memory map (resets on cold start)
// For production: use Upstash Redis or a DB-backed rate limiter
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(key: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Rate limit by IP
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await req.json();
    const { qr_payload, event_id, method = 'qr' } = body;

    if (!qr_payload || !event_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'qr_payload and event_id are required',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode QR payload
    let ticketData: { type: string; eid: string; pid: string; tc: string };
    try {
      const decoded = atob(qr_payload.replace(/\n/g, ''));
      ticketData = JSON.parse(decoded);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'INVALID_QR',
        message: 'Invalid or corrupted QR code',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate payload structure
    if (ticketData.type !== 'eventpass_v1' || !ticketData.tc || !ticketData.eid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'INVALID_QR_FORMAT',
        message: 'QR code format not recognized',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate event matches
    if (ticketData.eid !== event_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'WRONG_EVENT',
        message: 'This ticket is for a different event',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth user for check-in attribution
    const authHeader = req.headers.get('Authorization');
    let checkedInByUserId: string | null = null;

    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      checkedInByUserId = user?.id || null;
    }

    // Call atomic check-in function
    const { data: result, error } = await supabase
      .rpc('checkin_by_ticket', {
        p_ticket_number: ticketData.tc,
        p_event_id: event_id,
        p_method: method,
        p_device_info: req.headers.get('user-agent') || null,
      });

    if (error) {
      console.error('Check-in RPC error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Failed to process check-in',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Write audit log
    if (result?.success) {
      await supabase.rpc('write_audit_log', {
        p_organization_id: null,
        p_action: 'attendance.recorded',
        p_resource_type: 'attendance',
        p_resource_id: result.attendance_id,
        p_after_data: {
          ticket_number: ticketData.tc,
          event_id,
          method,
        },
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent'),
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('verify-ticket function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
