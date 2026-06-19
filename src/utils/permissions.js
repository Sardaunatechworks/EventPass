// ============================================================
// EventPass: src/utils/permissions.js
// RBAC permission checker — all authorization logic lives here
// ============================================================
import { Config } from '../config.js';

/**
 * Returns true if the given role has the given permission.
 * @param {string} userRole - e.g. 'admin'
 * @param {string} permission - e.g. 'events:create'
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false;

  const allowedRoles = Config.rbac.permissions[permission];
  if (!allowedRoles) {
    console.warn(`[Permissions] Unknown permission: "${permission}"`);
    return false;
  }

  return allowedRoles.includes(userRole);
}

/**
 * Returns true if roleA is at least as privileged as roleB.
 */
export function isAtLeastRole(roleA, roleB) {
  const hierarchy = Config.rbac.hierarchy;
  const idxA = hierarchy.indexOf(roleA);
  const idxB = hierarchy.indexOf(roleB);
  if (idxA === -1 || idxB === -1) return false;
  return idxA <= idxB;
}

/**
 * Returns the display label for a role.
 */
export function getRoleLabel(role) {
  return Config.rbac.labels[role] || role;
}

/**
 * Returns all roles that can perform an action, in privilege order.
 */
export function getRolesForPermission(permission) {
  return Config.rbac.permissions[permission] || [];
}

/**
 * Session-aware permission checker.
 * Uses the org context stored in the app session.
 */
export class PermissionChecker {
  constructor(session) {
    this._session = session;
  }

  can(permission) {
    const role = this._session?.currentMember?.role;
    return hasPermission(role, permission);
  }

  /** Throws if user doesn't have the permission */
  require(permission) {
    if (!this.can(permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  get role() {
    return this._session?.currentMember?.role;
  }

  get isOwner() { return this.role === 'owner'; }
  get isAdmin() { return this.role === 'owner' || this.role === 'admin'; }
  get isManager() { return this.can('events:create'); }
  get isStaff() { return this.can('attendance:record'); }
}

export default { hasPermission, isAtLeastRole, getRoleLabel, getRolesForPermission, PermissionChecker };
