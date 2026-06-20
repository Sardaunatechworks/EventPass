// ============================================================
// EventPass: src/components/sidebar.js
// Dashboard sidebar navigation — clean white + green design
// ============================================================
import { toggleSidebar, closeSidebar } from '../app.js';
import { icon } from '../utils/icons.js';
import { Config } from '../config.js';

const NAV_ITEMS = [
  { path: '/',                    icon: 'dashboard',    label: 'Dashboard' },
  { section: 'Events' },
  { path: '/events',              icon: 'events',       label: 'Events' },
  { path: '/participants',        icon: 'participants', label: 'Participants', permission: 'registrations:view' },
  { path: '/reports',             icon: 'reports',      label: 'Reports',      permission: 'reports:view' },
  { section: 'Organization' },
  { path: '/organization',        icon: 'settings',     label: 'Settings',    permission: 'org:settings:edit' },
  { path: '/organization/staff',  icon: 'team',         label: 'Team & Staff', permission: 'org:members:manage' },
  { path: '/programs',            icon: 'programs',     label: 'Programs',    badge: 'Soon' },
];

export function renderSidebar(container, session) {
  const { org, currentMember, permissions } = session;
  const role = currentMember?.role || '';

  const navHTML = NAV_ITEMS.map(item => {
    if (item.section) {
      return `<div class="sidebar-section-label">${item.section}</div>`;
    }

    if (item.permission && !permissions?.can(item.permission)) {
      return '';
    }

    return `
      <a
        href="#${item.path}"
        class="sidebar-link"
        data-path="${item.path}"
        id="nav-${item.path.replace(/\//g, '-').replace(/^-/, '') || 'home'}"
        aria-label="${item.label}"
      >
        ${icon(item.icon)}
        <span>${item.label}</span>
        ${item.badge ? `<span class="badge badge-purple" style="margin-left:auto;font-size:9px;padding:1px 6px;">${item.badge}</span>` : ''}
      </a>
    `;
  }).join('');

  const orgInitials = org?.name
    ? org.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'EP';

    let adminSectionHTML = '';
    if (session.user?.email === Config.app.adminEmail) {
      adminSectionHTML = `
        <div class="sidebar-section-label">Platform Admin</div>
        <a
          href="#/admin"
          class="sidebar-link"
          data-path="/admin"
          id="nav-admin"
          aria-label="Admin Panel"
        >
          ${icon('dashboard')}
          <span>Admin Panel</span>
        </a>
      `;
    }

    container.innerHTML = `
      <a href="#/" class="sidebar-logo" aria-label="EventPass Home">
        <div class="sidebar-logo-icon">
          ${icon('logo')}
        </div>
        <span class="sidebar-logo-text">EventPass</span>
      </a>

      <div class="sidebar-org" id="org-switcher-btn" title="${org?.name || ''}">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="avatar" style="width:26px;height:26px;font-size:10px;border-radius:6px;${org?.primary_color ? `background:${org.primary_color}18;border-color:${org.primary_color}33;color:${org.primary_color};` : ''}">${orgInitials}</div>
          <div style="flex:1;min-width:0;">
            <div class="sidebar-org-name">${org?.name || 'No Organization'}</div>
            <div class="sidebar-org-role">${formatRole(role)}</div>
          </div>
          <span style="color:var(--color-text-3);display:flex;align-items:center;">${icon('chevronDown', 'icon-sm')}</span>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="Navigation">
        ${navHTML}
        ${adminSectionHTML}
      </nav>

    <div class="sidebar-footer">
      <button
        class="sidebar-link"
        id="signout-btn"
        aria-label="Sign out"
        style="width:100%;color:var(--color-text-3);"
      >
        ${icon('signout')}
        <span>Sign Out</span>
      </button>
    </div>
  `;

  container.querySelector('#signout-btn')?.addEventListener('click', async () => {
    const { AuthService } = await import('../services/auth.service.js');
    try {
      await AuthService.signOut();
      window.location.reload();
    } catch (err) {
      const { Toast } = await import('./toast.js');
      Toast.error('Sign out failed: ' + err.message);
    }
  });

  updateSidebarActiveLink(window.location.hash.slice(1) || '/');

  // Close sidebar on link click (for mobile layout)
  container.querySelectorAll('.sidebar-link[data-path]').forEach(link => {
    link.addEventListener('click', () => {
      closeSidebar();
    });
  });
}

export function updateSidebarActiveLink(path) {
  document.querySelectorAll('.sidebar-link[data-path]').forEach(link => {
    const linkPath = link.dataset.path;
    const isActive = linkPath === '/'
      ? path === '/' || path === ''
      : path === linkPath || path.startsWith(linkPath + '/');

    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function formatRole(role) {
  const labels = {
    owner:         'Owner',
    admin:         'Administrator',
    event_manager: 'Event Manager',
    staff:         'Staff',
    volunteer:     'Volunteer',
  };
  return labels[role] || role || 'Member';
}
