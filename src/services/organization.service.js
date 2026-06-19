// ============================================================
// EventPass: src/services/organization.service.js
// Organization management, staff, and branding
// ============================================================
import { supabase } from './supabase.js';
import { AuditService } from './audit.service.js';
import { EmailService } from './email.service.js';
import { Config } from '../config.js';

export const OrganizationService = {
  /**
   * Create a new organization and assign the creator as owner.
   * Also creates a free subscription record.
   */
  async createOrganization(userId, orgData) {
    // Use SECURITY DEFINER RPC to bypass the RLS chicken-and-egg:
    // a new user has no org membership yet, so direct INSERTs are blocked.
    const { data, error } = await supabase.rpc('create_organization', {
      p_name:        orgData.name,
      p_slug:        orgData.slug,
      p_description: orgData.description || null,
      p_country:     orgData.country || 'NG',
      p_timezone:    orgData.timezone || 'Africa/Lagos',
      p_website:     orgData.website || null,
      p_email:       orgData.email || null,
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message || 'Failed to create organization');

    // Update primary_color separately (org now exists, RLS allows admin update)
    if (orgData.primary_color) {
      await supabase
        .from('organizations')
        .update({ primary_color: orgData.primary_color })
        .eq('id', data.org_id);
    }

    // Return the full org row
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', data.org_id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    await AuditService.log(org.id, 'org.created', 'organization', org.id, null, { name: org.name, slug: org.slug });

    return org;
  },


  /**
   * Update organization settings.
   */
  async updateOrganization(orgId, updates) {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'org.updated', 'organization', orgId, null, updates);

    return data;
  },

  /**
   * Upload organization logo.
   */
  async uploadLogo(orgId, file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) {
      throw new Error('Only JPG, PNG, WebP, or SVG files are accepted');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Logo must be under 2MB');
    }

    const path = `${orgId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(Config.storage.orgAssets)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from(Config.storage.orgAssets)
      .getPublicUrl(path);

    await this.updateOrganization(orgId, { logo_url: publicUrl });

    return publicUrl;
  },

  async listMembers(orgId, opts = {}) {
    const { page = 1, pageSize = 50 } = opts;

    const { data, error, count } = await supabase
      .rpc('get_organization_members', { p_org_id: orgId }, { count: 'exact' })
      .eq('is_active', true)
      .order('role', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw new Error(error.message);

    // Map `user_email` to `row['auth.users'].email` for compatibility with staff.js
    const members = (data || []).map(row => ({
      ...row,
      'auth.users': row.user_email ? { email: row.user_email } : null
    }));

    return { members, total: count || 0 };
  },

  /**
   * Invite a user to an organization by email.
   * If user exists in auth, adds them immediately.
   * Otherwise sends an invite email.
   */
  async inviteMember(orgId, orgName, invitedBy, email, role) {
    // Check if user already exists
    const { data: existingUsers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('invite_email', email.toLowerCase())
      .limit(1);

    if (existingUsers?.length > 0) {
      throw new Error('This person is already a member or has a pending invitation');
    }

    // Insert pending member record
    const { data: member, error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: null, // Will be linked when they accept
        role,
        invite_email: email.toLowerCase(),
        invited_by: invitedBy,
        invited_at: new Date().toISOString(),
        is_active: false, // Activated on acceptance
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    let emailSent = true;
    // Send invitation email
    try {
      const inviteUrl = `${Config.app.url}/app.html?invite=${member.id}`;
      await EmailService.sendStaffInvite({ to: email, orgName, role, inviteUrl });
    } catch (emailErr) {
      console.warn('[OrganizationService] Failed to send staff invite email:', emailErr.message);
      emailSent = false;
    }

    await AuditService.log(orgId, 'member.invited', 'organization_member', member.id, null, { email, role });

    return { ...member, emailSent };
  },

  /**
   * Directly create a staff member using the admin Edge Function.
   */
  async createStaffMember(orgId, fullName, email, role, tempPassword) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || Config.supabase.anonKey;

    const response = await fetch(
      `${Config.supabase.url}/functions/v1/create-staff`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': Config.supabase.anonKey,
        },
        body: JSON.stringify({ orgId, fullName, email, role, tempPassword }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create staff member');
    }
    return result.member;
  },

  /**
   * Accept an invitation using the SECURITY DEFINER RPC.
   */
  async acceptInvitation(inviteId) {
    const { data, error } = await supabase.rpc('accept_invitation', {
      p_invite_id: inviteId,
    });

    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.message);

    return data;
  },

  /**
   * Update a member's role.
   */
  async updateMemberRole(memberId, orgId, newRole) {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'member.role_changed', 'organization_member', memberId, null, { new_role: newRole });

    return data;
  },

  /**
   * Remove a member from the organization.
   */
  async removeMember(memberId, orgId) {
    // Cannot remove the last owner
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'owner')
      .eq('is_active', true);

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('id', memberId)
      .single();

    if (member?.role === 'owner' && count <= 1) {
      throw new Error('Cannot remove the last owner of an organization');
    }

    const { error } = await supabase
      .from('organization_members')
      .update({ is_active: false })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'member.removed', 'organization_member', memberId);
  },

  /**
   * Get organization dashboard stats.
   */
  async getDashboardStats(orgId) {
    const { data, error } = await supabase.rpc('get_org_dashboard_stats', { p_org_id: orgId });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get upcoming events for an org (next 30 days).
   */
  async getUpcomingEvents(orgId, limit = 5) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date, end_date, status, location_name')
      .eq('organization_id', orgId)
      .in('status', ['published', 'draft'])
      .is('deleted_at', null)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) return [];
    return data || [];
  },
};

export default OrganizationService;
