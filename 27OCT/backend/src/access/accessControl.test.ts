import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccess,
  classifyRequest,
  getEffectiveAccess,
  getEffectiveRole,
  isOrganizationMismatch
} from "./accessControl";
import { classifySocketEvent } from "../collaboration";
import { BUILTIN_PERMISSIONS } from "../rbac/rbacCatalog";

test('permission checks honor exact grants and feature-level manage grants', () => {
  assert.equal(canAccess(['documents.create'], 'documents', 'create'), true);
  assert.equal(canAccess(['documents.manage'], 'documents', 'approve'), true);
  assert.equal(canAccess(['documents.view'], 'documents', 'delete'), false);
});

test('request classification maps workflow actions and administrative features', () => {
  assert.deepEqual(classifyRequest({ path: '/api/documents/12/approve', method: 'POST' }), {
    feature: 'documents',
    action: 'approve'
  });
  assert.deepEqual(classifyRequest({ path: '/api/rbac/roles', method: 'POST' }), {
    feature: 'access_levels',
    action: 'create'
  });
  assert.deepEqual(classifyRequest({ path: '/api/numbers/rules/3', method: 'GET' }), {
    feature: 'numbering',
    action: 'view'
  });
  assert.deepEqual(classifyRequest({ path: '/api/departments/3', method: 'GET' }), {
    feature: 'organizations',
    action: 'view'
  });
});

test('built-in profiles match the supplied access matrix', () => {
  const permissions = key => new Set(BUILTIN_PERMISSIONS[key].map(([feature, action]) => `${feature}.${action}`));
  const admin = permissions('org_admin');
  const peopleManager = permissions('people_manager');
  const temporaryView = permissions('temporary_view');
  const system = permissions('system');

  assert.equal(admin.has('users.manage'), true);
  assert.equal(admin.has('calendar.view_personal'), true);
  assert.equal(admin.has('calendar.view_others'), true);
  assert.equal(peopleManager.has('users.approve'), false);
  assert.equal(peopleManager.has('tasks.reassign_others'), true);
  assert.equal(temporaryView.has('documents.file_access'), true);
  assert.equal(temporaryView.has('users.reset_password'), false);
  assert.deepEqual(Array.from(system), []);
});

test('request classification maps matrix-specific actions', () => {
  assert.deepEqual(classifyRequest({ path: '/api/users/12/approve', method: 'POST' }), {
    feature: 'users',
    action: 'approve'
  });
  assert.deepEqual(classifyRequest({ path: '/api/templates/drafts/12', method: 'DELETE' }), {
    feature: 'templates',
    action: 'delete_draft'
  });
  assert.deepEqual(classifyRequest({
    path: '/api/calendar/personal',
    method: 'GET',
    user: { userId: 7 }
  }), {
    feature: 'calendar',
    action: 'view_personal'
  });
  assert.deepEqual(classifyRequest({ path: '/api/documents/12/attachments', method: 'GET' }), {
    feature: 'documents',
    action: 'file_access'
  });
});

test('effective access assignments prevent legacy admin roles from widening custom access', () => {
  assert.equal(getEffectiveRole('admin', 'view_only'), 'viewer');
  assert.equal(getEffectiveRole('viewer', 'review_approval'), 'reviewer');
  assert.equal(getEffectiveRole('viewer', 'super_admin', true), 'admin');
});

test('tenant-scoped requests reject an organization mismatch for non-super-admins', () => {
  assert.equal(isOrganizationMismatch(
    { params: { orgId: '4' } },
    { organization_id: 3, isSuperAdmin: false }
  ), true);
  assert.equal(isOrganizationMismatch(
    { params: { orgId: '4' } },
    { organization_id: 3, isSuperAdmin: true }
  ), false);
});

test('collaboration events map reads, edits, and review actions to permissions', () => {
  assert.deepEqual(classifySocketEvent('joinDocument'), {
    feature: 'documents',
    action: 'view'
  });
  assert.deepEqual(classifySocketEvent('textChange'), {
    feature: 'documents',
    action: 'edit'
  });
  assert.deepEqual(classifySocketEvent('addTemplateComment'), {
    feature: 'templates',
    action: 'review'
  });
});

test('expired temporary access is denied instead of falling back to the legacy role', async () => {
  const pool = {
    async query(query) {
      if (query.includes('COUNT(*)')) {
        // One expired temporary_view assignment, no active grants.
        return { rows: [{ n: 1 }] };
      }
      if (query.includes('FROM users u')) {
        return { rows: [{
          email: 'viewer@example.com',
          role: 'viewer',
          status: 'active',
          token_version: 1,
          access_expires_at: new Date(Date.now() - 60_000)
        }] };
      }
      return { rows: [] };
    }
  };

  const access = await getEffectiveAccess(pool, {
    id: 7,
    email: 'viewer@example.com',
    role: 'viewer'
  });

  assert.equal(access.expired, true);
  assert.deepEqual(access.permissions, []);
});

test('active RBAC grants are used instead of the legacy role', async () => {
  const pool = {
    async query(query) {
      if (query.includes('COUNT(*)')) return { rows: [{ n: 0 }] };
      if (query.includes('FROM users u')) {
        return { rows: [{
          email: 'author@example.com',
          role: 'viewer',
          status: 'active',
          token_version: 1,
          access_expires_at: null
        }] };
      }
      if (query.includes('user_roles ur')) {
        return { rows: [
          { role_key: 'author', name: 'Author', permission_key: 'documents.create', expires_at: null }
        ] };
      }
      if (query.includes('FROM roles WHERE role_key')) {
        return { rows: [{ name: 'Author' }] };
      }
      if (query.includes('role_permissions rp')) {
        return { rows: [{ permission_key: 'documents.create' }] };
      }
      return { rows: [] };
    }
  };

  const access = await getEffectiveAccess(pool, {
    id: 9,
    email: 'author@example.com',
    role: 'viewer'
  });

  assert.equal(access.expired, false);
  assert.deepEqual(access.permissions, ['documents.create']);
  assert.deepEqual(access.accessLevel, { key: 'author', name: 'Author' });
});
