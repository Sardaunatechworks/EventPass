// ============================================================
// EventPass: src/components/topbar.js
// Top navigation bar — clean white design
// ============================================================
import { toggleSidebar } from '../app.js';

const menuIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

export function renderTopbar(container, session, router) {
  const { user } = session;
  const email = user?.email || '';
  const initials = email.slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="topbar-left">
      <button
        class="sidebar-toggle"
        id="sidebar-toggle-btn"
        aria-label="Toggle navigation"
        aria-expanded="false"
      >${menuIcon}</button>
      <div id="topbar-breadcrumb" class="topbar-breadcrumb"></div>
    </div>
    <div class="topbar-right">
      <div class="topbar-user" style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="user-menu-btn">
        <div class="avatar" title="${email}">${initials}</div>
        <span class="text-sm text-secondary" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none;">${email}</span>
      </div>
    </div>
  `;

  container.querySelector('#sidebar-toggle-btn')?.addEventListener('click', () => {
    toggleSidebar();
  });
}

export function setBreadcrumb(items) {
  const el = document.getElementById('topbar-breadcrumb');
  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = '';
    return;
  }

  const sep = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  el.innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast) {
      return `<span class="topbar-title">${item.label}</span>`;
    }
    return `<a href="${item.href || '#'}">${item.label}</a>${sep}`;
  }).join('');
}
