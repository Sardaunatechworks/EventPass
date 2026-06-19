// ============================================================
// EventPass: src/services/audit.service.js
// Writes to audit_logs via database RPC (SECURITY DEFINER)
// ============================================================
import { supabase } from './supabase.js';

export const AuditService = {
  /**
   * Write an audit log entry.
   * Non-blocking — failures are logged to console but don't throw.
   */
  async log(orgId, action, resourceType, resourceId = null, beforeData = null, afterData = null) {
    try {
      await supabase.rpc('write_audit_log', {
        p_organization_id: orgId,
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_before_data: beforeData ? JSON.stringify(beforeData) : null,
        p_after_data: afterData ? JSON.stringify(afterData) : null,
        p_user_agent: navigator.userAgent.substring(0, 200),
      });
    } catch (err) {
      // Audit log failures must not block operations
      console.warn('[AuditService] Failed to write audit log:', err.message);
    }
  },

  /**
   * Fetch audit logs for an organization.
   */
  async getLogs(orgId, opts = {}) {
    const { page = 1, pageSize = 25, action, resourceType } = opts;

    let query = supabase
      .from('audit_logs')
      .select('*, auth.users(email)', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (action) query = query.eq('action', action);
    if (resourceType) query = query.eq('resource_type', resourceType);

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { logs: data || [], total: count || 0 };
  },
};

export default AuditService;
