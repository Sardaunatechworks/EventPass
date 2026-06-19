// ============================================================
// EventPass: src/modules/auth/signup.js
// User registration + organization creation screens
// ============================================================
import { AuthService } from '../../services/auth.service.js';
import { OrganizationService } from '../../services/organization.service.js';
import { Toast } from '../../components/toast.js';
import { isValidEmail, validateOrgForm } from '../../utils/validators.js';
import { slugify } from '../../utils/formatters.js';
import { openModal, closeModal } from '../../components/modal.js';


export function renderSignup(container, { onSuccess } = {}) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" style="max-width:440px;">
        <div class="auth-logo">
          <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
          <span class="auth-logo-text">EventPass</span>
        </div>

        <h1 class="auth-title">Create account</h1>
        <p class="auth-subtitle">Start managing events for your organization</p>

        <!-- Step 1: Account -->
        <div id="step-account">
          <form id="signup-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="su-name">Full name</label>
              <input type="text" id="su-name" name="fullName" class="input" placeholder="Jane Adeyemi" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="su-email">Work email</label>
              <input type="email" id="su-email" name="email" class="input" placeholder="jane@myorg.com" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="su-password">Password</label>
              <input type="password" id="su-password" name="password" class="input" placeholder="Min. 8 characters" required minlength="8">
              <p class="form-hint">At least 8 characters</p>
            </div>
            <div id="su-error" class="field-error" style="display:none;margin-bottom:12px;" role="alert"></div>
            <button type="submit" class="btn btn-primary btn-full btn-lg" id="su-submit">Continue</button>
          </form>
        </div>

        <p class="text-sm text-muted text-center mt-6">
          Already have an account? <a href="#/login">Sign in</a>
        </p>
      </div>
    </div>
  `;

  const form = container.querySelector('#signup-form');
  const errorEl = container.querySelector('#su-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!fullName) { showError(errorEl, 'Please enter your full name.'); return; }
    if (!isValidEmail(email)) { showError(errorEl, 'Please enter a valid email address.'); return; }
    if (password.length < 8) { showError(errorEl, 'Password must be at least 8 characters.'); return; }

    const btn = form.querySelector('#su-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span> Creating account...';

    try {
      const result = await AuthService.signUp(email, password, { fullName });
      
      // If a session is returned immediately, email confirmation is disabled. Proceed.
      if (result && result.session) {
        if (onSuccess) onSuccess();
        return;
      }

      // Otherwise, open the verification modal
      showVerificationModal(email, password, onSuccess, form);
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Continue';
    }
  });
}

/**
 * Shows a verification modal to instruct the user to verify their email.
 */
function showVerificationModal(email, password, onSuccess, form) {
  const modalEl = document.createElement('div');
  modalEl.innerHTML = `
    <div class="email-verify-modal-body" style="text-align: center; padding: 10px 0;">
      <div style="width: 56px; height: 56px; background: #F0F7F4; color: #16A34A; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      </div>
      <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">Verify your email</h3>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px; color: var(--color-text-muted);">
        We have sent a verification link to <strong id="verify-email-text" style="color: var(--color-text); font-weight: 600;"></strong>.<br>
        Please click the link in your inbox to confirm your account.
      </p>
      <div id="verify-modal-error" class="field-error" style="display: none; margin-bottom: 16px; text-align: center; padding: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px;" role="alert"></div>
      <div id="verify-modal-status" style="display: none; margin-bottom: 16px; color: #16A34A; text-align: center; font-weight: 500; font-size: 13px; padding: 10px; background: #F0F7F4; border: 1px solid #E2EDE9; border-radius: 8px;"></div>
      
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
        <button type="button" class="btn btn-primary btn-full btn-lg" id="modal-btn-verify" style="display:inline-flex;align-items:center;justify-content:center;gap:6px; height: 44px; font-weight: 600;">
          I have verified
        </button>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 13px;">
          <a href="javascript:void(0)" id="modal-btn-resend" style="color: #16A34A; font-weight: 600; text-decoration: none;">Resend email</a>
          <a href="javascript:void(0)" id="modal-btn-change" style="color: var(--color-text-muted); text-decoration: none;">Wrong email address?</a>
        </div>
      </div>
    </div>
  `;

  const emailText = modalEl.querySelector('#verify-email-text');
  emailText.textContent = email;

  const btnVerify = modalEl.querySelector('#modal-btn-verify');
  const btnResend = modalEl.querySelector('#modal-btn-resend');
  const btnChange = modalEl.querySelector('#modal-btn-change');
  const modalError = modalEl.querySelector('#verify-modal-error');
  const modalStatus = modalEl.querySelector('#verify-modal-status');

  btnVerify.addEventListener('click', async () => {
    modalError.style.display = 'none';
    modalStatus.style.display = 'none';
    btnVerify.disabled = true;
    btnVerify.innerHTML = '<span class="loading-spinner sm"></span> Checking verification...';

    try {
      // Attempt to sign in to confirm they are verified and active
      await AuthService.signIn(email, password);
      
      // Success! Close modal and call onSuccess to let the main app boots session
      closeModal();
      Toast.success('Email verified successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('confirmed') || msg.toLowerCase().includes('verified')) {
        modalError.textContent = 'Email is not confirmed yet. Please open the link in your email inbox.';
      } else {
        modalError.textContent = msg;
      }
      modalError.style.display = 'block';
      btnVerify.innerHTML = 'I have verified';
      btnVerify.disabled = false;
    }
  });

  btnResend.addEventListener('click', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';
    modalStatus.style.display = 'none';

    btnResend.style.pointerEvents = 'none';
    btnResend.style.opacity = '0.5';
    btnResend.textContent = 'Resending...';

    try {
      await AuthService.resendVerification(email);
      modalStatus.textContent = 'Verification email has been resent!';
      modalStatus.style.display = 'block';
    } catch (err) {
      modalError.textContent = err.message;
      modalError.style.display = 'block';
    } finally {
      btnResend.style.pointerEvents = 'auto';
      btnResend.style.opacity = '1';
      btnResend.textContent = 'Resend email';
    }
  });

  btnChange.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
    const emailField = form.querySelector('[name="email"]');
    if (emailField) {
      emailField.focus();
      emailField.select();
    }
  });

  openModal({
    title: '',
    content: modalEl,
    dismissOnBackdrop: false,
    size: 'sm',
  });
}

/**
 * Org setup screen — shown when authenticated user has no org.
 */
export function renderOrgSetup(container, session, { onSuccess } = {}) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" style="max-width:480px;">
        <div class="auth-logo">
          <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
          <span class="auth-logo-text">EventPass</span>
        </div>

        <h1 class="auth-title">Set up your organization</h1>
        <p class="auth-subtitle">This will be your workspace for managing events</p>

        <form id="org-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="org-name">Organization name *</label>
            <input type="text" id="org-name" name="name" class="input" placeholder="e.g. TechFort Africa" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="org-slug">
              Organization ID *
              <span class="form-hint" style="display:inline;"> — used in your event URLs</span>
            </label>
            <div class="input-group">
              <span class="input-group-text">eventpass/</span>
              <input type="text" id="org-slug" name="slug" class="input" placeholder="techfort" required
                pattern="[a-z0-9-]+" style="border-radius:0 8px 8px 0;">
            </div>
            <p class="form-hint">Only lowercase letters, numbers, and hyphens</p>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="org-email">Contact email</label>
              <input type="email" id="org-email" name="email" class="input" placeholder="admin@org.com">
            </div>
            <div class="form-group">
              <label class="form-label" for="org-country">Country</label>
              <select id="org-country" name="country" class="select">
              <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
                <option value="KE">Kenya</option>
                <option value="ZA">South Africa</option>
                <option value="ET">Ethiopia</option>
                <option value="EG">Egypt</option>
                <option value="TZ">Tanzania</option>
                <option value="RW">Rwanda</option>
                <option value="UG">Uganda</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="org-color">Brand color</label>
            <div class="flex items-center gap-3">
              <input type="color" id="org-color" name="primary_color" value="#2563EB"
                style="width:40px;height:36px;padding:2px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-surface);cursor:pointer;">
              <span class="text-sm text-muted" id="color-preview-text">#2563EB</span>
            </div>
          </div>

          <div id="org-error" class="field-error" style="display:none;margin-bottom:12px;" role="alert"></div>

          <button type="submit" class="btn btn-primary btn-full btn-lg" id="org-submit">
            Create Organization
          </button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#org-form');
  const nameInput = form.querySelector('#org-name');
  const slugInput = form.querySelector('#org-slug');
  const colorInput = form.querySelector('#org-color');
  const colorText = container.querySelector('#color-preview-text');
  const errorEl = container.querySelector('#org-error');

  // Auto-generate slug from name
  nameInput.addEventListener('input', () => {
    if (!slugInput.dataset.manuallyEdited) {
      slugInput.value = slugify(nameInput.value).substring(0, 50);
    }
  });

  slugInput.addEventListener('input', () => {
    slugInput.dataset.manuallyEdited = '1';
    slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  });

  colorInput.addEventListener('input', () => {
    colorText.textContent = colorInput.value;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const data = {
      name: form.name.value.trim(),
      slug: form.slug.value.trim(),
      email: form.email.value.trim(),
      country: form.country.value,
      primary_color: form.primary_color.value,
    };

    const { valid, errors } = validateOrgForm(data);
    if (!valid) {
      showError(errorEl, Object.values(errors)[0]);
      return;
    }

    const btn = form.querySelector('#org-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner sm"></span> Creating...';

    try {
      const org = await OrganizationService.createOrganization(session.user.id, data);
      Toast.success(`${org.name} created successfully!`);
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.message.includes('unique') || err.message.includes('duplicate')
        ? 'This organization ID is already taken. Please choose a different one.'
        : err.message;
      showError(errorEl, msg);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Create Organization';
    }
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}
