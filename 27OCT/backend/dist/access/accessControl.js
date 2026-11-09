"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_CATALOG = void 0;
exports.canAccess = canAccess;
exports.classifyRequest = classifyRequest;
exports.getEffectiveRole = getEffectiveRole;
exports.getEffectiveAccess = getEffectiveAccess;
exports.isConfiguredSuperAdmin = isConfiguredSuperAdmin;
exports.isOrganizationMismatch = isOrganizationMismatch;
const rbacCatalog_1 = require("../rbac/rbacCatalog");
const PERMISSION_CATALOG = Object.entries(rbacCatalog_1.FEATURE_ACTIONS)
    .flatMap(([feature, actions]) => actions.map(action => ({
    key: `${feature}.${action}`,
    feature,
    action
})));
exports.PERMISSION_CATALOG = PERMISSION_CATALOG;
const DEFAULT_ROLE_KEY_BY_ROLE = {
    ...rbacCatalog_1.LEGACY_ROLE_TO_RBAC_KEY,
    temporary_view: 'temporary_view',
    super_admin: 'super_admin'
};
function getEffectiveRole(legacyRole, accessKey, isSuperAdmin = false) {
    if (isSuperAdmin || accessKey === 'super_admin')
        return 'admin';
    if (accessKey === 'org_admin')
        return 'admin';
    if (accessKey === 'project_manager')
        return 'project_manager';
    if (accessKey === 'people_manager')
        return 'people_manager';
    if (accessKey === 'author')
        return 'author';
    if (accessKey === 'system')
        return 'system';
    if (accessKey === 'review_approval') {
        return String(legacyRole || '').toLowerCase() === 'approver' ? 'approver' : 'reviewer';
    }
    if (accessKey === 'view_only' || accessKey === 'temporary_view')
        return 'viewer';
    return accessKey ? 'viewer' : legacyRole;
}
function isConfiguredSuperAdmin(email) {
    const allowlistedEmails = String(process.env.SUPER_ADMIN_EMAILS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    return Boolean(email && allowlistedEmails.includes(String(email).trim().toLowerCase()));
}
function canAccess(permissions, feature, action) {
    const granted = new Set(permissions || []);
    return granted.has(`${feature}.${action}`) || granted.has(`${feature}.manage`);
}
async function pickPrimaryRbacName(pool, accessKey) {
    const { rows } = await pool.query('SELECT name FROM roles WHERE role_key = $1', [accessKey]);
    return rows[0]?.name || accessKey;
}
async function getEffectiveAccess(pool, user) {
    const { rows: userRows } = await pool.query(`SELECT u.email, u.role, u.status, u.token_version, u.access_expires_at
     FROM users u
     WHERE u.id = $1`, [user.id]);
    const accessRow = userRows[0];
    if (!accessRow) {
        return {
            accessLevel: null,
            permissions: [],
            isSuperAdmin: false,
            expired: false,
            inactive: true,
            tokenVersion: null,
            legacyRole: user.role || null,
            expiresAt: null
        };
    }
    // Enforcement reads the RBAC tables only: active user_roles grants,
    // falling back to the legacy users.role value when no active grant exists.
    const useAssignment = !user.ignoreAccessLevelAssignment;
    const legacyRole = user.ignoreAccessLevelAssignment ? user.role : (accessRow.role || user.role);
    const configuredSuperAdmin = isConfiguredSuperAdmin(accessRow.email || user.email);
    const { rows: activeGrants } = await pool.query(`SELECT r.role_key, r.name, p.permission_key, ur.expires_at
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`, [user.id]);
    const activeRoleKeys = [...new Set(activeGrants.map(row => row.role_key))];
    const { rows: [expiredTemp] } = await pool.query(`SELECT COUNT(*) AS n
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.role_key = 'temporary_view'
       AND ur.expires_at IS NOT NULL
       AND ur.expires_at <= NOW()`, [user.id]);
    const fallbackKey = DEFAULT_ROLE_KEY_BY_ROLE[String(legacyRole || '').toLowerCase()] || null;
    let accessKey = fallbackKey;
    if (useAssignment && activeRoleKeys.length) {
        accessKey = activeRoleKeys.includes('super_admin')
            ? 'super_admin'
            : activeRoleKeys.includes(fallbackKey)
                ? fallbackKey
                : [...activeRoleKeys].sort()[0];
    }
    const isSuperAdmin = configuredSuperAdmin || activeRoleKeys.includes('super_admin') || accessKey === 'super_admin';
    if (!accessKey && !isSuperAdmin) {
        return {
            accessLevel: null,
            permissions: [],
            isSuperAdmin: false,
            expired: false,
            inactive: accessRow.status !== 'active',
            tokenVersion: accessRow.token_version,
            legacyRole,
            expiresAt: null
        };
    }
    if (isSuperAdmin) {
        return {
            accessLevel: { key: 'super_admin', name: 'Super Admin' },
            permissions: PERMISSION_CATALOG.map(permission => permission.key),
            isSuperAdmin: true,
            expired: false,
            inactive: accessRow.status !== 'active',
            tokenVersion: accessRow.token_version,
            legacyRole,
            expiresAt: null
        };
    }
    const grantExpiries = activeGrants
        .map(row => row.expires_at)
        .filter(Boolean)
        .map(value => new Date(value))
        .filter(date => Number.isFinite(date.getTime()));
    const legacyExpiry = accessRow.access_expires_at ? new Date(accessRow.access_expires_at) : null;
    if (legacyExpiry && Number.isFinite(legacyExpiry.getTime()))
        grantExpiries.push(legacyExpiry);
    const expiresAt = grantExpiries.length
        ? new Date(Math.min(...grantExpiries.map(date => date.getTime())))
        : null;
    const effectiveExpiresAt = useAssignment ? expiresAt : null;
    const expired = Boolean((effectiveExpiresAt && effectiveExpiresAt.getTime() <= Date.now()) ||
        (accessKey === 'temporary_view' && !effectiveExpiresAt)) || (Number(expiredTemp?.n) > 0 && activeGrants.every(row => !row.permission_key));
    const roleName = await pickPrimaryRbacName(pool, accessKey);
    if (expired) {
        return {
            accessLevel: { key: accessKey, name: roleName },
            permissions: [],
            isSuperAdmin: false,
            expired: true,
            inactive: accessRow.status !== 'active',
            tokenVersion: accessRow.token_version,
            legacyRole,
            expiresAt: effectiveExpiresAt
        };
    }
    const { rows: permissionRows } = await pool.query(`SELECT DISTINCT p.permission_key
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN roles r ON r.id = rp.role_id
     WHERE r.role_key = $1`, [accessKey]);
    return {
        accessLevel: { key: accessKey, name: roleName },
        permissions: permissionRows.map(row => row.permission_key),
        isSuperAdmin: false,
        expired: false,
        inactive: accessRow.status !== 'active',
        tokenVersion: accessRow.token_version,
        legacyRole,
        expiresAt: effectiveExpiresAt
    };
}
function classifyRequest(req) {
    const path = String(req.path || '').toLowerCase();
    const method = String(req.method || 'GET').toUpperCase();
    let feature;
    if (/\/rbac(\/|$)/.test(path))
        feature = 'access_levels';
    else if (/\/(permissions|roles)(\/|$)/.test(path))
        feature = 'access_levels';
    else if (/report/.test(path))
        feature = 'reports';
    else if (/folder/.test(path))
        feature = 'folders';
    else if (/organization|departments?|sites?/.test(path))
        feature = 'organizations';
    else if (/number/.test(path))
        feature = 'numbering';
    else if (/task/.test(path))
        feature = 'tasks';
    else if (/calendar|gantt/.test(path))
        feature = 'calendar';
    else if (/reference/.test(path))
        feature = 'references';
    else if (/training|curriculum|specialt|quiz|lesson|lms|matrix|\/b44\//.test(path))
        feature = 'training';
    else if (/template|category/.test(path))
        feature = 'templates';
    else if (/audit|\/logs(?:\/|$)/.test(path))
        feature = 'audit';
    else if (/billing|subscription/.test(path))
        feature = 'billing';
    else if (/user|member|invite|org_/.test(path))
        feature = 'users';
    else if (/document|\/docs?(?:\/|$)|attachment|\/files?(?:\/|$)|impact|trending|export-csv|summary|check-name/.test(path))
        feature = 'documents';
    else
        feature = 'workspace';
    let action;
    if (/reset[-_/]?password/.test(path)) {
        action = 'reset_password';
    }
    else if (/obsolete|obsoleting/.test(path) && method !== 'GET') {
        action = 'obsolete';
    }
    else if ((/delete.*draft|draft.*delete/.test(path) ||
        (feature === 'templates' && /draft/.test(path) && method === 'DELETE')) &&
        method !== 'GET') {
        action = 'delete_draft';
    }
    else if ((/attachment|\/files?(?:\/|$)/.test(path)) && method === 'GET') {
        action = 'file_access';
    }
    else if (feature === 'training' && /admin/.test(path)) {
        action = 'admin';
    }
    else if (feature === 'training' && /class/.test(path)) {
        action = method === 'GET' || method === 'HEAD' ? 'classes' : 'create';
    }
    else if (/reassign/.test(path) && method !== 'GET') {
        const assignedTo = req.body?.assigned_to || req.body?.assignedTo || req.query?.assigned_to;
        action = assignedTo && String(assignedTo) !== String(req.user?.userId || req.user?.id)
            ? 'reassign_others'
            : 'reassign_own';
    }
    else if (/approve|approval|publish|archive/.test(path) && method !== 'GET') {
        action = 'approve';
    }
    else if (/comment/.test(path) && method !== 'GET') {
        action = 'comment';
    }
    else if (/review/.test(path) && method !== 'GET') {
        action = 'review';
    }
    else if (feature === 'folders') {
        action = 'access';
    }
    else if (feature === 'reports' && (method === 'GET' || method === 'POST')) {
        action = 'generate';
    }
    else if (feature === 'organizations' && /site/.test(path) && method === 'POST') {
        action = 'site_create';
    }
    else if (feature === 'calendar' && (method === 'GET' || method === 'HEAD')) {
        const requestedUserId = req.params?.userId || req.query?.userId || req.query?.user_id;
        action = /personal|\/me(?:\/|$)|my[-_/]/.test(path) ||
            (requestedUserId && String(requestedUserId) === String(req.user?.userId || req.user?.id))
            ? 'view_personal'
            : 'view_others';
    }
    else if (/export/.test(path) && (method === 'GET' || method === 'POST')) {
        action = 'export';
    }
    else if (method === 'GET' || method === 'HEAD') {
        action = 'view';
    }
    else if (method === 'POST') {
        action = 'create';
    }
    else if (method === 'PUT' || method === 'PATCH') {
        action = 'edit';
    }
    else if (method === 'DELETE') {
        action = 'delete';
    }
    else {
        action = 'view';
    }
    return { feature, action };
}
function isOrganizationMismatch(req, user) {
    if (user.isSuperAdmin)
        return false;
    const requestedOrgId = req.params?.orgId || req.query?.orgId || req.body?.orgId || req.body?.organization_id;
    const userOrgId = user.organization_id || user.orgId;
    return Boolean(requestedOrgId &&
        userOrgId &&
        String(requestedOrgId) !== String(userOrgId));
}
