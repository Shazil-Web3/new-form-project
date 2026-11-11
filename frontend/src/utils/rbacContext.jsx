/**
 * @file rbacContext.jsx
 * @description Central Reactive RBAC Engine Context & Hook for the application.
 * Manages live permission matrix resolution, dynamic capability queries,
 * custom roles, and temporary session expiration.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './authService';
import {
  INITIAL_ROLES,
  INITIAL_MATRIX,
  CAPABILITIES,
  CAPABILITY_TO_PERMISSIONS,
  STORAGE_KEY_MATRIX,
  STORAGE_KEY_ROLES,
  STORAGE_KEY_USER_ASSIGNMENTS,
  STORAGE_KEY_TEMP_EXPIRATION,
  normalizeRoleId
} from './rbacConstants';

const EVENT_MATRIX_CHANGED = 'watermelon_rbac_matrix_changed';

const RbacContext = createContext(null);

function loadStoredRoles() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY_ROLES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_ROLES.length) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return [...INITIAL_ROLES];
}

function loadStoredMatrix() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY_MATRIX);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === INITIAL_MATRIX.length) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return INITIAL_MATRIX.map(row => [...row]);
}

function loadUserAssignments() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY_USER_ASSIGNMENTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return {};
}

export const RbacProvider = ({ children }) => {
  const { user } = useAuth();
  const [roles, setRoles] = useState(loadStoredRoles);
  const [matrix, setMatrix] = useState(loadStoredMatrix);
  const [userAssignments, setUserAssignments] = useState(loadUserAssignments);
  const [tempTimeRemaining, setTempTimeRemaining] = useState(null);

  // Sync state when external components trigger an update (e.g. from RbacDashboardPage)
  const refreshFromStorage = useCallback(() => {
    setRoles(loadStoredRoles());
    setMatrix(loadStoredMatrix());
    setUserAssignments(loadUserAssignments());
  }, []);

  useEffect(() => {
    const handleStorageOrCustomEvent = () => {
      refreshFromStorage();
    };

    window.addEventListener('storage', handleStorageOrCustomEvent);
    window.addEventListener(EVENT_MATRIX_CHANGED, handleStorageOrCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageOrCustomEvent);
      window.removeEventListener(EVENT_MATRIX_CHANGED, handleStorageOrCustomEvent);
    };
  }, [refreshFromStorage]);

  // Determine current effective role for the active user
  const activeRole = useMemo(() => {
    if (!user) {
      return roles.find(r => r.id === 'view') || INITIAL_ROLES[8];
    }

    // Check user-specific assignment first
    const userId = user.id || user.userId;
    if (userId && userAssignments[userId]) {
      const assignedRoleId = userAssignments[userId].roleId;
      const matched = roles.find(r => String(r.id) === String(assignedRoleId));
      if (matched) return matched;
    }

    // Next check user's direct role or isSuperAdmin
    if (user.isSuperAdmin) {
      return roles.find(r => r.id === 'super_admin') || INITIAL_ROLES[1];
    }

    const normalized = normalizeRoleId(user.role);
    const matched = roles.find(r => r.id === normalized || r.key === normalized);
    return matched || roles.find(r => r.id === 'view') || INITIAL_ROLES[8];
  }, [user, roles, userAssignments]);

  // Find column index of the active role in the matrix
  const roleColIndex = useMemo(() => {
    return roles.findIndex(r => r.id === activeRole.id);
  }, [roles, activeRole]);

  // Compile the set of granted capability IDs for the active role
  const activeCapabilities = useMemo(() => {
    const granted = new Set();

    // Super Admin has unconditional bypass for all capabilities
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) {
      CAPABILITIES.forEach(cap => granted.add(cap.id));
      return granted;
    }

    // System role is explicitly grantless
    if (activeRole.id === 'system') {
      return granted;
    }

    if (roleColIndex === -1) {
      return granted;
    }

    CAPABILITIES.forEach((cap, rowIdx) => {
      if (matrix[rowIdx] && matrix[rowIdx][roleColIndex] === true) {
        granted.add(cap.id);
      }
    });

    return granted;
  }, [activeRole, user, roleColIndex, matrix]);

  // Primary Capability Check Function
  const can = useCallback((capabilityId) => {
    if (!capabilityId) return false;
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) return true;
    return activeCapabilities.has(capabilityId);
  }, [activeRole, user, activeCapabilities]);

  // Checks if user has ANY of the specified capabilities
  const canAny = useCallback((capabilityIds = []) => {
    if (!Array.isArray(capabilityIds) || capabilityIds.length === 0) return false;
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) return true;
    return capabilityIds.some(id => activeCapabilities.has(id));
  }, [activeRole, user, activeCapabilities]);

  // Checks if user has ALL of the specified capabilities
  const canAll = useCallback((capabilityIds = []) => {
    if (!Array.isArray(capabilityIds) || capabilityIds.length === 0) return false;
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) return true;
    return capabilityIds.every(id => activeCapabilities.has(id));
  }, [activeRole, user, activeCapabilities]);

  // Checks fine-grained catalog permission (e.g. 'documents.create')
  const hasPermission = useCallback((permissionKey) => {
    if (!permissionKey) return false;
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) return true;

    // Check if permission is covered by any granted matrix capability
    for (const [capId, permList] of Object.entries(CAPABILITY_TO_PERMISSIONS)) {
      if (permList.includes(permissionKey) && activeCapabilities.has(capId)) {
        return true;
      }
    }

    // Wildcard feature check (e.g. 'documents.manage')
    const [feature] = permissionKey.split('.');
    for (const [capId, permList] of Object.entries(CAPABILITY_TO_PERMISSIONS)) {
      if (permList.includes(`${feature}.manage`) && activeCapabilities.has(capId)) {
        return true;
      }
    }

    return false;
  }, [activeRole, user, activeCapabilities]);

  // Department Isolation Helper for d_edit_same:
  // User can edit document if they have capability d_edit_same AND:
  // (user.department === doc.department OR user is explicitly listed as a participant/author)
  const canEditDocument = useCallback((doc) => {
    if (!doc) return false;
    if (activeRole.id === 'super_admin' || user?.isSuperAdmin) return true;
    if (!can('d_edit_same')) return false;

    // If document has no department restriction, allow
    if (!doc.department) return true;

    // Check same department match
    const userDept = String(user?.department || '').trim().toLowerCase();
    const docDept = String(doc.department || '').trim().toLowerCase();
    if (userDept && docDept && userDept === docDept) {
      return true;
    }

    // Check if user is creator or in approvers/reviewers participant list
    const currentUserId = String(user?.id || user?.userId || '');
    if (currentUserId && String(doc.created_by) === currentUserId) {
      return true;
    }

    // Check parsed approvers/reviewers
    const rawApprovers = doc.approvers;
    if (rawApprovers) {
      try {
        const parsed = typeof rawApprovers === 'string' ? JSON.parse(rawApprovers) : rawApprovers;
        const participants = [
          ...(Array.isArray(parsed?.reviewers) ? parsed.reviewers : []),
          ...(Array.isArray(parsed?.approvers) ? parsed.approvers : [])
        ];
        const isParticipant = participants.some(p => String(p.userId || p.id) === currentUserId);
        if (isParticipant) return true;
      } catch (e) {}
    }

    return false;
  }, [activeRole, user, can]);

  // Temporary Access Expiry Monitor for temp_view
  const isTemporary = activeRole.id === 'temp_view';

  useEffect(() => {
    if (!isTemporary) {
      setTempTimeRemaining(null);
      return;
    }

    // Look for active temporary expiration
    const checkExpiration = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY_TEMP_EXPIRATION);
        if (stored) {
          const parsed = JSON.parse(stored);
          const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : null;
          if (expiresAt) {
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            setTempTimeRemaining(diff);

            if (diff <= 0) {
              // Session expired: disconnect and redirect to dashboard
              window.localStorage.removeItem(STORAGE_KEY_TEMP_EXPIRATION);
              window.dispatchEvent(new CustomEvent('temp_session_expired', {
                detail: { message: 'Temporary access session expired. Redirecting to dashboard.' }
              }));
            }
          }
        }
      } catch (e) {}
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 5000);
    return () => clearInterval(interval);
  }, [isTemporary]);

  // Persist Matrix and Broadcast
  const saveMatrixChanges = useCallback((updatedMatrix, updatedRoles) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (updatedMatrix) {
          window.localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(updatedMatrix));
          setMatrix(updatedMatrix);
        }
        if (updatedRoles) {
          window.localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(updatedRoles));
          setRoles(updatedRoles);
        }
        window.dispatchEvent(new CustomEvent(EVENT_MATRIX_CHANGED));
      }
    } catch (e) {
      console.error('Failed to persist matrix changes', e);
    }
  }, []);

  const value = useMemo(() => ({
    roles,
    matrix,
    capabilities: CAPABILITIES,
    activeRole,
    activeCapabilities,
    can,
    canAny,
    canAll,
    hasPermission,
    canEditDocument,
    isTemporary,
    tempTimeRemaining,
    saveMatrixChanges,
    refreshFromStorage
  }), [
    roles,
    matrix,
    activeRole,
    activeCapabilities,
    can,
    canAny,
    canAll,
    hasPermission,
    canEditDocument,
    isTemporary,
    tempTimeRemaining,
    saveMatrixChanges,
    refreshFromStorage
  ]);

  return (
    <RbacContext.Provider value={value}>
      {children}
    </RbacContext.Provider>
  );
};

export const useRbac = () => {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error('useRbac must be used within an RbacProvider');
  }
  return context;
};

export default useRbac;

