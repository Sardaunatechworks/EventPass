// ============================================================
// EventPass: src/modules/participants/participants.js
// Global participant directory
// ============================================================
import { ParticipantsService } from '../../services/participants.service.js';
import { DataTable } from '../../components/table.js';
import { openModal } from '../../components/modal.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';

export async function renderParticipants(container, session) {
  const { org } = session;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <h1 class="page-title">Participants</h1>
          <p class="page-subtitle">All participants who have registered for events at ${org.name}</p>
        </div>
      </div>

      <div id="participants-table"></div>
    </div>
  `;

  const table = new DataTable(container.querySelector('#participants-table'), {
    columns: [
      {
        label: 'Participant',
        type: 'avatar',
        nameKey: null,
        render: (row) => `
          <div class="flex items-center gap-3">
            <div class="avatar">${(row.first_name?.[0] || '') + (row.last_name?.[0] || '')}</div>
            <div>
              <div class="font-medium">${row.first_name} ${row.last_name}</div>
              <div class="text-xs text-muted">${row.email}</div>
            </div>
          </div>
        `,
      },
      {
        key: 'phone',
        label: 'Phone',
        render: (row) => row.phone || '<span class="text-muted">—</span>',
        width: '140px',
      },
      {
        key: 'organization_name',
        label: 'Organization',
        render: (row) => row.organization_name || '<span class="text-muted">—</span>',
        width: '160px',
      },
      {
        label: 'Events',
        render: (row) => {
          const count = row.registrations?.length || 0;
          return `<span class="badge badge-blue">${count} event${count !== 1 ? 's' : ''}</span>`;
        },
        width: '80px',
      },
      {
        key: 'created_at',
        label: 'First Seen',
        type: 'date',
        sortKey: 'created_at',
        width: '120px',
      },
    ],
    fetchData: async (params) => {
      const result = await ParticipantsService.listParticipants(org.id, {
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
      });
      return { data: result.participants, total: result.total };
    },
    rowClickHandler: async (row) => {
      try {
        const full = await ParticipantsService.getParticipant(row.id, org.id);
        showParticipantDetail(full);
      } catch (err) { }
    },
    searchable: true,
    emptyTitle: 'No participants yet',
    emptyText: 'Participants will appear here once they register for any event.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  });

  await table.render();
}

function showParticipantDetail(p) {
  openModal({
    title: `${p.first_name} ${p.last_name}`,
    size: 'lg',
    content: `
      <div class="flex items-start gap-4 mb-5">
        <div class="avatar avatar-xl">${(p.first_name?.[0] || '') + (p.last_name?.[0] || '')}</div>
        <div>
          <div class="font-bold text-lg">${p.first_name} ${p.last_name}</div>
          <div class="text-sm text-muted">${p.email}</div>
          ${p.phone ? `<div class="text-sm text-muted">${p.phone}</div>` : ''}
          ${p.organization_name ? `<div class="text-sm text-secondary mt-1" style="display:flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> ${p.organization_name} ${p.job_title ? `· ${p.job_title}` : ''}</div>` : ''}
        </div>
      </div>

      <div class="divider"></div>

      <h3 class="font-semibold mb-4">Event History (${p.registrations?.length || 0})</h3>
      ${p.registrations?.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:var(--space-3);max-height:300px;overflow-y:auto;">
          ${p.registrations.map(r => `
            <div class="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div>
                <div class="font-medium text-sm">${r.events?.title || '—'}</div>
                <div class="text-xs text-muted">${formatDate(r.events?.start_date, 'short')}</div>
              </div>
              <div class="flex items-center gap-2">
                ${r.attendance?.[0] ? `<span class="badge badge-green" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Attended</span>` : ''}
                ${r.certificates?.[0] ? `<span class="badge badge-yellow" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M14.9 12.6L16 20l-4-2-4 2 1.1-7.4"/></svg> Certified</span>` : ''}
                <span class="badge ${r.status === 'confirmed' ? 'badge-green' : 'badge-gray'}">${r.status}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `<p class="text-sm text-muted">No events found.</p>`}
    `,
    actions: [{ label: 'Close', class: 'btn-secondary' }],
  });
}
