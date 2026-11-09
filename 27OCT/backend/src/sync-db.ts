/**
 * Database Sync & Repair Utility
 * Usage: node sync-db.js
 *
 * Safely synchronizes all database schemas, missing columns,
 * indexes, and security constraints with the latest application state.
 * 100% Self-contained with built-in fallbacks.
 * PostgreSQL edition (pg).
 */

import path from "path";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";
import { runAuditTrailMigration } from "./config/auditMigration";
import { runPhase6bMigration } from "./config/phase6bMigration";
import { runNumberingMigration } from "./config/numberingMigration";
import { runDeduplicationMigration } from "./config/deduplicationMigration";
import { cleanStaleWorkflowApprovers } from "./config/workflowMigration";

async function getColumnNames(client: any, table: string): Promise<Set<string>> {
  const { rows } = await client.query(
    'SELECT column_name AS "Field" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1',
    [table]
  );
  return new Set(rows.map((c: any) => c.Field));
}

async function syncDatabase() {
  console.log('\n========================================');
  console.log('  🛠️  PRODOC DATABASE SYNC & REPAIR');
  console.log('========================================\n');

  console.log(`📡 Connecting to PostgreSQL [${process.env.DATABASE_URL ? 'DATABASE_URL set' : 'DATABASE_URL missing'}]...`);

  let connection: any;
  try {
    connection = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await connection.connect();
  } catch (err: any) {
    console.error('❌ Connection Failed:', err.message);
    process.exit(1);
  }

  try {
    // 1. Sanitize users.template_approver column definition
    console.log('🔧 Step 1: Sanitizing users.template_approver column definition...');
    try {
      await connection.query("UPDATE users SET template_approver = 'no' WHERE template_approver IS NULL OR template_approver = '' OR template_approver NOT IN ('yes', 'no')");
      await connection.query('ALTER TABLE users ALTER COLUMN template_approver TYPE TEXT');
      console.log('  ✅ users.template_approver type normalized');
    } catch (err: any) {
      console.log('  ℹ️ users.template_approver notice:', err.message);
    }

    // 2. Synchronize users table columns
    console.log('🔧 Step 2: Checking users table columns...');
    try {
      const userColNames = await getColumnNames(connection, 'users');

      if (!userColNames.has('token_version')) {
        await connection.query('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1');
        console.log('  ✅ Added missing column: users.token_version');
      }
      if (!userColNames.has('last_login')) {
        await connection.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL');
        console.log('  ✅ Added missing column: users.last_login');
      }
      if (!userColNames.has('site')) {
        await connection.query('ALTER TABLE users ADD COLUMN site VARCHAR(255) NULL DEFAULT NULL');
        console.log('  ✅ Added missing column: users.site');
      }
      if (!userColNames.has('status')) {
        await connection.query("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
        console.log('  ✅ Added missing column: users.status');
      }
    } catch (uErr: any) {
      console.log('  ℹ️ users table notice:', uErr.message);
    }

    // 3. Synchronize templates table columns
    console.log('🔧 Step 3: Checking templates table columns...');
    try {
      const tplColNames = await getColumnNames(connection, 'templates');

      if (!tplColNames.has('ai_change_summary')) {
        await connection.query('ALTER TABLE templates ADD COLUMN ai_change_summary TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.ai_change_summary');
      }
      if (!tplColNames.has('notes')) {
        await connection.query('ALTER TABLE templates ADD COLUMN notes TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.notes');
      }
      if (!tplColNames.has('impact')) {
        await connection.query('ALTER TABLE templates ADD COLUMN impact TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.impact');
      }
      if (!tplColNames.has('template_approvers')) {
        await connection.query('ALTER TABLE templates ADD COLUMN template_approvers TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.template_approvers');
      }
      if (!tplColNames.has('comments')) {
        await connection.query('ALTER TABLE templates ADD COLUMN comments TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.comments');
      }
      if (!tplColNames.has('custom_document_approvers')) {
        await connection.query('ALTER TABLE templates ADD COLUMN custom_document_approvers TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.custom_document_approvers');
      }
      if (!tplColNames.has('progress_value')) {
        await connection.query('ALTER TABLE templates ADD COLUMN progress_value INTEGER DEFAULT 0');
        console.log('  ✅ Added missing column: templates.progress_value');
      }
      if (!tplColNames.has('revision_parent_id')) {
        await connection.query('ALTER TABLE templates ADD COLUMN revision_parent_id VARCHAR(255) DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.revision_parent_id');
      }
      if (!tplColNames.has('template_structure')) {
        await connection.query('ALTER TABLE templates ADD COLUMN template_structure TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.template_structure');
      }
      try {
        await connection.query("ALTER TABLE templates ALTER COLUMN status TYPE TEXT");
      } catch (_) {}
    } catch (tErr: any) {
      console.log('  ℹ️ templates table notice:', tErr.message);
    }

    // 4. Synchronize documents table columns
    console.log('🔧 Step 4: Checking documents table columns...');
    try {
      const docColNames = await getColumnNames(connection, 'documents');

      if (!docColNames.has('notes')) {
        await connection.query('ALTER TABLE documents ADD COLUMN notes TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.notes');
      }
      if (!docColNames.has('impact')) {
        await connection.query('ALTER TABLE documents ADD COLUMN impact TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.impact');
      }
      if (!docColNames.has('progress_value')) {
        await connection.query('ALTER TABLE documents ADD COLUMN progress_value INTEGER DEFAULT 0');
        console.log('  ✅ Added missing column: documents.progress_value');
      }
      if (!docColNames.has('cover_page_data')) {
        await connection.query('ALTER TABLE documents ADD COLUMN cover_page_data TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.cover_page_data');
      }
      if (!docColNames.has('required_approvers')) {
        await connection.query('ALTER TABLE documents ADD COLUMN required_approvers TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.required_approvers');
      }
      if (!docColNames.has('revision_parent_id')) {
        await connection.query('ALTER TABLE documents ADD COLUMN revision_parent_id VARCHAR(255) DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.revision_parent_id');
      }
      if (!docColNames.has('folder_id')) {
        await connection.query('ALTER TABLE documents ADD COLUMN folder_id INTEGER DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.folder_id');
      }
      if (!docColNames.has('current_revision')) {
        await connection.query("ALTER TABLE documents ADD COLUMN current_revision DECIMAL(3,1) DEFAULT '1.0'");
        console.log('  ✅ Added missing column: documents.current_revision');
      }
      if (!docColNames.has('structured_data')) {
        await connection.query('ALTER TABLE documents ADD COLUMN structured_data TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.structured_data');
      }
      try {
        await connection.query('ALTER TABLE documents ALTER COLUMN status TYPE TEXT');
      } catch (_) {}
    } catch (dErr: any) {
      console.log('  ℹ️ documents table notice:', dErr.message);
    }

    // 5. Ensure auxiliary tables exist
    console.log('🔧 Step 5: Checking auxiliary tables (notes, attachments, etc.)...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "notes" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "document_id" VARCHAR(255) DEFAULT NULL,
        "template_id" VARCHAR(255) DEFAULT NULL,
        "content" TEXT NOT NULL,
        "is_private" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "notes_user_id" ON "notes" ("user_id")');
    await connection.query('CREATE INDEX IF NOT EXISTS "notes_document_id" ON "notes" ("document_id")');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS "noterecipients" (
        "id" SERIAL PRIMARY KEY,
        "note_id" INTEGER NOT NULL,
        "recipient_id" INTEGER NOT NULL,
        "read_at" TIMESTAMP NULL DEFAULT NULL,
        "status" TEXT DEFAULT 'delivered'
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "noterecipients_note_id" ON "noterecipients" ("note_id")');
    await connection.query('CREATE INDEX IF NOT EXISTS "noterecipients_recipient_id" ON "noterecipients" ("recipient_id")');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" SERIAL PRIMARY KEY,
        "association_type" TEXT NOT NULL,
        "association_id" VARCHAR(255) NOT NULL,
        "file_name" VARCHAR(255) NOT NULL,
        "file_path" TEXT NOT NULL,
        "file_type" VARCHAR(100) NOT NULL,
        "file_size" INTEGER DEFAULT 0,
        "uploaded_by" INTEGER NOT NULL,
        "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS "task_comments" (
        "id" SERIAL PRIMARY KEY,
        "task_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "message" TEXT NOT NULL,
        "parent_id" INTEGER DEFAULT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "task_comments_task_id" ON "task_comments" ("task_id")');
    await connection.query('CREATE INDEX IF NOT EXISTS "task_comments_user_id" ON "task_comments" ("user_id")');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS "user_pins" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "item_type" VARCHAR(32) NOT NULL,
        "item_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("user_id", "item_type", "item_id")
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS "editor_references" (
        "id" SERIAL PRIMARY KEY,
        "association_type" VARCHAR(50) NOT NULL,
        "association_id" VARCHAR(255) NOT NULL,
        "ref_index" INTEGER NOT NULL,
        "ref_text" TEXT NOT NULL,
        "ref_anchor" VARCHAR(100) NOT NULL,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "editor_references_created_by" ON "editor_references" ("created_by")');

    // 6. Synchronize refresh_tokens table columns
    console.log('🔧 Step 6: Checking refresh_tokens table schema...');
    try {
      const rtColNames = await getColumnNames(connection, 'refresh_tokens');

      if (!rtColNames.has('token_hash')) {
        await connection.query('ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64) DEFAULT NULL');
        console.log('  ✅ Added missing column: refresh_tokens.token_hash');
      }
      if (!rtColNames.has('revoked_at')) {
        await connection.query('ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL');
        console.log('  ✅ Added missing column: refresh_tokens.revoked_at');
      }
      if (!rtColNames.has('replaced_by_hash')) {
        await connection.query('ALTER TABLE refresh_tokens ADD COLUMN replaced_by_hash VARCHAR(64) DEFAULT NULL');
        console.log('  ✅ Added missing column: refresh_tokens.replaced_by_hash');
      }
    } catch (rtErr: any) {
      console.log('  ℹ️ refresh_tokens notice:', rtErr.message);
    }

    // 7. Ensure documentpermissions status
    console.log('🔧 Step 7: Validating permissions integrity...');
    try {
      await connection.query("UPDATE documentpermissions SET status = 'active' WHERE permission_type = 'author'");
      console.log('  ✅ Author permissions active status verified');
    } catch (dpErr: any) {
      console.log('  ℹ️ documentpermissions notice:', dpErr.message);
    }

    // 8. Run External Migrations if available
    try {
      console.log('🔧 Step 8: Running Audit Trail migration...');
      await runAuditTrailMigration(connection);
    } catch (auditErr: any) {
      console.log('  ℹ️ Audit Trail migration skipped or notice:', auditErr.message);
    }

    try {
      console.log('🔧 Step 9: Running Phase 6B Security & Auxiliary migrations...');
      await runPhase6bMigration(connection);
    } catch (p6Err: any) {
      console.log('  ℹ️ Phase 6B migration skipped or notice:', p6Err.message);
    }

    try {
      console.log('🔧 Step 10: Running Numbering System migration...');
      await runNumberingMigration(connection);
    } catch (numErr: any) {
      console.log('  ℹ️ Numbering migration skipped or notice:', numErr.message);
    }

    try {
      console.log('🔧 Step 11: Running Deduplication & Cleanup migration...');
      await runDeduplicationMigration(connection);
    } catch (dedupErr: any) {
      console.log('  ℹ️ Deduplication migration skipped or notice:', dedupErr.message);
    }

    try {
      console.log('🔧 Step 12: Running Workflow State Sanitization migration...');
      await cleanStaleWorkflowApprovers(connection);
    } catch (wfErr: any) {
      console.log('  ℹ️ Workflow migration skipped or notice:', wfErr.message);
    }

    console.log('\n========================================');
    console.log('  ✅ DATABASE SYNCHRONIZATION COMPLETE! ');
    console.log('  You can now run: npm start or nodemon server.js');
    console.log('========================================\n');
  } catch (err) {
    console.error('\n❌ Error during database sync:', err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

syncDatabase();
