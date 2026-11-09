/**
 * Training / LMS Module Migration
 * Idempotent: adds `users.reports_to_id` plus the lms_* tables used by the
 * Training module (Administrator / Manager / Employee views).
 * Purely additive — no existing table, column or enum value is changed.
 */

async function tableExists(pool: any, table: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [table]
  );
  return rows.length > 0;
}

async function getColumnFields(pool: any, table: string): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT column_name AS "Field", data_type AS "Type" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1',
    [table]
  );
  return rows;
}

export async function runLmsMigration(pool: any) {
  try {
    if (!(await tableExists(pool, 'users'))) {
      console.log('ℹ️ users table does not exist yet. Skipping LMS migration.');
      return;
    }

    const userColumns = await getColumnFields(pool, 'users');
    const existingUserColumns = new Set(userColumns.map((c) => c.Field));

    if (!existingUserColumns.has('reports_to_id')) {
      await pool.query('ALTER TABLE "users" ADD COLUMN "reports_to_id" INTEGER NULL');
      try {
        await pool.query(
          'ALTER TABLE "users" ADD CONSTRAINT "fk_users_reports_to" FOREIGN KEY ("reports_to_id") REFERENCES "users" ("id") ON DELETE SET NULL'
        );
      } catch (_) {
        // Constraint may already exist
      }
      console.log('✅ Added users.reports_to_id column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_field_specialties" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "name" VARCHAR(150) NOT NULL,
        "description" TEXT NULL,
        "code" VARCHAR(20) NULL,
        "revision" INTEGER NOT NULL DEFAULT 1,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_lms_fs_org" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_fs_creator" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_fs_org" ON "lms_field_specialties" ("organization_id")');

    const specialtyColumns = await getColumnFields(pool, 'lms_field_specialties');
    if (!specialtyColumns.some((c) => c.Field === 'code')) {
      await pool.query('ALTER TABLE "lms_field_specialties" ADD COLUMN "code" VARCHAR(20) NULL');
      console.log('✅ Added lms_field_specialties.code column');
    }
    if (!specialtyColumns.some((c) => c.Field === 'revision')) {
      await pool.query('ALTER TABLE "lms_field_specialties" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1');
      console.log('✅ Added lms_field_specialties.revision column');
    }

    // A generic "numbering rule" engine — one row per (organization, entity_type) — so any
    // future entity (not just Field Specialty) can get auto-generated PREFIX-000001 codes
    // the same way the Document Admin's numbering tab does.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_numbering_rules" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "entity_type" VARCHAR(40) NOT NULL,
        "prefix" VARCHAR(4) NOT NULL,
        "digit_length" SMALLINT NOT NULL DEFAULT 8,
        "current_counter" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("organization_id", "entity_type"),
        CONSTRAINT "fk_lms_nr_org" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_curricula" (
        "id" SERIAL PRIMARY KEY,
        "field_specialty_id" INTEGER NOT NULL,
        "name" VARCHAR(150) NOT NULL,
        "description" TEXT NULL,
        "type" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_lms_cu_fs" FOREIGN KEY ("field_specialty_id") REFERENCES "lms_field_specialties" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_cu_fs" ON "lms_curricula" ("field_specialty_id")');

    const curriculumColumns = await getColumnFields(pool, 'lms_curricula');
    if (!curriculumColumns.some((c) => c.Field === 'code')) {
      await pool.query('ALTER TABLE "lms_curricula" ADD COLUMN "code" VARCHAR(20) NULL');
      console.log('✅ Added lms_curricula.code column');
    }
    if (!curriculumColumns.some((c) => c.Field === 'revision')) {
      await pool.query('ALTER TABLE "lms_curricula" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1');
      console.log('✅ Added lms_curricula.revision column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_classes" (
        "id" SERIAL PRIMARY KEY,
        "curriculum_id" INTEGER NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "description" TEXT NULL,
        "content_type" TEXT NOT NULL,
        "retraining_interval_months" SMALLINT NULL,
        "content_url" VARCHAR(500) NULL,
        "content_name" VARCHAR(255) NULL,
        "live_class_date" TIMESTAMP NULL,
        "live_class_link" VARCHAR(500) NULL,
        "duration_minutes" INTEGER NOT NULL DEFAULT 0,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "has_quiz" BOOLEAN NOT NULL DEFAULT FALSE,
        "prerequisite_class_id" INTEGER NULL,
        "certificate_validity_months" SMALLINT NULL,
        "document_id" VARCHAR(255) NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_lms_cl_curriculum" FOREIGN KEY ("curriculum_id") REFERENCES "lms_curricula" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_cl_prerequisite" FOREIGN KEY ("prerequisite_class_id") REFERENCES "lms_classes" ("id") ON DELETE SET NULL
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_cl_curriculum" ON "lms_classes" ("curriculum_id")');

    const classColumns = await getColumnFields(pool, 'lms_classes');
    if (!classColumns.some((c) => c.Field === 'prerequisite_class_id')) {
      await pool.query('ALTER TABLE "lms_classes" ADD COLUMN "prerequisite_class_id" INTEGER NULL');
      try {
        await pool.query(
          'ALTER TABLE "lms_classes" ADD CONSTRAINT "fk_lms_cl_prerequisite" FOREIGN KEY ("prerequisite_class_id") REFERENCES "lms_classes" ("id") ON DELETE SET NULL'
        );
      } catch (_) {
        // Constraint may already exist
      }
      console.log('✅ Added lms_classes.prerequisite_class_id column');
    }
    if (!classColumns.some((c) => c.Field === 'certificate_validity_months')) {
      await pool.query('ALTER TABLE "lms_classes" ADD COLUMN "certificate_validity_months" SMALLINT NULL');
      console.log('✅ Added lms_classes.certificate_validity_months column');
    }
    const contentTypeColumn = classColumns.find((c) => c.Field === 'content_type') || null;
    if (contentTypeColumn && contentTypeColumn.Type !== 'text' && contentTypeColumn.Type !== 'character varying') {
      await pool.query('ALTER TABLE "lms_classes" ALTER COLUMN "content_type" TYPE TEXT');
      console.log('✅ Converted lms_classes.content_type to TEXT (covers pdf/video/live/document)');
    }
    if (!classColumns.some((c) => c.Field === 'retraining_interval_months')) {
      await pool.query('ALTER TABLE "lms_classes" ADD COLUMN "retraining_interval_months" SMALLINT NULL');
      console.log('✅ Added lms_classes.retraining_interval_months column');
    }

    // A class can point at a Documents-module Document (read-only) instead of an uploaded
    // file — resolved to that document's latest PUBLISHED revision at read time, never
    // touching the Documents module's own publish/workflow tables or routes.
    const documentsTables = await tableExists(pool, 'documents');
    if (documentsTables && !classColumns.some((c) => c.Field === 'document_id')) {
      await pool.query('ALTER TABLE "lms_classes" ADD COLUMN "document_id" VARCHAR(255) NULL');
      try {
        await pool.query(
          'ALTER TABLE "lms_classes" ADD CONSTRAINT "fk_lms_cl_document" FOREIGN KEY ("document_id") REFERENCES "documents" ("document_id") ON DELETE SET NULL'
        );
      } catch (_) {
        // Constraint may already exist
      }
      console.log('✅ Added lms_classes.document_id column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_quizzes" (
        "id" SERIAL PRIMARY KEY,
        "class_id" INTEGER NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "passing_score" SMALLINT NOT NULL DEFAULT 80,
        "questions_per_attempt" SMALLINT NULL,
        "max_attempts" SMALLINT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("class_id"),
        CONSTRAINT "fk_lms_qz_class" FOREIGN KEY ("class_id") REFERENCES "lms_classes" ("id") ON DELETE CASCADE
      )
    `);

    const quizColumns = await getColumnFields(pool, 'lms_quizzes');
    if (!quizColumns.some((c) => c.Field === 'questions_per_attempt')) {
      await pool.query('ALTER TABLE "lms_quizzes" ADD COLUMN "questions_per_attempt" SMALLINT NULL');
      console.log('✅ Added lms_quizzes.questions_per_attempt column');
    }
    if (!quizColumns.some((c) => c.Field === 'max_attempts')) {
      await pool.query('ALTER TABLE "lms_quizzes" ADD COLUMN "max_attempts" SMALLINT NULL');
      console.log('✅ Added lms_quizzes.max_attempts column');
    }
    // New quizzes default to 80%; existing quizzes keep the passing score they were saved with.
    await pool.query('ALTER TABLE "lms_quizzes" ALTER COLUMN "passing_score" SET DEFAULT 80');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_quiz_questions" (
        "id" SERIAL PRIMARY KEY,
        "quiz_id" INTEGER NOT NULL,
        "question_type" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "options" JSON NULL,
        "correct_index" INTEGER NULL,
        "acceptable_answers" JSON NULL,
        "match_pairs" JSON NULL,
        "time_limit_seconds" SMALLINT NULL,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "fk_lms_qq_quiz" FOREIGN KEY ("quiz_id") REFERENCES "lms_quizzes" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_qq_quiz" ON "lms_quiz_questions" ("quiz_id")');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_certificates" (
        "id" SERIAL PRIMARY KEY,
        "employee_id" INTEGER NOT NULL,
        "class_id" INTEGER NOT NULL,
        "validation_id" VARCHAR(36) NOT NULL,
        "issued_date" DATE NOT NULL,
        "expiry_date" DATE NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("employee_id", "class_id"),
        UNIQUE ("validation_id"),
        CONSTRAINT "fk_lms_cert_employee" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_cert_class" FOREIGN KEY ("class_id") REFERENCES "lms_classes" ("id") ON DELETE CASCADE
      )
    `);

    const questionColumns = await getColumnFields(pool, 'lms_quiz_questions');
    if (!questionColumns.some((c) => c.Field === 'time_limit_seconds')) {
      await pool.query('ALTER TABLE "lms_quiz_questions" ADD COLUMN "time_limit_seconds" SMALLINT NULL');
      console.log('✅ Added lms_quiz_questions.time_limit_seconds column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_quiz_attempts" (
        "id" SERIAL PRIMARY KEY,
        "employee_id" INTEGER NOT NULL,
        "quiz_id" INTEGER NOT NULL,
        "class_id" INTEGER NOT NULL,
        "score" SMALLINT NOT NULL,
        "passed" BOOLEAN NOT NULL,
        "answers" JSON NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_lms_qa_employee" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_qa_quiz" FOREIGN KEY ("quiz_id") REFERENCES "lms_quizzes" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_qa_class" FOREIGN KEY ("class_id") REFERENCES "lms_classes" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_qa_employee" ON "lms_quiz_attempts" ("employee_id")');
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_qa_quiz" ON "lms_quiz_attempts" ("quiz_id")');
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_qa_class" ON "lms_quiz_attempts" ("class_id")');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_assignments" (
        "id" SERIAL PRIMARY KEY,
        "employee_id" INTEGER NOT NULL,
        "manager_id" INTEGER NULL,
        "curriculum_id" INTEGER NOT NULL,
        "assignment_type" TEXT NOT NULL,
        "assigned_by_id" INTEGER NOT NULL,
        "due_date" DATE NOT NULL,
        "extensions_used" SMALLINT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("employee_id", "curriculum_id"),
        CONSTRAINT "fk_lms_as_employee" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_as_manager" FOREIGN KEY ("manager_id") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_lms_as_curriculum" FOREIGN KEY ("curriculum_id") REFERENCES "lms_curricula" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_as_assigned_by" FOREIGN KEY ("assigned_by_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_as_manager" ON "lms_assignments" ("manager_id")');
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_as_curriculum" ON "lms_assignments" ("curriculum_id")');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_class_progress" (
        "id" SERIAL PRIMARY KEY,
        "employee_id" INTEGER NOT NULL,
        "class_id" INTEGER NOT NULL,
        "curriculum_id" INTEGER NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'not_started',
        "progress_percent" SMALLINT NOT NULL DEFAULT 0,
        "completed_date" DATE NULL,
        "quiz_score" SMALLINT NULL,
        "quiz_passed" BOOLEAN NOT NULL DEFAULT FALSE,
        "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("employee_id", "class_id"),
        CONSTRAINT "fk_lms_cp_employee" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_cp_class" FOREIGN KEY ("class_id") REFERENCES "lms_classes" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_cp_curriculum" FOREIGN KEY ("curriculum_id") REFERENCES "lms_curricula" ("id") ON DELETE CASCADE
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS "idx_lms_cp_curriculum" ON "lms_class_progress" ("curriculum_id")');

    const progressColumns = await getColumnFields(pool, 'lms_class_progress');
    if (!progressColumns.some((c) => c.Field === 'time_spent_seconds')) {
      await pool.query('ALTER TABLE "lms_class_progress" ADD COLUMN "time_spent_seconds" INTEGER NOT NULL DEFAULT 0');
      console.log('✅ Added lms_class_progress.time_spent_seconds column');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "lms_class_ratings" (
        "id" SERIAL PRIMARY KEY,
        "employee_id" INTEGER NOT NULL,
        "class_id" INTEGER NOT NULL,
        "rating" SMALLINT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("employee_id", "class_id"),
        CONSTRAINT "fk_lms_cr_employee" FOREIGN KEY ("employee_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_lms_cr_class" FOREIGN KEY ("class_id") REFERENCES "lms_classes" ("id") ON DELETE CASCADE
      )
    `);
  } catch (err: any) {
    console.error('❌ LMS migration failed:', err.message);
  }
}
