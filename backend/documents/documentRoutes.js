const { normalizeDocumentRowForClient, syncDocumentApproversWithTemplate, assertUserDocumentAccess, resetWorkflowState, retireParentDocumentsToArchived } = require('./documentHelpers');
const { preferNonSkeletonEditorContent } = require('../utils/editorContentGuards');
const { allocateNextDocumentNumber, allocateNextProjectNumber, allocateNextCostCenterNumber } = require('../auth/numberRoutes');

module.exports = function registerCoreDocumentRoutes({
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
  exportLimiter,
  logAuditEvent
}) {
// Check title/name conflict across documents and templates in real-time
app.get('/api/check-name-conflict', authenticateToken, async (req, res) => {
  try {
    const { name, excludeId, type } = req.query;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.json({ available: true });
    }
    const cleanName = name.trim();
    const orgId = req.user.organization_id || req.user.orgId || 1;

    let excludeDocIds = [];
    let excludeTemplateIds = [];

    if (excludeId) {
      if (type === 'template') {
        excludeTemplateIds.push(String(excludeId));
        // Find revision family if any
        try {
          const [tplRows] = await pool.execute('SELECT id, revision_parent_id FROM templates WHERE id = ?', [excludeId]);
          if (tplRows.length > 0) {
            const rootId = tplRows[0].revision_parent_id || tplRows[0].id;
            excludeTemplateIds.push(String(rootId));
            const [famRows] = await pool.execute('SELECT id FROM templates WHERE revision_parent_id = ? OR id = ?', [rootId, rootId]);
            famRows.forEach(r => excludeTemplateIds.push(String(r.id)));
          }
        } catch (_) {}
      } else {
        excludeDocIds.push(String(excludeId));
        // Find revision family if any
        try {
          const [docRows] = await pool.execute('SELECT document_id, revision_parent_id FROM documents WHERE document_id = ?', [excludeId]);
          if (docRows.length > 0) {
            const rootId = docRows[0].revision_parent_id || docRows[0].document_id;
            excludeDocIds.push(String(rootId));
            const [famRows] = await pool.execute('SELECT document_id FROM documents WHERE revision_parent_id = ? OR document_id = ?', [rootId, rootId]);
            famRows.forEach(r => excludeDocIds.push(String(r.document_id)));
          }
        } catch (_) {}
      }
    }

    excludeTemplateIds = Array.from(new Set(excludeTemplateIds));
    excludeDocIds = Array.from(new Set(excludeDocIds));

    let templateQuery = `SELECT 'template' as type, id, name as title FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ?`;
    let templateParams = [cleanName, orgId];
    if (excludeTemplateIds.length > 0) {
      templateQuery += ` AND id NOT IN (${excludeTemplateIds.map(() => '?').join(',')})`;
      templateParams.push(...excludeTemplateIds);
    }

    let docQuery = `SELECT 'document' as type, document_id as id, title FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?`;
    let docParams = [cleanName, orgId];
    if (excludeDocIds.length > 0) {
      docQuery += ` AND document_id NOT IN (${excludeDocIds.map(() => '?').join(',')})`;
      docParams.push(...excludeDocIds);
    }

    const [conflicts] = await pool.execute(
      `${templateQuery} UNION ALL ${docQuery} LIMIT 1`,
      [...templateParams, ...docParams]
    );

    if (conflicts.length > 0) {
      return res.json({
        available: false,
        conflictType: conflicts[0].type,
        message: `A ${conflicts[0].type} with this name already exists in your organization.`
      });
    }

    return res.json({ available: true });
  } catch (error) {
    console.error('Error checking name conflict:', error);
    res.status(500).json({ error: 'Failed to check name conflict' });
  }
});

//Route Get Documents
app.get('/api/all-docs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const docs = await dbOps.getUserAccessibleDocuments(userId);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/my-docs/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const docs = await dbOps.getUserAccessibleDocuments(userId);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Route to get all published/revised documents for Hyperlink / @-mention system
app.get(['/api/published-documents', '/api/published-docs'], authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const orgId = req.user.organization_id || req.user.orgId;
    
    const [docs] = await pool.execute(
      `SELECT d.document_id, d.organization_id, d.title, d.status, d.version, 
              d.current_revision, d.revision_parent_id, d.created_at, d.updated_at, d.document_number,
              d.project_number, d.cost_center_number, d.department,
              CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE (d.status = 'published' OR d.status = 'revised')
         AND (d.organization_id = ? OR d.created_by = ? OR EXISTS (
           SELECT 1 FROM documentpermissions dp 
           WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active'
         ))
       ORDER BY d.title ASC, d.version DESC, d.updated_at DESC`,
      [orgId || null, userId, userId]
    );

    // Deduplicate: Keep only the single latest published version per title / document revision chain
    const dedupedMap = new Map();
    for (const doc of docs) {
      const normKey = (doc.title || '').trim().toLowerCase();
      if (!dedupedMap.has(normKey)) {
        dedupedMap.set(normKey, doc);
      } else {
        const existing = dedupedMap.get(normKey);
        // Prefer 'published' over 'revised', and higher version
        if (existing.status !== 'published' && doc.status === 'published') {
          dedupedMap.set(normKey, doc);
        } else if (existing.status === doc.status && Number(doc.version || 1) > Number(existing.version || 1)) {
          dedupedMap.set(normKey, doc);
        }
      }
    }

    res.json(Array.from(dedupedMap.values()));
  } catch (error) {
    console.error('Error fetching published documents:', error);
    res.status(500).json({ error: 'Failed to fetch published documents' });
  }
});

// Route to revise a published document (creates a new version as Draft without touching Version 1)
app.post('/api/documents/:documentId/revise', authenticateToken, async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user.userId || req.user.id;
  const orgId = req.user.organization_id || req.user.orgId;

  try {
    const isAuthorized = await assertUserDocumentAccess(documentId, userId);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // 1. Fetch parent document
    const [parentDocs] = await pool.execute(
      `SELECT * FROM documents WHERE document_id = ?`,
      [documentId]
    );

    if (parentDocs.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const parent = parentDocs[0];
    const parentOrgId = parent.organization_id || orgId;

    // 2. Check if an active in-progress revision draft already exists for this parent document
    const [existingDrafts] = await pool.execute(
      `SELECT document_id, version, status, title FROM documents 
       WHERE revision_parent_id = ? AND organization_id = ? AND status IN ('draft', 'pending_revision', 'pending_review', 'pending_approval')
       ORDER BY created_at DESC LIMIT 1`,
      [documentId, parentOrgId]
    );

    if (existingDrafts.length > 0) {
      console.log(`ℹ️ [POST /api/documents/${documentId}/revise] Active revision draft ${existingDrafts[0].document_id} already exists. Returning existing draft.`);
      return res.status(200).json({
        success: true,
        document_id: existingDrafts[0].document_id,
        documentId: existingDrafts[0].document_id,
        version: existingDrafts[0].version,
        status: existingDrafts[0].status,
        message: 'An in-progress revision draft already exists for this document. Loaded existing draft.',
        resumed: true
      });
    }

    // 3. Start transaction to create Version 2 as a separate draft
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const newDocId = uuidv4();
      const parentVersion = parseInt(parent.version, 10) || 1;
      const docVersion = parentVersion + 1;
      const currentRevision = `${docVersion}.0`;
      const docStatus = 'draft';

      // Clean comments & suggestions from content and elements for new revision
      let parsedContent = {};
      try {
        parsedContent = typeof parent.content === 'string' ? JSON.parse(parent.content) : (parent.content || {});
        if (typeof parsedContent === 'string') parsedContent = JSON.parse(parsedContent);
      } catch (_) {}
      
      let parsedElements = {};
      try {
        parsedElements = typeof parent.elements === 'string' ? JSON.parse(parent.elements) : (parent.elements || {});
        if (typeof parsedElements === 'string') parsedElements = JSON.parse(parsedElements);
      } catch (_) {}

      // Strip comment highlights from HTML content - handle both { content: '...' } and { html: '...' } storage formats
      let cleanContentHtml = parsedContent.content || parsedContent.html || '';
      if (typeof cleanContentHtml === 'string') {
        cleanContentHtml = cleanContentHtml.replace(/<mark[^>]*data-comment-id="[^"]*"[^>]*>(.*?)<\/mark>/gi, '$1');
      }

      const contentObj = {
        ...parsedContent,
        content: cleanContentHtml,
        comments: [],
        suggestions: []
      };

      const elementsObj = {
        ...parsedElements,
        comments: [],
        suggestedEdits: []
      };

      // Reset workflow approvers to pending
      let cleanApprovers = parent.approvers;
      if (cleanApprovers) {
        cleanApprovers = JSON.stringify(resetWorkflowState(cleanApprovers, 'draft'));
      }

      await connection.execute(
        `INSERT INTO documents 
        (document_id, organization_id, title, template_id, created_by, status, content, elements, approvers, required_approvers, version, current_revision, revision_parent_id, impact, notes, document_number, project_number, cost_center_number, department, progress_value) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          newDocId,
          parentOrgId,
          parent.title,
          parent.template_id || null,
          userId,
          docStatus,
          JSON.stringify(contentObj),
          JSON.stringify(elementsObj),
          cleanApprovers,
          parent.required_approvers || null,
          docVersion,
          currentRevision,
          documentId,
          null, // Impact assessment resets on revision so the user fills it anew
          parent.notes || null,
          parent.document_number || null,
          parent.project_number || null,
          parent.cost_center_number || null,
          parent.department || null
        ]
      );

      // Create author permission for the revision creator
      await connection.execute(
        `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
         VALUES (?, ?, 'author', ?, 'active')`,
        [newDocId, userId, userId]
      );

      // Clone other active permissions from parent document
      const [parentPerms] = await connection.execute(
        `SELECT user_id, permission_type FROM documentpermissions WHERE document_id = ? AND status = 'active' AND user_id != ?`,
        [documentId, userId]
      );
      for (const perm of parentPerms) {
        await connection.execute(
          `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [newDocId, perm.user_id, perm.permission_type, userId]
        ).catch(() => {});
      }

      // Clone tasks from parent if any
      const [parentTasks] = await connection.execute(
        `SELECT title, description, due_date FROM tasks WHERE document_id = ?`,
        [documentId]
      );
      for (const t of parentTasks) {
        const [taskRes] = await connection.execute(
          `INSERT INTO tasks (organization_id, document_id, title, description, created_by, due_date, status)
           VALUES (?, ?, ?, ?, ?, ?, 'not_started')`,
          [parentOrgId, newDocId, t.title, t.description, userId, t.due_date]
        );
        await connection.execute(
          `INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES (?, ?, ?, 'pending')`,
          [taskRes.insertId, userId, userId]
        ).catch(() => {});
      }

      // Clone attachments from parent
      const [parentAttachments] = await connection.execute(
        'SELECT * FROM attachments WHERE association_type = "document" AND association_id = ?',
        [documentId]
      );
      for (const attachment of parentAttachments) {
        const resolvedBase = path.resolve(uploadsDir);
        const resolvedTarget = path.resolve(resolvedBase, attachment.file_path);
        const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
        if (resolvedTarget.startsWith(baseWithSep) && fs.existsSync(resolvedTarget)) {
          const uniqueId = uuidv4();
          const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
          const newFilePath = path.join(uploadsDir, newServerFileName);
          fs.copyFileSync(resolvedTarget, newFilePath);
          await connection.execute(
            'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['document', newDocId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, userId]
          );
        }
      }

      // In-transaction audit record
      if (logAuditEvent) {
        await logAuditEvent(connection, {
          orgId: parentOrgId,
          userId,
          actionType: 'DOCUMENT_REVISION_CREATED',
          resourceType: 'document',
          resourceId: newDocId,
          documentId: newDocId,
          details: { parentDocumentId: documentId, version: docVersion, title: parent.title },
          req
        }, true).catch(() => {});
      }

      await connection.commit();
      connection.release();

      console.log(`✅ Created document revision draft ${newDocId} (v${docVersion}) for parent ${documentId}`);

      res.status(201).json({
        success: true,
        document_id: newDocId,
        documentId: newDocId,
        version: docVersion,
        status: docStatus,
        message: `Version ${docVersion} draft created successfully`
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Error creating document revision:', error);
    res.status(500).json({ success: false, message: 'Failed to create document revision' });
  }
});

// Check if a newer published version of the document's template is available

app.post('/api/create-document', authenticateToken, async (req, res) => {
  const {
    title,
    template_id,
    content,
    tasks: tasksRaw,
    participants: participantsRaw,
    comments,
    suggestedEdits,
    headerHTML,
    footerHTML,
    notes,
    status: statusRaw,
    approvers: approversBody,
    required_approvers: requiredApproversBody,
    version: versionRaw,
    revision_parent_id,
    tempAttachments,
    impact
  } = req.body;
  let docVersion = parseInt(versionRaw, 10) || 1;
  const tasks = tasksRaw || [];
  const participants = participantsRaw || [];
  console.log(content);

  const userId = req.user.userId;
  const allowedStatuses = ['draft', 'pending_review', 'pending_approval'];
  let docStatus = typeof statusRaw === 'string' ? statusRaw.trim() : 'draft';
  if (!allowedStatuses.includes(docStatus)) {
    docStatus = 'draft';
  }

  let workflowJson = null;
  if (approversBody && (docStatus === 'pending_review' || docStatus === 'pending_approval')) {
    try {
      workflowJson =
        typeof approversBody === 'string' ? approversBody : JSON.stringify(approversBody);
    } catch (e) {
      workflowJson = null;
    }
  }

  let finalRequiredApprovers = requiredApproversBody || null;

  try {
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Get user's organization
      const [orgResults] = await connection.execute(
        'SELECT organization_id FROM users WHERE id = ?',
        [userId]
      );

      if (orgResults.length === 0) {
        throw new Error('User not found');
      }

      const orgId = orgResults[0].organization_id;

      // Check if an active draft/in-progress revision already exists for this parent document
      if (revision_parent_id) {
        const [existingDrafts] = await connection.execute(
          `SELECT document_id, version, status FROM documents 
           WHERE revision_parent_id = ? AND organization_id = ? AND status IN ('draft', 'pending_revision', 'pending_review', 'pending_approval')
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [revision_parent_id, orgId]
        );
        if (existingDrafts.length > 0) {
          await connection.rollback();
          connection.release();
          console.log(`ℹ️ [POST /api/newdocument] Active revision draft ${existingDrafts[0].document_id} already exists for parent ${revision_parent_id}. Returning existing draft.`);
          return res.status(200).json({
            success: true,
            document_id: existingDrafts[0].document_id,
            documentId: existingDrafts[0].document_id,
            id: existingDrafts[0].document_id,
            message: 'An in-progress revision draft already exists for this document. Loaded existing draft.',
            resumed: true
          });
        }

        // Auto-compute the correct version from the parent if not properly incremented
        try {
          const [parentRows] = await connection.execute(
            'SELECT version FROM documents WHERE document_id = ?',
            [revision_parent_id]
          );
          if (parentRows.length > 0) {
            const parentVersion = parseInt(parentRows[0].version, 10) || 1;
            if (docVersion <= parentVersion) {
              // Version was not correctly incremented by the caller — fix it
              docVersion = parentVersion + 1;
            }
          }
        } catch (verErr) {
          console.warn('[create-document] Could not auto-compute revision version from parent:', verErr.message);
        }
      }

      // Check title uniqueness across templates and documents in the organization
      if (title) {
        const cleanTitle = title.trim();
        if (revision_parent_id) {
          let rootDocId = revision_parent_id;
          let curr = revision_parent_id;
          const visited = new Set([curr]);
          while (curr) {
            const [pRows] = await connection.execute('SELECT revision_parent_id FROM documents WHERE document_id = ?', [curr]);
            if (pRows && pRows.length > 0 && pRows[0].revision_parent_id && !visited.has(pRows[0].revision_parent_id)) {
              curr = pRows[0].revision_parent_id;
              rootDocId = curr;
              visited.add(curr);
            } else {
              break;
            }
          }
          const [familyRows] = await connection.execute(
            'SELECT document_id FROM documents WHERE document_id = ? OR revision_parent_id = ?',
            [rootDocId, rootDocId]
          );
          const familyIds = Array.from(new Set([rootDocId, revision_parent_id, ...(familyRows || []).map(r => r.document_id)]));
          const placeholders = familyIds.map(() => '?').join(',');
          const [unrelatedConflict] = await connection.execute(
            `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ?
             UNION ALL
             SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ? AND document_id NOT IN (${placeholders})`,
            [cleanTitle, orgId, cleanTitle, orgId, ...familyIds]
          );
          if (unrelatedConflict.length > 0) {
            await connection.rollback();
            connection.release();
            return res.status(409).json({
              success: false,
              message: 'A document or template with this exact name already exists in your organization. Please choose a unique name.'
            });
          }
        } else {
          // Double-click defense: if current user created an identical draft in this org within 15 seconds, return it
          const [recentDrafts] = await connection.execute(
            `SELECT document_id FROM documents 
             WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ? AND created_by = ? AND status = 'draft' AND created_at >= NOW() - INTERVAL 15 SECOND
             ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
            [cleanTitle, orgId, userId]
          );
          if (recentDrafts.length > 0) {
            await connection.rollback();
            connection.release();
            return res.status(200).json({
              success: true,
              document_id: recentDrafts[0].document_id,
              documentId: recentDrafts[0].document_id,
              id: recentDrafts[0].document_id,
              message: 'Loaded existing document draft.',
              resumed: true
            });
          }

          // For brand new documents (not a revision), verify uniqueness across templates and documents
          const [unrelatedConflict] = await connection.execute(
            `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ?
             UNION ALL
             SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?`,
            [cleanTitle, orgId, cleanTitle, orgId]
          );
          if (unrelatedConflict.length > 0) {
            await connection.rollback();
            connection.release();
            return res.status(409).json({
              success: false,
              message: 'A document or template with this exact name already exists in your organization. Please choose a unique name.'
            });
          }
        }
      }

      // 2. Fetch template data if template_id is provided
      let finalWorkflowJson = workflowJson;
      let tplOrientation = 'portrait';
      let tplPaperSize = 'A4';
      let tplPagesState = null;
      if (template_id) {
        const [templateRows] = await connection.execute(
          'SELECT required_approvers, template_approvers, custom_document_approvers, comments FROM templates WHERE id = ?',
          [template_id]
        );
        if (templateRows.length > 0) {
          const tplRow = templateRows[0];
          if (tplRow.comments) {
            try {
              const parsedTplComments = typeof tplRow.comments === 'string' ? JSON.parse(tplRow.comments) : tplRow.comments;
              if (parsedTplComments?.orientation) tplOrientation = parsedTplComments.orientation;
              if (parsedTplComments?.paperSize) tplPaperSize = parsedTplComments.paperSize;
              if (parsedTplComments?.pagesState) tplPagesState = parsedTplComments.pagesState;
            } catch (e) {}
          }

          // Check if custom_document_approvers is set by admin
          if (tplRow.custom_document_approvers) {
            try {
              const parsedCustom = typeof tplRow.custom_document_approvers === 'string'
                ? JSON.parse(tplRow.custom_document_approvers)
                : tplRow.custom_document_approvers;

              if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
                let customApproversList = [];
                let selectedSet = null;
                
                // If it's the new format (array of sets)
                if (parsedCustom[0].name !== undefined) {
                  let selectedSetId = null;
                  if (finalWorkflowJson) {
                    try {
                      const wfObj = typeof finalWorkflowJson === 'string' ? JSON.parse(finalWorkflowJson) : finalWorkflowJson;
                      selectedSetId = wfObj?.selectedSetId;
                    } catch (e) {}
                  }
                  selectedSet = parsedCustom.find(s => s.id === selectedSetId) || parsedCustom[0];
                  customApproversList = selectedSet.departments || [];
                } else {
                  customApproversList = parsedCustom;
                }

                // Set required departments
                if (!finalRequiredApprovers) {
                  const customDepts = customApproversList.map((item, idx) => ({
                    key: idx,
                    department: item.department,
                    mandatory: true,
                    stage: item.stage || 1
                  }));
                  finalRequiredApprovers = JSON.stringify(customDepts);
                }

                // Set workflow reviewers and approvers
                if (!finalWorkflowJson) {
                  const customReviewers = [];
                  const customApprovers = [];
                  customApproversList.forEach(item => {
                    if (Array.isArray(item.users)) {
                      item.users.forEach(u => {
                        customReviewers.push({
                          userId: u.id,
                          name: u.name || `${u.first_name} ${u.last_name}`,
                          email: u.email,
                          department: u.department || item.department || '',
                          role: 'document_reviewer',
                          status: 'pending'
                        });
                        customApprovers.push({
                          userId: u.id,
                          name: u.name || `${u.first_name} ${u.last_name}`,
                          email: u.email,
                          department: u.department || item.department || '',
                          role: 'document_approver',
                          status: 'pending',
                          comment: ''
                        });
                      });
                    }
                  });

                  finalWorkflowJson = JSON.stringify({
                    reviewers: customReviewers,
                    approvers: customApprovers,
                    selectedSetId: selectedSet ? selectedSet.id : 'default',
                    selectedSetName: selectedSet ? selectedSet.name : 'Default Set',
                    selectedSetComment: selectedSet ? selectedSet.comment : ''
                  });
                }
              }
            } catch (e) {
              console.error('Error parsing custom_document_approvers in create-document endpoint:', e);
            }
          }
          // If custom_document_approvers was not configured for this template in Account Management,
          // do NOT inherit the template's internal reviewers/approvers (template_approvers).
          // Documents default to an empty approver workflow unless explicitly configured in Account Management.
        }
      }

      // 3. Create the document
      const docId = uuidv4();

      // Allocate or inherit document number, project number, and cost center number
      let docNumber = null;
      let deptName = req.body.department || req.body.logoTextRight || (content && content.logoTextRight) || null;
      let projNumber = null;
      let costNumber = null;

      // REVISION: When revising an existing document, the numbering MUST remain identical across all versions
      if (revision_parent_id) {
        try {
          let currId = revision_parent_id;
          const visited = new Set([currId]);
          while (currId) {
            const [pRows] = await connection.execute(
              'SELECT document_number, project_number, cost_center_number, department, revision_parent_id FROM documents WHERE document_id = ?',
              [currId]
            );
            if (pRows && pRows.length > 0) {
              const parent = pRows[0];
              if (!docNumber && parent.document_number) {
                docNumber = parent.document_number;
              }
              if (!projNumber && parent.project_number) {
                projNumber = parent.project_number;
              }
              if (!costNumber && parent.cost_center_number) {
                costNumber = parent.cost_center_number;
              }
              if (!deptName && parent.department) {
                deptName = parent.department;
              }
              if (docNumber) break;
              currId = parent.revision_parent_id && !visited.has(parent.revision_parent_id) ? parent.revision_parent_id : null;
              if (currId) visited.add(currId);
            } else {
              break;
            }
          }
        } catch (e) {
          console.warn('Error fetching parent document metadata for revision:', e);
        }
      }

      // NEW DOCUMENT: If not a revision (or parent had no number), allocate fresh sequential numbers
      if (!docNumber && deptName) {
        try {
          docNumber = await allocateNextDocumentNumber(connection, orgId, deptName);
        } catch (e) {
          console.warn('Notice allocating document number:', e.message);
        }
      }

      // Final fallback (e.g. if no rule yet for department), but NEVER reuse an existing document number for a new document!
      if (!docNumber && req.body.document_number) {
        const [existing] = await connection.execute(
          'SELECT document_id FROM documents WHERE organization_id = ? AND document_number = ? LIMIT 1',
          [orgId, req.body.document_number]
        );
        if (!existing || existing.length === 0) {
          docNumber = req.body.document_number;
        }
      }

      // Allocate fresh sequential project number if not inherited from revision
      if (!projNumber) {
        try {
          projNumber = await allocateNextProjectNumber(connection, orgId, title);
        } catch (e) {
          console.warn('Notice allocating project number:', e.message);
        }
        // Fallback to submitted project number if sequence allocation is unavailable
        if (!projNumber && req.body.project_number) {
          projNumber = req.body.project_number;
        }
      }

      // Allocate fresh sequential cost center number if not inherited from revision
      if (!costNumber) {
        try {
          costNumber = await allocateNextCostCenterNumber(connection, orgId, deptName);
        } catch (e) {
          console.warn('Notice allocating cost center number:', e.message);
        }
        // Fallback to submitted cost center number if sequence allocation is unavailable
        if (!costNumber && req.body.cost_center_number) {
          costNumber = req.body.cost_center_number;
        }
      }

      await connection.execute(
        `INSERT INTO documents 
        (document_id, organization_id, title, template_id, created_by, status, content, elements, approvers, required_approvers, version, revision_parent_id, impact, notes, document_number, project_number, cost_center_number, department) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          orgId,
          title,
          template_id || null,
          userId,
          docStatus,
          JSON.stringify(content || {}),
          JSON.stringify({
            comments: comments || [],
            suggestedEdits: suggestedEdits || [],
            headerHTML: headerHTML || '',
            footerHTML: footerHTML || '',
            logo: req.body.logo || null,
            logoText: req.body.logoText || '',
            logoTextRight: req.body.logoTextRight || '',
            orientation: req.body.orientation || tplOrientation || 'portrait',
            paperSize: req.body.paperSize || tplPaperSize || 'A4',
            pagesState: req.body.pagesState || tplPagesState || null
          }),
          finalWorkflowJson,
          finalRequiredApprovers ? (typeof finalRequiredApprovers === 'string' ? finalRequiredApprovers : JSON.stringify(finalRequiredApprovers)) : null,
          docVersion,
          revision_parent_id || null,
          impact ? JSON.stringify(impact) : null,
          notes || null,
          docNumber || null,
          projNumber || null,
          costNumber || null,
          deptName || null
        ]
      );

      // 3. Handle permissions - CRITICAL FIX HERE
      // First remove any duplicate creator entries from participants
      const filteredParticipants = participants.filter(p => p.user_id !== userId);

      // Then create permissions in one batch
      const permissionRecords = [
        [docId, userId, 'author', userId, 'active'], // Creator permission
        ...filteredParticipants.map(p => [
          docId, p.user_id, p.role, userId, 'active'
        ])
      ];

      const grantedUserIds = new Set([userId, ...filteredParticipants.map(p => p.user_id)]);

      // 4. Grant permissions to specific reviewers/approvers
      if (approversBody && (docStatus === 'pending_review' || docStatus === 'pending_approval')) {
        try {
          const wf = typeof approversBody === 'string' ? JSON.parse(approversBody) : approversBody;
          for (const row of wf.reviewers || []) {
            const uid = row.userId ?? row.id;
            if (uid == null || grantedUserIds.has(uid)) continue;
            permissionRecords.push([docId, uid, 'reviewer', userId, 'active']);
            grantedUserIds.add(uid);
          }
          for (const row of wf.approvers || []) {
            const uid = row.userId ?? row.id;
            if (uid == null || grantedUserIds.has(uid)) continue;
            permissionRecords.push([docId, uid, 'approver', userId, 'active']);
            grantedUserIds.add(uid);
          }
        } catch (e) {
          console.warn('create-document workflow permissions', e);
        }
      }

      // 5. Grant permissions to all users in departments listed in required_approvers (from finalWorkflowJson)
      if (finalWorkflowJson) {
        try {
          const parsedWorkflow = typeof finalWorkflowJson === 'string' ? JSON.parse(finalWorkflowJson) : finalWorkflowJson;
          
          // If it's an array, it's the required_approvers format [{department, stage, mandatory}]
          if (Array.isArray(parsedWorkflow)) {
            const deptNames = parsedWorkflow.map(item => item.department).filter(Boolean);
            if (deptNames.length > 0) {
              const [deptUsers] = await connection.query(
                'SELECT id FROM users WHERE organization_id = ? AND department IN (?) AND status = "active"',
                [orgId, deptNames]
              );
              
              for (const u of deptUsers) {
                if (!grantedUserIds.has(u.id)) {
                  permissionRecords.push([docId, u.id, 'viewer', userId, 'active']);
                  grantedUserIds.add(u.id);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Error granting departmental permissions:', e);
        }
      }

      await connection.query(
        `INSERT INTO documentpermissions 
        (document_id, user_id, permission_type, assigned_by, status) 
        VALUES ?`,
        [permissionRecords]
      );

      if (permissionRecords.length > 1 && logAuditEvent) {
        for (let i = 1; i < permissionRecords.length; i++) {
          const rec = permissionRecords[i];
          await logAuditEvent(connection, {
            orgId,
            userId,
            actionType: 'PERMISSION_GRANTED',
            resourceType: 'document',
            resourceId: docId,
            documentId: docId,
            details: {
              title,
              targetUserId: rec[1],
              permissionType: rec[2],
              assignedBy: rec[3]
            },
            req
          }, true).catch(() => {});
        }
      }

      // 6. Create tasks if any
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          const [taskResult] = await connection.execute(
            `INSERT INTO tasks 
            (organization_id, document_id, title, description, created_by, due_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'not_started')`,
            [orgId, docId, task.title, task.description, task.created_by, task.due_date]
          );
          const taskId = taskResult.insertId;

          // Assign task to creator by default (can be reassigned later)
          await connection.execute(
            `INSERT INTO taskassignments 
            (task_id, assigned_to, assigned_by, status) 
            VALUES (?, ?, ?, 'pending')`,
            [taskId, userId, userId]
          );
        }
      }

function getSafeUploadPath(baseUploadsDir, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return null;
  if (targetPath.indexOf('\0') !== -1) return null;
  const resolvedBase = path.resolve(baseUploadsDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (!resolvedTarget.startsWith(baseWithSep)) return null;
  return resolvedTarget;
}

      // 5. Clone attachments if this is a revision or created from template
      if (revision_parent_id) {
        try {
          const [parentAttachments] = await connection.execute(
            'SELECT * FROM attachments WHERE association_type = "document" AND association_id = ?',
            [revision_parent_id]
          );
          for (const attachment of parentAttachments) {
            const oldFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);
            if (oldFilePath && fs.existsSync(oldFilePath)) {
              const uniqueId = uuidv4();
              const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
              const newFilePath = path.join(uploadsDir, newServerFileName);
              fs.copyFileSync(oldFilePath, newFilePath);

              await connection.execute(
                'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['document', docId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, userId]
              );
            }
          }
          console.log(`✅ Copied attachments from parent document ${revision_parent_id} to new revised document ${docId}`);
        } catch (copyErr) {
          console.error('Error copying parent document attachments:', copyErr);
        }
      } else if (template_id) {
        try {
          const [templateAttachments] = await connection.execute(
            'SELECT * FROM attachments WHERE association_type = "template" AND association_id = ?',
            [template_id]
          );
          for (const attachment of templateAttachments) {
            const oldFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);
            if (oldFilePath && fs.existsSync(oldFilePath)) {
              const uniqueId = uuidv4();
              const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
              const newFilePath = path.join(uploadsDir, newServerFileName);
              fs.copyFileSync(oldFilePath, newFilePath);

              await connection.execute(
                'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['document', docId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, userId]
              );
            }
          }
          console.log(`✅ Copied attachments from template ${template_id} to new document ${docId}`);
        } catch (copyErr) {
          console.error('Error copying template attachments:', copyErr);
        }
      }

      // 6. Process new uploaded attachments if provided
      if (Array.isArray(tempAttachments) && tempAttachments.length > 0) {
        try {
          const ids = tempAttachments
            .map(t => (typeof t === 'object' && t !== null) ? t.id : t)
            .filter(id => id && !String(id).startsWith('temp-'));

          if (ids.length > 0) {
            await connection.execute(
              `UPDATE attachments SET association_type = 'document', association_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
              [docId, ...ids]
            );
            console.log(`✅ Associated ${ids.length} temp attachments to new document ${docId}`);
          }
        } catch (attachErr) {
          console.error('Error saving temp document attachments:', attachErr);
        }
      }

      // 7. Transactional audit record: Log document creation on same connection
      if (logAuditEvent) {
        await logAuditEvent(connection, {
          orgId,
          userId,
          actionType: 'DOCUMENT_CREATED',
          resourceType: 'document',
          resourceId: docId,
          documentId: docId,
          details: {
            title,
            template_id: template_id || null,
            status: docStatus,
            version: docVersion,
            revision_parent_id: revision_parent_id || null,
            participantsCount: participants.length
          },
          req
        }, true);
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        document_id: docId,
        documentId: docId,
        id: docId,
        document_number: docNumber,
        message: 'Document created successfully'
      });

    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create document'
    });
  }
});


app.get('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const docId = req.params.id;
    const userId = req.user.userId;
    const isAuthorized = await assertUserDocumentAccess(docId, userId);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let document = await dbOps.getDocumentById(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document = await syncDocumentApproversWithTemplate(document);
    res.json(normalizeDocumentRowForClient(document));
  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ==================== Document workflow (parallel to templates; uses documents.approvers JSON) ====================

async function grantDocumentWorkflowPermissions(documentId, workflowInput, assignedByUserId) {
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
  const [docRows] = await pool.execute('SELECT created_by, organization_id, title FROM documents WHERE document_id = ?', [
    documentId
  ]);
  if (!docRows || docRows.length === 0) return;
  const creatorId = docRows[0]?.created_by;
  const orgId = docRows[0]?.organization_id || 1;
  const docTitle = docRows[0]?.title;

  const activeUserIds = new Set();

  const grant = async (userIds, permissionType) => {
    for (const uid of userIds) {
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

  const reviewerIds = (wf.reviewers || []).map((r) => r.userId ?? r.id).filter((id) => id != null);
  const approverIds = (wf.approvers || []).map((a) => a.userId ?? a.id).filter((id) => id != null);
  await grant(reviewerIds, 'reviewer');
  await grant(approverIds, 'approver');

  // Deactivate non-author permissions for users removed from workflow
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

app.get('/api/get_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    let row = await dbOps.getDocumentById(documentId);
    if (!row) return res.status(404).json({ error: 'Document not found' });
    row = await syncDocumentApproversWithTemplate(row);
    res.json(normalizeDocumentRowForClient(row));
  } catch (error) {
    console.error('get_document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});


app.put('/api/update_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, error: 'Access denied' });

    const {
      title,
      content,
      elements,
      approvers,
      required_approvers,
      status,
      cover_page_data,
      version,
      revision_parent_id,
      impact,
      notes
    } = req.body;

    if (status === 'published' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Only administrators are authorized to publish documents.'
      });
    }

    // Check if status is transitioning to an archive status - block if actively referenced
    const archiveStatuses = ['archive_draft', 'pending_archive_review', 'pending_archive_approval', 'archived'];
    if (status && archiveStatuses.includes(status)) {
      const [currDocStatusRows] = await pool.query('SELECT status FROM documents WHERE document_id = ?', [documentId]);
      const currentDocStatus = (currDocStatusRows?.[0]?.status || '').toLowerCase();
      // Only block if we are transitioning FROM a non-archive status (e.g. published) into an archive status
      const isTransitioningToArchive = !archiveStatuses.includes(currentDocStatus);

      if (isTransitioningToArchive) {
        const [inboundRows] = await pool.query(
          `SELECT 
             r.source_type, r.source_id,
             sd.title AS doc_title, sd.status AS doc_status, sd.document_number AS doc_number,
             st.name AS temp_name, st.status AS temp_status
           FROM item_references r
           LEFT JOIN documents sd ON (r.source_type = 'document' AND r.source_id = sd.document_id)
           LEFT JOIN templates st ON (r.source_type = 'template' AND r.source_id = st.id)
           WHERE r.target_id = ?`,
          [String(documentId)]
        );

      const activeReferencing = [];
      for (const row of inboundRows) {
        if (String(row.source_id) === String(documentId)) continue;
        if (row.source_type === 'document' && row.doc_title) {
          const s = (row.doc_status || '').toLowerCase();
          if (!['archived', 'old'].includes(s)) {
            activeReferencing.push({ id: row.source_id, type: 'document', title: row.doc_title, number: row.doc_number });
          }
        } else if (row.source_type === 'template' && row.temp_name) {
          const s = (row.temp_status || '').toLowerCase();
          if (!['archived', 'old'].includes(s)) {
            activeReferencing.push({ id: row.source_id, type: 'template', title: row.temp_name, number: row.source_id });
          }
        }
      }

      if (activeReferencing.length > 0) {
        return res.status(409).json({
          success: false,
          blockedByReferences: true,
          error: 'This document cannot be archived because it is actively referenced by other documents or templates.',
          referencingItems: activeReferencing
        });
      }
    }
  }

    const updateParts = [];
    const params = [];

    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim() : title;
      if (cleanTitle) {
        const [currRows] = await pool.execute('SELECT title, organization_id, revision_parent_id FROM documents WHERE document_id = ?', [documentId]);
        if (currRows && currRows.length > 0) {
          const orgId = currRows[0].organization_id || 1;
          const currTitle = (currRows[0].title || '').trim();
          if (cleanTitle.toLowerCase() !== currTitle.toLowerCase()) {
            let familyIds = [String(documentId)];
            const rootId = currRows[0].revision_parent_id || documentId;
            familyIds.push(String(rootId));
            try {
              const [famRows] = await pool.execute('SELECT document_id FROM documents WHERE revision_parent_id = ? OR document_id = ?', [rootId, rootId]);
              famRows.forEach(r => familyIds.push(String(r.document_id)));
            } catch (_) {}
            familyIds = Array.from(new Set(familyIds));

            const placeholders = familyIds.map(() => '?').join(',');
            const [conflictRows] = await pool.execute(
              `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ?
               UNION ALL
               SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ? AND document_id NOT IN (${placeholders})`,
              [cleanTitle, orgId, cleanTitle, orgId, ...familyIds]
            );
            if (conflictRows && conflictRows.length > 0) {
              return res.status(409).json({
                success: false,
                message: 'A document or template with this exact name already exists in your organization. Please choose a unique name.'
              });
            }
          }
        }
      }
      updateParts.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updateParts.push('content = ?');
      params.push(safeJsonStringify(content));
    }
    if (elements !== undefined) {
      updateParts.push('elements = ?');
      params.push(safeJsonStringify(elements));
    }
    let effectiveApprovers = approvers;
    if (status !== undefined && ['draft', 'pending_revision', 'pending_review', 'pending_approval', 'pending_archive_approval', 'pending_archive_review', 'archive_draft', 'archive_reviewed'].includes(status)) {
      if (effectiveApprovers === undefined) {
        try {
          const [currDoc] = await pool.execute('SELECT approvers FROM documents WHERE document_id = ?', [documentId]);
          if (currDoc.length > 0 && currDoc[0].approvers) {
            effectiveApprovers = currDoc[0].approvers;
          }
        } catch (fetchErr) {
          console.error('Error fetching approvers for document status reset:', fetchErr);
        }
      }
      if (effectiveApprovers) {
        effectiveApprovers = resetWorkflowState(effectiveApprovers, status);
      }
      if (status === 'draft' || status === 'pending_revision' || status === 'archive_draft') {
        updateParts.push('progress_value = ?');
        params.push(0);
      }
    }

    if (effectiveApprovers !== undefined) {
      updateParts.push('approvers = ?');
      params.push(safeJsonStringify(effectiveApprovers));
    }
    if (required_approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(required_approvers));
    }
    if (status !== undefined) {
      updateParts.push('status = ?');
      params.push(status);
    }
    if (cover_page_data !== undefined) {
      updateParts.push('cover_page_data = ?');
      params.push(safeJsonStringify(cover_page_data));
    }
    if (version !== undefined) {
      updateParts.push('version = ?');
      params.push(parseInt(version, 10) || 1);
    }
    if (revision_parent_id !== undefined) {
      updateParts.push('revision_parent_id = ?');
      params.push(revision_parent_id || null);
    }
    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }
    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }
    if (req.body.template_id !== undefined) {
      updateParts.push('template_id = ?');
      params.push(req.body.template_id || null);
    }
    if (req.body.project_number !== undefined) {
      updateParts.push('project_number = ?');
      params.push(req.body.project_number || null);
    }
    if (req.body.cost_center_number !== undefined) {
      updateParts.push('cost_center_number = ?');
      params.push(req.body.cost_center_number || null);
    }
    if (req.body.department !== undefined) {
      updateParts.push('department = ?');
      params.push(req.body.department || null);
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(documentId);

    const [result] = await pool.execute(
      `UPDATE documents SET ${updateParts.join(', ')} WHERE document_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    if (approvers !== undefined) {
      await grantDocumentWorkflowPermissions(documentId, approvers, userId);
    }
    if (status === 'published') {
      await retireParentDocumentsToArchived(pool, documentId);
    }

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: req.user?.organization_id || req.user?.orgId,
        userId,
        actionType: 'DOCUMENT_UPDATED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: title !== undefined ? title : undefined,
          status: status !== undefined ? status : undefined,
          version: version !== undefined ? version : undefined,
          updatedFields: Object.keys(req.body).filter(k => k !== 'content' && k !== 'elements')
        },
        req
      });
    }

    // Sync references asynchronously if content or elements were updated
    if (content !== undefined || elements !== undefined) {
      try {
        const { syncItemReferences } = require('../references/referenceRoutes');
        if (typeof syncItemReferences === 'function') {
          syncItemReferences(pool, 'document', documentId, content, elements, userId).catch(e => console.warn('Ref sync error in update_document:', e.message));
        }
      } catch (_) {}
    }

    res.json({ success: true, message: 'Document updated', documentId });
  } catch (error) {
    console.error('update_document error:', error);
    res.status(500).json({ success: false, error: 'Failed to update document' });
  }
});

app.put('/api/update_document_content/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const { content, comments: commentsInput } = req.body;

    console.log(`[DocumentSave] Request received:`, {
      documentId,
      userId,
      hasContent: !!content,
      hasComments: !!commentsInput
    });

    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, error: 'Access denied' });

    const [rows] = await pool.execute(
      'SELECT content, elements, approvers, status FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let finalCommentsData = {};
    if (commentsInput) {
      try {
        finalCommentsData =
          typeof commentsInput === 'string' ? JSON.parse(commentsInput) : commentsInput;
      } catch (e) {
        console.error('parse commentsInput', e);
      }
    }

    // Parse existing DB elements for deep fallback
    let dbElements = {};
    try {
      if (rows[0].elements) {
        dbElements = typeof rows[0].elements === 'string'
          ? JSON.parse(rows[0].elements)
          : rows[0].elements;
      }
    } catch (e) {
      console.warn('Could not parse existing elements from DB:', e.message);
    }

    // Guard: never persist empty/skeleton HTML over existing body text
    let incomingBlocks = content || finalCommentsData.content || '';

    let existingDbContent = '';
    if (rows[0].content) {
      try {
        const parsedObj = JSON.parse(rows[0].content);
        existingDbContent = parsedObj.content;
      } catch (e) {
        existingDbContent = rows[0].content;
      }
    }
    if (!existingDbContent && dbElements.content) {
      existingDbContent = dbElements.content;
    }

    incomingBlocks = preferNonSkeletonEditorContent(incomingBlocks, existingDbContent);

    // Merge logic: use incoming data if present and not "empty", otherwise fall back to DB
    const updatedCommentsData = {
      content: incomingBlocks || existingDbContent || '',
      comments: finalCommentsData.comments || dbElements.comments || [],
      suggestions: finalCommentsData.suggestions || dbElements.suggestedEdits || [],
      references: finalCommentsData.references || dbElements.references || [],
      manualReferences: finalCommentsData.manualReferences || dbElements.manualReferences || [],
      headerHTML: (finalCommentsData.headerHTML && finalCommentsData.headerHTML.trim()) ? finalCommentsData.headerHTML : (dbElements.headerHTML || ''),
      footerHTML: (finalCommentsData.footerHTML && finalCommentsData.footerHTML.trim()) ? finalCommentsData.footerHTML : (dbElements.footerHTML || ''),
      logo: finalCommentsData.logo ? finalCommentsData.logo : (dbElements.logo || null),
      logoText: (finalCommentsData.logoText && finalCommentsData.logoText.trim()) ? finalCommentsData.logoText : (dbElements.logoText || ''),
      logoTextRight: (finalCommentsData.logoTextRight && finalCommentsData.logoTextRight.trim()) ? finalCommentsData.logoTextRight : (dbElements.logoTextRight || ''),
      orientation: finalCommentsData.orientation || dbElements.orientation || 'portrait',
      paperSize: finalCommentsData.paperSize || dbElements.paperSize || 'A4',
      pagesState: finalCommentsData.pagesState || dbElements.pagesState || null,
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId
    };

    const newElements = {
      ...dbElements,
      comments: updatedCommentsData.comments,
      suggestedEdits: updatedCommentsData.suggestions,
      references: updatedCommentsData.references,
      manualReferences: updatedCommentsData.manualReferences,
      headerHTML: updatedCommentsData.headerHTML,
      footerHTML: updatedCommentsData.footerHTML,
      logo: updatedCommentsData.logo,
      logoText: updatedCommentsData.logoText,
      logoTextRight: updatedCommentsData.logoTextRight,
      orientation: updatedCommentsData.orientation || dbElements.orientation || 'portrait',
      paperSize: updatedCommentsData.paperSize || dbElements.paperSize || 'A4',
      pagesState: updatedCommentsData.pagesState || dbElements.pagesState || null,
      content: updatedCommentsData.content
    };

    const contentJsonString = JSON.stringify({ content: updatedCommentsData.content });

    let dbApprovers = rows[0].approvers;
    let dbStatus = rows[0].status;
    let shouldUpdateApprovers = false;

    const stripHtml = (html) => {
      if (!html) return '';
      return html
        .replace(/<\/?[p|div|br|tr|td|li][^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    let dbContent = '';
    if (rows[0].content) {
      try {
        const parsed = JSON.parse(rows[0].content);
        dbContent = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || '');
      } catch (e) {
        dbContent = typeof rows[0].content === 'string' ? rows[0].content : JSON.stringify(rows[0].content || '');
      }
    }
    const incomingContent = content || updatedCommentsData.content || '';
    const incomingContentStr = typeof incomingContent === 'string' ? incomingContent : JSON.stringify(incomingContent);
    const isContentModified = stripHtml(incomingContentStr) !== stripHtml(dbContent);

    if (dbApprovers && isContentModified) {
      try {
        let parsedApprovers = typeof dbApprovers === 'string' ? JSON.parse(dbApprovers) : dbApprovers;
        let modified = false;
        let userEmail = null;
        try {
          const [userRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
          if (userRows && userRows.length > 0) userEmail = userRows[0].email;
        } catch (err) {
          console.error('email fetch', err);
        }

        if (parsedApprovers.reviewers && Array.isArray(parsedApprovers.reviewers)) {
          parsedApprovers.reviewers = parsedApprovers.reviewers.map((reviewer) => {
            const isMatchingId =
              String(reviewer.userId) === String(userId) || String(reviewer.id) === String(userId);
            const isMatchingEmail =
              userEmail && reviewer.email && reviewer.email.toLowerCase() === userEmail.toLowerCase();
            const isMatchingUser = isMatchingId || isMatchingEmail;
            const isReviewed = reviewer.status && reviewer.status.toLowerCase() === 'reviewed';

            if (isMatchingUser && isReviewed) {
              console.log(`[DocumentSave] REVERTING status for reviewer ${reviewer.email || reviewer.name} to pending`);
              modified = true;
              return { ...reviewer, status: 'pending' };
            }
            return reviewer;
          });
        }

        if (modified) {
          dbApprovers = JSON.stringify(parsedApprovers);
          shouldUpdateApprovers = true;
          // Revert document status to pending_review if it was reviewed
          // (matches template behavior — only revert review status, never approval)
          if (dbStatus === 'reviewed') {
            console.log(`[DocumentSave] REVERTING overall status to pending_review`);
            dbStatus = 'pending_review';
          }
        }
      } catch (e) {
        console.warn('approvers parse', e);
      }
    }

    console.log(`[DocumentSave] Final state to save:`, {
      shouldUpdateApprovers,
      dbStatus,
      modified: !!shouldUpdateApprovers
    });

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.execute(
        'UPDATE documents SET content = ?, elements = ?, approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [contentJsonString, JSON.stringify(newElements), dbApprovers, dbStatus, documentId]
      );
    } else {
      [result] = await pool.execute(
        'UPDATE documents SET content = ?, elements = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [contentJsonString, JSON.stringify(newElements), documentId]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Sync references asynchronously
    try {
      const { syncItemReferences } = require('../references/referenceRoutes');
      if (typeof syncItemReferences === 'function') {
        syncItemReferences(pool, 'document', documentId, contentJsonString, newElements, userId).catch(e => console.warn('Ref sync error:', e.message));
      }
    } catch (_) {}

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: req.user?.organization_id || req.user?.orgId,
        userId,
        actionType: 'DOCUMENT_UPDATED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          action: 'content_saved',
          status: dbStatus,
          isContentModified,
          approversUpdated: shouldUpdateApprovers
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Document content updated',
      documentId,
      status: dbStatus,
      template_approvers: typeof dbApprovers === 'string' ? JSON.parse(dbApprovers) : dbApprovers,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('update_document_content error:', error);
    res.status(500).json({ success: false, error: 'Failed to update document content' });
  }
});


// ============================================================================
// INTEGRATED NEW FRONTEND UI API ENDPOINTS (PART 4 CONTROLLED INTEGRATION)
// ============================================================================

// PHASE 2: Document & Template Pinning
app.patch('/api/documents/:id/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const itemId = req.params.id;

    const isAuthorized = await assertUserDocumentAccess(itemId, userId);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, 'document', itemId]
    );

    let is_pinned = false;
    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, 'document', itemId]
      );
      is_pinned = false;
    } else {
      await pool.execute(
        'INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)',
        [userId, 'document', itemId]
      );
      is_pinned = true;
    }
    res.json({ success: true, is_pinned });
  } catch (error) {
    console.error('Error toggling document pin:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});

// PHASE 3: Document & Template Progress Sliders
app.patch('/api/documents/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(id, userId);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const rawVal = req.body?.progress_value !== undefined ? req.body.progress_value : req.body?.progress;
    const val = Math.min(100, Math.max(0, parseInt(rawVal, 10) || 0));

    console.log(`📥 [PATCH /api/documents/${id}/progress] Setting progress_value to ${val}% (raw body:`, req.body, `)`);
    await pool.execute('UPDATE documents SET progress_value = ? WHERE document_id = ?', [val, id]);
    res.json({ success: true, progress_value: val });
  } catch (error) {
    console.error('❌ Error updating document progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// Remove / Delete Document (Soft delete if active/draft, or hard delete if draft)
app.delete('/api/remove_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(documentId, userId, pool, 'delete');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied to delete document' });
    }

    const [docs] = await pool.execute('SELECT organization_id, title, status FROM documents WHERE document_id = ?', [documentId]);
    if (!docs || docs.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = docs[0];

    // Delete or archive
    await pool.execute('UPDATE documents SET status = "archived", updated_at = CURRENT_TIMESTAMP WHERE document_id = ?', [documentId]);

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: doc.organization_id || req.user?.organization_id || 1,
        userId,
        actionType: 'DOCUMENT_DELETED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: doc.title,
          previousStatus: doc.status,
          newStatus: 'archived'
        },
        req
      });
    }

    res.json({ success: true, message: 'Document removed successfully', documentId });
  } catch (error) {
    console.error('Error removing document:', error);
    res.status(500).json({ success: false, error: 'Failed to remove document' });
  }
});

// Restore Document
app.put('/api/restore_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(documentId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied to restore document' });
    }

    const [docs] = await pool.execute('SELECT organization_id, title, status, approvers FROM documents WHERE document_id = ?', [documentId]);
    if (!docs || docs.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = docs[0];
    const cleanedApprovers = doc.approvers ? JSON.stringify(resetWorkflowState(doc.approvers, 'draft')) : null;
    if (cleanedApprovers) {
      await pool.execute('UPDATE documents SET status = "draft", approvers = ?, progress_value = 0, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?', [cleanedApprovers, documentId]);
    } else {
      await pool.execute('UPDATE documents SET status = "draft", progress_value = 0, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?', [documentId]);
    }

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: doc.organization_id || req.user?.organization_id || 1,
        userId,
        actionType: 'DOCUMENT_RESTORED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: {
          title: doc.title,
          previousStatus: doc.status,
          newStatus: 'draft'
        },
        req
      });
    }

    res.json({ success: true, message: 'Document restored successfully', documentId });
  } catch (error) {
    console.error('Error restoring document:', error);
    res.status(500).json({ success: false, error: 'Failed to restore document' });
  }
});

// PHASE 4: Document & Template Notes REST Endpoints
app.get('/api/documents/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserDocumentAccess(id, userId);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      `SELECT n.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
       FROM notes n 
       LEFT JOIN users u ON n.user_id = u.id 
       WHERE n.document_id = ? 
       ORDER BY n.created_at ASC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching document notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

app.post('/api/documents/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const { content, isPrivate } = req.body || {};

    const isAuthorized = await assertUserDocumentAccess(id, userId);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!content) {
      return res.status(400).json({ success: false, error: 'Note content is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, document_id, content, is_private) VALUES (?, ?, ?, ?)',
      [userId, id, content, isPrivate ? 1 : 0]
    );

    res.json({ success: true, noteId: result.insertId });
  } catch (error) {
    console.error('Error adding document note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

// PHASE 5: Task Filters & Task Comments (from Intern taskModel.js)
// PHASE 6: Audit Trail Endpoints
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId;
    if (!orgId) {
      return res.json({ success: true, data: [] });
    }

    const [logs] = await pool.execute(
      `SELECT a.id, a.organization_id, a.user_id, a.action_type, a.resource_type, a.resource_id, a.document_id, a.details, a.created_at, a.ip_address, a.user_agent, a.status,
              COALESCE(NULLIF(TRIM(a.user_name), ''), NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), a.user_email, u.email, 'System') AS user_name,
              COALESCE(NULLIF(TRIM(a.user_name), ''), NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), a.user_email, u.email, 'System') AS name,
              COALESCE(NULLIF(TRIM(a.user_email), ''), u.email, '') AS user_email,
              COALESCE(NULLIF(TRIM(a.user_email), ''), u.email, '') AS email,
              u.first_name, u.last_name
       FROM audittrail a 
       LEFT JOIN users u ON a.user_id = u.id 
       WHERE a.organization_id = ?
       ORDER BY a.created_at DESC LIMIT 200`,
      [orgId]
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

app.get('/api/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId;

    const [summaryRows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_actions,
        SUM(CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS actions_last_7_days,
        SUM(CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS actions_last_30_days
       FROM audittrail a
       ${orgId ? 'WHERE a.organization_id = ?' : ''}`,
      orgId ? [orgId] : []
    );

    const [topUsers] = await pool.execute(
      `SELECT a.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS name,
              u.email,
              COUNT(*) AS actions
       FROM audittrail a
       LEFT JOIN users u ON a.user_id = u.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY a.user_id, u.first_name, u.last_name, u.email
       ORDER BY actions DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    const [topActions] = await pool.execute(
      `SELECT a.action_type,
              COUNT(*) AS count
       FROM audittrail a
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY a.action_type
       ORDER BY count DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    const [topItems] = await pool.execute(
      `SELECT COALESCE(a.document_id, '') AS item_id,
              COALESCE(d.title, t.name, '') AS item_title,
              CASE WHEN d.document_id IS NOT NULL THEN 'Document' WHEN t.id IS NOT NULL THEN 'Template' ELSE 'Unknown' END AS item_type,
              COUNT(*) AS actions
       FROM audittrail a
       LEFT JOIN documents d ON a.document_id = d.document_id
       LEFT JOIN templates t ON a.document_id = t.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY item_id, item_title, item_type
       ORDER BY actions DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    res.json({
      success: true,
      data: {
        summary: summaryRows[0] || { total_actions: 0, actions_last_7_days: 0, actions_last_30_days: 0 },
        topUsers,
        topActions,
        topItems,
      }
    });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit summary' });
  }
});

app.get('/api/export-csv', authenticateToken, exportLimiter || ((req, res, next) => next()), async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId;

    const [logs] = await pool.execute(
      `SELECT a.*, u.first_name, u.last_name, u.email,
              d.title AS document_title,
              t.name AS template_name
       FROM audittrail a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN documents d ON a.document_id = d.document_id
       LEFT JOIN templates t ON a.document_id = t.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       ORDER BY a.created_at DESC`,
      orgId ? [orgId] : []
    );

    let csv = 'Time,User Name,Email,Action,Document ID,Item Title,Details\n';
    logs.forEach((row) => {
      const userName = row.first_name ? `${row.first_name} ${row.last_name}` : 'System';
      const details = (row.details || '').replace(/"/g, '""');
      const itemTitle = row.document_title || row.template_name || '';
      csv += `"${row.created_at}","${userName}","${row.email || ''}","${row.action_type}","${row.document_id || ''}","${itemTitle}","${details}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_trail_report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting audit logs CSV:', error);
    res.status(500).send('CSV Generation Failed');
  }
});

// PHASE 7: Trending Analytics (Extracted from Intern's trendingService.js)
app.get('/api/trending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const organizationId = req.user?.organization_id || req.user?.orgId || 1;
    const { search, type, status, favoritesOnly } = req.query || {};

    const normalizedType = String(type || 'All').trim();
    const searchTerm = String(search || '').trim();

    const documentWhere = ['1=1'];
    const documentParams = [];
    if (organizationId) {
      documentWhere.push('organization_id = ?');
      documentParams.push(organizationId);
    }
    if (searchTerm) {
      documentWhere.push('title LIKE ?');
      documentParams.push(`%${searchTerm}%`);
    }

    const templateWhere = ['1=1'];
    const templateParams = [];
    if (organizationId) {
      templateWhere.push('organization_id = ?');
      templateParams.push(organizationId);
    }
    if (searchTerm) {
      templateWhere.push('name LIKE ?');
      templateParams.push(`%${searchTerm}%`);
    }

    let documentRows = [];
    let templateRows = [];

    if (normalizedType !== 'Template') {
      const documentQuery = `SELECT document_id AS id, title, 'document' AS item_type, status, created_at, updated_at, created_by FROM documents WHERE ${documentWhere.join(' AND ')} ORDER BY created_at DESC LIMIT 50`;
      [documentRows] = await pool.execute(documentQuery, documentParams);
    }

    if (normalizedType !== 'Draft') {
      const templateQuery = `SELECT id, name AS title, 'template' AS item_type, status, created_at, updated_at, created_by FROM templates WHERE ${templateWhere.join(' AND ')} ORDER BY created_at DESC LIMIT 50`;
      [templateRows] = await pool.execute(templateQuery, templateParams);
    }

    const [pinRows] = await pool.execute(
      'SELECT item_type, item_id FROM user_pins WHERE user_id = ? AND item_type IN (?, ?)',
      [userId, 'document', 'template']
    );
    const favoriteSet = new Set(pinRows.map((row) => `${row.item_type}:${row.item_id}`));

    const combinedItems = [
      ...documentRows.map(row => ({
        id: row.id,
        title: row.title || 'Untitled Document',
        type: 'Draft',
        status: row.status || 'Draft',
        timestamp: row.created_at,
        is_favorite: favoriteSet.has(`document:${row.id}`),
        teamMembers: [{ userId: row.created_by, name: 'Author', initials: 'AU', color: 'bg-cyan-600' }]
      })),
      ...templateRows.map(row => ({
        id: row.id,
        title: row.title || 'Untitled Template',
        type: 'Template',
        status: row.status || 'Published',
        timestamp: row.created_at,
        is_favorite: favoriteSet.has(`template:${row.id}`),
        teamMembers: [{ userId: row.created_by, name: 'Author', initials: 'AU', color: 'bg-violet-600' }]
      }))
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const finalItems = favoritesOnly === 'true' || favoritesOnly === true
      ? combinedItems.filter(item => item.is_favorite)
      : combinedItems;

    res.json({ success: true, data: finalItems });
  } catch (error) {
    console.error('Error fetching trending items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending items' });
  }
});

app.post('/api/trending/favorite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { itemType, itemId } = req.body || {};

    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'itemType and itemId are required' });
    }

    const normalizedType = String(itemType).trim().toLowerCase();
    const [existingRows] = await pool.execute(
      'SELECT 1 FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, normalizedType, String(itemId)]
    );

    if (existingRows.length > 0) {
      await pool.execute('DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?', [userId, normalizedType, String(itemId)]);
      return res.json({ success: true, data: { is_favorite: false } });
    }

    await pool.execute('INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)', [userId, normalizedType, String(itemId)]);
    return res.json({ success: true, data: { is_favorite: true } });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Failed to update favorite state' });
  }
});

// ==================== Document Impact Comments Endpoints ====================
app.get('/api/documents/:id/impact-comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    let isAuthorized = await assertUserDocumentAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      const [docOrg] = await pool.execute(
        'SELECT organization_id, created_by FROM documents WHERE document_id = ?',
        [id]
      );
      if (docOrg.length > 0 && req.user?.organization_id && String(docOrg[0].organization_id) === String(req.user.organization_id)) {
        isAuthorized = true;
      }
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      'SELECT impact FROM documents WHERE document_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let impact = null;
    try {
      impact = typeof rows[0].impact === 'string' ? JSON.parse(rows[0].impact) : rows[0].impact;
    } catch (e) {
      impact = {};
    }

    const comments = (impact && Array.isArray(impact.comments)) ? impact.comments : [];
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching document impact comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch impact comments' });
  }
});

app.post('/api/documents/:id/impact-comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    let isAuthorized = await assertUserDocumentAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      const [docOrg] = await pool.execute(
        'SELECT organization_id, created_by FROM documents WHERE document_id = ?',
        [id]
      );
      if (docOrg.length > 0 && req.user?.organization_id && String(docOrg[0].organization_id) === String(req.user.organization_id)) {
        isAuthorized = true;
      }
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { comment, comments: fullCommentsList } = req.body || {};

    const [rows] = await pool.execute(
      'SELECT impact FROM documents WHERE document_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let impact = null;
    try {
      impact = typeof rows[0].impact === 'string' ? JSON.parse(rows[0].impact) : rows[0].impact;
    } catch (e) {
      impact = {};
    }
    if (!impact || typeof impact !== 'object') {
      impact = {};
    }

    let existingComments = Array.isArray(impact.comments) ? impact.comments : [];

    if (Array.isArray(fullCommentsList)) {
      impact.comments = fullCommentsList;
    } else if (comment && comment.id) {
      const existingIdx = existingComments.findIndex(c => c.id === comment.id);
      if (existingIdx >= 0) {
        existingComments[existingIdx] = comment;
      } else {
        existingComments.push(comment);
      }
      impact.comments = existingComments;
    }

    await pool.execute(
      'UPDATE documents SET impact = ? WHERE document_id = ?',
      [JSON.stringify(impact), id]
    );

    res.json({ success: true, data: impact.comments });
  } catch (error) {
    console.error('Error saving document impact comment:', error);
    res.status(500).json({ success: false, error: 'Failed to save impact comment' });
  }
});

app.delete('/api/documents/:id/impact-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user?.userId || req.user?.id;
    let isAuthorized = await assertUserDocumentAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      const [docOrg] = await pool.execute(
        'SELECT organization_id, created_by FROM documents WHERE document_id = ?',
        [id]
      );
      if (docOrg.length > 0 && req.user?.organization_id && String(docOrg[0].organization_id) === String(req.user.organization_id)) {
        isAuthorized = true;
      }
    }
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      'SELECT impact FROM documents WHERE document_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let impact = null;
    try {
      impact = typeof rows[0].impact === 'string' ? JSON.parse(rows[0].impact) : rows[0].impact;
    } catch (e) {
      impact = {};
    }
    if (!impact || typeof impact !== 'object') {
      impact = {};
    }

    let existingComments = Array.isArray(impact.comments) ? impact.comments : [];
    impact.comments = existingComments.filter(c => c.id !== commentId);

    await pool.execute(
      'UPDATE documents SET impact = ? WHERE document_id = ?',
      [JSON.stringify(impact), id]
    );

    res.json({ success: true, data: impact.comments });
  } catch (error) {
    console.error('Error deleting document impact comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete impact comment' });
  }
});

};

