"use strict";
/**
 * Related Documents Migration
 *
 * Creates the `document_related` table that stores explicit relationships
 * between documents for the "Related Documents" / synchronized-publishing feature.
 *
 * Design notes:
 * - The table is directional: document_id "relates to" related_document_id.
 *   The publishing logic treats the relationship as "document_id MUST wait for
 *   related_document_id to be published".
 * - Related documents are in-flight documents (draft, review, approval) that require
 *   coordinated/synchronized publishing. Published documents cannot be selected as related documents.
 * - relationship_type indicates the workflow dependency ('pending_dependency').
 * - is_sync_required controls whether the synchronized-publish gate is enforced.
 * - Idempotent: safe to re-run on every server start.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRelatedDocumentsMigration = runRelatedDocumentsMigration;
async function runRelatedDocumentsMigration(poolOrConn) {
    // pg.Client also exposes .connect(); only a real Pool needs connect()+release().
    const isPool = Boolean(poolOrConn && typeof poolOrConn.connect === 'function'
        && poolOrConn.constructor && poolOrConn.constructor.name === 'Pool');
    const connection = isPool ? await poolOrConn.connect() : poolOrConn;
    try {
        console.log('🔗 Running Related Documents migration...');
        // 1. Create the document_related table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS "document_related" (
        "id" SERIAL PRIMARY KEY,
        "document_id" VARCHAR(255) NOT NULL,
        "related_document_id" VARCHAR(255) NOT NULL,
        "relationship_type" TEXT NOT NULL DEFAULT 'pending_dependency',
        "is_sync_required" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("document_id", "related_document_id"),
        CONSTRAINT "fk_dr_document_id"
          FOREIGN KEY ("document_id")
          REFERENCES "documents" ("document_id") ON DELETE CASCADE,
        CONSTRAINT "fk_dr_related_document_id"
          FOREIGN KEY ("related_document_id")
          REFERENCES "documents" ("document_id") ON DELETE CASCADE,
        CONSTRAINT "fk_dr_created_by"
          FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_dr_document_id" ON "document_related" ("document_id")');
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_dr_related_document_id" ON "document_related" ("related_document_id")');
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_dr_created_by" ON "document_related" ("created_by")');
        console.log('  ✅ Table `document_related` verified/created');
        // 2. Ensure is_sync_required column exists (idempotent add for older installs)
        const { rows: cols } = await connection.query('SELECT column_name AS "Field" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = \'document_related\'');
        const colNames = new Set(cols.map((c) => c.Field));
        if (!colNames.has('is_sync_required')) {
            await connection.query('ALTER TABLE "document_related" ADD COLUMN "is_sync_required" BOOLEAN NOT NULL DEFAULT TRUE');
            console.log('  ✅ Added `is_sync_required` column to `document_related`');
        }
        console.log('✅ Related Documents migration completed successfully');
    }
    catch (err) {
        console.error('❌ Notice during related-documents migration:', err.message);
    }
    finally {
        if (isPool && connection)
            connection.release();
    }
}
