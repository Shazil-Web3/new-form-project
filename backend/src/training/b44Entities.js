// Generic entity store backing the copied Base44 "SkillStream" admin screens
// (frontend/src/base44training). Base44 entities are schema-less JSON records with
// list / filter / create / update / delete / bulk helpers, so they are kept in one table
// (b44_records) and filtered in Node with the same Mongo-style operators the Base44 SDK
// supports ($in, $ne, $nin, $gt/$gte/$lt/$lte, $exists, $or, $and).
// Also hosts the file upload used by "UploadPublicFile" and the daily purge of
// classes that have been in the trash for 30+ days (Base44 workflow "Auto Purge Trashed Classes").

const crypto = require('crypto');

const PURGE_DAYS = 30;
const ENTITY_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const looseEquals = (a, b) => {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (isObject(a) || isObject(b) || Array.isArray(a) || Array.isArray(b)) return false;
  return String(a) === String(b);
};

const compare = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
};

const matchField = (value, cond) => {
  if (isObject(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case '$in': return (arg || []).some((x) => (Array.isArray(value) ? value.some((v) => looseEquals(v, x)) : looseEquals(value, x)));
        case '$nin': return !(arg || []).some((x) => looseEquals(value, x));
        case '$ne': return !looseEquals(value, arg);
        case '$eq': return looseEquals(value, arg);
        case '$gt': return value !== null && value !== undefined && compare(value, arg) > 0;
        case '$gte': return value !== null && value !== undefined && compare(value, arg) >= 0;
        case '$lt': return value !== null && value !== undefined && compare(value, arg) < 0;
        case '$lte': return value !== null && value !== undefined && compare(value, arg) <= 0;
        case '$exists': return arg ? value !== undefined && value !== null : value === undefined || value === null;
        default: return true;
      }
    });
  }
  if (Array.isArray(value) && !Array.isArray(cond)) return value.some((v) => looseEquals(v, cond));
  return looseEquals(value, cond);
};

const matches = (record, query) => {
  if (!isObject(query)) return true;
  return Object.entries(query).every(([key, cond]) => {
    if (key === '$or') return (cond || []).some((q) => matches(record, q));
    if (key === '$and') return (cond || []).every((q) => matches(record, q));
    return matchField(record[key], cond);
  });
};

const sortRecords = (records, sort) => {
  if (!sort || typeof sort !== 'string') return records;
  const desc = sort.startsWith('-');
  const field = sort.replace(/^[-+]/, '');
  return [...records].sort((a, b) => (desc ? -1 : 1) * compare(a[field], b[field]));
};

// ---- quiz helpers: students never receive answers, the server grades ----
const normalizeText = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Deterministic shuffle (seeded by the question id) so the server can rebuild the same permutation when grading.
const seededPermutation = (n, seedText) => {
  let h = 1779033703 ^ String(seedText).length;
  for (let i = 0; i < String(seedText).length; i += 1) {
    h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  if (n > 1 && perm.every((v, i) => v === i)) perm.push(perm.shift()); // never leave the pairs in answer order
  return perm;
};

// What a student is allowed to see of a quiz question: no answer key; matching rights are permuted.
const questionForStudent = (q) => {
  const { correct_index, acceptable_answers, ...rest } = q;
  if (Array.isArray(rest.match_pairs) && rest.match_pairs.length > 1) {
    const perm = seededPermutation(rest.match_pairs.length, q.id);
    rest.match_pairs = rest.match_pairs.map((pair, j) => ({ ...pair, right: q.match_pairs[perm[j]]?.right }));
  }
  return rest;
};

const isAnswerCorrect = (q, a) => {
  const type = q.question_type || 'multiple_choice';
  if (type === 'multiple_choice' || type === 'true_false' || type === 'fill_blank_choice') return a === q.correct_index;
  if (type === 'fill_blank') {
    const got = normalizeText(a);
    return got !== '' && (q.acceptable_answers || []).some((ans) => normalizeText(ans) === got);
  }
  if (type === 'matching') {
    const pairs = q.match_pairs || [];
    const perm = pairs.length > 1 ? seededPermutation(pairs.length, q.id) : pairs.map((_, i) => i);
    return pairs.length > 0 && pairs.every((_, i) => a && a[i] !== undefined && a[i] !== null && perm[a[i]] === i);
  }
  return false;
};

module.exports = function registerB44Entities({ app, pool, authenticateToken, upload, uploadsDir, fs, path, effectiveTrainingRole }) {
  const getOrgId = (req) => req.user?.organization_id || req.user?.orgId || 1;

  const ready = pool.query(`
    CREATE TABLE IF NOT EXISTS \`b44_records\` (
      \`id\` varchar(36) NOT NULL,
      \`organization_id\` int NOT NULL,
      \`entity\` varchar(64) NOT NULL,
      \`data\` json NOT NULL,
      \`created_by\` varchar(255) NULL,
      \`created_date\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_date\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`idx_b44_org_entity\` (\`organization_id\`, \`entity\`)
    )
  `).catch((e) => console.error('Failed to create b44_records table:', e));

  const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

  const toRecord = (row) => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    return { ...data, id: row.id, created_by: row.created_by, created_date: iso(row.created_date), updated_date: iso(row.updated_date) };
  };

  // Strips the server-managed keys before the payload is stored.
  const cleanData = (payload) => {
    const { id, created_date, updated_date, created_by, ...rest } = payload || {};
    return rest;
  };

  const loadAll = async (orgId, entity) => {
    await ready;
    const [rows] = await pool.query('SELECT * FROM b44_records WHERE organization_id = ? AND entity = ?', [orgId, entity]);
    return rows.map(toRecord);
  };

  // Field specialties and curriculums get their code (PREFIX-000001) from the active rule set on the
  // Numbering Rules page (lms_numbering_rules), exactly like the earlier catalog did. No rule = no code.
  const NUMBERED_ENTITIES = { FieldSpecialty: 'field_specialty', Curriculum: 'curriculum' };

  // The counter is bumped with LAST_INSERT_ID(counter + 1) on ONE connection, so two requests creating records at
  // the same moment can never read the same number.
  async function allocateNumberingCode(orgId, entityType) {
    let conn;
    try {
      conn = await pool.getConnection();
      const [result] = await conn.query(
        "UPDATE lms_numbering_rules SET current_counter = LAST_INSERT_ID(current_counter + 1) WHERE organization_id = ? AND entity_type = ? AND status = 'active'",
        [orgId, entityType]
      );
      if (result.affectedRows === 0) return null;
      const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
      const [[rule]] = await conn.query('SELECT prefix, digit_length FROM lms_numbering_rules WHERE organization_id = ? AND entity_type = ?', [orgId, entityType]);
      if (!rule) return null;
      return `${rule.prefix}-${String(n).padStart(rule.digit_length, '0')}`;
    } catch (error) {
      console.error('Numbering rule lookup failed:', error.message);
      return null;
    } finally {
      if (conn) conn.release();
    }
  }

  // ---- certificates: issued once per (employee, class) when a class is completed ----
  const addDaysStr = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // A class copy uses its own setting; if the copy has none stored (older copies) fall back to its library class.
  const classSetting = async (orgId, cls, field) => {
    if (cls[field] !== undefined) return cls[field];
    if (cls.library_class_id) {
      const [[row]] = await pool.query("SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = 'Class'", [cls.library_class_id, orgId]);
      if (row) return toRecord(row)[field];
    }
    return undefined;
  };

  async function issueCertificateIfNeeded(orgId, progress) {
    try {
      const [[classRow]] = await pool.query("SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = 'Class'", [progress.class_id, orgId]);
      if (!classRow) return;
      const cls = toRecord(classRow);
      const existing = (await loadAll(orgId, 'Certificate')).find((c) => String(c.employee_id) === String(progress.employee_id) && String(c.class_id) === String(progress.class_id));
      if (existing) return;
      const issued = progress.completed_date || new Date().toISOString().slice(0, 10);
      const months = Number(await classSetting(orgId, cls, 'certificate_validity_months')) || 0;
      const [[u]] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ?', [progress.employee_id]);
      const name = u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email) : String(progress.employee_id);
      await insertRecord(orgId, 'Certificate', {
        employee_id: String(progress.employee_id),
        employee_name: name,
        class_id: progress.class_id,
        class_title: cls.title,
        validation_id: crypto.randomUUID(),
        issued_date: issued,
        expiry_date: months > 0 ? addDaysStr(issued, months * 30) : null,
      }, null);
    } catch (error) {
      console.error('Certificate issue failed:', error.message);
    }
  }

  // Runs after every write (insert or update) made through this store.
  async function afterWrite(orgId, entity, record) {
    if (entity === 'ClassProgress' && record.status === 'completed') await issueCertificateIfNeeded(orgId, record);
  }

  const insertRecord = async (orgId, entity, payload, email) => {
    const id = crypto.randomUUID();
    if (NUMBERED_ENTITIES[entity] && !(payload && payload.code)) {
      const code = await allocateNumberingCode(orgId, NUMBERED_ENTITIES[entity]);
      if (code) payload = { ...payload, code };
    }
    await pool.query(
      'INSERT INTO b44_records (id, organization_id, entity, data, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, orgId, entity, JSON.stringify(cleanData(payload)), email || null]
    );
    const [[row]] = await pool.query('SELECT * FROM b44_records WHERE id = ?', [id]);
    const record = toRecord(row);
    await afterWrite(orgId, entity, record);
    return record;
  };

  const mergeRecord = async (orgId, entity, id, patch) => {
    await ready;
    const [[row]] = await pool.query('SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = ?', [id, orgId, entity]);
    if (!row) return null;
    const merged = { ...toRecord(row), ...cleanData(patch) };
    await pool.query('UPDATE b44_records SET data = ?, updated_date = CURRENT_TIMESTAMP(3) WHERE id = ?', [JSON.stringify(cleanData(merged)), id]);
    const [[fresh]] = await pool.query('SELECT * FROM b44_records WHERE id = ?', [id]);
    const record = toRecord(fresh);
    await afterWrite(orgId, entity, record);
    return record;
  };

  // `{ $set: {...} }` (Mongo style) or plain fields.
  const updateFields = (update) => (isObject(update) && isObject(update.$set) ? update.$set : update);

  // ---- access rules (who may read / write which entity) ----
  // Roles come from the site role: administrator, manager, employee (student).
  const ALL = ['administrator', 'manager', 'employee'];
  const STAFF = ['administrator', 'manager'];
  const ADMIN = ['administrator'];
  const POLICY = {
    // catalog: everybody browses it, admin builds it, manager approves/changes it
    FieldSpecialty: { read: ALL, write: STAFF },
    Curriculum: { read: ALL, write: STAFF },
    Class: { read: ALL, write: STAFF },
    Quiz: { read: ALL, write: STAFF },
    QuizQuestion: { read: ALL, write: STAFF }, // answers are hidden from students in phase 2 (server-side grading)
    // approval workflow + history: staff only
    PublishRequest: { read: STAFF, write: STAFF },
    ArchiveRequest: { read: STAFF, write: STAFF },
    ChangeRequest: { read: STAFF, write: STAFF },
    LibraryBatch: { read: STAFF, write: STAFF },
    LibraryBatchReview: { read: STAFF, write: STAFF },
    ClassRevision: { read: STAFF, write: STAFF },
    CurriculumRevision: { read: STAFF, write: STAFF },
    CurriculumRename: { read: STAFF, write: STAFF },
    // training matrices: staff read, admin edits
    TrainingMatrix: { read: STAFF, write: ADMIN },
    MatrixItem: { read: STAFF, write: ADMIN },
    // per-employee rows (employee_id): student = own, manager = own + direct reports, admin = all
    Assignment: { scoped: true },
    ClassProgress: { scoped: true },
    QuizAttempt: { scoped: true },
    Certificate: { scoped: true }, // written by the server when a class is completed
    ClassRating: { scoped: true }, // written through POST /api/b44/classes/:classId/rating
  };
  const policyFor = (entity) => POLICY[entity] || { read: ADMIN, write: ADMIN }; // unknown entity: admin only

  const getRole = (req) => effectiveTrainingRole(req.user?.role);

  // Per-request context: role, own id and (for managers) the ids of direct reports.
  const getCtx = async (req) => {
    if (req._b44ctx) return req._b44ctx;
    const role = getRole(req);
    const me = String(req.user?.userId);
    let team = new Set();
    if (role === 'manager') {
      const [rows] = await pool.query('SELECT id FROM users WHERE reports_to_id = ? AND organization_id = ?', [req.user.userId, getOrgId(req)]);
      team = new Set(rows.map((r) => String(r.id)));
    }
    req._b44ctx = { role, me, team };
    return req._b44ctx;
  };

  const ownsRow = (ctx, employeeId) => {
    if (ctx.role === 'administrator') return true;
    const id = employeeId === undefined || employeeId === null ? '' : String(employeeId);
    if (id === ctx.me) return true;
    return ctx.role === 'manager' && ctx.team.has(id);
  };

  // action: 'read' | 'create' | 'update' | 'delete'. `record` is the stored row (read/update/delete) or the new payload (create).
  const allowed = (ctx, entity, action, record) => {
    const pol = policyFor(entity);
    if (pol.scoped) {
      if (action === 'delete' && ctx.role === 'employee') return false;
      if (entity === 'Certificate' && action !== 'read') return ctx.role === 'administrator';
      if (action === 'create' && entity === 'Assignment' && ctx.role === 'employee') {
        return String(record.employee_id) === ctx.me && record.assignment_type === 'elective'; // students can only self-enrol in electives
      }
      return ownsRow(ctx, record.employee_id);
    }
    const roles = action === 'read' ? pol.read : pol.write;
    return roles.includes(ctx.role);
  };

  const forbid = (res) => res.status(403).json({ error: 'Access denied for your role' });

  // Students get quiz questions without the answer key.
  const forRole = (ctx, entity, record) => (entity === 'QuizQuestion' && ctx.role === 'employee' ? questionForStudent(record) : record);

  const classHasQuiz = async (orgId, classId) => {
    if (!classId) return false;
    const quizzes = (await loadAll(orgId, 'Quiz')).filter((q) => String(q.class_id) === String(classId));
    if (quizzes.length === 0) return false;
    const ids = new Set(quizzes.map((q) => q.id));
    return (await loadAll(orgId, 'QuizQuestion')).some((q) => ids.has(q.quiz_id));
  };

  // Students cannot forge quiz results: attempts are written by the server only, and a class that has
  // a quiz cannot be marked completed / given a score through the generic API.
  const studentWriteOk = async (req, ctx, entity, fields, existing) => {
    if (ctx.role !== 'employee') return true;
    if (entity === 'QuizAttempt' || entity === 'ClassRating') return false;
    if (entity === 'ClassProgress') {
      if (fields && (fields.quiz_score !== undefined || fields.quiz_passed !== undefined)) return false;
      if (fields && fields.status === 'completed') {
        const classId = (fields.class_id !== undefined ? fields.class_id : existing?.class_id);
        if (await classHasQuiz(getOrgId(req), classId)) return false;
      }
    }
    return true;
  };

  // Duplicate rules for classes (returns an error message, or null when the write is fine):
  //  1. a library class (no library_class_id, no curriculum_id) must have a unique title;
  //  2. a curriculum can hold a given library class only once, and only a library class (not a copy) can be placed.
  // `batch` = records of the same request that are not stored yet; `selfId` = the record being updated.
  const normTitle = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const classConflict = async (orgId, record, selfId, batch = []) => {
    if (record.trashed_at) return null; // trashing never conflicts; restoring is checked like a new write
    const all = [...(await loadAll(orgId, 'Class')), ...batch].filter((c) => c.id !== selfId && !c.trashed_at);
    if (record.library_class_id) {
      const master = all.find((c) => c.id === record.library_class_id);
      if (master && (master.library_class_id || master.curriculum_id)) return 'Only a library class can be placed in a curriculum';
      if (record.curriculum_id && all.some((c) => c.library_class_id === record.library_class_id && c.curriculum_id === record.curriculum_id)) {
        return 'This class is already in that curriculum';
      }
      return null;
    }
    if (!record.curriculum_id) {
      const title = normTitle(record.title);
      if (title && all.some((c) => !c.library_class_id && !c.curriculum_id && normTitle(c.title) === title)) {
        return 'A class with this name already exists in the library';
      }
    }
    return null;
  };

  // A student may not move a row to another employee when updating it.
  const patchOk =(ctx, entity, patch) => !(policyFor(entity).scoped && ctx.role === 'employee' && patch && patch.employee_id !== undefined && String(patch.employee_id) !== ctx.me);

  const validEntity = (req, res, next) => {
    if (!ENTITY_PATTERN.test(req.params.entity)) return res.status(400).json({ error: 'Invalid entity name' });
    next();
  };

  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(`b44 ${req.method} ${req.originalUrl} failed:`, error);
      res.status(500).json({ error: 'Request failed' });
    }
  };

  const base = '/api/b44/entities/:entity';

  app.post(`${base}/query`, authenticateToken, validEntity, wrap(async (req, res) => {
    const { query, sort, limit, skip } = req.body || {};
    const ctx = await getCtx(req);
    let records = (await loadAll(getOrgId(req), req.params.entity)).filter((r) => allowed(ctx, req.params.entity, 'read', r) && matches(r, query));
    records = sortRecords(records, sort || '-created_date');
    const start = Number(skip) || 0;
    records = records.slice(start, Number(limit) > 0 ? start + Number(limit) : undefined);
    res.json(records.map((r) => forRole(ctx, req.params.entity, r)));
  }));

  app.post(`${base}/count`, authenticateToken, validEntity, wrap(async (req, res) => {
    const ctx = await getCtx(req);
    const records = (await loadAll(getOrgId(req), req.params.entity)).filter((r) => allowed(ctx, req.params.entity, 'read', r) && matches(r, req.body?.query));
    res.json({ count: records.length });
  }));

  app.post(`${base}/aggregate`, authenticateToken, validEntity, wrap(async (req, res) => {
    const { query, groupBy } = req.body || {};
    const ctx = await getCtx(req);
    const records = (await loadAll(getOrgId(req), req.params.entity)).filter((r) => allowed(ctx, req.params.entity, 'read', r) && matches(r, query));
    if (!groupBy) return res.json({ rows: [{ count: records.length }] });
    const groups = new Map();
    records.forEach((r) => groups.set(r[groupBy], (groups.get(r[groupBy]) || 0) + 1));
    res.json({ rows: [...groups.entries()].map(([value, count]) => ({ [groupBy]: value, count })) });
  }));

  app.post(`${base}/bulk`, authenticateToken, validEntity, wrap(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const ctx = await getCtx(req);
    if (!items.every((item) => allowed(ctx, req.params.entity, 'create', item || {}))) return forbid(res);
    for (const item of items) if (!(await studentWriteOk(req, ctx, req.params.entity, item || {}, null))) return forbid(res);
    if (req.params.entity === 'Class') {
      const pending = [];
      for (const item of items) {
        const conflict = await classConflict(getOrgId(req), item || {}, null, pending);
        if (conflict) return res.status(409).json({ error: conflict, code: 'DUPLICATE_CLASS' });
        pending.push(item || {});
      }
    }
    const created = [];
    for (const item of items) created.push(await insertRecord(getOrgId(req), req.params.entity, item, req.user?.email));
    res.status(201).json(created);
  }));

  app.post(`${base}/bulk-update`, authenticateToken, validEntity, wrap(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const ctx = await getCtx(req);
    const existing = await loadAll(getOrgId(req), req.params.entity);
    const byId = new Map(existing.map((r) => [r.id, r]));
    if (!items.every((item) => !item?.id || !byId.has(item.id) || (allowed(ctx, req.params.entity, 'update', byId.get(item.id)) && patchOk(ctx, req.params.entity, item)))) return forbid(res);
    for (const item of items) if (item?.id && byId.has(item.id) && !(await studentWriteOk(req, ctx, req.params.entity, item, byId.get(item.id)))) return forbid(res);
    const updated = [];
    for (const item of items) {
      if (!item?.id) continue;
      const record = await mergeRecord(getOrgId(req), req.params.entity, item.id, item);
      if (record) updated.push(record);
    }
    res.json(updated);
  }));

  app.post(`${base}/update-many`, authenticateToken, validEntity, wrap(async (req, res) => {
    const { query, update } = req.body || {};
    const ctx = await getCtx(req);
    const targets = (await loadAll(getOrgId(req), req.params.entity)).filter((r) => matches(r, query));
    if (!targets.every((r) => allowed(ctx, req.params.entity, 'update', r)) || !patchOk(ctx, req.params.entity, updateFields(update))) return forbid(res);
    for (const target of targets) if (!(await studentWriteOk(req, ctx, req.params.entity, updateFields(update), target))) return forbid(res);
    for (const target of targets) await mergeRecord(getOrgId(req), req.params.entity, target.id, updateFields(update));
    res.json({ updated: targets.length });
  }));

  app.post(`${base}/delete-many`, authenticateToken, validEntity, wrap(async (req, res) => {
    const ctx = await getCtx(req);
    const targets = (await loadAll(getOrgId(req), req.params.entity)).filter((r) => matches(r, req.body?.query));
    if (!targets.every((r) => allowed(ctx, req.params.entity, 'delete', r))) return forbid(res);
    for (const target of targets) await pool.query('DELETE FROM b44_records WHERE id = ?', [target.id]);
    res.json({ deleted: targets.length });
  }));

  app.post(base, authenticateToken, validEntity, wrap(async (req, res) => {
    await ready;
    const ctx = await getCtx(req);
    if (!allowed(ctx, req.params.entity, 'create', req.body || {}) || !(await studentWriteOk(req, ctx, req.params.entity, req.body || {}, null))) return forbid(res);
    if (req.params.entity === 'Class') {
      const conflict = await classConflict(getOrgId(req), req.body || {}, null);
      if (conflict) return res.status(409).json({ error: conflict, code: 'DUPLICATE_CLASS' });
    }
    res.status(201).json(await insertRecord(getOrgId(req), req.params.entity, req.body || {}, req.user?.email));
  }));

  app.get(`${base}/:id`, authenticateToken, validEntity, wrap(async (req, res) => {
    await ready;
    const [[row]] = await pool.query('SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = ?', [req.params.id, getOrgId(req), req.params.entity]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const ctx = await getCtx(req);
    if (!allowed(ctx, req.params.entity, 'read', toRecord(row))) return forbid(res);
    res.json(forRole(ctx, req.params.entity, toRecord(row)));
  }));

  app.put(`${base}/:id`, authenticateToken, validEntity, wrap(async (req, res) => {
    const ctx = await getCtx(req);
    const [[row]] = await pool.query('SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = ?', [req.params.id, getOrgId(req), req.params.entity]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!allowed(ctx, req.params.entity, 'update', toRecord(row)) || !patchOk(ctx, req.params.entity, req.body) || !(await studentWriteOk(req, ctx, req.params.entity, req.body || {}, toRecord(row)))) return forbid(res);
    if (req.params.entity === 'Class' && req.body && ('title' in req.body || 'trashed_at' in req.body || 'library_class_id' in req.body || 'curriculum_id' in req.body)) {
      const conflict = await classConflict(getOrgId(req), { ...toRecord(row), ...req.body }, req.params.id);
      if (conflict) return res.status(409).json({ error: conflict, code: 'DUPLICATE_CLASS' });
    }
    const record = await mergeRecord(getOrgId(req), req.params.entity, req.params.id, req.body || {});
    res.json(record);
  }));

  app.delete(`${base}/:id`, authenticateToken, validEntity, wrap(async (req, res) => {
    await ready;
    const ctx = await getCtx(req);
    const [[row]] = await pool.query('SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = ?', [req.params.id, getOrgId(req), req.params.entity]);
    if (!row) return res.json({ success: true });
    if (!allowed(ctx, req.params.entity, 'delete', toRecord(row))) return forbid(res);
    await pool.query('DELETE FROM b44_records WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  }));

  // ---- quiz submission: the server grades, stores the attempt and updates progress ----
  app.post('/api/b44/quiz/:classId/submit', authenticateToken, wrap(async (req, res) => {
    const orgId = getOrgId(req);
    const me = String(req.user.userId);
    const classId = req.params.classId;
    const answers = (req.body && req.body.answers) || {};
    await ready;
    const [[classRow]] = await pool.query("SELECT * FROM b44_records WHERE id = ? AND organization_id = ? AND entity = 'Class'", [classId, orgId]);
    if (!classRow) return res.status(404).json({ error: 'Class not found' });
    const cls = toRecord(classRow);
    const quiz = (await loadAll(orgId, 'Quiz')).find((q) => String(q.class_id) === String(classId));
    const questions = quiz ? (await loadAll(orgId, 'QuizQuestion')).filter((q) => q.quiz_id === quiz.id).sort((a, b) => String(a.created_date).localeCompare(String(b.created_date))) : [];
    if (!quiz || questions.length === 0) return res.status(400).json({ error: 'No quiz has been set up for this class' });

    let correct = 0;
    const answerArr = [];
    for (const q of questions) {
      const type = q.question_type || 'multiple_choice';
      const a = answers[q.id];
      if (type === 'multiple_choice' || type === 'true_false' || type === 'fill_blank_choice') answerArr.push(a ?? -1);
      else if (type === 'fill_blank') answerArr.push(a ?? '');
      else if (type === 'matching') answerArr.push(a ?? {});
      if (isAnswerCorrect(q, a)) correct += 1;
    }
    const passingScore = quiz.passing_score ?? 70;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= passingScore;

    const answersByQuestion = {};
    questions.forEach((q) => { answersByQuestion[q.id] = answers[q.id] ?? null; });
    await insertRecord(orgId, 'QuizAttempt', { employee_id: me, quiz_id: quiz.id, class_id: classId, score, passed, answers: answerArr, answers_by_question: answersByQuestion }, req.user.email);

    const fields = {
      status: passed ? 'completed' : 'in_progress',
      progress_percent: passed ? 100 : 50,
      completed_date: passed ? new Date().toISOString().split('T')[0] : null,
      quiz_score: score,
      quiz_passed: passed,
    };
    const existing = (await loadAll(orgId, 'ClassProgress')).find((p) => String(p.employee_id) === me && String(p.class_id) === String(classId));
    if (existing) await mergeRecord(orgId, 'ClassProgress', existing.id, fields);
    else await insertRecord(orgId, 'ClassProgress', { employee_id: me, class_id: classId, class_name: cls.title, curriculum_id: cls.curriculum_id, ...fields }, req.user.email);

    res.json({ score, passed, correct, total: questions.length, passing_score: passingScore });
  }));

  // ---- class rating: only after the class is completed, one rating per (employee, class) ----
  app.post('/api/b44/classes/:classId/rating', authenticateToken, wrap(async (req, res) => {
    const orgId = getOrgId(req);
    const me = String(req.user.userId);
    const rating = Math.floor(Number(req.body?.rating));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const done = (await loadAll(orgId, 'ClassProgress')).find((p) => String(p.employee_id) === me && String(p.class_id) === String(req.params.classId) && p.status === 'completed');
    if (!done) return res.status(400).json({ error: 'Complete the class before rating it' });
    const existing = (await loadAll(orgId, 'ClassRating')).find((r) => String(r.employee_id) === me && String(r.class_id) === String(req.params.classId));
    if (existing) await mergeRecord(orgId, 'ClassRating', existing.id, { rating });
    else await insertRecord(orgId, 'ClassRating', { employee_id: me, class_id: req.params.classId, rating }, req.user.email);
    res.json({ success: true, rating });
  }));

  // Public (no login) so a third party can verify a certificate from the validation ID printed on it.
  app.get('/api/b44/certificates/verify/:validationId', wrap(async (req, res) => {
    await ready;
    const [rows] = await pool.query("SELECT * FROM b44_records WHERE entity = 'Certificate' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.validation_id')) = ? LIMIT 1", [req.params.validationId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'No certificate found for this validation ID' });
    const cert = toRecord(rows[0]);
    const expired = Boolean(cert.expiry_date) && new Date(cert.expiry_date) < new Date();
    res.json({ valid: !expired, employee_name: cert.employee_name, class_title: cert.class_title, issued_date: cert.issued_date, expiry_date: cert.expiry_date });
  }));

  // ---- time spent on a class (heartbeats from the class page, bounded so a stuck tab cannot inflate it) ----
  app.post('/api/b44/classes/:classId/time', authenticateToken, wrap(async (req, res) => {
    const orgId = getOrgId(req);
    const me = String(req.user.userId);
    const seconds = Math.min(120, Math.max(0, Math.floor(Number(req.body?.seconds) || 0)));
    if (seconds > 0) {
      const progress = (await loadAll(orgId, 'ClassProgress')).find((p) => String(p.employee_id) === me && String(p.class_id) === String(req.params.classId));
      if (progress) await mergeRecord(orgId, 'ClassProgress', progress.id, { time_spent_seconds: (Number(progress.time_spent_seconds) || 0) + seconds });
    }
    res.json({ success: true });
  }));

  // ---- automated retraining ----
  // A class with a retraining interval "expires" that many months after an employee completed it: the progress
  // goes back to in_progress with score and completion date cleared, so they train again. Runs at boot, then daily.
  const addMonthsStr = (dateStr, months) => {
    const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  async function runRetrainingForOrg(orgId, todayStr = new Date().toISOString().slice(0, 10)) {
    const classes = new Map((await loadAll(orgId, 'Class')).map((c) => [c.id, c]));
    const progressRows = (await loadAll(orgId, 'ClassProgress')).filter((p) => p.status === 'completed' && p.completed_date);
    let reopened = 0;
    for (const progress of progressRows) {
      const cls = classes.get(progress.class_id);
      if (!cls) continue;
      const months = Number(await classSetting(orgId, cls, 'retraining_interval_months')) || 0;
      if (months <= 0) continue;
      if (addMonthsStr(progress.completed_date, months) <= todayStr) {
        await mergeRecord(orgId, 'ClassProgress', progress.id, { status: 'in_progress', progress_percent: 50, completed_date: null, quiz_score: null, quiz_passed: false });
        reopened += 1;
      }
    }
    return reopened;
  }

  async function runRetrainingCheck() {
    try {
      await ready;
      const [orgs] = await pool.query("SELECT DISTINCT organization_id FROM b44_records WHERE entity = 'ClassProgress'");
      let total = 0;
      for (const { organization_id: orgId } of orgs) total += await runRetrainingForOrg(orgId);
      if (total > 0) console.log(`🔁 Retraining triggered for ${total} completed class(es)`);
    } catch (error) {
      console.error('Error running retraining check:', error);
    }
  }
  runRetrainingCheck();
  setInterval(runRetrainingCheck, 24 * 60 * 60 * 1000);

  // Admin can run the check on demand (also used for testing). Optional body { today: 'YYYY-MM-DD' }.
  app.post('/api/b44/retraining/run', authenticateToken, wrap(async (req, res) => {
    if (getRole(req) !== 'administrator') return forbid(res);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.today || '') ? req.body.today : undefined;
    res.json({ reopened: await runRetrainingForOrg(getOrgId(req), today) });
  }));

  // ---- Records + Reports (same JSON shapes the Records and Reports screens already consume) ----
  const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');
  const fullName = (first, last) => `${first || ''} ${last || ''}`.trim();

  const loadUsers = async (orgId) => {
    const [rows] = await pool.query('SELECT id, first_name, last_name, email, reports_to_id FROM users WHERE organization_id = ?', [orgId]);
    return rows;
  };

  app.get('/api/b44/records', authenticateToken, wrap(async (req, res) => {
    const orgId = getOrgId(req);
    const ctx = await getCtx(req);
    const users = new Map((await loadUsers(orgId)).map((u) => [String(u.id), u]));
    const classes = new Map((await loadAll(orgId, 'Class')).map((c) => [c.id, c]));
    const certs = await loadAll(orgId, 'Certificate');
    const certFor = (employeeId, classId) => certs.find((c) => String(c.employee_id) === String(employeeId) && String(c.class_id) === String(classId));
    const wantedEmployee = req.query.employeeId ? String(req.query.employeeId) : null;
    const today = new Date().toISOString().slice(0, 10);

    let progress = (await loadAll(orgId, 'ClassProgress')).filter((p) => p.status === 'completed');
    progress = progress.filter((p) => {
      const emp = users.get(String(p.employee_id));
      if (!emp) return false;
      if (ctx.role === 'employee') return String(p.employee_id) === ctx.me;
      if (ctx.role === 'manager') return req.query.scope === 'all' || String(emp.reports_to_id) === ctx.me;
      return !wantedEmployee || String(p.employee_id) === wantedEmployee;
    });
    progress.sort((a, b) => String(b.completed_date || '').localeCompare(String(a.completed_date || '')));
    res.json(progress.filter((p) => classes.has(p.class_id)).map((p) => {
      const emp = users.get(String(p.employee_id));
      const cert = certFor(p.employee_id, p.class_id);
      return {
        employee_id: p.employee_id,
        employee: fullName(emp.first_name, emp.last_name) || emp.email,
        class_id: p.class_id,
        class_name: classes.get(p.class_id).title,
        date_complete: dateOnly(p.completed_date) || null,
        active: !cert || !cert.expiry_date || String(cert.expiry_date).slice(0, 10) >= today,
        certificate: cert ? { validation_id: cert.validation_id, issued_date: dateOnly(cert.issued_date) || null, expiry_date: dateOnly(cert.expiry_date) || null } : null,
      };
    }));
  }));

  app.get('/api/b44/reports', authenticateToken, wrap(async (req, res) => {
    const orgId = getOrgId(req);
    const ctx = await getCtx(req);
    if (!STAFF.includes(ctx.role)) return forbid(res);
    const isAdmin = ctx.role === 'administrator';

    const users = await loadUsers(orgId);
    const userById = new Map(users.map((u) => [String(u.id), u]));
    let scoped = users;
    if (isAdmin) { if (req.query.managerId) scoped = scoped.filter((u) => String(u.reports_to_id) === String(req.query.managerId)); }
    else scoped = scoped.filter((u) => String(u.reports_to_id) === ctx.me);
    if (req.query.employeeId) scoped = scoped.filter((u) => String(u.id) === String(req.query.employeeId));
    const scopedIds = new Set(scoped.map((u) => String(u.id)));

    const [assignments, curriculums, specialties, classes, progressRows, attempts, ratings] = await Promise.all(
      ['Assignment', 'Curriculum', 'FieldSpecialty', 'Class', 'ClassProgress', 'QuizAttempt', 'ClassRating'].map((e) => loadAll(orgId, e))
    );
    const curById = new Map(curriculums.map((c) => [c.id, c]));
    const specById = new Map(specialties.map((c) => [c.id, c]));
    const progressKey = (e, c) => `${e}|${c}`;
    const progressMap = new Map(progressRows.map((p) => [progressKey(p.employee_id, p.class_id), p]));
    const ratingMap = new Map(ratings.map((r) => [progressKey(r.employee_id, r.class_id), r.rating]));
    const attemptCount = new Map();
    attempts.forEach((a) => attemptCount.set(progressKey(a.employee_id, a.class_id), (attemptCount.get(progressKey(a.employee_id, a.class_id)) || 0) + 1));
    const liveClassesOf = (curriculumId) => classes
      .filter((c) => String(c.curriculum_id) === String(curriculumId) && !c.trashed_at && !c.archived)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const seen = new Set();
    let rows = [];
    assignments.filter((a) => scopedIds.has(String(a.employee_id))).forEach((a) => {
      const cur = curById.get(a.curriculum_id);
      if (!cur) return;
      const spec = specById.get(cur.field_specialty_id);
      const emp = userById.get(String(a.employee_id));
      const mgr = emp && emp.reports_to_id ? userById.get(String(emp.reports_to_id)) : null;
      const classList = a.class_id ? liveClassesOf(a.curriculum_id).filter((c) => c.id === a.class_id) : liveClassesOf(a.curriculum_id);
      classList.forEach((cl) => {
        const key = progressKey(a.employee_id, cl.id);
        if (seen.has(key)) return;
        seen.add(key);
        const p = progressMap.get(key);
        rows.push({
          employee_id: a.employee_id,
          employee: fullName(emp.first_name, emp.last_name) || emp.email,
          email: emp.email,
          manager_id: emp.reports_to_id ? String(emp.reports_to_id) : null,
          manager: mgr ? fullName(mgr.first_name, mgr.last_name) : '',
          field: spec ? spec.name : '',
          curriculum: cur.name,
          class_id: cl.id,
          class_title: cl.title,
          has_quiz: Boolean(cl.has_quiz),
          due_date: dateOnly(a.due_date),
          status: (p && p.status) || 'not_started',
          completed_date: dateOnly(p && p.completed_date),
          quiz_score: p ? p.quiz_score ?? null : null,
          quiz_passed: Boolean(p && p.quiz_passed),
          attempts: attemptCount.get(key) || 0,
          time_spent_seconds: Number(p && p.time_spent_seconds) || 0,
          rating: ratingMap.get(key) ?? null,
        });
      });
    });
    rows.sort((a, b) => a.employee.localeCompare(b.employee) || a.curriculum.localeCompare(b.curriculum));

    const peopleMap = new Map();
    const managerMap = new Map();
    rows.forEach((row) => {
      peopleMap.set(row.employee_id, { id: row.employee_id, name: row.employee });
      if (row.manager_id) managerMap.set(row.manager_id, { id: row.manager_id, name: row.manager });
    });

    const statusFilter = String(req.query.status || '');
    if (['completed', 'in_progress', 'not_started'].includes(statusFilter)) rows = rows.filter((row) => row.status === statusFilter);

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

    const classMap = new Map();
    rows.forEach((row) => {
      const entry = classMap.get(row.class_id) || { class_id: row.class_id, class_title: row.class_title, curriculum: row.curriculum, assigned: 0, completed: 0, in_progress: 0, attempts: 0, time: 0, ratings: [] };
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

    // Per-question view: re-score each stored attempt (answers_by_question) to find the questions learners miss or skip most.
    const scopedRowIds = new Set(rows.map((row) => String(row.employee_id)));
    const relevantAttempts = attempts.filter((a) => scopedRowIds.has(String(a.employee_id)) && a.answers_by_question);
    let questionStats = [];
    if (relevantAttempts.length > 0) {
      const quizzes = await loadAll(orgId, 'Quiz');
      const quizClass = new Map(quizzes.map((q) => [q.id, q.class_id]));
      const classTitle = new Map(classes.map((c) => [c.id, c.title]));
      const stat = new Map();
      (await loadAll(orgId, 'QuizQuestion')).forEach((q) => stat.set(q.id, { question: q, seen: 0, wrong: 0, skipped: 0 }));
      relevantAttempts.forEach((attempt) => {
        Object.entries(attempt.answers_by_question).forEach(([qid, answer]) => {
          const entry = stat.get(qid);
          if (!entry) return;
          entry.seen += 1;
          if (answer === null || answer === undefined || answer === '') entry.skipped += 1;
          if (!isAnswerCorrect(entry.question, answer)) entry.wrong += 1;
        });
      });
      questionStats = [...stat.values()].filter((e) => e.seen > 0).map((e) => ({
        question_id: e.question.id,
        class_title: classTitle.get(quizClass.get(e.question.quiz_id)) || '',
        question: e.question.question,
        answered: e.seen,
        wrong_rate: Math.round((e.wrong / e.seen) * 100),
        skip_rate: Math.round((e.skipped / e.seen) * 100),
      })).sort((a, b) => b.wrong_rate - a.wrong_rate || b.skip_rate - a.skip_rate).slice(0, 15);
    }

    res.json({ rows, summary, classStats, questionStats, people: [...peopleMap.values()], managers: isAdmin ? [...managerMap.values()] : [] });
  }));

  // Gives a code to specialties / curriculums that were created before a numbering rule existed (oldest first).
  app.post('/api/b44/numbering/backfill', authenticateToken, wrap(async (req, res) => {
    if (getRole(req) !== 'administrator') return forbid(res);
    const orgId = getOrgId(req);
    const result = {};
    for (const [entity, type] of Object.entries(NUMBERED_ENTITIES)) {
      const missing = (await loadAll(orgId, entity)).filter((r) => !r.code).sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
      let assigned = 0;
      for (const record of missing) {
        const code = await allocateNumberingCode(orgId, type);
        if (!code) break; // no active rule
        await mergeRecord(orgId, entity, record.id, { code });
        assigned += 1;
      }
      result[entity] = { missing: missing.length, assigned };
    }
    res.json(result);
  }));

  // ---- users (Base44 "User" entity) mapped onto the site's users table ----
  const toB44Role = (siteRole) => {
    const r = effectiveTrainingRole(siteRole);
    return r === 'administrator' ? 'admin' : r;
  };

  // ---- "Linked Document" class content: documents from the Documents module (read-only) ----
  // Walks a revision chain (child rows point back via revision_parent_id) forward from documentId and
  // returns the LAST node that is published/revised, so a class never goes stale when its document is revised.
  const resolveLatestPublishedDocument = async (orgId, documentId) => {
    let currentId = documentId;
    let latest = null;
    for (let i = 0; i < 50 && currentId; i += 1) {
      const [[doc]] = await pool.query(
        'SELECT document_id, title, version, status, updated_at FROM documents WHERE document_id = ? AND organization_id = ?',
        [currentId, orgId]
      );
      if (!doc) break;
      if (doc.status === 'published' || doc.status === 'revised') latest = doc;
      const [[child]] = await pool.query('SELECT document_id FROM documents WHERE revision_parent_id = ? ORDER BY version DESC LIMIT 1', [currentId]);
      currentId = child?.document_id || null;
    }
    return latest;
  };

  // Picker list: published/revised documents in this org, one row per revision chain (latest version).
  app.get('/api/b44/documents/published', authenticateToken, wrap(async (req, res) => {
    const ctx = await getCtx(req);
    if (!STAFF.includes(ctx.role)) return forbid(res);
    const [rows] = await pool.query(
      `SELECT document_id, title, version, revision_parent_id FROM documents
       WHERE organization_id = ? AND status IN ('published', 'revised') ORDER BY title, version DESC`,
      [getOrgId(req)]
    );
    const latestByChain = new Map();
    rows.forEach((row) => {
      const key = row.revision_parent_id || row.document_id;
      const existing = latestByChain.get(key);
      if (!existing || row.version > existing.version) latestByChain.set(key, row);
    });
    res.json([...latestByChain.values()].map((r) => ({ document_id: r.document_id, title: r.title, version: r.version })));
  }));

  // Current published version of the document a class links to (any signed-in role; null if not published).
  app.get('/api/b44/documents/:documentId/latest', authenticateToken, wrap(async (req, res) => {
    const doc = await resolveLatestPublishedDocument(getOrgId(req), req.params.documentId);
    res.json(doc ? { id: doc.document_id, title: doc.title, version: doc.version, updated_at: doc.updated_at } : null);
  }));

  app.get('/api/b44/users', authenticateToken, wrap(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, role, reports_to_id, department, created_at FROM users WHERE organization_id = ? ORDER BY first_name, last_name',
      [getOrgId(req)]
    ).catch(async () => pool.query(
      'SELECT id, first_name, last_name, email, role, reports_to_id, created_at FROM users WHERE organization_id = ? ORDER BY first_name, last_name',
      [getOrgId(req)]
    ));
    let visible = rows;
    if (getRole(req) === 'employee') {
      const mine = rows.find((u) => String(u.id) === String(req.user.userId));
      visible = rows.filter((u) => String(u.id) === String(req.user.userId) || (mine && mine.reports_to_id && String(u.id) === String(mine.reports_to_id)));
    }
    res.json(visible.map((u) => ({
      id: String(u.id),
      email: u.email,
      full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      role: toB44Role(u.role),
      manager_id: u.reports_to_id ? String(u.reports_to_id) : null,
      department: u.department || '',
      created_date: u.created_at ? iso(u.created_at) : null,
    })));
  }));

  app.get('/api/b44/me', authenticateToken, wrap(async (req, res) => {
    const [[u]] = await pool.query('SELECT id, first_name, last_name, email, role, reports_to_id FROM users WHERE id = ?', [req.user.userId]);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: String(u.id),
      email: u.email,
      full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      role: toB44Role(req.user.role),
      manager_id: u.reports_to_id ? String(u.reports_to_id) : null,
    });
  }));

  // ---- file upload ("UploadPublicFile") ----
  app.post('/api/b44/upload', authenticateToken, upload.single('file'), wrap(async (req, res) => {
    if (!STAFF.includes(getRole(req))) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return forbid(res);
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ file_url: `/api/b44/files/${encodeURIComponent(req.file.filename)}`, file_name: req.file.originalname });
  }));

  // Public like Base44's public file URLs: the link is stored on a class and opened by learners.
  app.get('/api/b44/files/:name', (req, res) => {
    const name = req.params.name;
    if (!name || name.includes('\0')) return res.status(400).end();
    const resolvedBase = path.resolve(uploadsDir);
    const target = path.resolve(resolvedBase, name);
    if (!target.startsWith(resolvedBase + path.sep) || !fs.existsSync(target)) return res.status(404).end();
    res.sendFile(target);
  });

  // ---- daily purge of classes trashed 30+ days ago ----
  async function purgeTrashedClasses() {
    try {
      await ready;
      const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000);
      const [orgs] = await pool.query("SELECT DISTINCT organization_id FROM b44_records WHERE entity = 'Class'");
      let purged = 0;
      for (const { organization_id: orgId } of orgs) {
        const classes = await loadAll(orgId, 'Class');
        for (const c of classes) {
          if (c.trashed_at && new Date(c.trashed_at) < cutoff) {
            await pool.query('DELETE FROM b44_records WHERE id = ?', [c.id]);
            purged += 1;
          }
        }
      }
      if (purged > 0) console.log(`🗑️ Purged ${purged} trashed class(es)`);
    } catch (error) {
      console.error('Error purging trashed classes:', error);
    }
  }
  purgeTrashedClasses();
  setInterval(purgeTrashedClasses, 24 * 60 * 60 * 1000);
};
