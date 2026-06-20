// ============================================================
// EventPass: src/modules/events/event-detail.js
// Event detail page with stats, actions, and tab navigation
// ============================================================
import { EventsService } from '../../services/events.service.js';
import { Toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';
import { formatDate, formatDateRange, formatNumber, renderStatusBadge } from '../../utils/formatters.js';

export async function renderEventDetail(container, session, eventId) {
  const { org, permissions } = session;

  container.innerHTML = `<div class="page-loading"><div class="loading-spinner"></div></div>`;

  let event, stats;
  try {
    [event, stats] = await Promise.all([
      EventsService.getEvent(eventId, org.id),
      EventsService.getEventStats(eventId),
    ]);
  } catch (err) {
    container.innerHTML = `
      <div class="page-content">
        <div class="empty-state">
          <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="empty-state-title">Event not found</div>
          <a href="#/events" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back to Events</a>
        </div>
      </div>
    `;
    return;
  }

  const regUrl = `${window.location.origin}/register#event=${event.id}`;
  const canEdit = permissions?.can('events:create') && event.status !== 'archived';
  const canPublish = permissions?.can('events:publish');

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <!-- Header -->
      <div style="margin-bottom:var(--space-6);">
        <a href="#/events" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Events</a>
        <div class="flex items-start justify-between mt-3 flex-wrap-mobile">
          <div>
            <div class="flex items-center gap-3 mb-1">
              <h1 class="page-title">${event.title}</h1>
              ${renderStatusBadge(event.status)}
            </div>
            <div class="flex gap-4 flex-wrap">
              <span class="text-sm text-muted" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${formatDateRange(event.start_date, event.end_date)}</span>
              ${event.location_name ? `<span class="text-sm text-muted" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${event.location_name}</span>` : ''}
              ${event.is_virtual ? `<span class="badge badge-blue" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Virtual</span>` : ''}
            </div>
          </div>
          <div class="flex gap-2 flex-wrap-mobile">
            ${canEdit ? `<a href="#/events/${event.id}/edit" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</a>` : ''}
            ${canPublish && event.status === 'draft' ? `
              <button class="btn btn-primary btn-sm" id="publish-btn" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Publish</button>
            ` : ''}
            ${canPublish && event.status === 'published' ? `
              <button class="btn btn-secondary btn-sm" id="unpublish-btn">Unpublish</button>
            ` : ''}
            ${event.status === 'published' ? `
              <button class="btn btn-secondary btn-sm" id="copy-link-btn" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link</button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid mb-6">
        <div class="stat-card">
          <div class="stat-label">Total Registrations</div>
          <div class="stat-value">${formatNumber(stats?.total_registrations || 0)}</div>
          <div class="stat-change">${formatNumber(stats?.confirmed || 0)} confirmed</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Attendance</div>
          <div class="stat-value">${formatNumber(stats?.checked_in || 0)}</div>
          <div class="stat-change">${stats?.attendance_rate || 0}% attendance rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Capacity</div>
          <div class="stat-value">${event.capacity ? formatNumber(event.capacity) : '∞'}</div>
          <div class="stat-change">
            ${event.capacity
              ? `${Math.round(((stats?.total_registrations || 0) / event.capacity) * 100)}% filled`
              : 'Unlimited'}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Certificates</div>
          <div class="stat-value">${formatNumber(stats?.certificates_issued || 0)}</div>
          <div class="stat-change">${event.certificate_enabled ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>

      <!-- Action Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
        ${permissions?.can('registrations:view') ? `
        <a href="#/events/${event.id}/registrations" class="card" style="text-decoration:none;transition:border-color 0.1s;"
          onmouseover="this.style.borderColor='var(--color-primary)'"
          onmouseout="this.style.borderColor='var(--color-border)'">
          <div class="card-body" style="text-align:center;padding:var(--space-6);">
            <div style="width:40px;height:40px;background:var(--color-surface-2);border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-3);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
            <div class="font-semibold">Registrations</div>
            <div class="text-sm text-muted mt-1">${formatNumber(stats?.total_registrations || 0)} registered</div>
          </div>
        </a>
        ` : ''}
        ${permissions?.can('attendance:record') ? `
        <a href="#/events/${event.id}/attendance" class="card" style="text-decoration:none;transition:border-color 0.1s;"
          onmouseover="this.style.borderColor='var(--color-success)'"
          onmouseout="this.style.borderColor='var(--color-border)'">
          <div class="card-body" style="text-align:center;padding:var(--space-6);">
            <div style="width:40px;height:40px;background:var(--color-success-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-3);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div class="font-semibold">Attendance</div>
            <div class="text-sm text-muted mt-1">${formatNumber(stats?.checked_in || 0)} checked in</div>
          </div>
        </a>
        ` : ''}
        ${permissions?.can('certificates:issue') ? `
        <a href="#/events/${event.id}/certificates" class="card" style="text-decoration:none;transition:border-color 0.1s;"
          onmouseover="this.style.borderColor='var(--color-warning)'"
          onmouseout="this.style.borderColor='var(--color-border)'">
          <div class="card-body" style="text-align:center;padding:var(--space-6);">
            <div style="width:40px;height:40px;background:var(--color-warning-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-3);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg></div>
            <div class="font-semibold">Certificates</div>
            <div class="text-sm text-muted mt-1">${formatNumber(stats?.certificates_issued || 0)} issued</div>
          </div>
        </a>
        ` : ''}
      </div>

      <!-- Event Description -->
      ${event.description ? `
        <div class="card mb-6">
          <div class="card-header"><h2 class="card-title">Description</h2></div>
          <div class="card-body">
            <p class="text-secondary" style="white-space:pre-wrap;line-height:1.7;">${event.description}</p>
          </div>
        </div>
      ` : ''}

      <!-- Registration Link -->
      ${event.status === 'published' ? `
        <div class="card">
          <div class="card-header"><h2 class="card-title">Public Registration Link</h2></div>
          <div class="card-body">
            <div class="flex items-center gap-3">
              <input type="text" class="input flex-1" value="${regUrl}" readonly id="reg-link-input"
                style="font-family:var(--font-mono);font-size:12px;">
              <button class="btn btn-secondary" id="copy-reg-link">Copy</button>
              <a href="${regUrl}" target="_blank" class="btn btn-ghost" style="display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open</a>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Publish
  container.querySelector('#publish-btn')?.addEventListener('click', async () => {
    try {
      await EventsService.publishEvent(event.id, org.id);
      Toast.success('Event published! Registration is now open.');
      renderEventDetail(container, session, eventId);
    } catch (err) { Toast.error(err.message); }
  });

  // Unpublish
  container.querySelector('#unpublish-btn')?.addEventListener('click', () => {
    confirmModal({
      title: 'Unpublish Event',
      message: 'This will close registration and hide the event from the public. You can re-publish at any time.',
      confirmLabel: 'Unpublish',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await EventsService.unpublishEvent(event.id, org.id);
        Toast.success('Event unpublished');
        renderEventDetail(container, session, eventId);
      },
    });
  });

  // Copy link
  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      Toast.success('Link copied to clipboard!');
    } catch {
      document.querySelector('#reg-link-input')?.select();
    }
  };

  container.querySelector('#copy-link-btn')?.addEventListener('click', () => copyLink(regUrl));
  container.querySelector('#copy-reg-link')?.addEventListener('click', () => copyLink(regUrl));
}
