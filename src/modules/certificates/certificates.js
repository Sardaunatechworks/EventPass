// ============================================================
// EventPass: src/modules/certificates/certificates.js
// Certificate issuance, revocation, download
// ============================================================
import { CertificatesService } from '../../services/certificates.service.js';
import { EventsService } from '../../services/events.service.js';
import { EmailService } from '../../services/email.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';
import { openCertificatePrintWindow } from '../../utils/pdf.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';

export async function renderCertificates(container, session, eventId) {
  const { org, user, permissions } = session;

  if (!permissions?.can('certificates:issue')) {
    container.innerHTML = `<div class="page-content"><p class="text-danger">Permission denied.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="page-loading"><div class="loading-spinner"></div></div>`;

  let event;
  try {
    event = await EventsService.getEvent(eventId, org.id);
  } catch (err) {
    container.innerHTML = `<div class="page-content"><p class="text-danger">Event not found.</p></div>`;
    return;
  }

  if (!event.certificate_enabled) {
    container.innerHTML = `
      <div style="padding:var(--space-6);">
        <a href="#/events/${eventId}" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> ${event.title}</a>
        <div class="empty-state mt-6">
          <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg></div>
          <div class="empty-state-title">Certificates Not Enabled</div>
          <div class="empty-state-text">Enable certificate issuance in the event settings to use this feature.</div>
          <a href="#/events/${eventId}/edit" class="btn btn-primary">Edit Event Settings</a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <a href="#/events/${eventId}" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> ${event.title}</a>
          <h1 class="page-title mt-2">Certificates</h1>
        </div>
        <div class="flex gap-2">
          ${permissions?.can('certificates:issue') ? `
            <button class="btn btn-primary" id="bulk-issue-btn" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> Issue to All Attendees</button>
          ` : ''}
        </div>
      </div>

      <!-- Bulk progress bar (hidden by default) -->
      <div id="bulk-progress" style="display:none;" class="card mb-5">
        <div class="card-body">
          <div class="flex justify-between mb-2">
            <span class="text-sm font-medium">Issuing certificates...</span>
            <span id="bulk-count" class="text-sm text-muted">0 / 0</span>
          </div>
          <div style="height:8px;background:var(--color-surface-2);border-radius:4px;overflow:hidden;">
            <div id="bulk-progress-bar" style="height:100%;width:0%;background:var(--color-primary);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>

      <div id="certificates-table"></div>
    </div>
  `;

  // Bulk issue
  container.querySelector('#bulk-issue-btn')?.addEventListener('click', () => {
    confirmModal({
      title: 'Issue Certificates to All Attendees',
      message: 'This will generate certificates for all participants who attended this event. Certificates already issued will be skipped.',
      confirmLabel: 'Issue Certificates',
      confirmClass: 'btn-primary',
      onConfirm: async () => {
        const progressContainer = container.querySelector('#bulk-progress');
        const progressBar = container.querySelector('#bulk-progress-bar');
        const bulkCount = container.querySelector('#bulk-count');

        progressContainer.style.display = 'block';
        container.querySelector('#bulk-issue-btn').disabled = true;

        try {
          const result = await CertificatesService.bulkIssueCertificates(
            eventId, org.id, user.id,
            ({ current, total, issued }) => {
              const pct = Math.round((current / total) * 100);
              progressBar.style.width = pct + '%';
              bulkCount.textContent = `${current} / ${total}`;
            }
          );

          progressContainer.style.display = 'none';
          Toast.success(
            `Done! ${result.issued} issued, ${result.skipped} skipped, ${result.failed} failed.`,
            'Bulk Issue Complete'
          );
          certsTable.refresh();
        } catch (err) {
          progressContainer.style.display = 'none';
          Toast.error(err.message, 'Bulk Issue Failed');
        } finally {
          container.querySelector('#bulk-issue-btn').disabled = false;
        }
      },
    });
  });

  // Certificates table
  const certsTable = new DataTable(container.querySelector('#certificates-table'), {
    columns: [
      {
        label: 'Participant',
        render: (row) => `
          <div>
            <div class="font-medium">${row.participants?.first_name || ''} ${row.participants?.last_name || ''}</div>
            <div class="text-xs text-muted">${row.participants?.email || ''}</div>
          </div>
        `,
      },
      {
        key: 'certificate_number',
        label: 'Certificate #',
        render: (row) => `<span class="text-mono text-xs">${row.certificate_number}</span>`,
        width: '200px',
      },
      {
        key: 'verification_code',
        label: 'Verify Code',
        render: (row) => `<span class="text-mono text-xs font-bold">${row.verification_code}</span>`,
        width: '140px',
      },
      {
        key: 'issued_at',
        label: 'Issued',
        type: 'datetime',
        width: '140px',
      },
      {
        key: 'revoked_at',
        label: 'Status',
        render: (row) => row.revoked_at
          ? `<span class="badge badge-red">Revoked</span>`
          : `<span class="badge badge-green">Valid</span>`,
        width: '80px',
      },
    ],
    fetchData: async (params) => {
      const result = await CertificatesService.listCertificates(eventId, org.id, {
        page: params.page,
        pageSize: params.pageSize,
      });
      return { data: result.certificates, total: result.total };
    },
    actions: [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
        label: 'Print',
        onClick: async (row) => {
          try {
            // Re-generate to get fresh HTML
            const result = await CertificatesService.issueCertificate(row.registration_id, user.id);
            openCertificatePrintWindow(result.html);
          } catch (err) {
            Toast.error(err.message, 'Print Failed');
          }
        },
        hidden: (row) => !!row.revoked_at,
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',
        label: 'Send Email',
        onClick: async (row) => {
          try {
            await CertificatesService.sendCertificateEmail(row, row.participants?.email, org);
            Toast.success(`Certificate email sent to ${row.participants?.email}`);
          } catch (err) {
            Toast.error(err.message);
          }
        },
        hidden: (row) => !!row.revoked_at,
      },
      ...(permissions?.can('certificates:revoke') ? [{
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        label: 'Revoke',
        onClick: (row) => {
          confirmModal({
            title: 'Revoke Certificate',
            message: `Revoke certificate ${row.certificate_number}? The verification code will become invalid.`,
            confirmLabel: 'Revoke',
            onConfirm: async () => {
              await CertificatesService.revokeCertificate(row.id, org.id, user.id, 'Revoked by admin');
              Toast.success('Certificate revoked');
              certsTable.refresh();
            },
          });
        },
        hidden: (row) => !!row.revoked_at,
      }] : []),
    ],
    emptyTitle: 'No certificates issued',
    emptyText: 'Issue certificates to all attendees with the button above.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>',
  });

  await certsTable.render();
}
