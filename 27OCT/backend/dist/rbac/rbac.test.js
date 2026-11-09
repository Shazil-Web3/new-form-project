"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const rbacCore_1 = require("./rbacCore");
const rbacMiddleware_1 = require("./rbacMiddleware");
function fakeRes() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}
(0, node_test_1.test)('hasRbacPermission honours exact and manage grants, denies others', () => {
    strict_1.default.equal((0, rbacCore_1.hasRbacPermission)(['documents.view'], 'documents', 'view'), true);
    strict_1.default.equal((0, rbacCore_1.hasRbacPermission)(['documents.manage'], 'documents', 'delete'), true);
    strict_1.default.equal((0, rbacCore_1.hasRbacPermission)(['documents.view'], 'documents', 'delete'), false);
    strict_1.default.equal((0, rbacCore_1.hasRbacPermission)([], 'documents', 'view'), false);
    strict_1.default.equal((0, rbacCore_1.hasRbacPermission)(null, 'documents', 'view'), false);
});
(0, node_test_1.test)('buildMatrix counts granted cells and restricted roles', () => {
    const roles = [
        { role_key: 'super_admin', name: 'Super Admin' },
        { role_key: 'temporary_view', name: 'Temp View' }
    ];
    // Super Admin holds every permission, like the production override.
    const all = rbacCore_1.RBAC_PERMISSIONS.map(permission => permission.permission_key);
    const matrix = (0, rbacCore_1.buildMatrix)(roles, {
        super_admin: all,
        temporary_view: ['documents.view', 'documents.file_access']
    });
    strict_1.default.equal(matrix.stats.total, matrix.rows.length * 2);
    strict_1.default.equal(matrix.rows.find(r => r.key === 'temp_view')
        .cells.find(c => c.role_key === 'temporary_view').granted, true);
    strict_1.default.equal(matrix.rows.find(r => r.key === 'audit_trail')
        .cells.find(c => c.role_key === 'temporary_view').granted, false);
    strict_1.default.equal(matrix.stats.restrictedRoles, 1);
    strict_1.default.ok(rbacCore_1.RBAC_ROLES.some(r => r.role_key === 'temporary_view'));
});
(0, node_test_1.test)('approved spreadsheet matrix: capability rows and default grants', () => {
    const labels = rbacCore_1.FEATURE_GROUPS.map(group => group.label);
    for (const expected of [
        'Create Template', 'Create Document', 'Review', 'Comment', 'Approval',
        'Create Personal Account', 'Approve Account', 'View Personal Calendar',
        'View Other Calendar', 'Reset Password', 'Site Creation',
        'Full/Partial Folder Access', 'File (Document) Access', 'Audit Trail',
        'Report Generation', 'Obsoleting Template', 'Obsoleting Document',
        'Delete Draft Template', 'Re-assign Own Tasks', 'Re-assign Tasks to Others',
        'Account Management Tab Access', 'Training Admin Access', 'Classes', 'Temp View'
    ]) {
        strict_1.default.ok(labels.includes(expected), `missing matrix row: ${expected}`);
    }
    // System holds no grants in the approved spreadsheet.
    strict_1.default.deepEqual(rbacCore_1.BUILTIN_PERMISSIONS.system, []);
    // Admin holds View Other Calendar in the approved spreadsheet.
    strict_1.default.ok(rbacCore_1.BUILTIN_PERMISSIONS.org_admin
        .some(([feature, action]) => feature === 'calendar' && action === 'view_others'));
});
(0, node_test_1.test)('matrix editing is allowed for built-in and custom roles, locked for Super Admin', () => {
    strict_1.default.equal((0, rbacCore_1.canEditRolePermissions)({ role_key: 'org_admin' }), true);
    strict_1.default.equal((0, rbacCore_1.canEditRolePermissions)({ role_key: 'temporary_view' }), true);
    strict_1.default.equal((0, rbacCore_1.canEditRolePermissions)({ role_key: 'custom_reviewer_x' }), true);
    strict_1.default.equal((0, rbacCore_1.canEditRolePermissions)({ role_key: 'super_admin' }), false);
    strict_1.default.equal((0, rbacCore_1.canEditRolePermissions)(null), false);
});
(0, node_test_1.test)('requirePermission allows existing permission and super admin', async () => {
    const guard = (0, rbacMiddleware_1.requirePermission)(null, 'documents', 'view');
    let nextCalls = 0;
    const next = () => { nextCalls += 1; };
    await guard({ user: { id: 1, permissions: ['documents.view'] } }, fakeRes(), next);
    await guard({ user: { id: 2, isSuperAdmin: true, permissions: [] } }, fakeRes(), next);
    strict_1.default.equal(nextCalls, 2);
});
(0, node_test_1.test)('requirePermission denies without a grant (fail closed)', async () => {
    const guard = (0, rbacMiddleware_1.requirePermission)(null, 'documents', 'delete');
    const res = fakeRes();
    let nextCalls = 0;
    await guard({ user: { id: 3, permissions: ['documents.view'] } }, res, () => { nextCalls += 1; });
    strict_1.default.equal(nextCalls, 0);
    strict_1.default.equal(res.statusCode, 403);
    strict_1.default.equal(res.body.code, 'PERMISSION_REQUIRED');
});
(0, node_test_1.test)('requirePermission falls back to user_roles rows from the database', async () => {
    const pool = {
        async query(sql, params) {
            strict_1.default.match(sql, /FROM user_roles/);
            strict_1.default.deepEqual(params, [7, 'billing.view', 'billing.manage']);
            return { rows: [{ ok: 1 }] };
        }
    };
    const guard = (0, rbacMiddleware_1.requirePermission)(pool, 'billing', 'view');
    let nextCalls = 0;
    await guard({ user: { id: 7, permissions: [] } }, fakeRes(), () => { nextCalls += 1; });
    strict_1.default.equal(nextCalls, 1);
});
