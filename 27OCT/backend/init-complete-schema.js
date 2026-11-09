/**
 * Complete PostgreSQL Schema Initialization
 * Creates all tables in dependency order from MySQL schema
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const allTablesSql = [
  // PHASE 0-1: FOUNDATIONAL TABLES
  `CREATE TABLE IF NOT EXISTS "organizations" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "logo" TEXT,
    "status" TEXT DEFAULT 'active'
  )`,

  `CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255),
    "phone" VARCHAR(20),
    "site" VARCHAR(255),
    "role" VARCHAR(100),
    "avatar" TEXT,
    "template_approver" TEXT DEFAULT 'no',
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "last_login" TIMESTAMP,
    "status" TEXT DEFAULT 'active',
    "is_admin" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("email")
  )`,

  `CREATE TABLE IF NOT EXISTS "sites" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "departments" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "name" VARCHAR(255),
    "manager" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'active'
  )`,

  `CREATE TABLE IF NOT EXISTS "invited_users" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "email" VARCHAR(255) NOT NULL,
    "invited_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "token" VARCHAR(255),
    "status" TEXT DEFAULT 'pending',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "expires_at" TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL,
    "token_hash" VARCHAR(64),
    "access_expires_at" TIMESTAMP,
    "expires_at" TIMESTAMP NOT NULL,
    "revoked_at" TIMESTAMP,
    "replaced_by_hash" VARCHAR(64),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 2: CONTENT TABLES
  `CREATE TABLE IF NOT EXISTS "templates" (
    "template_id" VARCHAR(255) PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "structured_data" TEXT,
    "elements" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "status" TEXT DEFAULT 'draft',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "ai_change_summary" TEXT,
    "notes" TEXT,
    "impact" TEXT,
    "template_approvers" TEXT,
    "comments" TEXT,
    "custom_document_approvers" TEXT,
    "progress_value" INTEGER DEFAULT 0,
    "revision_parent_id" VARCHAR(255),
    "template_structure" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "documents" (
    "document_id" VARCHAR(255) PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "template_id" VARCHAR(255) REFERENCES "templates" ("template_id") ON DELETE SET NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "structured_data" TEXT,
    "elements" TEXT,
    "current_revision" DECIMAL(3,1) DEFAULT 1.0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "folder_id" INTEGER,
    "approvers" TEXT,
    "impact" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'draft',
    "revision_parent_id" VARCHAR(255),
    "cover_page_data" TEXT,
    "required_approvers" TEXT,
    "notes" TEXT,
    "progress_value" INTEGER DEFAULT 0,
    "document_number" VARCHAR(255),
    "project_number" VARCHAR(255),
    "cost_center_number" VARCHAR(255),
    "department" VARCHAR(255)
  )`,

  `CREATE TABLE IF NOT EXISTS "document_references" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "referenced_document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "documentrevisions" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "revision_number" DECIMAL(3,1) NOT NULL,
    "content" TEXT,
    "elements" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "status" VARCHAR(50)
  )`,

  `CREATE TABLE IF NOT EXISTS "documentpermissions" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "permission_type" TEXT NOT NULL,
    "assigned_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'active',
    UNIQUE ("document_id", "user_id")
  )`,

  // PHASE 3: WORKFLOW
  `CREATE TABLE IF NOT EXISTS "reviewstages" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "stage_number" INTEGER,
    "stage_name" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "reviewassignments" (
    "id" SERIAL PRIMARY KEY,
    "review_stage_id" INTEGER NOT NULL REFERENCES "reviewstages" ("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "status" TEXT DEFAULT 'pending',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "document_related" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "related_document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "relationship_type" VARCHAR(50),
    "created_by" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 4: AUXILIARY
  `CREATE TABLE IF NOT EXISTS "accessrequests" (
    "id" SERIAL PRIMARY KEY,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
    "requested_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "requested_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'pending',
    "resolved_by" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "resolved_at" TIMESTAMP,
    "requested_permission_type" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "attachments" (
    "id" SERIAL PRIMARY KEY,
    "association_type" TEXT NOT NULL,
    "association_id" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER DEFAULT 0,
    "uploaded_by" INTEGER,
    "uploaded_at" TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "editor_references" (
    "id" SERIAL PRIMARY KEY,
    "association_type" VARCHAR(50) NOT NULL,
    "association_id" VARCHAR(255) NOT NULL,
    "ref_index" INTEGER NOT NULL,
    "ref_text" TEXT NOT NULL,
    "ref_anchor" VARCHAR(100) NOT NULL,
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 5: TASKS
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "document_id" VARCHAR(255) REFERENCES "documents" ("document_id") ON DELETE SET NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" TEXT DEFAULT 'pending',
    "priority" VARCHAR(50),
    "due_date" TIMESTAMP,
    "completed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "task_comments" (
    "id" SERIAL PRIMARY KEY,
    "task_id" INTEGER NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "message" TEXT NOT NULL,
    "parent_id" INTEGER REFERENCES "task_comments" ("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "task_dependencies" (
    "id" SERIAL PRIMARY KEY,
    "task_id" INTEGER NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
    "depends_on_task_id" INTEGER NOT NULL REFERENCES "tasks" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 6: EVENTS & NOTES
  `CREATE TABLE IF NOT EXISTS "events" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP NOT NULL,
    "end_time" TIMESTAMP NOT NULL,
    "created_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'scheduled'
  )`,

  `CREATE TABLE IF NOT EXISTS "eventparticipants" (
    "id" SERIAL PRIMARY KEY,
    "event_id" INTEGER NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "status" TEXT DEFAULT 'invited'
  )`,

  `CREATE TABLE IF NOT EXISTS "eventdocuments" (
    "id" SERIAL PRIMARY KEY,
    "event_id" INTEGER NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
    "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "notes" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "document_id" VARCHAR(255) REFERENCES "documents" ("document_id") ON DELETE SET NULL,
    "template_id" VARCHAR(255) REFERENCES "templates" ("template_id") ON DELETE SET NULL,
    "content" TEXT NOT NULL,
    "is_private" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "noterecipients" (
    "id" SERIAL PRIMARY KEY,
    "note_id" INTEGER NOT NULL REFERENCES "notes" ("id") ON DELETE CASCADE,
    "recipient_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "read_at" TIMESTAMP,
    "status" TEXT DEFAULT 'delivered'
  )`,

  // PHASE 7: GANTT
  `CREATE TABLE IF NOT EXISTS "gantt_projects" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "owner_id" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "created_by" INTEGER REFERENCES "users" ("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 8: NUMBERING
  `CREATE TABLE IF NOT EXISTS "number_sequences" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "sequence_type" VARCHAR(50) NOT NULL,
    "current_number" INTEGER DEFAULT 0,
    "prefix" VARCHAR(50),
    "suffix" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "project_numbers" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "project_code" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(255),
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "cost_center_numbers" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "cost_center_code" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(255),
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 9: AUDIT
  `CREATE TABLE IF NOT EXISTS "audittrail" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE RESTRICT,
    "user_id" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "user_email" VARCHAR(255),
    "user_name" VARCHAR(255),
    "action_type" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) DEFAULT 'document',
    "resource_id" VARCHAR(255),
    "document_id" VARCHAR(255) REFERENCES "documents" ("document_id") ON DELETE SET NULL,
    "details" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "status" TEXT DEFAULT 'success'
  )`,

  // PHASE 10: RBAC
  `CREATE TABLE IF NOT EXISTS "roles" (
    "id" SERIAL PRIMARY KEY,
    "role_key" VARCHAR(80) NOT NULL UNIQUE,
    "display_name" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "permissions" (
    "id" SERIAL PRIMARY KEY,
    "permission_key" VARCHAR(160) NOT NULL UNIQUE,
    "display_name" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "role_permissions" (
    "role_id" INTEGER NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
    "permission_id" INTEGER NOT NULL REFERENCES "permissions" ("id") ON DELETE CASCADE,
    PRIMARY KEY ("role_id", "permission_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "role_id" INTEGER NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
    UNIQUE ("user_id", "role_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "permission_seed_state" (
    "seed_key" VARCHAR(120) PRIMARY KEY,
    "seeded_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "rbac_default_permissions" (
    "id" SERIAL PRIMARY KEY,
    "role_key" VARCHAR(80) NOT NULL,
    "permission_key" VARCHAR(160) NOT NULL,
    UNIQUE ("role_key", "permission_key")
  )`,

  `CREATE TABLE IF NOT EXISTS "rbac_matrix_saves" (
    "id" SERIAL PRIMARY KEY,
    "save_mode" VARCHAR(20) DEFAULT 'permanent',
    "role_key" VARCHAR(80) NOT NULL,
    "permission_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 12: LMS/TRAINING
  `CREATE TABLE IF NOT EXISTS "lms_field_specialties" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "specialty_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "status" TEXT DEFAULT 'active'
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_numbering_rules" (
    "id" SERIAL PRIMARY KEY,
    "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "rule_name" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_curricula" (
    "id" SERIAL PRIMARY KEY,
    "field_specialty_id" INTEGER NOT NULL REFERENCES "lms_field_specialties" ("id") ON DELETE CASCADE,
    "curriculum_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_classes" (
    "id" SERIAL PRIMARY KEY,
    "curriculum_id" INTEGER NOT NULL REFERENCES "lms_curricula" ("id") ON DELETE CASCADE,
    "class_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "prerequisite_class_id" INTEGER REFERENCES "lms_classes" ("id") ON DELETE SET NULL,
    "document_id" VARCHAR(255) REFERENCES "documents" ("document_id") ON DELETE SET NULL,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_quizzes" (
    "id" SERIAL PRIMARY KEY,
    "class_id" INTEGER NOT NULL REFERENCES "lms_classes" ("id") ON DELETE CASCADE,
    "quiz_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "passing_score" INTEGER DEFAULT 70,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_quiz_questions" (
    "id" SERIAL PRIMARY KEY,
    "quiz_id" INTEGER NOT NULL REFERENCES "lms_quizzes" ("id") ON DELETE CASCADE,
    "question_text" TEXT NOT NULL,
    "question_type" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_quiz_attempts" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "quiz_id" INTEGER NOT NULL REFERENCES "lms_quizzes" ("id") ON DELETE CASCADE,
    "class_id" INTEGER REFERENCES "lms_classes" ("id") ON DELETE SET NULL,
    "score" INTEGER,
    "passed" BOOLEAN DEFAULT FALSE,
    "attempted_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_assignments" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "manager_id" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "curriculum_id" INTEGER NOT NULL REFERENCES "lms_curricula" ("id") ON DELETE CASCADE,
    "assigned_by_id" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL,
    "assignment_date" TIMESTAMP DEFAULT NOW(),
    "due_date" TIMESTAMP,
    "status" TEXT DEFAULT 'active'
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_certificates" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "class_id" INTEGER NOT NULL REFERENCES "lms_classes" ("id") ON DELETE CASCADE,
    "certificate_date" TIMESTAMP DEFAULT NOW(),
    "issued_by" INTEGER REFERENCES "users" ("id") ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_class_progress" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "class_id" INTEGER NOT NULL REFERENCES "lms_classes" ("id") ON DELETE CASCADE,
    "curriculum_id" INTEGER NOT NULL REFERENCES "lms_curricula" ("id") ON DELETE CASCADE,
    "completion_percentage" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'not_started',
    "started_at" TIMESTAMP,
    "completed_at" TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS "lms_class_ratings" (
    "id" SERIAL PRIMARY KEY,
    "employee_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "class_id" INTEGER NOT NULL REFERENCES "lms_classes" ("id") ON DELETE CASCADE,
    "rating" INTEGER,
    "comments" TEXT,
    "rated_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // PHASE 13: USER PINS
  `CREATE TABLE IF NOT EXISTS "user_pins" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "item_type" VARCHAR(32) NOT NULL,
    "item_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("user_id", "item_type", "item_id")
  )`,

  // ITEM_REFERENCES (already exists but ensure structure)
  `CREATE TABLE IF NOT EXISTS "item_references" (
    "id" SERIAL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW()
  )`
];

// Create indexes
const indexesSql = [
  'CREATE INDEX IF NOT EXISTS "idx_documents_organization" ON "documents" ("organization_id")',
  'CREATE INDEX IF NOT EXISTS "idx_documents_template" ON "documents" ("template_id")',
  'CREATE INDEX IF NOT EXISTS "idx_documents_created_by" ON "documents" ("created_by")',
  'CREATE INDEX IF NOT EXISTS "idx_templates_organization" ON "templates" ("organization_id")',
  'CREATE INDEX IF NOT EXISTS "idx_templates_created_by" ON "templates" ("created_by")',
  'CREATE INDEX IF NOT EXISTS "idx_users_organization" ON "users" ("organization_id")',
  'CREATE INDEX IF NOT EXISTS "idx_tasks_organization" ON "tasks" ("organization_id")',
  'CREATE INDEX IF NOT EXISTS "idx_tasks_user_id" ON "tasks" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_tasks_document_id" ON "tasks" ("document_id")',
  'CREATE INDEX IF NOT EXISTS "idx_documentpermissions_document" ON "documentpermissions" ("document_id")',
  'CREATE INDEX IF NOT EXISTS "idx_documentpermissions_user" ON "documentpermissions" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_audit_trail_user" ON "audittrail" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_audit_trail_document" ON "audittrail" ("document_id")',
  'CREATE INDEX IF NOT EXISTS "idx_audit_org_created" ON "audittrail" ("organization_id", "created_at" DESC)',
  'CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audittrail" ("organization_id", "action_type")',
  'CREATE INDEX IF NOT EXISTS "idx_audit_resource" ON "audittrail" ("resource_type", "resource_id")',
  'CREATE INDEX IF NOT EXISTS "idx_refresh_token_hash" ON "refresh_tokens" ("token_hash")',
  'CREATE INDEX IF NOT EXISTS "idx_attachments_association" ON "attachments" ("association_type", "association_id")',
  'CREATE INDEX IF NOT EXISTS "idx_documents_doc_number" ON "documents" ("document_number")',
  'CREATE INDEX IF NOT EXISTS "idx_task_comments_task_id" ON "task_comments" ("task_id")',
  'CREATE INDEX IF NOT EXISTS "idx_task_comments_user_id" ON "task_comments" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_editor_references_created_by" ON "editor_references" ("created_by")',
  'CREATE INDEX IF NOT EXISTS "idx_notes_user_id" ON "notes" ("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_notes_document_id" ON "notes" ("document_id")',
  'CREATE INDEX IF NOT EXISTS "idx_lms_class_progress_employee" ON "lms_class_progress" ("employee_id")',
  'CREATE INDEX IF NOT EXISTS "idx_lms_class_progress_class" ON "lms_class_progress" ("class_id")'
];

async function initializeSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    console.log('📝 Creating all schema tables...');
    for (let i = 0; i < allTablesSql.length; i++) {
      try {
        await client.query(allTablesSql[i]);
        process.stdout.write('.');
      } catch (err) {
        if (err.message.includes('already exists')) {
          process.stdout.write('•');
        } else {
          console.log(`\n❌ Error on table ${i}: ${err.message}`);
          throw err;
        }
      }
    }
    console.log('\n✅ All tables created successfully!\n');
    
    console.log('📋 Creating indexes...');
    for (const indexSql of indexesSql) {
      try {
        await client.query(indexSql);
        process.stdout.write('.');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.log(`\n⚠ Index warning: ${err.message}`);
        } else {
          process.stdout.write('•');
        }
      }
    }
    console.log('\n✅ Indexes created successfully!\n');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📊 Total tables in database: ${result.rows.length}\n`);
    console.log('✨ Schema initialization complete! Ready to start the server.\n');
    
  } catch (err) {
    console.error('❌ Error initializing schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initializeSchema();
