"use strict";
/**
 * Phase 3 - Audit Trail Schema Migration
 * Idempotent, self-healing migration to upgrade audittrail table:
 * 1. Non-destructive FKs (user_id -> SET NULL, org_id -> RESTRICT)
 * 2. Extended audit metadata: resource_type, resource_id, user_email, user_name, user_agent, status
 * 3. Composite indexing for performance and filtering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAuditTrailMigration = runAuditTrailMigration;
async function runAuditTrailMigration(pool) {
    try {
        // 1. Verify audittrail table exists
        const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audittrail'");
        if (tables.length === 0) {
            console.log('ℹ️ audittrail table does not exist yet. Skipping audit migration.');
            return;
        }
        // 2. Inspect existing columns
        const { rows: columns } = await pool.query("SELECT column_name AS \"Field\", is_nullable AS \"Null\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audittrail'");
        const colMap = new Set(columns.map((c) => c.Field));
        // Make user_id nullable if it's currently NOT NULL
        const userIdCol = columns.find((c) => c.Field === 'user_id');
        if (userIdCol && userIdCol.Null === 'NO') {
            try {
                await pool.query('ALTER TABLE "audittrail" ALTER COLUMN "user_id" DROP NOT NULL');
                console.log('✅ Updated audittrail.user_id to nullable (protects history)');
            }
            catch (err) {
                console.warn('Notice on modifying user_id:', err.message);
            }
        }
        // Add missing columns idempotently
        if (!colMap.has('user_email')) {
            await pool.query('ALTER TABLE "audittrail" ADD COLUMN "user_email" VARCHAR(255) NULL');
            console.log('✅ Added audittrail.user_email column');
        }
        if (!colMap.has('user_name')) {
            await pool.query('ALTER TABLE "audittrail" ADD COLUMN "user_name" VARCHAR(255) NULL');
            console.log('✅ Added audittrail.user_name column');
        }
        if (!colMap.has('resource_type')) {
            await pool.query("ALTER TABLE \"audittrail\" ADD COLUMN \"resource_type\" VARCHAR(50) NOT NULL DEFAULT 'document'");
            console.log('✅ Added audittrail.resource_type column');
        }
        if (!colMap.has('resource_id')) {
            await pool.query('ALTER TABLE "audittrail" ADD COLUMN "resource_id" VARCHAR(255) NULL');
            console.log('✅ Added audittrail.resource_id column');
        }
        if (!colMap.has('user_agent')) {
            await pool.query('ALTER TABLE "audittrail" ADD COLUMN "user_agent" TEXT NULL');
            console.log('✅ Added audittrail.user_agent column');
        }
        if (!colMap.has('status')) {
            await pool.query("ALTER TABLE \"audittrail\" ADD COLUMN \"status\" TEXT NOT NULL DEFAULT 'success'");
            console.log('✅ Added audittrail.status column');
        }
        // 3. Inspect and update Foreign Key constraints
        const { rows: fks } = await pool.query(`
      SELECT c.conname AS "CONSTRAINT_NAME", a.attname AS "COLUMN_NAME", NULL AS "REFERENCED_TABLE_NAME",
        CASE c.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
          ELSE ''
        END AS "DELETE_RULE"
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE t.relname = 'audittrail' AND c.contype = 'f'
    `);
        // Update user_id FK from CASCADE to SET NULL
        const userFk = fks.find((f) => f.COLUMN_NAME === 'user_id');
        if (userFk && userFk.DELETE_RULE === 'CASCADE') {
            try {
                await pool.query(`ALTER TABLE "audittrail" DROP CONSTRAINT "${userFk.CONSTRAINT_NAME}"`);
                await pool.query(`
          ALTER TABLE "audittrail"
          ADD CONSTRAINT "fk_audittrail_user_safe"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        `);
                console.log('✅ Updated audittrail user FK to ON DELETE SET NULL (anti-tamper)');
            }
            catch (fkErr) {
                console.warn('Notice updating user FK:', fkErr.message);
            }
        }
        // Update organization_id FK from CASCADE to RESTRICT
        const orgFk = fks.find((f) => f.COLUMN_NAME === 'organization_id');
        if (orgFk && orgFk.DELETE_RULE === 'CASCADE') {
            try {
                await pool.query(`ALTER TABLE "audittrail" DROP CONSTRAINT "${orgFk.CONSTRAINT_NAME}"`);
                await pool.query(`
          ALTER TABLE "audittrail"
          ADD CONSTRAINT "fk_audittrail_org_safe"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT
        `);
                console.log('✅ Updated audittrail org FK to ON DELETE RESTRICT (anti-tamper)');
            }
            catch (fkErr) {
                console.warn('Notice updating org FK:', fkErr.message);
            }
        }
        // 4. Inspect and add indexes
        const { rows: indexes } = await pool.query("SELECT indexname AS \"Key_name\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'audittrail'");
        const idxSet = new Set(indexes.map((i) => i.Key_name));
        if (!idxSet.has('idx_audit_org_created')) {
            try {
                await pool.query('CREATE INDEX "idx_audit_org_created" ON "audittrail" ("organization_id", "created_at" DESC)');
                console.log('✅ Created index idx_audit_org_created');
            }
            catch (e) {
                console.warn('Index notice:', e.message);
            }
        }
        if (!idxSet.has('idx_audit_action')) {
            try {
                await pool.query('CREATE INDEX "idx_audit_action" ON "audittrail" ("organization_id", "action_type")');
                console.log('✅ Created index idx_audit_action');
            }
            catch (e) {
                console.warn('Index notice:', e.message);
            }
        }
        if (!idxSet.has('idx_audit_resource')) {
            try {
                await pool.query('CREATE INDEX "idx_audit_resource" ON "audittrail" ("resource_type", "resource_id")');
                console.log('✅ Created index idx_audit_resource');
            }
            catch (e) {
                console.warn('Index notice:', e.message);
            }
        }
        // Populate resource_id from document_id for existing records if null
        await pool.query('UPDATE "audittrail" SET "resource_id" = "document_id" WHERE "resource_id" IS NULL AND "document_id" IS NOT NULL');
        console.log('🚀 Phase 3 Audit Trail database migration completed successfully.');
    }
    catch (err) {
        console.error('❌ Audit trail migration failed:', err);
        throw err;
    }
}
