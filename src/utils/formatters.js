// ============================================================
// EventPass: src/utils/formatters.js
// Date, number, string formatters
// ============================================================

/**
 * Format a date for display.
 * @param {string|Date} date
 * @param {string} format - 'short'|'long'|'relative'|'datetime'|'time'
 */
export function formatDate(date, format = 'short') {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    case 'long':
      return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'datetime':
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    case 'iso':
      return d.toISOString().split('T')[0];
    case 'relative': {
      const now = Date.now();
      const diff = now - d.getTime();
      const abs = Math.abs(diff);
      const future = diff < 0;

      if (abs < 60000) return future ? 'in a few seconds' : 'just now';
      if (abs < 3600000) {
        const m = Math.round(abs / 60000);
        return future ? `in ${m}m` : `${m}m ago`;
      }
      if (abs < 86400000) {
        const h = Math.round(abs / 3600000);
        return future ? `in ${h}h` : `${h}h ago`;
      }
      if (abs < 604800000) {
        const dd = Math.round(abs / 86400000);
        return future ? `in ${dd}d` : `${dd}d ago`;
      }
      return formatDate(d, 'short');
    }
    case 'input':
      // For datetime-local inputs
      return d.toISOString().slice(0, 16);
    default:
      return d.toLocaleDateString();
  }
}

/**
 * Format a date range (e.g. event start–end)
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate) return '—';
  const s = new Date(startDate);
  const e = endDate ? new Date(endDate) : null;

  const sameDay = e && s.toDateString() === e.toDateString();
  const sameYear = e && s.getFullYear() === e.getFullYear();

  if (!e) return formatDate(s, 'long');
  if (sameDay) {
    return `${formatDate(s, 'long')}, ${formatDate(s, 'time')} – ${formatDate(e, 'time')}`;
  }
  if (sameYear) {
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${formatDate(e, 'short')}`;
  }
  return `${formatDate(s, 'short')} – ${formatDate(e, 'short')}`;
}

/**
 * Format a number with locale-appropriate separators.
 */
export function formatNumber(n, decimals = 0) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a currency amount.
 */
export function formatCurrency(amount, currency = 'NGN') {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a percentage.
 */
export function formatPercent(value, total) {
  if (!total || total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Truncate a string to a max length.
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Convert a string to a URL-safe slug.
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get initials from a full name.
 */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/**
 * Format a phone number for display.
 */
export function formatPhone(phone) {
  if (!phone) return '—';
  // Nigerian format: +234 xxx xxxx xxxx
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `+234 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Returns a human-readable event status badge config.
 */
export function getStatusConfig(status, type = 'event') {
  const configs = {
    event: {
      draft:     { label: 'Draft',     class: 'badge-gray'   },
      published: { label: 'Published', class: 'badge-green'  },
      ended:     { label: 'Ended',     class: 'badge-blue'   },
      archived:  { label: 'Archived',  class: 'badge-orange' },
    },
    registration: {
      pending:    { label: 'Pending',    class: 'badge-yellow' },
      confirmed:  { label: 'Confirmed',  class: 'badge-green'  },
      cancelled:  { label: 'Cancelled',  class: 'badge-red'    },
      waitlisted: { label: 'Waitlisted', class: 'badge-blue'   },
      rejected:   { label: 'Rejected',   class: 'badge-red'    },
    },
    attendance: {
      checked_in:  { label: 'Checked In',  class: 'badge-green' },
      not_present: { label: 'Not Present', class: 'badge-gray'  },
    },
    certificate: {
      issued:  { label: 'Issued',  class: 'badge-green' },
      revoked: { label: 'Revoked', class: 'badge-red'   },
    },
  };

  return (configs[type] || {})[status] || { label: status, class: 'badge-gray' };
}

export function renderStatusBadge(status, type = 'event') {
  const cfg = getStatusConfig(status, type);
  return `<span class="badge ${cfg.class}">${cfg.label}</span>`;
}

export default {
  formatDate, formatDateRange, formatNumber, formatCurrency,
  formatPercent, truncate, slugify, getInitials, formatPhone,
  getStatusConfig, renderStatusBadge,
};
