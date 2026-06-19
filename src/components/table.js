// ============================================================
// EventPass: src/components/table.js
// Reusable data table with search, sort, filter, pagination
// ============================================================
import { Config } from '../config.js';
import { formatDate } from '../utils/formatters.js';

/**
 * DataTable component.
 *
 * Usage:
 * const table = new DataTable(containerEl, {
 *   columns: [...],
 *   fetchData: async (params) => ({ data: [], total: 0 }),
 *   actions: [...],
 *   searchable: true,
 *   pageSize: 25,
 * });
 *
 * table.render();
 */
export class DataTable {
  constructor(container, options = {}) {
    this._container = container;
    this._options = {
      columns: [],
      fetchData: null,
      actions: [],
      searchable: true,
      filterable: [],
      pageSize: Config.pagination.defaultPageSize,
      emptyTitle: 'No records found',
      emptyText: 'Try adjusting your search or filters.',
      emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      rowClickHandler: null,
      ...options,
    };

    this._state = {
      page: 1,
      pageSize: this._options.pageSize,
      search: '',
      sortBy: null,
      sortAsc: true,
      filters: {},
      data: [],
      total: 0,
      loading: false,
    };
  }

  async render() {
    this._buildShell();
    await this._loadData();
  }

  _buildShell() {
    const { searchable, filterable, columns, actions } = this._options;

    this._container.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          ${searchable ? `
            <input
              type="search"
              class="input table-search"
              placeholder="Search..."
              aria-label="Search table"
              id="table-search-${this._uid()}"
            >
          ` : ''}
          ${filterable.map(f => `
            <select class="select" data-filter="${f.key}" style="max-width:160px;" aria-label="${f.label}">
              <option value="">${f.label}: All</option>
              ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          `).join('')}
          <div style="flex:1;"></div>
          <div class="table-toolbar-actions"></div>
        </div>

        <div class="table-scroll">
          <table class="table" role="grid">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th
                    ${col.sortKey ? `class="sortable" data-sort="${col.sortKey}"` : ''}
                    style="${col.width ? `width:${col.width}` : ''}"
                  >
                    ${col.label}
                    ${col.sortKey ? `<span class="sort-icon"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></span>` : ''}
                  </th>
                `).join('')}
                ${actions.length > 0 ? `<th style="width:120px">Actions</th>` : ''}
              </tr>
            </thead>
            <tbody class="table-body"></tbody>
          </table>
        </div>

        <div class="table-footer">
          <span class="table-count"></span>
          <div class="pagination"></div>
        </div>
      </div>
    `;

    // Bind search
    const searchInput = this._container.querySelector('.table-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this._state.search = e.target.value;
          this._state.page = 1;
          this._loadData();
        }, 350);
      });
    }

    // Bind filters
    this._container.querySelectorAll('[data-filter]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this._state.filters[e.target.dataset.filter] = e.target.value;
        this._state.page = 1;
        this._loadData();
      });
    });

    // Bind sort
    this._container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (this._state.sortBy === key) {
          this._state.sortAsc = !this._state.sortAsc;
        } else {
          this._state.sortBy = key;
          this._state.sortAsc = true;
        }
        this._loadData();
      });
    });
  }

  async _loadData() {
    if (this._state.loading) return;
    this._state.loading = true;
    this._renderLoading();

    try {
      const result = await this._options.fetchData({
        page: this._state.page,
        pageSize: this._state.pageSize,
        search: this._state.search,
        sortBy: this._state.sortBy,
        sortAsc: this._state.sortAsc,
        filters: this._state.filters,
      });

      this._state.data = result.data || result.events || result.registrations ||
        result.attendance || result.certificates || result.participants || [];
      this._state.total = result.total || 0;
    } catch (err) {
      console.error('[DataTable] Fetch error:', err);
      this._renderError(err.message);
      return;
    } finally {
      this._state.loading = false;
    }

    this._renderBody();
    this._renderFooter();
  }

  _renderLoading() {
    const tbody = this._container.querySelector('.table-body');
    if (!tbody) return;
    const colCount = this._options.columns.length + (this._options.actions.length > 0 ? 1 : 0);
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr>
        ${Array(colCount).fill(0).map(() => `
          <td><div class="skeleton" style="height:16px;width:80%;border-radius:4px;"></div></td>
        `).join('')}
      </tr>
    `).join('');
  }

  _renderError(message) {
    const tbody = this._container.querySelector('.table-body');
    if (!tbody) return;
    const colCount = this._options.columns.length + (this._options.actions.length > 0 ? 1 : 0);
    tbody.innerHTML = `
      <tr>
        <td colspan="${colCount}" class="table-empty">
          <div class="empty-state">
            <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div class="empty-state-title">Failed to load data</div>
            <div class="empty-state-text">${message}</div>
            <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
          </div>
        </td>
      </tr>
    `;
  }

  _renderBody() {
    const tbody = this._container.querySelector('.table-body');
    if (!tbody) return;

    const { columns, actions, emptyTitle, emptyText, emptyIcon, rowClickHandler } = this._options;
    const { data } = this._state;

    if (!data.length) {
      const colCount = columns.length + (actions.length > 0 ? 1 : 0);
      tbody.innerHTML = `
        <tr>
          <td colspan="${colCount}">
            <div class="empty-state">
              <div class="empty-state-icon">${emptyIcon}</div>
              <div class="empty-state-title">${emptyTitle}</div>
              <div class="empty-state-text">${emptyText}</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.map((row, i) => `
      <tr
        ${rowClickHandler ? 'style="cursor:pointer;"' : ''}
        data-row-index="${i}"
      >
        ${columns.map(col => `<td>${this._renderCell(col, row)}</td>`).join('')}
        ${actions.length > 0 ? `
          <td>
            <div class="flex gap-2">
              ${actions.map((action, ai) => `
                <button
                  class="btn btn-ghost btn-sm"
                  data-row-index="${i}"
                  data-action-index="${ai}"
                  title="${action.label}"
                  ${action.hidden?.(row) ? 'style="display:none"' : ''}
                >${action.icon || action.label}</button>
              `).join('')}
            </div>
          </td>
        ` : ''}
      </tr>
    `).join('');

    // Bind row click
    if (rowClickHandler) {
      tbody.querySelectorAll('tr').forEach((tr, i) => {
        tr.addEventListener('click', (e) => {
          if (!e.target.closest('button')) {
            rowClickHandler(data[i]);
          }
        });
      });
    }

    // Bind action buttons
    tbody.querySelectorAll('[data-action-index]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rowIndex = parseInt(btn.dataset.rowIndex);
        const actionIndex = parseInt(btn.dataset.actionIndex);
        const row = data[rowIndex];
        const action = actions[actionIndex];
        if (action?.onClick) action.onClick(row);
      });
    });

    // Sort indicators
    this._container.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('sorted');
      const icon = th.querySelector('.sort-icon');
      if (th.dataset.sort === this._state.sortBy) {
        th.classList.add('sorted');
        if (icon) icon.innerHTML = this._state.sortAsc
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      } else {
        if (icon) icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
      }
    });
  }

  _renderCell(col, row) {
    const value = col.key ? row[col.key] : null;

    if (col.render) return col.render(row, value);

    if (col.type === 'date') return formatDate(value, col.dateFormat || 'short');
    if (col.type === 'datetime') return formatDate(value, 'datetime');
    if (col.type === 'badge') {
      const cfg = col.badgeConfig?.(value, row) || { label: value, class: 'badge-gray' };
      return `<span class="badge ${cfg.class}">${cfg.label}</span>`;
    }
    if (col.type === 'avatar') {
      const name = row[col.nameKey] || value || '?';
      const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      return `<div class="flex items-center gap-2">
        <div class="avatar">${initials}</div>
        <span class="truncate">${name}</span>
      </div>`;
    }

    if (value === null || value === undefined) return '<span class="text-muted">—</span>';
    return String(value);
  }

  _renderFooter() {
    const countEl = this._container.querySelector('.table-count');
    const paginationEl = this._container.querySelector('.pagination');
    if (!countEl || !paginationEl) return;

    const { total, page, pageSize } = this._state;
    const totalPages = Math.ceil(total / pageSize);
    const start = Math.min((page - 1) * pageSize + 1, total);
    const end = Math.min(page * pageSize, total);

    countEl.textContent = total > 0
      ? `Showing ${start}–${end} of ${total.toLocaleString()}`
      : 'No results';

    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    const pages = this._getPageNumbers(page, totalPages);

    paginationEl.innerHTML = `
      <button class="pagination-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      ${pages.map(p =>
        p === '...'
          ? `<span style="padding:0 4px;color:var(--color-text-3)">…</span>`
          : `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}">${p}</button>`
      ).join('')}
      <button class="pagination-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    `;

    paginationEl.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newPage = parseInt(btn.dataset.page);
        if (newPage >= 1 && newPage <= totalPages) {
          this._state.page = newPage;
          this._loadData();
        }
      });
    });
  }

  _getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }

    if (current < total - 2) pages.push('...');
    pages.push(total);

    return pages;
  }

  /** Force a data refresh */
  async refresh() {
    await this._loadData();
  }

  /** Reset to page 1 with empty search */
  reset() {
    this._state.page = 1;
    this._state.search = '';
    this._state.filters = {};
    const searchInput = this._container.querySelector('.table-search');
    if (searchInput) searchInput.value = '';
    this._loadData();
  }

  _uid() {
    return Math.random().toString(36).substr(2, 6);
  }
}

export default DataTable;
