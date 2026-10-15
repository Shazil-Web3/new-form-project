/**
 * Training / LMS Module Migration
 * Idempotent: adds `users.reports_to_id` plus the lms_* tables used by the
 * Training module (Administrator / Manager / Employee views).
 * Purely additive — no existing table, column or enum value is changed.
 */

async function runLmsMigration(pool) {
  try {
    const [userTables] = await pool.query("SHOW TABLES LIKE 'users'");
    if (userTables.length === 0) {
      console.log('ℹ️ users table does not exist yet. Skipping LMS migration.');
      return;
    }

    const [userColumns] = await pool.query('SHOW COLUMNS FROM `users`');
    const existingUserColumns = new Set(userColumns.map((c) => c.Field));

    if (!existingUserColumns.has('reports_to_id')) {
      await pool.query(
        'ALTER TABLE `users` ADD COLUMN `reports_to_id` int NULL AFTER `role`, ' +
        'ADD CONSTRAINT `fk_users_reports_to` FOREIGN KEY (`reports_to_id`) REFERENCES `users` (`id`) ON DELETE SET NULL'
      );
      console.log('✅ Added users.reports_to_id column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_field_specialties\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`organization_id\` int NOT NULL,
        \`name\` varchar(150) NOT NULL,
        \`description\` text NULL,
        \`code\` varchar(20) NULL,
        \`revision\` int unsigned NOT NULL DEFAULT 1,
        \`created_by\` int NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lms_fs_org\` (\`organization_id\`),
        CONSTRAINT \`fk_lms_fs_org\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_fs_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [specialtyColumns] = await pool.query('SHOW COLUMNS FROM `lms_field_specialties`');
    if (!specialtyColumns.some((c) => c.Field === 'code')) {
      await pool.query('ALTER TABLE `lms_field_specialties` ADD COLUMN `code` varchar(20) NULL AFTER `description`');
      console.log('✅ Added lms_field_specialties.code column');
    }
    if (!specialtyColumns.some((c) => c.Field === 'revision')) {
      await pool.query('ALTER TABLE `lms_field_specialties` ADD COLUMN `revision` int unsigned NOT NULL DEFAULT 1 AFTER `code`');
      console.log('✅ Added lms_field_specialties.revision column');
    }

    // A generic "numbering rule" engine — one row per (organization, entity_type) — so any
    // future entity (not just Field Specialty) can get auto-generated PREFIX-000001 codes
    // the same way the Document Admin's numbering tab does.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_numbering_rules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`organization_id\` int NOT NULL,
        \`entity_type\` varchar(40) NOT NULL,
        \`prefix\` varchar(4) NOT NULL,
        \`digit_length\` tinyint unsigned NOT NULL DEFAULT 8,
        \`current_counter\` int unsigned NOT NULL DEFAULT 0,
        \`status\` enum('active','inactive') NOT NULL DEFAULT 'active',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_numbering_rule\` (\`organization_id\`, \`entity_type\`),
        CONSTRAINT \`fk_lms_nr_org\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_curricula\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`field_specialty_id\` int NOT NULL,
        \`name\` varchar(150) NOT NULL,
        \`description\` text NULL,
        \`type\` enum('required','elective') NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lms_cu_fs\` (\`field_specialty_id\`),
        CONSTRAINT \`fk_lms_cu_fs\` FOREIGN KEY (\`field_specialty_id\`) REFERENCES \`lms_field_specialties\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [curriculumColumns] = await pool.query('SHOW COLUMNS FROM `lms_curricula`');
    if (!curriculumColumns.some((c) => c.Field === 'code')) {
      await pool.query('ALTER TABLE `lms_curricula` ADD COLUMN `code` varchar(20) NULL AFTER `description`');
      console.log('✅ Added lms_curricula.code column');
    }
    if (!curriculumColumns.some((c) => c.Field === 'revision')) {
      await pool.query('ALTER TABLE `lms_curricula` ADD COLUMN `revision` int unsigned NOT NULL DEFAULT 1 AFTER `code`');
      console.log('✅ Added lms_curricula.revision column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_classes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`curriculum_id\` int NOT NULL,
        \`title\` varchar(200) NOT NULL,
        \`description\` text NULL,
        \`content_type\` enum('pdf','video','live','document') NOT NULL,
        \`retraining_interval_months\` smallint unsigned NULL,
        \`content_url\` varchar(500) NULL,
        \`content_name\` varchar(255) NULL,
        \`live_class_date\` datetime NULL,
        \`live_class_link\` varchar(500) NULL,
        \`duration_minutes\` int NOT NULL DEFAULT 0,
        \`display_order\` int NOT NULL DEFAULT 0,
        \`has_quiz\` tinyint(1) NOT NULL DEFAULT 0,
        \`prerequisite_class_id\` int NULL,
        \`certificate_validity_months\` smallint unsigned NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lms_cl_curriculum\` (\`curriculum_id\`),
        CONSTRAINT \`fk_lms_cl_curriculum\` FOREIGN KEY (\`curriculum_id\`) REFERENCES \`lms_curricula\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_cl_prerequisite\` FOREIGN KEY (\`prerequisite_class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [classColumns] = await pool.query('SHOW COLUMNS FROM `lms_classes`');
    if (!classColumns.some((c) => c.Field === 'prerequisite_class_id')) {
      await pool.query(
        'ALTER TABLE `lms_classes` ADD COLUMN `prerequisite_class_id` int NULL AFTER `has_quiz`, ' +
        'ADD CONSTRAINT `fk_lms_cl_prerequisite` FOREIGN KEY (`prerequisite_class_id`) REFERENCES `lms_classes` (`id`) ON DELETE SET NULL'
      );
      console.log('✅ Added lms_classes.prerequisite_class_id column');
    }
    if (!classColumns.some((c) => c.Field === 'certificate_validity_months')) {
      await pool.query('ALTER TABLE `lms_classes` ADD COLUMN `certificate_validity_months` smallint unsigned NULL AFTER `prerequisite_class_id`');
      console.log('✅ Added lms_classes.certificate_validity_months column');
    }
    const [[contentTypeColumn]] = await pool.query("SHOW COLUMNS FROM `lms_classes` WHERE Field = 'content_type'");
    if (contentTypeColumn && !contentTypeColumn.Type.includes("'document'")) {
      await pool.query("ALTER TABLE `lms_classes` MODIFY COLUMN `content_type` enum('pdf','video','live','document') NOT NULL");
      console.log('✅ Added "document" to lms_classes.content_type');
    }
    if (!classColumns.some((c) => c.Field === 'retraining_interval_months')) {
      await pool.query('ALTER TABLE `lms_classes` ADD COLUMN `retraining_interval_months` smallint unsigned NULL AFTER `certificate_validity_months`');
      console.log('✅ Added lms_classes.retraining_interval_months column');
    }

    // A class can point at a Documents-module Document (read-only) instead of an uploaded
    // file — resolved to that document's latest PUBLISHED revision at read time, never
    // touching the Documents module's own publish/workflow tables or routes.
    const [documentsTables] = await pool.query("SHOW TABLES LIKE 'documents'");
    if (documentsTables.length > 0 && !classColumns.some((c) => c.Field === 'document_id')) {
      await pool.query(
        'ALTER TABLE `lms_classes` ADD COLUMN `document_id` varchar(255) NULL AFTER `retraining_interval_months`, ' +
        'ADD CONSTRAINT `fk_lms_cl_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL'
      );
      console.log('✅ Added lms_classes.document_id column');
    }
    if (!contentTypeColumn?.Type.includes("'linked_document'")) {
      await pool.query("ALTER TABLE `lms_classes` MODIFY COLUMN `content_type` enum('pdf','video','live','document','linked_document') NOT NULL");
      console.log('✅ Added "linked_document" to lms_classes.content_type');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_quizzes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`class_id\` int NOT NULL,
        \`title\` varchar(200) NOT NULL,
        \`passing_score\` tinyint unsigned NOT NULL DEFAULT 80,
        \`questions_per_attempt\` smallint unsigned NULL,
        \`max_attempts\` smallint unsigned NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_quiz_class\` (\`class_id\`),
        CONSTRAINT \`fk_lms_qz_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [quizColumns] = await pool.query('SHOW COLUMNS FROM `lms_quizzes`');
    if (!quizColumns.some((c) => c.Field === 'questions_per_attempt')) {
      await pool.query('ALTER TABLE `lms_quizzes` ADD COLUMN `questions_per_attempt` smallint unsigned NULL AFTER `passing_score`');
      console.log('✅ Added lms_quizzes.questions_per_attempt column');
    }
    if (!quizColumns.some((c) => c.Field === 'max_attempts')) {
      await pool.query('ALTER TABLE `lms_quizzes` ADD COLUMN `max_attempts` smallint unsigned NULL AFTER `questions_per_attempt`');
      console.log('✅ Added lms_quizzes.max_attempts column');
    }
    // New quizzes default to 80%; existing quizzes keep the passing score they were saved with.
    await pool.query('ALTER TABLE `lms_quizzes` ALTER COLUMN `passing_score` SET DEFAULT 80');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_quiz_questions\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`quiz_id\` int NOT NULL,
        \`question_type\` enum('multiple_choice','true_false','fill_blank','matching') NOT NULL,
        \`question\` text NOT NULL,
        \`options\` json NULL,
        \`correct_index\` int NULL,
        \`acceptable_answers\` json NULL,
        \`match_pairs\` json NULL,
        \`time_limit_seconds\` smallint unsigned NULL,
        \`display_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lms_qq_quiz\` (\`quiz_id\`),
        CONSTRAINT \`fk_lms_qq_quiz\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`lms_quizzes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_certificates\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`employee_id\` int NOT NULL,
        \`class_id\` int NOT NULL,
        \`validation_id\` varchar(36) NOT NULL,
        \`issued_date\` date NOT NULL,
        \`expiry_date\` date NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_certificate\` (\`employee_id\`, \`class_id\`),
        UNIQUE KEY \`uq_lms_certificate_validation\` (\`validation_id\`),
        CONSTRAINT \`fk_lms_cert_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_cert_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [questionColumns] = await pool.query('SHOW COLUMNS FROM `lms_quiz_questions`');
    if (!questionColumns.some((c) => c.Field === 'time_limit_seconds')) {
      await pool.query('ALTER TABLE `lms_quiz_questions` ADD COLUMN `time_limit_seconds` smallint unsigned NULL AFTER `match_pairs`');
      console.log('✅ Added lms_quiz_questions.time_limit_seconds column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_quiz_attempts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`employee_id\` int NOT NULL,
        \`quiz_id\` int NOT NULL,
        \`class_id\` int NOT NULL,
        \`score\` tinyint unsigned NOT NULL,
        \`passed\` tinyint(1) NOT NULL,
        \`answers\` json NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_lms_qa_employee\` (\`employee_id\`),
        KEY \`idx_lms_qa_quiz\` (\`quiz_id\`),
        KEY \`idx_lms_qa_class\` (\`class_id\`),
        CONSTRAINT \`fk_lms_qa_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_qa_quiz\` FOREIGN KEY (\`quiz_id\`) REFERENCES \`lms_quizzes\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_qa_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_assignments\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`employee_id\` int NOT NULL,
        \`manager_id\` int NULL,
        \`curriculum_id\` int NOT NULL,
        \`assignment_type\` enum('required','elective') NOT NULL,
        \`assigned_by_id\` int NOT NULL,
        \`due_date\` date NOT NULL,
        \`extensions_used\` tinyint unsigned NOT NULL DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_assignment\` (\`employee_id\`, \`curriculum_id\`),
        KEY \`idx_lms_as_manager\` (\`manager_id\`),
        KEY \`idx_lms_as_curriculum\` (\`curriculum_id\`),
        CONSTRAINT \`fk_lms_as_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_as_manager\` FOREIGN KEY (\`manager_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_lms_as_curriculum\` FOREIGN KEY (\`curriculum_id\`) REFERENCES \`lms_curricula\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_as_assigned_by\` FOREIGN KEY (\`assigned_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_class_progress\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`employee_id\` int NOT NULL,
        \`class_id\` int NOT NULL,
        \`curriculum_id\` int NOT NULL,
        \`status\` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
        \`progress_percent\` tinyint unsigned NOT NULL DEFAULT 0,
        \`completed_date\` date NULL,
        \`quiz_score\` tinyint unsigned NULL,
        \`quiz_passed\` tinyint(1) NOT NULL DEFAULT 0,
        \`time_spent_seconds\` int unsigned NOT NULL DEFAULT 0,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_progress\` (\`employee_id\`, \`class_id\`),
        KEY \`idx_lms_cp_curriculum\` (\`curriculum_id\`),
        CONSTRAINT \`fk_lms_cp_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_cp_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_cp_curriculum\` FOREIGN KEY (\`curriculum_id\`) REFERENCES \`lms_curricula\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    const [progressColumns] = await pool.query('SHOW COLUMNS FROM `lms_class_progress`');
    if (!progressColumns.some((c) => c.Field === 'time_spent_seconds')) {
      await pool.query('ALTER TABLE `lms_class_progress` ADD COLUMN `time_spent_seconds` int unsigned NOT NULL DEFAULT 0 AFTER `quiz_passed`');
      console.log('✅ Added lms_class_progress.time_spent_seconds column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`lms_class_ratings\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`employee_id\` int NOT NULL,
        \`class_id\` int NOT NULL,
        \`rating\` tinyint unsigned NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_lms_rating\` (\`employee_id\`, \`class_id\`),
        CONSTRAINT \`fk_lms_cr_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_lms_cr_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`lms_classes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  } catch (err) {
    console.error('❌ LMS migration failed:', err.message);
  }
}

module.exports = { runLmsMigration };
