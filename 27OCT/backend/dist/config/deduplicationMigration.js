"use strict";
/**
 * Deduplication Migration & Database Auto-Repair
 *
 * Automatically resolves pre-existing duplicate draft templates and documents
 * (such as multiple v2 drafts created prior to the August 31 fix) and cleans up
 * anomalous duplicate published templates (e.g. retiring older versions to 'revised').
 *
 * Safely runs on server startup and can also be called directly via sync-db.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeduplicationMigration = runDeduplicationMigration;
async function runDeduplicationMigration(poolOrConn) {
    // pg.Client also exposes .connect(); only a real Pool needs connect()+release().
    const isPool = Boolean(poolOrConn && typeof poolOrConn.connect === 'function'
        && poolOrConn.constructor && poolOrConn.constructor.name === 'Pool');
    const connection = isPool ? await poolOrConn.connect() : poolOrConn;
    try {
        console.log('🧹 [DeduplicationMigration] Running database deduplication audit & repair...');
        // -------------------------------------------------------------
        // 1. DEDUPLICATE DRAFT / IN-PROGRESS TEMPLATE REVISIONS
        // -------------------------------------------------------------
        // If multiple drafts/revisions exist for the same revision_parent_id in the same org,
        // keep the one with the latest updated_at and delete/prune the orphaned duplicate drafts.
        const { rows: dupTemplateDrafts } = await connection.query(`
      SELECT revision_parent_id, organization_id, COUNT(*) as count,
             string_agg(id::text, ',' ORDER BY updated_at DESC, created_at DESC) as draft_ids
      FROM templates
      WHERE revision_parent_id IS NOT NULL
        AND status IN ('draft', 'pending_revision')
      GROUP BY revision_parent_id, organization_id
      HAVING count(*) > 1
    `);
        if (dupTemplateDrafts.length > 0) {
            console.log(`  ⚠️ Found ${dupTemplateDrafts.length} template revision parent(s) with duplicate drafts. Cleaning up...`);
            for (const group of dupTemplateDrafts) {
                const idList = group.draft_ids.split(',');
                const keepId = idList[0]; // Most recently updated draft
                const removeIds = idList.slice(1);
                console.log(`    - Parent ${group.revision_parent_id}: Keeping draft ${keepId}, removing ${removeIds.length} duplicate draft(s)`);
                // Remove associated attachments / permissions first if necessary
                for (const remId of removeIds) {
                    try {
                        await connection.query('DELETE FROM attachments WHERE association_type = $1 AND association_id = $2', ['template', remId]);
                    }
                    catch (_) { }
                    await connection.query('DELETE FROM templates WHERE id = $1', [remId]);
                }
            }
            console.log('  ✅ Template duplicate drafts pruned successfully.');
        }
        else {
            console.log('  ✅ No duplicate template drafts found.');
        }
        // -------------------------------------------------------------
        // 2. DEDUPLICATE DRAFT / IN-PROGRESS DOCUMENT REVISIONS
        // -------------------------------------------------------------
        const { rows: dupDocDrafts } = await connection.query(`
      SELECT revision_parent_id, organization_id, COUNT(*) as count,
             string_agg(document_id, ',' ORDER BY updated_at DESC, created_at DESC) as doc_ids
      FROM documents
      WHERE revision_parent_id IS NOT NULL
        AND status IN ('draft', 'pending_revision')
      GROUP BY revision_parent_id, organization_id
      HAVING count(*) > 1
    `);
        if (dupDocDrafts.length > 0) {
            console.log(`  ⚠️ Found ${dupDocDrafts.length} document revision parent(s) with duplicate drafts. Cleaning up...`);
            for (const group of dupDocDrafts) {
                const idList = group.doc_ids.split(',');
                const keepId = idList[0];
                const removeIds = idList.slice(1);
                console.log(`    - Parent ${group.revision_parent_id}: Keeping document draft ${keepId}, removing ${removeIds.length} duplicate draft(s)`);
                for (const remId of removeIds) {
                    try {
                        await connection.query('DELETE FROM documentpermissions WHERE document_id = $1', [remId]);
                        await connection.query('DELETE FROM document_history WHERE document_id = $1', [remId]);
                        await connection.query('DELETE FROM attachments WHERE association_type = $1 AND association_id = $2', ['document', remId]);
                    }
                    catch (_) { }
                    await connection.query('DELETE FROM documents WHERE document_id = $1', [remId]);
                }
            }
            console.log('  ✅ Document duplicate drafts pruned successfully.');
        }
        else {
            console.log('  ✅ No duplicate document drafts found.');
        }
        // -------------------------------------------------------------
        // 3. RETIRE ANOMALOUS DUPLICATE PUBLISHED TEMPLATES
        // -------------------------------------------------------------
        // If multiple templates with the same name in the same organization are published,
        // retire all but the highest version (or most recently updated) to 'revised'.
        const { rows: dupPublishedTemplates } = await connection.query(`
      SELECT LOWER(TRIM(name)) as norm_name, organization_id, COUNT(*) as count,
             string_agg(id::text, ',' ORDER BY version DESC, updated_at DESC) as template_ids
      FROM templates
      WHERE LOWER(status) IN ('published', 'active')
      GROUP BY LOWER(TRIM(name)), organization_id
      HAVING count(*) > 1
    `);
        if (dupPublishedTemplates.length > 0) {
            console.log(`  ⚠️ Found ${dupPublishedTemplates.length} published template name(s) with duplicate published entries. Retiring older versions...`);
            for (const group of dupPublishedTemplates) {
                const ids = group.template_ids.split(',');
                const keepId = ids[0]; // Latest version
                const retireIds = ids.slice(1);
                console.log(`    - Template "${group.norm_name}": Keeping latest published ${keepId}, retiring older versions: ${retireIds.join(', ')}`);
                for (const retId of retireIds) {
                    await connection.query('UPDATE templates SET status = $1, updated_at = NOW() WHERE id = $2', ['revised', retId]);
                }
            }
            console.log('  ✅ Older duplicate published templates retired to "revised".');
        }
        else {
            console.log('  ✅ No duplicate published template names found.');
        }
        // -------------------------------------------------------------
        // 4. RETIRE ANOMALOUS DUPLICATE PUBLISHED DOCUMENTS
        // -------------------------------------------------------------
        const { rows: dupPublishedDocs } = await connection.query(`
      SELECT LOWER(TRIM(title)) as norm_title, organization_id, COUNT(*) as count,
             string_agg(document_id, ',' ORDER BY version DESC, updated_at DESC) as doc_ids
      FROM documents
      WHERE LOWER(status) IN ('published', 'active')
      GROUP BY LOWER(TRIM(title)), organization_id
      HAVING count(*) > 1
    `);
        if (dupPublishedDocs.length > 0) {
            console.log(`  ⚠️ Found ${dupPublishedDocs.length} published document title(s) with duplicate published entries. Retiring older versions...`);
            for (const group of dupPublishedDocs) {
                const ids = group.doc_ids.split(',');
                const keepId = ids[0];
                const retireIds = ids.slice(1);
                console.log(`    - Document "${group.norm_title}": Keeping latest published ${keepId}, retiring older versions: ${retireIds.join(', ')}`);
                for (const retId of retireIds) {
                    await connection.query('UPDATE documents SET status = $1, updated_at = NOW() WHERE document_id = $2', ['revised', retId]);
                }
            }
            console.log('  ✅ Older duplicate published documents retired to "revised".');
        }
        else {
            console.log('  ✅ No duplicate published document titles found.');
        }
        // -------------------------------------------------------------
        // 5. ENSURE PERFORMANCE INDEXES ON REVISION & STATUS
        // -------------------------------------------------------------
        try {
            const { rows: tplIndexes } = await connection.query("SELECT indexname AS \"Key_name\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'templates'");
            const tplIndexNames = new Set(tplIndexes.map((i) => i.Key_name));
            if (!tplIndexNames.has('idx_templates_rev_status')) {
                await connection.query('CREATE INDEX idx_templates_rev_status ON templates (revision_parent_id, status)');
                console.log('  ✅ Added index idx_templates_rev_status on templates');
            }
        }
        catch (e) {
            // Ignore if exists or unsupported
        }
        try {
            const { rows: docIndexes } = await connection.query("SELECT indexname AS \"Key_name\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'documents'");
            const docIndexNames = new Set(docIndexes.map((i) => i.Key_name));
            if (!docIndexNames.has('idx_documents_rev_status')) {
                await connection.query('CREATE INDEX idx_documents_rev_status ON documents (revision_parent_id, status)');
                console.log('  ✅ Added index idx_documents_rev_status on documents');
            }
        }
        catch (e) {
            // Ignore if exists or unsupported
        }
        console.log('✅ [DeduplicationMigration] Database deduplication complete.');
    }
    catch (err) {
        console.error('❌ [DeduplicationMigration] Error during deduplication migration:', err.message);
    }
    finally {
        if (isPool && connection)
            connection.release();
    }
}
