// ============================================================
// EventPass: src/utils/pdf.js
// Client-side PDF generation for tickets and certificates
// Uses jsPDF + html2canvas loaded via CDN in HTML shell
// ============================================================

/**
 * Generate a printable ticket HTML and trigger browser print dialog.
 * @param {Object} data - registration + event + participant + org data
 */
export async function downloadTicketPDF(data) {
  const { registration, event, participant, org } = data;

  const html = await buildTicketHTML({ registration, event, participant, org });
  const win = window.open('', '_blank', 'width=600,height=500');
  if (!win) {
    throw new Error('Popup blocked. Please allow popups to download tickets.');
  }

  win.document.write(html);
  win.document.close();
  win.focus();
}

/**
 * Generate ticket HTML for a given registration.
 */
export async function buildTicketHTML({ registration, event, participant, org }) {
  const qrDataUrl = await generateQRDataUrl(registration.qr_payload);
  const orgColor = org.primary_color || '#2563EB';

  const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const eventTime = new Date(event.start_date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket — ${registration.ticket_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .ticket {
      width: 420px;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    }
    .ticket-header {
      background: ${orgColor};
      padding: 24px;
      color: white;
    }
    .ticket-org { font-size: 13px; opacity: 0.85; margin-bottom: 4px; }
    .ticket-event { font-size: 20px; font-weight: 700; line-height: 1.3; }
    .ticket-body { padding: 24px; }
    .ticket-info { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .ticket-info-row { display: flex; gap: 8px; }
    .ticket-info-icon { font-size: 16px; flex-shrink: 0; }
    .ticket-info-text { font-size: 13px; color: #374151; }
    .ticket-info-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .ticket-divider { height: 1px; background: #f3f4f6; margin: 16px 0; }
    .ticket-holder { display: flex; justify-content: space-between; align-items: flex-end; }
    .ticket-holder-info {}
    .ticket-holder-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .ticket-holder-name { font-size: 16px; font-weight: 700; color: #111827; }
    .ticket-holder-email { font-size: 12px; color: #6b7280; }
    .ticket-qr { text-align: center; }
    .ticket-qr img { width: 80px; height: 80px; }
    .ticket-number { text-align: center; font-size: 11px; font-family: monospace; color: #9ca3af; margin-top: 4px; }
    .ticket-footer {
      background: #f9fafb;
      padding: 12px 24px;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px dashed #e5e7eb;
    }
    .btn-print {
      display: block;
      width: 100%;
      margin-top: 16px;
      padding: 12px;
      background: ${orgColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div>
    <div class="ticket">
      <div class="ticket-header">
        <div class="ticket-org">${org.name}</div>
        <div class="ticket-event">${event.title}</div>
      </div>
      <div class="ticket-body">
        <div class="ticket-info">
          <div class="ticket-info-row">
            <span class="ticket-info-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
            <div>
              <div class="ticket-info-label">Date</div>
              <div class="ticket-info-text">${eventDate}</div>
            </div>
          </div>
          <div class="ticket-info-row">
            <span class="ticket-info-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <div>
              <div class="ticket-info-label">Time</div>
              <div class="ticket-info-text">${eventTime}</div>
            </div>
          </div>
          ${event.location_name ? `<div class="ticket-info-row">
            <span class="ticket-info-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
            <div>
              <div class="ticket-info-label">Venue</div>
              <div class="ticket-info-text">${event.location_name}</div>
            </div>
          </div>` : ''}
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-holder">
          <div class="ticket-holder-info">
            <div class="ticket-holder-label">Attendee</div>
            <div class="ticket-holder-name">${participant.first_name} ${participant.last_name}</div>
            <div class="ticket-holder-email">${participant.email}</div>
          </div>
          <div class="ticket-qr">
            <img src="${qrDataUrl}" alt="QR Code">
            <div class="ticket-number">${registration.ticket_number}</div>
          </div>
        </div>
      </div>
      <div class="ticket-footer">Present this ticket at the event entrance • Powered by EventPass</div>
    </div>
    <button class="btn-print no-print" onclick="window.print()" style="display:flex;align-items:center;justify-content:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print Ticket</button>
  </div>
  
  <script>
    function triggerPrint() {
      setTimeout(() => {
        window.print();
      }, 500);
    }
    if (document.readyState === 'complete') {
      triggerPrint();
    } else {
      window.onload = triggerPrint;
    }
  </script>
</body>
</html>`;
}

/**
 * Generate a QR code data URL from a payload string.
 * Uses QRCode.js if available, falls back to text.
 */
async function generateQRDataUrl(payload) {
  // QRCode.js is loaded via CDN in the HTML shells
  if (typeof QRCode !== 'undefined') {
    return new Promise((resolve) => {
      QRCode.toDataURL(payload, { width: 160, margin: 1, errorCorrectionLevel: 'M' }, (err, url) => {
        if (err) {
          console.warn('[PDF] QR generation error:', err);
          // Fallback to API if library fails
          resolve(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=160x160&margin=4`);
        } else {
          resolve(url);
        }
      });
    });
  }
  // Fallback: use a QR API service
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=160x160&margin=4`;
}

/**
 * Open certificate in a new printable window using server-generated HTML.
 * The HTML is generated by the Edge Function.
 */
export function openCertificatePrintWindow(certHTML) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) throw new Error('Popup blocked. Please allow popups to view certificates.');

  win.document.write(certHTML);
  win.document.close();
  win.focus();

  // Add print button
  const btn = win.document.createElement('div');
  btn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;gap:8px;';
  btn.innerHTML = `
    <button onclick="window.print()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#16a34a;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print / Save as PDF
    </button>
    <button onclick="window.close()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close
    </button>
  `;
  win.document.body.appendChild(btn);
}

/**
 * Generate a QR code and render it into a DOM element.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {string} data - The QR payload
 * @param {number} size - Width/height in px
 */
export function renderQRCode(container, data, size = 200) {
  if (typeof QRCode === 'undefined') {
    container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}" alt="QR Code" width="${size}" height="${size}">`;
    return;
  }

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  QRCode.toCanvas(canvas, data, { width: size, margin: 2, errorCorrectionLevel: 'M' }, (err) => {
    if (err) {
      console.error('[PDF] QR canvas error:', err);
      container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}" alt="QR Code">`;
    }
  });
}

export default { downloadTicketPDF, buildTicketHTML, openCertificatePrintWindow, renderQRCode };
