import crypto from "crypto";
import { canAccess, classifyRequest } from "../access/accessControl";
import registerB44Entities from "./b44Entities";

const MAX_EXTENSIONS = 3;
const EXTENSION_DAYS = 7;

// Site role -> training role. Any site role other than admin/project_manager is
// treated as a training Employee (this includes the existing 'viewer' role and
// any other role the platform has, so nobody is locked out of the Employee view).
const effectiveTrainingRole = (siteRole) => {
  if (siteRole === 'admin') return 'administrator';
  if (siteRole === 'project_manager') return 'manager';
  return 'employee';
};

// Training role -> the site role written to users.role when an admin sets it explicitly.
const SITE_ROLE_FOR_TRAINING_ROLE = {
  administrator: 'admin',
  manager: 'project_manager',
  employee: 'viewer',
};

const getEffectiveTrainingRole = (req) => {
  const permissions = req.user?.permissions || [];
  if (
    req.user?.isSuperAdmin ||
    canAccess(permissions, 'training', 'manage') ||
    permissions.includes('training.admin')
  ) return 'administrator';
  if (['training.create', 'training.edit', 'training.review', 'training.approve'].some(permission =>
    permissions.includes(permission)
  )) {
    return 'manager';
  }
  return effectiveTrainingRole(req.user?.role);
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const parseSqlDate = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim().slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return text;
};

export default function registerTrainingRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  transporter,
  generateInvitationToken,
  upload,
  uploadsDir,
  fs,
  path,
  logAuditEvent,
}) {
  const getOrgId = (req) => req.user?.organization_id || req.user?.orgId || 1;
  const getUserId = (req) => req.user?.userId || req.user?.id;

  const requireTrainingRole = (...allowed) => (req, res, next) => {
    let role = getEffectiveTrainingRole(req);
    const requestAction = classifyRequest(req).action;
    if (!allowed.includes(role) &&
      canAccess(req.user?.permissions, 'training', requestAction) &&
      allowed.includes('manager')) {
      role = 'manager';
    } else if (!allowed.includes(role) &&
      canAccess(req.user?.permissions, 'training', 'view') &&
      allowed.includes('employee')) {
      role = 'employee';
    }
    if (!allowed.includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied for your training role' });
    }
    req.trainingRole = role;
    next();
  };

  // Certificates are issued once per (employee, class) — atomic upsert so a class that
  // gets marked complete twice (e.g. re-passing a quiz) doesn't re-issue or reset dates.
  async function issueCertificateIfNeeded(employeeId, classId, completedDateStr) {
    const { rows: [classRow] } = await pool.query('SELECT certificate_validity_months FROM lms_classes WHERE id = $1', [classId]);
    if (!classRow) return;
    const validationId = crypto.randomUUID();
    const expiryDate = classRow.certificate_validity_months
      ? addDaysStr(completedDateStr, classRow.certificate_validity_months * 30)
      : null;
    await pool.query(
      'INSERT INTO lms_certificates (employee_id, class_id, validation_id, issued_date, expiry_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [employeeId, classId, validationId, completedDateStr, expiryDate]
    );
  }

  // Generic numbering engine (mirrors the Document Admin's "Numbering" tab): one active
  // rule per (organization, entity_type) hands out PREFIX-000001, ..., incrementing
  // its counter each time. Returns null when no active rule is configured yet.
  async function allocateNumberingCode(orgId, entityType) {
    const { rows } = await pool.query(
      "UPDATE lms_numbering_rules SET current_counter = current_counter + 1 WHERE organization_id = $1 AND entity_type = $2 AND status = 'active' RETURNING prefix, digit_length, current_counter",
      [orgId, entityType]
    );
    if (rows.length === 0) return null;
    const rule = rows[0];
    return `${rule.prefix}-${String(rule.current_counter).padStart(rule.digit_length, '0')}`;
  }

  // ==================== SHARED ====================

  app.get('/api/training/me/role', authenticateToken, async (req, res) => {
    const role = getEffectiveTrainingRole(req);
    const { rows: rows } = await pool.query('SELECT reports_to_id FROM users WHERE id = $1', [getUserId(req)]);
    res.json({ role, reports_to_id: rows[0]?.reports_to_id ?? null });
  });

  // ==================== 5.1 FIELD SPECIALTIES (Administrator) ====================

  app.get('/api/training/specialties', authenticateToken, requireTrainingRole('administrator', 'manager'), async (req, res) => {
    try {
      const { rows: rows } = await pool.query(
        `SELECT fs.id, fs.name, fs.description, fs.code, fs.revision, fs.created_at,
                COUNT(cu.id) AS curriculum_count
         FROM lms_field_specialties fs
         LEFT JOIN lms_curricula cu ON cu.field_specialty_id = fs.id
         WHERE fs.organization_id = $1
         GROUP BY fs.id
         ORDER BY fs.name`,
        [getOrgId(req)]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error listing specialties:', error);
      res.status(500).json({ success: false, error: 'Failed to list specialties' });
    }
  });

  app.post('/api/training/specialties', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { name, description } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }
      const { rows: [duplicate] } = await pool.query(
        'SELECT id FROM lms_field_specialties WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
        [getOrgId(req), String(name).trim()]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A field specialty with this name already exists' });
      const code = await allocateNumberingCode(getOrgId(req), 'field_specialty');
      const result = await pool.query(
        'INSERT INTO lms_field_specialties (organization_id, name, description, code, created_by) VALUES ($1, $2, $3, $4, $5)',
        [getOrgId(req), String(name).trim(), (description || '').trim(), code, getUserId(req)]
      );
      res.status(201).json({ id: result.rows[0].id, name: String(name).trim(), description: (description || '').trim(), code, revision: 1 });
    } catch (error) {
      console.error('Error creating specialty:', error);
      res.status(500).json({ success: false, error: 'Failed to create specialty' });
    }
  });

  app.put('/api/training/specialties/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { name, description } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }
      const { rows: [duplicate] } = await pool.query(
        'SELECT id FROM lms_field_specialties WHERE organization_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [getOrgId(req), String(name).trim(), req.params.id]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A field specialty with this name already exists' });
      const result = await pool.query(
        'UPDATE lms_field_specialties SET name = $1, description = $2, revision = revision + 1 WHERE id = $3 AND organization_id = $4',
        [String(name).trim(), (description || '').trim(), req.params.id, getOrgId(req)]
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Specialty not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating specialty:', error);
      res.status(500).json({ success: false, error: 'Failed to update specialty' });
    }
  });

  app.delete('/api/training/specialties/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM lms_field_specialties WHERE id = $1 AND organization_id = $2',
        [req.params.id, getOrgId(req)]
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Specialty not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting specialty:', error);
      res.status(500).json({ success: false, error: 'Failed to delete specialty' });
    }
  });

  // ==================== 5.2 CURRICULA (Administrator) ====================

  async function assertSpecialtyInOrg(specialtyId, orgId) {
    const { rows: rows } = await pool.query(
      'SELECT id FROM lms_field_specialties WHERE id = $1 AND organization_id = $2',
      [specialtyId, orgId]
    );
    return rows.length > 0;
  }

  app.get('/api/training/specialties/:specialtyId/curricula', authenticateToken, requireTrainingRole('administrator', 'manager'), async (req, res) => {
    try {
      if (!(await assertSpecialtyInOrg(req.params.specialtyId, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Specialty not found' });
      }
      const { rows: rows } = await pool.query(
        `SELECT cu.id, cu.name, cu.description, cu.type, cu.code, cu.revision, cu.created_at,
                COUNT(cl.id) AS class_count
         FROM lms_curricula cu
         LEFT JOIN lms_classes cl ON cl.curriculum_id = cu.id
         WHERE cu.field_specialty_id = $1
         GROUP BY cu.id
         ORDER BY cu.name`,
        [req.params.specialtyId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error listing curricula:', error);
      res.status(500).json({ success: false, error: 'Failed to list curricula' });
    }
  });

  app.post('/api/training/specialties/:specialtyId/curricula', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertSpecialtyInOrg(req.params.specialtyId, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Specialty not found' });
      }
      const { name, description, type } = req.body || {};
      if (!name || !String(name).trim()) return res.status(400).json({ success: false, error: 'Name is required' });
      if (!['required', 'elective'].includes(type)) return res.status(400).json({ success: false, error: 'Invalid type' });
      const { rows: [duplicate] } = await pool.query(
        `SELECT cu.id FROM lms_curricula cu JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE fs.organization_id = $1 AND LOWER(cu.name) = LOWER($2)`,
        [getOrgId(req), String(name).trim()]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A curriculum with this name already exists' });
      const code = await allocateNumberingCode(getOrgId(req), 'curriculum');
      const result = await pool.query(
        'INSERT INTO lms_curricula (field_specialty_id, name, description, type, code) VALUES ($1, $2, $3, $4, $5)',
        [req.params.specialtyId, String(name).trim(), (description || '').trim(), type, code]
      );
      res.status(201).json({ id: result.rows[0].id, name: String(name).trim(), description: (description || '').trim(), type, code, revision: 1 });
    } catch (error) {
      console.error('Error creating curriculum:', error);
      res.status(500).json({ success: false, error: 'Failed to create curriculum' });
    }
  });

  async function assertCurriculumInOrg(curriculumId, orgId) {
    const { rows: rows } = await pool.query(
      `SELECT cu.id FROM lms_curricula cu
       JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
       WHERE cu.id = $1 AND fs.organization_id = $2`,
      [curriculumId, orgId]
    );
    return rows.length > 0;
  }

  app.put('/api/training/curricula/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertCurriculumInOrg(req.params.id, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Curriculum not found' });
      }
      const { name, description, type } = req.body || {};
      if (!name || !String(name).trim()) return res.status(400).json({ success: false, error: 'Name is required' });
      if (!['required', 'elective'].includes(type)) return res.status(400).json({ success: false, error: 'Invalid type' });
      const { rows: [duplicate] } = await pool.query(
        `SELECT cu.id FROM lms_curricula cu JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE fs.organization_id = $1 AND LOWER(cu.name) = LOWER($2) AND cu.id != $3`,
        [getOrgId(req), String(name).trim(), req.params.id]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A curriculum with this name already exists' });
      await pool.query(
        'UPDATE lms_curricula SET name = $1, description = $2, type = $3, revision = revision + 1 WHERE id = $4',
        [String(name).trim(), (description || '').trim(), type, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating curriculum:', error);
      res.status(500).json({ success: false, error: 'Failed to update curriculum' });
    }
  });

  app.delete('/api/training/curricula/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertCurriculumInOrg(req.params.id, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Curriculum not found' });
      }
      await pool.query('DELETE FROM lms_curricula WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting curriculum:', error);
      res.status(500).json({ success: false, error: 'Failed to delete curriculum' });
    }
  });

  // ==================== 5.3 CLASSES (Administrator) ====================

  app.get('/api/training/curricula/:curriculumId/classes', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertCurriculumInOrg(req.params.curriculumId, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Curriculum not found' });
      }
      const { rows: rows } = await pool.query(
        `SELECT cl.*, (q.id IS NOT NULL) AS quiz_created
         FROM lms_classes cl
         LEFT JOIN lms_quizzes q ON q.class_id = cl.id
         WHERE cl.curriculum_id = $1
         ORDER BY cl.display_order, cl.id`,
        [req.params.curriculumId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error listing classes:', error);
      res.status(500).json({ success: false, error: 'Failed to list classes' });
    }
  });

  const CONTENT_TYPES = ['pdf', 'video', 'live', 'document', 'linked_document'];

  // Walks a Documents-module revision chain (child rows point back via
  // revision_parent_id) forward from documentId, and returns the LAST node seen with
  // status 'published' or 'revised' — i.e. the current published version, however many
  // revisions ahead of the one a class was originally linked to. Read-only: never
  // touches any Documents publish/workflow code path.
  async function resolveLatestPublishedDocument(orgId, documentId) {
    let currentId = documentId;
    let latest = null;
    for (let i = 0; i < 50 && currentId; i += 1) {
      const { rows: [doc] } = await pool.query(
        'SELECT document_id, title, version, status, updated_at FROM documents WHERE document_id = $1 AND organization_id = $2',
        [currentId, orgId]
      );
      if (!doc) break;
      if (doc.status === 'published' || doc.status === 'revised') latest = doc;
      const { rows: [child] } = await pool.query(
        'SELECT document_id FROM documents WHERE revision_parent_id = $1 ORDER BY version DESC LIMIT 1',
        [currentId]
      );
      currentId = child?.document_id || null;
    }
    return latest;
  }

  // Picker list for the "Linked Document" content type — published/revised documents in
  // this org, deduplicated to one row per revision chain (mirrors /api/published-documents).
  app.get('/api/training/documents/published', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { rows: rows } = await pool.query(
        `SELECT document_id, title, version, revision_parent_id, status
         FROM documents
         WHERE organization_id = $1 AND status IN ('published', 'revised')
         ORDER BY title, version DESC`,
        [getOrgId(req)]
      );
      const latestByChainRoot = new Map<any, any>();
      rows.forEach((row) => {
        const rootKey = row.revision_parent_id || row.document_id;
        const existing = latestByChainRoot.get(rootKey);
        if (!existing || row.version > existing.version) latestByChainRoot.set(rootKey, row);
      });
      res.json([...latestByChainRoot.values()].map((row) => ({ document_id: row.document_id, title: row.title, version: row.version })));
    } catch (error) {
      console.error('Error listing published documents:', error);
      res.status(500).json({ success: false, error: 'Failed to list published documents' });
    }
  });

  app.post('/api/training/curricula/:curriculumId/classes', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertCurriculumInOrg(req.params.curriculumId, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Curriculum not found' });
      }
      const {
        title, description, content_type, content_url, content_name,
        live_class_date, live_class_link, duration_minutes, display_order, has_quiz, prerequisite_class_id,
        certificate_validity_months, retraining_interval_months, document_id,
      } = req.body || {};
      if (!title || !String(title).trim()) return res.status(400).json({ success: false, error: 'Title is required' });
      if (!CONTENT_TYPES.includes(content_type)) return res.status(400).json({ success: false, error: 'Invalid content_type' });

      const { rows: [duplicate] } = await pool.query(
        `SELECT cl.id FROM lms_classes cl
         JOIN lms_curricula cu ON cu.id = cl.curriculum_id
         JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE fs.organization_id = $1 AND LOWER(cl.title) = LOWER($2)`,
        [getOrgId(req), String(title).trim()]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A class with this name already exists' });

      // A prerequisite must be another class in the same curriculum — cross-curriculum
      // prerequisites would let an admin lock a class behind a class the learner may
      // never be assigned to.
      let prerequisiteClassId = null;
      if (prerequisite_class_id) {
        const { rows: [prereq] } = await pool.query('SELECT id FROM lms_classes WHERE id = $1 AND curriculum_id = $2', [prerequisite_class_id, req.params.curriculumId]);
        if (!prereq) return res.status(400).json({ success: false, error: 'Prerequisite must be a class in the same curriculum' });
        prerequisiteClassId = prereq.id;
      }

      let linkedDocumentId = null;
      if (content_type === 'linked_document') {
        if (!document_id) return res.status(400).json({ success: false, error: 'Choose a document to link' });
        const { rows: [doc] } = await pool.query('SELECT document_id FROM documents WHERE document_id = $1 AND organization_id = $2', [document_id, getOrgId(req)]);
        if (!doc) return res.status(400).json({ success: false, error: 'Document not found' });
        linkedDocumentId = doc.document_id;
      }

      const result = await pool.query(
        `INSERT INTO lms_classes
          (curriculum_id, title, description, content_type, content_url, content_name,
           live_class_date, live_class_link, duration_minutes, display_order, has_quiz, prerequisite_class_id, certificate_validity_months, retraining_interval_months, document_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          req.params.curriculumId, String(title).trim(), (description || '').trim(), content_type,
          content_url || null, content_name || null,
          content_type === 'live' && live_class_date ? live_class_date : null,
          content_type === 'live' ? (live_class_link || null) : null,
          Number(duration_minutes) || 0, Number(display_order) || 0, has_quiz ? 1 : 0, prerequisiteClassId,
          Number(certificate_validity_months) > 0 ? Number(certificate_validity_months) : null,
          Number(retraining_interval_months) > 0 ? Number(retraining_interval_months) : null,
          linkedDocumentId,
        ]
      );
      const classId = result.rows[0].id;
      if (has_quiz) {
        await pool.query(
          'INSERT INTO lms_quizzes (class_id, title, passing_score) VALUES ($1, $2, 80)',
          [classId, `${String(title).trim()} Quiz`]
        );
      }
      res.status(201).json({ id: classId });
    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ success: false, error: 'Failed to create class' });
    }
  });

  async function assertClassInOrg(classId, orgId) {
    const { rows: rows } = await pool.query(
      `SELECT cl.id, cl.title, cl.curriculum_id FROM lms_classes cl
       JOIN lms_curricula cu ON cu.id = cl.curriculum_id
       JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
       WHERE cl.id = $1 AND fs.organization_id = $2`,
      [classId, orgId]
    );
    return rows[0] || null;
  }

  // An employee "has" a class if they hold an assignment for the curriculum that owns it.
  async function assertEmployeeEnrolledInClass(employeeId, classId) {
    const { rows: rows } = await pool.query(
      `SELECT cl.id, cl.title, cl.curriculum_id, cl.prerequisite_class_id FROM lms_classes cl
       JOIN lms_assignments a ON a.curriculum_id = cl.curriculum_id
       WHERE cl.id = $1 AND a.employee_id = $2`,
      [classId, employeeId]
    );
    return rows[0] || null;
  }

  // A class with an unmet prerequisite can't be completed (directly or via passing its
  // quiz) — returns an error message string, or null when there's nothing blocking it.
  async function prerequisiteBlocking(employeeId, classRow) {
    if (!classRow.prerequisite_class_id) return null;
    const { rows: [progress] } = await pool.query(
      "SELECT status FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2 AND status = 'completed'",
      [employeeId, classRow.prerequisite_class_id]
    );
    if (progress) return null;
    const { rows: [prereq] } = await pool.query('SELECT title FROM lms_classes WHERE id = $1', [classRow.prerequisite_class_id]);
    return `Complete "${prereq?.title || 'the prerequisite class'}" first`;
  }

  app.put('/api/training/classes/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const classRow = await assertClassInOrg(req.params.id, getOrgId(req));
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });

      const {
        title, description, content_type, content_url, content_name,
        live_class_date, live_class_link, duration_minutes, display_order, has_quiz, prerequisite_class_id,
        certificate_validity_months, retraining_interval_months, document_id,
      } = req.body || {};
      if (!title || !String(title).trim()) return res.status(400).json({ success: false, error: 'Title is required' });
      if (!CONTENT_TYPES.includes(content_type)) return res.status(400).json({ success: false, error: 'Invalid content_type' });

      const { rows: [duplicate] } = await pool.query(
        `SELECT cl.id FROM lms_classes cl
         JOIN lms_curricula cu ON cu.id = cl.curriculum_id
         JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE fs.organization_id = $1 AND LOWER(cl.title) = LOWER($2) AND cl.id != $3`,
        [getOrgId(req), String(title).trim(), req.params.id]
      );
      if (duplicate) return res.status(400).json({ success: false, error: 'A class with this name already exists' });

      let prerequisiteClassId = null;
      if (prerequisite_class_id) {
        if (String(prerequisite_class_id) === String(req.params.id)) {
          return res.status(400).json({ success: false, error: 'A class cannot be its own prerequisite' });
        }
        const { rows: [prereq] } = await pool.query('SELECT id FROM lms_classes WHERE id = $1 AND curriculum_id = $2', [prerequisite_class_id, classRow.curriculum_id]);
        if (!prereq) return res.status(400).json({ success: false, error: 'Prerequisite must be a class in the same curriculum' });
        prerequisiteClassId = prereq.id;
      }

      let linkedDocumentId = null;
      if (content_type === 'linked_document') {
        if (!document_id) return res.status(400).json({ success: false, error: 'Choose a document to link' });
        const { rows: [doc] } = await pool.query('SELECT document_id FROM documents WHERE document_id = $1 AND organization_id = $2', [document_id, getOrgId(req)]);
        if (!doc) return res.status(400).json({ success: false, error: 'Document not found' });
        linkedDocumentId = doc.document_id;
      }

      await pool.query(
        `UPDATE lms_classes SET title = $1, description = $2, content_type = $3, content_url = $4, content_name = $5,
                live_class_date = $6, live_class_link = $7, duration_minutes = $8, display_order = $9, has_quiz = $10, prerequisite_class_id = $11,
                certificate_validity_months = $12, retraining_interval_months = $13, document_id = $14
         WHERE id = $15`,
        [
          String(title).trim(), (description || '').trim(), content_type, content_url || null, content_name || null,
          content_type === 'live' && live_class_date ? live_class_date : null,
          content_type === 'live' ? (live_class_link || null) : null,
          Number(duration_minutes) || 0, Number(display_order) || 0, has_quiz ? 1 : 0, prerequisiteClassId,
          Number(certificate_validity_months) > 0 ? Number(certificate_validity_months) : null,
          Number(retraining_interval_months) > 0 ? Number(retraining_interval_months) : null,
          linkedDocumentId,
          req.params.id,
        ]
      );
      if (has_quiz) {
        // Atomic upsert — see the identical comment on the quiz-fetch route below for why.
        await pool.query(
          'INSERT INTO lms_quizzes (class_id, title, passing_score) VALUES ($1, $2, 80) ON CONFLICT DO NOTHING',
          [req.params.id, `${String(title).trim()} Quiz`]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating class:', error);
      res.status(500).json({ success: false, error: 'Failed to update class' });
    }
  });

  app.delete('/api/training/classes/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const classRow = await assertClassInOrg(req.params.id, getOrgId(req));
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });
      await pool.query('DELETE FROM lms_classes WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting class:', error);
      res.status(500).json({ success: false, error: 'Failed to delete class' });
    }
  });

  app.post('/api/training/classes/:id/upload', authenticateToken, requireTrainingRole('administrator'), upload.single('file'), async (req, res) => {
    try {
      const classRow = await assertClassInOrg(req.params.id, getOrgId(req));
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

      await pool.query(
        'UPDATE lms_classes SET content_url = $1, content_name = $2 WHERE id = $3',
        [req.file.filename, req.file.originalname, req.params.id]
      );
      res.json({ success: true, content_url: req.file.filename, content_name: req.file.originalname });
    } catch (error) {
      console.error('Error uploading class content:', error);
      res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
  });

  const safeUploadPath = (targetName) => {
    if (!targetName || typeof targetName !== 'string' || targetName.indexOf('\0') !== -1) return null;
    const resolvedBase = path.resolve(uploadsDir);
    const resolvedTarget = path.resolve(resolvedBase, targetName);
    const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    if (!resolvedTarget.startsWith(baseWithSep)) return null;
    return resolvedTarget;
  };

  // Serves an uploaded class file inline (PDF viewer / image / download) — this needs its
  // own authenticated route because uploaded files aren't under any public/static folder,
  // the same pattern the Documents/Tasks attachment routes already use elsewhere.
  app.get('/api/training/classes/:id/content', authenticateToken, async (req, res) => {
    try {
      const isAdmin = getEffectiveTrainingRole(req) === 'administrator';
      const classRow = isAdmin
        ? await assertClassInOrg(req.params.id, getOrgId(req))
        : await assertEmployeeEnrolledInClass(getUserId(req), req.params.id);
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });

      const { rows: [fullClass] } = await pool.query('SELECT content_url, content_name FROM lms_classes WHERE id = $1', [req.params.id]);
      if (!fullClass?.content_url) return res.status(404).json({ success: false, error: 'No file uploaded for this class' });

      const filePath = safeUploadPath(fullClass.content_url);
      if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'File not found' });

      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fullClass.content_name || fullClass.content_url)}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving class content:', error);
      res.status(500).json({ success: false, error: 'Failed to load file' });
    }
  });

  // ==================== 5.4 QUIZ BUILDER (Administrator) / §7 Employee quiz fetch ====================
  // Shared path: Administrator gets the full quiz (with answer key) for editing, and it
  // auto-creates the quiz row on first call. An Employee gets the same quiz stripped of
  // every answer field, and only if they are enrolled in a curriculum that owns this class.

  app.get('/api/training/classes/:classId/quiz', authenticateToken, async (req, res) => {
    try {
      const role = getEffectiveTrainingRole(req);

      if (role === 'administrator') {
        const classRow = await assertClassInOrg(req.params.classId, getOrgId(req));
        if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });

        let { rows: quizzes } = await pool.query('SELECT * FROM lms_quizzes WHERE class_id = $1', [req.params.classId]);
        if (quizzes.length === 0) {
          // Atomic upsert: two concurrent requests both seeing "no quiz yet" (e.g. the
          // frontend fires the has_quiz update and the first addQuestion call together)
          // would otherwise both try to INSERT and one loses to the unique-key error.
          await pool.query(
            'INSERT INTO lms_quizzes (class_id, title, passing_score) VALUES ($1, $2, 80) ON CONFLICT DO NOTHING',
            [req.params.classId, `${classRow.title} Quiz`]
          );
          await pool.query('UPDATE lms_classes SET has_quiz = 1 WHERE id = $1', [req.params.classId]);
          ({ rows: quizzes } = await pool.query('SELECT * FROM lms_quizzes WHERE class_id = $1', [req.params.classId]));
        }
        const quiz = quizzes[0];
        const { rows: questions } = await pool.query(
          'SELECT * FROM lms_quiz_questions WHERE quiz_id = $1 ORDER BY display_order, id',
          [quiz.id]
        );
        return res.json({ ...quiz, questions });
      }

      // Employee (or manager previewing): must be enrolled in a curriculum that owns this class.
      const employeeId = getUserId(req);
      const enrolled = await assertEmployeeEnrolledInClass(employeeId, req.params.classId);
      if (!enrolled) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });

      const { rows: quizzes } = await pool.query('SELECT * FROM lms_quizzes WHERE class_id = $1', [req.params.classId]);
      if (quizzes.length === 0) return res.status(404).json({ success: false, error: 'This class has no quiz' });
      const quiz = quizzes[0];
      const { rows: questions } = await pool.query(
        'SELECT id, quiz_id, question_type, question, options, acceptable_answers, match_pairs, time_limit_seconds, display_order FROM lms_quiz_questions WHERE quiz_id = $1 ORDER BY display_order, id',
        [quiz.id]
      );
      const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      // A quiz with a question bank larger than questions_per_attempt draws a random
      // subset — seeded by employee + quiz + attempt number so re-fetching the same
      // in-progress attempt (a page refresh, another tab hydrating) doesn't swap the
      // question set out from under answers the learner already picked. A new attempt
      // (attempt count goes up after submit) gets a fresh draw.
      const { rows: [{ attemptCount }] } = await pool.query(
        'SELECT COUNT(*) AS attemptCount FROM lms_quiz_attempts WHERE employee_id = $1 AND quiz_id = $2',
        [employeeId, quiz.id]
      );
      const poolLimit = quiz.questions_per_attempt;
      let drawnQuestions = questions;
      if (poolLimit && poolLimit < questions.length) {
        // Plain `*` overflows Number's 53-bit safe-integer range here and silently loses
        // the low bits that make each attemptCount produce a different seed — Math.imul
        // keeps this as true 32-bit integer multiplication.
        let seed = [employeeId, quiz.id, attemptCount].reduce((acc, n) => (Math.imul(acc, 2654435761) + Number(n)) >>> 0, 2166136261);
        const seededRandom = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        const seededShuffle = (items) => {
          const copy = [...items];
          for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(seededRandom() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };
        drawnQuestions = seededShuffle(questions).slice(0, poolLimit);
      }
      const sanitized = drawnQuestions.map((question) => {
        if (question.question_type !== 'matching') {
          // Strip the answer key (correct_index) — the learner only gets it back, per
          // question, in the submit response's `results` entry after they've answered.
          const { match_pairs, acceptable_answers, correct_index, ...rest } = question;
          return rest;
        }
        const pairs = asArray(question.match_pairs);
        const { acceptable_answers, ...rest } = question;
        return {
          ...rest,
          match_pairs: pairs.map((pair) => ({ left: pair.left })),
          match_options: shuffle(pairs.map((pair) => pair.right)),
        };
      });
      res.json({
        id: quiz.id,
        class_id: quiz.class_id,
        title: quiz.title,
        passing_score: quiz.passing_score,
        questions_per_attempt: quiz.questions_per_attempt,
        max_attempts: quiz.max_attempts,
        attempts_used: attemptCount,
        total_questions: questions.length,
        questions: sanitized,
      });
    } catch (error) {
      console.error('Error fetching quiz:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch quiz' });
    }
  });

  app.put('/api/training/classes/:classId/quiz', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const classRow = await assertClassInOrg(req.params.classId, getOrgId(req));
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });

      const sets = [];
      const params = [];
      let score;
      if (req.body?.passing_score !== undefined) {
        score = Math.min(100, Math.max(0, Number(req.body.passing_score) || 0));
        sets.push(`passing_score = $${sets.length + 1}`);
        params.push(score);
      }
      let questionsPerAttempt;
      if (req.body?.questions_per_attempt !== undefined) {
        const raw = Number(req.body.questions_per_attempt) || 0;
        questionsPerAttempt = raw > 0 ? raw : null;
        sets.push(`questions_per_attempt = $${sets.length + 1}`);
        params.push(questionsPerAttempt);
      }
      let maxAttempts;
      if (req.body?.max_attempts !== undefined) {
        const raw = Number(req.body.max_attempts) || 0;
        maxAttempts = raw > 0 ? raw : null;
        sets.push(`max_attempts = $${sets.length + 1}`);
        params.push(maxAttempts);
      }
      if (sets.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });

      params.push(req.params.classId);
      const result = await pool.query(`UPDATE lms_quizzes SET ${sets.join(', ')} WHERE class_id = $${params.length + 1}`, params);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Quiz not found for this class' });
      res.json({ success: true, passing_score: score, questions_per_attempt: questionsPerAttempt, max_attempts: maxAttempts });
    } catch (error) {
      console.error('Error updating quiz:', error);
      res.status(500).json({ success: false, error: 'Failed to update quiz' });
    }
  });

  const QUESTION_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'matching'];

  app.post('/api/training/classes/:classId/quiz/questions', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const classRow = await assertClassInOrg(req.params.classId, getOrgId(req));
      if (!classRow) return res.status(404).json({ success: false, error: 'Class not found' });

      let { rows: quizzes } = await pool.query('SELECT id FROM lms_quizzes WHERE class_id = $1', [req.params.classId]);
      if (quizzes.length === 0) {
        // Atomic upsert — see the identical comment on the quiz-fetch route above.
        await pool.query(
          'INSERT INTO lms_quizzes (class_id, title, passing_score) VALUES ($1, $2, 80) ON CONFLICT DO NOTHING',
          [req.params.classId, `${classRow.title} Quiz`]
        );
        await pool.query('UPDATE lms_classes SET has_quiz = 1 WHERE id = $1', [req.params.classId]);
        ({ rows: quizzes } = await pool.query('SELECT id FROM lms_quizzes WHERE class_id = $1', [req.params.classId]));
      }

      const { question_type, question, options, correct_index, acceptable_answers, match_pairs, display_order, time_limit_seconds } = req.body || {};
      if (!QUESTION_TYPES.includes(question_type)) return res.status(400).json({ success: false, error: 'Invalid question_type' });
      if (!question || !String(question).trim()) return res.status(400).json({ success: false, error: 'Question text is required' });

      const result = await pool.query(
        `INSERT INTO lms_quiz_questions
          (quiz_id, question_type, question, options, correct_index, acceptable_answers, match_pairs, time_limit_seconds, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          quizzes[0].id, question_type, String(question).trim(),
          JSON.stringify(options || []),
          correct_index === undefined || correct_index === null ? null : Number(correct_index),
          JSON.stringify(acceptable_answers || []),
          JSON.stringify(match_pairs || []),
          Number(time_limit_seconds) > 0 ? Number(time_limit_seconds) : null,
          Number(display_order) || 0,
        ]
      );
      res.status(201).json({ id: result.rows[0].id });
    } catch (error) {
      console.error('Error adding question:', error);
      res.status(500).json({ success: false, error: 'Failed to add question' });
    }
  });

  async function assertQuestionInOrg(questionId, orgId) {
    const { rows: rows } = await pool.query(
      `SELECT qq.id FROM lms_quiz_questions qq
       JOIN lms_quizzes q ON q.id = qq.quiz_id
       JOIN lms_classes cl ON cl.id = q.class_id
       JOIN lms_curricula cu ON cu.id = cl.curriculum_id
       JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
       WHERE qq.id = $1 AND fs.organization_id = $2`,
      [questionId, orgId]
    );
    return rows.length > 0;
  }

  app.put('/api/training/questions/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertQuestionInOrg(req.params.id, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Question not found' });
      }
      const { question_type, question, options, correct_index, acceptable_answers, match_pairs, display_order, time_limit_seconds } = req.body || {};
      const updates = [];
      const params = [];
      if (question_type !== undefined) { updates.push(`question_type = $${updates.length + 1}`); params.push(question_type); }
      if (question !== undefined) { updates.push(`question = $${updates.length + 1}`); params.push(String(question).trim()); }
      if (options !== undefined) { updates.push(`options = $${updates.length + 1}`); params.push(JSON.stringify(options)); }
      if (correct_index !== undefined) { updates.push(`correct_index = $${updates.length + 1}`); params.push(correct_index === null ? null : Number(correct_index)); }
      if (acceptable_answers !== undefined) { updates.push(`acceptable_answers = $${updates.length + 1}`); params.push(JSON.stringify(acceptable_answers)); }
      if (match_pairs !== undefined) { updates.push(`match_pairs = $${updates.length + 1}`); params.push(JSON.stringify(match_pairs)); }
      if (time_limit_seconds !== undefined) { updates.push(`time_limit_seconds = $${updates.length + 1}`); params.push(Number(time_limit_seconds) > 0 ? Number(time_limit_seconds) : null); }
      if (display_order !== undefined) { updates.push(`display_order = $${updates.length + 1}`); params.push(Number(display_order) || 0); }
      if (updates.length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });
      params.push(req.params.id);
      await pool.query(`UPDATE lms_quiz_questions SET ${updates.join(', ')} WHERE id = $${params.length + 1}`, params);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ success: false, error: 'Failed to update question' });
    }
  });

  app.delete('/api/training/questions/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (!(await assertQuestionInOrg(req.params.id, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Question not found' });
      }
      await pool.query('DELETE FROM lms_quiz_questions WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ success: false, error: 'Failed to delete question' });
    }
  });

  // ==================== 5.5 USERS & ROLES (Administrator) ====================

  app.get('/api/training/users', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const search = req.query?.q ? String(req.query.q).trim().toLowerCase() : '';
      let query = `
        SELECT id, first_name, last_name, email, role, reports_to_id, status
        FROM users
        WHERE organization_id = $1
      `;
      const params = [getOrgId(req)];
      if (search) {
        query += ` AND (LOWER(CONCAT(first_name, ' ', last_name)) LIKE $2 OR LOWER(email) LIKE $3)`;
        params.push(`%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY first_name, last_name';
      const { rows } = await pool.query(query, params);
      res.json(rows.map((row) => ({ ...row, training_role: effectiveTrainingRole(row.role) })));
    } catch (error) {
      console.error('Error listing training users:', error);
      res.status(500).json({ success: false, error: 'Failed to list users' });
    }
  });

  app.put('/api/training/users/:id/role', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      if (Number(req.params.id) === Number(getUserId(req))) {
        return res.status(400).json({ success: false, error: 'You cannot change your own role' });
      }
      const { role } = req.body || {};
      const siteRole = SITE_ROLE_FOR_TRAINING_ROLE[role];
      if (!siteRole) return res.status(400).json({ success: false, error: 'Invalid training role' });
      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 AND organization_id = $3',
        [siteRole, req.params.id, getOrgId(req)]
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true, role, site_role: siteRole });
    } catch (error) {
      console.error('Error setting training role:', error);
      res.status(500).json({ success: false, error: 'Failed to set role' });
    }
  });

  app.put('/api/training/users/:id/manager', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { managerId } = req.body || {};
      const result = await pool.query(
        'UPDATE users SET reports_to_id = $1 WHERE id = $2 AND organization_id = $3',
        [managerId || null, req.params.id, getOrgId(req)]
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting manager:', error);
      res.status(500).json({ success: false, error: 'Failed to set manager' });
    }
  });

  app.post('/api/training/users/invite', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { email, role } = req.body || {};
      const siteRole = SITE_ROLE_FOR_TRAINING_ROLE[role];
      if (!email || !String(email).trim()) return res.status(400).json({ success: false, error: 'Email is required' });
      if (!siteRole) return res.status(400).json({ success: false, error: 'Invalid training role' });

      const orgId = getOrgId(req);
      const cleaned = String(email).trim().toLowerCase();
      const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [cleaned]);
      if (existing.length > 0) return res.status(409).json({ success: false, error: 'A user with this email already exists' });

      const userId = await dbOps.inviteUser(orgId, cleaned, siteRole, null, 'You have been invited to join Training.', 'invited', null);

      const { rows: orgs } = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      const orgName = orgs[0]?.name || 'the organization';

      const invitationToken = generateInvitationToken({ email: cleaned, role: siteRole, department: null, site: null, orgId });
      const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

      if (transporter) {
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@example.com',
          to: cleaned,
          subject: `Invitation to join ${orgName}`,
          html: `
            <h1>You've been invited to join ${orgName}</h1>
            <p>You have been invited to the Training module. Click below to accept:</p>
            <p><a href="${invitationLink}">Accept invitation</a></p>
            <p>This invitation link will expire in 7 days.</p>
          `,
        }).catch((error) => console.error('Error sending training invite email:', error));
      }

      res.status(201).json({ id: userId, link: invitationLink });
    } catch (error) {
      console.error('Error inviting training user:', error);
      res.status(500).json({ success: false, error: 'Failed to invite user' });
    }
  });

  // ==================== 5.6 ASSIGNMENTS — org-wide view (Administrator) ====================

  app.get('/api/training/assignments', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const assignments = await fetchAssignmentsWithProgress('e.organization_id = $1', [getOrgId(req)]);
      for (const assignment of assignments) {
        const { rows: classes } = await pool.query(
          `SELECT cl.id, cl.title, cl.has_quiz, cp.status, cp.progress_percent, cp.quiz_score, cp.quiz_passed,
                  (SELECT COUNT(*) FROM lms_quiz_attempts qa WHERE qa.class_id = cl.id AND qa.employee_id = $1) AS attempt_count
           FROM lms_classes cl
           LEFT JOIN lms_class_progress cp ON cp.class_id = cl.id AND cp.employee_id = $2
           WHERE cl.curriculum_id = $3
           ORDER BY cl.display_order, cl.id`,
          [assignment.employee_id, assignment.employee_id, assignment.curriculum_id]
        );
        assignment.classes = classes;
      }
      res.json(assignments);
    } catch (error) {
      console.error('Error listing assignments:', error);
      res.status(500).json({ success: false, error: 'Failed to list assignments' });
    }
  });

  // Shared by all three roles: Admin extends anything org-wide, Manager extends their
  // direct reports' assignments, Employee extends only their own.
  app.put('/api/training/assignments/:id/extend', authenticateToken, async (req, res) => {
    try {
      const role = getEffectiveTrainingRole(req);
      const { rows: rows } = await pool.query(
        `SELECT a.*, e.reports_to_id FROM lms_assignments a
         JOIN users e ON e.id = a.employee_id
         WHERE a.id = $1 AND e.organization_id = $2`,
        [req.params.id, getOrgId(req)]
      );
      const assignment = rows[0];
      if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

      const userId = getUserId(req);
      const allowed =
        role === 'administrator' ||
        (role === 'manager' && Number(assignment.reports_to_id) === Number(userId)) ||
        (role === 'employee' && Number(assignment.employee_id) === Number(userId));
      if (!allowed) return res.status(403).json({ success: false, error: 'Access denied to extend this assignment' });

      if (assignment.extensions_used >= MAX_EXTENSIONS) {
        return res.status(400).json({ success: false, error: 'Maximum extensions reached' });
      }
      await pool.query(
        'UPDATE lms_assignments SET due_date = (due_date + make_interval(days => $1)), extensions_used = extensions_used + 1 WHERE id = $2',
        [EXTENSION_DAYS, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error extending assignment:', error);
      res.status(500).json({ success: false, error: 'Failed to extend assignment' });
    }
  });

  // Assignment rows enriched with computed curriculum-level progress (rule 9: completed
  // classes / total classes). Shared by Manager and Employee endpoints.
  async function fetchAssignmentsWithProgress(whereSql, params) {
    const { rows: rows } = await pool.query(
      `SELECT a.*, cu.name AS curriculum_name,
              e.first_name AS employee_first_name, e.last_name AS employee_last_name, e.email AS employee_email,
              (SELECT COUNT(*) FROM lms_classes cl WHERE cl.curriculum_id = a.curriculum_id) AS total_classes,
              (SELECT COUNT(*) FROM lms_class_progress cp
                 JOIN lms_classes cl2 ON cl2.id = cp.class_id
                WHERE cl2.curriculum_id = a.curriculum_id AND cp.employee_id = a.employee_id AND cp.status = 'completed') AS completed_classes,
              (SELECT COUNT(*) FROM lms_class_progress cp3
                 JOIN lms_classes cl3 ON cl3.id = cp3.class_id
                WHERE cl3.curriculum_id = a.curriculum_id AND cp3.employee_id = a.employee_id) AS started_classes
       FROM lms_assignments a
       JOIN lms_curricula cu ON cu.id = a.curriculum_id
       JOIN users e ON e.id = a.employee_id
       WHERE ${whereSql}
       ORDER BY e.first_name, e.last_name, a.due_date`,
      params
    );
    const today = todayStr();
    return rows.map((row) => {
      const total = Number(row.total_classes) || 0;
      const completed = Number(row.completed_classes) || 0;
      const isComplete = total > 0 && completed >= total;
      const dueDate = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : String(row.due_date).slice(0, 10);
      return {
        ...row,
        progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        is_complete: isComplete,
        is_overdue: !isComplete && dueDate < today,
        is_started: Number(row.started_classes) > 0,
      };
    });
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysStr(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // ==================== 6. MANAGER APIs ====================
  // Every endpoint below is implicitly scoped to reports_to_id = current manager's id.

  app.get('/api/training/manager/dashboard', authenticateToken, requireTrainingRole('manager'), async (req, res) => {
    try {
      const managerId = getUserId(req);
      const { rows: [{ team_members }] } = await pool.query(
        'SELECT COUNT(*) AS team_members FROM users WHERE reports_to_id = $1',
        [managerId]
      );
      const assignments = await fetchAssignmentsWithProgress('e.reports_to_id = $1', [managerId]);
      const active = assignments.filter((a) => !a.is_complete).length;
      const overdue = assignments.filter((a) => a.is_overdue).length;
      const completed = assignments.filter((a) => a.is_complete).length;
      res.json({ team_members, active_assignments: active, overdue, completed });
    } catch (error) {
      console.error('Error building manager dashboard:', error);
      res.status(500).json({ success: false, error: 'Failed to build dashboard' });
    }
  });

  app.get('/api/training/manager/team', authenticateToken, requireTrainingRole('manager'), async (req, res) => {
    try {
      const { rows: rows } = await pool.query(
        'SELECT id, first_name, last_name, email, status FROM users WHERE reports_to_id = $1 ORDER BY first_name, last_name',
        [getUserId(req)]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error listing team:', error);
      res.status(500).json({ success: false, error: 'Failed to list team' });
    }
  });

  app.post('/api/training/manager/assignments', authenticateToken, requireTrainingRole('manager'), async (req, res) => {
    try {
      const managerId = getUserId(req);
      const { employeeIds, curriculumId, dueDate } = req.body || {};
      if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ success: false, error: 'employeeIds is required' });
      }
      if (!(await assertCurriculumInOrg(curriculumId, getOrgId(req)))) {
        return res.status(404).json({ success: false, error: 'Curriculum not found' });
      }
      const { rows: curriculumRows } = await pool.query('SELECT type FROM lms_curricula WHERE id = $1', [curriculumId]);
      const curriculumType = curriculumRows[0].type;

      const { rows: team } = await pool.query('SELECT id FROM users WHERE reports_to_id = $1', [managerId]);
      const teamIds = new Set<any>(team.map((row) => row.id));
      const targetIds = employeeIds.map(Number).filter((id) => teamIds.has(id));
      if (targetIds.length === 0) return res.json({ created: 0 });

      const resolvedDueDate = parseSqlDate(dueDate) || addDaysStr(todayStr(), 14);

      const { rows: existing } = await pool.query(
        'SELECT employee_id FROM lms_assignments WHERE curriculum_id = $1 AND employee_id = ANY($2)',
        [curriculumId, targetIds]
      );
      const alreadyAssigned = new Set<any>(existing.map((row) => row.employee_id));
      const fresh = targetIds.filter((id) => !alreadyAssigned.has(id));
      if (fresh.length === 0) return res.json({ created: 0 });

      await pool.query(
        `INSERT INTO lms_assignments
          (employee_id, manager_id, curriculum_id, assignment_type, assigned_by_id, due_date, extensions_used)
         VALUES $1`,
        [fresh.map((employeeId) => [employeeId, managerId, curriculumId, curriculumType, managerId, resolvedDueDate, 0])]
      );
      res.status(201).json({ created: fresh.length });
    } catch (error) {
      console.error('Error bulk-assigning training:', error);
      res.status(500).json({ success: false, error: 'Failed to assign training' });
    }
  });

  app.get('/api/training/manager/progress', authenticateToken, requireTrainingRole('manager'), async (req, res) => {
    try {
      const managerId = getUserId(req);
      const assignments = await fetchAssignmentsWithProgress('e.reports_to_id = $1', [managerId]);

      const byEmployee = new Map<any, any>();
      for (const assignment of assignments) {
        const { rows: classes } = await pool.query(
          `SELECT cl.id, cl.title, cl.has_quiz, cp.status, cp.progress_percent, cp.quiz_score, cp.quiz_passed,
                  (SELECT COUNT(*) FROM lms_quiz_attempts qa WHERE qa.class_id = cl.id AND qa.employee_id = $1) AS attempt_count
           FROM lms_classes cl
           LEFT JOIN lms_class_progress cp ON cp.class_id = cl.id AND cp.employee_id = $2
           WHERE cl.curriculum_id = $3
           ORDER BY cl.display_order, cl.id`,
          [assignment.employee_id, assignment.employee_id, assignment.curriculum_id]
        );
        const entry = byEmployee.get(assignment.employee_id) || {
          employee_id: assignment.employee_id,
          employee_first_name: assignment.employee_first_name,
          employee_last_name: assignment.employee_last_name,
          employee_email: assignment.employee_email,
          assignments: [],
        };
        entry.assignments.push({ ...assignment, classes });
        byEmployee.set(assignment.employee_id, entry);
      }
      res.json([...byEmployee.values()]);
    } catch (error) {
      console.error('Error building manager progress view:', error);
      res.status(500).json({ success: false, error: 'Failed to build progress view' });
    }
  });

  // ==================== 7. EMPLOYEE APIs ====================
  // Every endpoint below is implicitly scoped to employee_id = current user's id.

  app.get('/api/training/employee/dashboard', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const assignments = await fetchAssignmentsWithProgress('a.employee_id = $1', [employeeId]);
      const completed = assignments.filter((a) => a.is_complete).length;
      const overdue = assignments.filter((a) => a.is_overdue).length;
      const inProgress = assignments.filter((a) => !a.is_complete && !a.is_overdue && a.is_started).length;
      const nearestDue = assignments
        .filter((a) => !a.is_complete)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .slice(0, 3);
      res.json({ assigned: assignments.length, in_progress: inProgress, overdue, completed, nearest_due: nearestDue });
    } catch (error) {
      console.error('Error building employee dashboard:', error);
      res.status(500).json({ success: false, error: 'Failed to build dashboard' });
    }
  });

  app.get('/api/training/employee/my-training', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const assignments = await fetchAssignmentsWithProgress('a.employee_id = $1', [employeeId]);
      for (const assignment of assignments) {
        const { rows: classes } = await pool.query(
          `SELECT cl.id, cl.title, cl.content_type, cl.content_url, cl.content_name, cl.live_class_date, cl.live_class_link,
                  cl.has_quiz, cl.duration_minutes, cl.prerequisite_class_id, cl.document_id,
                  cp.status, cp.progress_percent, cp.quiz_score, cp.quiz_passed,
                  (SELECT r.rating FROM lms_class_ratings r WHERE r.class_id = cl.id AND r.employee_id = $1) AS rating,
                  cert.validation_id, cert.issued_date, cert.expiry_date
           FROM lms_classes cl
           LEFT JOIN lms_class_progress cp ON cp.class_id = cl.id AND cp.employee_id = $2
           LEFT JOIN lms_certificates cert ON cert.class_id = cl.id AND cert.employee_id = $3
           WHERE cl.curriculum_id = $4
           ORDER BY cl.display_order, cl.id`,
          [employeeId, employeeId, employeeId, assignment.curriculum_id]
        );
        // Resolve each linked-document class to its CURRENT published version — the whole
        // point being that a class doesn't go stale when the document it points to does.
        for (const classRow of classes) {
          if (classRow.content_type === 'linked_document' && classRow.document_id) {
            classRow.linked_document = await resolveLatestPublishedDocument(getOrgId(req), classRow.document_id);
          }
        }
        assignment.classes = classes;
      }
      res.json({
        required: assignments.filter((a) => a.assignment_type === 'required'),
        elective: assignments.filter((a) => a.assignment_type === 'elective'),
      });
    } catch (error) {
      console.error('Error building my-training view:', error);
      res.status(500).json({ success: false, error: 'Failed to build my-training view' });
    }
  });

  app.get('/api/training/electives', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const { rows: rows } = await pool.query(
        `SELECT cu.id, cu.name, cu.description, cu.field_specialty_id, fs.name AS specialty_name,
                (SELECT COUNT(*) FROM lms_classes cl WHERE cl.curriculum_id = cu.id) AS class_count,
                EXISTS(SELECT 1 FROM lms_assignments a WHERE a.curriculum_id = cu.id AND a.employee_id = $1) AS already_enrolled
         FROM lms_curricula cu
         JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE cu.type = 'elective' AND fs.organization_id = $2
         ORDER BY cu.name`,
        [employeeId, getOrgId(req)]
      );
      for (const row of rows) {
        const { rows: classes } = await pool.query(
          'SELECT id, title, content_type, has_quiz, duration_minutes, display_order, prerequisite_class_id FROM lms_classes WHERE curriculum_id = $1 ORDER BY display_order, id',
          [row.id]
        );
        row.classes = classes;
      }
      res.json(rows.map((row) => ({ ...row, already_enrolled: Boolean(row.already_enrolled) })));
    } catch (error) {
      console.error('Error listing electives:', error);
      res.status(500).json({ success: false, error: 'Failed to list electives' });
    }
  });

  app.post('/api/training/electives/:curriculumId/enroll', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const { rows: curriculumRows } = await pool.query(
        `SELECT cu.id, cu.type FROM lms_curricula cu
         JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         WHERE cu.id = $1 AND fs.organization_id = $2`,
        [req.params.curriculumId, getOrgId(req)]
      );
      const curriculum = curriculumRows[0];
      if (!curriculum) return res.status(404).json({ success: false, error: 'Curriculum not found' });
      if (curriculum.type !== 'elective') {
        return res.status(400).json({ success: false, error: 'Only elective curricula can be self-enrolled' });
      }
      const { rows: existing } = await pool.query(
        'SELECT id FROM lms_assignments WHERE employee_id = $1 AND curriculum_id = $2',
        [employeeId, req.params.curriculumId]
      );
      if (existing.length > 0) return res.status(200).json({ success: true, id: existing[0].id, already_enrolled: true });

      const { rows: userRows } = await pool.query('SELECT reports_to_id FROM users WHERE id = $1', [employeeId]);
      const resolvedDueDate = parseSqlDate(req.body?.dueDate) || addDaysStr(todayStr(), 14);

      const result = await pool.query(
        `INSERT INTO lms_assignments (employee_id, manager_id, curriculum_id, assignment_type, assigned_by_id, due_date, extensions_used)
         VALUES ($1, $2, $3, 'elective', $4, $5, 0)`,
        [employeeId, userRows[0]?.reports_to_id || null, req.params.curriculumId, employeeId, resolvedDueDate]
      );
      res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error('Error self-enrolling in elective:', error);
      res.status(500).json({ success: false, error: 'Failed to enroll' });
    }
  });

  app.get('/api/training/classes/:id', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const classRow = await assertEmployeeEnrolledInClass(employeeId, req.params.id);
      if (!classRow) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });

      const { rows: fullClassRows } = await pool.query('SELECT * FROM lms_classes WHERE id = $1', [req.params.id]);
      const fullClass = fullClassRows[0];

      const { rows: existingProgress } = await pool.query(
        'SELECT * FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2',
        [employeeId, req.params.id]
      );
      if (existingProgress.length === 0) {
        await pool.query(
          `INSERT INTO lms_class_progress (employee_id, class_id, curriculum_id, status, progress_percent)
           VALUES ($1, $2, $3, 'in_progress', 50)`,
          [employeeId, req.params.id, classRow.curriculum_id]
        );
      }
      const { rows: progressRows } = await pool.query(
        'SELECT * FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2',
        [employeeId, req.params.id]
      );
      res.json({ ...fullClass, progress: progressRows[0] });
    } catch (error) {
      console.error('Error fetching class detail:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch class' });
    }
  });

  app.post('/api/training/classes/:id/complete', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const classRow = await assertEmployeeEnrolledInClass(employeeId, req.params.id);
      if (!classRow) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });

      const blocking = await prerequisiteBlocking(employeeId, classRow);
      if (blocking) return res.status(400).json({ success: false, error: blocking });

      const { rows: existing } = await pool.query(
        'SELECT id FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2',
        [employeeId, req.params.id]
      );
      if (existing.length > 0) {
        await pool.query(
          `UPDATE lms_class_progress SET status = 'completed', progress_percent = 100, completed_date = $1 WHERE id = $2`,
          [todayStr(), existing[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO lms_class_progress (employee_id, class_id, curriculum_id, status, progress_percent, completed_date)
           VALUES ($1, $2, $3, 'completed', 100, $4)`,
          [employeeId, req.params.id, classRow.curriculum_id, todayStr()]
        );
      }
      await issueCertificateIfNeeded(employeeId, req.params.id, todayStr());
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing class:', error);
      res.status(500).json({ success: false, error: 'Failed to complete class' });
    }
  });

  const normalizeAnswerText = (value) => String(value ?? '').trim().toLowerCase();

  // pg already deserializes JSON columns into arrays/objects; this only falls back
  // to JSON.parse for the rare case a raw string comes through.
  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try { return JSON.parse(value); } catch (error) { return []; }
    }
    return [];
  };

  const isAnswerCorrect = (question, answer) => {
    if (answer === undefined || answer === null || answer === '') return false;
    if (question.question_type === 'matching') {
      const pairs = asArray(question.match_pairs);
      return Array.isArray(answer) && pairs.every((pair, index) => normalizeAnswerText(answer[index]) === normalizeAnswerText(pair.right));
    }
    return Number(answer) === question.correct_index;
  };

  app.post('/api/training/classes/:id/quiz/submit', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const classRow = await assertEmployeeEnrolledInClass(employeeId, req.params.id);
      if (!classRow) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });

      const blocking = await prerequisiteBlocking(employeeId, classRow);
      if (blocking) return res.status(400).json({ success: false, error: blocking });

      const { rows: quizRows } = await pool.query('SELECT * FROM lms_quizzes WHERE class_id = $1', [req.params.id]);
      const quiz = quizRows[0];
      if (!quiz) return res.status(404).json({ success: false, error: 'This class has no quiz' });

      if (quiz.max_attempts) {
        const { rows: [{ attemptCount }] } = await pool.query(
          'SELECT COUNT(*) AS attemptCount FROM lms_quiz_attempts WHERE employee_id = $1 AND quiz_id = $2',
          [employeeId, quiz.id]
        );
        if (attemptCount >= quiz.max_attempts) {
          return res.status(400).json({ success: false, error: 'No attempts left for this quiz' });
        }
      }

      const { rows: allQuestions } = await pool.query('SELECT * FROM lms_quiz_questions WHERE quiz_id = $1', [quiz.id]);
      const answers = req.body?.answers || {};
      // A quiz using "questions per attempt" only shows/answers a random subset of the
      // bank, so scoring must be limited to the questions actually presented this
      // attempt — otherwise every question the learner never saw counts as wrong.
      const questions = allQuestions.filter((question) => Object.prototype.hasOwnProperty.call(answers, question.id));
      const results = questions.map((question) => ({
        id: question.id,
        correct: isAnswerCorrect(question, answers[question.id]),
        correct_index: question.correct_index,
        acceptable_answers: asArray(question.acceptable_answers),
        match_pairs: asArray(question.match_pairs),
      }));
      const correctCount = results.filter((result) => result.correct).length;
      const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
      // Each question is worth 1 point; passing needs ceil(total * passing% / 100) correct
      // answers (the client's Sheet 15 rule), e.g. 80% of 5 questions = 4.
      const required = Math.ceil((questions.length * quiz.passing_score) / 100);
      const passed = questions.length > 0 && correctCount >= required;

      await pool.query(
        'INSERT INTO lms_quiz_attempts (employee_id, quiz_id, class_id, score, passed, answers) VALUES ($1, $2, $3, $4, $5, $6)',
        [employeeId, quiz.id, req.params.id, score, passed ? 1 : 0, JSON.stringify(answers)]
      );

      const { rows: existingProgress } = await pool.query(
        'SELECT * FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2',
        [employeeId, req.params.id]
      );
      const alreadyPassed = Boolean(existingProgress[0]?.quiz_passed);
      const nowPassed = passed || alreadyPassed;
      const completedDate = existingProgress[0]?.completed_date || (passed && !alreadyPassed ? todayStr() : null);

      if (existingProgress.length > 0) {
        await pool.query(
          `UPDATE lms_class_progress
           SET status = $1, progress_percent = $2, completed_date = $3, quiz_score = $4, quiz_passed = $5
           WHERE id = $6`,
          [nowPassed ? 'completed' : 'in_progress', nowPassed ? 100 : 50, completedDate, score, nowPassed ? 1 : 0, existingProgress[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO lms_class_progress (employee_id, class_id, curriculum_id, status, progress_percent, completed_date, quiz_score, quiz_passed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [employeeId, req.params.id, classRow.curriculum_id, nowPassed ? 'completed' : 'in_progress', nowPassed ? 100 : 50, completedDate, score, nowPassed ? 1 : 0]
        );
      }
      if (nowPassed) {
        const certDateStr = completedDate instanceof Date ? completedDate.toISOString().slice(0, 10) : (completedDate || todayStr());
        await issueCertificateIfNeeded(employeeId, req.params.id, certDateStr);
      }

      res.json({ score, passed, correct: correctCount, total: questions.length, required, passingScore: quiz.passing_score, results });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      res.status(500).json({ success: false, error: 'Failed to submit quiz' });
    }
  });

  // ==================== NUMBERING RULES ====================
  // Generic engine reused across entity types — today just 'field_specialty' — the same
  // pattern as the Document Admin's Numbering tab (prefix + digit length -> PREFIX-000001).

  const NUMBERING_ENTITY_TYPES = ['field_specialty', 'curriculum'];

  app.get('/api/training/numbering-rules', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { rows: rows } = await pool.query('SELECT * FROM lms_numbering_rules WHERE organization_id = $1 ORDER BY entity_type', [getOrgId(req)]);
      res.json(rows);
    } catch (error) {
      console.error('Error listing numbering rules:', error);
      res.status(500).json({ success: false, error: 'Failed to list numbering rules' });
    }
  });

  app.post('/api/training/numbering-rules', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { entity_type, prefix, digit_length, current_counter, status } = req.body || {};
      if (!NUMBERING_ENTITY_TYPES.includes(entity_type)) return res.status(400).json({ success: false, error: 'Invalid entity type' });
      const cleanPrefix = String(prefix || '').trim().toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(cleanPrefix)) return res.status(400).json({ success: false, error: 'Prefix must be 3-4 letters' });
      const digits = Number(digit_length);
      if (!(digits >= 7 && digits <= 9)) return res.status(400).json({ success: false, error: 'Digit length must be between 7 and 9' });

      const result = await pool.query(
        `INSERT INTO lms_numbering_rules (organization_id, entity_type, prefix, digit_length, current_counter, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, entity_type) DO UPDATE SET prefix = EXCLUDED.prefix, digit_length = EXCLUDED.digit_length, current_counter = EXCLUDED.current_counter, status = EXCLUDED.status RETURNING id`,
        [getOrgId(req), entity_type, cleanPrefix, digits, Math.max(0, Number(current_counter) || 0), status === 'inactive' ? 'inactive' : 'active']
      );
      res.status(201).json({ id: result.rows[0].id, success: true });
    } catch (error) {
      console.error('Error saving numbering rule:', error);
      res.status(500).json({ success: false, error: 'Failed to save numbering rule' });
    }
  });

  app.put('/api/training/numbering-rules/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      const { prefix, digit_length, current_counter, status } = req.body || {};
      const cleanPrefix = String(prefix || '').trim().toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(cleanPrefix)) return res.status(400).json({ success: false, error: 'Prefix must be 3-4 letters' });
      const digits = Number(digit_length);
      if (!(digits >= 7 && digits <= 9)) return res.status(400).json({ success: false, error: 'Digit length must be between 7 and 9' });

      const result = await pool.query(
        `UPDATE lms_numbering_rules SET prefix = $1, digit_length = $2, current_counter = $3, status = $4
         WHERE id = $5 AND organization_id = $6`,
        [cleanPrefix, digits, Math.max(0, Number(current_counter) || 0), status === 'inactive' ? 'inactive' : 'active', req.params.id, getOrgId(req)]
      );
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Numbering rule not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating numbering rule:', error);
      res.status(500).json({ success: false, error: 'Failed to update numbering rule' });
    }
  });

  app.delete('/api/training/numbering-rules/:id', authenticateToken, requireTrainingRole('administrator'), async (req, res) => {
    try {
      await pool.query('DELETE FROM lms_numbering_rules WHERE id = $1 AND organization_id = $2', [req.params.id, getOrgId(req)]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting numbering rule:', error);
      res.status(500).json({ success: false, error: 'Failed to delete numbering rule' });
    }
  });

  // ==================== RECORDS & CERTIFICATES ====================

  // Public — no auth — so a third party (employer, regulator) can verify a certificate
  // from just the validation ID printed on it.
  app.get('/api/training/certificates/verify/:validationId', async (req, res) => {
    try {
      const { rows: [cert] } = await pool.query(
        `SELECT c.issued_date, c.expiry_date, cl.title AS class_title, u.first_name, u.last_name
         FROM lms_certificates c
         JOIN lms_classes cl ON cl.id = c.class_id
         JOIN users u ON u.id = c.employee_id
         WHERE c.validation_id = $1`,
        [req.params.validationId]
      );
      if (!cert) {
        // Certificates issued from the Base44-style store (b44_records) are verified through the same URL.
        const { rows: rows } = await pool.query("SELECT data FROM b44_records WHERE entity = 'Certificate' AND data->>'validation_id' = $1 LIMIT 1", [req.params.validationId]).catch(() => [[]]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'No certificate found for this validation ID' });
        const c = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
        const expiredNew = Boolean(c.expiry_date) && new Date(c.expiry_date) < new Date();
        return res.json({ valid: !expiredNew, employee_name: c.employee_name, class_title: c.class_title, issued_date: c.issued_date, expiry_date: c.expiry_date });
      }
      const expired = Boolean(cert.expiry_date) && new Date(cert.expiry_date) < new Date();
      res.json({
        valid: !expired,
        employee_name: `${cert.first_name} ${cert.last_name}`.trim(),
        class_title: cert.class_title,
        issued_date: cert.issued_date,
        expiry_date: cert.expiry_date,
      });
    } catch (error) {
      console.error('Error verifying certificate:', error);
      res.status(500).json({ success: false, error: 'Failed to verify certificate' });
    }
  });

  // Records tab: Class Name, Class ID, Date Complete, Active — scoped per §Row 17.
  // Employee sees only their own; manager defaults to direct reports (­?scope=all for
  // everyone); administrator sees the whole organization.
  app.get('/api/training/records', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const role = req.trainingRole;
      const where = [];
      const params = [];
      if (role === 'employee') {
        where.push(`cp.employee_id = $${where.length + 1}`);
        params.push(getUserId(req));
      } else if (role === 'manager') {
        if (req.query.scope === 'all') {
          where.push(`e.organization_id = $${where.length + 1}`);
          params.push(getOrgId(req));
        } else {
          where.push(`e.reports_to_id = $${where.length + 1}`);
          params.push(getUserId(req));
        }
      } else {
        where.push(`e.organization_id = $${where.length + 1}`);
        params.push(getOrgId(req));
        if (Number(req.query.employeeId) > 0) { where.push(`e.id = $${where.length + 1}`); params.push(Number(req.query.employeeId)); }
      }

      const { rows: rows } = await pool.query(
        `SELECT cp.employee_id, e.first_name, e.last_name, cl.id AS class_id, cl.title AS class_title,
                cp.completed_date, cert.issued_date, cert.expiry_date, cert.validation_id
         FROM lms_class_progress cp
         JOIN users e ON e.id = cp.employee_id
         JOIN lms_classes cl ON cl.id = cp.class_id
         LEFT JOIN lms_certificates cert ON cert.class_id = cp.class_id AND cert.employee_id = cp.employee_id
         WHERE cp.status = 'completed' AND ${where.join(' AND ')}
         ORDER BY cp.completed_date DESC`,
        params
      );

      const dateOnly = (value) => (value ? (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)) : null);
      res.json(
        rows.map((row) => ({
          employee_id: row.employee_id,
          employee: `${row.first_name} ${row.last_name}`.trim(),
          class_id: row.class_id,
          class_name: row.class_title,
          date_complete: dateOnly(row.completed_date),
          active: !row.expiry_date || new Date(row.expiry_date) >= new Date(),
          certificate: row.validation_id
            ? { validation_id: row.validation_id, issued_date: dateOnly(row.issued_date), expiry_date: dateOnly(row.expiry_date) }
            : null,
        }))
      );
    } catch (error) {
      console.error('Error building records view:', error);
      res.status(500).json({ success: false, error: 'Failed to build records view' });
    }
  });

  // ==================== REPORTS & ANALYTICS ====================

  // Learners can send heartbeats while a class page is open; each one adds a bounded
  // number of seconds so a stuck/backgrounded tab can't inflate the time-spent log.
  app.post('/api/training/classes/:id/time', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const classRow = await assertEmployeeEnrolledInClass(employeeId, req.params.id);
      if (!classRow) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });
      const seconds = Math.min(120, Math.max(0, Math.floor(Number(req.body?.seconds) || 0)));
      if (seconds > 0) {
        await pool.query(
          'UPDATE lms_class_progress SET time_spent_seconds = time_spent_seconds + $1 WHERE employee_id = $2 AND class_id = $3',
          [seconds, employeeId, req.params.id]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error logging class time:', error);
      res.status(500).json({ success: false, error: 'Failed to log time' });
    }
  });

  app.post('/api/training/classes/:id/rating', authenticateToken, requireTrainingRole('employee', 'manager', 'administrator'), async (req, res) => {
    try {
      const employeeId = getUserId(req);
      const classRow = await assertEmployeeEnrolledInClass(employeeId, req.params.id);
      if (!classRow) return res.status(403).json({ success: false, error: 'Not enrolled in this class' });
      const rating = Math.floor(Number(req.body?.rating));
      if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      const { rows: [done] } = await pool.query(
        "SELECT id FROM lms_class_progress WHERE employee_id = $1 AND class_id = $2 AND status = 'completed'",
        [employeeId, req.params.id]
      );
      if (!done) return res.status(400).json({ success: false, error: 'Complete the class before rating it' });
      await pool.query(
        'INSERT INTO lms_class_ratings (employee_id, class_id, rating) VALUES ($1, $2, $3) ON CONFLICT (employee_id, class_id) DO UPDATE SET rating = EXCLUDED.rating',
        [employeeId, req.params.id, rating]
      );
      res.json({ success: true, rating });
    } catch (error) {
      console.error('Error saving class rating:', error);
      res.status(500).json({ success: false, error: 'Failed to save rating' });
    }
  });

  // One report payload feeds the whole Reports page: the detail rows (also what the
  // CSV/PDF export writes), the compliance summary, and the analytics sections.
  // Administrators see the whole organization; a manager only their direct reports.
  app.get('/api/training/reports', authenticateToken, requireTrainingRole('administrator', 'manager'), async (req, res) => {
    try {
      const isAdmin = req.trainingRole === 'administrator';
      const where = [];
      const params = [];
      if (isAdmin) {
        where.push(`e.organization_id = $${where.length + 1}`);
        params.push(getOrgId(req));
        if (Number(req.query.managerId) > 0) { where.push(`e.reports_to_id = $${where.length + 1}`); params.push(Number(req.query.managerId)); }
      } else {
        where.push(`e.reports_to_id = $${where.length + 1}`);
        params.push(getUserId(req));
      }
      if (Number(req.query.employeeId) > 0) { where.push(`e.id = $${where.length + 1}`); params.push(Number(req.query.employeeId)); }
      const scopeSql = where.join(' AND ');

      const { rows: rawRows } = await pool.query(
        `SELECT a.employee_id, e.first_name, e.last_name, e.email, e.reports_to_id,
                mg.first_name AS manager_first_name, mg.last_name AS manager_last_name,
                cu.name AS curriculum_name, fs.name AS specialty_name,
                cl.id AS class_id, cl.title AS class_title, cl.has_quiz, a.due_date,
                cp.status, cp.completed_date, cp.quiz_score, cp.quiz_passed, cp.time_spent_seconds,
                (SELECT COUNT(*) FROM lms_quiz_attempts qa WHERE qa.class_id = cl.id AND qa.employee_id = a.employee_id) AS attempt_count,
                (SELECT r.rating FROM lms_class_ratings r WHERE r.class_id = cl.id AND r.employee_id = a.employee_id) AS rating
         FROM lms_assignments a
         JOIN users e ON e.id = a.employee_id
         LEFT JOIN users mg ON mg.id = e.reports_to_id
         JOIN lms_curricula cu ON cu.id = a.curriculum_id
         JOIN lms_field_specialties fs ON fs.id = cu.field_specialty_id
         JOIN lms_classes cl ON cl.curriculum_id = cu.id
         LEFT JOIN lms_class_progress cp ON cp.class_id = cl.id AND cp.employee_id = a.employee_id
         WHERE ${scopeSql}
         ORDER BY e.first_name, e.last_name, cu.name, cl.display_order, cl.id`,
        params
      );

      const dateOnly = (value) => (value ? (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)) : '');
      const fullName = (first, last) => `${first || ''} ${last || ''}`.trim();
      let rows = rawRows.map((row) => ({
        employee_id: row.employee_id,
        employee: fullName(row.first_name, row.last_name) || row.email,
        email: row.email,
        manager_id: row.reports_to_id,
        manager: fullName(row.manager_first_name, row.manager_last_name),
        field: row.specialty_name,
        curriculum: row.curriculum_name,
        class_id: row.class_id,
        class_title: row.class_title,
        has_quiz: Boolean(row.has_quiz),
        due_date: dateOnly(row.due_date),
        status: row.status || 'not_started',
        completed_date: dateOnly(row.completed_date),
        quiz_score: row.quiz_score,
        quiz_passed: Boolean(row.quiz_passed),
        attempts: Number(row.attempt_count) || 0,
        time_spent_seconds: Number(row.time_spent_seconds) || 0,
        rating: row.rating,
      }));

      const peopleMap = new Map<any, any>();
      const managerMap = new Map<any, any>();
      rows.forEach((row) => {
        peopleMap.set(row.employee_id, { id: row.employee_id, name: row.employee });
        if (row.manager_id) managerMap.set(row.manager_id, { id: row.manager_id, name: row.manager });
      });

      const statusFilter = String(req.query.status || '');
      if (['completed', 'in_progress', 'not_started'].includes(statusFilter)) {
        rows = rows.filter((row) => row.status === statusFilter);
      }

      const completed = rows.filter((row) => row.status === 'completed').length;
      const quizTaken = rows.filter((row) => row.attempts > 0);
      const passed = quizTaken.filter((row) => row.quiz_passed).length;
      const totalSeconds = rows.reduce((sum, row) => sum + row.time_spent_seconds, 0);
      const rated = rows.filter((row) => row.rating);
      const summary = {
        total_assignments: rows.length,
        completed,
        in_progress: rows.filter((row) => row.status === 'in_progress').length,
        not_started: rows.filter((row) => row.status === 'not_started').length,
        completion_rate: rows.length ? Math.round((completed / rows.length) * 100) : 0,
        quizzes_taken: quizTaken.length,
        passed,
        failed: quizTaken.length - passed,
        pass_rate: quizTaken.length ? Math.round((passed / quizTaken.length) * 100) : 0,
        total_time_seconds: totalSeconds,
        avg_time_seconds: rows.length ? Math.round(totalSeconds / rows.length) : 0,
        avg_rating: rated.length ? Number((rated.reduce((sum, row) => sum + row.rating, 0) / rated.length).toFixed(1)) : null,
        rating_count: rated.length,
      };

      // Per-class view: where learners stall (started but not finished) and how they rate it.
      const classMap = new Map<any, any>();
      rows.forEach((row) => {
        const entry = classMap.get(row.class_id) || {
          class_id: row.class_id, class_title: row.class_title, curriculum: row.curriculum,
          assigned: 0, completed: 0, in_progress: 0, attempts: 0, time: 0, ratings: [],
        };
        entry.assigned += 1;
        if (row.status === 'completed') entry.completed += 1;
        if (row.status === 'in_progress') entry.in_progress += 1;
        entry.attempts += row.attempts;
        entry.time += row.time_spent_seconds;
        if (row.rating) entry.ratings.push(row.rating);
        classMap.set(row.class_id, entry);
      });
      const classStats = [...classMap.values()].map((entry) => ({
        class_id: entry.class_id,
        class_title: entry.class_title,
        curriculum: entry.curriculum,
        assigned: entry.assigned,
        completed: entry.completed,
        in_progress: entry.in_progress,
        stuck_rate: entry.assigned ? Math.round((entry.in_progress / entry.assigned) * 100) : 0,
        avg_attempts: entry.assigned ? Number((entry.attempts / entry.assigned).toFixed(1)) : 0,
        avg_time_seconds: entry.assigned ? Math.round(entry.time / entry.assigned) : 0,
        avg_rating: entry.ratings.length ? Number((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length).toFixed(1)) : null,
      })).sort((a, b) => b.stuck_rate - a.stuck_rate);

      // Per-question view: re-score each stored attempt so we can show which questions
      // learners miss most and which they leave blank (or run out of time on).
      const scopedEmployeeIds = [...new Set<any>(rows.map((row) => row.employee_id))];
      let questionStats = [];
      if (scopedEmployeeIds.length > 0) {
        const { rows: attempts } = await pool.query(
          'SELECT class_id, answers FROM lms_quiz_attempts WHERE employee_id = ANY($1)',
          [scopedEmployeeIds]
        );
        const attemptClassIds = [...new Set<any>(attempts.map((row) => row.class_id))];
        if (attemptClassIds.length > 0) {
          const { rows: questionRows } = await pool.query(
            `SELECT qq.*, q.class_id, cl.title AS class_title FROM lms_quiz_questions qq
             JOIN lms_quizzes q ON q.id = qq.quiz_id
             JOIN lms_classes cl ON cl.id = q.class_id
             WHERE q.class_id = ANY($1)`,
            [attemptClassIds]
          );
          const stat = new Map<any, any>(questionRows.map((question) => [question.id, { question, seen: 0, wrong: 0, skipped: 0 }]));
          const questionsByClass = new Map<any, any>();
          questionRows.forEach((question) => {
            questionsByClass.set(question.class_id, [...(questionsByClass.get(question.class_id) || []), question]);
          });
          attempts.forEach((attempt) => {
            const stored = typeof attempt.answers === 'string' ? JSON.parse(attempt.answers || '{}') : (attempt.answers || {});
            (questionsByClass.get(attempt.class_id) || []).forEach((question) => {
              if (!Object.prototype.hasOwnProperty.call(stored, question.id)) return;
              const entry = stat.get(question.id);
              const answer = stored[question.id];
              entry.seen += 1;
              if (answer === null || answer === undefined || answer === '') entry.skipped += 1;
              if (!isAnswerCorrect(question, answer)) entry.wrong += 1;
            });
          });
          questionStats = [...stat.values()]
            .filter((entry) => entry.seen > 0)
            .map((entry) => ({
              question_id: entry.question.id,
              class_title: entry.question.class_title,
              question: entry.question.question,
              answered: entry.seen,
              wrong_rate: Math.round((entry.wrong / entry.seen) * 100),
              skip_rate: Math.round((entry.skipped / entry.seen) * 100),
            }))
            .sort((a, b) => b.wrong_rate - a.wrong_rate || b.skip_rate - a.skip_rate)
            .slice(0, 15);
        }
      }

      res.json({
        rows,
        summary,
        classStats,
        questionStats,
        people: [...peopleMap.values()],
        managers: isAdmin ? [...managerMap.values()] : [],
      });
    } catch (error) {
      console.error('Error building report:', error);
      res.status(500).json({ success: false, error: 'Failed to build report' });
    }
  });

  // ==================== AUTOMATED RETRAINING ====================
  // A class with a retraining_interval_months set "expires" that many months after an
  // employee completed it — reopening it (back to in_progress, cleared score/date) so
  // they have to go through it again. Runs once at boot, then once a day.
  async function runRetrainingCheck() {
    try {
      const result = await pool.query(`
        UPDATE lms_class_progress AS cp
        SET status = 'in_progress', progress_percent = 50, completed_date = NULL, quiz_score = NULL, quiz_passed = false
        FROM lms_classes AS cl
        WHERE cl.id = cp.class_id
          AND cp.status = 'completed'
          AND cl.retraining_interval_months IS NOT NULL
          AND cp.completed_date <= (CURRENT_DATE - make_interval(months => cl.retraining_interval_months))
      `);
      if (result.rowCount > 0) console.log(`🔁 Retraining triggered for ${result.rowCount} completed class(es)`);
    } catch (error) {
      console.error('Error running retraining check:', error);
    }
  }
  runRetrainingCheck();
  setInterval(runRetrainingCheck, 24 * 60 * 60 * 1000);

  // Generic entity store for the Base44 SkillStream admin screens (frontend/src/base44training).
  registerB44Entities({ app, pool, authenticateToken, upload, uploadsDir, fs, path, effectiveTrainingRole });
};

export { effectiveTrainingRole, parseSqlDate };
