// ============================================================
// EventPass: src/components/modal.js
// Accessible modal dialog component
// ============================================================

let _overlayEl = null;
let _currentModal = null;

function ensureOverlay() {
  if (!_overlayEl) {
    _overlayEl = document.createElement('div');
    _overlayEl.className = 'modal-overlay';
    _overlayEl.setAttribute('role', 'dialog');
    _overlayEl.setAttribute('aria-modal', 'true');
    document.body.appendChild(_overlayEl);

    _overlayEl.addEventListener('click', (e) => {
      if (e.target === _overlayEl && _currentModal?.dismissOnBackdrop !== false) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _overlayEl.classList.contains('open')) {
        closeModal();
      }
    });
  }
  return _overlayEl;
}

/**
 * Open a modal dialog.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string|HTMLElement} options.content - Modal body content
 * @param {Array} options.actions - [{label, class, onClick, closeOnClick}]
 * @param {string} options.size - 'sm'|'md'|'lg'|'xl'
 * @param {boolean} options.dismissOnBackdrop - Default true
 * @param {string} options.id - Optional ID for programmatic access
 */
export function openModal({
  title,
  content,
  actions = [],
  size = 'md',
  dismissOnBackdrop = true,
  id = null,
}) {
  const overlay = ensureOverlay();

  _currentModal = { dismissOnBackdrop };

  overlay.className = `modal-overlay ${size !== 'md' ? `modal-${size}` : ''}`;

  const actionsHTML = actions.map((action, i) => `
    <button
      class="btn ${action.class || 'btn-secondary'}"
      data-action-index="${i}"
      id="${id ? `${id}-action-${i}` : ''}"
    >${action.label}</button>
  `).join('');

  overlay.innerHTML = `
    <div class="modal" role="document">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" aria-label="Close modal" style="display:flex;align-items:center;justify-content:center;padding:4px;border-radius:4px;background:none;border:none;color:var(--color-text-muted);cursor:pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        ${typeof content === 'string' ? content : ''}
      </div>
      ${actionsHTML ? `<div class="modal-footer">${actionsHTML}</div>` : ''}
    </div>
  `;

  if (content instanceof HTMLElement) {
    overlay.querySelector('.modal-body').appendChild(content);
  }

  overlay.querySelector('.modal-close').addEventListener('click', closeModal);

  actions.forEach((action, i) => {
    const btn = overlay.querySelector(`[data-action-index="${i}"]`);
    if (btn) {
      btn.addEventListener('click', async (e) => {
        if (action.onClick) await action.onClick(e);
        if (action.closeOnClick !== false) closeModal();
      });
    }
  });

  // Focus trap: set initial focus
  setTimeout(() => {
    const firstFocusable = overlay.querySelector('button, input, select, textarea, [tabindex]');
    if (firstFocusable) firstFocusable.focus();
  }, 50);

  document.body.style.overflow = 'hidden';
  overlay.offsetHeight; // Force reflow
  overlay.classList.add('open');

  return {
    close: closeModal,
    getElement: () => overlay,
  };
}

export function closeModal() {
  if (!_overlayEl) return;
  _overlayEl.classList.remove('open');
  document.body.style.overflow = '';
  _currentModal = null;
}

/**
 * Confirmation dialog shortcut.
 */
export function confirmModal({ title, message, confirmLabel = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
  return openModal({
    title,
    content: `<p class="text-secondary">${message}</p>`,
    size: 'sm',
    actions: [
      { label: 'Cancel', class: 'btn-secondary' },
      {
        label: confirmLabel,
        class: `btn ${confirmClass}`,
        closeOnClick: true,
        onClick: onConfirm,
      },
    ],
  });
}

export default { openModal, closeModal, confirmModal };
