const { assertUserTemplateAccess, resetWorkflowState, retireParentTemplatesToArchived } = require('../documents/documentHelpers');

module.exports = function registerTemplateWorkflowRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  io,
  safeJsonStringify,
  GoogleGenerativeAI,
  uuidv4,
  fs,
  path,
  aiLimiter,
  logAuditEvent
}) {
app.put('/api/template_review/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;

    if (!templateId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user authentication are required'
      });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    // Find and update reviewer status
    let reviewerIndex = templateApprovers.reviewers.findIndex(
      reviewer => String(reviewer.userId || reviewer.id) === String(userId) || 
                  (reviewer.email && userEmail && reviewer.email.toLowerCase() === userEmail.toLowerCase())
    );

    const nowIso = new Date().toISOString();
    const reviewerComment = req.body.comment || req.body.comments || '';

    if (reviewerIndex === -1) {
      if (isGlobalApprover) {
        if (!templateApprovers.reviewers || templateApprovers.reviewers.length === 0) {
          templateApprovers.reviewers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Reviewer',
            status: 'Reviewed',
            reviewedAt: nowIso,
            actionDate: nowIso,
            ...(reviewerComment ? { comment: reviewerComment } : {})
          }];
          reviewerIndex = 0;
        } else {
          const pendingIdx = templateApprovers.reviewers.findIndex(r => r.status !== 'Reviewed');
          if (pendingIdx !== -1) {
            templateApprovers.reviewers[pendingIdx] = {
              ...templateApprovers.reviewers[pendingIdx],
              status: 'Reviewed',
              reviewedAt: nowIso,
              actionDate: nowIso,
              reviewedBy: userId,
              ...(reviewerComment ? { comment: reviewerComment } : {})
            };
            reviewerIndex = pendingIdx;
          } else {
            reviewerIndex = 0;
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'User is not authorized to review this template'
        });
      }
    } else {
      // Update reviewer status
      templateApprovers.reviewers[reviewerIndex] = {
        ...templateApprovers.reviewers[reviewerIndex],
        status: 'Reviewed',
        reviewedAt: nowIso,
        actionDate: nowIso,
        ...(reviewerComment ? { comment: reviewerComment } : {})
      };
    }

    // Check if all reviewers have reviewed
    const allReviewed = templateApprovers.reviewers.every(r => r.status === 'Reviewed');
    let newStatus;
    if (currentTemplate.status === 'pending_archive_review') {
      newStatus = allReviewed ? 'archive_reviewed' : 'pending_archive_review';
    } else {
      newStatus = allReviewed ? 'reviewed' : 'pending_review';
    }

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           status = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), newStatus, templateId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: currentTemplate.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_REVIEWED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: currentTemplate.name,
          version: currentTemplate.version,
          allReviewed,
          newStatus
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Template reviewed successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error reviewing template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Revert template reviewers status endpoint
app.put('/api/template_revert_reviewers/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user?.userId;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const isAuthorized = await assertUserTemplateAccess(templateId, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Revert status from 'Reviewed' to 'pending'
    const targetEmails = req.body.emails;
    const shouldRevertAll = !targetEmails || !Array.isArray(targetEmails) || targetEmails.length === 0;

    let updated = false;
    if (templateApprovers.reviewers && Array.isArray(templateApprovers.reviewers)) {
      templateApprovers.reviewers = templateApprovers.reviewers.map(reviewer => {
        const matchesTarget = shouldRevertAll || targetEmails.includes(reviewer.email);
        if (matchesTarget && reviewer.status === 'Reviewed') {
          updated = true;
          const { reviewedAt, ...rest } = reviewer;
          return {
            ...rest,
            status: 'pending'
          };
        }
        return reviewer;
      });
    }

    // Update template status if we reverted any reviewer or if overall status was 'reviewed'
    let newStatus = currentTemplate.status;
    const hasAnyPendingReviewer = templateApprovers.reviewers && templateApprovers.reviewers.some(r => r.status === 'pending');
    if (hasAnyPendingReviewer && (newStatus === 'reviewed' || newStatus === 'archive_reviewed')) {
      newStatus = (currentTemplate.status === 'pending_archive_review' || currentTemplate.status === 'archive_reviewed') ? 'pending_archive_review' : 'pending_review';
      updated = true;
    }

    if (updated) {
      await pool.execute(
        `UPDATE templates 
         SET template_approvers = ?, 
             status = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [JSON.stringify(templateApprovers), newStatus, templateId]
      );
    }

    res.json({
      success: true,
      message: 'Template reviewers status reverted successfully',
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error reverting template reviewers status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert reviewers status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Approve endpoint
app.put('/api/template_approve/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;

    if (!templateId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user authentication are required'
      });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    // Find and update approver status
    let approverIndex = templateApprovers.approvers.findIndex(
      approver => String(approver.userId || approver.id) === String(userId) || 
                  (approver.email && userEmail && approver.email.toLowerCase() === userEmail.toLowerCase())
    );

    const nowIso = new Date().toISOString();
    const approverComment = req.body.comment || req.body.comments || '';

    if (approverIndex === -1) {
      if (isGlobalApprover && currentTemplate.status !== 'pending_archive_approval') {
        if (!templateApprovers.approvers || templateApprovers.approvers.length === 0) {
          templateApprovers.approvers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Approver',
            status: 'Approved',
            approvedAt: nowIso,
            actionDate: nowIso,
            ...(approverComment ? { comment: approverComment } : {})
          }];
          approverIndex = 0;
        } else {
          const pendingIdx = templateApprovers.approvers.findIndex(a => a.status !== 'Approved');
          if (pendingIdx !== -1) {
            templateApprovers.approvers[pendingIdx] = {
              ...templateApprovers.approvers[pendingIdx],
              status: 'Approved',
              approvedAt: nowIso,
              actionDate: nowIso,
              approvedBy: userId,
              ...(approverComment ? { comment: approverComment } : {})
            };
            approverIndex = pendingIdx;
          } else {
            approverIndex = 0;
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          error: currentTemplate.status === 'pending_archive_approval'
            ? 'Only assigned approvers are authorized to approve this archive request'
            : 'User is not authorized to approve this template'
        });
      }
    } else {
      // Update approver status
      templateApprovers.approvers[approverIndex] = {
        ...templateApprovers.approvers[approverIndex],
        status: 'Approved',
        approvedAt: nowIso,
        actionDate: nowIso,
        ...(approverComment ? { comment: approverComment } : {})
      };
    }

    // Check if all approvers have approved
    const allApproved = templateApprovers.approvers.every(a => a.status === 'Approved');
    let newStatus;
    if (currentTemplate.status === 'pending_archive_approval') {
      newStatus = allApproved ? 'archived' : 'pending_archive_approval';
    } else {
      newStatus = allApproved ? 'approved' : 'pending_approval';
    }

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           status = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), newStatus, templateId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: currentTemplate.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_APPROVED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: currentTemplate.name,
          version: currentTemplate.version,
          allApproved,
          newStatus
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Template approved successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error approving template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reject endpoint
app.put('/api/template_reject/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user?.userId;
    let userEmail = req.user?.email;
    const { comment } = req.body || {};

    if (!templateId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user authentication are required'
      });
    }

    if (!userEmail) {
      const [uRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) userEmail = uRows[0].email;
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Fetch user details for role verification
    const [userRows] = await pool.execute('SELECT id, role, template_approver, email, first_name, last_name FROM users WHERE id = ?', [userId]);
    const userObj = userRows[0] || {};
    const isAdmin = userObj.role === 'admin' || userObj.role === 'author' || userObj.role === '1';
    const isGlobalApprover = userObj.template_approver === 'yes' || isAdmin;

    // Find and update approver status
    let approverIndex = templateApprovers.approvers.findIndex(
      approver => String(approver.userId || approver.id) === String(userId) || 
                  (approver.email && userEmail && approver.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (approverIndex === -1) {
      if (isGlobalApprover && currentTemplate.status !== 'pending_archive_approval') {
        if (!templateApprovers.approvers || templateApprovers.approvers.length === 0) {
          templateApprovers.approvers = [{
            userId,
            email: userEmail || userObj.email,
            name: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Admin Rejector',
            status: 'Rejected',
            rejectedAt: new Date().toISOString(),
            comment: comment || ''
          }];
          approverIndex = 0;
        } else {
          const pendingIdx = templateApprovers.approvers.findIndex(a => a.status !== 'Rejected');
          if (pendingIdx !== -1) {
            templateApprovers.approvers[pendingIdx] = {
              ...templateApprovers.approvers[pendingIdx],
              status: 'Rejected',
              rejectedAt: new Date().toISOString(),
              rejectedBy: userId,
              comment: comment || ''
            };
            approverIndex = pendingIdx;
          } else {
            approverIndex = 0;
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          error: currentTemplate.status === 'pending_archive_approval'
            ? 'Only assigned approvers are authorized to reject this archive request'
            : 'User is not authorized to reject this template'
        });
      }
    } else {
      // Update approver status
      templateApprovers.approvers[approverIndex] = {
        ...templateApprovers.approvers[approverIndex],
        status: 'Rejected',
        rejectedAt: new Date().toISOString(),
        comment: comment || ''
      };
    }

    let newStatus = 'pending_review';
    if (currentTemplate.status === 'pending_archive_approval' || currentTemplate.status === 'pending_archive_review') {
      newStatus = 'published';
    }

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           status = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), newStatus, templateId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: currentTemplate.organization_id || 1,
        userId,
        actionType: 'TEMPLATE_REJECTED',
        resourceType: 'template',
        resourceId: templateId,
        details: {
          name: currentTemplate.name,
          version: currentTemplate.version,
          comment: comment || ''
        },
        req
      });
    }

    res.json({
      success: true,
      message: 'Template rejected successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error rejecting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reassign Template Reviewer or Approver
app.put('/api/templates/:templateId/reassign', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const authUserId = req.user?.userId || req.user?.id;
    const { currentUserId, newUser, targetEmail } = req.body;
    const targetUserId = currentUserId;

    if (!templateId || !newUser || !newUser.id) {
      return res.status(400).json({ success: false, error: 'Required fields are missing' });
    }

    const [tResult] = await pool.execute(
      'SELECT template_approvers, status, created_by FROM templates WHERE id = ?',
      [templateId]
    );
    if (tResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const tRow = tResult[0];
    const isAuthor = String(tRow.created_by) === String(authUserId);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.role === 'project_manager';
    const isSelf = (targetUserId && String(targetUserId) === String(authUserId)) ||
      (targetEmail && req.user?.email && targetEmail.toLowerCase() === req.user.email.toLowerCase());

    // Only the template owner, an admin, or the assigned reviewer/approver themself can reassign
    if (!isAuthor && !isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: 'Unauthorized. Only the template owner, an admin, or the assigned reviewer can reassign.' });
    }

    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = tRow.template_approvers ? (typeof tRow.template_approvers === 'string' ? JSON.parse(tRow.template_approvers) : tRow.template_approvers) : workflow;
    } catch (e) {
      console.error('parse template_approvers error', e);
    }

    let userIndex = -1;
    let listName = '';

    const matchUser = (u) => {
      const idMatch = targetUserId && String(u.userId ?? u.id) === String(targetUserId);
      const emailMatch = targetEmail && u.email && u.email.toLowerCase() === targetEmail.toLowerCase();
      const isPending = !u.status || String(u.status).toLowerCase() === 'pending';
      return (idMatch || emailMatch) && isPending;
    };

    if (tRow.status === 'pending_review' || tRow.status === 'reviewed') {
      listName = 'reviewers';
      userIndex = (workflow.reviewers || []).findIndex(matchUser);
    } else if (tRow.status === 'pending_approval') {
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
      return res.status(403).json({ success: false, error: 'User does not have pending authority on this template to reassign.' });
    }

    workflow[listName][userIndex] = {
      ...workflow[listName][userIndex],
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      department: newUser.department || workflow[listName][userIndex].department,
      status: 'pending'
    };

    await pool.execute(
      'UPDATE templates SET template_approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(workflow), templateId]
    );

    return res.json({
      success: true,
      message: 'Template authority reassigned successfully',
      template_approvers: workflow
    });
  } catch (error) {
    console.error('Template reassign error:', error);
    res.status(500).json({ success: false, error: 'Failed to reassign authority' });
  }
});

// Update Template Status
app.put('/api/templates/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    // Validate template ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    // Validate status is provided and valid
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (status === 'published' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only administrators are authorized to publish templates.'
      });
    }

    // Fetch current template record to inspect existing template_approvers and progress
    const [currentTplRows] = await pool.query(
      'SELECT template_approvers, status, progress_value FROM templates WHERE id = ?',
      [id]
    );

    if (currentTplRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    let updatedApprovers = currentTplRows[0].template_approvers;
    let shouldUpdateApprovers = false;
    let progressVal = currentTplRows[0].progress_value ?? 0;

    if (req.body.template_approvers || req.body.approvers) {
      const incoming = req.body.template_approvers || req.body.approvers;
      let parsedInc = typeof incoming === 'string' ? JSON.parse(incoming) : incoming;
      if (parsedInc && typeof parsedInc === 'object') {
        const nowIso = new Date().toISOString();
        if (Array.isArray(parsedInc.reviewers)) {
          parsedInc.reviewers = parsedInc.reviewers.map(r => ({
            ...r,
            received_at: r.received_at || r.assigned_at || nowIso
          }));
        }
        if (Array.isArray(parsedInc.approvers)) {
          parsedInc.approvers = parsedInc.approvers.map(a => ({
            ...a,
            received_at: a.received_at || a.assigned_at || nowIso
          }));
        }
      }
      updatedApprovers = JSON.stringify(parsedInc);
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

    // Update the template and return the updated record
    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.query(
        'UPDATE templates SET status = ?, template_approvers = ?, progress_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, updatedApprovers, progressVal, id]
      );

      // Attempt socket notification so active editor/preview sessions receive clean approvers immediately
      try {
        if (typeof io !== 'undefined') {
          io.to(`template-${id}`).emit('templateApproversUpdated', {
            templateId: id,
            template_approvers: updatedApprovers ? JSON.parse(updatedApprovers) : null,
            status
          });
        }
      } catch (socketErr) {
        console.warn('Could not emit socket event for templateApproversUpdated:', socketErr);
      }
    } else {
      [result] = await pool.query(
        'UPDATE templates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );
    }

    if (logAuditEvent) {
      const action = status === 'published' ? 'TEMPLATE_PUBLISHED' : 'TEMPLATE_STATUS_CHANGED';
      await logAuditEvent(pool, {
        orgId: req.user?.organization_id || req.user?.orgId || 1,
        userId,
        actionType: action,
        resourceType: 'template',
        resourceId: id,
        details: { status },
        req
      });
    }

    // Auto-retire parent template versions to 'archived' and clear comments when a template revision is published
    if (status === 'published') {
      try {
        await retireParentTemplatesToArchived(pool, id);
        const [tplRows] = await pool.execute('SELECT comments FROM templates WHERE id = ?', [id]);
        if (tplRows && tplRows.length > 0) {
          // Clean comments, suggestions, and highlight spans from the published template
          if (tplRows[0].comments) {
            let commentsObj = null;
            try {
              commentsObj = typeof tplRows[0].comments === 'string' ? JSON.parse(tplRows[0].comments) : tplRows[0].comments;
            } catch (_) {}
            if (commentsObj && typeof commentsObj === 'object') {
              commentsObj.comments = [];
              commentsObj.suggestions = [];
              if (typeof commentsObj.content === 'string') {
                commentsObj.content = commentsObj.content
                  .replace(/<span\b[^>]*\bclass="[^"]*(?:highlighted-text|temp-comment-highlight|temp-suggestion-highlight|temp-text-highlight|comment-highlight|suggestion-highlight|admin-edit|reviewer-edit)[^"]*"[^>]*>(.*?)<\/span>/gis, '$1')
                  .replace(/<span\b[^>]*\bdata-(?:comment|suggestededit|suggestion|active-comment)-id="[^"]*"[^>]*>(.*?)<\/span>/gis, '$1');
              }
              if (Array.isArray(commentsObj.pagesState)) {
                commentsObj.pagesState = commentsObj.pagesState.map(p => ({
                  ...p,
                  content: p.content && typeof p.content === 'string'
                    ? p.content
                        .replace(/<span\b[^>]*\bclass="[^"]*(?:highlighted-text|temp-comment-highlight|temp-suggestion-highlight|temp-text-highlight|comment-highlight|suggestion-highlight|admin-edit|reviewer-edit)[^"]*"[^>]*>(.*?)<\/span>/gis, '$1')
                        .replace(/<span\b[^>]*\bdata-(?:comment|suggestededit|suggestion|active-comment)-id="[^"]*"[^>]*>(.*?)<\/span>/gis, '$1')
                    : p.content
                }));
              }
              await pool.execute('UPDATE templates SET comments = ? WHERE id = ?', [JSON.stringify(commentsObj), id]);
            }
          }
        }
      } catch (retireErr) {
        console.error('Error auto-retiring parent template versions or cleaning comments on publish:', retireErr);
      }
    }

    res.json({
      success: true,
      message: 'Template status updated successfully',
      status,
      progress_value: progressVal,
      template_approvers: updatedApprovers ? (typeof updatedApprovers === 'string' ? JSON.parse(updatedApprovers) : updatedApprovers) : null
    });

  } catch (error) {
    console.error('Error updating template status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


app.get('/api/templates/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'read');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get the target template first to obtain its lineage information
    const [targetTemplate] = await pool.execute(
      'SELECT id, name, organization_id, revision_parent_id, version FROM templates WHERE id = ?',
      [id]
    );

    if (!targetTemplate.length) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const target = targetTemplate[0];
    const { organization_id } = target;

    // Collect all template IDs in this lineage
    const lineageIds = new Set();
    lineageIds.add(target.id);

    // Walk UP to find the root and collect all ancestors
    let currentParentId = target.revision_parent_id;
    const MAX_DEPTH = 100;
    let depth = 0;

    while (currentParentId && depth < MAX_DEPTH) {
      lineageIds.add(currentParentId);
      const [parentRows] = await pool.execute(
        'SELECT id, revision_parent_id FROM templates WHERE id = ? AND organization_id = ?',
        [currentParentId, organization_id]
      );
      if (parentRows.length === 0) {
        break;
      }
      currentParentId = parentRows[0].revision_parent_id;
      depth++;
    }

    // Walk DOWN from all collected ancestors/target to find all descendants (children, grandchildren, etc.)
    let idsToExpand = Array.from(lineageIds);
    depth = 0;
    while (idsToExpand.length > 0 && depth < MAX_DEPTH) {
      const placeholders = idsToExpand.map(() => '?').join(',');
      const [childRows] = await pool.execute(
        `SELECT id FROM templates 
         WHERE revision_parent_id IN (${placeholders}) AND organization_id = ?`,
        [...idsToExpand, organization_id]
      );

      const newChildren = [];
      for (const row of childRows) {
        if (!lineageIds.has(row.id)) {
          lineageIds.add(row.id);
          newChildren.push(row.id);
        }
      }
      idsToExpand = newChildren;
      depth++;
    }

    // Fetch all details for these specific templates in the lineage
    const idPlaceholders = Array.from(lineageIds).map(() => '?').join(',');
    const [history] = await pool.execute(
      `SELECT t.id, t.version, t.status, t.updated_at, t.ai_change_summary, t.revision_parent_id,
              u.first_name, u.last_name
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id IN (${idPlaceholders})
       ORDER BY t.version DESC, t.updated_at DESC`,
      Array.from(lineageIds)
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching template history:', error);
    res.status(500).json({ error: 'Failed to fetch revision history' });
  }
});

// Generate AI Summary for a template revision (Manual Trigger)
app.post('/api/templates/:id/generate-ai-summary', authenticateToken, aiLimiter || ((req, res, next) => next()), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const isAuthorized = await assertUserTemplateAccess(id, userId, pool, 'write');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Get the current template and its parent ID
    const [currentRows] = await pool.execute(
      'SELECT content, comments, revision_parent_id, version, ai_change_summary FROM templates WHERE id = ?',
      [id]
    );

    if (!currentRows.length) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const currentTemplate = currentRows[0];

    // If it's Version 1 or has no parent, we don't need a summary
    if (currentTemplate.version <= 1 || !currentTemplate.revision_parent_id) {
      return res.status(400).json({ error: 'AI summary is only available for revised versions (v2+)' });
    }

    // If summary already exists, return it
    if (currentTemplate.ai_change_summary) {
      return res.json({ summary: currentTemplate.ai_change_summary });
    }

    // 2. Get the parent template's content
    const [parentRows] = await pool.execute(
      'SELECT content, comments FROM templates WHERE id = ?',
      [currentTemplate.revision_parent_id]
    );

    if (!parentRows.length) {
      return res.status(404).json({ error: 'Parent version not found' });
    }

    const parentTemplate = parentRows[0];

    // 3. Prepare content for Gemini
    const extractContent = (tmpl) => {
      let html = "";
      if (tmpl.comments) {
        try {
          const parsed = JSON.parse(tmpl.comments);
          if (parsed.content) html = parsed.content;
        } catch (e) { }
      }
      if (!html && tmpl.content) {
        try {
          const parsed = JSON.parse(tmpl.content);
          html = parsed.content || tmpl.content;
        } catch (e) {
          html = tmpl.content;
        }
      }
      return html;
    };

    const oldContent = extractContent(parentTemplate);
    const newContent = extractContent(currentTemplate);

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is missing from environment');
      return res.status(503).json({ error: 'AI service not configured (API key missing)' });
    }

    // 4. Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using gemini-2.5-flash as requested. Explicitly setting API version to v1 for stability.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1' });

    const prompt = `
      Compare the following two versions of a document template and generate a concise, human-readable summary of the changes introduced in the new version.
      Focus on added sections, removed paragraphs, updated requirements, or modified terminology.
      Format the response as a bulleted list.
      
      New Version Content:
      "${cleanContentForAI(newContent)}"
      
      Previous Version Content:
      "${cleanContentForAI(oldContent)}"
      
      Summary of changes in the New Version:
    `;

    console.log('Sending request to Gemini 2.5 Flash...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    console.log('AI summary generated successfully');

    // 5. Save the summary
    await pool.execute(
      'UPDATE templates SET ai_change_summary = ? WHERE id = ?',
      [summary, id]
    );

    // 6. Add Audit Record
    try {
      const [templateInfo] = await pool.execute('SELECT organization_id, name FROM templates WHERE id = ?', [id]);
      if (templateInfo.length && logAuditEvent) {
        await logAuditEvent(pool, {
          orgId: templateInfo[0].organization_id,
          userId: req.user.userId,
          actionType: 'AI_SUMMARY_GENERATED',
          resourceType: 'template',
          resourceId: id,
          details: { templateId: id, templateName: templateInfo[0].name, version: currentTemplate.version },
          req
        });
      }
    } catch (auditErr) {
      console.error('Failed to add audit record for AI summary:', auditErr);
    }

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error generating AI summary:', error);

    // Check for networking errors
    if (error.message && error.message.includes('fetch failed')) {
      return res.status(502).json({
        error: 'Connection to AI service failed. Please try again later.'
      });
    }

    // Enhanced error handling for Gemini API
    if (error.status === 429) {
      return res.status(429).json({
        error: 'AI service rate limit reached. Please wait a few minutes and try again.'
      });
    }

    if (error.status === 404) {
      return res.status(404).json({
        error: 'AI service model unavailable. Please contact your administrator.'
      });
    }

    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

};
