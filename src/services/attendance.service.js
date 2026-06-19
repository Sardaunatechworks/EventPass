// ============================================================
// EventPass: src/services/attendance.service.js
// Attendance recording and check-in operations
// ============================================================
import { supabase } from './supabase.js';
import { AuditService } from './audit.service.js';
import { Config } from '../config.js';

export const AttendanceService = {
  /**
   * Record attendance via QR payload.
   * Delegates to verify-ticket Edge Function for security + rate limiting.
   */
  async checkInByQR(qrPayload, eventId) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const response = await fetch(
      `${Config.supabase.url}/functions/v1/verify-ticket`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': Config.supabase.anonKey,
        },
        body: JSON.stringify({ qr_payload: qrPayload, event_id: eventId, method: 'qr' }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Check-in failed');
    }

    return response.json();
  },

  /**
   * Manual check-in by ticket number (without QR scan).
   * Uses the same atomic PostgreSQL function.
   */
  async checkInByTicket(ticketNumber, eventId, method = 'manual') {
    const { data, error } = await supabase.rpc('checkin_by_ticket', {
      p_ticket_number: ticketNumber,
      p_event_id: eventId,
      p_method: method,
      p_device_info: navigator.userAgent.substring(0, 200),
    });

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * List attendance records for an event.
   */
  async listAttendance(eventId, orgId, opts = {}) {
    const { page = 1, pageSize = Config.pagination.defaultPageSize, search } = opts;

    let query = supabase
      .from('attendance')
      .select(`
        *,
        participants(id, first_name, last_name, email),
        registrations(ticket_number)
      `, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .order('checked_in_at', { ascending: false });

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { attendance: data || [], total: count || 0, page, pageSize };
  },

  /**
   * Get real-time attendance count for dashboard/scanner.
   */
  async getAttendanceCount(eventId) {
    const { count, error } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) return 0;
    return count || 0;
  },

  /**
   * Check if a participant is already checked in.
   */
  async isCheckedIn(registrationId) {
    const { data } = await supabase
      .from('attendance')
      .select('id, checked_in_at')
      .eq('registration_id', registrationId)
      .maybeSingle();

    return data;
  },

  /**
   * Remove an attendance record (undo check-in). Admin only.
   */
  async removeCheckIn(attendanceId, orgId) {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', attendanceId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'attendance.removed', 'attendance', attendanceId);
  },

  /**
   * Subscribe to real-time attendance updates for an event.
   * @param {string} eventId
   * @param {Function} callback - called with the new count on each check-in
   * @returns Supabase realtime channel (call .unsubscribe() to clean up)
   */
  subscribeToAttendance(eventId, callback) {
    const channel = supabase
      .channel(`attendance:${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        callback(payload.new);
      })
      .subscribe();

    return channel;
  },

  /**
   * Export attendance as CSV-ready data.
   */
  async exportAttendance(eventId, orgId) {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        checked_in_at, check_in_method,
        participants(first_name, last_name, email, phone),
        registrations(ticket_number)
      `)
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .order('checked_in_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },
};

export default AttendanceService;
