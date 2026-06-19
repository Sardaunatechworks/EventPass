// ============================================================
// EventPass: src/modules/programs/programs.js
// Programs placeholder (coming soon)
// ============================================================

export async function renderPrograms(container, session) {
  container.innerHTML = `
    <div style="padding:var(--space-6);">
      <div class="empty-state" style="min-height:60vh;">
        <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
        <div class="empty-state-title">Programs — Coming Soon</div>
        <div class="empty-state-text">
          Group multiple events into programs for cohort-based training, bootcamps, and learning paths.
          This feature is under development.
        </div>
        <a href="#/" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back to Dashboard</a>
      </div>
    </div>
  `;
}
