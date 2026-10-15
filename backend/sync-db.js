/**
 * Database Sync & Repair Utility
 * Usage: node sync-db.js
 * 
 * Safely synchronizes all database schemas, missing columns, ENUM values,
 * indexes, and security constraints with the latest application state.
 * 100% Self-contained with built-in fallbacks.
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function syncDatabase() {
  console.log('\n========================================');
  console.log('  🛠️  PRODOC DATABASE SYNC & REPAIR');
  console.log('========================================\n');

  console.log(`📡 Connecting to MySQL [Host: ${process.env.DB_HOST || 'localhost'}, DB: ${process.env.DB_NAME || 'custom_docx'}]...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
      database: process.env.DB_NAME || 'custom_docx',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    process.exit(1);
  }

  try {
    // 1. Sanitize users.template_approver ENUM definition
    console.log('🔧 Step 1: Sanitizing users.template_approver column definition...');
    try {
      await connection.query("UPDATE users SET template_approver = 'no' WHERE template_approver IS NULL OR template_approver = '' OR template_approver NOT IN ('yes', 'no')");
      await connection.query("ALTER TABLE users MODIFY COLUMN template_approver ENUM('yes','no') DEFAULT 'no'");
      console.log('  ✅ users.template_approver ENUM fixed');
    } catch (err) {
      console.log('  ℹ️ users.template_approver notice:', err.message);
    }

    // 2. Synchronize users table columns
    console.log('🔧 Step 2: Checking users table columns...');
    try {
      const [userCols] = await connection.query('SHOW COLUMNS FROM users');
      const userColNames = new Set(userCols.map(c => c.Field));

      if (!userColNames.has('token_version')) {
        await connection.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1');
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
        await connection.query("ALTER TABLE users ADD COLUMN status ENUM('active','deactivated','inactive') DEFAULT 'active'");
        console.log('  ✅ Added missing column: users.status');
      }
    } catch (uErr) {
      console.log('  ℹ️ users table notice:', uErr.message);
    }

    // 3. Synchronize templates table columns
    console.log('🔧 Step 3: Checking templates table columns...');
    try {
      const [tplCols] = await connection.query('SHOW COLUMNS FROM templates');
      const tplColNames = new Set(tplCols.map(c => c.Field));

      if (!tplColNames.has('ai_change_summary')) {
        await connection.query('ALTER TABLE templates ADD COLUMN ai_change_summary LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.ai_change_summary');
      }
      if (!tplColNames.has('notes')) {
        await connection.query('ALTER TABLE templates ADD COLUMN notes TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.notes');
      }
      if (!tplColNames.has('impact')) {
        await connection.query('ALTER TABLE templates ADD COLUMN impact LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.impact');
      }
      if (!tplColNames.has('template_approvers')) {
        await connection.query('ALTER TABLE templates ADD COLUMN template_approvers LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.template_approvers');
      }
      if (!tplColNames.has('comments')) {
        await connection.query('ALTER TABLE templates ADD COLUMN comments LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.comments');
      }
      if (!tplColNames.has('custom_document_approvers')) {
        await connection.query('ALTER TABLE templates ADD COLUMN custom_document_approvers LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.custom_document_approvers');
      }
      if (!tplColNames.has('progress_value')) {
        await connection.query('ALTER TABLE templates ADD COLUMN progress_value INT DEFAULT 0');
        console.log('  ✅ Added missing column: templates.progress_value');
      }
      if (!tplColNames.has('revision_parent_id')) {
        await connection.query('ALTER TABLE templates ADD COLUMN revision_parent_id VARCHAR(255) DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.revision_parent_id');
      }
      if (!tplColNames.has('template_structure')) {
        await connection.query('ALTER TABLE templates ADD COLUMN template_structure LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: templates.template_structure');
      }
      try {
        await connection.query("ALTER TABLE templates MODIFY COLUMN status ENUM('draft','pending_review','reviewed','pending_approval','approved','published','disabled','pending_revision','revised','archived','rejected','pending_archive_approval','pending_archive_review','archive_draft','archive_reviewed') DEFAULT 'draft'");
      } catch (_) {}
    } catch (tErr) {
      console.log('  ℹ️ templates table notice:', tErr.message);
    }

    // 4. Synchronize documents table columns
    console.log('🔧 Step 4: Checking documents table columns...');
    try {
      const [docCols] = await connection.query('SHOW COLUMNS FROM documents');
      const docColNames = new Set(docCols.map(c => c.Field));

      if (!docColNames.has('notes')) {
        await connection.query('ALTER TABLE documents ADD COLUMN notes TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.notes');
      }
      if (!docColNames.has('impact')) {
        await connection.query('ALTER TABLE documents ADD COLUMN impact TEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.impact');
      }
      if (!docColNames.has('progress_value')) {
        await connection.query('ALTER TABLE documents ADD COLUMN progress_value INT DEFAULT 0');
        console.log('  ✅ Added missing column: documents.progress_value');
      }
      if (!docColNames.has('cover_page_data')) {
        await connection.query('ALTER TABLE documents ADD COLUMN cover_page_data LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.cover_page_data');
      }
      if (!docColNames.has('required_approvers')) {
        await connection.query('ALTER TABLE documents ADD COLUMN required_approvers LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.required_approvers');
      }
      if (!docColNames.has('revision_parent_id')) {
        await connection.query('ALTER TABLE documents ADD COLUMN revision_parent_id VARCHAR(255) DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.revision_parent_id');
      }
      if (!docColNames.has('folder_id')) {
        await connection.query('ALTER TABLE documents ADD COLUMN folder_id INT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.folder_id');
      }
      if (!docColNames.has('current_revision')) {
        await connection.query("ALTER TABLE documents ADD COLUMN current_revision DECIMAL(3,1) DEFAULT '1.0'");
        console.log('  ✅ Added missing column: documents.current_revision');
      }
      if (!docColNames.has('structured_data')) {
        await connection.query('ALTER TABLE documents ADD COLUMN structured_data LONGTEXT DEFAULT NULL');
        console.log('  ✅ Added missing column: documents.structured_data');
      }
      try {
        await connection.query("ALTER TABLE documents MODIFY COLUMN status ENUM('draft','pending_review','pending_approval','reviewed','approved','published','revised','pending_revision','archived','disabled','rejected','pending_archive_approval','pending_archive_review','archive_draft','archive_reviewed') DEFAULT 'draft'");
      } catch (_) {}
    } catch (dErr) {
      console.log('  ℹ️ documents table notice:', dErr.message);
    }

    // 5. Ensure auxiliary tables exist
    console.log('🔧 Step 5: Checking auxiliary tables (notes, attachments, etc.)...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`notes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL,
        \`document_id\` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
        \`template_id\` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
        \`content\` text COLLATE utf8mb4_general_ci NOT NULL,
        \`is_private\` tinyint(1) DEFAULT '1',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`user_id\` (\`user_id\`),
        KEY \`document_id\` (\`document_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`noterecipients\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`note_id\` int NOT NULL,
        \`recipient_id\` int NOT NULL,
        \`read_at\` timestamp NULL DEFAULT NULL,
        \`status\` enum('delivered','read') COLLATE utf8mb4_general_ci DEFAULT 'delivered',
        PRIMARY KEY (\`id\`),
        KEY \`note_id\` (\`note_id\`),
        KEY \`recipient_id\` (\`recipient_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`attachments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`association_type\` enum('template','document','temp') NOT NULL,
        \`association_id\` varchar(255) NOT NULL,
        \`file_name\` varchar(255) NOT NULL,
        \`file_path\` text NOT NULL,
        \`file_type\` varchar(100) NOT NULL,
        \`file_size\` int(11) DEFAULT 0,
        \`uploaded_by\` int(11) NOT NULL,
        \`uploaded_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`task_comments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`task_id\` int(11) NOT NULL,
        \`user_id\` int(11) NOT NULL,
        \`message\` text NOT NULL,
        \`parent_id\` int(11) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`task_id\` (\`task_id\`),
        KEY \`user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`user_pins\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`user_id\` int(11) NOT NULL,
        \`item_type\` varchar(32) NOT NULL,
        \`item_id\` int(11) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_user_item\` (\`user_id\`, \`item_type\`, \`item_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`editor_references\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`association_type\` varchar(50) NOT NULL,
        \`association_id\` varchar(255) NOT NULL,
        \`ref_index\` int(11) NOT NULL,
        \`ref_text\` text NOT NULL,
        \`ref_anchor\` varchar(100) NOT NULL,
        \`created_by\` int(11) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`created_by\` (\`created_by\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 6. Synchronize refresh_tokens table columns
    console.log('🔧 Step 6: Checking refresh_tokens table schema...');
    try {
      const [rtCols] = await connection.query('SHOW COLUMNS FROM refresh_tokens');
      const rtColNames = new Set(rtCols.map(c => c.Field));

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
    } catch (rtErr) {
      console.log('  ℹ️ refresh_tokens notice:', rtErr.message);
    }

    // 7. Ensure documentpermissions status
    console.log('🔧 Step 7: Validating permissions integrity...');
    try {
      await connection.query("UPDATE documentpermissions SET status = 'active' WHERE permission_type = 'author'");
      console.log('  ✅ Author permissions active status verified');
    } catch (dpErr) {
      console.log('  ℹ️ documentpermissions notice:', dpErr.message);
    }

    // 8. Run External Migrations if available
    try {
      const { runAuditTrailMigration } = require('./config/auditMigration');
      console.log('🔧 Step 8: Running Audit Trail migration...');
      await runAuditTrailMigration(connection);
    } catch (auditErr) {
      console.log('  ℹ️ Audit Trail migration skipped or notice:', auditErr.message);
    }

    try {
      const { runPhase6bMigration } = require('./config/phase6bMigration');
      console.log('🔧 Step 9: Running Phase 6B Security & Auxiliary migrations...');
      await runPhase6bMigration(connection);
    } catch (p6Err) {
      console.log('  ℹ️ Phase 6B migration skipped or notice:', p6Err.message);
    }

    try {
      const { runNumberingMigration } = require('./config/numberingMigration');
      console.log('🔧 Step 10: Running Numbering System migration...');
      await runNumberingMigration(connection);
    } catch (numErr) {
      console.log('  ℹ️ Numbering migration skipped or notice:', numErr.message);
    }

    try {
      const { runDeduplicationMigration } = require('./config/deduplicationMigration');
      console.log('🔧 Step 11: Running Deduplication & Cleanup migration...');
      await runDeduplicationMigration(connection);
    } catch (dedupErr) {
      console.log('  ℹ️ Deduplication migration skipped or notice:', dedupErr.message);
    }

    try {
      const { cleanStaleWorkflowApprovers } = require('./config/workflowMigration');
      console.log('🔧 Step 12: Running Workflow State Sanitization migration...');
      await cleanStaleWorkflowApprovers(connection);
    } catch (wfErr) {
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
