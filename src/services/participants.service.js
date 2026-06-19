// ============================================================
// EventPass: src/services/participants.service.js
// Global participant registry management
// ============================================================
import { supabase } from './supabase.js';
import { Config } from '../config.js';

export const ParticipantsService = {
  /**
   * List participants who have registered with this organization.
   */
  async listParticipants(orgId, opts = {}) {
    const { page = 1, pageSize = Config.pagination.defaultPageSize, search } = opts;

    // Participants are accessed via their registrations with this org
    let query = supabase
      .from('participants')
      .select(`
        *,
        registrations!inner(event_id, status, created_at, organization_id)
      `, { count: 'exact' })
      .eq('registrations.organization_id', orgId)
      .is('registrations.deleted_at', null)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { participants: data || [], total: count || 0, page, pageSize };
  },

  /**
   * Get full participant profile with their event history in this org.
   */
  async getParticipant(participantId, orgId) {
    const { data: participant, error: pError } = await supabase
      .from('participants')
      .select('*')
      .eq('id', participantId)
      .single();

    if (pError) throw new Error(pError.message);

    const { data: registrations, error: rError } = await supabase
      .from('registrations')
      .select(`
        *, events(id, title, start_date, status),
        attendance!registration_id(checked_in_at),
        certificates!registration_id(certificate_number, issued_at)
      `)
      .eq('participant_id', participantId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (rError) throw new Error(rError.message);

    return { ...participant, registrations: registrations || [] };
  },

  /**
   * Look up a participant by email (for walk-in pre-fill).
   */
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('participants')
      .select('id, first_name, last_name, email, phone')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) return null;
    return data;
  },

  /**
   * Get summary stats for an org's participant base.
   */
  async getOrgParticipantStats(orgId) {
    const { count: total } = await supabase
      .from('registrations')
      .select('participant_id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['confirmed', 'pending'])
      .is('deleted_at', null);

    const { count: thisMonth } = await supabase
      .from('registrations')
      .select('participant_id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['confirmed', 'pending'])
      .is('deleted_at', null)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    return { total: total || 0, thisMonth: thisMonth || 0 };
  },
};

export default ParticipantsService;
