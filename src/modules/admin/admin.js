// ============================================================
// EventPass: src/modules/admin/admin.js
// Platform Super Admin Dashboard — tabbed layout, KPIs, Chart.js, Orgs, Audit Logs
// ============================================================
import { AdminService } from '../../services/admin.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { icon } from '../../utils/icons.js';
import { formatNumber } from '../../utils/formatters.js';

let chartInstance = null;
let cachedOrgs = null;
let cachedLogs = null;

/**
 * Load Chart.js dynamically from CDN.
 */
async function loadChartJS() {
  if (window.Chart) return window.Chart;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error('Failed to load Chart.js library'));
    document.head.appendChild(script);
  });
}

export async function renderAdmin(container, session) {
  // Reset local cache on each mount
  cachedOrgs = null;
  cachedLogs = null;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  container.innerHTML = `
    <style>
      .admin-container {
        padding: var(--space-6);
        max-width: 1200px;
        margin: 0 auto;
      }
      .admin-tabs {
        display: flex;
        gap: var(--space-2);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--space-6);
      }
      .admin-tab-btn {
        padding: var(--space-3) var(--space-4);
        font-weight: 500;
        font-size: 14px;
        color: var(--color-text-3);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .admin-tab-btn:hover {
        color: var(--color-text);
        border-bottom-color: var(--color-border);
      }
      .admin-tab-btn.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        font-weight: 600;
      }
      .admin-panel {
        display: none;
      }
      .admin-panel.active {
        display: block;
        animation: adminFadeIn 0.3s ease;
      }
      @keyframes adminFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* KPI Cards styling */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-5);
        margin-bottom: var(--space-6);
      }
      .kpi-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        box-shadow: var(--shadow-xs);
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        overflow: hidden;
      }
      .kpi-card::after {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; height: 3px;
        background: transparent;
      }
      .kpi-card.kpi-orgs::after { background: var(--color-primary); }
      .kpi-card.kpi-events::after { background: var(--color-info); }
      .kpi-card.kpi-regs::after { background: var(--color-warning); }
      .kpi-card.kpi-certs::after { background: #7C3AED; }

      .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-sm);
      }
      .kpi-icon-box {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-4);
      }
      .kpi-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-3);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--space-1);
      }
      .kpi-value {
        font-size: 28px;
        font-weight: 800;
        color: var(--color-text);
        line-height: 1.1;
      }
      .badge-action-btn {
        cursor: pointer;
        border: none;
        background: transparent;
        padding: 0;
        display: inline-flex;
      }
      .badge-action-btn:hover {
        opacity: 0.8;
      }
    </style>

    <div class="admin-container">
      <div class="page-header" style="margin-bottom:var(--space-6);">
        <div>
          <h1 class="page-title">Super Admin Dashboard</h1>
          <p class="page-subtitle">Oversee all organizations, platform statistics, and global activities.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="admin-tabs" role="tablist">
        <button class="admin-tab-btn active" data-tab="dashboard" role="tab" aria-selected="true">
          ${icon('dashboard')}
          <span>Dashboard</span>
        </button>
        <button class="admin-tab-btn" data-tab="organizations" role="tab" aria-selected="false">
          ${icon('building')}
          <span>Organizations</span>
        </button>
        <button class="admin-tab-btn" data-tab="logs" role="tab" aria-selected="false">
          ${icon('reports')}
          <span>System Logs</span>
        </button>
      </div>

      <!-- Tab Panels -->
      <!-- 1. Dashboard Tab -->
      <div class="admin-panel active" id="panel-dashboard" role="tabpanel">
        <!-- KPI Cards Grid -->
        <div class="kpi-grid">
          <div class="kpi-card kpi-orgs">
            <div class="kpi-icon-box" style="background:rgba(22, 163, 74, 0.08);color:var(--color-primary);">
              ${icon('building')}
            </div>
            <div class="kpi-label">Total Organizations</div>
            <div class="kpi-value" id="kpi-orgs">-</div>
          </div>
          <div class="kpi-card kpi-events">
            <div class="kpi-icon-box" style="background:rgba(37, 99, 235, 0.08);color:var(--color-info);">
              ${icon('calendar')}
            </div>
            <div class="kpi-label">Total Events</div>
            <div class="kpi-value" id="kpi-events">-</div>
          </div>
          <div class="kpi-card kpi-regs">
            <div class="kpi-icon-box" style="background:rgba(217, 119, 6, 0.08);color:var(--color-warning);">
              ${icon('user')}
            </div>
            <div class="kpi-label">Total Registrations</div>
            <div class="kpi-value" id="kpi-regs">-</div>
          </div>
          <div class="kpi-card kpi-certs">
            <div class="kpi-icon-box" style="background:rgba(124, 58, 237, 0.08);color:#7C3AED;">
              ${icon('certificate')}
            </div>
            <div class="kpi-label">Issued Certificates</div>
            <div class="kpi-value" id="kpi-certs">-</div>
          </div>
        </div>

        <!-- Chart Card -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Top Organizations by Scale</h2>
          </div>
          <div class="card-body">
            <div style="position:relative;height:320px;width:100%;">
              <canvas id="admin-analytics-chart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Organizations Tab -->
      <div class="admin-panel" id="panel-organizations" role="tabpanel">
        <div id="organizations-table-container"></div>
      </div>

      <!-- 3. Logs Tab -->
      <div class="admin-panel" id="panel-logs" role="tabpanel">
        <div id="logs-table-container"></div>
      </div>
    </div>
  `;

  // Bind tabs navigation
  const tabButtons = container.querySelectorAll('.admin-tab-btn');
  const tabPanels = container.querySelectorAll('.admin-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabButtons.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });

      tabPanels.forEach(p => {
        const isTarget = p.id === `panel-${tabId}`;
        p.classList.toggle('active', isTarget);
        
        // Render chart when dashboard panel is active and Chart.js is ready
        if (isTarget && tabId === 'dashboard') {
          updateChartData();
        }
      });
    });
  });

  // Initialize and load the dashboards/tables
  await initDashboard(container);
}

async function initDashboard(container) {
  try {
    // 1. Fetch KPI stats
    const stats = await AdminService.getStats();
    if (stats) {
      container.querySelector('#kpi-orgs').textContent = formatNumber(stats.total_organizations);
      container.querySelector('#kpi-events').textContent = formatNumber(stats.total_events);
      container.querySelector('#kpi-regs').textContent = formatNumber(stats.total_registrations);
      container.querySelector('#kpi-certs').textContent = formatNumber(stats.total_certificates);
    }
  } catch (err) {
    console.error('[Admin] KPI loading failed:', err);
    Toast.error('Failed to load platform stats.');
  }

  // 2. Fetch and render data tables
  renderOrgsTable(container.querySelector('#organizations-table-container'));
  renderLogsTable(container.querySelector('#logs-table-container'));

  // 3. Render chart
  updateChartData();
}

async function updateChartData() {
  try {
    await loadChartJS();
    
    // Fetch organizations if not cached
    if (!cachedOrgs) {
      cachedOrgs = await AdminService.listOrganizations();
    }

    const canvas = document.getElementById('admin-analytics-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    // Sort by events_count desc and take top 8
    const sortedOrgs = [...cachedOrgs]
      .sort((a, b) => (b.events_count || 0) - (a.events_count || 0))
      .slice(0, 8);

    if (sortedOrgs.length === 0) {
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'center';
      ctx.fillText('No data available to display.', canvas.width / 2, canvas.height / 2);
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedOrgs.map(o => o.name.length > 18 ? o.name.substring(0, 15) + '...' : o.name),
        datasets: [
          {
            label: 'Events Created',
            data: sortedOrgs.map(o => o.events_count || 0),
            backgroundColor: 'rgba(22, 163, 74, 0.75)',
            borderColor: '#16A34A',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Staff Members',
            data: sortedOrgs.map(o => o.members_count || 0),
            backgroundColor: 'rgba(37, 99, 235, 0.75)',
            borderColor: '#2563EB',
            borderWidth: 1.5,
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Inter, sans-serif', size: 12, weight: 500 }
            }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: 'Inter, sans-serif', weight: 700 },
            bodyFont: { family: 'Inter, sans-serif' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter, sans-serif', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#E2EDE9' },
            ticks: {
              stepSize: 1,
              font: { family: 'Inter, sans-serif', size: 11 }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('[Admin] Chart rendering failed:', err);
  }
}

function renderOrgsTable(container) {
  const table = new DataTable(container, {
    columns: [
      {
        label: 'Organization',
        key: 'name',
        sortKey: 'name',
        render: (row) => {
          const initials = row.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
          return `
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="avatar" style="width:36px;height:36px;border-radius:8px;font-size:11px;background:var(--color-primary-bg);color:var(--color-primary);border:1px solid var(--color-primary-border);font-weight:700;">${initials}</div>
              <div>
                <div class="font-medium" style="color:var(--color-text);">${row.name}</div>
                <div style="font-size:12px;color:var(--color-text-3);">${row.slug} &bull; ${row.email || 'No owner email'}</div>
              </div>
            </div>
          `;
        }
      },
      {
        label: 'Created At',
        key: 'created_at',
        sortKey: 'created_at',
        type: 'date'
      },
      {
        label: 'Events Count',
        key: 'events_count',
        sortKey: 'events_count',
        render: (row) => `<span style="font-weight:600;color:var(--color-text);">${row.events_count || 0}</span>`
      },
      {
        label: 'Active Staff',
        key: 'members_count',
        sortKey: 'members_count',
        render: (row) => `<span>${row.members_count || 0}</span>`
      },
      {
        label: 'Status',
        key: 'is_active',
        type: 'badge',
        badgeConfig: (isActive) => isActive
          ? { label: 'Active', class: 'badge-green' }
          : { label: 'Suspended', class: 'badge-red' }
      }
    ],
    fetchData: async (params) => {
      if (!cachedOrgs) {
        cachedOrgs = await AdminService.listOrganizations();
      }

      let filtered = [...cachedOrgs];

      // Local search filtering
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(org =>
          org.name.toLowerCase().includes(query) ||
          org.slug.toLowerCase().includes(query) ||
          (org.email && org.email.toLowerCase().includes(query))
        );
      }

      // Local sorting
      if (params.sortBy) {
        filtered.sort((a, b) => {
          let valA = a[params.sortBy];
          let valB = b[params.sortBy];
          
          if (typeof valA === 'string') {
            return params.sortAsc
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          }
          return params.sortAsc ? (valA - valB) : (valB - valA);
        });
      }

      // Paginate
      const start = (params.page - 1) * params.pageSize;
      const end = start + params.pageSize;

      return {
        data: filtered.slice(start, end),
        total: filtered.length
      };
    },
    actions: [
      {
        label: 'Suspend Organization',
        icon: icon('xCircle', 'text-danger'),
        hidden: (row) => !row.is_active,
        onClick: async (row) => {
          if (confirm(`Are you sure you want to suspend "${row.name}"? Members of this organization will not be able to log in.`)) {
            try {
              await AdminService.toggleOrgActive(row.id, false);
              Toast.success(`Suspended "${row.name}" successfully.`);
              cachedOrgs = null; // force reload org list
              await table.refresh();
              updateChartData(); // refresh analytics chart
            } catch (err) {
              Toast.error(err.message || 'Failed to suspend organization.');
            }
          }
        }
      },
      {
        label: 'Activate Organization',
        icon: icon('checkCircle', 'text-success'),
        hidden: (row) => row.is_active,
        onClick: async (row) => {
          try {
            await AdminService.toggleOrgActive(row.id, true);
            Toast.success(`Activated "${row.name}" successfully.`);
            cachedOrgs = null; // force reload org list
            await table.refresh();
            updateChartData(); // refresh analytics chart
          } catch (err) {
            Toast.error(err.message || 'Failed to activate organization.');
          }
        }
      }
    ],
    searchable: true,
    emptyTitle: 'No organizations found',
    emptyText: 'All registered organizations on the platform will appear here.'
  });

  table.render();
}

function renderLogsTable(container) {
  const table = new DataTable(container, {
    columns: [
      {
        label: 'Timestamp',
        key: 'created_at',
        sortKey: 'created_at',
        type: 'datetime'
      },
      {
        label: 'Organization',
        key: 'organization_name',
        sortKey: 'organization_name',
        render: (row) => {
          const isPlatform = row.organization_name === 'Platform';
          return `
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:9px;padding:2px 5px;border-radius:4px;font-weight:700;letter-spacing:0.5px;
                ${isPlatform ? 'background:var(--color-surface-2);color:var(--color-text-3);border:1px solid var(--color-border);' : 'background:var(--color-primary-bg);color:var(--color-primary);border:1px solid var(--color-primary-border);'}">
                ${isPlatform ? 'SYSTEM' : 'ORG'}
              </span>
              <span style="font-weight:600;color:var(--color-text);">${row.organization_name}</span>
            </div>
          `;
        }
      },
      {
        label: 'Action Took',
        key: 'action',
        sortKey: 'action',
        render: (row) => `<code style="font-family:monospace;font-size:11px;background:var(--color-surface-2);padding:2px 6px;border-radius:4px;border:1px solid var(--color-border);color:var(--color-primary-d);">${row.action}</code>`
      },
      {
        label: 'Resource Affected',
        key: 'resource_type',
        sortKey: 'resource_type',
        render: (row) => `<span style="font-size:13px;color:var(--color-text-2);text-transform:capitalize;">${row.resource_type || '—'}</span>`
      },
      {
        label: 'Actor Email',
        key: 'user_email',
        sortKey: 'user_email',
        render: (row) => `<span style="font-size:13px;color:var(--color-text-3);">${row.user_email}</span>`
      }
    ],
    fetchData: async (params) => {
      if (!cachedLogs) {
        cachedLogs = await AdminService.listAuditLogs();
      }

      let filtered = [...cachedLogs];

      // Local search filtering
      if (params.search) {
        const query = params.search.toLowerCase();
        filtered = filtered.filter(log =>
          log.organization_name.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          (log.resource_type && log.resource_type.toLowerCase().includes(query)) ||
          log.user_email.toLowerCase().includes(query)
        );
      }

      // Local sorting
      if (params.sortBy) {
        filtered.sort((a, b) => {
          let valA = a[params.sortBy] || '';
          let valB = b[params.sortBy] || '';
          
          if (typeof valA === 'string') {
            return params.sortAsc
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          }
          return params.sortAsc ? (valA - valB) : (valB - valA);
        });
      }

      // Paginate
      const start = (params.page - 1) * params.pageSize;
      const end = start + params.pageSize;

      return {
        data: filtered.slice(start, end),
        total: filtered.length
      };
    },
    searchable: true,
    emptyTitle: 'No logs found',
    emptyText: 'All global system audit events will be listed here.'
  });

  table.render();
}
