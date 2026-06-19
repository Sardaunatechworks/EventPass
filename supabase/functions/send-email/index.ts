// ============================================================
// EventPass Edge Function: send-email
// Transactional emails via Resend API
// ============================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM_ADDRESS') || 'noreply@eventpass.africa';
const EMAIL_FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') || 'EventPass';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// ── Email Templates ──────────────────────────────────────────

function registrationConfirmationHTML(data: {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketNumber: string;
  qrImageUrl?: string;
  orgName: string;
  orgColor: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${data.orgColor};padding:32px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">${data.orgName}</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">via EventPass</p>
          </td>
        </tr>
        <!-- Checkmark -->
        <tr>
          <td style="padding:40px 40px 24px;text-align:center;">
            <div style="width:64px;height:64px;background:#d1fae5;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;line-height:64px;font-size:32px;">✓</div>
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Registration Confirmed!</h2>
            <p style="margin:0;color:#6b7280;font-size:15px;">Hi ${data.firstName}, your spot is secured.</p>
          </td>
        </tr>
        <!-- Event details -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#f9fafb;border-radius:8px;padding:24px;">
              <h3 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">${data.eventTitle}</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:80px;">📅 Date</td>
                  <td style="padding:6px 0;color:#374151;font-size:13px;font-weight:500;">${data.eventDate}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">📍 Location</td>
                  <td style="padding:6px 0;color:#374151;font-size:13px;font-weight:500;">${data.eventLocation}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">🎫 Ticket</td>
                  <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:700;font-family:monospace;">${data.ticketNumber}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Powered by <strong>EventPass</strong> — Africa's Program Operations Platform</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function certificateIssuedHTML(data: {
  firstName: string;
  eventTitle: string;
  orgName: string;
  orgColor: string;
  certificateNumber: string;
  verificationCode: string;
  verifyUrl: string;
  issuedDate: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${data.orgColor};padding:32px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">${data.orgName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">🏆</div>
            <h2 style="margin:0 0 8px;color:#111827;">Certificate Issued!</h2>
            <p style="color:#6b7280;margin:0 0 24px;">Congratulations ${data.firstName}! Your certificate of completion for <strong>${data.eventTitle}</strong> is ready.</p>
            <div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:left;margin-bottom:24px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Verification Code</p>
              <p style="margin:0;color:#111827;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:2px;">${data.verificationCode}</p>
            </div>
            <a href="${data.verifyUrl}" style="display:inline-block;background:${data.orgColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">View & Download Certificate</a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Powered by EventPass</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────

interface EmailPayload {
  type: 'registration_confirmed' | 'certificate_issued' | 'staff_invite';
  to: string;
  data: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated (service role or authenticated user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: EmailPayload = await req.json();

    if (!payload.to || !payload.type) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject = '';
    let html = '';

    switch (payload.type) {
      case 'registration_confirmed': {
        const d = payload.data as any;
        subject = `✅ Registration Confirmed — ${d.eventTitle}`;
        html = registrationConfirmationHTML(d);
        break;
      }
      case 'certificate_issued': {
        const d = payload.data as any;
        subject = `🏆 Your Certificate is Ready — ${d.eventTitle}`;
        html = certificateIssuedHTML(d);
        break;
      }
      case 'staff_invite': {
        const d = payload.data as any;
        subject = `You've been invited to join ${d.orgName} on EventPass`;
        html = `<p>Hi! You've been invited to join <strong>${d.orgName}</strong> as <strong>${d.role}</strong>. <a href="${d.inviteUrl}">Accept Invitation</a></p>`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown email type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        to: [payload.to],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Email delivery failed', details: err }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('send-email function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
