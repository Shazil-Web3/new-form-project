/**
 * Create Core PostgreSQL Schema
 * Converts MySQL schema from custom_docx.sql to PostgreSQL and creates all tables
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const coreSchemaSql = `
-- Create organizations table (parent table)
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "logo" TEXT,
  "status" TEXT DEFAULT 'active'
);

-- Create users table (parent table)
CREATE TABLE IF NOT EXISTS "users" (
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
  UNIQUE ("email"),
  UNIQUE ("email", "organization_id")
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL,
  "token_hash" VARCHAR(64),
  "expires_at" TIMESTAMP NOT NULL,
  "revoked_at" TIMESTAMP,
  "replaced_by_hash" VARCHAR(64),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS "templates" (
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
);

-- Create documents table
CREATE TABLE IF NOT EXISTS "documents" (
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
  "progress_value" INTEGER DEFAULT 0
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS "tasks" (
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
);

-- Create documentpermissions table
CREATE TABLE IF NOT EXISTS "documentpermissions" (
  "id" SERIAL PRIMARY KEY,
  "document_id" VARCHAR(255) NOT NULL REFERENCES "documents" ("document_id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "permission_type" TEXT NOT NULL,
  "assigned_by" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "status" TEXT DEFAULT 'active',
  UNIQUE ("document_id", "user_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_documents_organization" ON "documents" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_documents_template" ON "documents" ("template_id");
CREATE INDEX IF NOT EXISTS "idx_documents_created_by" ON "documents" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_templates_organization" ON "templates" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_templates_created_by" ON "templates" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_users_organization" ON "users" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_organization" ON "tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_user_id" ON "tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_document_id" ON "tasks" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_documentpermissions_document" ON "documentpermissions" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_documentpermissions_user" ON "documentpermissions" ("user_id");
`;

async function createSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL');
    
    console.log('📝 Creating core schema tables...');
    await client.query(coreSchemaSql);
    
    console.log('✅ Core schema created successfully!');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Created tables:');
    result.rows.forEach(row => console.log('  ✓', row.table_name));
    
  } catch (err) {
    console.error('❌ Error creating schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createSchema();
