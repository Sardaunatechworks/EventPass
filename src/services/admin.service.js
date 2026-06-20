// ============================================================
// EventPass: src/services/admin.service.js
// Platform Administration Operations
// ============================================================
import { supabase } from './supabase.js';

export const AdminService = {
  /**
   * Fetch global platform stats
   */
  async getStats() {
    const { data, error } = await supabase.rpc('get_platform_admin_stats');
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * List all platform organizations with event/member counts
   */
  async listOrganizations() {
    const { data, error } = await supabase.rpc('list_platform_organizations');
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Suspend or unsuspend an organization
   */
  async toggleOrgActive(orgId, isActive) {
    const { data, error } = await supabase.rpc('toggle_organization_active', {
      p_org_id: orgId,
      p_is_active: isActive
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Retrieve platform global audit logs
   */
  async listAuditLogs() {
    const { data, error } = await supabase.rpc('list_platform_audit_logs');
    if (error) throw new Error(error.message);
    return data || [];
  }
};
