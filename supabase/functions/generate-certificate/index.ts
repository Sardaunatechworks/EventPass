// ============================================================
// EventPass Edge Function: generate-certificate
// Generates HTML certificate, stores PDF in Supabase Storage
// ============================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://eventpass.africa';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// ── Certificate HTML Template ────────────────────────────────

function generateCertificateHTML(data: {
  participantName: string;
  eventTitle: string;
  orgName: string;
  orgLogo?: string;
  primaryColor: string;
  issuedDate: string;
  certificateNumber: string;
  verificationCode: string;
  verifyUrl: string;
  description?: string;
}): string {
  const formattedDate = new Date(data.issuedDate).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate — ${data.participantName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f8f6f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }

    .certificate {
      width: 794px;
      min-height: 562px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    /* Decorative border */
    .cert-border {
      position: absolute;
      inset: 12px;
      border: 2px solid ${data.primaryColor};
      border-radius: 2px;
      opacity: 0.15;
      pointer-events: none;
    }
    .cert-border-inner {
      position: absolute;
      inset: 18px;
      border: 1px solid ${data.primaryColor};
      border-radius: 1px;
      opacity: 0.08;
      pointer-events: none;
    }

    /* Top accent bar */
    .cert-header {
      background: ${data.primaryColor};
      height: 8px;
    }

    .cert-body {
      padding: 48px 64px;
      text-align: center;
    }

    .org-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 40px;
    }

    .org-logo {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      object-fit: contain;
    }

    .org-name {
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #374151;
      letter-spacing: 0.5px;
    }

    .cert-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 12px;
    }

    .cert-title {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }

    .cert-title-subtitle {
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 32px;
    }

    .cert-awarded-to {
      font-size: 12px;
      color: #9ca3af;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .cert-name {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      font-weight: 700;
      color: ${data.primaryColor};
      margin-bottom: 24px;
      border-bottom: 2px solid ${data.primaryColor}22;
      padding-bottom: 24px;
    }

    .cert-body-text {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.7;
      max-width: 520px;
      margin: 0 auto 32px;
    }

    .cert-event {
      font-weight: 600;
      color: #111827;
    }

    .cert-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #f3f4f6;
    }

    .cert-date-section {
      text-align: left;
    }
    .cert-date-label {
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .cert-date {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }

    .cert-sig-section {
      text-align: center;
    }
    .cert-sig-name {
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 18px;
      color: #374151;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .cert-sig-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cert-verify-section {
      text-align: right;
    }
    .cert-verify-label {
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .cert-verify-code {
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      letter-spacing: 2px;
    }
    .cert-verify-url {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 2px;
    }

    /* Bottom accent */
    .cert-bottom {
      background: ${data.primaryColor};
      height: 4px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="cert-border"></div>
    <div class="cert-border-inner"></div>
    <div class="cert-header"></div>

    <div class="cert-body">
      <div class="org-section">
        ${data.orgLogo ? `<img src="${data.orgLogo}" class="org-logo" alt="${data.orgName}">` : ''}
        <span class="org-name">${data.orgName}</span>
      </div>

      <div class="cert-subtitle">Certificate of Completion</div>
      <div class="cert-title">Certificate</div>
      <div class="cert-title-subtitle">of Achievement</div>

      <div class="cert-awarded-to">This certifies that</div>
      <div class="cert-name">${data.participantName}</div>

      <p class="cert-body-text">
        has successfully completed and participated in<br>
        <span class="cert-event">${data.eventTitle}</span>
        ${data.description ? `<br><br>${data.description}` : ''}
      </p>

      <div class="cert-footer">
        <div class="cert-date-section">
          <div class="cert-date-label">Issue Date</div>
          <div class="cert-date">${formattedDate}</div>
        </div>

        <div class="cert-sig-section">
          <div class="cert-sig-name">${data.orgName}</div>
          <div class="cert-sig-label">Authorized Signature</div>
        </div>

        <div class="cert-verify-section">
          <div class="cert-verify-label">Verify</div>
          <div class="cert-verify-code">${data.verificationCode}</div>
          <div class="cert-verify-url">${data.verifyUrl}</div>
        </div>
      </div>
    </div>

    <div class="cert-bottom"></div>
  </div>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { registration_id, issued_by } = await req.json();

    if (!registration_id) {
      return new Response(JSON.stringify({ error: 'registration_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all needed data
    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select(`
        *,
        participants(*),
        events(*, organizations(*))
      `)
      .eq('id', registration_id)
      .eq('status', 'confirmed')
      .single();

    if (regError || !reg) {
      return new Response(JSON.stringify({ error: 'Registration not found or not confirmed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if certificate already exists
    const { data: existingCert } = await supabase
      .from('certificates')
      .select('id, certificate_number, verification_code')
      .eq('registration_id', registration_id)
      .is('revoked_at', null)
      .single();

    if (existingCert) {
      return new Response(JSON.stringify({
        success: true,
        certificate_id: existingCert.id,
        certificate_number: existingCert.certificate_number,
        verification_code: existingCert.verification_code,
        already_existed: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const participantRaw = reg.participants;
    const participant = Array.isArray(participantRaw) ? participantRaw[0] : (participantRaw || {});

    const eventRaw = reg.events;
    const event = Array.isArray(eventRaw) ? eventRaw[0] : (eventRaw || {});

    const orgRaw = event.organizations;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : (orgRaw || {});

    // Generate unique codes
    const { data: certNumberResult } = await supabase
      .rpc('generate_certificate_number', { org_slug: org.slug });

    const verificationCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
    const certNumber = certNumberResult as string;
    const verifyUrl = `${APP_URL}/verify?code=${verificationCode}`;
    const participantName = `${participant.first_name} ${participant.last_name}`;

    // Generate certificate HTML
    const certHTML = generateCertificateHTML({
      participantName,
      eventTitle: event.title,
      orgName: org.name,
      orgLogo: org.logo_url,
      primaryColor: org.primary_color || '#2563EB',
      issuedDate: new Date().toISOString(),
      certificateNumber: certNumber,
      verificationCode,
      verifyUrl,
    });

    // Store certificate record in DB
    const templateData = {
      participantName,
      eventTitle: event.title,
      orgName: org.name,
      primaryColor: org.primary_color,
      issuedDate: new Date().toISOString(),
      verifyUrl,
    };

    const { data: cert, error: certInsertError } = await supabase
      .from('certificates')
      .insert({
        registration_id,
        event_id: event.id,
        organization_id: org.id,
        participant_id: participant.id,
        certificate_number: certNumber,
        verification_code: verificationCode,
        template_data: templateData,
        issued_by: issued_by || null,
      })
      .select()
      .single();

    if (certInsertError) {
      console.error('Certificate insert error:', certInsertError);
      return new Response(JSON.stringify({ error: 'Failed to create certificate record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabase.rpc('write_audit_log', {
      p_organization_id: org.id,
      p_action: 'certificate.issued',
      p_resource_type: 'certificate',
      p_resource_id: cert.id,
      p_after_data: { certificate_number: certNumber, participant_id: participant.id, event_id: event.id },
    });

    return new Response(JSON.stringify({
      success: true,
      certificate_id: cert.id,
      certificate_number: certNumber,
      verification_code: verificationCode,
      verify_url: verifyUrl,
      html: certHTML,
      template_data: templateData,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-certificate function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
