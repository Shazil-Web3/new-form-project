#!/usr/bin/env node
/**
 * One-off migration: old training tables (lms_*) -> the Base44-style store (b44_records).
 *
 *   node training/migrateLegacyToB44.js                 dry run (prints what would be created, writes nothing)
 *   node training/migrateLegacyToB44.js --apply         write the records
 *   node training/migrateLegacyToB44.js --rollback      delete every record this script created (apply to undo)
 *   options: --org=ID  only that organization   --api-url=http://localhost:5000  base URL used for uploaded files
 *
 * Safe to re-run: every created record carries `legacy_ref` ("lms_classes:10:copy"), existing refs are skipped.
 * The lms_* tables are never modified.
 *
 * Shape mapping (see the Base44 entity schemas):
 *   lms_field_specialties -> FieldSpecialty            lms_curricula   -> Curriculum (published)
 *   lms_classes           -> Class master (library, no curriculum) + Class copy in the curriculum (library_class_id = master)
 *   lms_quizzes/questions -> Quiz + QuizQuestion on BOTH the master and the copy
 *   lms_assignments       -> Assignment                lms_class_progress -> ClassProgress (on the copy)
 *   lms_quiz_attempts     -> QuizAttempt               lms_certificates   -> Certificate (same validation id)
 *   lms_class_ratings     -> ClassRating
 * Dropped (no Base44 equivalent): prerequisite class, linked_document id, quiz per-attempt limits / time limits.
 */
require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const APPLY = flag('apply');
const ROLLBACK = flag('rollback');
const ONLY_ORG = opt('org', null);
const API_URL = opt('api-url', 'http://localhost:5000').replace(/\/$/, '');

const day = (d) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);
const iso = (d) => (d ? (d instanceof Date ? d.toISOString() : new Date(d).toISOString()) : null);
const json = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
  return v;
};
const CONTENT_TYPE = { pdf: 'pdf', video: 'on_demand_video', live: 'live_class', document: 'pdf', linked_document: 'pdf' };

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306, database: process.env.DB_NAME,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS b44_records (
    id varchar(36) NOT NULL, organization_id int NOT NULL, entity varchar(64) NOT NULL, data json NOT NULL, created_by varchar(255) NULL,
    created_date datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_date datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id), KEY idx_b44_org_entity (organization_id, entity))`);

  const [specRows] = await pool.query('SELECT * FROM lms_field_specialties ORDER BY id');
  const orgs = [...new Set(specRows.map((s) => s.organization_id))].filter((o) => !ONLY_ORG || String(o) === String(ONLY_ORG));
  console.log(`${APPLY ? 'APPLY' : ROLLBACK ? 'ROLLBACK' : 'DRY RUN'} - organizations: ${orgs.join(', ') || '(none)'}`);

  for (const orgId of orgs) {
    if (ROLLBACK) {
      const [r] = await pool.query("DELETE FROM b44_records WHERE organization_id = ? AND JSON_EXTRACT(data, '$.legacy_ref') IS NOT NULL", [orgId]);
      console.log(`org ${orgId}: removed ${r.affectedRows} migrated record(s)`);
      continue;
    }
    await migrateOrg(pool, orgId, specRows.filter((s) => s.organization_id === orgId));
  }
  await pool.end();
  if (!APPLY && !ROLLBACK) console.log('\nDry run only. Re-run with --apply to write.');
}

async function migrateOrg(pool, orgId, specs) {
  const counts = {};
  const [existingRows] = await pool.query("SELECT id, JSON_UNQUOTE(JSON_EXTRACT(data, '$.legacy_ref')) AS ref FROM b44_records WHERE organization_id = ? AND JSON_EXTRACT(data, '$.legacy_ref') IS NOT NULL", [orgId]);
  const existing = new Map(existingRows.map((r) => [r.ref, r.id]));

  const put = async (entity, ref, data, createdAt) => {
    const c = (counts[entity] = counts[entity] || { created: 0, skipped: 0 });
    if (existing.has(ref)) { c.skipped += 1; return existing.get(ref); }
    const id = crypto.randomUUID();
    c.created += 1;
    existing.set(ref, id);
    if (APPLY) {
      const when = createdAt ? new Date(createdAt) : new Date();
      await pool.query(
        'INSERT INTO b44_records (id, organization_id, entity, data, created_by, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, orgId, entity, JSON.stringify({ ...data, legacy_ref: ref }), null, when, when]
      );
    }
    return id;
  };

  const [users] = await pool.query('SELECT id, first_name, last_name, email, reports_to_id FROM users WHERE organization_id = ?', [orgId]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const nameOf = (id) => { const u = userById.get(id); return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email) : String(id); };

  // field specialties
  const specNew = new Map();
  for (const s of specs) {
    const id = await put('FieldSpecialty', `lms_field_specialties:${s.id}`, {
      name: s.name, description: s.description || '', status: 'active', ...(s.code ? { code: s.code } : {}),
    }, s.created_at);
    specNew.set(s.id, { id, name: s.name });
  }

  // curricula
  const [curRows] = specs.length ? await pool.query('SELECT * FROM lms_curricula WHERE field_specialty_id IN (?) ORDER BY id', [specs.map((s) => s.id)]) : [[]];
  const curNew = new Map();
  for (const c of curRows) {
    const spec = specNew.get(c.field_specialty_id);
    const id = await put('Curriculum', `lms_curricula:${c.id}`, {
      name: c.name, description: c.description || '', field_specialty_id: spec.id, field_specialty_name: spec.name,
      type: c.type, status: 'published', last_published_date: iso(c.created_at), has_unpublished_changes: false, ...(c.code ? { code: c.code } : {}),
    }, c.created_at);
    curNew.set(c.id, { id, name: c.name, type: c.type });
  }

  // classes (+ quizzes)
  const [classRows] = curRows.length ? await pool.query('SELECT * FROM lms_classes WHERE curriculum_id IN (?) ORDER BY curriculum_id, display_order, id', [curRows.map((c) => c.id)]) : [[]];
  const [quizRows] = classRows.length ? await pool.query('SELECT * FROM lms_quizzes WHERE class_id IN (?)', [classRows.map((c) => c.id)]) : [[]];
  const [questionRows] = quizRows.length ? await pool.query('SELECT * FROM lms_quiz_questions WHERE quiz_id IN (?) ORDER BY quiz_id, display_order, id', [quizRows.map((q) => q.id)]) : [[]];

  const copyOfClass = new Map(); const copyQuizOfClass = new Map(); const questionMap = new Map(); const dropped = { prerequisite: 0, linked_document: 0, quiz_limits: 0, blob_url: 0 };
  const fileUrl = (name) => {
    if (!name) return '';
    if (/^https?:\/\//i.test(name)) return name;
    if (/^blob:/i.test(name)) { dropped.blob_url += 1; return ''; }
    return `${API_URL}/api/b44/files/${encodeURIComponent(name)}`;
  };

  for (const cl of classRows) {
    const cur = curNew.get(cl.curriculum_id);
    if (cl.prerequisite_class_id) dropped.prerequisite += 1;
    if (cl.content_type === 'linked_document') dropped.linked_document += 1;
    const base = {
      title: cl.title, description: cl.description || '', content_type: CONTENT_TYPE[cl.content_type] || 'pdf', type: cur.type || 'required',
      content_url: fileUrl(cl.content_url), live_class_date: iso(cl.live_class_date) || '', live_class_link: cl.live_class_link || '',
      available_timings: cl.live_class_date ? [iso(cl.live_class_date)] : [], duration_minutes: cl.duration_minutes || 0,
      has_quiz: Boolean(cl.has_quiz), certificate_validity_months: cl.certificate_validity_months ?? null, retraining_interval_months: cl.retraining_interval_months ?? null,
      pending_operation: 'none', quiz_pending_update: false, pending_library_update: false, archived: false,
    };
    const masterId = await put('Class', `lms_classes:${cl.id}:master`, { ...base, curriculum_id: '', curriculum_name: '', order: 0 }, cl.created_at);
    const copyId = await put('Class', `lms_classes:${cl.id}`, { ...base, curriculum_id: cur.id, curriculum_name: cur.name, library_class_id: masterId, order: cl.display_order || 0 }, cl.created_at);
    copyOfClass.set(cl.id, { id: copyId, title: cl.title, curriculum_id: cur.id });

    const quiz = quizRows.find((q) => q.class_id === cl.id);
    if (quiz) {
      if (quiz.questions_per_attempt || quiz.max_attempts) dropped.quiz_limits += 1;
      for (const [suffix, targetId] of [['master', masterId], ['copy', copyId]]) {
        const quizId = await put('Quiz', `lms_quizzes:${quiz.id}:${suffix}`, { class_id: targetId, title: quiz.title, passing_score: quiz.passing_score }, quiz.created_at);
        if (suffix === 'copy') copyQuizOfClass.set(cl.id, quizId);
        for (const q of questionRows.filter((x) => x.quiz_id === quiz.id)) {
          const data = { quiz_id: quizId, question_type: q.question_type, question: q.question };
          if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') { data.options = json(q.options, []); data.correct_index = q.correct_index ?? 0; }
          if (q.question_type === 'fill_blank') data.acceptable_answers = json(q.acceptable_answers, []);
          if (q.question_type === 'matching') data.match_pairs = json(q.match_pairs, []);
          const qid = await put('QuizQuestion', `lms_quiz_questions:${q.id}:${suffix}`, data, quiz.created_at);
          if (suffix === 'copy') questionMap.set(q.id, { id: qid, type: q.question_type });
        }
      }
    }
  }

  // assignments
  const employeeIds = users.map((u) => u.id);
  const [assignRows] = employeeIds.length ? await pool.query('SELECT * FROM lms_assignments WHERE employee_id IN (?) ORDER BY id', [employeeIds]) : [[]];
  const [progressRows] = employeeIds.length && classRows.length ? await pool.query('SELECT * FROM lms_class_progress WHERE employee_id IN (?) AND class_id IN (?)', [employeeIds, classRows.map((c) => c.id)]) : [[]];
  for (const a of assignRows) {
    const cur = curNew.get(a.curriculum_id);
    if (!cur) continue;
    const curClasses = classRows.filter((c) => c.curriculum_id === a.curriculum_id);
    const mine = progressRows.filter((p) => p.employee_id === a.employee_id && curClasses.some((c) => c.id === p.class_id));
    const status = curClasses.length > 0 && curClasses.every((c) => mine.some((p) => p.class_id === c.id && p.status === 'completed')) ? 'completed' : mine.length > 0 ? 'in_progress' : 'assigned';
    await put('Assignment', `lms_assignments:${a.id}`, {
      employee_id: String(a.employee_id), employee_name: nameOf(a.employee_id), manager_id: a.manager_id ? String(a.manager_id) : '',
      curriculum_id: cur.id, curriculum_name: cur.name, assignment_type: a.assignment_type, assigned_by_id: String(a.assigned_by_id),
      due_date: day(a.due_date), extensions_used: a.extensions_used || 0, status,
    }, a.created_at);
  }

  // progress
  for (const p of progressRows) {
    const copy = copyOfClass.get(p.class_id);
    await put('ClassProgress', `lms_class_progress:${p.id}`, {
      employee_id: String(p.employee_id), class_id: copy.id, class_name: copy.title, curriculum_id: copy.curriculum_id, status: p.status,
      progress_percent: p.progress_percent || 0, completed_date: day(p.completed_date), quiz_score: p.quiz_score ?? null,
      quiz_passed: Boolean(p.quiz_passed), time_spent_seconds: p.time_spent_seconds || 0,
    }, p.updated_at);
  }

  // quiz attempts (answers keyed by old question id -> new question id; matching answers are left out because the new
  // matching grader uses a different answer encoding, so they could not be re-scored correctly)
  const [attemptRows] = employeeIds.length && classRows.length ? await pool.query('SELECT * FROM lms_quiz_attempts WHERE employee_id IN (?) AND class_id IN (?) ORDER BY id', [employeeIds, classRows.map((c) => c.id)]) : [[]];
  for (const at of attemptRows) {
    const copy = copyOfClass.get(at.class_id);
    const stored = json(at.answers, {});
    const byQuestion = {};
    Object.entries(stored && !Array.isArray(stored) ? stored : {}).forEach(([oldId, answer]) => {
      const mapped = questionMap.get(Number(oldId));
      if (mapped && mapped.type !== 'matching') byQuestion[mapped.id] = answer;
    });
    await put('QuizAttempt', `lms_quiz_attempts:${at.id}`, {
      employee_id: String(at.employee_id), quiz_id: copyQuizOfClass.get(at.class_id) || '', class_id: copy.id, score: at.score, passed: Boolean(at.passed),
      answers: Object.values(byQuestion), answers_by_question: byQuestion,
    }, at.created_at);
  }

  // certificates + ratings
  const [certRows] = employeeIds.length && classRows.length ? await pool.query('SELECT * FROM lms_certificates WHERE employee_id IN (?) AND class_id IN (?) ORDER BY id', [employeeIds, classRows.map((c) => c.id)]) : [[]];
  for (const c of certRows) {
    const copy = copyOfClass.get(c.class_id);
    await put('Certificate', `lms_certificates:${c.id}`, {
      employee_id: String(c.employee_id), employee_name: nameOf(c.employee_id), class_id: copy.id, class_title: copy.title,
      validation_id: c.validation_id, issued_date: day(c.issued_date), expiry_date: day(c.expiry_date),
    }, c.created_at);
  }
  const [ratingRows] = employeeIds.length && classRows.length ? await pool.query('SELECT * FROM lms_class_ratings WHERE employee_id IN (?) AND class_id IN (?) ORDER BY id', [employeeIds, classRows.map((c) => c.id)]) : [[]];
  for (const r of ratingRows) {
    await put('ClassRating', `lms_class_ratings:${r.id}`, { employee_id: String(r.employee_id), class_id: copyOfClass.get(r.class_id).id, rating: r.rating }, r.created_at);
  }

  console.log(`\norg ${orgId}:`);
  Object.entries(counts).forEach(([entity, c]) => console.log(`  ${entity.padEnd(14)} created ${String(c.created).padStart(3)}   already there ${String(c.skipped).padStart(3)}`));
  const notes = Object.entries(dropped).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`);
  if (notes.length) console.log(`  not carried over -> ${notes.join(', ')}`);
}

main().catch((error) => { console.error('Migration failed:', error); process.exit(1); });
