/**
 * Numbering System Migration
 * Sets up tables for number sequences (Document, Project, Cost Center)
 * and safely ensures required columns exist on documents table.
 */

async function runNumberingMigration(poolOrConn) {
  const isPool = Boolean(poolOrConn && typeof poolOrConn.getConnection === 'function');
  const connection = isPool ? await poolOrConn.getConnection() : poolOrConn;
  try {
    console.log('🔢 Checking numbering system database tables...');

    // 1. Table: number_sequences
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`number_sequences\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`organization_id\` INT NOT NULL,
        \`type\` ENUM('document', 'project', 'cost_center') NOT NULL,
        \`department_id\` INT UNSIGNED DEFAULT NULL,
        \`prefix\` VARCHAR(20) NOT NULL,
        \`digit_count\` INT NOT NULL DEFAULT 8,
        \`current_number\` INT NOT NULL DEFAULT 0,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_numseq_org\` (\`organization_id\`),
        KEY \`idx_numseq_type\` (\`type\`),
        KEY \`idx_numseq_dept\` (\`department_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('  ✅ Table `number_sequences` verified/created');

    // 2. Table: project_numbers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`project_numbers\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`organization_id\` INT NOT NULL,
        \`project_number\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT DEFAULT NULL,
        \`department\` VARCHAR(255) DEFAULT NULL,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_projnum_org\` (\`organization_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('  ✅ Table `project_numbers` verified/created');

    // Check department column on project_numbers
    const [projCols] = await connection.query('SHOW COLUMNS FROM `project_numbers`');
    const projColNames = new Set(projCols.map(c => c.Field));
    if (!projColNames.has('department')) {
      await connection.query('ALTER TABLE `project_numbers` ADD COLUMN `department` VARCHAR(255) DEFAULT NULL');
      console.log('  ✅ Added `department` column to `project_numbers`');
    }

    // 3. Table: cost_center_numbers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`cost_center_numbers\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`organization_id\` INT NOT NULL,
        \`cost_number\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`department\` VARCHAR(255) DEFAULT NULL,
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_costnum_org\` (\`organization_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('  ✅ Table `cost_center_numbers` verified/created');

    // 4. Ensure columns on documents table
    const [docCols] = await connection.query('SHOW COLUMNS FROM `documents`');
    const existingCols = new Set(docCols.map(c => c.Field));

    if (!existingCols.has('document_number')) {
      await connection.query('ALTER TABLE `documents` ADD COLUMN `document_number` VARCHAR(50) DEFAULT NULL');
      console.log('  ✅ Added `document_number` column to `documents`');
    }
    if (!existingCols.has('project_number')) {
      await connection.query('ALTER TABLE `documents` ADD COLUMN `project_number` VARCHAR(50) DEFAULT NULL');
      console.log('  ✅ Added `project_number` column to `documents`');
    }
    if (!existingCols.has('cost_center_number')) {
      await connection.query('ALTER TABLE `documents` ADD COLUMN `cost_center_number` VARCHAR(50) DEFAULT NULL');
      console.log('  ✅ Added `cost_center_number` column to `documents`');
    }
    if (!existingCols.has('department')) {
      await connection.query('ALTER TABLE `documents` ADD COLUMN `department` VARCHAR(255) DEFAULT NULL');
      console.log('  ✅ Added `department` column to `documents`');
    }

    // Add index on document_number for fast lookups if not exists
    const [indexes] = await connection.query('SHOW INDEX FROM `documents` WHERE Key_name = "idx_documents_doc_number"');
    if (indexes.length === 0) {
      await connection.query('ALTER TABLE `documents` ADD INDEX `idx_documents_doc_number` (`document_number`)');
      console.log('  ✅ Added index `idx_documents_doc_number` on `documents`');
    }

    console.log('✅ Numbering system migration completed successfully');
  } catch (err) {
    console.error('❌ Notice during numbering migration:', err.message);
  } finally {
    if (isPool && connection) connection.release();
  }
}

module.exports = { runNumberingMigration };
