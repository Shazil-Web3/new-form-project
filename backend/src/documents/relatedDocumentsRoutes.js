/**
 * @file relatedDocumentsRoutes.js
 * @description Backend routes for the Related Documents feature.
 *
 * Requirements:
 *  - Published documents CANNOT be selected in the related documents.
 *  - Other than published documents, documents in review, documents in approval,
 *    as well as in draft can be selected in the related drop-down.
 *  - Synchronized publishing gate: a document cannot be published until every
 *    related document (is_sync_required=1) has also completed approval and reached 'published'.
 *  - Group publish allows an admin to publish all documents in an interrelated group
 *    atomically in one transaction.
 *
 * Routes:
 *  1. GET  /api/documents-for-related               — list in-flight documents (draft, review, approval) for dropdown
 *  2. GET  /api/documents/:id/related               — fetch related docs for a document
 *  3. PUT  /api/documents/:id/related               — replace full related-doc list for a document
 *  4. GET  /api/documents/:id/publish-readiness     — check whether a doc and its group can be published
 *  5. POST /api/documents/publish-group             — admin-only atomic group publish
 */

const { assertUserDocumentAccess, retireParentDocumentsToArchived } = require('./documentHelpers');

// Statuses that count as "not ready to publish"
const BLOCKING_STATUSES = [
  'draft',
  'pending_review',
  'reviewed',
  'pending_approval',
  'pending_revision',
  'archive_draft',
  'pending_archive_review',
  'pending_archive_approval',
  'archive_reviewed',
];

/**
 * Collect the full publishing group for a document (bidirectional, transitively).
 * Returns a Set of document_id strings including the seed document itself.
 * Prevents circular lookups with a visited set.
 */
async function collectPublishingGroup(pool, seedDocumentId, maxDepth = 20) {
  const group = new Set();
  const queue = [seedDocumentId];
  let depth = 0;

  while (queue.length > 0 && depth < maxDepth) {
    depth++;
    const current = queue.shift();
    if (group.has(current)) continue;
    group.add(current);

    // Outbound: docs that current depends on
    const [outbound] = await pool.execute(
      `SELECT related_document_id FROM document_related
       WHERE document_id = ? AND is_sync_required = 1`,
      [current]
    );
    for (const row of outbound) {
      if (!group.has(row.related_document_id)) queue.push(row.related_document_id);
    }

    // Inbound: docs that depend on current
    const [inbound] = await pool.execute(
      `SELECT document_id FROM document_related
       WHERE related_document_id = ? AND is_sync_required = 1`,
      [current]
    );
    for (const row of inbound) {
      if (!group.has(row.document_id)) queue.push(row.document_id);
    }
  }
  return group;
}

module.exports = function registerRelatedDocumentsRoutes({
  app,
  pool,
  authenticateToken,
  logAuditEvent,
}) {

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/documents/:id/related
  // Returns all related documents for a given document, with their current status.
  // ─────────────────────────────────────────────────────────────────────────────
  app.get('/api/documents/:id/related', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;

      const ok = await assertUserDocumentAccess(id, userId, pool, 'read');
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });

      const [rows] = await pool.execute(
        `SELECT
           dr.id,
           CASE WHEN dr.document_id = ? THEN dr.related_document_id ELSE dr.document_id END AS related_document_id,
           dr.relationship_type,
           dr.is_sync_required,
           dr.created_at,
           d.document_id,
           d.title,
           d.status,
           d.version,
           d.document_number,
           d.department,
           CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
         FROM document_related dr
         JOIN documents d ON (
           CASE WHEN dr.document_id = ? THEN dr.related_document_id ELSE dr.document_id END = d.document_id
         )
         LEFT JOIN users u ON d.created_by = u.id
         WHERE dr.document_id = ? OR dr.related_document_id = ?
         ORDER BY dr.created_at ASC`,
        [id, id, id, id]
      );

      // Deduplicate in case reciprocal rows exist
      const seen = new Set();
      const uniqueDocs = [];
      for (const row of rows) {
        const docKey = String(row.document_id || row.related_document_id);
        if (!seen.has(docKey)) {
          seen.add(docKey);
          uniqueDocs.push({
            ...row,
            related_document_id: docKey,
          });
        }
      }

      res.json({ success: true, relatedDocuments: uniqueDocs });
    } catch (err) {
      console.error('[GET /api/documents/:id/related]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch related documents' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /api/documents/:id/related
  // Replace the complete list of related documents.
  // Body: { relatedDocumentIds: string[], relationshipType?: string }
  //
  // Strict business rules:
  //  - Published documents CANNOT be selected in the related documents.
  //  - Only documents in draft, under review, or under approval can be selected.
  //  - A document cannot relate to itself.
  //  - No circular dependency that would deadlock group publish.
  // ─────────────────────────────────────────────────────────────────────────────
  app.put('/api/documents/:id/related', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;
    const { relatedDocumentIds = [], relationshipType = 'pending_dependency' } = req.body;

    if (!Array.isArray(relatedDocumentIds)) {
      return res.status(400).json({ success: false, message: 'relatedDocumentIds must be an array' });
    }

    try {
      const ok = await assertUserDocumentAccess(id, userId, pool, 'write');
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });

      // Deduplicate and remove self-references
      const uniqueIds = Array.from(new Set(
        relatedDocumentIds.map(rid => String(rid)).filter(rid => rid !== String(id))
      ));

      // Validate that all target documents exist in the same organization
      const [docInfo] = await pool.execute(
        'SELECT organization_id FROM documents WHERE document_id = ?',
        [id]
      );
      if (!docInfo.length) return res.status(404).json({ success: false, message: 'Document not found' });
      const orgId = docInfo[0].organization_id;

      const invalidIds = [];
      const publishedDocuments = [];

      for (const rid of uniqueIds) {
        const [target] = await pool.execute(
          'SELECT document_id, title, status, organization_id FROM documents WHERE document_id = ?',
          [rid]
        );
        if (!target.length || target[0].organization_id !== orgId) {
          invalidIds.push(rid);
          continue;
        }

        // Rule: Published/revised/archived documents CANNOT be selected in related documents
        const forbiddenStatuses = ['published', 'revised', 'archived', 'disabled'];
        if (forbiddenStatuses.includes(target[0].status)) {
          publishedDocuments.push({ id: rid, status: target[0].status, title: target[0].title });
        }
      }

      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `One or more related document IDs are invalid or belong to a different organization: ${invalidIds.join(', ')}`
        });
      }

      if (publishedDocuments.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Published documents cannot be selected in the related documents. Only documents in review, approval, or draft can be selected.',
          publishedDocuments
        });
      }

      // Circular dependency check: adding these relationships must not create a cycle
      // where A→B→...→A. We check that none of the new targets already has id in its
      // transitive outbound relationship chain.
      for (const rid of uniqueIds) {
        const existingGroup = await collectPublishingGroup(pool, rid);
        if (existingGroup.has(String(id))) {
          return res.status(409).json({
            success: false,
            message: `Adding related document ${rid} would create a circular publishing dependency. Circular dependencies are not allowed.`
          });
        }
      }

      // Atomic replace — delete old links for this document
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        await connection.execute(
          'DELETE FROM document_related WHERE document_id = ?',
          [id]
        );

        for (const rid of uniqueIds) {
          await connection.execute(
            `INSERT INTO document_related (document_id, related_document_id, relationship_type, is_sync_required, created_by)
             VALUES (?, ?, ?, 1, ?)`,
            [id, rid, relationshipType || 'pending_dependency', userId]
          );
        }

        if (logAuditEvent) {
          const [docMeta] = await connection.execute('SELECT title, organization_id FROM documents WHERE document_id = ?', [id]);
          await logAuditEvent(connection, {
            orgId: docMeta[0]?.organization_id || orgId,
            userId,
            actionType: 'DOCUMENT_RELATED_UPDATED',
            resourceType: 'document',
            resourceId: id,
            documentId: id,
            details: {
              title: docMeta[0]?.title,
              relatedDocumentIds: uniqueIds,
              relationshipType,
              count: uniqueIds.length
            }
          }, true).catch(() => {});
        }

        await connection.commit();
        connection.release();

        res.json({ success: true, message: `Related documents updated (${uniqueIds.length} links)`, relatedDocumentIds: uniqueIds });
      } catch (txErr) {
        await connection.rollback();
        connection.release();
        throw txErr;
      }
    } catch (err) {
      console.error('[PUT /api/documents/:id/related]', err);
      res.status(500).json({ success: false, message: 'Failed to update related documents' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/documents-for-related
  // Returns candidate documents eligible for the Related Documents drop-down:
  //  - Published documents CANNOT be selected (excluded).
  //  - Documents in review, documents in approval, as well as in draft CAN be selected.
  // Optional query param: ?excludeId=<documentId> to exclude the current document.
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDocumentsForRelated = async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id;
      const orgId  = req.user.organization_id || req.user.orgId;
      const { excludeId } = req.query;

      // Only draft, review, approval documents — strictly exclude published, revised, archived, disabled
      const [rows] = await pool.execute(
        `SELECT
           d.document_id,
           d.title,
           d.status,
           d.version,
           d.document_number,
           d.department,
           CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
         FROM documents d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.status IN ('draft', 'pending_review', 'reviewed', 'pending_approval', 'approved', 'pending_revision')
           AND d.status NOT IN ('published', 'revised', 'archived', 'disabled')
           AND (
             d.organization_id = ?
             OR EXISTS (
               SELECT 1 FROM documentpermissions dp
               WHERE dp.document_id = d.document_id
                 AND dp.user_id = ?
                 AND dp.status = 'active'
             )
           )
         ORDER BY d.title ASC, d.updated_at DESC`,
        [orgId || 1, userId]
      );

      // Exclude self if editing an existing document
      const filtered = rows.filter(doc =>
        !(excludeId && String(doc.document_id) === String(excludeId))
      );

      res.json(filtered);
    } catch (err) {
      console.error('[GET documents-for-related]', err);
      res.status(500).json({ error: 'Failed to fetch candidate documents for related selection' });
    }
  };

  app.get('/api/documents-for-related', authenticateToken, handleDocumentsForRelated);
  app.get('/api/unpublished-documents-for-related', authenticateToken, handleDocumentsForRelated);
  app.get('/api/published-documents-for-related', authenticateToken, handleDocumentsForRelated); // legacy alias

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/documents/:id/publish-readiness
  // Returns whether a document and its required publishing group are all ready.
  // Does NOT change any state. Used by frontend to show status before publish attempt.
  // ─────────────────────────────────────────────────────────────────────────────
  app.get('/api/documents/:id/publish-readiness', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;

      const ok = await assertUserDocumentAccess(id, userId, pool, 'read');
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });

      const [docRows] = await pool.execute(
        'SELECT document_id, title, status FROM documents WHERE document_id = ?',
        [id]
      );
      if (!docRows.length) return res.status(404).json({ success: false, message: 'Document not found' });

      // Collect the full group of docs that must publish together
      const group = await collectPublishingGroup(pool, id);

      const blockedBy = [];
      const groupDetails = [];

      for (const docId of group) {
        const [rows] = await pool.execute(
          'SELECT document_id, title, status FROM documents WHERE document_id = ?',
          [docId]
        );
        if (!rows.length) continue;
        const doc = rows[0];
        groupDetails.push({ document_id: doc.document_id, title: doc.title, status: doc.status });
        if (BLOCKING_STATUSES.includes(doc.status)) {
          blockedBy.push({ document_id: doc.document_id, title: doc.title, status: doc.status });
        }
      }

      const canPublish = blockedBy.length === 0;

      res.json({
        success: true,
        canPublish,
        groupSize: group.size,
        groupDetails,
        blockedBy,
        message: canPublish
          ? group.size > 1
            ? `All ${group.size} documents in the publishing group are ready. You may publish together.`
            : 'Document is ready to publish.'
          : `Publishing is blocked. The following document(s) in the group are not yet publish-ready: ${blockedBy.map(b => `"${b.title}" (${b.status})`).join(', ')}`
      });
    } catch (err) {
      console.error('[GET /api/documents/:id/publish-readiness]', err);
      res.status(500).json({ success: false, message: 'Failed to check publish readiness' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/documents/publish-group
  // Admin-only. Atomically publishes all documents in a related publishing group.
  // ─────────────────────────────────────────────────────────────────────────────
  app.post('/api/documents/publish-group', authenticateToken, async (req, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only administrators are authorized to publish documents.'
      });
    }

    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'documentIds must be a non-empty array' });
    }

    const userId = req.user.userId || req.user.id;
    const uniqueDocIds = Array.from(new Set(documentIds.map(String)));

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Lock all rows to prevent concurrent publishes on these documents
      const placeholders = uniqueDocIds.map(() => '?').join(',');
      const [lockedDocs] = await connection.execute(
        `SELECT document_id, title, status, organization_id FROM documents
         WHERE document_id IN (${placeholders}) FOR UPDATE`,
        uniqueDocIds
      );

      if (lockedDocs.length !== uniqueDocIds.length) {
        const foundIds = new Set(lockedDocs.map(d => d.document_id));
        const missing = uniqueDocIds.filter(id => !foundIds.has(id));
        throw new Error(`Document(s) not found: ${missing.join(', ')}`);
      }

      // 2. Verify all documents are in 'approved' status
      const notApproved = lockedDocs.filter(d => d.status !== 'approved');
      if (notApproved.length > 0) {
        throw new Error(
          `Not all documents have completed their approval workflow. ` +
          `The following must reach the Approved state first: ` +
          notApproved.map(d => `"${d.title}" (${d.status})`).join(', ')
        );
      }

      // 3. Verify the supplied list is the complete required group for EACH document
      for (const docId of uniqueDocIds) {
        const fullGroup = await collectPublishingGroup(connection, docId);
        const unpublishedGroupMembers = [];
        for (const gid of fullGroup) {
          const found = lockedDocs.find(d => d.document_id === gid);
          if (!found) {
            const [statusCheck] = await connection.execute(
              'SELECT status FROM documents WHERE document_id = ?',
              [gid]
            );
            if (!statusCheck.length || statusCheck[0].status !== 'published') {
              unpublishedGroupMembers.push(gid);
            }
          }
        }
        if (unpublishedGroupMembers.length > 0) {
          throw new Error(
            `Document "${lockedDocs.find(d => d.document_id === docId)?.title}" is part of a publishing group. ` +
            `The following related documents are not included in this publish request and are not yet published: ` +
            unpublishedGroupMembers.join(', ')
          );
        }
      }

      // 4. Publish each document within the transaction
      const publishedAt = new Date();
      for (const doc of lockedDocs) {
        await connection.execute(
          `UPDATE documents SET status = 'published', updated_at = CURRENT_TIMESTAMP WHERE document_id = ?`,
          [doc.document_id]
        );

        // Retire parent versions
        await retireParentDocumentsToArchived(connection, doc.document_id);

        if (logAuditEvent) {
          await logAuditEvent(connection, {
            orgId: doc.organization_id,
            userId,
            actionType: 'DOCUMENT_GROUP_PUBLISHED',
            resourceType: 'document',
            resourceId: doc.document_id,
            documentId: doc.document_id,
            details: {
              title: doc.title,
              groupSize: uniqueDocIds.length,
              groupDocumentIds: uniqueDocIds,
              publishedAt: publishedAt.toISOString()
            }
          }, true).catch(() => {});
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `Successfully published ${uniqueDocIds.length} document(s) as a group.`,
        publishedDocumentIds: uniqueDocIds
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error('[POST /api/documents/publish-group]', err);
      res.status(err.message.includes('Access denied') ? 403 : 400).json({
        success: false,
        message: err.message || 'Failed to publish document group'
      });
    }
  });
};
