"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const rbacCore_1 = require("./rbacCore");
const rbacMigration_1 = require("./rbacMigration");
const rbacMiddleware_1 = require("./rbacMiddleware");
// Approved default snapshot: rbac_default_permissions table first,
// rbac-default-template.json / catalog fallback when the table is empty.
async function readDefaultPermissions(pool) {
    try {
        const { rows } = await pool.query('SELECT role_key, permission_key FROM rbac_default_permissions');
        if (rows.length) {
            const map = {};
            for (const row of rows) {
                map[row.role_key] = map[row.role_key] || [];
                map[row.role_key].push(row.permission_key);
            }
            return map;
        }
    }
    catch (error) {
        console.warn('rbac_default_permissions unreadable, using template file:', error.message);
    }
    return (0, rbacMigration_1.loadDefaultTemplate)();
}
async function writeRolePermissions(connection, roleId, permissionKeys) {
    await connection.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    const unique = [...new Set(permissionKeys || [])];
    if (!unique.length)
        return;
    const { rows: perms } = await connection.query('SELECT id, permission_key FROM permissions');
    const idByKey = new Map(perms.map(p => [p.permission_key, p.id]));
    const known = unique.filter(key => idByKey.has(key));
    if (!known.length)
        return;
    const values = known.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    await connection.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, known.flatMap(key => [roleId, idByKey.get(key)]));
}
const PERMISSION_KEYS = new Set(rbacCore_1.RBAC_PERMISSIONS.map(p => p.permission_key));
function isValidPermissionList(keys) {
    return Array.isArray(keys) && keys.every(key => typeof key === 'string' && PERMISSION_KEYS.has(key));
}
async function getRole(pool, id) {
    const { rows } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles WHERE id = $1', [id]);
    return rows[0] || null;
}
async function permissionsByRole(pool) {
    const { rows } = await pool.query(`SELECT r.role_key, p.permission_key
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     ORDER BY r.role_key, p.permission_key`);
    const map = {};
    for (const row of rows) {
        map[row.role_key] = map[row.role_key] || [];
        if (row.permission_key)
            map[row.role_key].push(row.permission_key);
    }
    return map;
}
async function unionPermissions(pool, req) {
    const fromRoles = await (0, rbacMiddleware_1.loadUserRbac)(pool, req.user.userId || req.user.id);
    const merged = new Set([...(req.user.permissions || []), ...fromRoles.permissions]);
    if (req.user.isSuperAdmin)
        rbacCore_1.RBAC_PERMISSIONS.forEach(p => merged.add(p.permission_key));
    return { roles: fromRoles.roles, permissions: [...merged] };
}
function registerRbacRoutes({ app, pool, authenticateToken, logAuditEvent }) {
    const viewGuard = (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'view');
    // Current user's roles + permissions (any authenticated user).
    app.get('/api/rbac/me', authenticateToken, async (req, res) => {
        try {
            const { roles, permissions } = await unionPermissions(pool, req);
            res.json({
                userId: req.user.userId || req.user.id,
                role: req.user.role,
                accessLevel: req.user.accessLevel || null,
                isSuperAdmin: Boolean(req.user.isSuperAdmin),
                roles,
                permissions
            });
        }
        catch (error) {
            console.error('Failed to load RBAC profile:', error);
            res.status(500).json({ error: 'Failed to load permissions' });
        }
    });
    // Permission check: /api/rbac/check?resource=documents&action=view
    // (also accepts ?permission=documents.view)
    app.get('/api/rbac/check', authenticateToken, async (req, res) => {
        try {
            const raw = typeof req.query.permission === 'string' ? req.query.permission : '';
            const [fromKeyResource, fromKeyAction] = raw.split('.');
            const resource = String(req.query.resource || fromKeyResource || '');
            const action = String(req.query.action || fromKeyAction || '');
            if (!resource || !action || !PERMISSION_KEYS.has(`${resource}.${action}`)) {
                return res.status(400).json({ error: 'A valid resource and action are required' });
            }
            const { permissions } = await unionPermissions(pool, req);
            res.json({
                resource, action,
                allowed: Boolean(req.user.isSuperAdmin) || (0, rbacCore_1.hasRbacPermission)(permissions, resource, action)
            });
        }
        catch (error) {
            console.error('Failed RBAC check:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    });
    app.get('/api/rbac/roles', authenticateToken, viewGuard, async (req, res) => {
        try {
            const { rows: roles } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles ORDER BY is_system DESC, name');
            const byRole = await permissionsByRole(pool);
            res.json(roles.map(role => ({ ...role, permissions: byRole[role.role_key] || [] })));
        }
        catch (error) {
            console.error('Failed to list RBAC roles:', error);
            res.status(500).json({ error: 'Failed to load roles' });
        }
    });
    app.get('/api/rbac/permissions', authenticateToken, viewGuard, async (req, res) => {
        res.json(rbacCore_1.RBAC_PERMISSIONS.map(p => ({
            key: p.permission_key, resource: p.resource, action: p.action
        })));
    });
    // Screenshot-style matrix: feature groups x roles, plus raw permissions.
    app.get('/api/rbac/matrix', authenticateToken, viewGuard, async (req, res) => {
        try {
            const { rows: roles } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles ORDER BY is_system DESC, name');
            const byRole = await permissionsByRole(pool);
            res.json({ ...(0, rbacCore_1.buildMatrix)(roles, byRole), permissionsByRole: byRole });
        }
        catch (error) {
            console.error('Failed to build RBAC matrix:', error);
            res.status(500).json({ error: 'Failed to load matrix' });
        }
    });
    // Lightweight role list for dropdowns (Edit User modal). Any signed-in
    // user gets id/role_key/name so new RBAC roles appear automatically.
    app.get('/api/rbac/assignable-roles', authenticateToken, async (req, res) => {
        try {
            const { rows: roles } = await pool.query('SELECT id, role_key, name FROM roles ORDER BY is_system DESC, name');
            res.json(roles);
        }
        catch (error) {
            console.error('Failed to list assignable RBAC roles:', error);
            res.status(500).json({ error: 'Failed to load roles' });
        }
    });
    // Approved out-of-the-box default matrix (31/81) for preview/diff.
    app.get('/api/rbac/default', authenticateToken, viewGuard, async (req, res) => {
        try {
            const { rows: roles } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles ORDER BY is_system DESC, name');
            const defaults = await readDefaultPermissions(pool);
            res.json({ ...(0, rbacCore_1.buildMatrix)(roles, defaults), permissionsByRole: defaults });
        }
        catch (error) {
            console.error('Failed to load RBAC default matrix:', error);
            res.status(500).json({ error: 'Failed to load default matrix' });
        }
    });
    // Restore every built-in role to the approved default. Custom roles are
    // left untouched. The UI keeps a yellow unsaved state until Save Changes.
    app.post(['/api/rbac/revert-default', '/api/rbac/revert'], authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'edit'), async (req, res) => {
        try {
            const defaults = await readDefaultPermissions(pool);
            const { rows: roles } = await pool.query('SELECT id, role_key FROM roles');
            const connection = await pool.connect();
            try {
                await connection.query("BEGIN");
                for (const role of roles) {
                    if (!(0, rbacCore_1.canEditRolePermissions)(role))
                        continue;
                    if (!Object.prototype.hasOwnProperty.call(defaults, role.role_key))
                        continue;
                    await writeRolePermissions(connection, role.id, defaults[role.role_key]);
                }
                await connection.query('INSERT INTO rbac_matrix_saves (save_mode, expires_at, created_by) VALUES ($1, $2, $3)', ['revert', null, req.user.userId || req.user.id || null]);
                await connection.query("COMMIT");
            }
            catch (error) {
                await connection.query("ROLLBACK");
                throw error;
            }
            finally {
                connection.release();
            }
            const { rows: freshRoles } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles ORDER BY is_system DESC, name');
            const byRole = await permissionsByRole(pool);
            res.json({ ...(0, rbacCore_1.buildMatrix)(freshRoles, byRole), permissionsByRole: byRole });
        }
        catch (error) {
            console.error('Failed to revert RBAC matrix to default:', error);
            res.status(500).json({ error: 'Failed to revert to default' });
        }
    });
    // Save the whole matrix at once with a Trial (optional expiry) or
    // Permanent mode. Records the save in rbac_matrix_saves for audit.
    app.post('/api/rbac/matrix/save', authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'edit'), async (req, res) => {
        try {
            const { permissionsByRole: postedPermissions, mode, expiresAt } = req.body || {};
            const saveMode = mode === 'trial' ? 'trial' : 'permanent';
            if (!postedPermissions || typeof postedPermissions !== 'object') {
                return res.status(400).json({ error: 'permissionsByRole is required' });
            }
            for (const keys of Object.values(postedPermissions)) {
                if (!isValidPermissionList(keys)) {
                    return res.status(400).json({ error: 'A valid permission list is required' });
                }
            }
            let expiresSqlValue = null;
            if (saveMode === 'trial' && expiresAt) {
                const parsed = new Date(expiresAt);
                if (Number.isNaN(parsed.getTime())) {
                    return res.status(400).json({ error: 'A valid expiry date is required for trial saves' });
                }
                expiresSqlValue = parsed;
            }
            const { rows: roles } = await pool.query('SELECT id, role_key FROM roles');
            const byKey = new Map(roles.map(r => [r.role_key, r.id]));
            const connection = await pool.connect();
            try {
                await connection.query("BEGIN");
                for (const [roleKey, keys] of Object.entries(postedPermissions)) {
                    const roleId = byKey.get(roleKey);
                    if (!roleId)
                        continue;
                    const role = roles.find(r => r.role_key === roleKey);
                    if (!(0, rbacCore_1.canEditRolePermissions)(role))
                        continue;
                    await writeRolePermissions(connection, roleId, keys);
                }
                await connection.query('INSERT INTO rbac_matrix_saves (save_mode, expires_at, created_by) VALUES ($1, $2, $3)', [saveMode, expiresSqlValue, req.user.userId || req.user.id || null]);
                await connection.query("COMMIT");
            }
            catch (error) {
                await connection.query("ROLLBACK");
                throw error;
            }
            finally {
                connection.release();
            }
            const { rows: freshRoles } = await pool.query('SELECT id, role_key, name, description, is_system FROM roles ORDER BY is_system DESC, name');
            const byRole = await permissionsByRole(pool);
            res.json({
                ...(0, rbacCore_1.buildMatrix)(freshRoles, byRole),
                permissionsByRole: byRole,
                save: { mode: saveMode, expiresAt: expiresSqlValue }
            });
        }
        catch (error) {
            console.error('Failed to save RBAC matrix:', error);
            res.status(500).json({ error: 'Failed to save matrix' });
        }
    });
    app.post('/api/rbac/roles', authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'create'), async (req, res) => {
        try {
            const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
            const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
            const permissionKeys = req.body?.permissions;
            if (!name || name.length > 120 || !isValidPermissionList(permissionKeys)) {
                return res.status(400).json({
                    error: 'A name of 1-120 characters and a valid permission list are required'
                });
            }
            const roleKey = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '')}_${(0, uuid_1.v4)().slice(0, 8)}`;
            const connection = await pool.connect();
            let roleId;
            try {
                await connection.query("BEGIN");
                const { rows: [createdRole] } = await connection.query('INSERT INTO roles (role_key, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING id', [roleKey, name, description || null]);
                roleId = createdRole.id;
                const unique = [...new Set(permissionKeys)];
                if (unique.length) {
                    const { rows: perms } = await connection.query('SELECT id, permission_key FROM permissions');
                    const idByKey = new Map(perms.map(p => [p.permission_key, p.id]));
                    const values = unique.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
                    const params = unique.flatMap(key => [roleId, idByKey.get(key)]);
                    await connection.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, params);
                }
                await connection.query("COMMIT");
            }
            catch (error) {
                await connection.query("ROLLBACK");
                throw error;
            }
            finally {
                connection.release();
            }
            res.status(201).json({
                id: roleId, role_key: roleKey, name, description,
                permissions: [...new Set(permissionKeys)]
            });
        }
        catch (error) {
            console.error('Failed to create RBAC role:', error);
            res.status(500).json({ error: 'Failed to create role' });
        }
    });
    app.put('/api/rbac/roles/:roleId/permissions', authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'edit'), async (req, res) => {
        try {
            const permissionKeys = req.body?.permissions;
            if (!isValidPermissionList(permissionKeys)) {
                return res.status(400).json({ error: 'A valid permission list is required' });
            }
            const role = await getRole(pool, req.params.roleId);
            if (!role)
                return res.status(404).json({ error: 'Role not found' });
            if (!(0, rbacCore_1.canEditRolePermissions)(role)) {
                return res.status(400).json({
                    error: 'Super Admin always has full access and cannot be edited'
                });
            }
            const connection = await pool.connect();
            try {
                await connection.query("BEGIN");
                await connection.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
                const unique = [...new Set(permissionKeys)];
                if (unique.length) {
                    const { rows: perms } = await connection.query('SELECT id, permission_key FROM permissions');
                    const idByKey = new Map(perms.map(p => [p.permission_key, p.id]));
                    const values = unique.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
                    const params = unique.flatMap(key => [role.id, idByKey.get(key)]);
                    await connection.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, params);
                }
                await connection.query("COMMIT");
            }
            catch (error) {
                await connection.query("ROLLBACK");
                throw error;
            }
            finally {
                connection.release();
            }
            res.json({ id: role.id, role_key: role.role_key, permissions: [...new Set(permissionKeys)] });
        }
        catch (error) {
            console.error('Failed to update RBAC role permissions:', error);
            res.status(500).json({ error: 'Failed to update role permissions' });
        }
    });
    // Organizations + members for the RBAC Dashboard assign form.
    app.get('/api/rbac/organizations', authenticateToken, viewGuard, async (req, res) => {
        try {
            const { rows: organizations } = await pool.query('SELECT id, name FROM organizations ORDER BY name');
            res.json(organizations);
        }
        catch (error) {
            console.error('Failed to list organizations for RBAC administration:', error);
            res.status(500).json({ error: 'Failed to load organizations' });
        }
    });
    app.get('/api/rbac/organizations/:orgId/users', authenticateToken, viewGuard, async (req, res) => {
        try {
            const { rows: users } = await pool.query(`SELECT u.id, u.organization_id, u.first_name, u.last_name, u.email, u.role,
                u.status, u.access_expires_at,
                (SELECT r.name FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id
                   AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                 ORDER BY r.is_system DESC, r.name LIMIT 1) AS rbac_role_name,
                (SELECT r.role_key FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id
                   AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                 ORDER BY r.is_system DESC, r.name LIMIT 1) AS rbac_role_key
         FROM users u
         WHERE u.organization_id = $1 AND u.status != 'inactive'
         ORDER BY u.first_name, u.last_name`, [req.params.orgId]);
            res.json(users);
        }
        catch (error) {
            console.error('Failed to list users for RBAC administration:', error);
            res.status(500).json({ error: 'Failed to load organization users' });
        }
    });
    app.get('/api/rbac/users/:userId/roles', authenticateToken, viewGuard, async (req, res) => {
        try {
            const data = await (0, rbacMiddleware_1.loadUserRbac)(pool, req.params.userId);
            res.json(data);
        }
        catch (error) {
            console.error('Failed to load user RBAC roles:', error);
            res.status(500).json({ error: 'Failed to load user roles' });
        }
    });
    // Assign a role. The per-request enforcement reads user_roles directly,
    // and the token bump forces the new permissions to take effect immediately.
    app.post('/api/rbac/users/:userId/roles', authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'create'), async (req, res) => {
        try {
            const roleId = Number(req.body?.roleId);
            if (!Number.isSafeInteger(roleId) || roleId < 1) {
                return res.status(400).json({ error: 'A valid roleId is required' });
            }
            const role = await getRole(pool, roleId);
            if (!role)
                return res.status(404).json({ error: 'Role not found' });
            let expiresSql = 'NULL';
            if (role.role_key === 'temporary_view') {
                if (req.body?.expiresIn !== '1h' && req.body?.expiresIn !== '4h') {
                    return res.status(400).json({
                        error: 'Temporary view access must expire after 1h or 4h'
                    });
                }
                expiresSql = req.body.expiresIn === '1h'
                    ? 'NOW() + make_interval(hours => 1)'
                    : 'NOW() + make_interval(hours => 4)';
            }
            else if (req.body?.expiresIn) {
                return res.status(400).json({
                    error: 'Expiry presets are only valid for temporary view access'
                });
            }
            const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.userId]);
            if (!userRows.length)
                return res.status(404).json({ error: 'User not found' });
            await pool.query(`INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
           VALUES ($1, $2, $3, ${expiresSql})
           ON CONFLICT (user_id, role_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by,
             expires_at = EXCLUDED.expires_at`, [req.params.userId, role.id, req.user.userId]);
            await pool.query(`UPDATE users SET access_expires_at = ${expiresSql},
             token_version = token_version + 1
           WHERE id = $1`, [req.params.userId]);
            if (logAuditEvent) {
                const { rows: target } = await pool.query('SELECT organization_id, email FROM users WHERE id = $1', [req.params.userId]);
                if (target.length) {
                    await logAuditEvent(pool, {
                        orgId: target[0].organization_id,
                        userId: req.user.userId,
                        userEmail: req.user.email,
                        actionType: 'RBAC_ROLE_ASSIGNED',
                        resourceType: 'user',
                        resourceId: String(req.params.userId),
                        details: { targetEmail: target[0].email, role: role.role_key },
                        req
                    });
                }
            }
            res.json({ message: 'Role assigned', role: role.role_key });
        }
        catch (error) {
            console.error('Failed to assign RBAC role:', error);
            res.status(500).json({ error: 'Failed to assign role' });
        }
    });
    app.delete('/api/rbac/users/:userId/roles/:roleId', authenticateToken, (0, rbacMiddleware_1.requirePermission)(pool, 'access_levels', 'delete'), async (req, res) => {
        try {
            const result = await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [req.params.userId, req.params.roleId]);
            if (!result.rowCount)
                return res.status(404).json({ error: 'Assignment not found' });
            res.status(204).end();
        }
        catch (error) {
            console.error('Failed to remove RBAC role:', error);
            res.status(500).json({ error: 'Failed to remove role' });
        }
    });
}
exports.default = registerRbacRoutes;
