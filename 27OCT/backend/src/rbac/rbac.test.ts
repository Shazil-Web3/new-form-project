import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasRbacPermission, buildMatrix, RBAC_ROLES, RBAC_PERMISSIONS, FEATURE_GROUPS,
  BUILTIN_PERMISSIONS, canEditRolePermissions
} from "./rbacCore";
import { requirePermission } from "./rbacMiddleware";

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('hasRbacPermission honours exact and manage grants, denies others', () => {
  assert.equal(hasRbacPermission(['documents.view'], 'documents', 'view'), true);
  assert.equal(hasRbacPermission(['documents.manage'], 'documents', 'delete'), true);
  assert.equal(hasRbacPermission(['documents.view'], 'documents', 'delete'), false);
  assert.equal(hasRbacPermission([], 'documents', 'view'), false);
  assert.equal(hasRbacPermission(null, 'documents', 'view'), false);
});

test('buildMatrix counts granted cells and restricted roles', () => {
  const roles = [
    { role_key: 'super_admin', name: 'Super Admin' },
    { role_key: 'temporary_view', name: 'Temp View' }
  ];
  // Super Admin holds every permission, like the production override.
  const all = RBAC_PERMISSIONS.map(permission => permission.permission_key);
  const matrix = buildMatrix(roles, {
    super_admin: all,
    temporary_view: ['documents.view', 'documents.file_access']
  });
  assert.equal(matrix.stats.total, matrix.rows.length * 2);
  assert.equal(matrix.rows.find(r => r.key === 'temp_view')
    .cells.find(c => c.role_key === 'temporary_view').granted, true);
  assert.equal(matrix.rows.find(r => r.key === 'audit_trail')
    .cells.find(c => c.role_key === 'temporary_view').granted, false);
  assert.equal(matrix.stats.restrictedRoles, 1);
  assert.ok(RBAC_ROLES.some(r => r.role_key === 'temporary_view'));
});

test('approved spreadsheet matrix: capability rows and default grants', () => {
  const labels = FEATURE_GROUPS.map(group => group.label);
  for (const expected of [
    'Create Template', 'Create Document', 'Review', 'Comment', 'Approval',
    'Create Personal Account', 'Approve Account', 'View Personal Calendar',
    'View Other Calendar', 'Reset Password', 'Site Creation',
    'Full/Partial Folder Access', 'File (Document) Access', 'Audit Trail',
    'Report Generation', 'Obsoleting Template', 'Obsoleting Document',
    'Delete Draft Template', 'Re-assign Own Tasks', 'Re-assign Tasks to Others',
    'Account Management Tab Access', 'Training Admin Access', 'Classes', 'Temp View'
  ]) {
    assert.ok(labels.includes(expected), `missing matrix row: ${expected}`);
  }
  // System holds no grants in the approved spreadsheet.
  assert.deepEqual(BUILTIN_PERMISSIONS.system, []);
  // Admin holds View Other Calendar in the approved spreadsheet.
  assert.ok(BUILTIN_PERMISSIONS.org_admin
    .some(([feature, action]) => feature === 'calendar' && action === 'view_others'));
});

test('matrix editing is allowed for built-in and custom roles, locked for Super Admin', () => {
  assert.equal(canEditRolePermissions({ role_key: 'org_admin' }), true);
  assert.equal(canEditRolePermissions({ role_key: 'temporary_view' }), true);
  assert.equal(canEditRolePermissions({ role_key: 'custom_reviewer_x' }), true);
  assert.equal(canEditRolePermissions({ role_key: 'super_admin' }), false);
  assert.equal(canEditRolePermissions(null), false);
});

test('requirePermission allows existing permission and super admin', async () => {
  const guard = requirePermission(null, 'documents', 'view');
  let nextCalls = 0;
  const next = () => { nextCalls += 1; };

  await guard({ user: { id: 1, permissions: ['documents.view'] } }, fakeRes(), next);
  await guard({ user: { id: 2, isSuperAdmin: true, permissions: [] } }, fakeRes(), next);
  assert.equal(nextCalls, 2);
});

test('requirePermission denies without a grant (fail closed)', async () => {
  const guard = requirePermission(null, 'documents', 'delete');
  const res = fakeRes();
  let nextCalls = 0;
  await guard({ user: { id: 3, permissions: ['documents.view'] } }, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'PERMISSION_REQUIRED');
});

test('requirePermission falls back to user_roles rows from the database', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /FROM user_roles/);
      assert.deepEqual(params, [7, 'billing.view', 'billing.manage']);
      return { rows: [{ ok: 1 }] };
    }
  };
  const guard = requirePermission(pool, 'billing', 'view');
  let nextCalls = 0;
  await guard({ user: { id: 7, permissions: [] } }, fakeRes(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
});
