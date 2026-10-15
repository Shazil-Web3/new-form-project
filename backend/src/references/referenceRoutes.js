/**
 * @file referenceRoutes.js
 * @description API routes and synchronization utilities for cross-document references & mentions
 * @dependencies mysql2, express
 */

/**
 * Extract referenced document IDs from content string/blocks and elements/comments
 * @param {string|object} content
 * @param {object|string} elementsOrComments
 * @returns {string[]} Array of unique referenced document IDs
 */
function extractDocReferences(content, elementsOrComments) {
  const referencedIds = new Set();

  let contentStr = '';
  if (typeof content === 'string') {
    contentStr = content;
  } else if (content && typeof content === 'object') {
    try {
      contentStr = JSON.stringify(content);
    } catch (_) {
      contentStr = '';
    }
  }

  if (contentStr) {
    // 1. Match /document/<id> anywhere in hrefs, URLs, or paths (handles escaped or unescaped quotes, full URLs or relative paths)
    const docPathRegex = /\/document\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/gi;
    let match;
    while ((match = docPathRegex.exec(contentStr)) !== null) {
      const id = match[1]?.trim();
      if (id && id !== 'new' && id !== 'reference' && id !== 'published') {
        referencedIds.add(id);
      }
    }

    // 2. Match data-doc-id="<id>" (with or without escaped quotes)
    const dataDocIdRegex = /data-doc-id=[\\]*["']?([a-f0-9-]{36}|[a-zA-Z0-9_-]+)[\\]*["']?/gi;
    while ((match = dataDocIdRegex.exec(contentStr)) !== null) {
      const id = match[1]?.trim();
      if (id && id !== 'new') {
        referencedIds.add(id);
      }
    }
  }

  // 3. Parse elements or comments for references array
  let extraObj = elementsOrComments;
  if (typeof extraObj === 'string') {
    try {
      extraObj = JSON.parse(extraObj);
    } catch (_) {
      extraObj = null;
    }
  }

  if (extraObj && typeof extraObj === 'object') {
    const refsList = [
      ...(Array.isArray(extraObj.references) ? extraObj.references : []),
      ...(Array.isArray(extraObj.manualReferences) ? extraObj.manualReferences : [])
    ];

    for (const ref of refsList) {
      if (!ref) continue;
      const docId = ref.documentId || ref.document_id || ref.docId || ref.targetId;
      if (docId && String(docId).trim() && String(docId).trim() !== 'new') {
        referencedIds.add(String(docId).trim());
      }
    }
  }

  return Array.from(referencedIds);
}

/**
 * Sync references for a single document or template into item_references table
 */
async function syncItemReferences(pool, sourceType, sourceId, content, elementsOrComments, userId) {
  if (!pool || !sourceType || !sourceId) return;

  try {
    const referencedIds = extractDocReferences(content, elementsOrComments);

    // Remove old references for this source item
    await pool.execute(
      'DELETE FROM item_references WHERE source_type = ? AND source_id = ?',
      [sourceType, String(sourceId)]
    );

    if (referencedIds.length === 0) return;

    // Filter to valid existing documents in database
    for (const targetId of referencedIds) {
      // Don't allow an item to reference itself
      if (String(targetId) === String(sourceId)) continue;

      const [targetDoc] = await pool.execute(
        'SELECT document_id FROM documents WHERE document_id = ? LIMIT 1',
        [targetId]
      );

      if (targetDoc && targetDoc.length > 0) {
        await pool.execute(`
          INSERT INTO item_references (source_type, source_id, target_type, target_id, created_by)
          VALUES (?, ?, 'document', ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `, [sourceType, String(sourceId), targetId, userId || 1]);
      }
    }
  } catch (err) {
    console.error(`[References] Error syncing references for ${sourceType} ${sourceId}:`, err.message);
  }
}

/**
 * Scan all existing documents and templates to populate historical references
 */
async function syncAllHistoricalReferences(pool) {
  if (!pool) return;
  try {
    // 1. Scan documents containing /document/ or data-doc-id
    const [docs] = await pool.execute(
      "SELECT document_id, content, elements, created_by FROM documents WHERE content LIKE '%/document/%' OR content LIKE '%data-doc-id%'"
    );
    for (const doc of docs) {
      await syncItemReferences(pool, 'document', doc.document_id, doc.content, doc.elements, doc.created_by);
    }

    // 2. Scan templates containing /document/ or data-doc-id
    const [temps] = await pool.execute(
      "SELECT id, content, comments, created_by FROM templates WHERE content LIKE '%/document/%' OR content LIKE '%data-doc-id%'"
    );
    for (const temp of temps) {
      await syncItemReferences(pool, 'template', temp.id, temp.content, temp.comments, temp.created_by);
    }
  } catch (err) {
    console.warn('Notice scanning historical references:', err.message);
  }
}

module.exports = function registerReferenceRoutes({ app, pool, authenticateToken, logAuditEvent }) {
  // Ensure table exists
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`item_references\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`source_type\` ENUM('document', 'template') NOT NULL,
          \`source_id\` VARCHAR(255) NOT NULL,
          \`target_type\` ENUM('document', 'template') NOT NULL DEFAULT 'document',
          \`target_id\` VARCHAR(255) NOT NULL,
          \`created_by\` INT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`uniq_source_target\` (\`source_type\`, \`source_id\`, \`target_type\`, \`target_id\`),
          INDEX \`idx_source\` (\`source_type\`, \`source_id\`),
          INDEX \`idx_target\` (\`target_type\`, \`target_id\`),
          INDEX \`idx_created_by\` (\`created_by\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);

      // Run initial check: if item_references is empty, trigger one-time scan
      const [countRows] = await pool.query('SELECT COUNT(*) as cnt FROM item_references');
      if (countRows[0]?.cnt === 0) {
        syncAllHistoricalReferences(pool);
      }
    } catch (e) {
      console.warn('[References] Table init notice:', e.message);
    }
  })();

  /**
   * GET /api/references
   * Fetches all cross-document and template references, with live statuses and role-based filtering
   */
  app.get('/api/references', authenticateToken, async (req, res) => {
    try {
      // Ensure references are always up-to-date
      await syncAllHistoricalReferences(pool);

      const userId = req.user?.id || req.user?.userId;
      const userRole = (req.user?.role || 'viewer').toLowerCase();
      const userEmail = (req.user?.email || '').toLowerCase();
      const isAdminOrPM = userRole === 'admin' || userRole === 'project_manager' || userRole === 'superadmin' || userRole === '1';

      const { type, status, search } = req.query;

      // Query all references joining source (document or template) and target (document)
      const sql = `
        SELECT 
          r.id AS reference_id,
          r.source_type,
          r.source_id,
          r.target_type,
          r.target_id,
          r.created_at AS reference_created_at,
          r.updated_at AS reference_updated_at,
          r.created_by AS reference_created_by,
          
          -- Source Document Fields
          sd.title AS doc_source_title,
          sd.status AS doc_source_status,
          sd.version AS doc_source_version,
          sd.current_revision AS doc_source_revision,
          sd.created_by AS doc_source_created_by,
          sd.approvers AS doc_source_approvers,
          sd.required_approvers AS doc_source_required_approvers,
          sd.updated_at AS doc_source_updated_at,
          sd_user.first_name AS doc_source_first_name,
          sd_user.last_name AS doc_source_last_name,
          sd_user.email AS doc_source_email,
          sd_user.department AS doc_source_department,

          -- Source Template Fields
          st.name AS temp_source_title,
          st.status AS temp_source_status,
          st.version AS temp_source_version,
          st.created_by AS temp_source_created_by,
          st.template_approvers AS temp_source_approvers,
          st.required_approvers AS temp_source_required_approvers,
          st.updated_at AS temp_source_updated_at,
          st_user.first_name AS temp_source_first_name,
          st_user.last_name AS temp_source_last_name,
          st_user.email AS temp_source_email,
          st_user.department AS temp_source_department,

          -- Target Document Fields
          td.title AS target_title,
          td.status AS target_status,
          td.version AS target_version,
          td.current_revision AS target_revision,
          td.created_by AS target_created_by,
          td.updated_at AS target_updated_at,
          td_user.first_name AS target_first_name,
          td_user.last_name AS target_last_name,
          td_user.email AS target_email,
          td_user.department AS target_department

        FROM item_references r
        LEFT JOIN documents sd ON (r.source_type = 'document' AND r.source_id = sd.document_id)
        LEFT JOIN users sd_user ON (sd.created_by = sd_user.id)
        LEFT JOIN templates st ON (r.source_type = 'template' AND r.source_id = st.id)
        LEFT JOIN users st_user ON (st.created_by = st_user.id)
        LEFT JOIN documents td ON (r.target_type = 'document' AND r.target_id = td.document_id)
        LEFT JOIN users td_user ON (td.created_by = td_user.id)
        ORDER BY r.updated_at DESC
      `;

      const [rows] = await pool.query(sql);

      // Map and format relations
      const allReferences = rows.map((row) => {
        const isTemplate = row.source_type === 'template';
        const sourceTitle = isTemplate ? (row.temp_source_title || 'Untitled Template') : (row.doc_source_title || 'Untitled Document');
        const sourceStatus = isTemplate ? (row.temp_source_status || 'draft') : (row.doc_source_status || 'draft');
        const sourceVersion = isTemplate ? (row.temp_source_version || '1') : (row.doc_source_version || '1');
        const sourceCreatedBy = isTemplate ? row.temp_source_created_by : row.doc_source_created_by;
        const sourceAuthor = isTemplate
          ? (`${row.temp_source_first_name || ''} ${row.temp_source_last_name || ''}`.trim() || row.temp_source_email || 'Author')
          : (`${row.doc_source_first_name || ''} ${row.doc_source_last_name || ''}`.trim() || row.doc_source_email || 'Author');
        const sourceDepartment = isTemplate ? (row.temp_source_department || '') : (row.doc_source_department || '');
        const sourceUpdatedAt = isTemplate ? row.temp_source_updated_at : row.doc_source_updated_at;

        const targetTitle = row.target_title || 'Untitled Referenced Document';
        const targetStatus = row.target_status || 'published';
        const targetVersion = row.target_version || '1';
        const targetCreatedBy = row.target_created_by;
        const targetAuthor = `${row.target_first_name || ''} ${row.target_last_name || ''}`.trim() || row.target_email || 'Author';
        const targetDepartment = row.target_department || '';
        const targetUpdatedAt = row.target_updated_at;

        // Raw approvers check for user relevance
        const rawApprovers = isTemplate ? row.temp_source_approvers : row.doc_source_approvers;
        const rawReqApprovers = isTemplate ? row.temp_source_required_approvers : row.doc_source_required_approvers;

        return {
          id: row.reference_id,
          sourceType: row.source_type,
          sourceId: row.source_id,
          sourceTitle,
          sourceStatus,
          sourceVersion,
          sourceCreatedBy,
          sourceAuthor,
          sourceDepartment,
          sourceUpdatedAt,
          rawApprovers,
          rawReqApprovers,

          targetType: row.target_type,
          targetId: row.target_id,
          targetTitle,
          targetStatus,
          targetVersion,
          targetCreatedBy,
          targetAuthor,
          targetDepartment,
          targetUpdatedAt,

          createdAt: row.reference_created_at,
          updatedAt: row.reference_updated_at,
        };
      });

      // Role-based visibility filtering
      const filteredByRole = allReferences.filter((ref) => {
        if (isAdminOrPM) return true;

        // User authored source
        if (Number(ref.sourceCreatedBy) === Number(userId)) return true;

        // User authored target
        if (Number(ref.targetCreatedBy) === Number(userId)) return true;

        // User is an assigned reviewer or approver for source
        const checkInApprovers = (raw) => {
          if (!raw) return false;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const list = Array.isArray(parsed) ? parsed : [...(parsed.reviewers || []), ...(parsed.approvers || [])];
            return list.some((a) =>
              Number(a.userId || a.id) === Number(userId) ||
              (a.email && userEmail && a.email.toLowerCase() === userEmail)
            );
          } catch (_) {
            return false;
          }
        };

        if (checkInApprovers(ref.rawApprovers) || checkInApprovers(ref.rawReqApprovers)) {
          return true;
        }

        return false;
      });

      // Compute global metrics for the current viewer scope
      const metrics = {
        totalReferences: filteredByRole.length,
        referencingDocuments: new Set(filteredByRole.filter(r => r.sourceType === 'document').map(r => r.sourceId)).size,
        referencingTemplates: new Set(filteredByRole.filter(r => r.sourceType === 'template').map(r => r.sourceId)).size,
        uniqueReferencedTargets: new Set(filteredByRole.map(r => r.targetId)).size,
        byStatus: {
          all: filteredByRole.length,
          draft: filteredByRole.filter(r => r.sourceStatus === 'draft').length,
          pending_review: filteredByRole.filter(r => ['pending_review', 'reviewed', 'pending_revision', 'revised'].includes(r.sourceStatus)).length,
          pending_approval: filteredByRole.filter(r => ['pending_approval', 'approved'].includes(r.sourceStatus)).length,
          published: filteredByRole.filter(r => r.sourceStatus === 'published').length,
          archived: filteredByRole.filter(r => ['archived', 'pending_archive_approval', 'old'].includes(r.sourceStatus)).length
        }
      };

      // Filter by type if provided
      let results = filteredByRole;
      if (type && type !== 'all') {
        results = results.filter((r) => r.sourceType === (type === 'documents' ? 'document' : type === 'templates' ? 'template' : type));
      }

      // Filter by status if provided
      if (status && status !== 'all') {
        const s = status.toLowerCase();
        if (s === 'draft') results = results.filter(r => r.sourceStatus === 'draft');
        else if (s === 'in_review' || s === 'pending_review') results = results.filter(r => ['pending_review', 'reviewed', 'pending_revision', 'revised'].includes(r.sourceStatus));
        else if (s === 'in_approval' || s === 'pending_approval') results = results.filter(r => ['pending_approval', 'approved'].includes(r.sourceStatus));
        else if (s === 'published') results = results.filter(r => r.sourceStatus === 'published');
        else if (s === 'archived') results = results.filter(r => ['archived', 'pending_archive_approval', 'old'].includes(r.sourceStatus));
      }

      // Filter by search query
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        results = results.filter((r) =>
          r.sourceTitle.toLowerCase().includes(q) ||
          r.targetTitle.toLowerCase().includes(q) ||
          r.sourceId.toLowerCase().includes(q) ||
          r.targetId.toLowerCase().includes(q) ||
          r.sourceAuthor.toLowerCase().includes(q) ||
          r.targetAuthor.toLowerCase().includes(q)
        );
      }

      return res.json({
        success: true,
        data: results,
        metrics,
        roleScope: isAdminOrPM ? 'admin' : 'user'
      });
    } catch (error) {
      console.error('Error fetching references:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch references' });
    }
  });

  /**
   * POST /api/references/sync
   * Triggers an on-demand re-scan of all documents and templates
   */
  app.post('/api/references/sync', authenticateToken, async (req, res) => {
    try {
      await syncAllHistoricalReferences(pool);
      if (logAuditEvent) {
        await logAuditEvent({
          userId: req.user?.id,
          action: 'REFERENCES_SYNCED',
          details: { triggeredBy: req.user?.email }
        });
      }
      return res.json({ success: true, message: 'References re-indexed successfully' });
    } catch (error) {
      console.error('Error syncing references:', error);
      return res.status(500).json({ success: false, error: 'Failed to sync references' });
    }
  });

  /**
   * POST /api/references/check-obsolete
   * Checks if any referenced document in the given content or source item is obsolete (status = 'archived')
   */
  app.post('/api/references/check-obsolete', authenticateToken, async (req, res) => {
    try {
      const { sourceType, sourceId, content, elements } = req.body || {};
      const targetIds = new Set();

      // 1. Extract from provided content or elements (in-memory unsaved editor state)
      if (content || elements) {
        const extracted = extractDocReferences(content, elements);
        extracted.forEach((id) => targetIds.add(String(id)));
      }

      // 2. Extract from item_references if sourceType and sourceId are provided
      if (sourceType && sourceId) {
        const [rows] = await pool.execute(
          'SELECT target_id FROM item_references WHERE source_type = ? AND source_id = ?',
          [sourceType, String(sourceId)]
        );
        rows.forEach((r) => targetIds.add(String(r.target_id)));
      }

      if (targetIds.size === 0) {
        return res.json({
          success: true,
          hasObsolete: false,
          obsoleteDocuments: []
        });
      }

      // 3. Query documents matching targetIds where status is archived (obsolete after approval)
      const targetList = Array.from(targetIds);
      const placeholders = targetList.map(() => '?').join(',');
      const [docs] = await pool.query(
        `SELECT document_id, title, status, version, current_revision, updated_at 
         FROM documents 
         WHERE document_id IN (${placeholders}) AND status = 'archived'`,
        targetList
      );

      const obsoleteDocs = docs.map((d) => ({
        id: d.document_id,
        documentId: d.document_id,
        title: d.title || 'Untitled Document',
        status: d.status,
        version: d.version || '1.0',
        currentRevision: d.current_revision,
        updatedAt: d.updated_at
      }));

      return res.json({
        success: true,
        hasObsolete: obsoleteDocs.length > 0,
        obsoleteDocuments: obsoleteDocs
      });
    } catch (error) {
      console.error('Error checking obsolete references:', error);
      return res.status(500).json({ success: false, error: 'Failed to check obsolete references' });
    }
  });

  /**
   * POST /api/references/check-inbound
   * Checks if any active (non-archived) document or template is currently referencing the given target document
   */
  app.post('/api/references/check-inbound', authenticateToken, async (req, res) => {
    try {
      const { targetId } = req.body || {};
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'targetId is required' });
      }

      // Query inbound references from item_references
      const sql = `
        SELECT 
          r.source_type,
          r.source_id,
          r.target_id,
          -- Document source
          sd.title AS doc_title,
          sd.status AS doc_status,
          sd.document_number AS doc_number,
          sd.version AS doc_version,
          sd.current_revision AS doc_revision,
          sd.department AS doc_department,
          CONCAT_WS(' ', sdu.first_name, sdu.last_name) AS doc_author,
          -- Template source
          st.name AS temp_name,
          st.status AS temp_status,
          st.version AS temp_version,
          CONCAT_WS(' ', stu.first_name, stu.last_name) AS temp_author
        FROM item_references r
        LEFT JOIN documents sd ON (r.source_type = 'document' AND r.source_id = sd.document_id)
        LEFT JOIN users sdu ON (sd.created_by = sdu.id)
        LEFT JOIN templates st ON (r.source_type = 'template' AND r.source_id = st.id)
        LEFT JOIN users stu ON (st.created_by = stu.id)
        WHERE r.target_id = ?
      `;

      const [rows] = await pool.query(sql, [String(targetId)]);

      // Filter to only active, non-archived sources that are referencing this item
      const referencingItems = [];
      const archivedStatuses = ['archived', 'old'];

      for (const row of rows) {
        // Skip self-reference if any
        if (String(row.source_id) === String(targetId)) continue;

        if (row.source_type === 'document' && row.doc_title) {
          const status = (row.doc_status || '').toLowerCase();
          if (!archivedStatuses.includes(status)) {
            referencingItems.push({
              id: row.source_id,
              type: 'document',
              title: row.doc_title,
              status: row.doc_status,
              number: row.doc_number || row.source_id,
              version: row.doc_revision || row.doc_version || '1.0',
              department: row.doc_department || '',
              author: row.doc_author || 'Unknown'
            });
          }
        } else if (row.source_type === 'template' && row.temp_name) {
          const status = (row.temp_status || '').toLowerCase();
          if (!archivedStatuses.includes(status)) {
            referencingItems.push({
              id: row.source_id,
              type: 'template',
              title: row.temp_name,
              status: row.temp_status,
              number: row.source_id,
              version: row.temp_version || '1.0',
              department: '',
              author: row.temp_author || 'Unknown'
            });
          }
        }
      }

      return res.json({
        success: true,
        isBlocked: referencingItems.length > 0,
        referencingItems
      });
    } catch (error) {
      console.error('Error checking inbound references:', error);
      return res.status(500).json({ success: false, error: 'Failed to check inbound references' });
    }
  });

  return {
    syncItemReferences,
    extractDocReferences,
    syncAllHistoricalReferences
  };
};

module.exports.syncItemReferences = syncItemReferences;
module.exports.extractDocReferences = extractDocReferences;
module.exports.syncAllHistoricalReferences = syncAllHistoricalReferences;

