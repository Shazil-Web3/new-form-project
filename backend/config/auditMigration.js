/**
 * Phase 3 - Audit Trail Schema Migration
 * Idempotent, self-healing migration to upgrade audittrail table:
 * 1. Non-destructive FKs (user_id -> SET NULL, org_id -> RESTRICT)
 * 2. Extended audit metadata: resource_type, resource_id, user_email, user_name, user_agent, status
 * 3. Composite indexing for performance and filtering
 */

async function runAuditTrailMigration(pool) {
  try {
    // 1. Verify audittrail table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'audittrail'");
    if (tables.length === 0) {
      console.log('ℹ️ audittrail table does not exist yet. Skipping audit migration.');
      return;
    }

    // 2. Inspect existing columns
    const [columns] = await pool.query("SHOW COLUMNS FROM `audittrail`");
    const colMap = new Set(columns.map(c => c.Field));

    // Make user_id nullable if it's currently NOT NULL
    const userIdCol = columns.find(c => c.Field === 'user_id');
    if (userIdCol && userIdCol.Null === 'NO') {
      try {
        await pool.query("ALTER TABLE `audittrail` MODIFY `user_id` int(11) NULL");
        console.log('✅ Updated audittrail.user_id to nullable (protects history)');
      } catch (err) {
        console.warn('Notice on modifying user_id:', err.message);
      }
    }

    // Add missing columns idempotently
    if (!colMap.has('user_email')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `user_email` varchar(255) NULL AFTER `user_id`");
      console.log('✅ Added audittrail.user_email column');
    }

    if (!colMap.has('user_name')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `user_name` varchar(255) NULL AFTER `user_email`");
      console.log('✅ Added audittrail.user_name column');
    }

    if (!colMap.has('resource_type')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `resource_type` varchar(50) NOT NULL DEFAULT 'document' AFTER `action_type`");
      console.log('✅ Added audittrail.resource_type column');
    }

    if (!colMap.has('resource_id')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `resource_id` varchar(255) NULL AFTER `resource_type`");
      console.log('✅ Added audittrail.resource_id column');
    }

    if (!colMap.has('user_agent')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `user_agent` text NULL AFTER `ip_address`");
      console.log('✅ Added audittrail.user_agent column');
    }

    if (!colMap.has('status')) {
      await pool.query("ALTER TABLE `audittrail` ADD COLUMN `status` enum('success','failure','denied') NOT NULL DEFAULT 'success' AFTER `user_agent`");
      console.log('✅ Added audittrail.status column');
    }

    // 3. Inspect and update Foreign Key constraints
    const [fks] = await pool.query(`
      SELECT RC.CONSTRAINT_NAME, KCU.COLUMN_NAME, KCU.REFERENCED_TABLE_NAME, KCU.REFERENCED_COLUMN_NAME, RC.DELETE_RULE
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU
        ON RC.CONSTRAINT_NAME = KCU.CONSTRAINT_NAME AND RC.CONSTRAINT_SCHEMA = KCU.CONSTRAINT_SCHEMA
      WHERE RC.CONSTRAINT_SCHEMA = DATABASE() AND RC.TABLE_NAME = 'audittrail'
    `);

    // Update user_id FK from CASCADE to SET NULL
    const userFk = fks.find(f => f.COLUMN_NAME === 'user_id');
    if (userFk && userFk.DELETE_RULE === 'CASCADE') {
      try {
        await pool.query(`ALTER TABLE \`audittrail\` DROP FOREIGN KEY \`${userFk.CONSTRAINT_NAME}\``);
        await pool.query(`
          ALTER TABLE \`audittrail\`
          ADD CONSTRAINT \`fk_audittrail_user_safe\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
        `);
        console.log('✅ Updated audittrail user FK to ON DELETE SET NULL (anti-tamper)');
      } catch (fkErr) {
        console.warn('Notice updating user FK:', fkErr.message);
      }
    }

    // Update organization_id FK from CASCADE to RESTRICT
    const orgFk = fks.find(f => f.COLUMN_NAME === 'organization_id');
    if (orgFk && orgFk.DELETE_RULE === 'CASCADE') {
      try {
        await pool.query(`ALTER TABLE \`audittrail\` DROP FOREIGN KEY \`${orgFk.CONSTRAINT_NAME}\``);
        await pool.query(`
          ALTER TABLE \`audittrail\`
          ADD CONSTRAINT \`fk_audittrail_org_safe\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE RESTRICT
        `);
        console.log('✅ Updated audittrail org FK to ON DELETE RESTRICT (anti-tamper)');
      } catch (fkErr) {
        console.warn('Notice updating org FK:', fkErr.message);
      }
    }

    // 4. Inspect and add indexes
    const [indexes] = await pool.query("SHOW INDEX FROM `audittrail`");
    const idxSet = new Set(indexes.map(i => i.Key_name));

    if (!idxSet.has('idx_audit_org_created')) {
      try {
        await pool.query("ALTER TABLE `audittrail` ADD INDEX `idx_audit_org_created` (`organization_id`, `created_at` DESC)");
        console.log('✅ Created index idx_audit_org_created');
      } catch (e) {
        console.warn('Index notice:', e.message);
      }
    }

    if (!idxSet.has('idx_audit_action')) {
      try {
        await pool.query("ALTER TABLE `audittrail` ADD INDEX `idx_audit_action` (`organization_id`, `action_type`)");
        console.log('✅ Created index idx_audit_action');
      } catch (e) {
        console.warn('Index notice:', e.message);
      }
    }

    if (!idxSet.has('idx_audit_resource')) {
      try {
        await pool.query("ALTER TABLE `audittrail` ADD INDEX `idx_audit_resource` (`resource_type`, `resource_id`)");
        console.log('✅ Created index idx_audit_resource');
      } catch (e) {
        console.warn('Index notice:', e.message);
      }
    }

    // Populate resource_id from document_id for existing records if null
    await pool.query("UPDATE `audittrail` SET `resource_id` = `document_id` WHERE `resource_id` IS NULL AND `document_id` IS NOT NULL");

    console.log('🚀 Phase 3 Audit Trail database migration completed successfully.');
  } catch (err) {
    console.error('❌ Audit trail migration failed:', err);
    throw err;
  }
}

module.exports = { runAuditTrailMigration };
