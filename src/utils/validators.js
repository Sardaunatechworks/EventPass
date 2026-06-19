// ============================================================
// EventPass: src/utils/validators.js
// Input validation helpers — used in forms and services
// ============================================================

/**
 * Validate an email address.
 */
export function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(String(email).toLowerCase().trim());
}

/**
 * Validate a Nigerian/international phone number.
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  // Accept: 11-digit NG (0xxx), 13-digit intl (+234xxx), or 7–15 digit
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Validate a URL (http or https).
 */
export function isValidUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a date string is a real date and not in the past.
 */
export function isNotPastDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= new Date();
}

/**
 * Validate that end date is after start date.
 */
export function isEndAfterStart(startStr, endStr) {
  if (!startStr || !endStr) return false;
  return new Date(endStr) > new Date(startStr);
}

/**
 * Sanitize a string for safe HTML insertion.
 * Use this before inserting any user-generated content into innerHTML.
 */
export function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize and normalize an email address.
 */
export function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/**
 * Validate a full event form.
 * Returns { valid: bool, errors: { field: message } }
 */
export function validateEventForm(data) {
  const errors = {};

  if (!data.title || data.title.trim().length < 3) {
    errors.title = 'Event title must be at least 3 characters';
  }
  if (data.title && data.title.length > 200) {
    errors.title = 'Event title must be under 200 characters';
  }
  if (!data.start_date) {
    errors.start_date = 'Start date is required';
  }
  if (!data.end_date) {
    errors.end_date = 'End date is required';
  }
  if (data.start_date && data.end_date && !isEndAfterStart(data.start_date, data.end_date)) {
    errors.end_date = 'End date must be after start date';
  }
  if (data.capacity !== undefined && data.capacity !== '' && data.capacity !== null) {
    const cap = parseInt(data.capacity);
    if (isNaN(cap) || cap < 1) {
      errors.capacity = 'Capacity must be a positive number';
    }
  }
  if (data.virtual_link && !isValidUrl(data.virtual_link)) {
    errors.virtual_link = 'Please enter a valid URL for the virtual event link';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a registration form submission.
 */
export function validateRegistrationForm(data, requiredFields = []) {
  const errors = {};

  if (!data.email || !isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  if (!data.first_name || data.first_name.trim().length < 1) {
    errors.first_name = 'First name is required';
  }
  if (!data.last_name || data.last_name.trim().length < 1) {
    errors.last_name = 'Last name is required';
  }
  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }

  // Validate custom required fields
  for (const field of requiredFields) {
    const answer = data.answers?.[field.id];
    if (field.is_required && (!answer || answer.toString().trim() === '')) {
      errors[`field_${field.id}`] = `${field.field_label} is required`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate organization form.
 */
export function validateOrgForm(data) {
  const errors = {};

  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Organization name must be at least 2 characters';
  }
  if (!data.slug || !/^[a-z0-9-]{2,50}$/.test(data.slug)) {
    errors.slug = 'Slug must be 2–50 lowercase letters, numbers, or hyphens';
  }
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  if (data.website && !isValidUrl(data.website)) {
    errors.website = 'Please enter a valid website URL';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Apply validation errors to form DOM elements.
 * Expects elements with data-field="fieldName" attributes.
 */
export function applyFormErrors(formEl, errors) {
  // Clear previous errors
  formEl.querySelectorAll('.field-error').forEach(el => el.remove());
  formEl.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  for (const [field, message] of Object.entries(errors)) {
    const input = formEl.querySelector(`[name="${field}"], [data-field="${field}"]`);
    if (input) {
      input.classList.add('input-error');
      const errorEl = document.createElement('p');
      errorEl.className = 'field-error';
      errorEl.textContent = message;
      input.parentNode.appendChild(errorEl);
    }
  }
}

/**
 * Clear all validation errors from a form.
 */
export function clearFormErrors(formEl) {
  formEl.querySelectorAll('.field-error').forEach(el => el.remove());
  formEl.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

export default {
  isValidEmail, isValidPhone, isValidUrl, isNotPastDate,
  isEndAfterStart, sanitizeText, normalizeEmail,
  validateEventForm, validateRegistrationForm, validateOrgForm,
  applyFormErrors, clearFormErrors,
};
