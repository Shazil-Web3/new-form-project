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

async function runRelatedDocumentsMigration(poolOrConn) {
  const isPool = Boolean(poolOrConn && typeof poolOrConn.getConnection === 'function');
  const connection = isPool ? await poolOrConn.getConnection() : poolOrConn;

  try {
    console.log('🔗 Running Related Documents migration...');

    // 1. Create the document_related table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`document_related\` (
        \`id\`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`document_id\`         VARCHAR(255) NOT NULL COMMENT 'The document that owns this relationship',
        \`related_document_id\` VARCHAR(255) NOT NULL COMMENT 'The document being related to',
        \`relationship_type\`   ENUM('pending_dependency','related','published_related') NOT NULL DEFAULT 'pending_dependency'
                               COMMENT 'pending_dependency = in-flight dependency (draft/review/approval) requiring synchronized release',
        \`is_sync_required\`    TINYINT(1) NOT NULL DEFAULT 1
                               COMMENT '1 = publishing document_id is blocked until related_document_id is published',
        \`created_by\`          INT NOT NULL,
        \`created_at\`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uniq_doc_related\` (\`document_id\`, \`related_document_id\`),
        INDEX \`idx_dr_document_id\`         (\`document_id\`),
        INDEX \`idx_dr_related_document_id\` (\`related_document_id\`),
        INDEX \`idx_dr_created_by\`          (\`created_by\`),
        CONSTRAINT \`fk_dr_document_id\`
          FOREIGN KEY (\`document_id\`)
          REFERENCES \`documents\` (\`document_id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_dr_related_document_id\`
          FOREIGN KEY (\`related_document_id\`)
          REFERENCES \`documents\` (\`document_id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_dr_created_by\`
          FOREIGN KEY (\`created_by\`)
          REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('  ✅ Table `document_related` verified/created');

    // 2. Ensure is_sync_required column exists (idempotent add for older installs)
    const [cols] = await connection.query('SHOW COLUMNS FROM `document_related`');
    const colNames = new Set(cols.map(c => c.Field));
    if (!colNames.has('is_sync_required')) {
      await connection.query(
        'ALTER TABLE `document_related` ADD COLUMN `is_sync_required` TINYINT(1) NOT NULL DEFAULT 1 AFTER `relationship_type`'
      );
      console.log('  ✅ Added `is_sync_required` column to `document_related`');
    }

    console.log('✅ Related Documents migration completed successfully');
  } catch (err) {
    console.error('❌ Notice during related-documents migration:', err.message);
  } finally {
    if (isPool && connection) connection.release();
  }
}

module.exports = { runRelatedDocumentsMigration };
