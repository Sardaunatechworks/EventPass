// ============================================================
// EventPass: src/app.js
// SPA bootstrap — auth guard, org resolution, routing
// ============================================================
import { Router } from './utils/router.js';
import { AuthService } from './services/auth.service.js';
import { resolveOrganization } from './utils/org-resolver.js';
import { OrganizationService } from './services/organization.service.js';
import { PermissionChecker } from './utils/permissions.js';
import { Toast } from './components/toast.js';
import { renderSidebar, updateSidebarActiveLink } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';

// Detect recovery flow before Supabase client clears the URL hash
const initHashParams = new URLSearchParams(window.location.hash.slice(1));
const initSearchParams = new URLSearchParams(window.location.search);
const isRecoveryFlow = initHashParams.get('type') === 'recovery' || 
                       initSearchParams.get('type') === 'recovery' || 
                       window.location.hash.includes('type=recovery');

const recoveryParams = isRecoveryFlow ? {
  error: initHashParams.get('error') || initSearchParams.get('error') || '',
  errorCode: initHashParams.get('error_code') || initSearchParams.get('error_code') || '',
  errorDesc: initHashParams.get('error_description') || initSearchParams.get('error_description') || '',
} : null;

let isBooting = true;

// ── Lazy module imports ───────────────────────────────────────

const modules = {
  dashboard: () => import('./modules/dashboard/dashboard.js'),
  events: () => import('./modules/events/events.js'),
  eventForm: () => import('./modules/events/event-form.js'),
  eventDetail: () => import('./modules/events/event-detail.js'),
  registrations: () => import('./modules/registrations/registrations.js'),
  attendance: () => import('./modules/attendance/attendance.js'),
  certificates: () => import('./modules/certificates/certificates.js'),
  participants: () => import('./modules/participants/participants.js'),
  reports: () => import('./modules/reports/reports.js'),
  orgSettings: () => import('./modules/organization/settings.js'),
  orgStaff: () => import('./modules/organization/staff.js'),
  programs: () => import('./modules/programs/programs.js'),
  login: () => import('./modules/auth/login.js'),
  signup: () => import('./modules/auth/signup.js'),
};

// ── App Session ───────────────────────────────────────────────

export const AppSession = {
  user: null,
  org: null,
  currentMember: null,
  permissions: null,

  set({ user, org, member }) {
    this.user = user;
    this.org = org;
    this.currentMember = member;
    this.permissions = new PermissionChecker(this);
  },

  clear() {
    this.user = null;
    this.org = null;
    this.currentMember = null;
    this.permissions = null;
  },
};

// ── Router ────────────────────────────────────────────────────

const router = new Router();

// Auth guard middleware
router.use(async (path, params, query) => {
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
  if (publicPaths.includes(path)) return true;

  if (!AppSession.user) {
    router.replace('/login');
    return false;
  }

  if (AppSession.user?.user_metadata?.must_change_password === true) {
    router.replace('/reset-password?force=1');
    return false;
  }

  if (!AppSession.org) {
    showOrgSetup();
    return false;
  }

  // Route-specific permission checks
  if (path === '/events/new') {
    if (!AppSession.permissions?.can('events:create')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path.startsWith('/events/') && path.endsWith('/edit')) {
    if (!AppSession.permissions?.can('events:create')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path.startsWith('/events/') && path.endsWith('/registrations')) {
    if (!AppSession.permissions?.can('registrations:view')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path.startsWith('/events/') && path.endsWith('/certificates')) {
    if (!AppSession.permissions?.can('certificates:issue')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path.startsWith('/events/') && path.endsWith('/attendance')) {
    if (!AppSession.permissions?.can('attendance:record')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path === '/participants') {
    if (!AppSession.permissions?.can('registrations:view')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path === '/reports') {
    if (!AppSession.permissions?.can('reports:view')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path === '/organization/staff') {
    if (!AppSession.permissions?.can('org:members:manage')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }
  if (path === '/organization') {
    if (!AppSession.permissions?.can('org:settings:edit')) {
      Toast.error('Permission denied.');
      router.replace('/');
      return false;
    }
  }

  return true;
});

// Update sidebar active state on every route change
router.use((path) => {
  updateSidebarActiveLink(path);
  return true;
});

// ── Route Definitions ─────────────────────────────────────────

router
  .on('/login', async () => {
    const { renderLogin } = await modules.login();
    renderLogin(getContentEl(), { onSuccess: () => initSession().then(() => router.navigate('/')) });
  })
  .on('/signup', async () => {
    const { renderSignup } = await modules.signup();
    renderSignup(getContentEl(), { onSuccess: () => initSession().then(() => router.navigate('/')) });
  })
  .on('/reset-password', async (params, query) => {
    const { renderResetPassword } = await modules.login();
    renderResetPassword(getContentEl(), query);
  })
  .on('/forgot-password', async () => {
    const { renderForgotPassword } = await modules.login();
    renderForgotPassword(getContentEl());
  })
  .on('/', async () => {
    const { renderDashboard } = await modules.dashboard();
    setPageTitle('Dashboard');
    renderDashboard(getContentEl(), AppSession);
  })
  .on('/events', async () => {
    const { renderEvents } = await modules.events();
    setPageTitle('Events');
    renderEvents(getContentEl(), AppSession);
  })
  .on('/events/new', async () => {
    const { renderEventForm } = await modules.eventForm();
    setPageTitle('Create Event');
    renderEventForm(getContentEl(), AppSession, { mode: 'create' });
  })
  .on('/events/:id', async (params) => {
    const { renderEventDetail } = await modules.eventDetail();
    setPageTitle('Event Detail');
    renderEventDetail(getContentEl(), AppSession, params.id);
  })
  .on('/events/:id/edit', async (params) => {
    const { renderEventForm } = await modules.eventForm();
    setPageTitle('Edit Event');
    renderEventForm(getContentEl(), AppSession, { mode: 'edit', eventId: params.id });
  })
  .on('/events/:id/registrations', async (params) => {
    const { renderRegistrations } = await modules.registrations();
    setPageTitle('Registrations');
    renderRegistrations(getContentEl(), AppSession, params.id);
  })
  .on('/events/:id/attendance', async (params) => {
    const { renderAttendance } = await modules.attendance();
    setPageTitle('Attendance');
    renderAttendance(getContentEl(), AppSession, params.id);
  })
  .on('/events/:id/certificates', async (params) => {
    const { renderCertificates } = await modules.certificates();
    setPageTitle('Certificates');
    renderCertificates(getContentEl(), AppSession, params.id);
  })
  .on('/participants', async () => {
    const { renderParticipants } = await modules.participants();
    setPageTitle('Participants');
    renderParticipants(getContentEl(), AppSession);
  })
  .on('/reports', async () => {
    const { renderReports } = await modules.reports();
    setPageTitle('Reports');
    renderReports(getContentEl(), AppSession);
  })
  .on('/organization', async () => {
    const { renderOrgSettings } = await modules.orgSettings();
    setPageTitle('Organization Settings');
    renderOrgSettings(getContentEl(), AppSession);
  })
  .on('/organization/staff', async () => {
    const { renderOrgStaff } = await modules.orgStaff();
    setPageTitle('Team & Staff');
    renderOrgStaff(getContentEl(), AppSession);
  })
  .on('/programs', async () => {
    const { renderPrograms } = await modules.programs();
    setPageTitle('Programs');
    renderPrograms(getContentEl(), AppSession);
  })
  .notFound((path) => {
    getContentEl().innerHTML = `
      <div class="page-content">
        <div class="empty-state" style="min-height:60vh;">
          <div class="empty-state-icon" style="background:var(--color-bg);border-radius:50%;width:80px;height:80px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;border:1px solid var(--color-border);">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div class="empty-state-title">Page not found</div>
          <div class="empty-state-text">The route <code>${path}</code> does not exist.</div>
          <a href="#/" class="btn btn-primary">Go to Dashboard</a>
        </div>
      </div>
    `;
  });

// ── Bootstrap ─────────────────────────────────────────────────

async function boot() {
  // Show auth-only shell while initializing
  document.body.innerHTML = `
    <div class="page-loading" style="min-height:100vh;">
      <div class="loading-spinner lg"></div>
    </div>
  `;

  await initSession();
  isBooting = false; // Booting completed!
}

async function initSession() {
  try {
    const user = await AuthService.getCurrentUser();

    const isResetPasswordPath = window.location.hash.startsWith('#/reset-password');
    const isResetPassword = isResetPasswordPath || isRecoveryFlow;

    // Handle pending invitations if the user is authenticated
    const urlParams = new URLSearchParams(window.location.search);
    const inviteId = urlParams.get('invite');

    if (user && inviteId && !isResetPassword) {
      try {
        await OrganizationService.acceptInvitation(inviteId);
        Toast.success('Invitation accepted successfully!');
        // Clean URL parameter
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState(null, '', cleanUrl);
      } catch (inviteErr) {
        console.error('Failed to accept invitation:', inviteErr);
        Toast.error(inviteErr.message || 'Failed to accept invitation.');
      }
    }

    const mustChangePassword = user?.user_metadata?.must_change_password === true;

    if (!user || isResetPassword || mustChangePassword) {
      if (isResetPassword || mustChangePassword) {
        if (user) {
          AppSession.set({ user, org: null, member: null });
        } else {
          AppSession.clear();
        }

        if (mustChangePassword) {
          window.location.hash = '/reset-password?force=1';
        } else if (isRecoveryFlow && !isResetPasswordPath) {
          if (recoveryParams && (recoveryParams.error || recoveryParams.errorCode || recoveryParams.errorDesc)) {
            window.location.hash = `/reset-password?error=${recoveryParams.errorCode || 'invalid_link'}&error_description=${encodeURIComponent(recoveryParams.errorDesc || 'Invalid recovery link')}`;
          } else {
            window.location.hash = '/reset-password';
          }
        }
      } else {
        AppSession.clear();
      }
      buildAuthShell();
      router.init(); // DOM is ready — start routing
      return;
    }

    const orgContext = await resolveOrganization(user.id);

    AppSession.set({
      user,
      org: orgContext?.org || null,
      member: orgContext?.member || null,
    });

    buildAppShell();
    router.init(); // DOM is ready — start routing
  } catch (err) {
    console.error('[App] Boot error:', err);
    Toast.error('Failed to initialize application. Please refresh.', 'Error');
    buildAuthShell();
    router.init();
  }
}

function buildAppShell() {
  if (!AppSession.org) {
    buildOrgSetupShell();
    return;
  }

  document.body.innerHTML = `
    <div class="app-shell">
      <div id="sidebar-overlay" class="sidebar-overlay"></div>
      <nav id="sidebar" class="sidebar" aria-label="Main navigation"></nav>
      <div class="main-content">
        <header id="topbar" class="topbar"></header>
        <main id="page-content" class="page-content" role="main"></main>
      </div>
    </div>
  `;

  renderSidebar(document.getElementById('sidebar'), AppSession);
  renderTopbar(document.getElementById('topbar'), AppSession, router);

  // Sidebar mobile toggle
  const overlay = document.getElementById('sidebar-overlay');
  overlay?.addEventListener('click', closeSidebar);
}

function buildAuthShell() {
  document.body.innerHTML = `
    <div id="page-content" class="auth-page"></div>
  `;
}

function buildOrgSetupShell() {
  document.body.innerHTML = `<div id="page-content" class="auth-page"></div>`;
  showOrgSetup();
}

function showOrgSetup() {
  import('./modules/auth/signup.js').then(({ renderOrgSetup }) => {
    renderOrgSetup(document.getElementById('page-content'), AppSession, {
      onSuccess: () => initSession(),
    });
  });
}

function getContentEl() {
  return document.getElementById('page-content');
}

function setPageTitle(title) {
  document.title = `${title} — ${AppSession.org?.name || 'EventPass'}`;
  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) topbarTitle.textContent = title;
}

// Sidebar mobile helpers
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('open');
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
}

// ── Global Auth Listener ───────────────────────────────────────
AuthService.onAuthStateChange(async (event, session) => {
  if (isBooting) return; // Prevent initial auth state events from disrupting boot flow

  if (event === 'SIGNED_OUT') {
    AppSession.clear();
    buildAuthShell();
    router.replace('/login');
  } else if (event === 'PASSWORD_RECOVERY') {
    if (session?.user) {
      AppSession.set({ user: session.user, org: null, member: null });
      buildAuthShell();
      router.navigate('/reset-password');
    }
  }
});

// ── Start ──────────────────────────────────────────────────────
boot();
