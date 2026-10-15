const pool = require('./db');
const { resetWorkflowState } = require('../documents/documentHelpers');

async function cleanStaleWorkflowApprovers(poolOrConn = pool) {
  try {
    const db = poolOrConn || pool;
    console.log('🔄 Checking for templates and documents with stale workflow statuses...');

    // 1. Templates in draft, pending_revision, pending_review, or pending_approval
    const [templates] = await db.query(
      `SELECT id, name, status, template_approvers 
       FROM templates 
       WHERE status IN ('draft', 'pending_revision', 'pending_review', 'pending_approval') 
         AND template_approvers IS NOT NULL`
    );

    let fixedTemplatesCount = 0;
    for (const tpl of templates) {
      if (!tpl.template_approvers) continue;
      const cleaned = resetWorkflowState(tpl.template_approvers, tpl.status);
      const cleanedStr = JSON.stringify(cleaned);
      if (cleanedStr !== tpl.template_approvers) {
        await db.query(
          'UPDATE templates SET template_approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [cleanedStr, tpl.id]
        );
        console.log(`  ✓ Fixed template: ${tpl.id} (${tpl.name}) [${tpl.status}]`);
        fixedTemplatesCount++;
      }
    }

    // 2. Documents in draft, pending_revision, pending_review, or pending_approval
    const [documents] = await db.query(
      `SELECT document_id, title, status, approvers 
       FROM documents 
       WHERE status IN ('draft', 'pending_revision', 'pending_review', 'pending_approval') 
         AND approvers IS NOT NULL`
    );

    let fixedDocsCount = 0;
    for (const doc of documents) {
      if (!doc.approvers) continue;
      const cleaned = resetWorkflowState(doc.approvers, doc.status);
      const cleanedStr = JSON.stringify(cleaned);
      if (cleanedStr !== doc.approvers) {
        await db.query(
          'UPDATE documents SET approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
          [cleanedStr, doc.document_id]
        );
        console.log(`  ✓ Fixed document: ${doc.document_id} (${doc.title}) [${doc.status}]`);
        fixedDocsCount++;
      }
    }

    console.log(`✅ Workflow cleanup finished. Cleaned ${fixedTemplatesCount} templates and ${fixedDocsCount} documents.`);
  } catch (err) {
    console.error('❌ Error during workflow cleanup:', err);
  }
}

module.exports = { cleanStaleWorkflowApprovers };

if (require.main === module) {
  cleanStaleWorkflowApprovers().then(() => pool.end());
}
