// ============================================================
// EventPass: src/config.js
// Central configuration — reads from meta tags injected at runtime
// ============================================================

/**
 * Read Supabase credentials from the HTML page's meta tags.
 * This approach avoids bundling secrets into JS files and
 * makes the config injectable at the server/CDN layer.
 *
 * In index.html / app.html, add:
 * <meta name="supabase-url" content="https://xxx.supabase.co">
 * <meta name="supabase-anon-key" content="eyJ...">
 */
function getMetaContent(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute('content') : null;
}

export const Config = {
  // Supabase
  supabase: {
    url: getMetaContent('supabase-url') || '',
    anonKey: getMetaContent('supabase-anon-key') || '',
  },

  // Application
  app: {
    name: 'EventPass',
    tagline: "Africa's Program Operations Platform",
    url: window.location.origin,
    env: getMetaContent('app-env') || 'development',
    version: '1.0.0',
    adminEmail: getMetaContent('platform-admin-email') || 'admin@myeventpass.com.ng',
  },

  // Defaults
  defaults: {
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    country: 'NG',
    dateFormat: 'DD MMM YYYY',
    timeFormat: 'h:mm A',
  },

  // RBAC hierarchy (lower index = higher privilege)
  // Config.roles is an array alias to roles.hierarchy for convenience
  roles: ['owner', 'admin', 'event_manager', 'staff', 'volunteer'],

  rbac: {
    hierarchy: ['owner', 'admin', 'event_manager', 'staff', 'volunteer'],
    labels: {
      owner: 'Owner',
      admin: 'Administrator',
      event_manager: 'Event Manager',
      staff: 'Staff',
      volunteer: 'Volunteer',
    },
    // Minimum role required for each action
    permissions: {
      'org:settings:edit': ['owner', 'admin'],
      'org:members:manage': ['owner', 'admin'],
      'org:billing:view': ['owner', 'admin'],
      'events:create': ['owner', 'admin', 'event_manager'],
      'events:publish': ['owner', 'admin', 'event_manager'],
      'events:delete': ['owner', 'admin', 'event_manager'],
      'events:clone': ['owner', 'admin', 'event_manager'],
      'registrations:view': ['owner', 'admin', 'event_manager', 'staff'],
      'registrations:manage': ['owner', 'admin', 'event_manager'],
      'attendance:record': ['owner', 'admin', 'event_manager', 'staff', 'volunteer'],
      'certificates:issue': ['owner', 'admin', 'event_manager'],
      'certificates:revoke': ['owner', 'admin'],
      'reports:view': ['owner', 'admin', 'event_manager'],
      'reports:export': ['owner', 'admin', 'event_manager'],
    },
  },


  // Supabase storage buckets
  storage: {
    orgAssets: 'organization-assets',
    tickets: 'tickets',
    certificates: 'certificates',
  },

  // Edge Function paths
  functions: {
    sendEmail: 'send-email',
    generateCertificate: 'generate-certificate',
    verifyTicket: 'verify-ticket',
  },

  // Pagination
  pagination: {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  },
};

export default Config;
