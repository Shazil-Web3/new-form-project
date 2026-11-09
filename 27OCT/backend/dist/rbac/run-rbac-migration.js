"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Standalone runner: node src/rbac/run-rbac-migration.js  (from backend/)
// Uses the same DB credentials as the server (backend/.env).
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const db_1 = __importDefault(require("../config/db"));
const rbacMigration_1 = require("./rbacMigration");
(async () => {
    try {
        await (0, rbacMigration_1.runRbacMigration)(db_1.default);
        const { rows: tables } = await db_1.default.query(`SELECT tablename AS table_name FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('roles', 'permissions', 'role_permissions', 'user_roles')
       ORDER BY tablename`);
        console.log('Tables present:', tables.map(t => t.table_name).join(', '));
        for (const table of ['roles', 'permissions', 'role_permissions', 'user_roles']) {
            const { rows: [row] } = await db_1.default.query(`SELECT COUNT(*) AS n FROM "${table}"`);
            console.log(`${table}: ${row.n} row(s)`);
        }
        await db_1.default.end();
    }
    catch (error) {
        console.error('RBAC migration failed:', error.code || '', error.message);
        process.exit(1);
    }
})();
