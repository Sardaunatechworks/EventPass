// ============================================================
// EventPass: src/services/registrations.service.js
// Registration management
// ============================================================
import { supabase } from './supabase.js';
import { AuditService } from './audit.service.js';
import { EmailService } from './email.service.js';
import { Config } from '../config.js';

export const RegistrationsService = {
  /**
   * Register a participant for an event.
   * Uses the PostgreSQL atomic register_participant function.
   */
  async register(eventId, participantData, answers = []) {
    const { data, error } = await supabase.rpc('register_participant', {
      p_event_id: eventId,
      p_email: participantData.email.toLowerCase().trim(),
      p_first_name: participantData.first_name.trim(),
      p_last_name: participantData.last_name.trim(),
      p_phone: participantData.phone || null,
      p_is_walk_in: participantData.is_walk_in || false,
      p_answers: JSON.stringify(answers),
    });

    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.message);

    return data;
  },

  /**
   * List registrations for an event.
   */
  async listRegistrations(eventId, orgId, opts = {}) {
    const {
      status,
      search,
      page = 1,
      pageSize = Config.pagination.defaultPageSize,
    } = opts;

    let query = supabase
      .from('registrations')
      .select(`
        *,
        participants(id, first_name, last_name, email, phone),
        attendance!registration_id(checked_in_at, check_in_method)
      `, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) {
      // Search by participant name or ticket number
      query = query.or(
        `ticket_number.ilike.%${search}%`
      );
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { registrations: data || [], total: count || 0, page, pageSize };
  },

  /**
   * Get a single registration with all details.
   */
  async getRegistration(registrationId, orgId) {
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        *,
        participants(*),
        events(id, title, start_date, end_date, location_name),
        registration_answers(*, registration_fields(field_label, field_type)),
        attendance!registration_id(*)
      `)
      .eq('id', registrationId)
      .eq('organization_id', orgId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Update registration status.
   */
  async updateStatus(registrationId, orgId, status, reason = null) {
    const { data, error } = await supabase
      .from('registrations')
      .update({ status, notes: reason })
      .eq('id', registrationId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(
      orgId,
      `registration.${status}`,
      'registration',
      registrationId,
      null,
      { status, reason }
    );

    return data;
  },

  /**
   * Cancel a registration.
   */
  async cancelRegistration(registrationId, orgId, reason) {
    return this.updateStatus(registrationId, orgId, 'cancelled', reason);
  },

  /**
   * Approve a pending registration.
   */
  async approveRegistration(registrationId, orgId, userId) {
    const { data: reg, error } = await supabase
      .from('registrations')
      .update({
        status: 'confirmed',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', registrationId)
      .eq('organization_id', orgId)
      .select(`
        *,
        participants(first_name, email),
        events(title, start_date, end_date, location_name, location_address, is_virtual),
        organizations(name, primary_color)
      `)
      .single();

    if (error) throw new Error(error.message);

    // Send confirmation email
    if (reg && reg.participants) {
      try {
        const event = reg.events;
        const org = reg.organizations;
        const p = reg.participants;

        const startDate = new Date(event.start_date).toLocaleDateString('en-US', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const startTime = new Date(event.start_date).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        });
        const endTime = event.end_date ? new Date(event.end_date).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        }) : null;
        const eventDateStr = startDate + (endTime ? ` · ${startTime} – ${endTime}` : ` at ${startTime}`);

        const eventLocationStr = event.is_virtual
          ? 'Virtual Event'
          : ((event.location_name || '') + (event.location_address ? ' · ' + event.location_address : ''));

        await EmailService.sendRegistrationConfirmation({
          to: p.email,
          firstName: p.first_name,
          eventTitle: event.title,
          eventDate: eventDateStr,
          eventLocation: eventLocationStr,
          ticketNumber: reg.ticket_number,
          orgName: org?.name || 'Organization',
          orgColor: org?.primary_color || '#16A34A',
        });
      } catch (emailErr) {
        console.error('[RegistrationsService] Failed to send approval confirmation email:', emailErr);
      }
    }

    await AuditService.log(orgId, 'registration.approved', 'registration', registrationId);
    return reg;
  },

  /**
   * Lookup registration by ticket number (for walk-in verification).
   */
  async findByTicket(ticketNumber, eventId) {
    const { data, error } = await supabase
      .from('registrations')
      .select('*, participants(*), attendance!registration_id(*)')
      .eq('ticket_number', ticketNumber)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  },

  /**
   * Export registrations as CSV-ready array.
   */
  async exportRegistrations(eventId, orgId) {
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        ticket_number, status, registration_source, created_at, is_walk_in,
        participants(first_name, last_name, email, phone, organization_name, job_title),
        attendance!registration_id(checked_in_at, check_in_method)
      `)
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Walk-in registration — registers a new participant and immediately checks them in.
   */
  async walkInRegistration(eventId, orgId, userId, participantData) {
    // Register
    const regResult = await this.register(eventId, {
      ...participantData,
      is_walk_in: true,
    }, []);

    if (!regResult.success) throw new Error(regResult.message);

    // Record attendance
    const { error: attError } = await supabase.from('attendance').insert({
      registration_id: regResult.registration_id,
      event_id: eventId,
      organization_id: orgId,
      participant_id: regResult.participant_id,
      checked_in_by: userId,
      check_in_method: 'walk-in',
    });

    if (attError && attError.code !== '23505') { // Ignore duplicate
      console.warn('[Registrations] Walk-in attendance error:', attError.message);
    }

    await AuditService.log(orgId, 'registration.walk-in', 'registration', regResult.registration_id, null, {
      participant_id: regResult.participant_id,
      event_id: eventId,
    });

    return regResult;
  },
};

export default RegistrationsService;
