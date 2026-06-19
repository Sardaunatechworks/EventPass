// ============================================================
// EventPass: src/modules/organization/settings.js
// Organization settings — branding, general, danger zone
// ============================================================
import { OrganizationService } from '../../services/organization.service.js';
import { Toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';
import { validateOrgForm } from '../../utils/validators.js';

export async function renderOrgSettings(container, session) {
  const { org } = session;

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:720px;">
      <div class="page-header">
        <h1 class="page-title">Organization Settings</h1>
      </div>

      <!-- General -->
      <div class="card mb-6">
        <div class="card-header"><h2 class="card-title">General</h2></div>
        <div class="card-body">
          <form id="org-settings-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="os-name">Organization Name *</label>
              <input type="text" id="os-name" name="name" class="input" value="${org.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="os-desc">Description</label>
              <textarea id="os-desc" name="description" class="textarea" rows="3">${org.description || ''}</textarea>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="os-email">Contact Email</label>
                <input type="email" id="os-email" name="email" class="input" value="${org.email || ''}">
              </div>
              <div class="form-group">
                <label class="form-label" for="os-website">Website</label>
                <input type="url" id="os-website" name="website" class="input" value="${org.website || ''}" placeholder="https://...">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="os-country">Country</label>
                <select id="os-country" name="country" class="select">
                  ${['NG','GH','KE','ZA','ET','EG','TZ','RW','UG'].map(c => `
                    <option value="${c}" ${org.country === c ? 'selected' : ''}>${c}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="os-tz">Timezone</label>
                <select id="os-tz" name="timezone" class="select">
                  ${[
                    'Africa/Lagos','Africa/Accra','Africa/Nairobi','Africa/Johannesburg',
                    'Africa/Addis_Ababa','Africa/Cairo','Africa/Dar_es_Salaam','UTC',
                  ].map(tz => `<option value="${tz}" ${org.timezone === tz ? 'selected' : ''}>${tz}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="os-error" class="field-error" style="display:none;" role="alert"></div>
            <div class="flex justify-end">
              <button type="submit" class="btn btn-primary" id="os-save-btn">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Branding -->
      <div class="card mb-6">
        <div class="card-header"><h2 class="card-title">Branding</h2></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Logo</label>
            <div class="flex items-center gap-4">
              <div id="logo-preview" style="width:64px;height:64px;border-radius:12px;overflow:hidden;background:var(--color-surface-2);border:1px dashed var(--color-border);display:flex;align-items:center;justify-content:center;font-size:24px;">
                <img src="${org.logo_url || ''}" alt="Logo" style="width:100%;height:100%;object-fit:contain;${org.logo_url ? '' : 'display:none;'}" onerror="this.style.display='none'; document.getElementById('logo-fallback-icon').style.display='block';">
                <svg id="logo-fallback-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="${org.logo_url ? 'display:none;' : 'display:block;'}"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;">
                <button class="btn btn-secondary btn-sm" id="logo-upload-btn">Upload Logo</button>
                <p class="text-xs text-muted mt-1">PNG, JPG, WebP or SVG · Max 2MB</p>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="os-color">Brand Color</label>
            <div class="flex items-center gap-3">
              <input type="color" id="os-color" value="${org.primary_color || '#2563EB'}"
                style="width:48px;height:36px;padding:2px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-surface);cursor:pointer;">
              <input type="text" id="os-color-hex" class="input" value="${org.primary_color || '#2563EB'}"
                style="max-width:100px;font-family:var(--font-mono);" placeholder="#2563EB">
              <button class="btn btn-secondary btn-sm" id="save-color-btn">Save Color</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card" style="border-color:rgba(239,68,68,0.25);">
        <div class="card-header" style="border-color:rgba(239,68,68,0.15);">
          <h2 class="card-title text-danger">Danger Zone</h2>
        </div>
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">Delete Organization</div>
              <div class="text-sm text-muted mt-1">Permanently delete this organization and all its data. This cannot be undone.</div>
            </div>
            <button class="btn btn-danger btn-sm" id="delete-org-btn">Delete Organization</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#org-settings-form');
  const errEl = form.querySelector('#os-error');

  // Save general settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';

    const updates = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      email: form.email.value.trim(),
      website: form.website.value.trim() || null,
      country: form.country.value,
      timezone: form.timezone.value,
    };

    const btn = form.querySelector('#os-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span>';

    try {
      const updated = await OrganizationService.updateOrganization(org.id, updates);
      Object.assign(session.org, updated);
      Toast.success('Settings saved');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save Changes';
    }
  });

  // Logo upload
  const logoFile = container.querySelector('#logo-file');
  container.querySelector('#logo-upload-btn').addEventListener('click', () => logoFile.click());

  logoFile.addEventListener('change', async () => {
    const file = logoFile.files[0];
    if (!file) return;
    const btn = container.querySelector('#logo-upload-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span>';
    try {
      const url = await OrganizationService.uploadLogo(org.id, file);
      session.org.logo_url = url;
      const preview = container.querySelector('#logo-preview');
      preview.innerHTML = `
        <img src="${url}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'; document.getElementById('logo-fallback-icon').style.display='block';">
        <svg id="logo-fallback-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      `;
      Toast.success('Logo updated');
    } catch (err) {
      Toast.error(err.message, 'Upload failed');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Upload Logo';
    }
  });

  // Color sync
  const colorInput = container.querySelector('#os-color');
  const hexInput = container.querySelector('#os-color-hex');
  colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; });
  hexInput.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) colorInput.value = hexInput.value;
  });

  container.querySelector('#save-color-btn').addEventListener('click', async () => {
    const color = hexInput.value;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { Toast.error('Invalid color hex code'); return; }
    try {
      await OrganizationService.updateOrganization(org.id, { primary_color: color });
      session.org.primary_color = color;
      Toast.success('Brand color saved');
    } catch (err) {
      Toast.error(err.message);
    }
  });

  // Delete org (high-friction confirmation)
  container.querySelector('#delete-org-btn').addEventListener('click', () => {
    confirmModal({
      title: 'Delete Organization',
      message: `This will permanently delete "${org.name}" and ALL its data — events, registrations, participants, certificates. This CANNOT be undone.`,
      confirmLabel: 'Delete Forever',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        Toast.info('Contact support to delete your organization account for safety.');
      },
    });
  });
}
