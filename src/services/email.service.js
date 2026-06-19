// ============================================================
// EventPass: src/services/email.service.js
// Email delivery via send-email Edge Function (Resend)
// ============================================================
import { supabase } from './supabase.js';
import { Config } from '../config.js';

async function callEmailFunction(payload) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token || Config.supabase.anonKey;

  const response = await fetch(
    `${Config.supabase.url}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': Config.supabase.anonKey,
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Email send failed');
  }
  return result;
}

export const EmailService = {
  /**
   * Send registration confirmation email.
   */
  async sendRegistrationConfirmation({ to, firstName, eventTitle, eventDate, eventLocation, ticketNumber, orgName, orgColor }) {
    return callEmailFunction({
      type: 'registration_confirmed',
      to,
      data: { firstName, eventTitle, eventDate, eventLocation, ticketNumber, orgName, orgColor },
    });
  },

  /**
   * Send certificate issued notification.
   */
  async sendCertificateIssued({ to, firstName, eventTitle, orgName, orgColor, certificateNumber, verificationCode, verifyUrl, issuedDate }) {
    return callEmailFunction({
      type: 'certificate_issued',
      to,
      data: { firstName, eventTitle, orgName, orgColor, certificateNumber, verificationCode, verifyUrl, issuedDate },
    });
  },

  /**
   * Send staff invitation email.
   */
  async sendStaffInvite({ to, orgName, role, inviteUrl }) {
    return callEmailFunction({
      type: 'staff_invite',
      to,
      data: { orgName, role, inviteUrl },
    });
  },
};

export default EmailService;
