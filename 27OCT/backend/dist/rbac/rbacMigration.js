"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRbacMigration = runRbacMigration;
exports.loadDefaultTemplate = loadDefaultTemplate;
// Creates and seeds `roles`, `permissions`, `role_permissions`, `user_roles`
// in the existing Watermelon database (name from backend/.env: DB_NAME).
// Idempotent: safe on every server start. Users without an RBAC assignment
// get one from their legacy users.role value.
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const rbacCore_1 = require("./rbacCore");
// Approved out-of-the-box default matrix. The JSON file is the source of
// truth; the catalog is the fallback when the file is unavailable.
function loadDefaultTemplate() {
    try {
        const file = path_1.default.join(__dirname, 'rbac-default-template.json');
        const parsed = JSON.parse(fs_1.default.readFileSync(file, 'utf8'));
        if (parsed && parsed.permissionsByRole)
            return parsed.permissionsByRole;
    }
    catch (error) {
        console.warn('RBAC default template file unreadable, falling back to catalog:', error.message);
    }
    const fallback = {};
    for (const [roleKey, grants] of Object.entries(rbacCore_1.BUILTIN_PERMISSIONS)) {
        fallback[roleKey] = [...new Set(grants.map(([f, a]) => `${f}.${a}`))].sort();
    }
    return fallback;
}
async function runRbacMigration(poolOrConnection) {
    // pg Pool and Client both expose query(); no checkout needed.
    const connection = poolOrConnection;
    try {
        await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_key VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        is_system BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        permission_key VARCHAR(160) NOT NULL UNIQUE,
        resource VARCHAR(80) NOT NULL,
        action VARCHAR(80) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (resource, action)
      )
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      )
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
        assigned_by INTEGER NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
      )
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id)');
        await connection.query('CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles (expires_at)');
        for (const role of rbacCore_1.RBAC_ROLES) {
            await connection.query(`INSERT INTO roles (role_key, name, description, is_system) VALUES ($1, $2, $3, true)
         ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name,
           description = EXCLUDED.description, is_system = true`, [role.role_key, role.name, role.description]);
        }
        for (const permission of rbacCore_1.RBAC_PERMISSIONS) {
            await connection.query(`INSERT INTO permissions (permission_key, resource, action) VALUES ($1, $2, $3)
         ON CONFLICT (permission_key) DO UPDATE SET permission_key = EXCLUDED.permission_key`, [permission.permission_key, permission.resource, permission.action]);
        }
        const { rows: roleRows } = await connection.query('SELECT id, role_key FROM roles');
        const { rows: permissionRows } = await connection.query('SELECT id, permission_key FROM permissions');
        const roleIdByKey = new Map(roleRows.map(r => [r.role_key, r.id]));
        const permissionIdByKey = new Map(permissionRows.map(p => [p.permission_key, p.id]));
        // Seed built-in role_permissions from the access-matrix catalog.
        // Edits saved from the UI survive a restart, including a role saved
        // with zero permissions: "already seeded" is tracked explicitly
        // instead of inferred from row counts. Only Super Admin (platform
        // override) is always rebuilt in full.
        await connection.query(`
      CREATE TABLE IF NOT EXISTS permission_seed_state (
        seed_key VARCHAR(120) PRIMARY KEY,
        seeded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
        for (const [roleKey, grants] of Object.entries(rbacCore_1.BUILTIN_PERMISSIONS)) {
            const roleId = roleIdByKey.get(roleKey);
            if (!roleId)
                continue;
            if (roleKey !== 'super_admin') {
                const seedKey = `rbac:${roleKey}`;
                const { rows: [marker] } = await connection.query('SELECT seed_key FROM permission_seed_state WHERE seed_key = $1', [seedKey]);
                const { rows: [existing] } = await connection.query('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id = $1', [roleId]);
                if (marker || Number(existing.n) > 0) {
                    await connection.query('INSERT INTO permission_seed_state (seed_key) VALUES ($1) ON CONFLICT DO NOTHING', [seedKey]);
                    continue;
                }
                await connection.query('INSERT INTO permission_seed_state (seed_key) VALUES ($1) ON CONFLICT DO NOTHING', [seedKey]);
            }
            await connection.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
            const unique = [...new Set(grants.map(([f, a]) => `${f}.${a}`))]
                .filter(key => permissionIdByKey.has(key));
            if (!unique.length)
                continue;
            const values = unique.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(', ');
            const params = unique.flatMap(key => [roleId, permissionIdByKey.get(key)]);
            await connection.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, params);
        }
        // Approved spreadsheet matrix v2: one-time replacement of built-in
        // role grants (the old matrix is obsolete). Each role is applied once
        // via a versioned seed marker; later UI saves are never touched.
        // Super Admin is excluded here because it is always rebuilt in full above.
        const v2Template = loadDefaultTemplate();
        for (const [roleKey, keys] of Object.entries(v2Template)) {
            if (roleKey === 'super_admin')
                continue;
            const roleId = roleIdByKey.get(roleKey);
            if (!roleId)
                continue;
            const seedKey = `rbac:v3:${roleKey}`;
            const { rows: [v2marker] } = await connection.query('SELECT seed_key FROM permission_seed_state WHERE seed_key = $1', [seedKey]);
            if (v2marker)
                continue;
            await connection.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
            const unique = [...new Set(keys)].filter((key) => permissionIdByKey.has(key));
            if (unique.length) {
                const values = unique.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(', ');
                const params = unique.flatMap(key => [roleId, permissionIdByKey.get(key)]);
                await connection.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, params);
            }
            await connection.query('INSERT INTO permission_seed_state (seed_key) VALUES ($1) ON CONFLICT DO NOTHING', [seedKey]);
        }
        console.log('RBAC v2 spreadsheet matrix reseeding checked');
        // Temp View assignment columns on users (approved document + extra hours).
        await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_view_document_id VARCHAR(255)');
        await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_view_extra_hours SMALLINT');
        await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_view_expires_at TIMESTAMP');
        // Approved out-of-the-box default snapshot from
        // rbac-default-template.json. Replaced whenever the file template
        // changes (old matrices are obsolete); never written by UI saves.
        await connection.query(`
      CREATE TABLE IF NOT EXISTS rbac_default_permissions (
        role_key VARCHAR(80) NOT NULL,
        permission_key VARCHAR(160) NOT NULL,
        PRIMARY KEY (role_key, permission_key)
      )
    `);
        // Trial/permanent save history for the RBAC matrix.
        await connection.query(`
      CREATE TABLE IF NOT EXISTS rbac_matrix_saves (
        id SERIAL PRIMARY KEY,
        save_mode VARCHAR(20) NOT NULL DEFAULT 'permanent',
        expires_at TIMESTAMP NULL,
        created_by INTEGER NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
        const { rows: existingDefaults } = await connection.query('SELECT role_key, permission_key FROM rbac_default_permissions');
        const template = loadDefaultTemplate();
        const sameDefaults = existingDefaults.length ===
            Object.values(template).reduce((sum, keys) => sum + keys.length, 0) &&
            existingDefaults.every(row => (template[row.role_key] || []).includes(row.permission_key));
        if (!sameDefaults) {
            await connection.query('DELETE FROM rbac_default_permissions');
            const values = [];
            const params = [];
            for (const [roleKey, keys] of Object.entries(template)) {
                for (const key of keys) {
                    values.push(`($${params.length + 1}, $${params.length + 2})`);
                    params.push(roleKey, key);
                }
            }
            if (values.length) {
                await connection.query(`INSERT INTO rbac_default_permissions (role_key, permission_key) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`, params);
            }
            console.log('RBAC default template replaced: rbac_default_permissions now matches the approved spreadsheet');
        }
        else {
            console.log('RBAC default template already current');
        }
        // Backfill user_roles from the legacy users.role value. Never removes rows.
        for (const [legacyRole, roleKey] of Object.entries(rbacCore_1.LEGACY_ROLE_TO_RBAC_KEY)) {
            const roleId = roleIdByKey.get(roleKey);
            if (!roleId)
                continue;
            await connection.query(`INSERT INTO user_roles (user_id, role_id, expires_at)
         SELECT id, $1, access_expires_at FROM users WHERE role = $2
         ON CONFLICT DO NOTHING`, [roleId, legacyRole]);
        }
        console.log('RBAC migration completed: roles, permissions, role_permissions, user_roles ready');
    }
    finally {
        // No checkout was taken; nothing to release.
    }
}
