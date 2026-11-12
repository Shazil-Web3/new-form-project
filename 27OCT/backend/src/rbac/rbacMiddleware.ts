// RBAC guard that layers on top of the existing authenticateToken middleware.
// It never replaces login: authenticateToken still verifies the JWT, loads the
// user and populates req.user.permissions from the RBAC tables. This guard then
// also honours assignments stored in `user_roles` / `role_permissions`.
import { hasRbacPermission } from "./rbacCore";

async function loadUserRbac(pool, userId) {
  if (!pool || !userId) return { roles: [], permissions: [] };
  const { rows: roleRows }: any = await pool.query(
    `SELECT r.id, r.role_key, r.name, ur.expires_at
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
    [userId]
  );
  const { rows: permissionRows }: any = await pool.query(
    `SELECT DISTINCT p.permission_key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
    [userId]
  );
  return {
    roles: roleRows,
    permissions: permissionRows.map(row => row.permission_key)
  };
}

// Usage: app.get('/x', authenticateToken, requirePermission(pool, 'documents', 'view'), handler)
function requirePermission(pool, resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Access token required', code: 'TOKEN_REQUIRED' });
      }
      if (req.user.isSuperAdmin) return next();
      if ((req.user.role === 'admin' || req.user.legacyRole === 'admin') && resource === 'access_levels') return next();
      if (hasRbacPermission(req.user.permissions, resource, action)) return next();

      const userId = req.user.userId || req.user.id;
      if (pool && userId) {
        const { rows }: any = await pool.query(
          `SELECT 1 AS ok
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1
             AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
             AND (p.permission_key = $2 OR p.permission_key = $3)
           LIMIT 1`,
          [userId, `${resource}.${action}`, `${resource}.manage`]
        );
        if (rows.length) return next();
      }
      return res.status(403).json({
        error: 'Access denied: permission required',
        code: 'PERMISSION_REQUIRED',
        requiredPermission: `${resource}.${action}`
      });
    } catch (error) {
      console.error('RBAC permission check failed:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export { loadUserRbac, requirePermission };
