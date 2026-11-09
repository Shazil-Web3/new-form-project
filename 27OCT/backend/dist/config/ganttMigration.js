"use strict";
/**
 * Gantt / Calendar Schema Migration
 * Idempotent: adds scheduling columns to `tasks` and a `task_dependencies` link table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGanttMigration = runGanttMigration;
async function runGanttMigration(pool) {
    try {
        const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks'");
        if (tables.length === 0) {
            console.log('ℹ️ tasks table does not exist yet. Skipping Gantt migration.');
            return;
        }
        const { rows: columns } = await pool.query('SELECT column_name AS "Field" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = \'tasks\'');
        const existing = new Set(columns.map((c) => c.Field));
        if (!existing.has('start_date')) {
            await pool.query('ALTER TABLE "tasks" ADD COLUMN "start_date" date NULL');
            console.log('✅ Added tasks.start_date column');
        }
        if (!existing.has('progress')) {
            await pool.query('ALTER TABLE "tasks" ADD COLUMN "progress" SMALLINT NOT NULL DEFAULT 0');
            console.log('✅ Added tasks.progress column');
        }
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "task_dependencies" (
        "id" SERIAL PRIMARY KEY,
        "task_id" INTEGER NOT NULL,
        "depends_on_task_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("task_id", "depends_on_task_id"),
        CONSTRAINT "fk_task_dep_task" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_dep_parent" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE
      )
    `);
        await pool.query('CREATE INDEX IF NOT EXISTS "idx_task_dep_depends_on" ON "task_dependencies" ("depends_on_task_id")');
        // Lightweight "Project" grouping for the Gantt/Calendar page only — unrelated to the
        // Documents/Training "project" concepts elsewhere, and not surfaced in My Tasks.
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "gantt_projects" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "title" VARCHAR(150) NOT NULL,
        "description" TEXT NULL,
        "owner_id" INTEGER NULL,
        "start_date" DATE NULL,
        "end_date" DATE NULL,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_gantt_projects_org" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_gantt_projects_owner" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_gantt_projects_creator" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
        await pool.query('CREATE INDEX IF NOT EXISTS "idx_gantt_projects_org" ON "gantt_projects" ("organization_id")');
        if (!existing.has('gantt_project_id')) {
            await pool.query('ALTER TABLE "tasks" ADD COLUMN "gantt_project_id" INTEGER NULL');
            try {
                await pool.query('ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_gantt_project" FOREIGN KEY ("gantt_project_id") REFERENCES "gantt_projects" ("id") ON DELETE SET NULL');
            }
            catch (_) {
                // Constraint may already exist
            }
            console.log('✅ Added tasks.gantt_project_id column');
        }
        if (!existing.has('parent_task_id')) {
            await pool.query('ALTER TABLE "tasks" ADD COLUMN "parent_task_id" INTEGER NULL');
            try {
                await pool.query('ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_parent_task" FOREIGN KEY ("parent_task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL');
            }
            catch (_) {
                // Constraint may already exist
            }
            console.log('✅ Added tasks.parent_task_id column');
        }
    }
    catch (err) {
        console.error('❌ Gantt migration failed:', err.message);
    }
}
