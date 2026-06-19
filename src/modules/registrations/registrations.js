// ============================================================
// EventPass: src/modules/registrations/registrations.js
// Registration management for an event
// ============================================================
import { RegistrationsService } from '../../services/registrations.service.js';
import { EventsService } from '../../services/events.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { confirmModal, openModal, closeModal } from '../../components/modal.js';
import { formatDate, formatNumber, renderStatusBadge } from '../../utils/formatters.js';
import { downloadTicketPDF } from '../../utils/pdf.js';

export async function renderRegistrations(container, session, eventId) {
  const { org, permissions } = session;

  if (!permissions?.can('registrations:view')) {
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

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <a href="#/events/${eventId}" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> ${event.title}</a>
          <h1 class="page-title mt-2">Registrations</h1>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" id="export-regs-btn" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV</button>
        </div>
      </div>
      <div id="registrations-table"></div>
    </div>
  `;

  const table = new DataTable(container.querySelector('#registrations-table'), {
    columns: [
      {
        label: 'Participant',
        render: (row) => {
          const p = row.participants;
          return `
            <div>
              <div class="font-medium">${p?.first_name || ''} ${p?.last_name || ''}</div>
              <div class="text-xs text-muted">${p?.email || ''}</div>
            </div>
          `;
        },
      },
      {
        key: 'ticket_number',
        label: 'Ticket',
        render: (row) => `<span class="text-mono text-xs">${row.ticket_number}</span>`,
        width: '170px',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'badge',
        badgeConfig: (v) => ({
          confirmed:  { label: 'Confirmed',  class: 'badge-green' },
          pending:    { label: 'Pending',    class: 'badge-yellow' },
          cancelled:  { label: 'Cancelled',  class: 'badge-red' },
          waitlisted: { label: 'Waitlisted', class: 'badge-blue' },
        }[v] || { label: v, class: 'badge-gray' }),
        width: '110px',
      },
      {
        key: 'attendance',
        label: 'Attended',
        render: (row) => row.attendance?.[0]
          ? `<span class="badge badge-green" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${formatDate(row.attendance[0].checked_in_at, 'time')}</span>`
          : `<span class="badge badge-gray">Not yet</span>`,
        width: '110px',
      },
      {
        key: 'created_at',
        label: 'Registered',
        type: 'datetime',
        width: '140px',
      },
    ],
    fetchData: async (params) => {
      const result = await RegistrationsService.listRegistrations(eventId, org.id, {
        search: params.search,
        status: params.filters.status,
        page: params.page,
        pageSize: params.pageSize,
      });
      return { data: result.registrations, total: result.total };
    },
    filterable: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'pending', label: 'Pending' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'waitlisted', label: 'Waitlisted' },
        ],
      },
    ],
    actions: [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        label: 'View',
        onClick: (row) => showRegistrationDetail(row, event, org),
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v8H4V12"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
        label: 'Download Ticket',
        onClick: async (row) => {
          try {
            await downloadTicketPDF({
              registration: row,
              event,
              participant: row.participants,
              org,
            });
          } catch (err) {
            Toast.error(err.message);
          }
        },
        hidden: (row) => row.status !== 'confirmed',
      },
      ...(permissions?.can('registrations:manage') ? [
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
          label: 'Approve',
          onClick: async (row) => {
            try {
              await RegistrationsService.approveRegistration(row.id, org.id, session.user.id);
              Toast.success('Registration approved');
              table.refresh();
            } catch (err) { Toast.error(err.message); }
          },
          hidden: (row) => row.status !== 'pending',
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
          label: 'Cancel',
          onClick: (row) => {
            confirmModal({
              title: 'Cancel Registration',
              message: `Cancel registration for ${row.participants?.first_name} ${row.participants?.last_name}? This cannot be undone.`,
              confirmLabel: 'Cancel Registration',
              onConfirm: async () => {
                await RegistrationsService.cancelRegistration(row.id, org.id, 'Cancelled by staff');
                Toast.success('Registration cancelled');
                table.refresh();
              },
            });
          },
          hidden: (row) => row.status === 'cancelled',
        },
      ] : []),
    ],
    searchable: true,
    emptyTitle: 'No registrations yet',
    emptyText: 'Share the registration link to start collecting registrations.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  });

  await table.render();

  // Export
  container.querySelector('#export-regs-btn').addEventListener('click', async () => {
    try {
      const rows = await RegistrationsService.exportRegistrations(eventId, org.id);
      downloadCSV(rows, `registrations_${event.title}_${formatDate(new Date(), 'iso')}.csv`);
    } catch (err) {
      Toast.error(err.message);
    }
  });
}

function showRegistrationDetail(reg, event, org) {
  const p = reg.participants;
  const checkedIn = reg.attendance?.[0];

  openModal({
    title: 'Registration Details',
    size: 'lg',
    content: `
      <div class="grid-2 gap-4">
        <div>
          <div class="text-xs text-muted mb-1">Participant</div>
          <div class="font-semibold">${p?.first_name} ${p?.last_name}</div>
          <div class="text-sm text-muted">${p?.email}</div>
          ${p?.phone ? `<div class="text-sm text-muted">${p.phone}</div>` : ''}
        </div>
        <div>
          <div class="text-xs text-muted mb-1">Ticket Number</div>
          <div class="text-mono font-bold" style="font-size:15px;">${reg.ticket_number}</div>
          <div class="mt-2">${renderStatusBadge(reg.status, 'registration')}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid-2 gap-4">
        <div>
          <div class="text-xs text-muted mb-1">Registered</div>
          <div class="text-sm">${formatDate(reg.created_at, 'datetime')}</div>
        </div>
        <div>
          <div class="text-xs text-muted mb-1">Check-in Status</div>
          ${checkedIn
            ? `<div class="badge badge-green" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Checked in at ${formatDate(checkedIn.checked_in_at, 'time')}</div>`
            : `<div class="badge badge-gray">Not checked in</div>`
          }
        </div>
      </div>
      ${reg.registration_answers?.length > 0 ? `
        <div class="divider"></div>
        <div>
          <div class="text-xs text-muted mb-3">Custom Field Answers</div>
          ${reg.registration_answers.map(a => `
            <div class="mb-3">
              <div class="text-xs font-medium text-secondary">${a.registration_fields?.field_label || 'Field'}</div>
              <div class="text-sm">${a.answer || '—'}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `,
    actions: [{ label: 'Close', class: 'btn-secondary' }],
  });
}

function downloadCSV(rows, filename) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Job Title', 'Ticket #', 'Status', 'Source', 'Registered At', 'Checked In'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.participants?.first_name, r.participants?.last_name, r.participants?.email,
      r.participants?.phone, r.participants?.organization_name, r.participants?.job_title,
      r.ticket_number, r.status, r.registration_source, r.created_at,
      r.attendance?.[0]?.checked_in_at || '',
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
