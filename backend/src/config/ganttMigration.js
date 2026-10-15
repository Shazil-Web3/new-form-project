/**
 * Gantt / Calendar Schema Migration
 * Idempotent: adds scheduling columns to `tasks` and a `task_dependencies` link table.
 */

async function runGanttMigration(pool) {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'tasks'");
    if (tables.length === 0) {
      console.log('ℹ️ tasks table does not exist yet. Skipping Gantt migration.');
      return;
    }

    const [columns] = await pool.query('SHOW COLUMNS FROM `tasks`');
    const existing = new Set(columns.map((c) => c.Field));

    if (!existing.has('start_date')) {
      await pool.query('ALTER TABLE `tasks` ADD COLUMN `start_date` date NULL AFTER `description`');
      console.log('✅ Added tasks.start_date column');
    }

    if (!existing.has('progress')) {
      await pool.query('ALTER TABLE `tasks` ADD COLUMN `progress` tinyint unsigned NOT NULL DEFAULT 0 AFTER `status`');
      console.log('✅ Added tasks.progress column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`task_dependencies\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`task_id\` int NOT NULL,
        \`depends_on_task_id\` int NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_task_dependency\` (\`task_id\`, \`depends_on_task_id\`),
        KEY \`idx_depends_on\` (\`depends_on_task_id\`),
        CONSTRAINT \`fk_task_dep_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_task_dep_parent\` FOREIGN KEY (\`depends_on_task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    // Lightweight "Project" grouping for the Gantt/Calendar page only — unrelated to the
    // Documents/Training "project" concepts elsewhere, and not surfaced in My Tasks.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`gantt_projects\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`organization_id\` int NOT NULL,
        \`title\` varchar(150) NOT NULL,
        \`description\` text NULL,
        \`owner_id\` int NULL,
        \`start_date\` date NULL,
        \`end_date\` date NULL,
        \`created_by\` int NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_gantt_projects_org\` (\`organization_id\`),
        CONSTRAINT \`fk_gantt_projects_org\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_gantt_projects_owner\` FOREIGN KEY (\`owner_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_gantt_projects_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    if (!existing.has('gantt_project_id')) {
      await pool.query(
        'ALTER TABLE `tasks` ADD COLUMN `gantt_project_id` int NULL AFTER `progress`, ' +
        'ADD CONSTRAINT `fk_tasks_gantt_project` FOREIGN KEY (`gantt_project_id`) REFERENCES `gantt_projects` (`id`) ON DELETE SET NULL'
      );
      console.log('✅ Added tasks.gantt_project_id column');
    }

    if (!existing.has('parent_task_id')) {
      await pool.query(
        'ALTER TABLE `tasks` ADD COLUMN `parent_task_id` int NULL AFTER `gantt_project_id`, ' +
        'ADD CONSTRAINT `fk_tasks_parent_task` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL'
      );
      console.log('✅ Added tasks.parent_task_id column');
    }
  } catch (err) {
    console.error('❌ Gantt migration failed:', err.message);
  }
}

module.exports = { runGanttMigration };
