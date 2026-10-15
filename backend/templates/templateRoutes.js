const { assertUserTemplateAccess, resetWorkflowState, retireParentTemplatesToArchived } = require('../documents/documentHelpers');
const { preferNonSkeletonEditorContent } = require('../utils/editorContentGuards');

module.exports = function registerCoreTemplateRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  io,
  safeJsonStringify,
  uuidv4,
  fs,
  path,
  aiLimiter,
  logAuditEvent
}) {
app.get('/api/template-version-notice/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get the template info
    const [originalRows] = await pool.execute(
      'SELECT id, name, version FROM templates WHERE id = ?',
      [templateId]
    );
    if (!originalRows.length) {
      return res.json({ hasNewerVersion: false });
    }
    const originalTemplate = originalRows[0];

    // 2. Walk the FULL revision chain to find the latest published version.
    let currentId = templateId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const [children] = await pool.execute(
        `SELECT id, name, version, status FROM templates
         WHERE revision_parent_id = ?
         ORDER BY version DESC LIMIT 1`,
        [currentId]
      );

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.id === templateId) {
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
        id: templateId,
        name: originalTemplate.name,
        version: originalTemplate.version,
      }
    });
  } catch (error) {
    console.error('Error checking template version notice:', error);
    res.status(500).json({ error: 'Failed to check template version update' });
  }
});


// ==================== TEMPLATES ROUTES ====================


//Route Get Templates
app.get('/api/templates/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const templates = await dbOps.getTemplates(userId);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a specific template by ID
app.get('/api/get_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [templates] = await pool.execute(
      `SELECT t.*, u.email AS created_by_email, u.email AS author_email,
              CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templates[0];
    // Flatten metadata from comments JSON
    if (template.comments) {
      try {
        let metadata = template.comments;
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch (_) {}
        }
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch (_) {}
        }
        if (metadata && typeof metadata === 'object') {
          template.headerHTML = metadata.headerHTML || '';
          template.footerHTML = metadata.footerHTML || '';
          template.logo = metadata.logo || null;
          template.logoText = metadata.logoText || '';
          template.logoTextRight = metadata.logoTextRight || '';
          template.orientation = metadata.orientation || 'portrait';
          template.paperSize = metadata.paperSize || 'A4';
          template.pagesState = metadata.pagesState || null;
        }
      } catch (e) {
        // Ignore
      }
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Get only the latest template content (from comments.content or content field)
app.get('/api/get_template_content/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      'SELECT content, comments FROM templates WHERE id = ?',
      [templateId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const row = rows[0];
    let metadata = {
      headerHTML: '',
      footerHTML: '',
      logo: null,
      logoText: '',
      logoTextRight: ''
    };

    // Prefer comments.content if present, but ignore empty/skeleton bodies
    let commentsContent = '';
    if (row.comments) {
      try {
        const commentsData = typeof row.comments === 'string' ? JSON.parse(row.comments) : row.comments;
        if (commentsData && commentsData.content !== undefined) {
          commentsContent = commentsData.content;
        }

        // Extract metadata
        if (commentsData) {
          metadata.headerHTML = commentsData.headerHTML || '';
          metadata.footerHTML = commentsData.footerHTML || '';
          metadata.logo = commentsData.logo || null;
          metadata.logoText = commentsData.logoText || '';
          metadata.logoTextRight = commentsData.logoTextRight || '';
          metadata.orientation = commentsData.orientation || 'portrait';
          metadata.paperSize = commentsData.paperSize || 'A4';
          metadata.pagesState = commentsData.pagesState || null;
        }
      } catch (e) {
        // ignore parse errors, fallback below
      }
    }

    let columnContent = '';
    if (row.content) {
      try {
        if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
          const parsed = JSON.parse(row.content);
          columnContent = parsed.content || row.content;
        } else {
          columnContent = row.content;
        }
      } catch (e) {
        columnContent = row.content;
      }
    }

    const finalContent = preferNonSkeletonEditorContent(commentsContent, columnContent);

    return res.json({
      success: true,
      content: finalContent || '',
      ...metadata
    });
  } catch (error) {
    console.error('Error fetching template content:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch template content' });
  }
});

// Debug endpoint to check comments in templates
app.get('/api/debug_template_comments/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [templates] = await pool.execute(
      'SELECT id, name, content, comments FROM templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templates[0];
    let parsedContent = null;
    let parsedComments = null;

    // Parse content
    if (template.content) {
      try {
        parsedContent = JSON.parse(template.content);
      } catch (e) {
        parsedContent = { error: 'Failed to parse content', raw: template.content };
      }
    }

    // Parse comments
    if (template.comments) {
      try {
        parsedComments = JSON.parse(template.comments);
      } catch (e) {
        parsedComments = { error: 'Failed to parse comments', raw: template.comments };
      }
    }

    res.json({
      id: template.id,
      name: template.name,
      content: parsedContent,
      comments: parsedComments,
      debug: {
        hasContent: !!template.content,
        hasComments: !!template.comments,
        contentType: typeof template.content,
        commentsType: typeof template.comments,
        commentsLength: template.comments ? template.comments.length : 0,
        contentLength: template.content ? template.content.length : 0
      }
    });
  } catch (error) {
    console.error('Error fetching template for debug:', error);
    res.status(500).json({ error: 'Failed to fetch template debug info' });
  }
});

app.post('/api/newtemplate', authenticateToken, async (req, res) => {
  try {
    const userRole = String(req.user?.role || '').trim().toLowerCase();
    const canCreateTemplate = userRole === 'admin' || userRole === 'author' || userRole === 'project_manager' || userRole === '1';
    if (!canCreateTemplate) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Only administrators and authors are authorized to create templates.'
      });
    }

    const {
      name,
      description,
      created_by,
      organization_id,
      category_id,
      approvers,
      impact,
      locked_elements,
      allowAttachments,
      includeTableOfContents,
      content,
      comments,
      notes,
      status,
      version,
      template_approvers,
      revision_parent_id,
      tempAttachments
    } = req.body;

    const resolvedUserId = created_by || req.user?.userId || req.user?.id;
    let resolvedOrgId = organization_id || req.user?.organization_id || req.user?.orgId;
    if (!resolvedOrgId && resolvedUserId) {
      const [u] = await pool.execute('SELECT organization_id FROM users WHERE id = ?', [resolvedUserId]);
      if (u && u.length > 0) resolvedOrgId = u[0].organization_id;
    }
    if (!resolvedOrgId) resolvedOrgId = 1;

    if (!name || !resolvedUserId) {
      return res.status(400).json({
        success: false,
        message: 'Complete the information in Basic Tab'
      });
    }

    // Check if an active draft/in-progress revision already exists for this parent template
    if (revision_parent_id) {
      const [existingDrafts] = await pool.execute(
        `SELECT id, version, status FROM templates 
         WHERE revision_parent_id = ? AND organization_id = ? AND status IN ('draft', 'pending_revision', 'pending_review', 'pending_approval')
         ORDER BY created_at DESC LIMIT 1`,
        [revision_parent_id, resolvedOrgId]
      );
      if (existingDrafts.length > 0) {
        const existingDraft = existingDrafts[0];
        console.log(`ℹ️ [POST /api/newtemplate] Active revision draft ${existingDraft.id} already exists for parent ${revision_parent_id}. Returning existing draft.`);
        return res.status(200).json({
          success: true,
          templateId: existingDraft.id,
          message: 'An in-progress revision already exists for this template. Loaded existing revision draft.',
          resumed: true
        });
      }

      // Verify name does not collide with an unrelated template or document in the organization
      let rootParentId = revision_parent_id;
      let curr = revision_parent_id;
      const visited = new Set([curr]);
      while (curr) {
        const [pRows] = await pool.execute('SELECT revision_parent_id FROM templates WHERE id = ?', [curr]);
        if (pRows && pRows.length > 0 && pRows[0].revision_parent_id && !visited.has(pRows[0].revision_parent_id)) {
          curr = pRows[0].revision_parent_id;
          rootParentId = curr;
          visited.add(curr);
        } else {
          break;
        }
      }
      const [familyRows] = await pool.execute(
        'SELECT id FROM templates WHERE id = ? OR revision_parent_id = ?',
        [rootParentId, rootParentId]
      );
      const familyIds = Array.from(new Set([rootParentId, revision_parent_id, ...(familyRows || []).map(r => r.id)]));
      const placeholders = familyIds.map(() => '?').join(',');
      const [unrelatedConflict] = await pool.execute(
        `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ? AND id NOT IN (${placeholders})
         UNION ALL
         SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?`,
        [name.trim(), resolvedOrgId, ...familyIds, name.trim(), resolvedOrgId]
      );
      if (unrelatedConflict.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A template or document with this exact name already exists in your organization. Please choose a unique name.'
        });
      }
    } else {
      // Check if an identical draft was just created by this user within 15 seconds (double-click / double-save protection)
      const [recentDrafts] = await pool.execute(
        `SELECT id FROM templates 
         WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ? AND created_by = ? AND status = 'draft' AND created_at >= NOW() - INTERVAL 15 SECOND
         ORDER BY created_at DESC LIMIT 1`,
        [name.trim(), resolvedOrgId, resolvedUserId]
      );
      if (recentDrafts.length > 0) {
        return res.status(200).json({
          success: true,
          templateId: recentDrafts[0].id,
          message: 'Loaded existing template draft.',
          resumed: true
        });
      }

      // For brand new templates (not a revision), enforce complete uniqueness
      const uniquenessCheckQuery = `
        SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ?
        UNION ALL
        SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?
      `;
      const [existingRecords] = await pool.execute(uniquenessCheckQuery, [name.trim(), resolvedOrgId, name.trim(), resolvedOrgId]);

      if (existingRecords.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A template or document with this exact name already exists in your organization. Please create a unique name.'
        });
      }
    }

    // Initialize category_id as null if not provided
    let finalCategoryId = category_id || null;

    // If category_id is provided, verify it exists and belongs to the organization
    if (finalCategoryId) {
      const categoryCheckQuery = `
        SELECT category_id FROM template_categories
        WHERE category_id = ? AND organization_id = ?
      `;

      const [categories] = await pool.execute(categoryCheckQuery, [finalCategoryId, organization_id]);

      if (categories.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }
    }

    const templateId = uuidv4();

    // Create template structure with additional fields
    const templateStructure = {
      locked_elements: locked_elements || {},
      allowAttachments: allowAttachments || false,
      includeTableOfContents: includeTableOfContents || false
    };

    await pool.execute(
      `INSERT INTO templates 
      (id, organization_id, name, description, content, template_structure, required_approvers, impact, notes, template_approvers, comments, created_by, category_id, created_at, updated_at, status, version, revision_parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
      [
        templateId,
        resolvedOrgId,
        name,
        description || null,
        content ? JSON.stringify(content) : null,
        JSON.stringify(templateStructure),
        approvers ? JSON.stringify(approvers) : '[]',
        impact ? JSON.stringify(impact) : null,
        notes || null,
        template_approvers ? JSON.stringify(template_approvers) : null,
        comments ? JSON.stringify(comments) : null,
        resolvedUserId,
        finalCategoryId,
        status || 'draft',
        version || 1,
        revision_parent_id || null
      ]
    );

function getSafeUploadPath(baseUploadsDir, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return null;
  if (targetPath.indexOf('\0') !== -1) return null;
  const resolvedBase = path.resolve(baseUploadsDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (!resolvedTarget.startsWith(baseWithSep)) return null;
  return resolvedTarget;
}

    // Clone attachments if this is a revision of another template
    if (revision_parent_id) {
      try {
        const [parentAttachments] = await pool.execute(
          'SELECT * FROM attachments WHERE association_type = "template" AND association_id = ?',
          [revision_parent_id]
        );
        for (const attachment of parentAttachments) {
          const oldFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);
          if (oldFilePath && fs.existsSync(oldFilePath)) {
            const uniqueId = uuidv4();
            const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const newFilePath = path.join(uploadsDir, newServerFileName);
            fs.copyFileSync(oldFilePath, newFilePath);

            await pool.execute(
              'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
              ['template', templateId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, created_by]
            );
          }
        }
        console.log(`✅ Copied attachments from parent template ${revision_parent_id} to new revised template ${templateId}`);
      } catch (copyErr) {
        console.error('Error copying parent template attachments:', copyErr);
      }
    }

    // Process new uploaded attachments if provided
    if (Array.isArray(tempAttachments) && tempAttachments.length > 0) {
      try {
        const ids = tempAttachments
          .map(t => (typeof t === 'object' && t !== null) ? t.id : t)
          .filter(id => id && !String(id).startsWith('temp-'));

        if (ids.length > 0) {
          await pool.execute(
            `UPDATE attachments SET association_type = 'template', association_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
            [templateId, ...ids]
          );
          console.log(`✅ Associated ${ids.length} temp attachments to new template ${templateId}`);
        }
      } catch (attachErr) {
        console.error('Error saving temp template attachments:', attachErr);
      }
    }

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: resolvedOrgId,
        userId: resolvedUserId,
        actionType: 'TEMPLATE_CREATED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name,
          version: version || 1,
          status: status || 'draft',
          revision_parent_id: revision_parent_id || null,
          category_id: finalCategoryId
        },
        req
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Template created successfully',
      templateId: templateId
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating template'
    });
  }
});

app.put('/api/update_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (req.body?.status === 'published' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Only administrators are authorized to publish templates.'
      });
    }

    const {
      name,
      description,
      category_id,
      content,
      comments,
      notes,
      template_approvers,
      status,
      approvers,
      impact,
      locked_elements,
      allowAttachments,
      includeTableOfContents,
      version,
      revision_parent_id
    } = req.body;

    // Validate template ID
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    // Build query parts
    let updateParts = [];
    let params = [];

    // Handle basic fields
    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : name;
      if (trimmedName) {
        // Validate name uniqueness against unrelated templates/documents in org
        const [currRows] = await pool.execute('SELECT name, organization_id, revision_parent_id FROM templates WHERE id = ?', [templateId]);
        if (currRows && currRows.length > 0) {
          const orgId = currRows[0].organization_id || 1;
          const currName = (currRows[0].name || '').trim();
          if (trimmedName.toLowerCase() !== currName.toLowerCase()) {
            let familyIds = [String(templateId)];
            const rootId = currRows[0].revision_parent_id || templateId;
            familyIds.push(String(rootId));
            try {
              const [famRows] = await pool.execute('SELECT id FROM templates WHERE revision_parent_id = ? OR id = ?', [rootId, rootId]);
              famRows.forEach(r => familyIds.push(String(r.id)));
            } catch (_) {}
            familyIds = Array.from(new Set(familyIds));

            const placeholders = familyIds.map(() => '?').join(',');
            const [conflictRows] = await pool.execute(
              `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ? AND id NOT IN (${placeholders})
               UNION ALL
               SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?`,
              [trimmedName, orgId, ...familyIds, trimmedName, orgId]
            );
            if (conflictRows && conflictRows.length > 0) {
              return res.status(409).json({
                success: false,
                message: 'A template or document with this exact name already exists in your organization. Please choose a unique name.'
              });
            }
          }
        }
      }
      updateParts.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updateParts.push('description = ?');
      params.push(description);
    }

    if (category_id !== undefined) {
      updateParts.push('category_id = ?');
      params.push(category_id);
    }

    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }

    // Handle content update — avoid double-encoding if value is already a JSON string from DB
    if (content !== undefined) {
      updateParts.push('content = ?');
      params.push(safeJsonStringify(content));
    }

    // Handle comments update — avoid double-encoding if value is already a JSON string from DB
    if (comments !== undefined) {
      updateParts.push('comments = ?');
      params.push(safeJsonStringify(comments));
    }

    // Handle template structure updates
    let templateStructureUpdates = {};

    if (locked_elements !== undefined) {
      templateStructureUpdates.locked_elements = locked_elements;
    }

    if (allowAttachments !== undefined) {
      templateStructureUpdates.allowAttachments = allowAttachments;
    }

    if (includeTableOfContents !== undefined) {
      templateStructureUpdates.includeTableOfContents = includeTableOfContents;
    }

    // Only fetch current template structure if we have updates to merge
    if (Object.keys(templateStructureUpdates).length > 0) {
      const [currentTemplate] = await pool.execute(
        'SELECT template_structure FROM templates WHERE id = ?',
        [templateId]
      );

      let currentStructure = {};
      if (currentTemplate.length > 0 && currentTemplate[0].template_structure) {
        try {
          currentStructure = JSON.parse(currentTemplate[0].template_structure);
        } catch (e) {
          console.error('Error parsing template structure:', e);
          currentStructure = {};
        }
      }

      // Merge updates
      const updatedStructure = { ...currentStructure, ...templateStructureUpdates };
      updateParts.push('template_structure = ?');
      params.push(safeJsonStringify(updatedStructure));
    }

    // Handle approvers update
    if (approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(approvers));
    }

    // Handle impact update
    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }

    // Handle status and workflow approvers sanitization
    let effectiveApprovers = template_approvers;
    if (status !== undefined && ['draft', 'pending_revision', 'pending_review', 'pending_approval', 'pending_archive_approval', 'pending_archive_review', 'archive_draft', 'archive_reviewed'].includes(status)) {
      if (effectiveApprovers === undefined) {
        try {
          const [currTpl] = await pool.execute('SELECT template_approvers FROM templates WHERE id = ?', [templateId]);
          if (currTpl.length > 0 && currTpl[0].template_approvers) {
            effectiveApprovers = currTpl[0].template_approvers;
          }
        } catch (fetchErr) {
          console.error('Error fetching template_approvers for status reset:', fetchErr);
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

    if (status !== undefined) {
      updateParts.push('status = ?');
      params.push(status || 'draft');
    }

    if (version !== undefined) {
      updateParts.push('version = ?');
      params.push(version || '1');
    }

    if (revision_parent_id !== undefined) {
      updateParts.push('revision_parent_id = ?');
      params.push(revision_parent_id || null);
    }

    // Handle approvers update
    if (effectiveApprovers !== undefined) {
      updateParts.push('template_approvers = ?');
      params.push(safeJsonStringify(effectiveApprovers));
    }

    // Add updated_at timestamp
    updateParts.push('updated_at = CURRENT_TIMESTAMP');

    // Check if we have any fields to update
    if (updateParts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Add template ID to params for WHERE clause
    params.push(templateId);

    // Execute the query
    const [result] = await pool.execute(
      `UPDATE templates SET ${updateParts.join(', ')} WHERE id = ?`,
      params
    );

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or no changes made'
      });
    }

    if (status === 'published') {
      await retireParentTemplatesToArchived(pool, templateId);
    }

    if (logAuditEvent) {
      const [tRows] = await pool.execute('SELECT organization_id, name, version FROM templates WHERE id = ?', [templateId]);
      await logAuditEvent(pool, {
        orgId: tRows[0]?.organization_id || req.user?.organization_id || 1,
        userId: req.user?.userId || req.user?.id,
        actionType: 'TEMPLATE_UPDATED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: tRows[0]?.name || name,
          version: tRows[0]?.version || version,
          updatedFields: Object.keys(req.body).filter(k => k !== 'content' && k !== 'comments')
        },
        req
      });
    }

    // Sync references asynchronously if content or comments were updated
    if (content !== undefined || comments !== undefined) {
      try {
        const { syncItemReferences } = require('../references/referenceRoutes');
        if (typeof syncItemReferences === 'function') {
          syncItemReferences(pool, 'template', templateId, content, comments, req.user?.userId || req.user?.id).catch(e => console.warn('Ref sync error in update_template:', e.message));
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      templateId: templateId
    });

  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route to update template metadata (name, description, category)
app.put('/api/update_template_metadata/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { 
      name, 
      description, 
      category_id, 
      approvers, 
      template_approvers, 
      impact, 
      notes,
      locked_elements,
      allowAttachments,
      includeTableOfContents
    } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, error: 'Template ID is required' });
    }

    let updateParts = [];
    let params = [];

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : name;
      if (trimmedName) {
        const [currRows] = await pool.execute('SELECT name, organization_id, revision_parent_id FROM templates WHERE id = ?', [templateId]);
        if (currRows && currRows.length > 0) {
          const orgId = currRows[0].organization_id || 1;
          const currName = (currRows[0].name || '').trim();
          if (trimmedName.toLowerCase() !== currName.toLowerCase()) {
            let familyIds = [String(templateId)];
            const rootId = currRows[0].revision_parent_id || templateId;
            familyIds.push(String(rootId));
            try {
              const [famRows] = await pool.execute('SELECT id FROM templates WHERE revision_parent_id = ? OR id = ?', [rootId, rootId]);
              famRows.forEach(r => familyIds.push(String(r.id)));
            } catch (_) {}
            familyIds = Array.from(new Set(familyIds));

            const placeholders = familyIds.map(() => '?').join(',');
            const [conflictRows] = await pool.execute(
              `SELECT 'template' as type FROM templates WHERE LOWER(TRIM(name)) = LOWER(?) AND organization_id = ? AND id NOT IN (${placeholders})
               UNION ALL
               SELECT 'document' as type FROM documents WHERE LOWER(TRIM(title)) = LOWER(?) AND organization_id = ?`,
              [trimmedName, orgId, ...familyIds, trimmedName, orgId]
            );
            if (conflictRows && conflictRows.length > 0) {
              return res.status(409).json({
                success: false,
                message: 'A template or document with this exact name already exists in your organization. Please choose a unique name.'
              });
            }
          }
        }
      }
      updateParts.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updateParts.push('description = ?');
      params.push(description);
    }

    if (category_id !== undefined) {
      updateParts.push('category_id = ?');
      params.push(category_id);
    }

    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }

    if (approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(approvers));
    }

    if (template_approvers !== undefined) {
      updateParts.push('template_approvers = ?');
      params.push(safeJsonStringify(template_approvers));
    }

    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }

    // Handle template structure updates
    let templateStructureUpdates = {};
    if (locked_elements !== undefined) templateStructureUpdates.locked_elements = locked_elements;
    if (allowAttachments !== undefined) templateStructureUpdates.allowAttachments = allowAttachments;
    if (includeTableOfContents !== undefined) templateStructureUpdates.includeTableOfContents = includeTableOfContents;

    if (Object.keys(templateStructureUpdates).length > 0) {
      const [currentTemplate] = await pool.execute(
        'SELECT template_structure FROM templates WHERE id = ?',
        [templateId]
      );

      let currentStructure = {};
      if (currentTemplate.length > 0 && currentTemplate[0].template_structure) {
        try {
          currentStructure = JSON.parse(currentTemplate[0].template_structure);
        } catch (e) {
          currentStructure = {};
        }
      }

      const updatedStructure = { ...currentStructure, ...templateStructureUpdates };
      updateParts.push('template_structure = ?');
      params.push(safeJsonStringify(updatedStructure));
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ success: false, error: 'No metadata fields to update' });
    }

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(templateId);

    const [result] = await pool.execute(
      `UPDATE templates SET ${updateParts.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (logAuditEvent) {
      const [tRows] = await pool.execute('SELECT organization_id, name, version FROM templates WHERE id = ?', [templateId]);
      await logAuditEvent(pool, {
        orgId: tRows[0]?.organization_id || req.user?.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_UPDATED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: tRows[0]?.name || name,
          version: tRows[0]?.version,
          updatedMetadata: Object.keys(req.body)
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Template metadata updated successfully',
      templateId
    });
  } catch (error) {
    console.error('Error updating template metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template metadata',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Real-time template content update endpoint for collaboration
app.put('/api/update_template_content/:templateId', authenticateToken, async (req, res) => {
  console.log('\n========= 💾 TEMPLATE SAVE REQUEST START =========');
  console.log('⏰ Time:', new Date().toISOString());

  try {
    const templateId = req.params.templateId;
    const authUserId = req.user.userId;
    const { content } = req.body;
    const userId = authUserId;

    const isAuthorized = await assertUserTemplateAccess(templateId, authUserId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    console.log('📝 Request details:', {
      templateId,
      userId,
      contentLength: content ? content.length : 0,
      contentPreview: content ? content.substring(0, 100) + '...' : 'No content',
      hasAuthHeader: !!req.headers.authorization,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      requestBodyKeys: Object.keys(req.body)
    });

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    // Get current template data to understand the structure
    console.log('🔍 Querying database for template:', templateId);
    const [currentTemplate] = await pool.execute(
      'SELECT content, comments, template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    console.log('📁 Database query result:', {
      found: currentTemplate.length > 0,
      templateExists: !!currentTemplate[0],
      hasContent: currentTemplate[0] ? !!currentTemplate[0].content : false,
      hasComments: currentTemplate[0] ? !!currentTemplate[0].comments : false,
      currentContentLength: currentTemplate[0] ? (currentTemplate[0].content?.length || 0) : 0
    });

    if (currentTemplate.length === 0) {
      console.log('❌ Template not found in database:', templateId);
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Parse existing comments/suggestions or use provided ones
    let finalCommentsData = {};
    const commentsInput = req.body.comments;

    // Use provided comments data if available
    if (commentsInput) {
      try {
        finalCommentsData = typeof commentsInput === 'string' ? JSON.parse(commentsInput) : commentsInput;
        console.log('📦 Using provided comments data:', {
          commentsCount: finalCommentsData.comments?.length || 0,
          suggestionsCount: finalCommentsData.suggestions?.length || 0
        });
      } catch (e) {
        console.error('Error parsing input comments:', e);
      }
    }

    // If no valid input comments, fall back to existing DB comments
    if (!finalCommentsData.comments && !finalCommentsData.suggestions) {
      try {
        if (currentTemplate[0].comments) {
          const dbComments = JSON.parse(currentTemplate[0].comments);
          // If the DB has the newer structure { comments: [], suggestions: [] }
          if (dbComments.comments || dbComments.suggestions) {
            finalCommentsData = dbComments;
          } else {
            // Backward compatibility or empty
            finalCommentsData = { comments: [], suggestions: [] };
          }
        }
      } catch (e) {
        console.warn('Could not parse existing comments from DB:', e.message);
      }
    }

    // Parse existing DB comments for deep fallback
    let dbCommentsData = {};
    try {
      if (currentTemplate[0].comments) {
        dbCommentsData = typeof currentTemplate[0].comments === 'string'
          ? JSON.parse(currentTemplate[0].comments)
          : currentTemplate[0].comments;
      }
    } catch (e) {
      console.warn('Could not parse existing comments from DB:', e.message);
    }

    let dbContentColumn = '';
    try {
      if (currentTemplate[0].content) {
        const parsedCol = typeof currentTemplate[0].content === 'string'
          ? JSON.parse(currentTemplate[0].content)
          : currentTemplate[0].content;
        dbContentColumn = parsedCol?.content ?? currentTemplate[0].content;
      }
    } catch (e) {
      dbContentColumn = currentTemplate[0].content || '';
    }
    const knownGoodHtml = preferNonSkeletonEditorContent(dbCommentsData.content, dbContentColumn);
    const incomingHtml = content != null ? content : finalCommentsData.content;
    const resolvedContent = preferNonSkeletonEditorContent(incomingHtml, knownGoodHtml);

    // Merge logic: use incoming data if present and not "empty", otherwise fall back to DB
    const updatedCommentsData = {
      content: resolvedContent || '',
      comments: finalCommentsData.comments || dbCommentsData.comments || [],
      suggestions: finalCommentsData.suggestions || dbCommentsData.suggestions || [],
      references: finalCommentsData.references || dbCommentsData.references || [],
      manualReferences: finalCommentsData.manualReferences || dbCommentsData.manualReferences || [],
      headerHTML: (finalCommentsData.headerHTML && finalCommentsData.headerHTML.trim()) ? finalCommentsData.headerHTML : (dbCommentsData.headerHTML || ''),
      footerHTML: (finalCommentsData.footerHTML && finalCommentsData.footerHTML.trim()) ? finalCommentsData.footerHTML : (dbCommentsData.footerHTML || ''),
      logo: finalCommentsData.logo ? finalCommentsData.logo : (dbCommentsData.logo || null),
      logoText: (finalCommentsData.logoText && finalCommentsData.logoText.trim()) ? finalCommentsData.logoText : (dbCommentsData.logoText || ''),
      logoTextRight: (finalCommentsData.logoTextRight && finalCommentsData.logoTextRight.trim()) ? finalCommentsData.logoTextRight : (dbCommentsData.logoTextRight || ''),
      orientation: finalCommentsData.orientation || dbCommentsData.orientation || 'portrait',
      paperSize: finalCommentsData.paperSize || dbCommentsData.paperSize || 'A4',
      pagesState: finalCommentsData.pagesState || dbCommentsData.pagesState || null,
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId
    };

    // Store content as a JSON object so it satisfies the json_valid CHECK constraint
    const contentJsonString = JSON.stringify({ content: resolvedContent || '' });

    // Check if the user is a reviewer who previously marked it as reviewed
    let dbTemplateApprovers = currentTemplate[0].template_approvers;
    let dbStatus = currentTemplate[0].status;
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
    if (currentTemplate[0].content) {
      try {
        const parsed = JSON.parse(currentTemplate[0].content);
        dbContent = parsed.content || '';
      } catch (e) {
        dbContent = currentTemplate[0].content;
      }
    }
    const isContentModified = stripHtml(typeof resolvedContent === 'string' ? resolvedContent : JSON.stringify(resolvedContent || '')) !== stripHtml(typeof dbContent === 'string' ? dbContent : JSON.stringify(dbContent || ''));

    if (dbTemplateApprovers && isContentModified) {
      try {
        let parsedApprovers = typeof dbTemplateApprovers === 'string' ? JSON.parse(dbTemplateApprovers) : dbTemplateApprovers;
        let modified = false;

        // Fetch user email since reviewer objects often only contain email
        let userEmail = null;
        try {
          const [userRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
          if (userRows && userRows.length > 0) userEmail = userRows[0].email;
        } catch (err) {
          console.error("Error fetching user email for reviewer reset:", err);
        }

        if (parsedApprovers.reviewers && Array.isArray(parsedApprovers.reviewers)) {
          parsedApprovers.reviewers = parsedApprovers.reviewers.map(reviewer => {
            // If the current user is typing and their status was 'reviewed', revert to 'pending'
            const isMatchingId = String(reviewer.userId) === String(userId) || String(reviewer.id) === String(userId);
            const isMatchingEmail = userEmail && reviewer.email && reviewer.email.toLowerCase() === userEmail.toLowerCase();
            const isMatchingUser = isMatchingId || isMatchingEmail;

            const isReviewed = reviewer.status && reviewer.status.toLowerCase() === 'reviewed';

            if (isMatchingUser && isReviewed) {
              modified = true;
              return { ...reviewer, status: 'pending' };
            }
            return reviewer;
          });
        }

        if (modified) {
          dbTemplateApprovers = JSON.stringify(parsedApprovers);
          shouldUpdateApprovers = true;
          // Revert template status to pending_review if it was reviewed
          if (dbStatus === 'reviewed') {
            dbStatus = 'pending_review';
          }
        }
      } catch (e) {
        console.warn('Could not parse template_approvers for status reset:', e);
      }
    }

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.execute(
        'UPDATE templates SET content = ?, comments = ?, template_approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [contentJsonString, JSON.stringify(updatedCommentsData), dbTemplateApprovers, dbStatus, templateId]
      );

      // Attempt to emit socket event if io is available
      try {
        if (typeof io !== 'undefined') {
          io.to(`template-${templateId}`).emit('templateApproversUpdated', {
            templateId,
            template_approvers: JSON.parse(dbTemplateApprovers),
            status: dbStatus
          });
        }
      } catch (e) {
        console.warn('Could not emit socket event for approver update:', e);
      }
    } else {
      [result] = await pool.execute(
        'UPDATE templates SET content = ?, comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [contentJsonString, JSON.stringify(updatedCommentsData), templateId]
      );
    }

    console.log('🧪 DB Update result:', { affectedRows: result.affectedRows, changedRows: result.changedRows });

    if (result.affectedRows === 0) {
      console.warn('⚠️ Template ID not found in UPDATE query:', templateId);
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    console.log('✅ Template updated successfully in DB');

    // Sync references asynchronously
    try {
      const { syncItemReferences } = require('../references/referenceRoutes');
      if (typeof syncItemReferences === 'function') {
        syncItemReferences(pool, 'template', templateId, contentJsonString, updatedCommentsData, userId).catch(e => console.warn('Ref sync error:', e.message));
      }
    } catch (_) {}

    // Re-read the row to confirm persistence
    const [verifyRows] = await pool.execute(
      'SELECT content, comments, updated_at FROM templates WHERE id = ?',
      [templateId]
    );

    const persistedContent = verifyRows[0]?.content || '';
    console.log(`✅ Template content saved successfully:`, {
      templateId,
      requestedContentLength: content ? content.length : 0,
      persistedContentLength: persistedContent.length,
      commentsCount: updatedCommentsData.comments?.length || 0,
      suggestionsCount: updatedCommentsData.suggestions?.length || 0,
      updated_at: verifyRows[0]?.updated_at
    });

    const responseData = {
      success: true,
      message: 'Template content updated successfully',
      templateId: templateId,
      contentLength: (content || '').length,
      savedAt: new Date().toISOString(),
      persisted: true
    };

    if (logAuditEvent) {
      const [tRows] = await pool.execute('SELECT organization_id, name, version FROM templates WHERE id = ?', [templateId]);
      await logAuditEvent(pool, {
        orgId: tRows[0]?.organization_id || req.user?.organization_id || 1,
        userId: req.user?.userId || req.user?.id,
        actionType: 'TEMPLATE_UPDATED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          action: 'content_saved',
          name: tRows[0]?.name,
          version: tRows[0]?.version
        },
        req
      });
    }

    console.log('✅ Sending success response:', responseData);
    console.log('=== TEMPLATE SAVE REQUEST END ===\n');

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error updating template content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template content',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.put('/api/update_content/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { comments } = req.body;

    // Validate template ID and comments
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    if (comments === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Comments data is required'
      });
    }

    // Also update the content field if the comments contain content
    let commentsData;
    try {
      commentsData = JSON.parse(comments);
    } catch (e) {
      commentsData = { content: "", comments: [] };
    }

    // If we have content in the comments data, update both fields
    if (commentsData && commentsData.content) {
      const [result] = await pool.execute(
        'UPDATE templates SET comments = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [comments, comments, templateId]
      );

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found or no changes made'
        });
      }
    } else {
      // Otherwise just update comments
      const [result] = await pool.execute(
        'UPDATE templates SET comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [comments, templateId]
      );

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found or no changes made'
        });
      }
    }

    res.json({
      success: true,
      message: 'Comments updated successfully',
      templateId: templateId
    });

  } catch (error) {
    console.error('Error updating comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comments',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Review endpoint - Fixed

// Remove Template
app.delete('/api/remove_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.userId;

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'delete');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied to remove template' });
    }

    const [tRows] = await pool.execute('SELECT organization_id, name, version, status FROM templates WHERE id = ?', [templateId]);
    const tpl = tRows[0] || {};

    // Soft delete - Update status to 'inactive'
    await pool.execute(
      'DELETE FROM templates WHERE status = ? AND id = ?',
      ['draft', templateId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: tpl.organization_id || req.user?.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_DELETED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: tpl.name,
          version: tpl.version,
          previousStatus: tpl.status
        },
        req
      });
    }

    res.json({ message: 'Template removed successfully' });
  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({ error: 'Failed to remove template' });
  }
});

// ==================== REVISION HISTORY & AI ROUTES ====================

// Helper to clean HTML content for AI processing (token optimization)
const cleanContentForAI = (html) => {
  if (!html) return "";
  try {
    // If it's a JSON string, try to parse it first
    let content = html;
    if (typeof html === 'string' && (html.trim().startsWith('{') || html.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(html);
        if (parsed.content) content = parsed.content;
        else if (Array.isArray(parsed)) content = JSON.stringify(parsed);
      } catch (e) {
        // Not JSON or failed to parse, use as is
      }
    }

    // Simple regex to strip HTML tags
    let text = content.replace(/<[^>]*>?/gm, ' ');
    // Remove multiple spaces and newlines
    text = text.replace(/\s+/g, ' ').trim();
    // Limit length to avoid excessive token usage (e.g., first 10k chars)
    return text.substring(0, 10000);
  } catch (err) {
    console.error("Error cleaning content for AI:", err);
    return "";
  }
};

// Get Revision History for a template (using lineage-chain walking)

// API to set custom document approvers for a template
app.put('/api/templates/:templateId/custom_approvers', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { custom_document_approvers } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Fetch the role to authorize admin
    const [userRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage custom template approvers' });
    }

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Template not found or unauthorized' });
    }

    await pool.execute(
      'UPDATE templates SET custom_document_approvers = ? WHERE id = ?',
      [
        custom_document_approvers ? JSON.stringify(custom_document_approvers) : null,
        templateId
      ]
    );

    if (logAuditEvent) {
      const [tRows] = await pool.execute('SELECT organization_id, name, version FROM templates WHERE id = ?', [templateId]);
      await logAuditEvent(pool, {
        orgId: tRows[0]?.organization_id || req.user?.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_UPDATED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          action: 'custom_approvers_updated',
          name: tRows[0]?.name,
          version: tRows[0]?.version
        },
        req
      });
    }

    res.json({ message: 'Custom template approvers updated successfully' });
  } catch (error) {
    console.error('Error updating custom template approvers:', error);
    res.status(500).json({ error: 'Failed to update custom template approvers' });
  }
});



app.patch('/api/templates/:id/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const itemId = req.params.id;

    const isAuthorized = await assertUserTemplateAccess(itemId, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, 'template', itemId]
    );

    let is_pinned = false;
    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, 'template', itemId]
      );
      is_pinned = false;
    } else {
      await pool.execute(
        'INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)',
        [userId, 'template', itemId]
      );
      is_pinned = true;
    }
    res.json({ success: true, is_pinned });
  } catch (error) {
    console.error('Error toggling template pin:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});



app.patch('/api/templates/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const rawVal = req.body?.progress_value !== undefined ? req.body.progress_value : req.body?.progress;
    const val = Math.min(100, Math.max(0, parseInt(rawVal, 10) || 0));

    console.log(`📥 [PATCH /api/templates/${id}/progress] Setting progress_value to ${val}% (raw body:`, req.body, `)`);
    await pool.execute('UPDATE templates SET progress_value = ? WHERE id = ?', [val, id]);
    res.json({ success: true, progress_value: val });
  } catch (error) {
    console.error('❌ Error updating template progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});



app.get('/api/templates/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      `SELECT n.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
       FROM notes n 
       LEFT JOIN users u ON n.user_id = u.id 
       WHERE n.template_id = ? 
       ORDER BY n.created_at ASC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching template notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

app.post('/api/templates/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { content, isPrivate } = req.body || {};

    if (!content) {
      return res.status(400).json({ success: false, error: 'Note content is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, template_id, content, is_private) VALUES (?, ?, ?, ?)',
      [userId, id, content, isPrivate ? 1 : 0]
    );

    res.json({ success: true, noteId: result.insertId });
  } catch (error) {
    console.error('Error adding template note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});
// ==================== Template Impact Comments Endpoints ====================
app.get('/api/templates/:id/impact-comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      'SELECT impact FROM templates WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
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
    console.error('Error fetching template impact comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch impact comments' });
  }
});

app.post('/api/templates/:id/impact-comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, comments: fullCommentsList } = req.body || {};

    const [rows] = await pool.execute(
      'SELECT impact FROM templates WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
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
      'UPDATE templates SET impact = ? WHERE id = ?',
      [JSON.stringify(impact), id]
    );

    res.json({ success: true, data: impact.comments });
  } catch (error) {
    console.error('Error saving template impact comment:', error);
    res.status(500).json({ success: false, error: 'Failed to save impact comment' });
  }
});

app.delete('/api/templates/:id/impact-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const [rows] = await pool.execute(
      'SELECT impact FROM templates WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
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
      'UPDATE templates SET impact = ? WHERE id = ?',
      [JSON.stringify(impact), id]
    );

    res.json({ success: true, data: impact.comments });
  } catch (error) {
    console.error('Error deleting template impact comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete impact comment' });
  }
});

};

