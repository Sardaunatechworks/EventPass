// ============================================================
// EventPass: src/modules/reports/reports.js
// Analytics and reporting overview
// ============================================================
import { supabase } from '../../services/supabase.js';
import { OrganizationService } from '../../services/organization.service.js';
import { formatNumber, formatDate } from '../../utils/formatters.js';

export async function renderReports(container, session) {
  const { org } = session;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <h1 class="page-title">Reports & Analytics</h1>
      </div>

      <div class="stats-grid mb-6" id="report-stats">
        ${[1,2,3,4].map(() => `
          <div class="stat-card">
            <div class="skeleton" style="height:12px;width:60%;margin-bottom:12px;"></div>
            <div class="skeleton" style="height:32px;width:40%;margin-bottom:8px;"></div>
          </div>
        `).join('')}
      </div>

      <div class="grid-2 gap-5">
        <!-- Events by Type -->
        <div class="card">
          <div class="card-header"><h2 class="card-title">Events by Type</h2></div>
          <div class="card-body" id="events-by-type">
            <div class="loading-spinner"></div>
          </div>
        </div>

        <!-- Registration Sources -->
        <div class="card">
          <div class="card-header"><h2 class="card-title">Registration Activity (Last 30 Days)</h2></div>
          <div class="card-body" id="reg-activity">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>

      <!-- Recent Events Table -->
      <div class="card mt-5">
        <div class="card-header">
          <h2 class="card-title">Event Performance</h2>
          <button class="btn btn-secondary btn-sm" id="export-report-btn" style="display:inline-flex;align-items:center;gap:6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
        <div class="table-scroll">
          <table class="table" id="events-report-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Registrations</th>
                <th>Attended</th>
                <th>Attendance %</th>
                <th>Certificates</th>
              </tr>
            </thead>
            <tbody id="report-table-body">
              ${[1,2,3,4,5].map(() => `
                <tr>${[1,2,3,4,5,6].map(() => `<td><div class="skeleton" style="height:14px;"></div></td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Load data
  let stats = null;
  try {
    stats = await OrganizationService.getDashboardStats(org.id);
    if (stats) {
      container.querySelector('#report-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Events</div>
          <div class="stat-value">${formatNumber(stats.total_events)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Registrations</div>
          <div class="stat-value">${formatNumber(stats.total_registrations)}</div>
          <div class="stat-change positive">+${formatNumber(stats.this_month_registrations)} this month</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Attendees</div>
          <div class="stat-value">${formatNumber(stats.total_attendance)}</div>
          <div class="stat-change">${stats.avg_attendance_rate || 0}% avg rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unique Participants</div>
          <div class="stat-value">${formatNumber(stats.total_participants)}</div>
        </div>
      `;
    }
  } catch (err) { console.warn('[Reports] Stats error:', err); }

  // Load event performance
  try {
    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_date, event_type')
      .eq('organization_id', org.id)
      .is('deleted_at', null)
      .order('start_date', { ascending: false })
      .limit(20);

    if (events?.length) {
      // Fetch stats for each event
      const statsPromises = events.map(e => supabase.rpc('get_event_stats', { p_event_id: e.id }));
      const statsResults = await Promise.allSettled(statsPromises);

      const rows = events.map((e, i) => {
        const s = statsResults[i].status === 'fulfilled' ? statsResults[i].value.data : {};
        return { ...e, stats: s };
      });

      // Events by type
      const byType = {};
      events.forEach(e => {
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
      });

      container.querySelector('#events-by-type').innerHTML = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `
          <div class="flex justify-between items-center mb-3">
            <span class="text-sm capitalize">${type}</span>
            <div class="flex items-center gap-2">
              <div style="width:100px;height:6px;background:var(--color-surface-2);border-radius:3px;overflow:hidden;">
                <div style="width:${Math.round((count / events.length) * 100)}%;height:100%;background:var(--color-primary);border-radius:3px;"></div>
              </div>
              <span class="text-xs text-muted" style="width:24px;text-align:right;">${count}</span>
            </div>
          </div>
        `).join('');

      // Registration activity (monthly totals)
      container.querySelector('#reg-activity').innerHTML = `
        <div class="text-center">
          <div class="stat-value text-primary">${formatNumber(stats?.this_month_registrations || 0)}</div>
          <div class="stat-label">Registrations this month</div>
          <div class="text-sm text-muted mt-2">vs last month: ${formatNumber(stats?.last_month_registrations || 0)}</div>
        </div>
      `;

      // Performance table
      container.querySelector('#report-table-body').innerHTML = rows.map(r => `
        <tr>
          <td class="font-medium">${r.title}</td>
          <td class="text-sm">${formatDate(r.start_date, 'short')}</td>
          <td>${formatNumber(r.stats?.total_registrations || 0)}</td>
          <td>${formatNumber(r.stats?.checked_in || 0)}</td>
          <td>
            <div class="flex items-center gap-2">
              <div style="width:60px;height:4px;background:var(--color-surface-2);border-radius:2px;overflow:hidden;">
                <div style="width:${Math.min(r.stats?.attendance_rate || 0, 100)}%;height:100%;background:var(--color-success);border-radius:2px;"></div>
              </div>
              <span class="text-xs">${r.stats?.attendance_rate || 0}%</span>
            </div>
          </td>
          <td>${formatNumber(r.stats?.certificates_issued || 0)}</td>
        </tr>
      `).join('');

      // Export
      container.querySelector('#export-report-btn').addEventListener('click', () => {
        const csvData = rows.map(r => [
          r.title, formatDate(r.start_date, 'short'), r.event_type,
          r.stats?.total_registrations, r.stats?.checked_in,
          r.stats?.attendance_rate + '%', r.stats?.certificates_issued,
        ].map(v => `"${v || 0}"`).join(','));

        const csv = ['Event,Date,Type,Registrations,Attended,Attendance %,Certificates', ...csvData].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eventpass_report_${org.name}_${formatDate(new Date(), 'iso')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } else {
      container.querySelector('#report-table-body').innerHTML = `<tr><td colspan="6" class="table-empty">No events to report yet.</td></tr>`;
    }
  } catch (err) {
    console.error('[Reports] Table error:', err);
  }
}
