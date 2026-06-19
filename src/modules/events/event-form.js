// ============================================================
// EventPass: src/modules/events/event-form.js
// Create and edit event form with custom registration fields
// ============================================================
import { EventsService } from '../../services/events.service.js';
import { Toast } from '../../components/toast.js';
import { validateEventForm, applyFormErrors, clearFormErrors } from '../../utils/validators.js';
import { formatDate, slugify } from '../../utils/formatters.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio (Single Choice)' },
  { value: 'checkbox', label: 'Checkbox (Multi-Choice)' },
  { value: 'url', label: 'URL / Link' },
];

let _customFields = [];

export async function renderEventForm(container, session, { mode = 'create', eventId = null } = {}) {
  const { org, user } = session;
  let existingEvent = null;

  container.innerHTML = `<div class="page-loading"><div class="loading-spinner"></div></div>`;

  if (mode === 'edit' && eventId) {
    try {
      existingEvent = await EventsService.getEvent(eventId, org.id);
      _customFields = (existingEvent.registration_fields || []).filter(field => {
        const name = (field.field_name || '').toLowerCase();
        const label = (field.field_label || '').toLowerCase();
        const builtins = ['first_name', 'last_name', 'email', 'phone', 'first-name', 'last-name', 'email-address', 'phone-number', 'full-name', 'fullname', 'full_name', 'emailaddress', 'phonenumber', 'phone_number', 'mobile', 'telephone'];
        const builtinLabels = ['first name', 'last name', 'email', 'phone', 'email address', 'phone number', 'full name', 'telephone', 'mobile number'];
        return !builtins.includes(name) && !builtinLabels.includes(label);
      });
    } catch (err) {
      container.innerHTML = `<div class="page-content"><p class="text-danger">Event not found.</p></div>`;
      return;
    }
  } else {
    _customFields = [];
  }

  const e = existingEvent || {};
  const isEdit = mode === 'edit';

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:820px;">
      <div class="page-header">
        <div>
          <a href="${isEdit ? `#/events/${eventId}` : '#/events'}" class="text-sm text-muted" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back</a>
          <h1 class="page-title mt-2">${isEdit ? 'Edit Event' : 'Create Event'}</h1>
        </div>
      </div>

      <form id="event-form" novalidate>

        <!-- Basic Info -->
        <div class="card mb-6">
          <div class="card-header"><h2 class="card-title">Event Details</h2></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="ev-title">Event Title *</label>
              <input type="text" id="ev-title" name="title" class="input"
                placeholder="e.g. TechFort Dev Summit 2026" value="${e.title || ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="ev-type">Event Type *</label>
              <select id="ev-type" name="event_type" class="select">
                ${['conference','workshop','seminar','training','meetup','webinar','bootcamp','ceremony','event'].map(t => `
                  <option value="${t}" ${e.event_type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="ev-desc">Description</label>
              <textarea id="ev-desc" name="description" class="textarea" rows="4"
                placeholder="What is this event about? Include agenda, speakers, etc.">${e.description || ''}</textarea>
            </div>
          </div>
        </div>

        <!-- Date & Location -->
        <div class="card mb-6">
          <div class="card-header"><h2 class="card-title">Date & Location</h2></div>
          <div class="card-body">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="ev-start">Start Date & Time *</label>
                <input type="datetime-local" id="ev-start" name="start_date" class="input"
                  value="${e.start_date ? formatDate(e.start_date, 'input') : ''}">
              </div>
              <div class="form-group">
                <label class="form-label" for="ev-end">End Date & Time *</label>
                <input type="datetime-local" id="ev-end" name="end_date" class="input"
                  value="${e.end_date ? formatDate(e.end_date, 'input') : ''}">
              </div>
            </div>

            <div class="form-group">
              <div class="checkbox-group" style="margin-bottom:12px;">
                <input type="checkbox" id="ev-virtual" name="is_virtual" ${e.is_virtual ? 'checked' : ''}>
                <label for="ev-virtual" class="form-label" style="cursor:pointer;">This is a virtual event</label>
              </div>
            </div>

            <div id="location-fields">
              <div class="form-group">
                <label class="form-label" for="ev-location">Venue Name</label>
                <input type="text" id="ev-location" name="location_name" class="input"
                  placeholder="e.g. Landmark Event Centre, Lagos" value="${e.location_name || ''}">
              </div>
              <div class="form-group">
                <label class="form-label" for="ev-address">Full Address</label>
                <input type="text" id="ev-address" name="location_address" class="input"
                  placeholder="Street, City, State" value="${e.location_address || ''}">
              </div>
            </div>

            <div id="virtual-fields" style="display:none;">
              <div class="form-group">
                <label class="form-label" for="ev-virtual-link">Meeting / Stream URL</label>
                <input type="url" id="ev-virtual-link" name="virtual_link" class="input"
                  placeholder="https://zoom.us/j/..." value="${e.virtual_link || ''}">
              </div>
            </div>
          </div>
        </div>

        <!-- Registration Settings -->
        <div class="card mb-6">
          <div class="card-header"><h2 class="card-title">Registration Settings</h2></div>
          <div class="card-body">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="ev-capacity">Capacity (blank = unlimited)</label>
                <input type="number" id="ev-capacity" name="capacity" class="input"
                  placeholder="e.g. 500" min="1" value="${e.capacity || ''}">
              </div>
              <div class="form-group">
                <label class="form-label" for="ev-prefix">Ticket Prefix</label>
                <input type="text" id="ev-prefix" name="ticket_prefix" class="input"
                  placeholder="TKT" maxlength="6" value="${e.ticket_prefix || 'TKT'}"
                  style="text-transform:uppercase;">
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-3);">
              <div class="checkbox-group">
                <input type="checkbox" id="ev-waitlist" name="is_waitlist_enabled" ${e.is_waitlist_enabled ? 'checked' : ''}>
                <label for="ev-waitlist" class="form-label" style="cursor:pointer;">Enable waitlist when capacity is reached</label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="ev-approval" name="requires_approval" ${e.requires_approval ? 'checked' : ''}>
                <label for="ev-approval" class="form-label" style="cursor:pointer;">Require manual approval for registrations</label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="ev-certs" name="certificate_enabled" ${e.certificate_enabled ? 'checked' : ''}>
                <label for="ev-certs" class="form-label" style="cursor:pointer;">Enable certificate issuance for attendees</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Registration Fields -->
        <div class="card mb-6">
          <div class="card-header">
            <h2 class="card-title">Registration Form Fields</h2>
            <button type="button" class="btn btn-secondary btn-sm" id="add-field-btn">+ Add Field</button>
          </div>
          <div class="card-body">
            <p class="text-sm text-muted mb-4">
              Name and email are always collected. Add custom fields below.
            </p>
            <div id="custom-fields-list"></div>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex justify-end gap-3">
          <a href="${isEdit ? `#/events/${eventId}` : '#/events'}" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary" id="ev-submit">
            ${isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>

      </form>
    </div>
  `;

  const form = container.querySelector('#event-form');
  const virtualCheckbox = form.querySelector('#ev-virtual');
  const locationFields = form.querySelector('#location-fields');
  const virtualFields = form.querySelector('#virtual-fields');

  // Toggle virtual/physical
  function updateLocationVisibility() {
    const isVirtual = virtualCheckbox.checked;
    locationFields.style.display = isVirtual ? 'none' : 'block';
    virtualFields.style.display = isVirtual ? 'block' : 'none';
  }
  virtualCheckbox.addEventListener('change', updateLocationVisibility);
  updateLocationVisibility();

  // Custom fields
  renderCustomFieldsList(container.querySelector('#custom-fields-list'));

  container.querySelector('#add-field-btn').addEventListener('click', () => {
    addCustomField();
    renderCustomFieldsList(container.querySelector('#custom-fields-list'));
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const data = {
      title: form.title.value.trim(),
      event_type: form.event_type.value,
      description: form.description.value.trim(),
      start_date: form.start_date.value,
      end_date: form.end_date.value,
      is_virtual: form.is_virtual.checked,
      virtual_link: form.virtual_link?.value.trim() || null,
      location_name: form.location_name?.value.trim() || null,
      location_address: form.location_address?.value.trim() || null,
      capacity: form.capacity.value ? parseInt(form.capacity.value) : null,
      ticket_prefix: form.ticket_prefix.value.trim().toUpperCase() || 'TKT',
      is_waitlist_enabled: form.is_waitlist_enabled.checked,
      requires_approval: form.requires_approval.checked,
      certificate_enabled: form.certificate_enabled.checked,
    };

    const { valid, errors } = validateEventForm(data);
    if (!valid) {
      applyFormErrors(form, errors);
      return;
    }

    const submitBtn = form.querySelector('#ev-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner sm"></span> Saving...';

    try {
      let savedEvent;
      if (isEdit) {
        savedEvent = await EventsService.updateEvent(eventId, org.id, data);
      } else {
        savedEvent = await EventsService.createEvent(org.id, user.id, data);
      }

      // Save custom fields
      if (_customFields.length > 0 || isEdit) {
        await EventsService.updateRegistrationFields(savedEvent.id, org.id, _customFields);
      }

      Toast.success(isEdit ? 'Event updated successfully' : 'Event created! Ready to publish.');
      window.location.hash = `/events/${savedEvent.id}`;
    } catch (err) {
      Toast.error(err.message, 'Save failed');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = isEdit ? 'Save Changes' : 'Create Event';
    }
  });
}

function addCustomField() {
  _customFields.push({
    field_name: `field_${Date.now()}`,
    field_label: '',
    field_type: 'text',
    is_required: false,
    options: null,
    placeholder: '',
  });
}

function renderCustomFieldsList(container) {
  if (!_customFields.length) {
    container.innerHTML = `<p class="text-sm text-muted">No custom fields added.</p>`;
    return;
  }

  container.innerHTML = _customFields.map((field, i) => `
    <div class="card mb-4" data-field-index="${i}" style="border:1px solid var(--color-border-light);">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <span class="font-medium text-sm">Field ${i + 1}</span>
          <button type="button" class="btn btn-ghost btn-sm text-danger remove-field-btn" data-index="${i}">Remove</button>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Field Label *</label>
            <input type="text" class="input field-label" placeholder="e.g. Job Title" value="${field.field_label || ''}" data-index="${i}">
          </div>
          <div class="form-group">
            <label class="form-label">Field Type</label>
            <select class="select field-type" data-index="${i}">
              ${FIELD_TYPES.map(t => `<option value="${t.value}" ${field.field_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" class="field-required" id="field-req-${i}" ${field.is_required ? 'checked' : ''} data-index="${i}">
          <label for="field-req-${i}" class="form-label" style="cursor:pointer;">Required field</label>
        </div>
        ${['select','radio','checkbox'].includes(field.field_type) ? `
          <div class="form-group mt-4">
            <label class="form-label">Options (one per line)</label>
            <textarea class="textarea field-options" rows="3" placeholder="Option 1&#10;Option 2&#10;Option 3" data-index="${i}">${
              (field.options || []).map(o => o.label).join('\n')
            }</textarea>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Bind field label changes
  container.querySelectorAll('.field-label').forEach(input => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.index);
      _customFields[i].field_label = e.target.value;
      _customFields[i].field_name = slugify(e.target.value) || `field_${i}`;
    });
  });

  // Bind type changes
  container.querySelectorAll('.field-type').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const i = parseInt(e.target.dataset.index);
      _customFields[i].field_type = e.target.value;
      renderCustomFieldsList(container);
    });
  });

  // Bind required
  container.querySelectorAll('.field-required').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const i = parseInt(e.target.dataset.index);
      _customFields[i].is_required = e.target.checked;
    });
  });

  // Bind options
  container.querySelectorAll('.field-options').forEach(ta => {
    ta.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.index);
      _customFields[i].options = e.target.value.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(label => ({ value: slugify(label), label }));
    });
  });

  // Remove button
  container.querySelectorAll('.remove-field-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.index);
      _customFields.splice(i, 1);
      renderCustomFieldsList(container);
    });
  });
}
