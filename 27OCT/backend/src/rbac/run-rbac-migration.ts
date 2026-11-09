import dotenv from "dotenv";
// Standalone runner: node src/rbac/run-rbac-migration.js  (from backend/)
// Uses the same DB credentials as the server (backend/.env).
import path from "path";
dotenv.config({ path: path.join(__dirname, '../../.env') });
import pool from "../config/db";
import { runRbacMigration } from "./rbacMigration";

(async () => {
  try {
    await runRbacMigration(pool);
    const { rows: tables }: any = await pool.query(
      `SELECT tablename AS table_name FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('roles', 'permissions', 'role_permissions', 'user_roles')
       ORDER BY tablename`
    );
    console.log('Tables present:', tables.map(t => t.table_name).join(', '));
    for (const table of ['roles', 'permissions', 'role_permissions', 'user_roles']) {
      const { rows: [row] }: any = await pool.query(`SELECT COUNT(*) AS n FROM "${table}"`);
      console.log(`${table}: ${row.n} row(s)`);
    }
    await pool.end();
  } catch (error) {
    console.error('RBAC migration failed:', error.code || '', error.message);
    process.exit(1);
  }
})();
