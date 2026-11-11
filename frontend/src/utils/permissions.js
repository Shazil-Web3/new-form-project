/**
 * @file permissions.js
 * @description RBAC permission resolution utility functions.
 * Integrates with dynamic matrix capabilities and supports legacy fallbacks.
 */

import {
  CAPABILITIES,
  CAPABILITY_TO_PERMISSIONS,
  STORAGE_KEY_MATRIX,
  STORAGE_KEY_ROLES,
  normalizeRoleId
} from './rbacConstants';

export const hasPermission = (user, permission) => {
  if (!user || typeof permission !== 'string') return false;
  if (user.isSuperAdmin) return true;

  // If user object already carries a resolved permissions array, check it
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const permissions = new Set(user.permissions);
    if (permissions.has(permission)) return true;
    const [feature] = permission.split('.');
    if (permissions.has(`${feature}.manage`)) return true;
  }

  // Admin access levels shortcut
  if (user.role === 'admin' && (permission === 'access_levels.manage' || permission === 'access_levels.view')) {
    return true;
  }

  // Resolve from live RBAC matrix stored in localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedRoles = window.localStorage.getItem(STORAGE_KEY_ROLES);
      const storedMatrix = window.localStorage.getItem(STORAGE_KEY_MATRIX);
      if (storedRoles && storedMatrix) {
        const roles = JSON.parse(storedRoles);
        const matrix = JSON.parse(storedMatrix);
        const normalizedRole = normalizeRoleId(user.role);
        const colIdx = roles.findIndex(r => r.id === normalizedRole || r.key === normalizedRole);

        if (colIdx !== -1) {
          // Check which capabilities are granted to this role
          for (let rowIdx = 0; rowIdx < CAPABILITIES.length; rowIdx++) {
            if (matrix[rowIdx] && matrix[rowIdx][colIdx] === true) {
              const capId = CAPABILITIES[rowIdx].id;
              const mappedPerms = CAPABILITY_TO_PERMISSIONS[capId] || [];
              if (mappedPerms.includes(permission)) return true;

              const [feature] = permission.split('.');
              if (mappedPerms.includes(`${feature}.manage`)) return true;
            }
          }
        }
      }
    }
  } catch (e) {}

  return false;
};

export default hasPermission;
