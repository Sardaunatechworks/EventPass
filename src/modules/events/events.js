// ============================================================
// EventPass: src/modules/events/events.js
// Events list with search, filter, and actions
// ============================================================
import { EventsService } from '../../services/events.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';
import { formatDate, formatDateRange, renderStatusBadge } from '../../utils/formatters.js';

export async function renderEvents(container, session) {
  const { org, permissions } = session;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <h1 class="page-title">Events</h1>
          <p class="page-subtitle">Manage all events for ${org.name}</p>
        </div>
        ${permissions?.can('events:create') ? `
          <a href="#/events/new" class="btn btn-primary" id="create-event-btn">+ Create Event</a>
        ` : ''}
      </div>

      <div id="events-table"></div>
    </div>
  `;

  const tableContainer = container.querySelector('#events-table');

  const table = new DataTable(tableContainer, {
    columns: [
      {
        key: 'title',
        label: 'Event',
        sortKey: 'title',
        render: (row) => `
          <div>
            <a href="#/events/${row.id}" class="font-medium" style="color:var(--color-text);text-decoration:none;"
              onmouseover="this.style.color='var(--color-primary)'"
              onmouseout="this.style.color='var(--color-text)'"
            >${row.title}</a>
            ${row.programs?.name ? `<div class="text-xs text-muted">${row.programs.name}</div>` : ''}
          </div>
        `,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'badge',
        badgeConfig: (v) => ({
          draft:     { label: 'Draft',     class: 'badge-gray' },
          published: { label: 'Published', class: 'badge-green' },
          ended:     { label: 'Ended',     class: 'badge-blue' },
          archived:  { label: 'Archived',  class: 'badge-orange' },
        }[v] || { label: v, class: 'badge-gray' }),
        width: '100px',
      },
      {
        key: 'start_date',
        label: 'Date',
        sortKey: 'start_date',
        render: (row) => `<span class="text-sm">${formatDate(row.start_date, 'short')}</span>`,
        width: '120px',
      },
      {
        key: 'location_name',
        label: 'Venue',
        render: (row) => row.is_virtual
          ? '<span class="badge badge-blue" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Virtual</span>'
          : `<span class="text-sm text-secondary truncate">${row.location_name || '—'}</span>`,
        width: '180px',
      },
      {
        key: 'capacity',
        label: 'Capacity',
        render: (row) => row.capacity ? row.capacity.toLocaleString() : '<span class="text-muted">Unlimited</span>',
        width: '100px',
      },
    ],
    fetchData: async (params) => {
      const result = await EventsService.listEvents(org.id, {
        search: params.search,
        status: params.filters.status,
        page: params.page,
        pageSize: params.pageSize,
        orderBy: params.sortBy || 'start_date',
        ascending: params.sortAsc,
      });
      return { data: result.events, total: result.total };
    },
    filterable: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
          { value: 'ended', label: 'Ended' },
          { value: 'archived', label: 'Archived' },
        ],
      },
    ],
    actions: [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        label: 'Open',
        onClick: (row) => { window.location.hash = `/events/${row.id}`; },
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        label: 'Edit',
        onClick: (row) => { window.location.hash = `/events/${row.id}/edit`; },
        hidden: (row) => !permissions?.can('events:create') || row.status === 'archived',
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        label: 'Publish',
        onClick: async (row) => {
          try {
            if (row.status === 'published') {
              await EventsService.unpublishEvent(row.id, org.id);
              Toast.success('Event unpublished');
            } else {
              await EventsService.publishEvent(row.id, org.id);
              Toast.success('Event published! Registration is now open.');
            }
            table.refresh();
          } catch (err) {
            Toast.error(err.message, 'Publish failed');
          }
        },
        hidden: (row) => !permissions?.can('events:publish') || row.status === 'archived' || row.status === 'ended',
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        label: 'Clone',
        onClick: async (row) => {
          try {
            const clone = await EventsService.cloneEvent(row.id, org.id, session.user.id);
            Toast.success('Event cloned successfully');
            window.location.hash = `/events/${clone.id}/edit`;
          } catch (err) {
            Toast.error(err.message, 'Clone failed');
          }
        },
        hidden: () => !permissions?.can('events:clone'),
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        label: 'Delete',
        onClick: (row) => {
          confirmModal({
            title: 'Delete Event',
            message: `Are you sure you want to delete "${row.title}"? This action cannot be undone.`,
            confirmLabel: 'Delete',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              try {
                await EventsService.deleteEvent(row.id, org.id);
                Toast.success('Event deleted successfully');
                table.refresh();
              } catch (err) {
                Toast.error(err.message, 'Delete failed');
              }
            },
          });
        },
        hidden: () => !permissions?.can('events:delete'),
      },
    ],
    rowClickHandler: (row) => { window.location.hash = `/events/${row.id}`; },
    emptyTitle: 'No events yet',
    emptyText: 'Create your first event to start managing registrations and attendance.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    searchable: true,
  });

  await table.render();
}
