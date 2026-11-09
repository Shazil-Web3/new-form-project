import pool from "../config/db";
import { getEffectiveAccess } from "../access/accessControl";
import { logAuditEvent } from "../config/auditLogger";

// Grants reviewer/approver permissions for a document workflow and revokes
// permissions of users removed from the workflow. (This helper previously had
// no definition in this module, so syncing approvers from here threw a
// ReferenceError; the logic mirrors syncDocumentWorkflowPermissions.)
async function grantDocumentWorkflowPermissions(documentId, workflowInput, assignedByUserId) {
  if (workflowInput === undefined || workflowInput === null) return;
  let wf: any = workflowInput;
  if (typeof wf === 'string') {
    try {
      wf = JSON.parse(wf);
    } catch (e) {
      return;
    }
  }
  if (!wf || typeof wf !== 'object') return;
  const { rows: docRows } = await pool.query('SELECT created_by, organization_id, title FROM documents WHERE document_id = $1', [documentId]);
  if (!docRows || docRows.length === 0) return;
  const creatorId = docRows[0]?.created_by;
  const orgId = docRows[0]?.organization_id || 1;
  const docTitle = docRows[0]?.title;

  const activeUserIds = new Set<any>();

  const grantList = async (list, permissionType) => {
    for (const item of list || []) {
      const uid = item.userId ?? item.id;
      if (uid == null || Number(uid) === Number(creatorId)) continue;
      const numUid = Number(uid);
      activeUserIds.add(numUid);
      await pool.query(
        `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (document_id, user_id) DO UPDATE SET permission_type = EXCLUDED.permission_type, assigned_by = EXCLUDED.assigned_by, status = 'active'`,
        [documentId, numUid, permissionType, assignedByUserId || creatorId]
      );
      await logAuditEvent(pool, {
        orgId,
        userId: assignedByUserId || creatorId,
        actionType: 'PERMISSION_GRANTED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: { title: docTitle, targetUserId: numUid, permissionType, assignedBy: assignedByUserId || creatorId }
      }).catch(() => {});
    }
  };

  await grantList(wf.reviewers, 'reviewer');
  await grantList(wf.approvers, 'approver');

  const { rows: existingPerms } = await pool.query(
    `SELECT user_id, permission_type FROM documentpermissions WHERE document_id = $1 AND status = 'active' AND permission_type != 'author'`,
    [documentId]
  );
  for (const p of existingPerms) {
    if (Number(p.user_id) !== Number(creatorId) && !activeUserIds.has(Number(p.user_id))) {
      await pool.query(
        `UPDATE documentpermissions SET status = 'inactive' WHERE document_id = $1 AND user_id = $2 AND permission_type != 'author'`,
        [documentId, p.user_id]
      );
      await logAuditEvent(pool, {
        orgId,
        userId: assignedByUserId || creatorId,
        actionType: 'PERMISSION_REVOKED',
        resourceType: 'document',
        resourceId: documentId,
        documentId,
        details: { title: docTitle, targetUserId: p.user_id, permissionType: p.permission_type, assignedBy: assignedByUserId || creatorId }
      }).catch(() => {});
    }
  }
}


function normalizeDocumentRowForClient(row) {
  if (!row) return null;
  let elements: any = {};
  try {
    elements = row.elements ? (typeof row.elements === 'string' ? JSON.parse(row.elements) : row.elements) : {};
  } catch (e) {
    elements = {};
  }
  let contentRaw = row.content;
  let contentObj: any = {};
  try {
    contentObj = typeof contentRaw === 'string' ? JSON.parse(contentRaw || '{}') : contentRaw || {};
  } catch (e) {
    contentObj = { content: typeof contentRaw === 'string' ? contentRaw : '' };
  }

  const parseMaybeJsonString = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // Sometimes HTML is saved as a JSON string literal: "\"<p>...</p>\""
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  const resolvedContentObj = parseMaybeJsonString(contentObj);
  const resolvedRaw = parseMaybeJsonString(contentRaw);
  
  // Enforce pure JSON block array or HTML string model
  const jsonBlocksContent =
    (resolvedContentObj &&
      typeof resolvedContentObj === 'object' &&
      (Array.isArray(resolvedContentObj.content) || typeof resolvedContentObj.content === 'string') &&
      resolvedContentObj.content) ||
    (Array.isArray(resolvedContentObj) || typeof resolvedContentObj === 'string' ? resolvedContentObj : (Array.isArray(resolvedRaw) || typeof resolvedRaw === 'string' ? resolvedRaw : []));

  const isSummaryRow = row.content === undefined && row.elements === undefined;
  const virtualComments = isSummaryRow ? null : JSON.stringify({
    content: jsonBlocksContent,
    comments: elements.comments || [],
    suggestions: elements.suggestedEdits || elements.suggestions || [],
    references: elements.references || [],
    manualReferences: elements.manualReferences || [],
    headerHTML: elements.headerHTML || '',
    footerHTML: elements.footerHTML || '',
    logo: elements.logo ?? null,
    logoText: elements.logoText || '',
    logoTextRight: elements.logoTextRight || '',
    orientation: elements.orientation || contentObj?.orientation || 'portrait',
    paperSize: elements.paperSize || contentObj?.paperSize || 'A4',
    pagesState: elements.pagesState || contentObj?.pagesState || null
  });

  let template_approvers: any = { reviewers: [], approvers: [] };
  try {
    if (row.approvers) {
      const a = typeof row.approvers === 'string' ? JSON.parse(row.approvers) : row.approvers;
      // Only accept the {reviewers, approvers} workflow shape; ignore legacy array format
      if (a && !Array.isArray(a) && (a.reviewers !== undefined || a.approvers !== undefined)) {
        template_approvers = {
          reviewers: Array.isArray(a.reviewers) ? a.reviewers : [],
          approvers: Array.isArray(a.approvers) ? a.approvers : []
        };
      }
    }
  } catch (e) {
    /* ignore */
  }

  return {
    ...row,
    id: row.document_id,
    document_id: row.document_id,
    name: row.title,
    title: row.title,
    comments: virtualComments,
    orientation: elements.orientation || contentObj?.orientation || 'portrait',
    paperSize: elements.paperSize || contentObj?.paperSize || 'A4',
    pagesState: elements.pagesState || contentObj?.pagesState || null,
    template_approvers,
    template_structure: {
      locked_elements: {},
      allowAttachments: false,
      includeTableOfContents: false
    },
    description: null,
    notes: row.notes || null,
    category_id: null,
    version: row.version || row.current_revision || 1,
    required_approvers: row.required_approvers ? (typeof row.required_approvers === 'string' ? JSON.parse(row.required_approvers) : row.required_approvers) : []
  };
}

async function syncDocumentApproversWithTemplate(document) {
  if (!document || !document.template_id) return document;
  try {
    const { rows: templateRows } = await pool.query(
      'SELECT custom_document_approvers FROM templates WHERE id = $1',
      [document.template_id]
    );
    if (templateRows.length > 0 && templateRows[0].custom_document_approvers) {
      const customApproversRaw = typeof templateRows[0].custom_document_approvers === 'string'
        ? JSON.parse(templateRows[0].custom_document_approvers)
        : templateRows[0].custom_document_approvers;

      if (Array.isArray(customApproversRaw) && customApproversRaw.length > 0) {
        // Parse document's current workflow to see which set was selected
        let currentWorkflow: any = { reviewers: [], approvers: [] };
        if (document.approvers) {
          try {
            currentWorkflow = typeof document.approvers === 'string'
              ? JSON.parse(document.approvers)
              : document.approvers;
          } catch (e) {}
        }

        let customApproversList = [];
        // Check if it's the new format (array of sets)
        if (customApproversRaw[0].name !== undefined) {
          const selectedSetId = currentWorkflow.selectedSetId;
          const selectedSet = customApproversRaw.find(s => s.id === selectedSetId) || customApproversRaw[0];
          customApproversList = selectedSet.departments || [];
        } else {
          // Legacy format
          customApproversList = customApproversRaw;
        }

        // Build list of valid departments from template's custom config
        const validDepts = new Set<any>(customApproversList.map(item => item.department));

        // Helper to sync role arrays (reviewers or approvers)
        const syncRoleList = (currentList) => {
          return currentList;
        };

        const newReviewers = syncRoleList(currentWorkflow.reviewers || []);
        const newApprovers = syncRoleList(currentWorkflow.approvers || []);

        const newWorkflow = {
          ...currentWorkflow,
          reviewers: newReviewers,
          approvers: newApprovers
        };

        // Update document required_approvers departments list too
        let newRequired = [];
        if (document.required_approvers) {
          try {
            newRequired = typeof document.required_approvers === 'string'
              ? JSON.parse(document.required_approvers)
              : document.required_approvers;
          } catch (e) {}
        }
        if (!Array.isArray(newRequired)) newRequired = [];
        
        // Build unique departments from current custom list
        const currentDepts = customApproversList.map(item => item.department);
        // Re-map/sync required_approvers departments
        const updatedRequired = currentDepts.map((dept, idx) => {
          const existingDept = newRequired.find(d => d.department === dept);
          const templateDept = customApproversList.find(c => c.department === dept);
          return {
            key: existingDept?.key ?? idx,
            department: dept,
            mandatory: true,
            stage: existingDept?.stage ?? templateDept?.stage ?? 1
          };
        });

        const workflowJsonStr = JSON.stringify(newWorkflow);
        const requiredJsonStr = JSON.stringify(updatedRequired);

        // Optimization: Only write to database if workflow configuration has actually changed
        const currentWorkflowStr = typeof document.approvers === 'string' ? document.approvers : JSON.stringify(document.approvers || null);
        const currentRequiredStr = typeof document.required_approvers === 'string' ? document.required_approvers : JSON.stringify(document.required_approvers || null);

        if (workflowJsonStr !== currentWorkflowStr || requiredJsonStr !== currentRequiredStr) {
          await pool.query(
            'UPDATE documents SET approvers = $1, required_approvers = $2 WHERE document_id = $3',
            [workflowJsonStr, requiredJsonStr, document.document_id]
          );

          // Also grant/revoke permissions in documentpermissions table
          await grantDocumentWorkflowPermissions(document.document_id, newWorkflow, document.created_by);

          // Revoke permissions for users who were removed and status is still pending
          const allCurrentUniqueUserIds = new Set<any>([
            ...newReviewers.map(r => String(r.userId)),
            ...newApprovers.map(a => String(a.userId))
          ]);

          // Deactivate permission rows for users no longer in the workflow (excluding the author)
          const { rows: permRows } = await pool.query(
            'SELECT user_id FROM documentpermissions WHERE document_id = $1 AND status = "active" AND permission_type != "author"',
            [document.document_id]
          );
          for (const row of permRows) {
            if (!allCurrentUniqueUserIds.has(String(row.user_id))) {
              await pool.query(
                'UPDATE documentpermissions SET status = "inactive" WHERE document_id = $1 AND user_id = $2 AND permission_type != "author"',
                [document.document_id, row.user_id]
              );
            }
          }
        }

        // Update returned document object
        document.approvers = workflowJsonStr;
        document.required_approvers = requiredJsonStr;
      }
    }
  } catch (err) {
    console.error('Error syncing template custom approvers with document:', err);
  }
  return document;
}

async function assertUserDocumentAccess(documentId, userId, dbPool = pool, requiredAction = 'read') {
  if (!documentId || !userId) return false;
  const db = dbPool || pool;
  
  const { rows: docRows } = await db.query(
    `SELECT d.document_id, d.created_by, d.organization_id, d.approvers,
            dp.permission_type, dp.status as perm_status
     FROM documents d
     LEFT JOIN documentpermissions dp ON d.document_id = dp.document_id AND dp.user_id = $1 AND dp.status = 'active'
     WHERE d.document_id = $2`,
    [userId, documentId]
  );

  if (docRows.length === 0) return false;

  const { rows: userRows } = await db.query('SELECT id, role, email, organization_id FROM users WHERE id = $1', [userId]);
  const user = userRows[0] || {};
  const access = await getEffectiveAccess(db, user);
  if (access.isSuperAdmin) return true;
  if (user.organization_id && docRows[0].organization_id && String(user.organization_id) !== String(docRows[0].organization_id)) {
    return false;
  }
  if (user.role === 'admin') return true;

  // Temp View users may read ONLY their assigned approved document, and
  // only inside their access window. Expiry is enforced by the grant rows
  // (expires_at <= NOW() stops matching) plus this check.
  const { rows: tempGrantRows } = await db.query(
    `SELECT DISTINCT r.role_key FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
    [userId]
  );
  const tempKeys = tempGrantRows.map(row => row.role_key);
  if (tempKeys.includes('temporary_view') && !tempKeys.some(key => key !== 'temporary_view')) {
    const { rows: [tempRow] } = await db.query(
      'SELECT temp_view_document_id, temp_view_expires_at FROM users WHERE id = $1',
      [userId]
    );
    const expiresAt = tempRow?.temp_view_expires_at ? new Date(tempRow.temp_view_expires_at).getTime() : NaN;
    if (requiredAction === 'read' && Number.isFinite(expiresAt) && expiresAt > Date.now() &&
        String(tempRow.temp_view_document_id) === String(documentId)) {
      return true;
    }
    return false;
  }

  const isCreator = String(docRows[0].created_by) === String(userId);
  const hasActivePerm = docRows.some(r => r.perm_status === 'active');
  const userPerms = docRows.filter(r => r.perm_status === 'active').map(r => r.permission_type);

  if (requiredAction === 'delete' || requiredAction === 'author_only') {
    if (isCreator || userPerms.includes('author')) return true;
    return false;
  }

  if (isCreator || hasActivePerm) return true;

  // Backward-compatibility fallback:
  // older workflow documents may have approvers JSON but missing permission rows.
  try {
    const { rows: [userRow] } = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    const approversRaw = docRows[0]?.approvers;
    if (!approversRaw) return false;
    const wf = typeof approversRaw === 'string' ? JSON.parse(approversRaw) : approversRaw;
    const reviewers = Array.isArray(wf?.reviewers) ? wf.reviewers : [];
    const approvers = Array.isArray(wf?.approvers) ? wf.approvers : [];
    const people = [...reviewers, ...approvers];
    const email = String(userRow?.email || '').toLowerCase();
    return people.some((p) => {
      const byId = String(p?.userId ?? p?.id ?? '') === String(userId);
      const byEmail = email && String(p?.email || '').toLowerCase() === email;
      return byId || byEmail;
    });
  } catch (e) {
    console.warn('assertUserDocumentAccess fallback parse error:', e);
    return false;
  }
}

async function assertUserTemplateAccess(templateId, userId, dbPool = pool, requiredAction = 'read') {
  if (!templateId || !userId) return false;
  const db = dbPool || pool;

  const { rows: userRows } = await db.query(
    'SELECT id, organization_id, role, email, template_approver FROM users WHERE id = $1',
    [userId]
  );
  if (userRows.length === 0) return false;
  const user = userRows[0];
  const access = await getEffectiveAccess(db, user);
  if (access.isSuperAdmin) return true;

  const { rows: tplRows } = await db.query(
    'SELECT id, organization_id, created_by, template_approvers FROM templates WHERE id = $1',
    [templateId]
  );
  if (tplRows.length === 0) return false;
  const template = tplRows[0];

  // Must belong to the same organization
  if (String(user.organization_id) !== String(template.organization_id)) {
    return false;
  }

  const isCreator = String(template.created_by) === String(userId);
  const isAdmin = user.role === 'admin';

  if (requiredAction === 'delete') {
    return isCreator || isAdmin;
  }

  if (requiredAction === 'write' || requiredAction === 'edit') {
    if (isCreator || isAdmin) return true;
    // Check if user is in template_approvers or has template_approver privilege
    if (user.template_approver === 'yes') return true;
    try {
      if (template.template_approvers) {
        const wf = typeof template.template_approvers === 'string'
          ? JSON.parse(template.template_approvers)
          : template.template_approvers;
        const reviewers = Array.isArray(wf?.reviewers) ? wf.reviewers : [];
        const approvers = Array.isArray(wf?.approvers) ? wf.approvers : [];
        const people = [...reviewers, ...approvers];
        const email = String(user.email || '').toLowerCase();
        return people.some((p) => {
          const byId = String(p?.userId ?? p?.id ?? '') === String(userId);
          const byEmail = email && String(p?.email || '').toLowerCase() === email;
          return byId || byEmail;
        });
      }
    } catch (e) {
      console.warn('assertUserTemplateAccess workflow parse error:', e);
    }
    return false;
  }

  // Default 'read' access is permitted for any user in the same organization
  return true;
}

async function assertUserAttachmentAccess(attachmentId, userId, dbPool = pool, requiredAction = 'read') {
  if (!attachmentId || !userId) return { notFound: false, allowed: false, attachment: null };
  const db = dbPool || pool;

  const { rows: rows } = await db.query('SELECT * FROM attachments WHERE id = $1', [attachmentId]);
  if (rows.length === 0) return { notFound: true, allowed: false, attachment: null };
  const attachment = rows[0];

  const { rows: userRows } = await db.query('SELECT id, organization_id, role FROM users WHERE id = $1', [userId]);
  if (userRows.length === 0) return { notFound: false, allowed: false, attachment: null };
  const user = userRows[0];
  const access = await getEffectiveAccess(db, user);
  if (access.isSuperAdmin) {
    return { notFound: false, allowed: true, attachment };
  }

  const isAdmin = user.role === 'admin';
  const isUploader = String(attachment.uploaded_by) === String(userId);

  if (isAdmin) {
    return { notFound: false, allowed: true, attachment };
  }

  if (attachment.association_type === 'temp') {
    if (isUploader) {
      return { notFound: false, allowed: true, attachment };
    }
    return { notFound: false, allowed: false, attachment };
  }

  if (attachment.association_type === 'document') {
    if (requiredAction === 'delete') {
      // Allow uploader, or anyone with write/delete access to the document
      const canManageDoc = (await assertUserDocumentAccess(attachment.association_id, userId, db, 'write')) ||
                           (await assertUserDocumentAccess(attachment.association_id, userId, db, 'delete'));
      if (isUploader || canManageDoc) {
        return { notFound: false, allowed: true, attachment };
      }
      return { notFound: false, allowed: false, attachment };
    }
    const hasDocAccess = await assertUserDocumentAccess(attachment.association_id, userId, db, 'read');
    return { notFound: false, allowed: hasDocAccess, attachment };
  }

  if (attachment.association_type === 'template') {
    if (requiredAction === 'delete') {
      // Allow uploader, or anyone with write/delete access to the template
      const canManageTpl = (await assertUserTemplateAccess(attachment.association_id, userId, db, 'write')) ||
                           (await assertUserTemplateAccess(attachment.association_id, userId, db, 'delete'));
      if (isUploader || canManageTpl) {
        return { notFound: false, allowed: true, attachment };
      }
      return { notFound: false, allowed: false, attachment };
    }
    const hasTplAccess = await assertUserTemplateAccess(attachment.association_id, userId, db, 'read');
    return { notFound: false, allowed: hasTplAccess, attachment };
  }

  return { notFound: false, allowed: false, attachment };
}

/**
 * Sanitizes workflow approver/reviewer data when transitioning status.
 * Ensures previous approvals, rejections, comments, and signatures are completely cleared
 * when a template or document reverts to draft or begins a fresh approval cycle.
 *
 * @param {string|object|Array} workflowData - Raw JSON string or parsed object/array
 * @param {string} targetStatus - The status being transitioned to ('draft', 'pending_revision', 'pending_review', 'pending_approval')
 * @returns {object|Array} Cleaned workflow data
 */
function resetWorkflowState(workflowData, targetStatus) {
  if (!workflowData) return workflowData;

  let parsed = workflowData;
  if (typeof workflowData === 'string') {
    try {
      parsed = JSON.parse(workflowData);
    } catch (_) {
      return workflowData;
    }
  }

  const cleanEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const {
      reviewedAt,
      approvedAt,
      rejectedAt,
      reviewedBy,
      approvedBy,
      rejectedBy,
      signature,
      signatureData,
      comment,
      rejection_reason,
      ...rest
    } = entry;

    return {
      ...rest,
      status: 'pending',
      received_at: rest.received_at || rest.assigned_at || new Date().toISOString()
    };
  };

  const isRevertingToDraft = targetStatus === 'draft' || targetStatus === 'pending_revision' || targetStatus === 'archive_draft';
  const isPendingReview = targetStatus === 'pending_review' || targetStatus === 'pending_archive_review';
  const isPendingApproval = targetStatus === 'pending_approval' || targetStatus === 'pending_archive_approval';

  // Structure 1: { reviewers: [...], approvers: [...] }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const updated = { ...parsed };

    if (isRevertingToDraft || isPendingReview) {
      if (Array.isArray(updated.reviewers)) {
        updated.reviewers = updated.reviewers.map(cleanEntry);
      }
      if (Array.isArray(updated.approvers)) {
        updated.approvers = updated.approvers.map(cleanEntry);
      }
    } else if (isPendingApproval) {
      if (Array.isArray(updated.approvers)) {
        updated.approvers = updated.approvers.map(cleanEntry);
      }
    }

    return updated;
  }

  // Structure 2: Array of approvers [ ... ]
  if (Array.isArray(parsed)) {
    if (isRevertingToDraft || isPendingReview || isPendingApproval) {
      return parsed.map(cleanEntry);
    }
  }

  return parsed;
}

async function retireParentDocumentsToArchived(dbPool, documentId) {
  if (!dbPool || !documentId) return;
  try {
    const { rows: docRows } = await dbPool.query(
      'SELECT revision_parent_id, version, organization_id FROM documents WHERE document_id = $1',
      [documentId]
    );
    if (docRows && docRows.length > 0) {
      const publishedDocVersion = parseInt(docRows[0].version, 10) || 1;
      let currParentId = docRows[0].revision_parent_id;

      // Defensive check: If revision_parent_id points to documentId itself, clear it and return
      if (currParentId && String(currParentId) === String(documentId)) {
        console.warn(`[retireParentDocumentsToArchived] Self-referencing revision_parent_id detected on doc ${documentId}. Clearing it.`);
        await dbPool.query(
          'UPDATE documents SET revision_parent_id = NULL WHERE document_id = $1',
          [documentId]
        );
        return;
      }

      if (!currParentId) {
        return;
      }

      // Collect all ancestor versions to determine the correct version for the published doc
      let maxAncestorVersion = 0;
      let walkId = currParentId;
      const walkVisited = new Set<any>([String(documentId)]);
      while (walkId && !walkVisited.has(String(walkId))) {
        if (String(walkId) === String(documentId)) break;
        walkVisited.add(String(walkId));
        const { rows: pRows } = await dbPool.query(
          'SELECT version, revision_parent_id FROM documents WHERE document_id = $1',
          [walkId]
        );
        if (!pRows || pRows.length === 0) break;
        const pVer = parseInt(pRows[0].version, 10) || 1;
        if (pVer > maxAncestorVersion) maxAncestorVersion = pVer;
        walkId = pRows[0].revision_parent_id;
      }

      // If the published doc's version is not greater than the highest ancestor version,
      // it means the version was not correctly incremented at revision time — fix it now.
      if (maxAncestorVersion > 0 && publishedDocVersion <= maxAncestorVersion) {
        const correctVersion = maxAncestorVersion + 1;
        await dbPool.query(
          'UPDATE documents SET version = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2',
          [correctVersion, documentId]
        );
        console.log(`[retireParentDocumentsToArchived] Corrected version of published doc ${documentId} from ${publishedDocVersion} to ${correctVersion}`);
      }

      const visited = new Set<any>([String(documentId)]);
      while (currParentId && !visited.has(String(currParentId))) {
        if (String(currParentId) === String(documentId)) {
          break;
        }
        visited.add(String(currParentId));
        await dbPool.query(
          `UPDATE documents SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
           WHERE document_id = $1 AND status IN ('published', 'pending_revision', 'revised')`,
          [currParentId]
        );
        const { rows: nextParent } = await dbPool.query(
          'SELECT revision_parent_id FROM documents WHERE document_id = $1',
          [currParentId]
        );
        currParentId = nextParent && nextParent.length > 0 ? nextParent[0].revision_parent_id : null;
      }
    }
  } catch (retireErr) {
    console.error('Error auto-archiving parent document versions on publish:', retireErr);
  }
}

async function retireParentTemplatesToArchived(dbPool, templateId) {
  if (!dbPool || !templateId) return;
  try {
    const { rows: tplRows } = await dbPool.query(
      'SELECT revision_parent_id FROM templates WHERE id = $1',
      [templateId]
    );
    if (tplRows && tplRows.length > 0) {
      let currParentId = tplRows[0].revision_parent_id;

      // Defensive check: If revision_parent_id points to templateId itself, clear it and return
      if (currParentId && String(currParentId) === String(templateId)) {
        console.warn(`[retireParentTemplatesToArchived] Self-referencing revision_parent_id detected on template ${templateId}. Clearing it.`);
        await dbPool.query(
          'UPDATE templates SET revision_parent_id = NULL WHERE id = $1',
          [templateId]
        );
        return;
      }

      if (!currParentId) {
        return;
      }

      const visited = new Set<any>([String(templateId)]);
      while (currParentId && !visited.has(String(currParentId))) {
        if (String(currParentId) === String(templateId)) {
          break;
        }
        visited.add(String(currParentId));
        await dbPool.query(
          `UPDATE templates SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 AND status IN ('published', 'pending_revision', 'revised')`,
          [currParentId]
        );
        const { rows: nextParent } = await dbPool.query(
          'SELECT revision_parent_id FROM templates WHERE id = $1',
          [currParentId]
        );
        currParentId = nextParent && nextParent.length > 0 ? nextParent[0].revision_parent_id : null;
      }
    }
  } catch (retireErr) {
    console.error('Error auto-archiving parent template versions on publish:', retireErr);
  }
}

export {
  normalizeDocumentRowForClient,
  syncDocumentApproversWithTemplate,
  assertUserDocumentAccess,
  assertUserTemplateAccess,
  assertUserAttachmentAccess,
  resetWorkflowState,
  retireParentDocumentsToArchived,
  retireParentTemplatesToArchived
};
