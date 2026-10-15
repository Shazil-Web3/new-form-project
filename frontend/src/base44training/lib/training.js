import { base44 } from '../base44Client';

export const REQUIRED_WEEKS = 2;
export const MAX_EXTENSIONS = 3;
export const EXTENSION_WEEKS = 2;

export async function getCurrentUser() {
  try {
    return await base44.auth.me();
  } catch {
    return null;
  }
}

export function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function toISODate(date) {
  return new Date(date).toISOString().split('T')[0];
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

export function dueStatus(dueDate, status) {
  if (status === 'completed') return { label: 'Completed', tone: 'green' };
  const days = daysUntil(dueDate);
  if (days < 0) return { label: 'Overdue', tone: 'red' };
  if (days <= 3) return { label: `${days}d left`, tone: 'amber' };
  return { label: `${days}d left`, tone: 'slate' };
}

export function statusToneClasses(tone) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  return map[tone] || map.slate;
}

// A published curriculum has a "pending update" when it (or one of its classes)
// was edited since the last approved publish. We track this with an explicit
// flag so it works even for curriculums published before the flag existed.
export function hasPendingUpdate(curriculum) {
  return !!(curriculum && curriculum.status === 'published' && curriculum.has_unpublished_changes);
}

// Returns the correct answer for a quiz question as a single display string,
// so the publish history can show only the correct answer per question.
export function quizCorrectAnswer(q) {
  if (!q) return '';
  if (q.question_type === 'multiple_choice' || q.question_type === 'true_false' || q.question_type === 'fill_blank_choice') {
    const opts = q.options || [];
    const i = q.correct_index;
    return (i != null && opts[i] != null) ? String(opts[i]) : '';
  }
  if (q.question_type === 'fill_blank') {
    return (q.acceptable_answers || []).join(' / ');
  }
  if (q.question_type === 'matching') {
    return (q.match_pairs || []).map((p) => `${p.left} = ${p.right}`).join(', ');
  }
  return '';
}

// Strip live-only fields so a question definition is clean and portable
// (used for staging pending quiz edits and for comparing against the
// approved version).
export function cleanQuestion(q) {
  const type = q.question_type || 'multiple_choice';
  const out = { question_type: type, question: q.question || '' };
  if (type === 'multiple_choice' || type === 'true_false' || type === 'fill_blank_choice') {
    out.options = q.options || [];
    out.correct_index = q.correct_index ?? 0;
  } else if (type === 'fill_blank') {
    out.acceptable_answers = q.acceptable_answers || [];
  } else if (type === 'matching') {
    out.match_pairs = q.match_pairs || [];
  }
  return out;
}

// Normalize a quiz (record + questions) into the staged-payload shape so two
// versions can be compared field by field.
export function normalizeQuizPayload(quiz, questions) {
  return {
    passing_score: quiz?.passing_score ?? 70,
    questions: (questions || []).map(cleanQuestion),
  };
}

function questionEqual(a, b) {
  if (!a || !b) return false;
  if (a.question_type !== b.question_type) return false;
  if ((a.question || '') !== (b.question || '')) return false;
  const t = a.question_type;
  if (t === 'multiple_choice' || t === 'true_false' || t === 'fill_blank_choice') {
    const ao = a.options || [], bo = b.options || [];
    if (ao.length !== bo.length) return false;
    for (let i = 0; i < ao.length; i++) if (ao[i] !== bo[i]) return false;
    if ((a.correct_index ?? 0) !== (b.correct_index ?? 0)) return false;
  } else if (t === 'fill_blank') {
    const aa = a.acceptable_answers || [], ba = b.acceptable_answers || [];
    if (aa.length !== ba.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== ba[i]) return false;
  } else if (t === 'matching') {
    const am = a.match_pairs || [], bm = b.match_pairs || [];
    if (am.length !== bm.length) return false;
    for (let i = 0; i < am.length; i++) {
      if (am[i].left !== bm[i].left || am[i].right !== bm[i].right) return false;
    }
  }
  return true;
}

// Returns true when two staged payloads represent the same quiz (same passing
// score and identical questions in the same order). Used to detect whether a
// saved quiz edit is a real change versus a no-op save.
export function quizPayloadEqual(a, b) {
  if (!a || !b) return false;
  if ((a.passing_score ?? 70) !== (b.passing_score ?? 70)) return false;
  const aq = a.questions || [];
  const bq = b.questions || [];
  if (aq.length !== bq.length) return false;
  for (let i = 0; i < aq.length; i++) {
    if (!questionEqual(aq[i], bq[i])) return false;
  }
  return true;
}