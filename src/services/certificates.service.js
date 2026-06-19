// ============================================================
// EventPass: src/services/certificates.service.js
// Certificate issuance, revocation, and verification
// ============================================================
import { supabase } from './supabase.js';
import { AuditService } from './audit.service.js';
import { EmailService } from './email.service.js';
import { Config } from '../config.js';

export const CertificatesService = {
  /**
   * Issue a certificate for a registration.
   * Calls the generate-certificate Edge Function.
   */
  async issueCertificate(registrationId, issuedBy) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const response = await fetch(
      `${Config.supabase.url}/functions/v1/generate-certificate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': Config.supabase.anonKey,
        },
        body: JSON.stringify({ registration_id: registrationId, issued_by: issuedBy }),
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Certificate generation failed');
    }

    return result;
  },

  /**
   * Issue certificates for all confirmed attendees of an event.
   * Returns a summary of issued/failed counts.
   */
  async bulkIssueCertificates(eventId, orgId, issuedBy, onProgress = null) {
    // Get all confirmed attendees without certificates
    const { data: attendees, error } = await supabase
      .from('attendance')
      .select('registration_id, registrations!inner(id, status, participant_id)')
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .eq('registrations.status', 'confirmed');

    if (error) throw new Error(error.message);
    if (!attendees?.length) return { issued: 0, skipped: 0, failed: 0 };

    let issued = 0, skipped = 0, failed = 0;
    const total = attendees.length;

    for (let i = 0; i < attendees.length; i++) {
      const regId = attendees[i].registration_id;
      try {
        const result = await this.issueCertificate(regId, issuedBy);
        if (result.already_existed) skipped++;
        else issued++;
      } catch (err) {
        console.warn(`[Certificates] Failed for registration ${regId}:`, err.message);
        failed++;
      }

      if (onProgress) onProgress({ current: i + 1, total, issued, skipped, failed });

      // Small delay to avoid hammering the Edge Function
      await new Promise(r => setTimeout(r, 100));
    }

    await AuditService.log(orgId, 'certificates.bulk_issued', 'event', eventId, null, {
      issued, skipped, failed, total,
    });

    return { issued, skipped, failed, total };
  },

  /**
   * List certificates for an event.
   */
  async listCertificates(eventId, orgId, opts = {}) {
    const { page = 1, pageSize = Config.pagination.defaultPageSize } = opts;

    const { data, error, count } = await supabase
      .from('certificates')
      .select(`
        *,
        participants(first_name, last_name, email),
        registrations(ticket_number)
      `, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .order('issued_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw new Error(error.message);

    return { certificates: data || [], total: count || 0, page, pageSize };
  },

  /**
   * Verify a certificate by verification code (public endpoint).
   */
  async verifyCertificate(verificationCode) {
    const { data, error } = await supabase
      .from('certificates')
      .select(`
        id, certificate_number, verification_code, issued_at, revoked_at,
        template_data,
        participants(first_name, last_name),
        events(id, title, start_date, end_date, organizations(name, logo_url, primary_color))
      `)
      .eq('verification_code', verificationCode.toUpperCase())
      .single();

    if (error) return null;
    return data;
  },

  /**
   * Revoke a certificate.
   */
  async revokeCertificate(certificateId, orgId, userId, reason) {
    const { data, error } = await supabase
      .from('certificates')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
        revoke_reason: reason,
      })
      .eq('id', certificateId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await AuditService.log(orgId, 'certificate.revoked', 'certificate', certificateId, null, { reason });

    return data;
  },

  /**
   * Send certificate notification email.
   */
  async sendCertificateEmail(certData, participantEmail, orgData) {
    return EmailService.sendCertificateIssued({
      to: participantEmail,
      firstName: certData.template_data.participantName?.split(' ')[0] || 'Participant',
      eventTitle: certData.template_data.eventTitle,
      orgName: orgData.name,
      orgColor: orgData.primary_color,
      certificateNumber: certData.certificate_number,
      verificationCode: certData.verification_code,
      verifyUrl: certData.template_data.verifyUrl,
      issuedDate: certData.issued_at,
    });
  },
};

export default CertificatesService;
