// ============================================================
// EventPass: src/modules/attendance/attendance.js
// QR scanner + manual check-in + real-time counter
// ============================================================
import { AttendanceService } from '../../services/attendance.service.js';
import { EventsService } from '../../services/events.service.js';
import { RegistrationsService } from '../../services/registrations.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';

let _scanner = null;
let _realtimeChannel = null;

export async function renderAttendance(container, session, eventId) {
  const { org, user, permissions } = session;

  if (!permissions?.can('attendance:record')) {
    container.innerHTML = `<div class="page-content"><p class="text-danger">Permission denied.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="page-loading"><div class="loading-spinner"></div></div>`;

  let event, stats;
  try {
    [event, stats] = await Promise.all([
      EventsService.getEvent(eventId, org.id),
      EventsService.getEventStats(eventId),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="page-content"><p class="text-danger">Event not found.</p></div>`;
    return;
  }

  const attendanceCount = stats?.checked_in || 0;
  const totalRegistered = stats?.confirmed || 0;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:1100px;">
      <div class="page-header">
        <div>
          <a href="#/events/${eventId}" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> ${event.title}</a>
          <h1 class="page-title mt-2">Attendance</h1>
        </div>
        <div class="flex gap-2 flex-wrap-mobile">
          <button class="btn btn-secondary" id="walk-in-btn">+ Walk-in</button>
          <button class="btn btn-secondary" id="export-btn" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</button>
        </div>
      </div>

      <div class="grid-2 gap-5 mb-6">
        <!-- Scanner -->
        <div class="qr-scanner-wrapper">
          <div class="qr-scanner-header">
            <h2 class="font-semibold mb-1">QR Check-in Scanner</h2>
            <p class="text-sm text-muted">Point camera at participant's QR code</p>
          </div>
          <div style="padding:var(--space-5);">
            <div id="qr-reader" style="border-radius:8px;overflow:hidden;"></div>
            <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);">
              <button class="btn btn-primary flex-1" id="start-scanner-btn" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg> Start Scanner</button>
              <button class="btn btn-secondary" id="stop-scanner-btn" style="display:none;display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Stop</button>
            </div>
            <div id="scan-result" style="margin-top:var(--space-4);display:none;"></div>
          </div>

          <!-- Manual ticket lookup -->
          <div style="padding:0 var(--space-5) var(--space-5);border-top:1px solid var(--color-border);padding-top:var(--space-4);">
            <label class="form-label">Manual Ticket Number</label>
            <div class="flex gap-2 mt-2">
              <input type="text" id="manual-ticket" class="input" placeholder="TKT-20260611-ABCD12"
                style="text-transform:uppercase;font-family:var(--font-mono);">
              <button class="btn btn-secondary" id="manual-checkin-btn">Check In</button>
            </div>
          </div>
        </div>

        <!-- Attendance Counter -->
        <div>
          <div class="attendance-counter mb-5">
            <div class="attendance-number" id="attendance-count">${formatNumber(attendanceCount)}</div>
            <div class="attendance-label">Checked in today</div>
            <div class="text-sm text-muted mt-2">of ${formatNumber(totalRegistered)} registered</div>
          </div>

          <div class="card">
            <div class="card-body">
              <div class="flex justify-between mb-2">
                <span class="text-sm text-muted">Attendance rate</span>
                <span class="font-semibold">${stats?.attendance_rate || 0}%</span>
              </div>
              <div style="height:8px;background:var(--color-surface-2);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(stats?.attendance_rate || 0, 100)}%;background:var(--color-success);border-radius:4px;transition:width 0.5s;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendance Table -->
      <div id="attendance-table"></div>
    </div>
  `;

  // Start/stop scanner
  const startBtn = container.querySelector('#start-scanner-btn');
  const stopBtn = container.querySelector('#stop-scanner-btn');
  const scanResult = container.querySelector('#scan-result');

  startBtn.addEventListener('click', async () => {
    if (typeof Html5Qrcode === 'undefined') {
      Toast.error('QR scanner library not loaded. Check your internet connection.');
      return;
    }

    try {
      _scanner = new Html5Qrcode('qr-reader');
      await _scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (qrData) => {
          await handleQRScan(qrData, eventId, org, user, scanResult);
        },
        () => {}
      );
      startBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    } catch (err) {
      Toast.error('Camera access denied or not available. Use manual ticket entry.', 'Scanner Error');
    }
  });

  stopBtn.addEventListener('click', async () => {
    await stopScanner();
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
  });

  // Manual check-in
  const manualInput = container.querySelector('#manual-ticket');
  container.querySelector('#manual-checkin-btn').addEventListener('click', async () => {
    const ticketNumber = manualInput.value.trim().toUpperCase();
    if (!ticketNumber) return;
    const result = await AttendanceService.checkInByTicket(ticketNumber, eventId, 'manual');
    displayScanResult(scanResult, result);
    if (result.success) {
      manualInput.value = '';
      updateAttendanceCount(container);
      attendanceTable.refresh();
    }
  });

  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.querySelector('#manual-checkin-btn').click();
    }
  });

  // Walk-in registration
  container.querySelector('#walk-in-btn').addEventListener('click', () => {
    showWalkInModal(eventId, org, user, () => {
      updateAttendanceCount(container);
      attendanceTable.refresh();
    });
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      const rows = await AttendanceService.exportAttendance(eventId, org.id);
      downloadCSV(rows, `attendance_${event.title}_${formatDate(new Date(), 'iso')}.csv`);
    } catch (err) {
      Toast.error(err.message);
    }
  });

  // Real-time subscription
  _realtimeChannel = AttendanceService.subscribeToAttendance(eventId, () => {
    updateAttendanceCount(container);
    attendanceTable.refresh();
  });

  // Attendance table
  const attendanceTable = new DataTable(container.querySelector('#attendance-table'), {
    columns: [
      {
        label: 'Participant',
        render: (row) => `
          <div>
            <div class="font-medium">${row.participants?.first_name || ''} ${row.participants?.last_name || ''}</div>
            <div class="text-xs text-muted">${row.participants?.email || ''}</div>
          </div>
        `,
      },
      {
        key: 'registrations',
        label: 'Ticket',
        render: (row) => `<span class="text-mono text-xs">${row.registrations?.ticket_number || '—'}</span>`,
        width: '160px',
      },
      {
        key: 'checked_in_at',
        label: 'Checked In',
        type: 'datetime',
        sortKey: 'checked_in_at',
        width: '160px',
      },
      {
        key: 'check_in_method',
        label: 'Method',
        type: 'badge',
        badgeConfig: (v) => ({
          qr: { label: 'QR Scan', class: 'badge-green' },
          manual: { label: 'Manual', class: 'badge-blue' },
          'walk-in': { label: 'Walk-in', class: 'badge-purple' },
        }[v] || { label: v, class: 'badge-gray' }),
        width: '100px',
      },
    ],
    fetchData: async (params) => {
      const result = await AttendanceService.listAttendance(eventId, org.id, {
        page: params.page,
        pageSize: params.pageSize,
      });
      return { data: result.attendance, total: result.total };
    },
    emptyTitle: 'No check-ins yet',
    emptyText: 'Use the QR scanner or enter a ticket number to check in participants.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    searchable: false,
    actions: permissions?.isAdmin ? [{
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
      label: 'Remove',
      onClick: async (row) => {
        try {
          await AttendanceService.removeCheckIn(row.id, org.id);
          Toast.success('Check-in record removed');
          attendanceTable.refresh();
          updateAttendanceCount(container);
        } catch (err) {
          Toast.error(err.message);
        }
      },
    }] : [],
  });

  await attendanceTable.render();

  // Clean up on navigate away
  window.addEventListener('hashchange', () => {
    stopScanner();
    if (_realtimeChannel) {
      _realtimeChannel.unsubscribe();
      _realtimeChannel = null;
    }
  }, { once: true });
}

async function handleQRScan(qrData, eventId, org, user, resultEl) {
  try {
    const result = await AttendanceService.checkInByQR(qrData, eventId);
    displayScanResult(resultEl, result);
    if (result.success) {
      updateAttendanceCount(document.querySelector('.app-shell'));
    }
  } catch (err) {
    displayScanResult(resultEl, { success: false, error: 'SCAN_ERROR', message: err.message });
  }
}

function displayScanResult(container, result) {
  container.style.display = 'block';

  let icon, type, name, detail;

  if (result.success) {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    type = 'success';
    name = result.participant_name;
    detail = `Checked in at ${new Date(result.checked_in_at).toLocaleTimeString()}`;
  } else if (result.error === 'ALREADY_CHECKED_IN') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    type = 'warning';
    name = result.participant_name || 'Already Checked In';
    detail = `Was checked in at ${new Date(result.checked_in_at).toLocaleTimeString()}`;
  } else {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    type = 'error';
    name = result.error || 'Check-in Failed';
    detail = result.message;
  }

  container.innerHTML = `
    <div class="qr-result ${type}">
      <div class="qr-result-icon">${icon}</div>
      <div>
        <div class="qr-result-name">${name}</div>
        <div class="qr-result-detail">${detail}</div>
      </div>
    </div>
  `;

  // Auto-clear after 4 seconds
  setTimeout(() => { container.style.display = 'none'; }, 4000);
}

async function updateAttendanceCount(scope) {
  const countEl = (scope || document).querySelector('#attendance-count');
  if (!countEl) return;
  const eventId = window.location.hash.match(/events\/([^/]+)\/attendance/)?.[1];
  if (!eventId) return;
  try {
    const count = await AttendanceService.getAttendanceCount(eventId);
    countEl.textContent = formatNumber(count);
  } catch {
    // ignore
  }
}

async function stopScanner() {
  if (_scanner) {
    try { await _scanner.stop(); } catch {}
    _scanner = null;
  }
}

function showWalkInModal(eventId, org, user, onSuccess) {
  openModal({
    title: 'Walk-in Registration',
    content: `
      <form id="walk-in-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="wi-email">Email *</label>
          <input type="email" id="wi-email" name="email" class="input" placeholder="attendee@email.com" required>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" for="wi-first">First Name *</label>
            <input type="text" id="wi-first" name="first_name" class="input" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="wi-last">Last Name *</label>
            <input type="text" id="wi-last" name="last_name" class="input" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="wi-phone">Phone (optional)</label>
          <input type="tel" id="wi-phone" name="phone" class="input" placeholder="+234...">
        </div>
        <div id="wi-error" class="field-error" style="display:none;" role="alert"></div>
      </form>
    `,
    actions: [
      { label: 'Cancel', class: 'btn-secondary', closeOnClick: true },
      {
        label: 'Register & Check In',
        class: 'btn btn-primary',
        closeOnClick: false,
        onClick: async (e) => {
          const form = document.getElementById('walk-in-form');
          const errEl = form.querySelector('#wi-error');
          errEl.style.display = 'none';

          const data = {
            email: form.email.value.trim(),
            first_name: form.first_name.value.trim(),
            last_name: form.last_name.value.trim(),
            phone: form.phone.value.trim() || null,
          };

          if (!data.email || !data.first_name || !data.last_name) {
            errEl.textContent = 'Please fill in all required fields.';
            errEl.style.display = 'block';
            return;
          }

          const btn = e.target;
          btn.disabled = true;
          btn.innerHTML = '<span class="loading-spinner sm"></span>';

          try {
            await RegistrationsService.walkInRegistration(eventId, org.id, user.id, data);
            closeModal();
            Toast.success(`${data.first_name} registered and checked in!`);
            if (onSuccess) onSuccess();
          } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = 'Register & Check In';
          }
        },
      },
    ],
    size: 'md',
  });
}

function downloadCSV(rows, filename) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Ticket Number', 'Checked In At', 'Method'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.participants?.first_name,
      r.participants?.last_name,
      r.participants?.email,
      r.participants?.phone,
      r.registrations?.ticket_number,
      r.checked_in_at ? new Date(r.checked_in_at).toISOString() : '',
      r.check_in_method,
    ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
