const { assertUserDocumentAccess, resetWorkflowState, retireParentDocumentsToArchived } = require('./documentHelpers');

module.exports = function registerDocumentWorkflowRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  io,
  safeJsonStringify,
  uploadsDir,
  uuidv4,
  fs,
  path,
  uploadLimiter,
  logAuditEvent
}) {
  async function syncDocumentWorkflowPermissions(documentId, workflowInput, assignedByUserId) {
    if (workflowInput === undefined || workflowInput === null) return;
    let wf = workflowInput;
    if (typeof wf === 'string') {
      try {
        wf = JSON.parse(wf);
      } catch (e) {
        return;
      }
    }
    if (!wf || typeof wf !== 'object') return;
    const [docRows] = await pool.execute('SELECT created_by, organization_id, title FROM documents WHERE document_id = ?', [documentId]);
    if (!docRows || docRows.length === 0) return;
    const creatorId = docRows[0]?.created_by;
    const orgId = docRows[0]?.organization_id || 1;
    const docTitle = docRows[0]?.title;

    const activeUserIds = new Set();

    const grantList = async (list, permissionType) => {
      for (const item of list || []) {
        const uid = item.userId ?? item.id;
        if (uid == null || Number(uid) === Number(creatorId)) continue;
        const numUid = Number(uid);
        activeUserIds.add(numUid);

        await pool.execute(
          `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
           VALUES (?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type), assigned_by = VALUES(assigned_by), status = 'active'`,
          [documentId, numUid, permissionType, assignedByUserId || creatorId]
        );

        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId,
            userId: assignedByUserId || creatorId,
            actionType: 'PERMISSION_GRANTED',
            resourceType: 'document',
            resourceId: documentId,
            documentId,
            details: {
              title: docTitle,
              targetUserId: numUid,
              permissionType,
              assignedBy: assignedByUserId || creatorId
            }
          }).catch(() => {});
        }
      }
    };

    await grantList(wf.reviewers, 'reviewer');
    await grantList(wf.approvers, 'approver');

    // Deactivate non-author permissions for users who were removed from this document's workflow
    const [existingPerms] = await pool.execute(
      `SELECT user_id, permission_type FROM documentpermissions WHERE document_id = ? AND status = 'active' AND permission_type != 'author'`,
      [documentId]
    );

    for (const p of existingPerms) {
      if (Number(p.user_id) !== Number(creatorId) && !activeUserIds.has(Number(p.user_id))) {
        await pool.execute(
          `UPDATE documentpermissions SET status = 'inactive' WHERE document_id = ? AND user_id = ? AND permission_type != 'author'`,
          [documentId, p.user_id]
        );
        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId,
            userId: assignedByUserId || creatorId,
            actionType: 'PERMISSION_REVOKED',
            resourceType: 'document',
            resourceId: documentId,
            documentId,
            details: {
              title: docTitle,
              targetUserId: p.user_id,
              permissionType: p.permission_type,
              assignedBy: assignedByUserId || creatorId
            }
          }).catch(() => {});
        }
      }
    }
  }

  // Backward compatibility alias
  const grantDocumentWorkflowPermissions = syncDocumentWorkflowPermissions;
app.get('/api/template-update-notice/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(documentId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get the document's template_id
    const [docs] = await pool.execute(
      'SELECT template_id FROM documents WHERE document_id = ?',
      [documentId]
    );

    if (!docs.length || !docs[0].template_id) {
      return res.json({ hasNewerVersion: false });
    }

    const originalTemplateId = docs[0].template_id;

    // 2. Try to get the original template info
    let isBaseDocument = false;
    let originalTemplate = null;

    const [originalRows] = await pool.execute(
      'SELECT id, name, version FROM templates WHERE id = ?',
      [originalTemplateId]
    );

    if (originalRows.length) {
      originalTemplate = originalRows[0];
    } else {
      // Not in templates, check if it exists in documents (as a base document)
      const [originalDocRows] = await pool.execute(
        'SELECT document_id as id, title as name, version FROM documents WHERE document_id = ?',
        [originalTemplateId]
      );
      if (originalDocRows.length) {
        originalTemplate = originalDocRows[0];
        isBaseDocument = true;
      }
    }

    if (!originalTemplate) {
      return res.json({ hasNewerVersion: false });
    }

    // 3. Walk the FULL revision chain to find the latest published version.
    let currentId = originalTemplateId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      let children = [];
      if (isBaseDocument) {
        const [rows] = await pool.execute(
          `SELECT document_id as id, title as name, version, status FROM documents
           WHERE revision_parent_id = ?
           ORDER BY version DESC LIMIT 1`,
          [currentId]
        );
        children = rows;
      } else {
        const [rows] = await pool.execute(
          `SELECT id, name, version, status FROM templates
           WHERE revision_parent_id = ?
           ORDER BY version DESC LIMIT 1`,
          [currentId]
        );
        children = rows;
      }

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.id === originalTemplateId) {
      return res.json({ hasNewerVersion: false });
    }

    return res.json({
      hasNewerVersion: true,
      newTemplate: {
        id: latestPublished.id,
        name: latestPublished.name,
        version: latestPublished.version,
      },
      oldTemplate: {
        id: originalTemplateId,
        name: originalTemplate.name,
        version: originalTemplate.version,
      }
    });
  } catch (error) {
    console.error('Error checking template update notice:', error);
    res.status(500).json({ error: 'Failed to check template update' });
  }
});

// Check if a newer published version of the template itself is available

app.put('/api/update-document-status/:documentId', authenticateToken, async (req, res) => {
  const { documentId } = req.params;
  const { status } = req.body;
  const userId = req.user.userId;

  if (status === 'published' && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only administrators are authorized to publish documents.'
    });
  }

  try {
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Verify user has permission to update this document
      const [permissionResults] = await connection.execute(
        `SELECT permission_type FROM documentpermissions 
         WHERE document_id = ? AND user_id = ? AND status = 'active'`,
        [documentId, userId]
      );

      if (permissionResults.length === 0) {
        throw new Error('You do not have permission to update this document');
      }

      const permissionType = permissionResults[0].permission_type;

      // 2. Validate status transition based on permission type
      const validTransitions = {
        'author': ['in_review', 'for_approval', 'published'],
      };

      if (!validTransitions[permissionType]?.includes(status)) {
        throw new Error(`User with ${permissionType} role cannot set status to ${status}`);
      }

      // 3. Update document status
      await connection.execute(
        `UPDATE documents SET status = ?, updated_at = NOW()
         WHERE document_id = ?`,
        [status, documentId]
      );

      if (status === 'published') {
        await retireParentDocumentsToArchived(connection, documentId);
      }

      // In-transaction audit record
      if (logAuditEvent) {
        const [docOrg] = await connection.execute('SELECT organization_id, title FROM documents WHERE document_id = ?', [documentId]);
        const orgId = docOrg[0]?.organization_id || 1;
        await logAuditEvent(connection, {
          orgId,
          userId,
          actionType: 'DOCUMENT_STATUS_CHANGED',
          resourceType: 'document',
          resourceId: documentId,
          documentId,
          details: { oldStatus: permissionType, newStatus: status, title: docOrg[0]?.title },
          req
        }, true);
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(200).json({
        success: true,
        message: `Document status updated to ${status} successfully`
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update document status'
    });
  }
});

app.put('/api/documents/:documentId/workflow-status', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;
    if (!documentId || !status) {
      return res.status(400).json({ success: false, message: 'documentId and status required' });
    }
    if (status === 'published' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only administrators are authorized to publish documents.'
      });
    }
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });

    const [currDoc] = await pool.execute('SELECT approvers, progress_value FROM documents WHERE document_id = ?', [documentId]);
    if (currDoc.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    let updatedApprovers = currDoc[0].approvers;
    let shouldUpdateApprovers = false;
    let progressVal = currDoc[0].progress_value ?? 0;

    if (['draft', 'pending_revision', 'pending_review', 'pending_approval'].includes(status)) {
      if (updatedApprovers) {
        const cleaned = resetWorkflowState(updatedApprovers, status);
        updatedApprovers = JSON.stringify(cleaned);
        shouldUpdateApprovers = true;
      }
      if (status === 'draft' || status === 'pending_revision') {
        progressVal = 0;
        shouldUpdateApprovers = true;
      }
    }

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.execute(
        'UPDATE documents SET status = ?, approvers = ?, progress_value = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [status, updatedApprovers, progressVal, documentId]
      );
    } else {
      [result] = await pool.execute(
        'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [status, documentId]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (updatedApprovers) {
      await syncDocumentWorkflowPermissions(documentId, updatedApprovers, userId);
    }
    if (status === 'published') {
      await retireParentDocumentsToArchived(pool, documentId);
    }
    res.json({
      success: true,
      message: 'Document status updated',
      status,
      approvers: updatedApprovers ? (typeof updatedApprovers === 'string' ? JSON.parse(updatedApprovers) : updatedApprovers) : null,
      progress_value: progressVal
    });
  } catch (error) {
    console.error('workflow-status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Update Document Status (replicated from /api/templates/:id/status)
app.put('/api/documents/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Document ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    if (status === 'published' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only administrators are authorized to publish documents.'
      });
    }

    const isAuthorized = await assertUserDocumentAccess(id, userId);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [currDoc] = await pool.execute('SELECT approvers, progress_value FROM documents WHERE document_id = ?', [id]);
    if (currDoc.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    let updatedApprovers = currDoc[0].approvers;
    let shouldUpdateApprovers = false;
    let progressVal = currDoc[0].progress_value ?? 0;

    if (req.body.approvers || req.body.template_approvers) {
      const incoming = req.body.approvers || req.body.template_approvers;
      updatedApprovers = typeof incoming === 'string' ? incoming : JSON.stringify(incoming);
      shouldUpdateApprovers = true;
    } else if (['draft', 'pending_revision', 'pending_review', 'pending_approval', 'pending_archive_approval', 'pending_archive_review', 'archive_draft', 'archive_reviewed'].includes(status)) {
      if (updatedApprovers) {
        const cleaned = resetWorkflowState(updatedApprovers, status);
        updatedApprovers = JSON.stringify(cleaned);
        shouldUpdateApprovers = true;
      }
      if (status === 'draft' || status === 'pending_revision' || status === 'archive_draft') {
        progressVal = 0;
        shouldUpdateApprovers = true;
      }
    }

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.query(
        'UPDATE documents SET status = ?, approvers = ?, progress_value = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [status, updatedApprovers, progressVal, id]
      );
    } else {
      [result] = await pool.query(
        'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [status, id]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    if (updatedApprovers) {
      await syncDocumentWorkflowPermissions(id, updatedApprovers, userId);
    }

    // Auto-retire parent document versions to 'archived' when a document revision is published
    if (status === 'published') {
      await retireParentDocumentsToArchived(pool, id);
    }

    res.json({
      success: true,
      message: 'Document status updated successfully',
      status,
      progress_value: progressVal,
      approvers: updatedApprovers ? (typeof updatedApprovers === 'string' ? JSON.parse(updatedApprovers) : updatedApprovers) : null
    });

  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if a newer published version of a document is available (revision chain walking)
// Replicated from /api/template-update-notice/:documentId
app.get('/api/document-update-notice/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(documentId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get the document info
    const [docs] = await pool.execute(
      'SELECT document_id, title, version, status, revision_parent_id FROM documents WHERE document_id = ?',
      [documentId]
    );

    if (!docs.length) {
      return res.json({ hasNewerVersion: false });
    }

    const originalDocument = docs[0];

    // 2. Walk the FULL revision chain to find the latest published version.
    //    v1 -> v2 -> v3 -> ... -> vN
    //    We keep following until no more children exist, tracking the
    //    most recent published node we encounter along the way.
    let currentId = documentId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const [children] = await pool.execute(
        `SELECT document_id, title, version, status FROM documents
         WHERE revision_parent_id = ?
         ORDER BY version DESC LIMIT 1`,
        [currentId]
      );

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.document_id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.document_id === documentId) {
      return res.json({ hasNewerVersion: false });
    }

    return res.json({
      hasNewerVersion: true,
      newDocument: {
        id: latestPublished.document_id,
        title: latestPublished.title,
        version: latestPublished.version,
      },
      oldDocument: {
        id: documentId,
        title: originalDocument.title,
        version: originalDocument.version,
      }
    });
  } catch (error) {
    console.error('Error checking document update notice:', error);
    res.status(500).json({ error: 'Failed to check document update' });
  }
});

// Update document template_id reference
app.put('/api/documents/:documentId/update-template-reference', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { templateId } = req.body;
    if (!documentId || !templateId) {
      return res.status(400).json({ error: 'documentId and templateId are required' });
    }
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ error: 'Access denied' });

    await pool.execute(
      'UPDATE documents SET template_id = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [templateId, documentId]
    );

    res.json({ success: true, message: 'Document template reference updated successfully' });
  } catch (error) {
    console.error('Error updating template reference:', error);
    res.status(500).json({ error: 'Failed to update template reference' });
  }
});

app.put('/api/document_review/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;

    if (!documentId || !userId) {
      return res.status(400).json({ success: false, error: 'Document ID and user authentication are required' });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    const [docResult] = await pool.execute(
      'SELECT approvers, status FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name, department FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    let reviewerDept = null;
    let reviewerIndex = workflow.reviewers.findIndex(
      (r) => String(r.userId || r.id) === String(userId) || 
             (r.email && userEmail && r.email.toLowerCase() === userEmail.toLowerCase())
    );
    if (reviewerIndex === -1) {
      if (isGlobalApprover) {
        if (!workflow.reviewers || workflow.reviewers.length === 0) {
          reviewerDept = userObj.department || '';
          workflow.reviewers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Reviewer',
            department: reviewerDept,
            role: 'document_reviewer',
            status: 'Reviewed',
            reviewedAt: new Date().toISOString(),
            actionDate: new Date().toISOString(),
            ...(req.body.comment ? { comment: req.body.comment } : {})
          }];
          reviewerIndex = 0;
        } else {
          const pendingIdx = workflow.reviewers.findIndex(r => r.status !== 'Reviewed');
          if (pendingIdx !== -1) {
            reviewerDept = workflow.reviewers[pendingIdx].department || userObj.department || '';
            workflow.reviewers[pendingIdx] = {
              ...workflow.reviewers[pendingIdx],
              status: 'Reviewed',
              reviewedAt: new Date().toISOString(),
              actionDate: new Date().toISOString(),
              reviewedBy: userId,
              ...(req.body.comment ? { comment: req.body.comment } : {})
            };
            reviewerIndex = pendingIdx;
          } else {
            reviewerIndex = 0;
            reviewerDept = workflow.reviewers[0]?.department || '';
          }
        }
      } else {
        return res.status(403).json({ success: false, error: 'User is not authorized to review this document' });
      }
    } else {
      reviewerDept = workflow.reviewers[reviewerIndex].department;
      const nowIso = new Date().toISOString();
      const docReviewComment = req.body.comment || '';
      if (reviewerDept) {
        workflow.reviewers = workflow.reviewers.map((r) => {
          if (r.department === reviewerDept && r.status === 'pending') {
            return {
              ...r,
              status: 'Reviewed',
              reviewedAt: nowIso,
              actionDate: nowIso,
              ...(docReviewComment ? { comment: docReviewComment } : {})
            };
          }
          return r;
        });
      } else {
        workflow.reviewers[reviewerIndex] = {
          ...workflow.reviewers[reviewerIndex],
          status: 'Reviewed',
          reviewedAt: nowIso,
          actionDate: nowIso,
          ...(docReviewComment ? { comment: docReviewComment } : {})
        };
      }
    }
    const allReviewed = workflow.reviewers.every((r) => r.status === 'Reviewed');
    let newStatus;
    if (docResult[0].status === 'pending_archive_review') {
      newStatus = allReviewed ? 'archive_reviewed' : 'pending_archive_review';
    } else {
      newStatus = allReviewed ? 'reviewed' : 'pending_review';
    }
    await pool.execute(
      'UPDATE documents SET approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), newStatus, documentId]
    );

    if (logAuditEvent) {
      const [docOrg] = await pool.execute('SELECT organization_id, title FROM documents WHERE document_id = ?', [documentId]);
      await logAuditEvent(pool, {
        orgId: docOrg[0]?.organization_id || 1,
        userId,
        actionType: 'DOCUMENT_REVIEWED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: docOrg[0]?.title,
          department: reviewerDept || null,
          allReviewed,
          newStatus
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Document reviewed successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_review error:', error);
    res.status(500).json({ success: false, error: 'Failed to review document' });
  }
});

app.put('/api/document_approve/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;

    if (!documentId || !userId) {
      return res.status(400).json({ success: false, error: 'Document ID and user authentication are required' });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    const [docResult] = await pool.execute(
      'SELECT approvers, status, revision_parent_id, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name, department FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    let approverDept = null;
    let approverIndex = workflow.approvers.findIndex(
      (a) => String(a.userId || a.id) === String(userId) || 
             (a.email && userEmail && a.email.toLowerCase() === userEmail.toLowerCase())
    );
    if (approverIndex === -1) {
      if (isGlobalApprover && docResult[0].status !== 'pending_archive_approval') {
        if (!workflow.approvers || workflow.approvers.length === 0) {
          const nowIso = new Date().toISOString();
          const docApproveComment = req.body.comment || '';
          approverDept = userObj.department || '';
          workflow.approvers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Approver',
            department: approverDept,
            role: 'document_approver',
            status: 'Approved',
            approvedAt: nowIso,
            actionDate: nowIso,
            ...(docApproveComment ? { comment: docApproveComment } : {})
          }];
          approverIndex = 0;
        } else {
          const pendingIdx = workflow.approvers.findIndex(a => a.status !== 'Approved');
          if (pendingIdx !== -1) {
            const nowIso = new Date().toISOString();
            const docApproveComment = req.body.comment || '';
            approverDept = workflow.approvers[pendingIdx].department || userObj.department || '';
            workflow.approvers[pendingIdx] = {
              ...workflow.approvers[pendingIdx],
              status: 'Approved',
              approvedAt: nowIso,
              actionDate: nowIso,
              approvedBy: userId,
              ...(docApproveComment ? { comment: docApproveComment } : {})
            };
            approverIndex = pendingIdx;
          } else {
            approverIndex = 0;
            approverDept = workflow.approvers[0]?.department || '';
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          error: docResult[0].status === 'pending_archive_approval'
            ? 'Only assigned approvers are authorized to approve this archive request'
            : 'User is not authorized to approve this document'
        });
      }
    } else {
      // Stage validation (bypassed for archive approval requests)
      approverDept = workflow.approvers[approverIndex].department;
      if (approverDept && docResult[0].status !== 'pending_archive_approval') {
        let requiredApprovers = [];
        if (docResult[0].required_approvers) {
          try {
            requiredApprovers = typeof docResult[0].required_approvers === 'string'
              ? JSON.parse(docResult[0].required_approvers)
              : docResult[0].required_approvers;
          } catch (e) {}
        }

        if (Array.isArray(requiredApprovers)) {
          const deptConfig = requiredApprovers.find(r => r.department === approverDept);
          if (deptConfig) {
            const userStage = deptConfig.stage || 1;
            const isDeptCompleted = (deptName) => {
              const deptApprovers = workflow.approvers.filter(a => a.department === deptName);
              if (deptApprovers.length === 0) return true;
              return deptApprovers.some(a => a.status === 'Approved');
            };
            const isBlocked = requiredApprovers.some(r => {
              const stage = r.stage || 1;
              if (stage < userStage) {
                return !isDeptCompleted(r.department);
              }
              return false;
            });
            if (isBlocked && !isAdmin) {
              return res.status(403).json({ success: false, error: 'Currently, a different stage department is working on the approval.' });
            }
          }
        }
      }

      const nowIso = new Date().toISOString();
      const docApproveComment = req.body.comment || '';
      if (approverDept && docResult[0].status !== 'pending_archive_approval') {
        workflow.approvers = workflow.approvers.map((a) => {
          if (a.department === approverDept && a.status === 'pending') {
            return {
              ...a,
              status: 'Approved',
              approvedAt: nowIso,
              actionDate: nowIso,
              ...(docApproveComment ? { comment: docApproveComment } : {})
            };
          }
          return a;
        });
      } else {
        workflow.approvers[approverIndex] = {
          ...workflow.approvers[approverIndex],
          status: 'Approved',
          approvedAt: nowIso,
          actionDate: nowIso,
          ...(docApproveComment ? { comment: docApproveComment } : {})
        };
      }
    }
    const allApproved = workflow.approvers.every((a) => a.status === 'Approved');
    let newStatus;
    if (docResult[0].status === 'pending_archive_approval') {
      newStatus = allApproved ? 'archived' : 'pending_archive_approval';
    } else {
      newStatus = allApproved ? 'approved' : 'pending_approval';
    }
    await pool.execute(
      'UPDATE documents SET approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), newStatus, documentId]
    );

    await syncDocumentWorkflowPermissions(documentId, workflow, userId);

    if (logAuditEvent) {
      const [docOrg] = await pool.execute('SELECT organization_id, title FROM documents WHERE document_id = ?', [documentId]);
      await logAuditEvent(pool, {
        orgId: docOrg[0]?.organization_id || 1,
        userId,
        actionType: 'DOCUMENT_APPROVED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: docOrg[0]?.title,
          department: approverDept || null,
          allApproved,
          newStatus
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Document approved successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_approve error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve document' });
  }
});

app.put('/api/document_reject/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;
    const { comment } = req.body || {};

    if (!documentId || !userId) {
      return res.status(400).json({ success: false, error: 'Document ID and user authentication are required' });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    const [docResult] = await pool.execute(
      'SELECT approvers, status, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name, department FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    let approverDept = null;
    let approverIndex = workflow.approvers.findIndex(
      (a) => String(a.userId || a.id) === String(userId) || 
             (a.email && userEmail && a.email.toLowerCase() === userEmail.toLowerCase())
    );
    if (approverIndex === -1) {
      if (isGlobalApprover && docResult[0].status !== 'pending_archive_approval') {
        if (!workflow.approvers || workflow.approvers.length === 0) {
          approverDept = userObj.department || '';
          workflow.approvers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Approver',
            department: approverDept,
            role: 'document_approver',
            status: 'Rejected',
            rejectedAt: new Date().toISOString(),
            comment: comment || ''
          }];
          approverIndex = 0;
        } else {
          const pendingIdx = workflow.approvers.findIndex(a => a.status !== 'Approved' && a.status !== 'Rejected');
          if (pendingIdx !== -1) {
            approverDept = workflow.approvers[pendingIdx].department || userObj.department || '';
            workflow.approvers[pendingIdx] = {
              ...workflow.approvers[pendingIdx],
              status: 'Rejected',
              rejectedAt: new Date().toISOString(),
              comment: comment || '',
              rejectedBy: userId
            };
            approverIndex = pendingIdx;
          } else {
            approverIndex = 0;
            approverDept = workflow.approvers[0]?.department || '';
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          error: docResult[0].status === 'pending_archive_approval'
            ? 'Only assigned approvers are authorized to reject this archive request'
            : 'User is not authorized to reject this document'
        });
      }
    } else {
      // Stage validation (bypassed for archive approval requests)
      approverDept = workflow.approvers[approverIndex].department;
      if (approverDept && docResult[0].status !== 'pending_archive_approval') {
        let requiredApprovers = [];
        if (docResult[0].required_approvers) {
          try {
            requiredApprovers = typeof docResult[0].required_approvers === 'string'
              ? JSON.parse(docResult[0].required_approvers)
              : docResult[0].required_approvers;
          } catch (e) {}
        }

        if (Array.isArray(requiredApprovers)) {
          const deptConfig = requiredApprovers.find(r => r.department === approverDept);
          if (deptConfig) {
            const userStage = deptConfig.stage || 1;
            const isDeptCompleted = (deptName) => {
              const deptApprovers = workflow.approvers.filter(a => a.department === deptName);
              if (deptApprovers.length === 0) return true;
              return deptApprovers.some(a => a.status === 'Approved');
            };
            const isBlocked = requiredApprovers.some(r => {
              const stage = r.stage || 1;
              if (stage < userStage) {
                return !isDeptCompleted(r.department);
              }
              return false;
            });
            if (isBlocked && !isAdmin) {
              return res.status(403).json({ success: false, error: 'Currently, a different stage department is working on the approval.' });
            }
          }
        }
      }

      workflow.approvers[approverIndex] = {
        ...workflow.approvers[approverIndex],
        status: 'Rejected',
        rejectedAt: new Date().toISOString(),
        comment: comment || ''
      };
    }

    let newStatus = 'pending_review';
    if (docResult[0].status === 'pending_archive_approval' || docResult[0].status === 'pending_archive_review') {
      newStatus = 'published';
    }

    await pool.execute(
      'UPDATE documents SET approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), newStatus, documentId]
    );

    await syncDocumentWorkflowPermissions(documentId, workflow, userId);

    if (logAuditEvent) {
      const [docOrg] = await pool.execute('SELECT organization_id, title FROM documents WHERE document_id = ?', [documentId]);
      await logAuditEvent(pool, {
        orgId: docOrg[0]?.organization_id || 1,
        userId,
        actionType: 'DOCUMENT_REJECTED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: docOrg[0]?.title,
          department: approverDept || null,
          comment: comment || ''
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Document rejected successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_reject error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject document' });
  }
});


app.put('/api/documents/:documentId/reassign', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const authUserId = req.user?.userId;
    const { currentUserId, newUser } = req.body;
    
    if (!documentId || !newUser || !newUser.id) {
      return res.status(400).json({ success: false, error: 'Required fields are missing' });
    }

    // Fetch document
    const [docResult] = await pool.execute(
      'SELECT approvers, status, created_by, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const docRow = docResult[0];
    const isAuthor = String(docRow.created_by) === String(authUserId);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'project_manager';
    const targetUserId = currentUserId;
    const isSelf = (targetUserId && String(targetUserId) === String(authUserId)) ||
      (req.body.targetEmail && req.user?.email && req.body.targetEmail.toLowerCase() === req.user.email.toLowerCase());

    // Only the document owner, an admin, or the assigned reviewer/approver themself can reassign
    if (!isAuthor && !isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: 'Unauthorized. Only the document owner, an admin, or the assigned reviewer can reassign.' });
    }

    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docRow.approvers ? JSON.parse(docRow.approvers) : workflow;
    } catch (e) {
      console.error('parse approvers error', e);
    }

    const targetEmail = req.body.targetEmail;
    // Find the target user in reviewers or approvers
    let userIndex = -1;
    let listName = '';

    const matchUser = (u) => {
      const idMatch = targetUserId && String(u.userId ?? u.id) === String(targetUserId);
      const emailMatch = targetEmail && u.email && u.email.toLowerCase() === targetEmail.toLowerCase();
      const isPending = !u.status || String(u.status).toLowerCase() === 'pending';
      return (idMatch || emailMatch) && isPending;
    };

    if (docRow.status === 'pending_review' || docRow.status === 'reviewed') {
      listName = 'reviewers';
      userIndex = (workflow.reviewers || []).findIndex(matchUser);
    } else if (docRow.status === 'pending_approval') {
      listName = 'approvers';
      userIndex = (workflow.approvers || []).findIndex(matchUser);
    }

    if (userIndex === -1) {
      userIndex = (workflow.reviewers || []).findIndex(matchUser);
      if (userIndex !== -1) {
        listName = 'reviewers';
      } else {
        userIndex = (workflow.approvers || []).findIndex(matchUser);
        if (userIndex !== -1) listName = 'approvers';
      }
    }

    if (userIndex === -1) {
      return res.status(403).json({ success: false, error: 'User does not have pending authority on this document to reassign.' });
    }

    // Swap / replace the user in the list
    workflow[listName][userIndex] = {
      ...workflow[listName][userIndex],
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      status: 'pending' // reset to pending for the new assignee
    };

    // Save back to DB
    await pool.execute(
      'UPDATE documents SET approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), documentId]
    );

    // Sync permissions
    await grantDocumentWorkflowPermissions(documentId, workflow, docRow.created_by);

    // Deactivate permission for the previous user
    const prevUserId = targetUserId || authUserId;
    await pool.execute(
      'UPDATE documentpermissions SET status = "inactive" WHERE document_id = ? AND (user_id = ? OR user_id = ?) AND permission_type != "author"',
      [documentId, prevUserId, authUserId]
    );

    if (req.body.targetEmail) {
      try {
        await pool.execute(
          'UPDATE documentpermissions dp JOIN users u ON dp.user_id = u.id SET dp.status = "inactive" WHERE dp.document_id = ? AND LOWER(u.email) = ? AND dp.permission_type != "author"',
          [documentId, req.body.targetEmail.toLowerCase()]
        );
      } catch (e) {
        console.warn('Deactivate by email warning:', e);
      }
    }

    if (logAuditEvent) {
      const [docOrg] = await pool.execute('SELECT organization_id, title FROM documents WHERE document_id = ?', [documentId]);
      const orgId = docOrg[0]?.organization_id || 1;
      const docTitle = docOrg[0]?.title;

      await logAuditEvent(pool, {
        orgId,
        userId: authUserId,
        actionType: 'PERMISSION_REVOKED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: docTitle,
          revokedUserId: targetUserId,
          role: listName,
          reason: 'reassigned'
        },
        req
      });

      await logAuditEvent(pool, {
        orgId,
        userId: authUserId,
        actionType: 'DOCUMENT_REASSIGNED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: docTitle,
          listName,
          previousAssigneeId: targetUserId,
          newAssigneeId: newUser.id,
          newAssigneeName: newUser.name,
          newAssigneeEmail: newUser.email
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Authority reassigned successfully',
      template_approvers: workflow,
      required_approvers: docRow.required_approvers ? JSON.parse(docRow.required_approvers) : []
    });
  } catch (error) {
    console.error('Reassign error:', error);
    res.status(500).json({ success: false, error: 'Failed to reassign authority' });
  }
});

};
