// ============================================================
// EventPass: src/utils/org-resolver.js
// Resolves the current organization from URL path or localStorage.
// Architecture is subdomain-ready; uses path/param for local dev.
// ============================================================
import { supabase } from '../services/supabase.js';

const ORG_STORAGE_KEY = 'eventpass_current_org';
const MEMBER_STORAGE_KEY = 'eventpass_current_member';

/**
 * Resolve the current organization context.
 *
 * Resolution order:
 * 1. URL param: ?org=slug  (e.g. localhost:3000/app.html?org=techfort)
 * 2. Subdomain: techfort.eventpass.africa  (production)
 * 3. localStorage: previously selected org
 *
 * Returns { org, member } or null if not resolvable.
 */
export async function resolveOrganization(userId) {
  // 1. Check URL for explicit org slug
  const urlParams = new URLSearchParams(window.location.search);
  const slugFromUrl = urlParams.get('org');

  // 2. Check subdomain (production)
  const slugFromSubdomain = getSubdomainSlug();

  const targetSlug = slugFromUrl || slugFromSubdomain;

  if (targetSlug) {
    const result = await fetchOrgBySlug(targetSlug, userId);
    if (result) {
      persistOrgContext(result);
      return result;
    }
  }

  // 3. Restore from localStorage
  const cached = getCachedOrgContext();
  if (cached) {
    // Re-validate membership is still active
    const result = await fetchOrgById(cached.org.id, userId);
    if (result) {
      persistOrgContext(result);
      return result;
    }
  }

  // 4. No org resolved — fetch first org the user belongs to
  const result = await fetchFirstUserOrg(userId);
  if (result) {
    persistOrgContext(result);
    return result;
  }

  // Detect if the organization is suspended (member exists but org query was filtered out)
  if (userId) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    if (memberships && memberships.length > 0) {
      return { suspended: true };
    }
  }

  return null;
}

/**
 * Extract subdomain from hostname.
 * Returns null on localhost or base domain.
 */
function getSubdomainSlug() {
  const hostname = window.location.hostname;
  // Return null on localhost/IP — no subdomain routing in dev
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  const baseDomain = 'eventpass.africa';
  if (!hostname.endsWith('.' + baseDomain)) return null;

  const parts = hostname.split('.');
  const sub = parts[0];
  if (['www', 'app', 'api'].includes(sub)) return null;

  return sub;
}

async function fetchOrgBySlug(slug, userId) {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (orgError || !org) return null;

  const member = await fetchMembership(org.id, userId);
  if (!member) return null;

  return { org, member };
}

async function fetchOrgById(orgId, userId) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !org) return null;

  const member = await fetchMembership(org.id, userId);
  if (!member) return null;

  return { org, member };
}

async function fetchFirstUserOrg(userId) {
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !memberships?.length) return null;

  const membership = memberships[0];
  if (!membership.organizations) return null;

  return {
    org: membership.organizations,
    member: {
      id: membership.id,
      role: membership.role,
      user_id: membership.user_id,
      organization_id: membership.organization_id,
    },
  };
}

async function fetchMembership(orgId, userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('organization_members')
    .select('id, role, user_id, organization_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data;
}

/** Fetch all orgs the user belongs to (for org switcher) */
export async function getUserOrganizations(userId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data || [])
    .filter(m => m.organizations != null)
    .map(m => ({
      org: m.organizations,
      role: m.role,
    }));
}

function persistOrgContext({ org, member }) {
  try {
    localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(org));
    localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(member));
  } catch (e) {
    // localStorage might be unavailable
  }
}

function getCachedOrgContext() {
  try {
    const org = JSON.parse(localStorage.getItem(ORG_STORAGE_KEY));
    const member = JSON.parse(localStorage.getItem(MEMBER_STORAGE_KEY));
    if (org && member) return { org, member };
  } catch {
    // ignore
  }
  return null;
}

export function clearOrgContext() {
  try {
    localStorage.removeItem(ORG_STORAGE_KEY);
    localStorage.removeItem(MEMBER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default { resolveOrganization, getUserOrganizations, clearOrgContext };
