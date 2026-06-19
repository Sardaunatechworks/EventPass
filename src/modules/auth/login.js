// ============================================================
// EventPass: src/modules/auth/login.js
// Login and forgot-password screens
// ============================================================
import { AuthService } from '../../services/auth.service.js';
import { Toast } from '../../components/toast.js';
import { isValidEmail } from '../../utils/validators.js';
import { openModal } from '../../components/modal.js';

export function renderLogin(container, { onSuccess } = {}) {
  const params = new URLSearchParams(window.location.search);
  const showResetSuccess = params.get('reset') === 'success';

  if (showResetSuccess) {
    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
  }

  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
          <span class="auth-logo-text">EventPass</span>
        </div>

        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your organization dashboard</p>

        ${showResetSuccess ? `
          <div style="margin-bottom:16px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#15803d;font-size:13px;line-height:1.5;text-align:center;">
            Password reset successfully! Please sign in with your new password.
          </div>
        ` : ''}

        <form id="login-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="login-email">Email address</label>
            <input
              type="email"
              id="login-email"
              name="email"
              class="input"
              placeholder="you@organization.com"
              autocomplete="email"
              required
              aria-required="true"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              name="password"
              class="input"
              placeholder="••••••••"
              autocomplete="current-password"
              required
              aria-required="true"
            >
          </div>

          <div style="text-align:right;margin:-8px 0 16px;">
            <a href="#/forgot-password" id="forgot-link" class="text-sm" style="color:var(--color-text-3);">Forgot password?</a>
          </div>

          <div id="login-error" class="field-error" style="margin-bottom:12px;display:none;" role="alert"></div>

          <button type="submit" class="btn btn-primary btn-full btn-lg" id="login-submit">
            <span class="btn-text">Sign In</span>
          </button>
        </form>

        <p class="text-sm text-muted text-center mt-6">
          Don't have an account?
          <a href="#/signup">Create organization</a>
        </p>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#login-submit');
  const errorEl = container.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    // Client-side validation
    errorEl.style.display = 'none';

    if (!isValidEmail(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      form.email.focus();
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.style.display = 'block';
      form.password.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner sm"></span> Signing in...';

    try {
      await AuthService.signIn(email, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      errorEl.textContent = err.message.includes('Invalid login')
        ? 'Invalid email or password. Please try again.'
        : err.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-text">Sign In</span>';
    }
  });

  // Forgot password
  container.querySelector('#forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '/forgot-password';
  });
}

export function renderForgotPassword(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
          <span class="auth-logo-text">EventPass</span>
        </div>

        <h1 class="auth-title">Reset password</h1>
        <p class="auth-subtitle">Enter your email to receive a reset link</p>

        <form id="reset-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="reset-email">Email address</label>
            <input type="email" id="reset-email" name="email" class="input" placeholder="you@organization.com" required>
          </div>
          <div id="reset-msg" class="field-error" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full btn-lg" id="reset-submit">Send Reset Link</button>
        </form>

        <p class="text-sm text-muted text-center mt-6">
          <a href="#/login" id="back-to-login" style="display:inline-flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Back to sign in</a>
        </p>
      </div>
    </div>
  `;

  const form = container.querySelector('#reset-form');
  const msgEl = container.querySelector('#reset-msg');
  const btn = container.querySelector('#reset-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#reset-email').value.trim();

    if (!isValidEmail(email)) {
      msgEl.textContent = 'Please enter a valid email.';
      msgEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      await AuthService.resetPassword(email);
      msgEl.style.display = 'none';
      openModal({
        title: 'Reset Link Sent',
        content: `<p class="text-secondary" style="line-height:1.6;">A password reset link has been successfully sent to <strong>${email}</strong>. Please check your inbox and follow the instructions to reset your password.</p>`,
        size: 'sm',
        dismissOnBackdrop: false,
        actions: [
          {
            label: 'Back to Sign In',
            class: 'btn-primary btn-full',
            closeOnClick: true,
            onClick: () => {
              window.location.hash = '/login';
            }
          }
        ]
      });
    } catch (err) {
      msgEl.style.color = 'var(--color-danger)';
      msgEl.textContent = err.message;
      msgEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    }
  });

  container.querySelector('#back-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '/login';
  });
}

export function renderResetPassword(container, query = {}) {
  // Ensure we render inside .auth-card or container directly if it's the auth shell
  const cardEl = container.classList.contains('auth-card') ? container : container.querySelector('.auth-card');
  const target = cardEl || container;

  // Import AppSession here or read it from global window / import
  // Wait, AppSession is not imported in this file. But since it's a module we can import it
  // Wait, let's see how app.js manages AppSession, or if we can access the session from AuthService.getCurrentUser()
  // Or since AppSession is exported from src/app.js, let's import it!
  // Check for error parameters in the query string first
  if (query.error || query.error_description) {
    const errorMsg = query.error_description || 'This password reset link is invalid or has expired.';
    const errorTitle = query.error === 'otp_expired' ? 'Expired Reset Link' : 'Invalid Reset Link';
    
    target.innerHTML = `
      <div class="auth-logo">
        <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
        <span class="auth-logo-text">EventPass</span>
      </div>
      <h1 class="auth-title" style="margin-top:16px;">${errorTitle}</h1>
      <p class="auth-subtitle">${errorMsg}</p>
      <div class="field-error" style="display:block;margin-bottom:20px;text-align:center;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;line-height:1.5;">
        Please go back to the sign in page and request a new password reset link.
      </div>
      <p class="text-sm text-muted text-center mt-6">
        <a href="#/login">Back to sign in</a>
      </p>
    `;
    return;
  }

  target.innerHTML = `
    <div style="text-align:center;padding:20px 0;">
      <div class="loading-spinner"></div>
    </div>
  `;

  AuthService.getSession().then(session => {
    const user = session?.user;

    if (!user) {
      target.innerHTML = `
        <div class="auth-logo">
          <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
          <span class="auth-logo-text">EventPass</span>
        </div>
        <h1 class="auth-title" style="margin-top:16px;">Missing or Expired Token</h1>
        <p class="auth-subtitle">A valid password reset session could not be established.</p>
        <div class="field-error" style="display:block;margin-bottom:20px;text-align:center;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;line-height:1.5;">
          Please request a new password reset link from the sign in page.
        </div>
        <p class="text-sm text-muted text-center mt-6">
          <a href="#/login">Back to sign in</a>
        </p>
      `;
      return;
    }

    const isForced = query.force === '1';
    const title = isForced ? 'Change temporary password' : 'Create new password';
    const subtitle = isForced ? 'Please set a new password for your account' : 'Enter your new password below';
    const buttonText = isForced ? 'Update Password' : 'Reset Password';
    const backText = isForced ? 'Sign out' : 'Back to sign in';

    target.innerHTML = `
      <div class="auth-logo">
        <div class="auth-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="36" height="36" fill="none"><path d="M 25 15 H 42 A 8 8 0 0 0 58 15 H 75 A 10 10 0 0 1 85 25 V 95 A 10 10 0 0 1 75 105 H 58 A 8 8 0 0 0 42 105 H 25 A 10 10 0 0 1 15 95 V 25 A 10 10 0 0 1 25 15 Z" fill="#16A34A" /><rect x="23" y="27" width="54" height="54" rx="8" ry="8" fill="white" /><circle cx="50" cy="42" r="7" fill="#16A34A" /><path d="M 36 60 C 36 52, 64 52, 64 60 Z" fill="#16A34A" /><rect x="34" y="66" width="32" height="3.5" rx="1.75" fill="#E2EDE9" /><rect x="34" y="73" width="20" height="3.5" rx="1.75" fill="#E2EDE9" /><circle cx="76" cy="90" r="17" fill="white" /><circle cx="76" cy="90" r="13.5" fill="#16A34A" /><path d="M 70 90 L 74 94 L 82 86" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg></div>
        <span class="auth-logo-text">EventPass</span>
      </div>

      <h1 class="auth-title">${title}</h1>
      <p class="auth-subtitle">${subtitle}</p>

      <form id="reset-password-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="new-password">New password</label>
          <input type="password" id="new-password" name="password" class="input" placeholder="Min. 8 characters" required minlength="8">
        </div>
        <div class="form-group">
          <label class="form-label" for="confirm-password">Confirm new password</label>
          <input type="password" id="confirm-password" name="confirmPassword" class="input" placeholder="Confirm new password" required>
        </div>
        <div id="reset-pwd-error" class="field-error" style="display:none;margin-bottom:12px;" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-full btn-lg" id="reset-pwd-submit">${buttonText}</button>
      </form>

      <p class="text-sm text-muted text-center mt-6">
        <a href="#/login" id="back-link">${backText}</a>
      </p>
    `;

    const form = target.querySelector('#reset-password-form');
    const errorEl = target.querySelector('#reset-pwd-error');
    const backLink = target.querySelector('#back-link');

    if (isForced && backLink) {
      backLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await AuthService.signOut();
        window.location.hash = '/login';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';

      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      if (password.length < 8) {
        errorEl.textContent = 'Password must be at least 8 characters.';
        errorEl.style.display = 'block';
        return;
      }

      if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
      }

      const btn = target.querySelector('#reset-pwd-submit');
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner sm"></span> ${isForced ? 'Updating...' : 'Resetting...'}`;

      try {
        await AuthService.updatePassword(password, { must_change_password: false });
        Toast.success(isForced ? 'Password updated successfully! Please sign in with your new password.' : 'Password reset successfully! Please sign in.');
        await AuthService.signOut(); // Clear recovery session
        window.location.hash = '/login';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = buttonText;
      }
    });
  }).catch(err => {
    target.innerHTML = `<p class="text-danger text-center">Failed to check session: ${err.message}</p>`;
  });
}

