// ============================================================
// EventPass: src/services/events.service.js
// Events CRUD, publish workflow, stats
// ============================================================
import { supabase } from './supabase.js';
import { AuditService } from './audit.service.js';
import { Config } from '../config.js';

export const EventsService = {
  /**
   * List events for an organization.
   * @param {string} orgId
   * @param {Object} opts - { status, search, page, pageSize, orderBy }
   */
  async listEvents(orgId, opts = {}) {
    const {
      status,
      search,
      page = 1,
      pageSize = Config.pagination.defaultPageSize,
      orderBy = 'start_date',
      ascending = false,
    } = opts;

    let query = supabase
      .from('events')
      .select('*, programs(name)', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    query = query.order(orderBy, { ascending });
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { events: data || [], total: count || 0, page, pageSize };
  },

  /**
   * Get a single event by ID with all related data.
   */
  async getEvent(eventId, orgId) {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        programs(id, name, program_type),
        registration_fields(*)
      `)
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get a published event by ID (public, no auth required).
   */
  async getPublicEvent(eventId) {
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, title, description, event_type, status, start_date, end_date,
        timezone, location_name, location_address, is_virtual, virtual_link,
        capacity, is_waitlist_enabled, is_registration_open,
        registration_opens_at, registration_closes_at, banner_url,
        is_free, price, currency, ticket_prefix, slug,
        organizations(id, name, logo_url, primary_color, secondary_color),
        registration_fields(*)
      `)
      .eq('id', eventId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Create a new event.
   */
  async createEvent(orgId, userId, eventData) {
    const payload = {
      ...eventData,
      organization_id: orgId,
      created_by: userId,
      status: 'draft',
    };

    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'event.created', 'event', data.id, null, data);

    return data;
  },

  /**
   * Update an event.
   */
  async updateEvent(eventId, orgId, updates) {
    // Fetch before data for audit
    const { data: before } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'event.updated', 'event', eventId, before, data);

    return data;
  },

  /**
   * Publish an event (draft → published).
   */
  async publishEvent(eventId, orgId) {
    return this.updateEvent(eventId, orgId, {
      status: 'published',
      is_registration_open: true,
    });
  },

  /**
   * Unpublish (published → draft).
   */
  async unpublishEvent(eventId, orgId) {
    return this.updateEvent(eventId, orgId, { status: 'draft' });
  },

  /**
   * Archive an event.
   */
  async archiveEvent(eventId, orgId) {
    return this.updateEvent(eventId, orgId, {
      status: 'archived',
      is_registration_open: false,
    });
  },

  /**
   * Soft delete an event.
   */
  async deleteEvent(eventId, orgId) {
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'event.deleted', 'event', eventId);
  },

  /**
   * Clone an event (copy fields, reset to draft).
   */
  async cloneEvent(eventId, orgId, userId) {
    const original = await this.getEvent(eventId, orgId);
    if (!original) throw new Error('Event not found');

    const { id, created_at, updated_at, deleted_at, slug, status, ...fields } = original;

    const clone = await this.createEvent(orgId, userId, {
      ...fields,
      title: `${original.title} (Copy)`,
      status: 'draft',
      is_registration_open: false,
    });

    // Clone custom fields
    if (original.registration_fields?.length > 0) {
      const clonedFields = original.registration_fields.map(({ id: fid, created_at: fca, event_id, ...f }) => ({
        ...f,
        event_id: clone.id,
        organization_id: orgId,
      }));
      await supabase.from('registration_fields').insert(clonedFields);
    }

    await AuditService.log(orgId, 'event.cloned', 'event', clone.id, null, { cloned_from: eventId });

    return clone;
  },

  /**
   * Get registration stats for an event.
   */
  async getEventStats(eventId) {
    const { data, error } = await supabase.rpc('get_event_stats', { p_event_id: eventId });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Update registration fields for an event.
   * Replaces all existing fields with the new set.
   */
  async updateRegistrationFields(eventId, orgId, fields) {
    // Delete existing fields
    await supabase
      .from('registration_fields')
      .delete()
      .eq('event_id', eventId);

    if (!fields || fields.length === 0) return [];

    const payload = fields.map((f, i) => ({
      ...f,
      event_id: eventId,
      organization_id: orgId,
      field_order: i,
    }));

    const { data, error } = await supabase
      .from('registration_fields')
      .insert(payload)
      .select();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get registration count for capacity check.
   */
  async getRegistrationCount(eventId) {
    const { count, error } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'pending'])
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return count || 0;
  },
};

export default EventsService;
