"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const accessControl_1 = require("./accessControl");
const collaboration_1 = require("../collaboration");
const rbacCatalog_1 = require("../rbac/rbacCatalog");
(0, node_test_1.test)('permission checks honor exact grants and feature-level manage grants', () => {
    strict_1.default.equal((0, accessControl_1.canAccess)(['documents.create'], 'documents', 'create'), true);
    strict_1.default.equal((0, accessControl_1.canAccess)(['documents.manage'], 'documents', 'approve'), true);
    strict_1.default.equal((0, accessControl_1.canAccess)(['documents.view'], 'documents', 'delete'), false);
});
(0, node_test_1.test)('request classification maps workflow actions and administrative features', () => {
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/documents/12/approve', method: 'POST' }), {
        feature: 'documents',
        action: 'approve'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/rbac/roles', method: 'POST' }), {
        feature: 'access_levels',
        action: 'create'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/numbers/rules/3', method: 'GET' }), {
        feature: 'numbering',
        action: 'view'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/departments/3', method: 'GET' }), {
        feature: 'organizations',
        action: 'view'
    });
});
(0, node_test_1.test)('built-in profiles match the supplied access matrix', () => {
    const permissions = key => new Set(rbacCatalog_1.BUILTIN_PERMISSIONS[key].map(([feature, action]) => `${feature}.${action}`));
    const admin = permissions('org_admin');
    const peopleManager = permissions('people_manager');
    const temporaryView = permissions('temporary_view');
    const system = permissions('system');
    strict_1.default.equal(admin.has('users.manage'), true);
    strict_1.default.equal(admin.has('calendar.view_personal'), true);
    strict_1.default.equal(admin.has('calendar.view_others'), true);
    strict_1.default.equal(peopleManager.has('users.approve'), false);
    strict_1.default.equal(peopleManager.has('tasks.reassign_others'), true);
    strict_1.default.equal(temporaryView.has('documents.file_access'), true);
    strict_1.default.equal(temporaryView.has('users.reset_password'), false);
    strict_1.default.deepEqual(Array.from(system), []);
});
(0, node_test_1.test)('request classification maps matrix-specific actions', () => {
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/users/12/approve', method: 'POST' }), {
        feature: 'users',
        action: 'approve'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/templates/drafts/12', method: 'DELETE' }), {
        feature: 'templates',
        action: 'delete_draft'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({
        path: '/api/calendar/personal',
        method: 'GET',
        user: { userId: 7 }
    }), {
        feature: 'calendar',
        action: 'view_personal'
    });
    strict_1.default.deepEqual((0, accessControl_1.classifyRequest)({ path: '/api/documents/12/attachments', method: 'GET' }), {
        feature: 'documents',
        action: 'file_access'
    });
});
(0, node_test_1.test)('effective access assignments prevent legacy admin roles from widening custom access', () => {
    strict_1.default.equal((0, accessControl_1.getEffectiveRole)('admin', 'view_only'), 'viewer');
    strict_1.default.equal((0, accessControl_1.getEffectiveRole)('viewer', 'review_approval'), 'reviewer');
    strict_1.default.equal((0, accessControl_1.getEffectiveRole)('viewer', 'super_admin', true), 'admin');
});
(0, node_test_1.test)('tenant-scoped requests reject an organization mismatch for non-super-admins', () => {
    strict_1.default.equal((0, accessControl_1.isOrganizationMismatch)({ params: { orgId: '4' } }, { organization_id: 3, isSuperAdmin: false }), true);
    strict_1.default.equal((0, accessControl_1.isOrganizationMismatch)({ params: { orgId: '4' } }, { organization_id: 3, isSuperAdmin: true }), false);
});
(0, node_test_1.test)('collaboration events map reads, edits, and review actions to permissions', () => {
    strict_1.default.deepEqual((0, collaboration_1.classifySocketEvent)('joinDocument'), {
        feature: 'documents',
        action: 'view'
    });
    strict_1.default.deepEqual((0, collaboration_1.classifySocketEvent)('textChange'), {
        feature: 'documents',
        action: 'edit'
    });
    strict_1.default.deepEqual((0, collaboration_1.classifySocketEvent)('addTemplateComment'), {
        feature: 'templates',
        action: 'review'
    });
});
(0, node_test_1.test)('expired temporary access is denied instead of falling back to the legacy role', async () => {
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
    const access = await (0, accessControl_1.getEffectiveAccess)(pool, {
        id: 7,
        email: 'viewer@example.com',
        role: 'viewer'
    });
    strict_1.default.equal(access.expired, true);
    strict_1.default.deepEqual(access.permissions, []);
});
(0, node_test_1.test)('active RBAC grants are used instead of the legacy role', async () => {
    const pool = {
        async query(query) {
            if (query.includes('COUNT(*)'))
                return { rows: [{ n: 0 }] };
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
    const access = await (0, accessControl_1.getEffectiveAccess)(pool, {
        id: 9,
        email: 'author@example.com',
        role: 'viewer'
    });
    strict_1.default.equal(access.expired, false);
    strict_1.default.deepEqual(access.permissions, ['documents.create']);
    strict_1.default.deepEqual(access.accessLevel, { key: 'author', name: 'Author' });
});
