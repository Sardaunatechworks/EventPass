// ============================================================
// EventPass: src/components/toast.js
// Global toast notification system
// ============================================================

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    _container.setAttribute('role', 'alert');
    _container.setAttribute('aria-live', 'polite');
    document.body.appendChild(_container);
  }
  return _container;
}

const svgIcon = (path) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
  success: svgIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  error:   svgIcon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'),
  warning: svgIcon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  info:    svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
};

const CLOSE_ICON = svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');


/**
 * Show a toast notification.
 * @param {string} message - Main message
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} [title] - Optional bold title
 * @param {number} [duration] - Auto-dismiss ms (0 = no auto-dismiss)
 */
export function showToast(message, type = 'info', title = null, duration = 4000) {
  const container = getContainer();
  const icon = ICONS[type] || ICONS.info;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">${CLOSE_ICON}</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismiss(toast));

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismiss(toast), duration);
  }

  return toast;
}

function dismiss(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(16px)';
  toast.style.transition = 'all 0.2s ease';
  setTimeout(() => toast.remove(), 200);
}

export const Toast = {
  success: (msg, title) => showToast(msg, 'success', title),
  error:   (msg, title) => showToast(msg, 'error',   title, 6000),
  warning: (msg, title) => showToast(msg, 'warning', title),
  info:    (msg, title) => showToast(msg, 'info',    title),
};

export default Toast;
