const { assertUserDocumentAccess, assertUserTemplateAccess, assertUserAttachmentAccess } = require('../documents/documentHelpers');

module.exports = function registerTaskRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  upload,
  uploadsDir,
  uuidv4,
  fs,
  path,
  uploadLimiter,
  logAuditEvent
}) {
app.get('/api/tasks/my-tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const searchTerm = req.query?.search ? String(req.query.search).trim() : '';
    const search = searchTerm.length > 0 ? `%${searchTerm.toLowerCase()}%` : null;

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.created_by,
             t.document_id, t.progress, DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
             d.title AS document_title,
             ta.assigned_to, ta.status AS assignment_status,
             sender.first_name AS created_by_first_name, sender.last_name AS created_by_last_name,
             assignee.first_name AS assigned_to_first_name, assignee.last_name AS assigned_to_last_name
      FROM tasks t
      LEFT JOIN taskassignments ta ON ta.task_id = t.id
      LEFT JOIN users sender ON sender.id = t.created_by
      LEFT JOIN users assignee ON assignee.id = ta.assigned_to
      LEFT JOIN documents d ON d.document_id = t.document_id
      WHERE ta.assigned_to = ? OR t.created_by = ?
    `;
    const params = [userId, userId];

    if (search) {
      query += ` AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(CONCAT(sender.first_name, ' ', sender.last_name)) LIKE ?)`;
      params.push(search, search, search);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [tasks] = await pool.execute(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching my-tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

app.get('/api/tasks/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const searchTerm = req.query?.search ? String(req.query.search).trim() : '';
    const search = searchTerm.length > 0 ? `%${searchTerm.toLowerCase()}%` : null;

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.created_by,
             t.document_id, t.progress, DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
             d.title AS document_title,
             ta.assigned_to, ta.status AS assignment_status,
             sender.first_name AS created_by_first_name, sender.last_name AS created_by_last_name,
             assignee.first_name AS assigned_to_first_name, assignee.last_name AS assigned_to_last_name
      FROM tasks t
      LEFT JOIN taskassignments ta ON ta.task_id = t.id
      LEFT JOIN users sender ON sender.id = t.created_by
      LEFT JOIN users assignee ON assignee.id = ta.assigned_to
      LEFT JOIN documents d ON d.document_id = t.document_id
      WHERE t.created_by = ?
    `;
    const params = [userId];

    if (search) {
      query += ` AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(CONCAT(sender.first_name, ' ', sender.last_name)) LIKE ? OR LOWER(CONCAT(assignee.first_name, ' ', assignee.last_name)) LIKE ?)`;
      params.push(search, search, search, search);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [tasks] = await pool.execute(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching sent tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sent tasks' });
  }
});

async function assertUserTaskAccess(taskId, userId, userOrgId, userRole) {
  if (!taskId || !userId) return false;
  const [tasks] = await pool.execute(
    'SELECT id, organization_id, created_by FROM tasks WHERE id = ?',
    [taskId]
  );
  if (tasks.length === 0) return false;
  const task = tasks[0];
  if (userOrgId && String(task.organization_id) !== String(userOrgId)) {
    return false;
  }
  if (userRole === 'admin') return true;
  if (String(task.created_by) === String(userId)) return true;

  const [assignments] = await pool.execute(
    'SELECT 1 FROM taskassignments WHERE task_id = ? AND assigned_to = ?',
    [taskId, userId]
  );
  if (assignments.length > 0) return true;

  return false;
}

const TASK_STATUSES = ['not_started', 'in_progress', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'milestone'];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Returns undefined (not provided), null (cleared), 'YYYY-MM-DD', or false (invalid).
function parseSqlDate(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const text = String(value).trim().slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  const year = parsed.getUTCFullYear();
  if (Number.isNaN(parsed.getTime()) || year < 1970 || year > 2100) return false;
  return text;
}

function normalizeDependencyIds(value) {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : (value === null || value === '' ? [] : [value]);
  return [...new Set(raw.map((entry) => Number.parseInt(entry, 10)))];
}

async function wouldCreateDependencyCycle(taskId, newDependencyIds) {
  const visited = new Set();
  let frontier = [...newDependencyIds];
  while (frontier.length > 0) {
    if (frontier.includes(taskId)) return true;
    frontier.forEach((id) => visited.add(id));
    const [rows] = await pool.query(
      'SELECT depends_on_task_id AS id FROM task_dependencies WHERE task_id IN (?)',
      [frontier]
    );
    frontier = rows.map((row) => row.id).filter((id) => !visited.has(id));
  }
  return false;
}

// Walks up the proposed parent's own ancestor chain to make sure `taskId` isn't up there —
// otherwise re-parenting would create a loop in the summary-task tree.
async function wouldCreateParentCycle(taskId, proposedParentId, organizationId) {
  const visited = new Set();
  let current = proposedParentId;
  while (current) {
    if (current === taskId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const [[row]] = await pool.execute(
      'SELECT parent_task_id FROM tasks WHERE id = ? AND organization_id = ?',
      [current, organizationId]
    );
    if (!row) return true;
    current = row.parent_task_id;
  }
  return false;
}

// Gantt/Calendar feed: every task the user may see, with schedule, progress and dependencies.
app.get('/api/tasks/gantt', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const seesWholeOrg = req.user?.role === 'admin' || req.user?.role === 'project_manager';

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.progress, t.created_by, t.document_id,
             t.gantt_project_id, t.parent_task_id,
             DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
             DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
             DATE_FORMAT(t.created_at, '%Y-%m-%d') AS created_date,
             ta.assigned_to,
             assignee.first_name AS assigned_to_first_name, assignee.last_name AS assigned_to_last_name,
             creator.first_name AS created_by_first_name, creator.last_name AS created_by_last_name,
             (SELECT GROUP_CONCAT(td.depends_on_task_id) FROM task_dependencies td WHERE td.task_id = t.id) AS depends_on
      FROM tasks t
      LEFT JOIN taskassignments ta ON ta.task_id = t.id
      LEFT JOIN users assignee ON assignee.id = ta.assigned_to
      LEFT JOIN users creator ON creator.id = t.created_by
      WHERE t.organization_id = ?
    `;
    const params = [orgId];
    if (!seesWholeOrg) {
      query += ' AND (ta.assigned_to = ? OR t.created_by = ?)';
      params.push(userId, userId);
    }
    query += ' ORDER BY COALESCE(t.start_date, t.due_date, DATE(t.created_at)), t.id';

    const [rows] = await pool.execute(query, params);
    const isAdmin = req.user?.role === 'admin';
    const byId = new Map();
    for (const row of rows) {
      const isOwnTask = String(row.created_by) === String(userId) || String(row.assigned_to) === String(userId);
      const existing = byId.get(row.id);
      if (existing) {
        if (isOwnTask) existing.can_edit = true;
        continue;
      }
      byId.set(row.id, {
        ...row,
        depends_on: row.depends_on ? String(row.depends_on).split(',').map(Number) : [],
        can_edit: isAdmin || isOwnTask,
      });
    }
    res.json([...byId.values()]);
  } catch (error) {
    console.error('Error fetching gantt tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch gantt tasks' });
  }
});

// ==================== GANTT PROJECTS (lightweight grouping, Calendar/Gantt page only) ====================

app.get('/api/gantt/projects', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.description, p.owner_id,
              DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(p.end_date, '%Y-%m-%d') AS end_date,
              owner.first_name AS owner_first_name, owner.last_name AS owner_last_name
       FROM gantt_projects p
       LEFT JOIN users owner ON owner.id = p.owner_id
       WHERE p.organization_id = ?
       ORDER BY p.title`,
      [orgId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error listing gantt projects:', error);
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
});

app.post('/api/gantt/projects', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const userId = req.user?.userId || req.user?.id;
    const { title, description, owner_id, start_date, end_date } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const newStart = parseSqlDate(start_date);
    const newEnd = parseSqlDate(end_date);
    if (newStart === false || newEnd === false) {
      return res.status(400).json({ success: false, error: 'Invalid date. Use YYYY-MM-DD' });
    }
    const [result] = await pool.execute(
      'INSERT INTO gantt_projects (organization_id, title, description, owner_id, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orgId, String(title).trim(), (description || '').trim(), owner_id || null, newStart || null, newEnd || null, userId]
    );
    res.status(201).json({ id: result.insertId, title: String(title).trim() });
  } catch (error) {
    console.error('Error creating gantt project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

app.put('/api/gantt/projects/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const projectId = Number.parseInt(req.params.id, 10);
    const { title, description, owner_id, start_date, end_date } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const newStart = parseSqlDate(start_date);
    const newEnd = parseSqlDate(end_date);
    if (newStart === false || newEnd === false) {
      return res.status(400).json({ success: false, error: 'Invalid date. Use YYYY-MM-DD' });
    }
    const [result] = await pool.execute(
      'UPDATE gantt_projects SET title = ?, description = ?, owner_id = ?, start_date = ?, end_date = ? WHERE id = ? AND organization_id = ?',
      [String(title).trim(), (description || '').trim(), owner_id || null, newStart || null, newEnd || null, projectId, orgId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating gantt project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

app.delete('/api/gantt/projects/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const [result] = await pool.execute(
      'DELETE FROM gantt_projects WHERE id = ? AND organization_id = ?',
      [req.params.id, orgId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting gantt project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

app.patch('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = Number.parseInt(req.params.id, 10);
    const userId = req.user?.userId || req.user?.id;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    const userRole = req.user?.role;
    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid task id' });
    }

    const hasAccess = await assertUserTaskAccess(taskId, userId, userOrgId, userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to update this task' });
    }

    const [currentRows] = await pool.execute(
      `SELECT id, organization_id, status, progress,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
       FROM tasks WHERE id = ?`,
      [taskId]
    );
    const current = currentRows[0];
    if (!current) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const { status, progress, start_date, due_date, depends_on, priority, gantt_project_id, parent_task_id, title, description, assigned_to } = req.body || {};
    const updates = {};

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ success: false, error: 'Task title is required' });
      }
      updates.title = String(title).trim();
    }
    if (description !== undefined) updates.description = String(description || '');

    let newAssignee;
    if (assigned_to !== undefined) {
      if (assigned_to === null || assigned_to === '') {
        newAssignee = null;
      } else {
        newAssignee = Number.parseInt(assigned_to, 10);
        const [[assignee]] = await pool.execute(
          'SELECT id FROM users WHERE id = ? AND organization_id = ?',
          [newAssignee, current.organization_id]
        );
        if (!assignee) return res.status(400).json({ success: false, error: 'Assignee not found' });
      }
    }

    if (status !== undefined) {
      if (!TASK_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      updates.status = status;
    }

    if (priority !== undefined) {
      const normalized = String(priority || '').toLowerCase();
      if (!TASK_PRIORITIES.includes(normalized)) {
        return res.status(400).json({ success: false, error: 'Invalid priority' });
      }
      updates.priority = normalized;
    }

    if (gantt_project_id !== undefined) {
      if (gantt_project_id === null || gantt_project_id === '') {
        updates.gantt_project_id = null;
      } else {
        const [[project]] = await pool.execute(
          'SELECT id FROM gantt_projects WHERE id = ? AND organization_id = ?',
          [gantt_project_id, current.organization_id]
        );
        if (!project) return res.status(400).json({ success: false, error: 'Project not found' });
        updates.gantt_project_id = project.id;
      }
    }

    if (parent_task_id !== undefined) {
      if (parent_task_id === null || parent_task_id === '') {
        updates.parent_task_id = null;
      } else {
        const parentId = Number.parseInt(parent_task_id, 10);
        if (parentId === taskId) {
          return res.status(400).json({ success: false, error: 'A task cannot be its own parent' });
        }
        if (await wouldCreateParentCycle(taskId, parentId, current.organization_id)) {
          return res.status(400).json({ success: false, error: 'That parent would create a circular chain' });
        }
        updates.parent_task_id = parentId;
      }
    }

    if (progress !== undefined) {
      const value = Number(progress);
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        return res.status(400).json({ success: false, error: 'Progress must be a whole number between 0 and 100' });
      }
      updates.progress = value;
    }

    const newStart = parseSqlDate(start_date);
    const newDue = parseSqlDate(due_date);
    if (newStart === false || newDue === false) {
      return res.status(400).json({ success: false, error: 'Invalid date. Use YYYY-MM-DD' });
    }
    const effectiveStart = newStart !== undefined ? newStart : current.start_date;
    const effectiveDue = newDue !== undefined ? newDue : current.due_date;
    if (effectiveStart && effectiveDue && effectiveStart > effectiveDue) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after the due date' });
    }
    if (newStart !== undefined) updates.start_date = newStart;
    if (newDue !== undefined) updates.due_date = newDue;

    // Keep status and progress consistent with each other.
    if (updates.progress !== undefined && updates.status === undefined) {
      if (updates.progress === 100) updates.status = 'completed';
      else if (updates.progress > 0 && current.status === 'not_started') updates.status = 'in_progress';
      else if (updates.progress < 100 && current.status === 'completed') {
        updates.status = updates.progress > 0 ? 'in_progress' : 'not_started';
      }
    }
    if (updates.status === 'completed' && updates.progress === undefined) updates.progress = 100;
    if (updates.status === 'not_started' && updates.progress === undefined) updates.progress = 0;

    const dependencyIds = normalizeDependencyIds(depends_on);
    if (dependencyIds !== undefined && dependencyIds.length > 0) {
      if (dependencyIds.some((id) => !Number.isInteger(id) || id === taskId)) {
        return res.status(400).json({ success: false, error: 'A task cannot depend on itself' });
      }
      const [found] = await pool.query(
        'SELECT id FROM tasks WHERE organization_id = ? AND id IN (?)',
        [current.organization_id, dependencyIds]
      );
      if (found.length !== dependencyIds.length) {
        return res.status(400).json({ success: false, error: 'One or more dependency tasks were not found' });
      }
      if (await wouldCreateDependencyCycle(taskId, dependencyIds)) {
        return res.status(400).json({ success: false, error: 'That dependency would create a circular chain' });
      }
    }

    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0 && dependencyIds === undefined && newAssignee === undefined) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (updateKeys.length > 0) {
        const assignments = updateKeys.map((key) => `\`${key}\` = ?`).join(', ');
        await connection.execute(
          `UPDATE tasks SET ${assignments} WHERE id = ?`,
          [...updateKeys.map((key) => updates[key]), taskId]
        );
      }

      if (updates.status) {
        const assignmentStatus = updates.status === 'completed' ? 'completed' : updates.status === 'in_progress' ? 'in_progress' : 'pending';
        await connection.execute(
          `UPDATE taskassignments SET status = ?, completed_at = ${updates.status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE task_id = ?`,
          [assignmentStatus, taskId]
        );
      }

      if (newAssignee !== undefined) {
        await connection.execute('DELETE FROM taskassignments WHERE task_id = ?', [taskId]);
        if (newAssignee !== null) {
          await connection.execute(
            'INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES (?, ?, ?, ?)',
            [taskId, newAssignee, userId, 'pending']
          );
        }
      }

      if (dependencyIds !== undefined) {
        await connection.execute('DELETE FROM task_dependencies WHERE task_id = ?', [taskId]);
        if (dependencyIds.length > 0) {
          await connection.query(
            'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ?',
            [dependencyIds.map((id) => [taskId, id])]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [updatedRows] = await pool.execute(
      `SELECT t.id, t.status, t.progress, t.priority, t.gantt_project_id, t.parent_task_id,
              DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
              (SELECT GROUP_CONCAT(td.depends_on_task_id) FROM task_dependencies td WHERE td.task_id = t.id) AS depends_on
       FROM tasks t WHERE t.id = ?`,
      [taskId]
    );
    const updated = updatedRows[0];
    res.json({
      success: true,
      task: { ...updated, depends_on: updated.depends_on ? String(updated.depends_on).split(',').map(Number) : [] },
    });
  } catch (error) {
    console.error('Error patching task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// Gantt/Calendar page: delete a task. Children are detached (not deleted); dependencies and assignments go with it.
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = Number.parseInt(req.params.id, 10);
    const userId = req.user?.userId || req.user?.id;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    const userRole = req.user?.role;
    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid task id' });
    }
    const hasAccess = await assertUserTaskAccess(taskId, userId, userOrgId, userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to delete this task' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ?', [taskId]);
      await connection.execute('DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?', [taskId, taskId]);
      await connection.execute('DELETE FROM task_comments WHERE task_id = ?', [taskId]);
      await connection.execute('DELETE FROM taskassignments WHERE task_id = ?', [taskId]);
      await connection.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

app.get('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.userId || req.user?.id;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    const userRole = req.user?.role;

    const hasAccess = await assertUserTaskAccess(taskId, userId, userOrgId, userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to task comments' });
    }

    const [comments] = await pool.execute(
      `SELECT tc.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name 
       FROM task_comments tc 
       JOIN users u ON tc.user_id = u.id 
       WHERE tc.task_id = ? 
       ORDER BY tc.created_at ASC`,
      [taskId]
    );
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task comments' });
  }
});

app.post('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.userId || req.user?.id;
    const userOrgId = req.user?.organization_id || req.user?.orgId;
    const userRole = req.user?.role;
    const { message, parent_id } = req.body || {};

    if (!message) {
      return res.status(400).json({ success: false, error: 'Comment message is required' });
    }

    const hasAccess = await assertUserTaskAccess(taskId, userId, userOrgId, userRole);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to add task comment' });
    }

    const [result] = await pool.execute(
      'INSERT INTO task_comments (task_id, user_id, message, parent_id) VALUES (?, ?, ?, ?)',
      [taskId, userId, message, parent_id || null]
    );

    res.json({ success: true, commentId: result.insertId });
  } catch (error) {
    console.error('Error adding task comment:', error);
    res.status(500).json({ success: false, error: 'Failed to add task comment' });
  }
});

// --- Task Creation Endpoint (from Intern taskController.js) ---
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const createdBy = req.user?.userId || req.user?.id;
    const { title, description, due_date, priority, assigned_to, document_id, start_date, depends_on } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required' });
    }

    const validStartDate = parseSqlDate(start_date);
    if (validStartDate === false) {
      return res.status(400).json({ success: false, error: 'Invalid start date. Use YYYY-MM-DD' });
    }

    const dependencyIds = normalizeDependencyIds(depends_on) || [];
    if (dependencyIds.some((id) => !Number.isInteger(id))) {
      return res.status(400).json({ success: false, error: 'Invalid dependency task id' });
    }
    if (dependencyIds.length > 0) {
      const [found] = await pool.query(
        'SELECT id FROM tasks WHERE organization_id = ? AND id IN (?)',
        [orgId, dependencyIds]
      );
      if (found.length !== dependencyIds.length) {
        return res.status(400).json({ success: false, error: 'One or more dependency tasks were not found' });
      }
    }

    const normalizedDocId = document_id && String(document_id).trim() ? String(document_id).trim() : null;

    // Safely parse due_date to YYYY-MM-DD or NULL if invalid
    let validDueDate = null;
    if (due_date && typeof due_date === 'string' && due_date.trim()) {
      const parsedDate = new Date(due_date.trim());
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        if (year >= 1970 && year <= 2100) {
          validDueDate = parsedDate.toISOString().split('T')[0];
        }
      }
    }

    const normalizedPriority = ['low', 'medium', 'high'].includes(String(priority || '').toLowerCase())
      ? String(priority).toLowerCase()
      : 'medium';

    if (validStartDate && validDueDate && validStartDate > validDueDate) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after the due date' });
    }

    const [result] = await pool.execute(
      'INSERT INTO tasks (organization_id, document_id, title, description, start_date, due_date, priority, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orgId, normalizedDocId, title.trim(), description || '', validStartDate || null, validDueDate, normalizedPriority, createdBy, 'not_started']
    );
    const taskId = result.insertId;

    if (dependencyIds.length > 0) {
      await pool.query(
        'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ?',
        [dependencyIds.map((id) => [taskId, id])]
      );
    }

    const targetAssignee = assigned_to || createdBy;
    if (targetAssignee) {
      await pool.execute(
        'INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES (?, ?, ?, ?)',
        [taskId, targetAssignee, createdBy, 'pending']
      );
    }

    res.json({ success: true, taskId, id: taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// --- Workspace Users Helper Endpoint (from Intern userRoutes.js) ---

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const docs = await dbOps.getUserAccessibleDocuments(req.user.userId);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});


app.get('/api/tasks/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [tasks] = await pool.execute(
      `SELECT t.* FROM tasks t 
       JOIN taskassignments ta ON t.id = ta.task_id 
       WHERE ta.assigned_to = ? AND ta.status != 'completed'`,
      [userId]
    );
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create Task Route
app.post('/api/create-task', authenticateToken, async (req, res) => {
  try {
    const { title, description, due_date, priority, assigned_to, document_id, created_by } = req.body;

    // Get user's organization_id
    const [user] = await pool.execute(
      'SELECT organization_id FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const orgId = user[0].organization_id;

    // Create the task
    const taskId = await dbOps.createTask(orgId, document_id, title, description, due_date, priority, created_by);

    // Assign the task if assigned_to is provided
    if (assigned_to) {
      await dbOps.assignTask(taskId, assigned_to, created_by);
    }

    res.status(201).json({ success: true, taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// Update Task Route
app.put('/api/update-task/:taskId', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { completed } = req.body;
    const userId = req.user.userId;

    const assignmentStatus = completed ? 'completed' : 'pending';
    const taskStatus = completed ? 'completed' : 'not_started';

    // Update task assignment status
    if (completed) {
      await pool.execute(
        'UPDATE taskassignments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ? AND assigned_to = ?',
        [assignmentStatus, taskId, userId]
      );
    } else {
      await pool.execute(
        'UPDATE taskassignments SET status = ?, completed_at = NULL WHERE task_id = ? AND assigned_to = ?',
        [assignmentStatus, taskId, userId]
      );
    }

    // Also update the main task status
    await pool.execute(
      'UPDATE tasks SET status = ? WHERE id = ?',
      [taskStatus, taskId]
    );

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

/* app.get('/api/notifications/:userId', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.execute(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND status = 'unread' 
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.userId]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}); */

//Route Get Events
app.get('/api/calendar-events/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const events = await dbOps.getEvents(userId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

//Route Get Audit Trail (Harden boundary: only self or org admin)
app.get('/api/activity-log/:userId', authenticateToken, async (req, res) => {
  try {
    const authUserId = req.user.userId || req.user.id;
    const authOrgId = req.user.organization_id || req.user.orgId;
    const requestedUserId = req.params.userId;

    if (String(requestedUserId) !== String(authUserId)) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied to other user activity log' });
      }
      const [targetUser] = await pool.execute('SELECT organization_id FROM users WHERE id = ?', [requestedUserId]);
      if (!targetUser.length || String(targetUser[0].organization_id) !== String(authOrgId)) {
        return res.status(403).json({ error: 'Access denied: organization mismatch' });
      }
    }

    const [activities] = await pool.execute(
      `SELECT a.* FROM audittrail a
       WHERE a.user_id = ? AND a.organization_id = ?
       ORDER BY a.created_at DESC LIMIT 50`,
      [requestedUserId, authOrgId]
    );
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// ==================== ATTACHMENTS ROUTES ====================

function getSafeUploadPath(baseUploadsDir, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return null;
  if (targetPath.indexOf('\0') !== -1) return null;
  const resolvedBase = path.resolve(baseUploadsDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (!resolvedTarget.startsWith(baseWithSep)) return null;
  return resolvedTarget;
}

// Route to upload an attachment
app.post('/api/attachments/upload', authenticateToken, uploadLimiter || ((req, res, next) => next()), upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let { association_type, association_id } = req.body;
    const file_name = req.file.originalname;
    const serverFileName = req.file.filename;
    const file_type_safe = req.file.mimetype || 'application/octet-stream';
    const file_size = req.file.size || 0;

    // Handle temporary uploads (when creating a new template or document without an ID yet)
    if (!association_id || association_id === 'null' || association_id === 'undefined') {
      association_type = 'temp';
      association_id = 'temp-session';
    } else {
      // Validate write authorization to target parent entity
      if (association_type === 'document') {
        const canWriteDoc = await assertUserDocumentAccess(association_id, userId, pool, 'write');
        if (!canWriteDoc) {
          // Remove uploaded file if unauthorized
          const tempPath = path.join(uploadsDir, serverFileName);
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(403).json({ error: 'Access denied to attach file to this document' });
        }
      } else if (association_type === 'template') {
        const canWriteTpl = await assertUserTemplateAccess(association_id, userId, pool, 'write');
        if (!canWriteTpl) {
          const tempPath = path.join(uploadsDir, serverFileName);
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(403).json({ error: 'Access denied to attach file to this template' });
        }
      }
    }

    console.log(`📁 File written to disk via multer: ${req.file.path} (${file_size} bytes)`);

    // Insert record into attachments database table
    const [result] = await pool.execute(
      'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [association_type, association_id, file_name, serverFileName, file_type_safe, file_size, userId]
    );

    // Fetch the inserted record to return it with user details
    const [inserted] = await pool.execute(
      `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON a.uploaded_by = u.id 
       WHERE a.id = ?`,
      [result.insertId]
    );

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: req.user?.organization_id || req.user?.orgId || 1,
        userId,
        actionType: 'ATTACHMENT_UPLOADED',
        resourceType: association_type,
        resourceId: String(association_id),
        details: {
          attachmentId: result.insertId,
          fileName: file_name,
          fileSize: file_size,
          fileType: file_type_safe,
          associationType: association_type
        },
        req
      });
    }

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      attachment: inserted[0]
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Route to download an attachment
app.get('/api/attachments/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { allowed, attachment } = await assertUserAttachmentAccess(id, userId, pool, 'read');
    if (!allowed || !attachment) {
      return res.status(403).send('Access denied');
    }

    const serverFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);

    if (!serverFilePath || !fs.existsSync(serverFilePath)) {
      return res.status(404).send('File not found or invalid path');
    }

    res.download(serverFilePath, attachment.file_name);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).send('Error downloading file');
  }
});

// Route to view/open an attachment inline in new tab
app.get('/api/attachments/view/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { allowed, attachment } = await assertUserAttachmentAccess(id, userId, pool, 'read');
    if (!allowed || !attachment) {
      return res.status(403).send('Access denied');
    }

    const serverFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);

    if (!serverFilePath || !fs.existsSync(serverFilePath)) {
      return res.status(404).send('File not found or invalid path');
    }

    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
    res.sendFile(serverFilePath);
  } catch (error) {
    console.error('Error viewing attachment:', error);
    res.status(500).send('Error opening file');
  }
});

// Route to get all attachments for a specific association
app.get('/api/attachments/:association_type/:association_id', authenticateToken, async (req, res) => {
  try {
    const { association_type, association_id } = req.params;
    const userId = req.user.userId;

    if (association_type === 'document') {
      const isAuthorized = await assertUserDocumentAccess(association_id, userId, pool, 'read');
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (association_type === 'template') {
      const isAuthorized = await assertUserTemplateAccess(association_id, userId, pool, 'read');
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [rows] = await pool.execute(
      `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON a.uploaded_by = u.id 
       WHERE a.association_type = ? AND a.association_id = ?
       ORDER BY a.uploaded_at ASC`,
      [association_type, association_id]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Route to delete an attachment
app.delete('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { allowed, notFound, attachment } = await assertUserAttachmentAccess(id, userId, pool, 'delete');
    if (notFound) {
      return res.json({ success: true, message: 'Attachment already removed' });
    }
    if (!allowed || !attachment) {
      return res.status(403).json({ error: 'Access denied to delete attachment' });
    }

    const serverFilePath = getSafeUploadPath(uploadsDir, attachment.file_path);

    // Delete file from server disk if it exists and path is safely contained
    if (serverFilePath && fs.existsSync(serverFilePath)) {
      try {
        fs.unlinkSync(serverFilePath);
        console.log(`📁 File deleted from disk: ${serverFilePath}`);
      } catch (err) {
        console.error(`Error deleting file ${serverFilePath} from disk:`, err);
      }
    }

    // Delete from database
    await pool.execute('DELETE FROM attachments WHERE id = ?', [id]);

    if (logAuditEvent) {
      await logAuditEvent(pool, {
        orgId: req.user?.organization_id || req.user?.orgId || 1,
        userId,
        actionType: 'ATTACHMENT_DELETED',
        resourceType: attachment.association_type,
        resourceId: String(attachment.association_id),
        details: {
          attachmentId: id,
          fileName: attachment.file_name,
          associationType: attachment.association_type
        },
        req
      });
    }

    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

};
