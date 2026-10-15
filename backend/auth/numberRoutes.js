/**
 * Number Routes Module
 * Handles configuration and sequential generation for:
 * - Document Numbers (by department)
 * - Project Numbers
 * - Cost Center Numbers
 */

/**
 * Atomically claim and format the next document number for a department within a transaction.
 * Returns formatted string like "FIN-00000001" or null if no active rule exists.
 */
async function allocateNextDocumentNumber(connection, orgId, departmentNameOrId) {
  if (!orgId || !departmentNameOrId) return null;

  try {
    let deptId = null;

    // Resolve department ID if name is given
    if (typeof departmentNameOrId === 'number' || (!isNaN(departmentNameOrId) && !isNaN(parseFloat(departmentNameOrId)))) {
      deptId = parseInt(departmentNameOrId, 10);
    } else {
      const [deptRows] = await connection.execute(
        'SELECT id FROM departments WHERE organization_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
        [orgId, String(departmentNameOrId).trim()]
      );
      if (deptRows.length > 0) {
        deptId = deptRows[0].id;
      }
    }

    // Try department-specific rule first, then fallback to global rule (department_id IS NULL)
    let rule = null;
    if (deptId) {
      const [deptRules] = await connection.query(
        'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "document" AND department_id = ? AND status = "active" FOR UPDATE',
        [orgId, deptId]
      );
      if (deptRules.length > 0) {
        rule = deptRules[0];
      }
    }

    if (!rule) {
      const [globalRules] = await connection.query(
        'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "document" AND department_id IS NULL AND status = "active" FOR UPDATE',
        [orgId]
      );
      if (globalRules.length > 0) {
        rule = globalRules[0];
      }
    }

    if (!rule) {
      return null;
    }

    let nextNumber = (rule.current_number || 0) + 1;
    const cleanPrefix = (rule.prefix || '').replace(/-+$/, '').trim().toUpperCase();
    const digitCount = Math.max(5, Math.min(12, parseInt(rule.digit_count, 10) || 8));
    let padded = String(nextNumber).padStart(digitCount, '0');
    let formatted = `${cleanPrefix}-${padded}`;

    // Conflict prevention check: ensure the document_number is not already taken by any document in the organization
    let attempts = 0;
    while (attempts < 1000) {
      const [existingDoc] = await connection.execute(
        'SELECT document_id FROM documents WHERE organization_id = ? AND document_number = ? LIMIT 1',
        [orgId, formatted]
      );
      if (existingDoc && existingDoc.length > 0) {
        nextNumber++;
        padded = String(nextNumber).padStart(digitCount, '0');
        formatted = `${cleanPrefix}-${padded}`;
        attempts++;
      } else {
        break;
      }
    }

    await connection.execute(
      'UPDATE number_sequences SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextNumber, rule.id]
    );

    return formatted;
  } catch (err) {
    console.error('Error allocating next document number:', err);
    return null;
  }
}

/**
 * Atomically claim and format the next project number within a transaction.
 * Returns formatted string like "PRJ-000002"
 */
async function allocateNextProjectNumber(connection, orgId, docTitle) {
  if (!orgId) return null;

  try {
    const [rules] = await connection.query(
      'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "project" AND status = "active" FOR UPDATE',
      [orgId]
    );

    let rule = rules.length > 0 ? rules[0] : null;
    let nextNum = 1;
    let prefix = 'PRJ';
    let digitCount = 6;

    if (rule) {
      nextNum = (rule.current_number || 0) + 1;
      prefix = (rule.prefix || 'PRJ').replace(/-+$/, '').trim().toUpperCase();
      digitCount = Math.max(4, Math.min(12, parseInt(rule.digit_count, 10) || 6));
    }

    let padded = String(nextNum).padStart(digitCount, '0');
    let formatted = `${prefix}-${padded}`;

    // Conflict prevention check: ensure project_number is not already taken by any document in the organization
    let attempts = 0;
    while (attempts < 1000) {
      const [existingDoc] = await connection.execute(
        'SELECT document_id FROM documents WHERE organization_id = ? AND project_number = ? LIMIT 1',
        [orgId, formatted]
      );
      if (existingDoc && existingDoc.length > 0) {
        nextNum++;
        padded = String(nextNum).padStart(digitCount, '0');
        formatted = `${prefix}-${padded}`;
        attempts++;
      } else {
        break;
      }
    }

    if (rule) {
      await connection.execute(
        'UPDATE number_sequences SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextNum, rule.id]
      );
    } else {
      await connection.execute(
        'INSERT INTO number_sequences (organization_id, type, prefix, digit_count, current_number, status) VALUES (?, "project", ?, ?, ?, "active")',
        [orgId, prefix, digitCount, nextNum]
      );
    }

    // Also record in project_numbers table if not already present
    try {
      const [existingP] = await connection.execute(
        'SELECT id FROM project_numbers WHERE organization_id = ? AND project_number = ? LIMIT 1',
        [orgId, formatted]
      );
      if (!existingP || existingP.length === 0) {
        const projectName = docTitle ? `Project for ${docTitle}`.substring(0, 255) : `Project ${formatted}`;
        await connection.execute(
          'INSERT INTO project_numbers (organization_id, project_number, name, status) VALUES (?, ?, ?, "active")',
          [orgId, formatted, projectName]
        );
      }
    } catch (pe) {
      console.warn('Notice recording project number entry:', pe.message);
    }

    return formatted;
  } catch (err) {
    console.error('Error allocating next project number:', err);
    return null;
  }
}

/**
 * Atomically claim and format the next cost center number within a transaction.
 * Returns formatted string like "CC-000002"
 */
async function allocateNextCostCenterNumber(connection, orgId, deptName) {
  if (!orgId) return null;

  try {
    const [rules] = await connection.query(
      'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "cost_center" AND status = "active" FOR UPDATE',
      [orgId]
    );

    let rule = rules.length > 0 ? rules[0] : null;
    let nextNum = 1;
    let prefix = 'CC';
    let digitCount = 6;

    if (rule) {
      nextNum = (rule.current_number || 0) + 1;
      prefix = (rule.prefix || 'CC').replace(/-+$/, '').trim().toUpperCase();
      digitCount = Math.max(4, Math.min(12, parseInt(rule.digit_count, 10) || 6));
    }

    let padded = String(nextNum).padStart(digitCount, '0');
    let formatted = `${prefix}-${padded}`;

    // Conflict prevention check: ensure cost_center_number is not already taken by any document in the organization
    let attempts = 0;
    while (attempts < 1000) {
      const [existingDoc] = await connection.execute(
        'SELECT document_id FROM documents WHERE organization_id = ? AND cost_center_number = ? LIMIT 1',
        [orgId, formatted]
      );
      if (existingDoc && existingDoc.length > 0) {
        nextNum++;
        padded = String(nextNum).padStart(digitCount, '0');
        formatted = `${prefix}-${padded}`;
        attempts++;
      } else {
        break;
      }
    }

    if (rule) {
      await connection.execute(
        'UPDATE number_sequences SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextNum, rule.id]
      );
    } else {
      await connection.execute(
        'INSERT INTO number_sequences (organization_id, type, prefix, digit_count, current_number, status) VALUES (?, "cost_center", ?, ?, ?, "active")',
        [orgId, prefix, digitCount, nextNum]
      );
    }

    // Also record in cost_center_numbers table if not already present
    try {
      const [existingC] = await connection.execute(
        'SELECT id FROM cost_center_numbers WHERE organization_id = ? AND cost_number = ? LIMIT 1',
        [orgId, formatted]
      );
      if (!existingC || existingC.length === 0) {
        const ccName = deptName ? `Cost Center for ${deptName}`.substring(0, 255) : `Cost Center ${formatted}`;
        await connection.execute(
          'INSERT INTO cost_center_numbers (organization_id, cost_number, name, department, status) VALUES (?, ?, ?, ?, "active")',
          [orgId, formatted, ccName, deptName ? String(deptName).trim() : null]
        );
      }
    } catch (ce) {
      console.warn('Notice recording cost center number entry:', ce.message);
    }

    return formatted;
  } catch (err) {
    console.error('Error allocating next cost center number:', err);
    return null;
  }
}

function registerNumberRoutes({ app, pool, authenticateToken, logAuditEvent }) {
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

  // ==================== NUMBER SEQUENCES (RULES) ====================

  // GET /api/numbers/rules/:orgId
  app.get('/api/numbers/rules/:orgId', authenticateToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, false)) return;

      const [rows] = await pool.execute(`
        SELECT 
          ns.*, 
          d.name AS department_name
        FROM number_sequences ns
        LEFT JOIN departments d ON ns.department_id = d.id
        WHERE ns.organization_id = ?
        ORDER BY ns.type ASC, d.name ASC, ns.id ASC
      `, [orgId]);

      const formatted = rows.map(r => {
        const cleanPrefix = (r.prefix || '').replace(/-+$/, '').trim().toUpperCase();
        const digitCount = parseInt(r.digit_count, 10) || 8;
        const nextNum = (r.current_number || 0) + 1;
        const preview = `${cleanPrefix}-${String(nextNum).padStart(digitCount, '0')}`;
        return {
          ...r,
          prefix: cleanPrefix,
          digit_count: digitCount,
          preview
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('Error fetching numbering rules:', error);
      res.status(500).json({ error: 'Failed to fetch numbering rules' });
    }
  });

  // POST /api/numbers/rules/:orgId
  app.post('/api/numbers/rules/:orgId', authenticateToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, true)) return;

      let { type, department_id, prefix, digit_count, current_number, status } = req.body;

      if (!type || !['document', 'project', 'cost_center'].includes(type)) {
        return res.status(400).json({ error: 'Valid type (document, project, cost_center) is required' });
      }

      if (!prefix || typeof prefix !== 'string' || prefix.trim().length === 0) {
        return res.status(400).json({ error: 'A prefix is required (e.g., FIN, HR, PRJ, CC)' });
      }

      const cleanPrefix = prefix.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (cleanPrefix.length < 2 || cleanPrefix.length > 8) {
        return res.status(400).json({ error: 'Prefix must be between 2 and 8 alphanumeric characters' });
      }

      const cleanDigitCount = Math.max(5, Math.min(12, parseInt(digit_count, 10) || 8));
      const cleanCurrentNumber = Math.max(0, parseInt(current_number, 10) || 0);
      const cleanStatus = status === 'inactive' ? 'inactive' : 'active';
      const cleanDeptId = (type === 'document' && department_id) ? parseInt(department_id, 10) : null;

      // Check if a rule already exists for this org, type, and department
      const [existing] = await pool.execute(
        `SELECT id FROM number_sequences 
         WHERE organization_id = ? AND type = ? AND ${cleanDeptId ? 'department_id = ?' : 'department_id IS NULL'}`,
        cleanDeptId ? [orgId, type, cleanDeptId] : [orgId, type]
      );

      if (existing.length > 0) {
        // Update existing rule
        const existingId = existing[0].id;
        await pool.execute(
          `UPDATE number_sequences 
           SET prefix = ?, digit_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND organization_id = ?`,
          [cleanPrefix, cleanDigitCount, cleanStatus, existingId, orgId]
        );

        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId,
            actionType: 'NUMBER_RULE_UPDATED',
            resourceType: 'number_sequence',
            resourceId: String(existingId),
            details: { type, department_id: cleanDeptId, prefix: cleanPrefix, digit_count: cleanDigitCount },
            req
          });
        }

        return res.json({ success: true, id: existingId, message: 'Numbering rule updated successfully' });
      }

      // Insert new rule
      const [result] = await pool.execute(
        `INSERT INTO number_sequences 
         (organization_id, type, department_id, prefix, digit_count, current_number, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orgId, type, cleanDeptId, cleanPrefix, cleanDigitCount, cleanCurrentNumber, cleanStatus]
      );

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId,
          actionType: 'NUMBER_RULE_CREATED',
          resourceType: 'number_sequence',
          resourceId: String(result.insertId),
          details: { type, department_id: cleanDeptId, prefix: cleanPrefix, digit_count: cleanDigitCount },
          req
        });
      }

      res.status(201).json({ success: true, id: result.insertId, message: 'Numbering rule created successfully' });
    } catch (error) {
      console.error('Error creating numbering rule:', error);
      res.status(500).json({ error: 'Failed to create numbering rule' });
    }
  });

  // PUT /api/numbers/rules/:ruleId
  app.put('/api/numbers/rules/:ruleId', authenticateToken, async (req, res) => {
    try {
      const { ruleId } = req.params;
      const { prefix, digit_count, status, current_number } = req.body;
      const userOrgId = req.user?.organization_id || req.user?.orgId;

      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: admin privilege required' });
      }

      const [currentRows] = await pool.execute(
        'SELECT * FROM number_sequences WHERE id = ? AND organization_id = ?',
        [ruleId, userOrgId]
      );

      if (currentRows.length === 0) {
        return res.status(404).json({ error: 'Numbering rule not found' });
      }

      const rule = currentRows[0];
      const newPrefix = prefix ? prefix.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : rule.prefix;
      const newDigitCount = digit_count ? Math.max(5, Math.min(12, parseInt(digit_count, 10))) : rule.digit_count;
      const newStatus = status ? (status === 'inactive' ? 'inactive' : 'active') : rule.status;
      const newCurrentNumber = current_number !== undefined ? Math.max(0, parseInt(current_number, 10)) : rule.current_number;

      await pool.execute(
        `UPDATE number_sequences 
         SET prefix = ?, digit_count = ?, status = ?, current_number = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND organization_id = ?`,
        [newPrefix, newDigitCount, newStatus, newCurrentNumber, ruleId, userOrgId]
      );

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId: userOrgId,
          actionType: 'NUMBER_RULE_UPDATED',
          resourceType: 'number_sequence',
          resourceId: String(ruleId),
          details: { prefix: newPrefix, digit_count: newDigitCount, status: newStatus, current_number: newCurrentNumber },
          req
        });
      }

      res.json({ success: true, message: 'Numbering rule updated successfully' });
    } catch (error) {
      console.error('Error updating numbering rule:', error);
      res.status(500).json({ error: 'Failed to update numbering rule' });
    }
  });

  // GET /api/numbers/preview-document-number/:orgId
  app.get('/api/numbers/preview-document-number/:orgId', authenticateToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      const { department, departmentId } = req.query;
      if (!verifyOrgAndRole(req, res, orgId, false)) return;

      let deptId = null;
      if (departmentId) {
        deptId = parseInt(departmentId, 10);
      } else if (department) {
        const [deptRows] = await pool.execute(
          'SELECT id FROM departments WHERE organization_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [orgId, String(department).trim()]
        );
        if (deptRows.length > 0) {
          deptId = deptRows[0].id;
        }
      }

      let rule = null;
      if (deptId) {
        const [deptRules] = await pool.execute(
          'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "document" AND department_id = ? AND status = "active"',
          [orgId, deptId]
        );
        if (deptRules.length > 0) {
          rule = deptRules[0];
        }
      }

      if (!rule) {
        const [globalRules] = await pool.execute(
          'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "document" AND department_id IS NULL AND status = "active"',
          [orgId]
        );
        if (globalRules.length > 0) {
          rule = globalRules[0];
        }
      }

      // Calculate projectPreview
      let projectPreview = null;
      try {
        const [pRules] = await pool.execute(
          'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "project" AND status = "active" LIMIT 1',
          [orgId]
        );
        let pRule = pRules.length > 0 ? pRules[0] : null;
        let pNext = (pRule?.current_number || 0) + 1;
        const pPrefix = (pRule?.prefix || 'PRJ').replace(/-+$/, '').trim().toUpperCase();
        const pDigits = Math.max(4, Math.min(12, parseInt(pRule?.digit_count, 10) || 6));
        let pPadded = String(pNext).padStart(pDigits, '0');
        projectPreview = `${pPrefix}-${pPadded}`;
        let pAttempts = 0;
        while (pAttempts < 500) {
          const [pExisting] = await pool.execute(
            'SELECT document_id FROM documents WHERE organization_id = ? AND project_number = ? LIMIT 1',
            [orgId, projectPreview]
          );
          if (pExisting && pExisting.length > 0) {
            pNext++;
            pPadded = String(pNext).padStart(pDigits, '0');
            projectPreview = `${pPrefix}-${pPadded}`;
            pAttempts++;
          } else {
            break;
          }
        }
      } catch (pe) {
        console.warn('Notice previewing project number:', pe);
      }

      // Calculate costCenterPreview
      let costCenterPreview = null;
      try {
        const [cRules] = await pool.execute(
          'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "cost_center" AND status = "active" LIMIT 1',
          [orgId]
        );
        let cRule = cRules.length > 0 ? cRules[0] : null;
        let cNext = (cRule?.current_number || 0) + 1;
        const cPrefix = (cRule?.prefix || 'CC').replace(/-+$/, '').trim().toUpperCase();
        const cDigits = Math.max(4, Math.min(12, parseInt(cRule?.digit_count, 10) || 6));
        let cPadded = String(cNext).padStart(cDigits, '0');
        costCenterPreview = `${cPrefix}-${cPadded}`;
        let cAttempts = 0;
        while (cAttempts < 500) {
          const [cExisting] = await pool.execute(
            'SELECT document_id FROM documents WHERE organization_id = ? AND cost_center_number = ? LIMIT 1',
            [orgId, costCenterPreview]
          );
          if (cExisting && cExisting.length > 0) {
            cNext++;
            cPadded = String(cNext).padStart(cDigits, '0');
            costCenterPreview = `${cPrefix}-${cPadded}`;
            cAttempts++;
          } else {
            break;
          }
        }
      } catch (ce) {
        console.warn('Notice previewing cost center number:', ce);
      }

      if (!rule) {
        return res.json({
          success: true,
          hasRule: false,
          preview: null,
          projectPreview,
          costCenterPreview,
          message: 'No active numbering rule found for this department'
        });
      }

      let nextNum = (rule.current_number || 0) + 1;
      const cleanPrefix = (rule.prefix || '').replace(/-+$/, '').trim().toUpperCase();
      const digitCount = parseInt(rule.digit_count, 10) || 8;
      let padded = String(nextNum).padStart(digitCount, '0');
      let preview = `${cleanPrefix}-${padded}`;

      // Conflict prevention check for preview
      let previewAttempts = 0;
      while (previewAttempts < 500) {
        const [existingDoc] = await pool.execute(
          'SELECT document_id FROM documents WHERE organization_id = ? AND document_number = ? LIMIT 1',
          [orgId, preview]
        );
        if (existingDoc && existingDoc.length > 0) {
          nextNum++;
          padded = String(nextNum).padStart(digitCount, '0');
          preview = `${cleanPrefix}-${padded}`;
          previewAttempts++;
        } else {
          break;
        }
      }

      res.json({
        success: true,
        hasRule: true,
        preview,
        projectPreview,
        costCenterPreview,
        rule: {
          id: rule.id,
          prefix: cleanPrefix,
          digit_count: digitCount,
          next_number: nextNum
        }
      });
    } catch (error) {
      console.error('Error previewing document number:', error);
      res.status(500).json({ error: 'Failed to generate document number preview' });
    }
  });

  // ==================== PROJECT NUMBERS ====================

  // GET /api/numbers/projects/:orgId
  app.get('/api/numbers/projects/:orgId', authenticateToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, false)) return;

      const [rows] = await pool.execute(
        'SELECT * FROM project_numbers WHERE organization_id = ? ORDER BY created_at DESC, id DESC',
        [orgId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching project numbers:', error);
      res.status(500).json({ error: 'Failed to fetch project numbers' });
    }
  });

  // POST /api/numbers/projects/:orgId
  app.post('/api/numbers/projects/:orgId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, true)) {
        connection.release();
        return;
      }

      const { name, department } = req.body;
      if (!name || !name.trim()) {
        connection.release();
        return res.status(400).json({ error: 'Project name is required' });
      }

      await connection.beginTransaction();

      // Find or default the project number sequence rule
      const [rules] = await connection.query(
        'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "project" FOR UPDATE',
        [orgId]
      );

      let rule = rules.length > 0 ? rules[0] : null;
      let nextNum = 1;
      let prefix = 'PRJ';
      let digitCount = 6;

      if (rule) {
        nextNum = (rule.current_number || 0) + 1;
        prefix = (rule.prefix || 'PRJ').replace(/-+$/, '').trim().toUpperCase();
        digitCount = parseInt(rule.digit_count, 10) || 6;
        await connection.execute(
          'UPDATE number_sequences SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [nextNum, rule.id]
        );
      } else {
        const [insertedRule] = await connection.execute(
          'INSERT INTO number_sequences (organization_id, type, prefix, digit_count, current_number, status) VALUES (?, "project", ?, ?, ?, "active")',
          [orgId, prefix, digitCount, nextNum]
        );
      }

      const projectNumber = `${prefix}-${String(nextNum).padStart(digitCount, '0')}`;

      const [result] = await connection.execute(
        'INSERT INTO project_numbers (organization_id, project_number, name, department, status) VALUES (?, ?, ?, ?, "active")',
        [orgId, projectNumber, name.trim(), department ? department.trim() : null]
      );

      await connection.commit();

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId,
          actionType: 'PROJECT_NUMBER_CREATED',
          resourceType: 'project_number',
          resourceId: String(result.insertId),
          details: { project_number: projectNumber, name },
          req
        });
      }

      res.status(201).json({
        success: true,
        project: {
          id: result.insertId,
          project_number: projectNumber,
          name: name.trim(),
          description,
          status: 'active'
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating project number:', error);
      res.status(500).json({ error: 'Failed to create project number' });
    } finally {
      connection.release();
    }
  });

  // PUT /api/numbers/projects/:id/status
  app.put('/api/numbers/projects/:id/status', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userOrgId = req.user?.organization_id || req.user?.orgId;

      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: admin privilege required' });
      }

      const newStatus = status === 'inactive' ? 'inactive' : 'active';
      await pool.execute(
        'UPDATE project_numbers SET status = ? WHERE id = ? AND organization_id = ?',
        [newStatus, id, userOrgId]
      );

      res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error('Error toggling project number status:', error);
      res.status(500).json({ error: 'Failed to toggle project number status' });
    }
  });

  // ==================== COST CENTER NUMBERS ====================

  // GET /api/numbers/cost-centers/:orgId
  app.get('/api/numbers/cost-centers/:orgId', authenticateToken, async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, false)) return;

      const [rows] = await pool.execute(
        'SELECT * FROM cost_center_numbers WHERE organization_id = ? ORDER BY created_at DESC, id DESC',
        [orgId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching cost center numbers:', error);
      res.status(500).json({ error: 'Failed to fetch cost center numbers' });
    }
  });

  // POST /api/numbers/cost-centers/:orgId
  app.post('/api/numbers/cost-centers/:orgId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { orgId } = req.params;
      if (!verifyOrgAndRole(req, res, orgId, true)) {
        connection.release();
        return;
      }

      const { name, department } = req.body;
      if (!name || !name.trim()) {
        connection.release();
        return res.status(400).json({ error: 'Cost center name is required' });
      }

      await connection.beginTransaction();

      // Find or default cost center number sequence rule
      const [rules] = await connection.query(
        'SELECT * FROM number_sequences WHERE organization_id = ? AND type = "cost_center" FOR UPDATE',
        [orgId]
      );

      let rule = rules.length > 0 ? rules[0] : null;
      let nextNum = 1;
      let prefix = 'CC';
      let digitCount = 6;

      if (rule) {
        nextNum = (rule.current_number || 0) + 1;
        prefix = (rule.prefix || 'CC').replace(/-+$/, '').trim().toUpperCase();
        digitCount = parseInt(rule.digit_count, 10) || 6;
        await connection.execute(
          'UPDATE number_sequences SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [nextNum, rule.id]
        );
      } else {
        await connection.execute(
          'INSERT INTO number_sequences (organization_id, type, prefix, digit_count, current_number, status) VALUES (?, "cost_center", ?, ?, ?, "active")',
          [orgId, prefix, digitCount, nextNum]
        );
      }

      const costNumber = `${prefix}-${String(nextNum).padStart(digitCount, '0')}`;

      const [result] = await connection.execute(
        'INSERT INTO cost_center_numbers (organization_id, cost_number, name, department, status) VALUES (?, ?, ?, ?, "active")',
        [orgId, costNumber, name.trim(), department ? department.trim() : null]
      );

      await connection.commit();

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId,
          actionType: 'COST_CENTER_CREATED',
          resourceType: 'cost_center_number',
          resourceId: String(result.insertId),
          details: { cost_number: costNumber, name, department },
          req
        });
      }

      res.status(201).json({
        success: true,
        cost_center: {
          id: result.insertId,
          cost_number: costNumber,
          name: name.trim(),
          department,
          status: 'active'
        }
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error creating cost center number:', error);
      res.status(500).json({ error: 'Failed to create cost center number' });
    } finally {
      connection.release();
    }
  });

  // PUT /api/numbers/cost-centers/:id/status
  app.put('/api/numbers/cost-centers/:id/status', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userOrgId = req.user?.organization_id || req.user?.orgId;

      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: admin privilege required' });
      }

      const newStatus = status === 'inactive' ? 'inactive' : 'active';
      await pool.execute(
        'UPDATE cost_center_numbers SET status = ? WHERE id = ? AND organization_id = ?',
        [newStatus, id, userOrgId]
      );

      res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error('Error toggling cost center number status:', error);
      res.status(500).json({ error: 'Failed to toggle cost center number status' });
    }
  });
}

module.exports = {
  registerNumberRoutes,
  allocateNextDocumentNumber,
  allocateNextProjectNumber,
  allocateNextCostCenterNumber
};
