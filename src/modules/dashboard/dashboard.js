// ============================================================
// EventPass: src/modules/dashboard/dashboard.js
// Organization dashboard with stats and upcoming events
// ============================================================
import { OrganizationService } from '../../services/organization.service.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';

export async function renderDashboard(container, session) {
  const { org, permissions } = session;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back — here's what's happening at ${org.name}</p>
        </div>
        ${permissions?.can('events:create') ? `
          <a href="#/events/new" class="btn btn-primary" id="new-event-btn">
            + New Event
          </a>
        ` : ''}
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid" id="stats-grid">
        ${[1,2,3,4].map(() => `
          <div class="stat-card">
            <div class="skeleton" style="height:12px;width:60%;margin-bottom:12px;"></div>
            <div class="skeleton" style="height:32px;width:40%;margin-bottom:8px;"></div>
            <div class="skeleton" style="height:12px;width:50%;"></div>
          </div>
        `).join('')}
      </div>

      <div class="grid-2" style="gap:var(--space-5);">
        <!-- Upcoming Events -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Upcoming Events</h2>
            <a href="#/events" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:5px;">View all <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></a>
          </div>
          <div id="upcoming-events" style="min-height:120px;display:flex;align-items:center;justify-content:center;">
            <div class="loading-spinner"></div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Quick Actions</h2>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
            ${permissions?.can('events:create') ? `
              <a href="#/events/new" class="btn btn-secondary" style="justify-content:flex-start;gap:12px;">
                <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> Create New Event
              </a>
            ` : ''}
            ${permissions?.can('registrations:view') ? `
              <a href="#/participants" class="btn btn-secondary" style="justify-content:flex-start;gap:12px;">
                <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span> View Participants
              </a>
            ` : ''}
            ${permissions?.can('reports:view') ? `
              <a href="#/reports" class="btn btn-secondary" style="justify-content:flex-start;gap:12px;">
                <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span> View Reports
              </a>
            ` : ''}
            ${permissions?.can('org:members:manage') ? `
              <a href="#/organization/staff" class="btn btn-secondary" style="justify-content:flex-start;gap:12px;">
                <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span> Manage Staff
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Load stats
  try {
    const stats = await OrganizationService.getDashboardStats(org.id);
    if (stats) {
      renderStats(document.getElementById('stats-grid'), stats);
    }
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
  }

  // Load upcoming events
  try {
    const events = await OrganizationService.getUpcomingEvents(org.id, 5);
    renderUpcomingEvents(document.getElementById('upcoming-events'), events, permissions);
  } catch (err) {
    console.error('[Dashboard] Events error:', err);
    document.getElementById('upcoming-events').innerHTML = `<p class="text-muted text-sm p-4">Could not load events</p>`;
  }
}

function renderStats(container, stats) {
  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Events</div>
      <div class="stat-value">${formatNumber(stats.total_events)}</div>
      <div class="stat-change">${formatNumber(stats.active_events)} active now</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Registrations</div>
      <div class="stat-value">${formatNumber(stats.total_registrations)}</div>
      <div class="stat-change positive">+${formatNumber(stats.this_month_registrations)} this month</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Attendees</div>
      <div class="stat-value">${formatNumber(stats.total_attendance)}</div>
      <div class="stat-change">${formatNumber(stats.total_participants)} unique participants</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Certificates Issued</div>
      <div class="stat-value">${formatNumber(stats.total_certificates)}</div>
      <div class="stat-change">All time</div>
    </div>
  `;
}

function renderUpcomingEvents(container, events, permissions) {
  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8);">
        <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="empty-state-title">No upcoming events</div>
        ${permissions?.can('events:create') ? `
          <a href="#/events/new" class="btn btn-primary btn-sm">Create your first event</a>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="padding:0;">
      ${events.map(event => `
        <a href="#/events/${event.id}" class="flex items-center gap-3 p-4"
          style="border-bottom:1px solid var(--color-border);text-decoration:none;transition:background 0.1s;"
          onmouseover="this.style.background='rgba(255,255,255,0.02)'"
          onmouseout="this.style.background='transparent'">
          <div style="width:40px;height:40px;background:var(--color-primary-bg);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
            <div style="font-size:11px;font-weight:700;color:var(--color-primary-h);line-height:1;">
              ${new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </div>
            <div style="font-size:16px;font-weight:800;color:var(--color-primary);line-height:1;">
              ${new Date(event.start_date).getDate()}
            </div>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="font-medium truncate" style="color:var(--color-text);">${event.title}</div>
            <div class="text-sm text-muted">${event.location_name || 'Online'}</div>
          </div>
          <span class="badge ${event.status === 'published' ? 'badge-green' : 'badge-gray'}">${event.status}</span>
        </a>
      `).join('')}
    </div>
  `;
}
