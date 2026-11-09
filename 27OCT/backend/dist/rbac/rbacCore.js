"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_ROLE_TO_RBAC_KEY = exports.LOCKED_ROLE_KEYS = exports.BUILTIN_PERMISSIONS = exports.FEATURE_GROUPS = exports.RBAC_PERMISSIONS = exports.RBAC_ROLES = void 0;
exports.hasRbacPermission = hasRbacPermission;
exports.buildMatrix = buildMatrix;
exports.canEditRolePermissions = canEditRolePermissions;
// Pure RBAC helpers shared by the migration, middleware, routes and tests.
// Source of truth for built-in roles/permissions is the RBAC catalog in
// rbacCatalog.ts.
const rbacCatalog_1 = require("./rbacCatalog");
Object.defineProperty(exports, "BUILTIN_PERMISSIONS", { enumerable: true, get: function () { return rbacCatalog_1.BUILTIN_PERMISSIONS; } });
Object.defineProperty(exports, "LEGACY_ROLE_TO_RBAC_KEY", { enumerable: true, get: function () { return rbacCatalog_1.LEGACY_ROLE_TO_RBAC_KEY; } });
const RBAC_ROLES = rbacCatalog_1.BUILTIN_ROLE_DEFS.map(([roleKey, name, description]) => ({
    role_key: roleKey,
    name,
    description
}));
exports.RBAC_ROLES = RBAC_ROLES;
const RBAC_PERMISSIONS = Object.entries(rbacCatalog_1.FEATURE_ACTIONS).flatMap(([resource, actions]) => actions.map(action => ({
    permission_key: `${resource}.${action}`,
    resource,
    action
})));
exports.RBAC_PERMISSIONS = RBAC_PERMISSIONS;
// Display groups matching the approved spreadsheet matrix: label + category
// per row. A cell is granted when the role holds at least one permission in
// the group.
const FEATURE_GROUPS = [
    { key: 'create_template', label: 'Create Template', category: 'Content Operations',
        permissions: ['templates.create'] },
    { key: 'create_document', label: 'Create Document', category: 'Content Operations',
        permissions: ['documents.create'] },
    { key: 'review', label: 'Review', category: 'Content Operations',
        permissions: ['documents.review', 'templates.review'] },
    { key: 'comment', label: 'Comment', category: 'Content Operations',
        permissions: ['documents.comment'] },
    { key: 'approval', label: 'Approval', category: 'Content Operations',
        permissions: ['documents.approve', 'templates.approve'] },
    { key: 'create_personal_account', label: 'Create Personal Account', category: 'System Level',
        permissions: ['users.create_personal_account'] },
    { key: 'approve_account', label: 'Approve Account', category: 'System Level',
        permissions: ['users.approve'] },
    { key: 'view_personal_calendar', label: 'View Personal Calendar', category: 'System Level',
        permissions: ['calendar.view_personal'] },
    { key: 'view_other_calendar', label: 'View Other Calendar', category: 'System Level',
        permissions: ['calendar.view_others'] },
    { key: 'reset_password', label: 'Reset Password', category: 'System Level',
        permissions: ['users.reset_password'] },
    { key: 'site_creation', label: 'Site Creation', category: 'System Level',
        permissions: ['organizations.site_create'] },
    { key: 'folder_access', label: 'Full/Partial Folder Access', category: 'System Level',
        permissions: ['folders.access'] },
    { key: 'file_access', label: 'File (Document) Access', category: 'Analytics & Access',
        permissions: ['documents.file_access'] },
    { key: 'audit_trail', label: 'Audit Trail', category: 'Analytics & Access',
        permissions: ['audit.view'] },
    { key: 'report_generation', label: 'Report Generation', category: 'Analytics & Access',
        permissions: ['reports.generate'] },
    { key: 'obsolete_template', label: 'Obsoleting Template', category: 'Content Operations',
        permissions: ['templates.obsolete'] },
    { key: 'obsolete_document', label: 'Obsoleting Document', category: 'Content Operations',
        permissions: ['documents.obsolete'] },
    { key: 'delete_draft_template', label: 'Delete Draft Template', category: 'Content Operations',
        permissions: ['templates.delete_draft'] },
    { key: 'reassign_own', label: 'Re-assign Own Tasks', category: 'Content Operations',
        permissions: ['tasks.reassign_own'] },
    { key: 'reassign_others', label: 'Re-assign Tasks to Others', category: 'Content Operations',
        permissions: ['tasks.reassign_others'] },
    { key: 'account_management_tab', label: 'Account Management Tab Access', category: 'System Level',
        permissions: ['users.account_management_tab'] },
    { key: 'training_admin', label: 'Training Admin Access', category: 'Training',
        permissions: ['training.admin'] },
    { key: 'training_classes', label: 'Classes', category: 'Training',
        permissions: ['training.classes'] },
    { key: 'temp_view', label: 'Temp View', category: 'Read-Only',
        permissions: ['documents.view', 'documents.file_access'] }
];
exports.FEATURE_GROUPS = FEATURE_GROUPS;
// Super Admin is a platform override: it always has every permission in
// getEffectiveAccess, so its matrix column is locked against editing.
const LOCKED_ROLE_KEYS = ['super_admin'];
exports.LOCKED_ROLE_KEYS = LOCKED_ROLE_KEYS;
function canEditRolePermissions(role) {
    return Boolean(role) && !LOCKED_ROLE_KEYS.includes(role.role_key);
}
function permissionSet(permissions) {
    return new Set(permissions || []);
}
function hasRbacPermission(permissions, resource, action) {
    const granted = permissionSet(permissions);
    return granted.has(`${resource}.${action}`) || granted.has(`${resource}.manage`);
}
// permissionsByRole: { [role_key]: string[] } -> screenshot-style matrix.
function buildMatrix(roles, permissionsByRole) {
    const rows = FEATURE_GROUPS.map(group => ({
        ...group,
        cells: roles.map(role => {
            const granted = permissionSet(permissionsByRole[role.role_key] || []);
            return {
                role_key: role.role_key,
                granted: group.permissions.some(key => {
                    const [feature] = key.split('.');
                    return granted.has(key) || granted.has(`${feature}.manage`);
                })
            };
        })
    }));
    const total = rows.length * roles.length;
    const granted = rows.reduce((sum, row) => sum + row.cells.filter(cell => cell.granted).length, 0);
    const restrictedRoles = roles.filter(role => !rows.every(row => row.cells.find(c => c.role_key === role.role_key)?.granted)).length;
    return { roles, rows, stats: { granted, total, restrictedRoles } };
}
