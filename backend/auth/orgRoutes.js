module.exports = function registerOrgRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  transporter,
  generateInvitationToken,
  calculateFolderPath,
  buildFolderPath,
  checkCircularReference,
  getCategoryAncestors,
  updateChildrenPaths,
  bcrypt,
  jwt,
  uuidv4,
  fs,
  path,
  ENCRYPTION_KEY,
  inviteLimiter,
  logAuditEvent
}) {
// ==================== DEPARTMENTS ROUTES ====================

const verifyOrgAndRole = (req, res, targetOrgId, requireAdmin = false) => {
  const userOrgId = req.user?.organization_id || req.user?.orgId;
  if (!userOrgId || (targetOrgId && String(userOrgId) !== String(targetOrgId))) {
    res.status(403).json({ error: 'Access denied: organization mismatch' });
    return false;
  }
  if (requireAdmin && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: admin privilege required' });
    return false;
  }
  return true;
};

// Route Get Departments
app.get('/api/departments/:orgId', authenticateToken, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, false)) return;

    const [rows] = await pool.query(
      'SELECT * FROM departments WHERE organization_id = ? ORDER BY name',
      [orgId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Add new department
app.post('/api/add_department/:orgId', authenticateToken, async (req, res) => {
  try {
    const { name, manager } = req.body;
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, true)) return;
    const status = 'active';

    // Check if department already exists
    const [existing] = await pool.query(
      'SELECT id FROM departments WHERE organization_id = ? AND name = ?',
      [orgId, name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    // Insert new department
    await pool.query(
      'INSERT INTO departments (organization_id, name, manager, status) VALUES (?, ?, ?, ?)',
      [orgId, name, manager, status]
    );

    // Also update manager's department in users table
    if (manager) {
      await pool.query(
        'UPDATE users SET department = ? WHERE id = ? AND organization_id = ?',
        [name, manager, orgId]
      );
    }

    // Return success without the created object (since we'll refetch)
    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId,
        actionType: 'DEPARTMENT_CREATED',
        resourceType: 'department',
        details: { name, manager },
        req
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding department:', error);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

// Edit department
app.put('/api/edit_department/:deptId', authenticateToken, async (req, res) => {
  try {
    const { name, manager, status, orgId } = req.body;
    const { deptId } = req.params;
    const effectiveOrgId = orgId || req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, effectiveOrgId, true)) return;

    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Name are required' });
    }

    // Update existing department
    await pool.query(
      'UPDATE departments SET name = ?, manager = ?, status = ? WHERE id = ? AND organization_id = ?',
      [name, manager, status, deptId, effectiveOrgId]
    );

    // Also update manager's department in users table
    if (manager) {
      await pool.query(
        'UPDATE users SET department = ? WHERE id = ? AND organization_id = ?',
        [name, manager, effectiveOrgId]
      );
    }

    // Return success
    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: effectiveOrgId,
        actionType: 'DEPARTMENT_UPDATED',
        resourceType: 'department',
        resourceId: String(deptId),
        details: { name, manager, status },
        req
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Route Get Sites
app.get('/api/sites/:orgId', authenticateToken, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, false)) return;

    const [rows] = await pool.query(
      'SELECT * FROM sites WHERE organization_id = ? ORDER BY name',
      [orgId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Add new site
app.post('/api/add_site/:orgId', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, true)) return;
    const status = 'active';

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if site already exists
    const [existing] = await pool.query(
      'SELECT id FROM sites WHERE organization_id = ? AND name = ?',
      [orgId, name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Site already exists' });
    }

    // Insert new site
    await pool.query(
      'INSERT INTO sites (organization_id, name, status) VALUES (?, ?, ?)',
      [orgId, name, status]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId,
        actionType: 'SITE_CREATED',
        resourceType: 'site',
        details: { name },
        req
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding site:', error);
    res.status(500).json({ error: 'Failed to add site' });
  }
});

// Edit site
app.put('/api/edit_site/:siteId', authenticateToken, async (req, res) => {
  try {
    const { name, status, orgId } = req.body;
    const { siteId } = req.params;
    const effectiveOrgId = orgId || req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, effectiveOrgId, true)) return;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Update existing site
    await pool.query(
      'UPDATE sites SET name = ?, status = ? WHERE id = ? AND organization_id = ?',
      [name, status, siteId, effectiveOrgId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: effectiveOrgId,
        actionType: 'SITE_UPDATED',
        resourceType: 'site',
        resourceId: String(siteId),
        details: { name, status },
        req
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Bulk invite multiple organization members
app.post('/api/invite_multiple_org_members/:orgId', authenticateToken, inviteLimiter, async (req, res) => {
  try {
    const { emails, role, department, message, site } = req.body;
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, true)) return;
    const status = 'invited';

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'At least one email is required' });
    }

    // Get organization name
    const [orgs] = await pool.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [orgId]
    );

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const orgName = orgs[0].name;

    const invitedEmails = [];
    const failedEmails = [];

    for (const email of emails) {
      try {
        // Check if user already exists
        const [existingUsers] = await pool.execute(
          'SELECT id FROM invited_users WHERE email = ?',
          [email]
        );

        if (existingUsers.length > 0) {
          failedEmails.push({ email, error: 'User already exists' });
          continue;
        }

        const userId = await dbOps.inviteUser(orgId, email, role, department, message, status, site);

        // Generate invitation token with encrypted data
        const invitationToken = generateInvitationToken({
          email,
          role,
          department,
          site,
          orgId
        });

        // Create invitation link
        const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

        // Send email invitation
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@example.com',
          to: email,
          subject: `Invitation to join ${orgName}`,
          html: `
            <h1>You've been invited to join ${orgName}</h1>
            <p>${message || 'Please join our organization by clicking the link below:'}</p>
            <p><a href="${invitationLink}">Click here to accept the invitation</a></p>
            <p>This invitation link will expire in 7 days.</p>
          `
        });

        invitedEmails.push(email);
      } catch (err) {
        console.error(`Error inviting ${email}:`, err);
        failedEmails.push({ email, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      invited: invitedEmails,
      failed: failedEmails,
      message: `${invitedEmails.length} team members invited successfully. ${failedEmails.length} failed.`
    });
  } catch (error) {
    console.error('Error in bulk inviting:', error);
    res.status(500).json({ error: 'Failed to process bulk invitations' });
  }
});

// ==================== TEMPLATE CATEGORIES ROUTES ====================

// Get all template categories for an organization
app.get('/api/template_categories/:orgId', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.params.orgId;
    if (!verifyOrgAndRole(req, res, organizationId, false)) return;

    const query = `
      SELECT category_id, organization_id, category_name, category_prefix, folder_path, parent_category_id
      FROM template_categories
      WHERE organization_id = ?
      ORDER BY category_name
    `;

    const [categories] = await pool.execute(query, [organizationId]);

    // Calculate folder paths based on parent-child relationships
    categories.forEach(category => {
      if (!category.folder_path) {
        category.folder_path = buildFolderPath(category, categories);
      }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ error: 'Failed to fetch template categories' });
  }
});

// Create a new template category
app.post('/api/add_category/:orgId', authenticateToken, async (req, res) => {
  try {
    const { category_name, category_prefix, parent_category_id } = req.body;
    const organization_id = parseInt(req.params.orgId);
    if (!verifyOrgAndRole(req, res, organization_id, true)) return;

    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert new category
      const insertQuery = `
        INSERT INTO template_categories 
        (organization_id, category_name, category_prefix, parent_category_id, folder_path)
        VALUES (?, ?, ?, ?, '')
      `;

      const [result] = await connection.execute(insertQuery, [
        organization_id,
        category_name,
        category_prefix,
        parent_category_id || null
      ]);

      const category_id = result.insertId;

      // Calculate and update folder path
      const folder_path = await calculateFolderPath(category_id, parent_category_id, connection);

      const updatePathQuery = `
        UPDATE template_categories
        SET folder_path = ?
        WHERE category_id = ?
      `;

      await connection.execute(updatePathQuery, [folder_path, category_id]);

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        category_id,
        organization_id,
        category_name,
        category_prefix,
        parent_category_id: parent_category_id || null,
        folder_path
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating template category:', error);
    res.status(500).json({ error: 'Failed to create template category' });
  }
});

// Update a template category
app.put('/api/update_category/:orgId', authenticateToken, async (req, res) => {
  try {
    const { categoryId, category_name, category_prefix, parent_category_id } = req.body;
    const organization_id = req.params.orgId;
    if (!verifyOrgAndRole(req, res, organization_id, true)) return;

    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category exists and belongs to the organization
    const checkQuery = `
      SELECT category_id FROM template_categories 
      WHERE category_id = ? AND organization_id = ?
    `;

    const [existingCategories] = await pool.execute(checkQuery, [categoryId, organization_id]);

    if (existingCategories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Prevent circular reference - a category cannot be its own parent
    if (parent_category_id && parent_category_id.toString() === categoryId.toString()) {
      return res.status(400).json({ error: 'A category cannot be its own parent' });
    }

    // Check for circular references in the hierarchy
    if (parent_category_id) {
      const isCircular = await checkCircularReference(categoryId, parent_category_id);
      if (isCircular) {
        return res.status(400).json({ error: 'Circular reference detected in category hierarchy' });
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update the category
      const updateQuery = `
        UPDATE template_categories
        SET category_name = ?, category_prefix = ?, parent_category_id = ?
        WHERE category_id = ? AND organization_id = ?
      `;

      await connection.execute(updateQuery, [
        category_name,
        category_prefix,
        parent_category_id || null,
        categoryId,
        organization_id
      ]);

      // Calculate and update folder path
      const folder_path = await calculateFolderPath(categoryId, parent_category_id, connection);

      const updatePathQuery = `
        UPDATE template_categories
        SET folder_path = ?
        WHERE category_id = ?
      `;

      await connection.execute(updatePathQuery, [folder_path, categoryId]);

      // Update paths of all child categories
      await updateChildrenPaths(categoryId, connection);

      // Commit transaction
      await connection.commit();
      connection.release();

      res.json({
        category_id: parseInt(categoryId),
        organization_id,
        category_name,
        category_prefix,
        parent_category_id: parent_category_id || null,
        folder_path
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating template category:', error);
    res.status(500).json({ error: 'Failed to update template category' });
  }
});

// Delete a template category
app.delete('/api/delete_category', authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.body;
    const organization_id = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, organization_id, true)) return;

    // Check if category exists and belongs to the organization
    const checkQuery = `
      SELECT category_id FROM template_categories 
      WHERE category_id = ? AND organization_id = ?
    `;

    const [existingCategories] = await pool.execute(checkQuery, [categoryId, organization_id]);

    if (existingCategories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has templates
    const templateCheckQuery = `
      SELECT id FROM templates 
      WHERE category_id = ? AND organization_id = ?
      LIMIT 1
    `;

    const [existingTemplates] = await pool.execute(templateCheckQuery, [categoryId, organization_id]);

    if (existingTemplates.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category that contains templates. Move or delete the templates first.'
      });
    }

    // Check if category has subcategories
    const subcategoryCheckQuery = `
      SELECT category_id FROM template_categories 
      WHERE parent_category_id = ?
      LIMIT 1
    `;

    const [existingSubcategories] = await pool.execute(subcategoryCheckQuery, [categoryId]);

    if (existingSubcategories.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category that has subcategories. Delete or move subcategories first.'
      });
    }

    // Delete the category
    const deleteQuery = `
      DELETE FROM template_categories
      WHERE category_id = ? AND organization_id = ?
    `;

    await pool.execute(deleteQuery, [categoryId, organization_id]);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting template category:', error);
    res.status(500).json({ error: 'Failed to delete template category' });
  }
});

// Invite new team member
app.post('/api/invite_org_member/:orgId', authenticateToken, inviteLimiter, async (req, res) => {
  try {
    const { email, role, department, message, site } = req.body;
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, true)) return;
    const status = 'invited';

    const userId = await dbOps.inviteUser(orgId, email, role, department, message, status, site);

    // Get organization name
    const [orgs] = await pool.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [orgId]
    );

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgName = orgs[0].name;

    // Generate invitation token with encrypted data
    const invitationToken = generateInvitationToken({
      email,
      role,
      department,
      site,
      orgId
    });

    // Create invitation link
    const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

    // Send email invitation
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@example.com',
      to: email,
      subject: `Invitation to join ${orgName}`,
      html: `
        <h1>You've been invited to join ${orgName}</h1>
        <p>${message || 'Please join our organization by clicking the link below:'}</p>
        <p><a href="${invitationLink}">Click here to accept the invitation</a></p>
        <p>This invitation link will expire in 7 days.</p>
      `
    });

    res.status(201).json({
      id: userId,
      link: invitationLink,
      message: 'Team member invited successfully'
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove Invited User
app.delete('/api/cancel_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    const [result] = await pool.execute(
      'DELETE FROM invited_users WHERE status = ? AND id = ? AND organization_id = ?',
      ['invited', userId, userOrgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invited user not found in your organization' });
    }

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: userOrgId,
        userId: req.user.userId || req.user.id,
        actionType: 'INVITATION_CANCELLED',
        resourceType: 'user',
        resourceId: String(userId),
        details: { targetInvitationId: userId },
        req
      });
    }

    res.json({ message: 'Invited user removed successfully' });
  } catch (error) {
    console.error('Error removing invited user:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Resend Invitation
app.post('/api/resend_invite/:userId', authenticateToken, inviteLimiter || ((req, res, next) => next()), async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    // Get the invited user record
    const [rows] = await pool.execute(
      'SELECT * FROM invited_users WHERE id = ? AND organization_id = ? AND status = ?',
      [userId, userOrgId, 'invited']
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invited user not found in your organization' });
    }

    const invitation = rows[0];

    // Get organization name
    const [orgs] = await pool.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [userOrgId]
    );
    const orgName = orgs.length > 0 ? orgs[0].name : 'Organization';

    // Generate fresh invitation token
    const invitationToken = generateInvitationToken({
      email: invitation.email,
      role: invitation.role,
      department: invitation.department,
      site: invitation.site,
      orgId: userOrgId
    });

    const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

    // Send email invitation safely
    try {
      if (transporter && typeof transporter.sendMail === 'function') {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@example.com',
          to: invitation.email,
          subject: `Invitation to join ${orgName}`,
          html: `
            <h1>You've been invited to join ${orgName}</h1>
            <p>${invitation.message || 'Please join our organization by clicking the link below:'}</p>
            <p><a href="${invitationLink}">Click here to accept the invitation</a></p>
            <p>This invitation link will expire in 7 days.</p>
          `
        });
      }
    } catch (mailError) {
      console.warn('Mail delivery notice during resend:', mailError.message);
    }

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: userOrgId,
        userId: req.user.userId || req.user.id,
        actionType: 'INVITATION_RESENT',
        resourceType: 'user',
        resourceId: String(userId),
        details: { email: invitation.email, role: invitation.role },
        req
      });
    }

    res.json({
      success: true,
      link: invitationLink,
      message: 'Invitation resent successfully'
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// Approve Invited User
app.post('/api/approve_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    // Get the pending invitation
    const [rows] = await pool.execute(
      'SELECT * FROM invited_users WHERE status = ? AND id = ? AND organization_id = ?',
      ['pending', userId, userOrgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invited user not found or already approved' });
    }

    const userData = rows[0];

    const template_approver = 'no';
    const newUserId = await dbOps.registerUser(
      userData.organization_id,
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.department,
      template_approver,
      'active',
      userData.site
    );

    // Delete the invitation after successful registration
    await pool.execute(
      'DELETE FROM invited_users WHERE id = ?',
      [userId]
    );

    // Record audit record
    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: userOrgId,
        userId: req.user.userId || req.user.id,
        actionType: 'USER_APPROVED',
        resourceType: 'user',
        resourceId: String(newUserId),
        details: {
          approvedEmail: userData.email,
          newUserId,
          assignedRole: userData.role,
          department: userData.department
        },
        req
      });
    }

    res.json({
      message: 'Invited user approved successfully',
      userId: newUserId
    });
  } catch (error) {
    console.error('Error approving invited user:', error);
    res.status(500).json({ error: 'Failed to approve team member' });
  }
});

// Reject Invited User
app.delete('/api/reject_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    await pool.execute(
      'DELETE FROM invited_users WHERE status = ? AND id = ? AND organization_id = ?',
      ['pending', userId, userOrgId]
    );

    res.json({ message: 'Invited user removed successfully' });
  } catch (error) {
    console.error('Error removing invited user:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Add new team member (admin only)
app.post('/api/add_org_member/:orgId', authenticateToken, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, template_approver, site } = req.body;
    const { orgId } = req.params;
    if (!verifyOrgAndRole(req, res, orgId, true)) return;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const userId = await dbOps.registerUser(orgId, email, password, firstName, lastName, role || 'viewer', department || null, template_approver || 'no', 'active', site || null);

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId,
        userId: req.user.userId || req.user.id,
        actionType: 'USER_ADDED',
        resourceType: 'user',
        resourceId: String(userId),
        details: { email, role: role || 'viewer', department, site },
        req
      });
    }

    res.status(201).json({
      id: userId,
      message: 'Team member added successfully'
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Edit team member (admin only)
app.put('/api/edit_org_member/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    const { firstName, lastName, email, role, department, template_approver, status, site } = req.body;

    if (!firstName || !lastName || !email || !status) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Verify target user belongs to same organization
    const [targetUsers] = await pool.execute(
      'SELECT id, role, status, organization_id FROM users WHERE id = ? AND organization_id = ?',
      [userId, userOrgId]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    const currentTarget = targetUsers[0];
    const roleOrStatusChanged = currentTarget.role !== role || currentTarget.status !== status;

    // Update user profile
    await dbOps.updateUserProfile(userId, {
      firstName,
      lastName,
      email,
      department,
      template_approver,
      status,
      site
    });

    await dbOps.changeUserRole(userId, role);

    // If role or status changed, increment token_version to invalidate stale access tokens
    if (roleOrStatusChanged) {
      await pool.execute(
        'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
        [userId]
      );
      if (status === 'inactive' || status === 'deactivated') {
        await pool.execute(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [userId]
        );
      }
    }

    if (logAuditEvent) {
      const actionType = currentTarget.role !== role ? 'USER_ROLE_CHANGED' : (currentTarget.status !== status ? 'USER_STATUS_CHANGED' : 'USER_UPDATED');
      await logAuditEvent(pool, {
        orgId: userOrgId,
        userId: req.user.userId || req.user.id,
        actionType,
        resourceType: 'user',
        resourceId: String(userId),
        details: {
          targetUserId: userId,
          targetEmail: email,
          oldRole: currentTarget.role,
          newRole: role,
          oldStatus: currentTarget.status,
          newStatus: status,
          department,
          site
        },
        req
      });
    }

    res.json({ message: 'Team member updated successfully' });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Remove team member (admin only)
app.delete('/api/del_org_member/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    if (!verifyOrgAndRole(req, res, userOrgId, true)) return;

    const currentUserId = req.user?.userId || req.user?.id;
    // Don't allow self-deletion
    if (String(userId) === String(currentUserId)) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    // Soft delete - Update status to 'inactive' and increment token_version
    await pool.execute(
      'UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ? AND organization_id = ?',
      ['inactive', userId, userOrgId]
    );

    // Revoke all refresh tokens
    await pool.execute(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: userOrgId,
        userId: currentUserId,
        actionType: 'USER_DEACTIVATED',
        resourceType: 'user',
        resourceId: String(userId),
        details: { targetUserId: userId, oldStatus: 'active', newStatus: 'inactive' },
        req
      });
    }

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Change team member password (admin only)
app.put('/team/:userId/password', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;
    const callerOrgId = req.user?.organization_id || req.user?.orgId;

    if (!verifyOrgAndRole(req, res, callerOrgId, true)) return;

    if (!password || String(password).length < 12) {
      return res.status(400).json({ error: 'Valid password required (min 12 characters)' });
    }

    // Check if target user exists and belongs to same organization
    const [users] = await pool.execute(
      'SELECT id, organization_id FROM users WHERE id = ? AND organization_id = ?',
      [userId, callerOrgId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found or not in your organization' });
    }

    // Update password and increment token_version to revoke old access tokens
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );

    // Revoke all refresh tokens for target user
    await pool.execute(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );

    // Add audit record
    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: callerOrgId,
        userId: req.user.userId || req.user.id,
        actionType: 'PASSWORD_RESET',
        resourceType: 'user',
        resourceId: String(userId),
        details: { targetUserId: userId },
        req
      });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Create a new document
};
