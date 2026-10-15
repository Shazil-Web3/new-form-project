import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  BookOpen, FileText, Video, Radio, HelpCircle, ShieldAlert, Check, X, Loader2, AlertCircle, Clock,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

const contentTypeMeta = {
  pdf: { label: 'PDF', Icon: FileText, color: 'text-rose-500' },
  on_demand_video: { label: 'Video', Icon: Video, color: 'text-violet-500' },
  live_class: { label: 'Live class', Icon: Radio, color: 'text-sky-500' },
  linked_document: { label: 'Linked document', Icon: FileText, color: 'text-amber-500' },
};

const typeLabel = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  fill_blank: 'Fill in the blank (typed)',
  fill_blank_choice: 'Fill in the blank',
  matching: 'Matching',
};

const opLabel = (op, targetType) => {
  if (targetType === 'quiz') return 'Quiz update';
  return op === 'add' ? 'Add class' : op === 'delete' ? 'Remove class' : 'Edit class';
};

function QuestionPreview({ q, i }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-slate-900">
          <span className="mr-1 text-slate-400">Q{i + 1}.</span>{q.question || '—'}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {typeLabel[q.question_type] || q.question_type}
        </span>
      </div>
      {(q.question_type === 'multiple_choice' || q.question_type === 'fill_blank_choice') && Array.isArray(q.options) && (
        <ul className="mt-2 space-y-1">
          {q.options.map((opt, idx) => (
            <li key={idx} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}>
              {idx === q.correct_index ? <Check className="h-4 w-4" /> : <span className="ml-4 inline-block h-4 w-4" />}
              <span>{opt}</span>
            </li>
          ))}
        </ul>
      )}
      {q.question_type === 'true_false' && (
        <div className="mt-2 flex gap-2">
          {['True', 'False'].map((opt, idx) => (
            <span key={opt} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
              {idx === q.correct_index && <Check className="h-4 w-4" />}{opt}
            </span>
          ))}
        </div>
      )}
      {q.question_type === 'fill_blank' && Array.isArray(q.acceptable_answers) && q.acceptable_answers.length > 0 && (
        <div className="mt-2 text-sm text-slate-600">
          <span className="text-slate-400">Accepted answers:</span> {q.acceptable_answers.map((a) => `"${a}"`).join(', ')}
        </div>
      )}
      {q.question_type === 'matching' && Array.isArray(q.match_pairs) && q.match_pairs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {q.match_pairs.map((p, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="rounded bg-slate-100 px-2 py-0.5">{p.left}</span>
              <span className="text-slate-400">↔</span>
              <span className="rounded bg-slate-100 px-2 py-0.5">{p.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassPayloadPreview({ payload }) {
  const meta = contentTypeMeta[payload.content_type] || contentTypeMeta.pdf;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2">
        <meta.Icon className={`h-4 w-4 ${meta.color}`} />
        <span className="flex-1 truncate text-sm font-medium text-slate-900">{payload.title || '—'}</span>
        <span className="text-xs text-slate-400">{meta.label}</span>
      </div>
      {payload.description?.trim() && (
        <div className="mt-2 text-sm text-slate-600">{payload.description}</div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div><span className="text-slate-400">Type:</span> <span className="font-medium text-slate-700">{payload.type || 'required'}</span></div>
        {payload.duration_minutes ? <div><span className="text-slate-400">Duration:</span> <span className="font-medium text-slate-700">{payload.duration_minutes} min</span></div> : null}
        {payload.live_class_date ? <div><span className="text-slate-400">Live:</span> <span className="font-medium text-slate-700">{new Date(payload.live_class_date).toLocaleString()}</span></div> : null}
      </div>
    </div>
  );
}

function QuizPayloadPreview({ payload }) {
  const questions = payload?.questions || [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">
        Passing score <span className="font-medium text-slate-700">{payload?.passing_score ?? 70}%</span> · {questions.length} question{questions.length === 1 ? '' : 's'}
      </div>
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No questions in this quiz.</div>
      ) : (
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {questions.map((q, i) => <QuestionPreview key={i} q={q} i={i} />)}
        </div>
      )}
    </div>
  );
}

export default function ReviewRequestDialog({ request, kind, onClose, onApprove, onReject, busy }) {
  const open = !!request;
  const [mode, setMode] = useState('review');
  const [reason, setReason] = useState('');
  const [classes, setClasses] = useState([]);
  const [quizzesByClass, setQuizzesByClass] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedQuiz, setExpandedQuiz] = useState(null);
  const [questionsByClass, setQuestionsByClass] = useState({});
  const [quizLoading, setQuizLoading] = useState(null);
  const [specialtyCurriculums, setSpecialtyCurriculums] = useState([]);

  async function toggleQuiz(classId, quiz) {
    if (expandedQuiz === classId) {
      setExpandedQuiz(null);
      return;
    }
    setExpandedQuiz(classId);
    if (quiz._pending) {
      setQuestionsByClass((p) => ({ ...p, [classId]: quiz._questions || [] }));
      return;
    }
    if (questionsByClass[classId]) return;
    setQuizLoading(classId);
    try {
      const page = await base44.entities.QuizQuestion.filter({ quiz_id: quiz.id }, { sort: 'created_date', limit: 200 });
      setQuestionsByClass((p) => ({ ...p, [classId]: page.items || page || [] }));
    } catch {
      setQuestionsByClass((p) => ({ ...p, [classId]: [] }));
    } finally {
      setQuizLoading(null);
    }
  }

  useEffect(() => {
    setMode('review');
    setReason('');
    setClasses([]);
    setQuizzesByClass({});
    setSpecialtyCurriculums([]);
    if (!request) return;
    if (kind === 'archive' && request.target_type === 'specialty') {
      // Specialty archive: load each curriculum under the specialty and its
      // classes so the reviewer sees exactly what gets archived vs trashed.
      setLoading(true);
      base44.entities.Curriculum.filter({ field_specialty_id: request.specialty_id }, { sort: 'created_date', limit: 200 })
        .then(async (curPage) => {
          const curs = curPage.items || curPage || [];
          const withClasses = [];
          for (const cur of curs) {
            const cp = await base44.entities.Class.filter({ curriculum_id: cur.id }, { sort: 'order', limit: 200 });
            const list = (cp.items || cp || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
            withClasses.push({ curriculum: cur, classes: list });
          }
          setSpecialtyCurriculums(withClasses);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    if (kind === 'archive' && request.target_type === 'class') {
      // Class archive: no content to load — the class is already archived.
      return;
    }
    if (kind === 'publish' || kind === 'archive') {
      const curId = request.curriculum_id;
      setLoading(true);
      base44.entities.Class.filter({ curriculum_id: curId }, { sort: 'order', limit: 200 })
        .then(async (page) => {
          const list = page.items || page || [];
          list.sort((a, b) => (a.order || 0) - (b.order || 0));
          setClasses(list);
          const qMap = {};
          await Promise.all(list.map(async (c) => {
            // A staged quiz edit is stored on the class; show that pending
            // version to the manager rather than the still-live Rev 1 quiz.
            if (c.pending_quiz_payload) {
              qMap[c.id] = {
                id: `pending-${c.id}`,
                title: `${c.title} — pending update`,
                passing_score: c.pending_quiz_payload.passing_score ?? 70,
                _pending: true,
                _questions: c.pending_quiz_payload.questions || [],
              };
              return;
            }
            try {
              const qp = await base44.entities.Quiz.filter({ class_id: c.id }, { limit: 1 });
              const q = (qp.items || qp)[0];
              if (q) qMap[c.id] = q;
            } catch { /* ignore */ }
          }));
          setQuizzesByClass(qMap);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [request?.id, kind]);

  if (!request) return null;

  const isSpecialtyArchive = kind === 'archive' && request.target_type === 'specialty';
  const isClassArchive = kind === 'archive' && request.target_type === 'class';
  const isCurriculum = !isSpecialtyArchive && !isClassArchive && (kind === 'publish' || kind === 'archive');
  const titleIcon = kind === 'archive' ? <Clock className="h-5 w-5 text-amber-500" />
    : kind === 'publish' ? <BookOpen className="h-5 w-5 text-emerald-500" />
    : <ShieldAlert className="h-5 w-5 text-amber-500" />;
  const title = isSpecialtyArchive
    ? `Archive specialty: ${request.specialty_name}`
    : isClassArchive
      ? `Archive class: ${request.class_name}`
      : isCurriculum
        ? `${kind === 'archive' ? 'Archive' : 'Publish'}: ${request.curriculum_name}`
        : `${opLabel(request.operation, request.target_type)}: ${request.class_title || 'Quiz'}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{titleIcon} {title}</DialogTitle>
          <DialogDescription>
            Review the content below, then approve or reject. A rejection reason is shared with the requester.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isSpecialtyArchive ? (
            loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading content…
              </div>
            ) : specialtyCurriculums.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                This specialty has no curriculums.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Published curriculums will be archived. Unpublished (draft) curriculums and their content will be moved to trash.
                </p>
                {specialtyCurriculums.map(({ curriculum: cur, classes: cls }) => {
                  const willArchive = cur.status === 'published';
                  const alreadyArchived = cur.status === 'archived';
                  return (
                    <div key={cur.id} className={`rounded-lg border p-3 ${willArchive ? 'border-amber-200 bg-amber-50/40' : alreadyArchived ? 'border-slate-200 bg-slate-50/60' : 'border-rose-200 bg-rose-50/40'}`}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-slate-500" />
                        <span className="flex-1 truncate text-sm font-medium text-slate-900">{cur.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${willArchive ? 'bg-amber-100 text-amber-700' : alreadyArchived ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>
                          {willArchive ? 'Will be archived' : alreadyArchived ? 'Already archived' : 'Will be removed'}
                        </span>
                      </div>
                      {cls.length === 0 ? (
                        <div className="mt-2 text-xs text-slate-400">No classes.</div>
                      ) : (
                        <div className="mt-2 space-y-1">
                          {cls.map((c) => {
                            const meta = contentTypeMeta[c.content_type] || contentTypeMeta.pdf;
                            return (
                              <div key={c.id} className="flex items-center gap-2 rounded-md bg-white/60 px-2 py-1.5">
                                <meta.Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                                <span className="flex-1 truncate text-xs text-slate-700">{c.title}</span>
                                <span className="text-[10px] text-slate-400">{meta.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : isClassArchive ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>This will permanently remove <span className="font-semibold">“{request.class_name}”</span>{request.curriculum_name ? <> from <span className="font-semibold">{request.curriculum_name}</span></> : null}.</p>
                <p className="mt-1 text-xs text-amber-700">The class is already archived and hidden. Approving deletes it and its quiz; rejecting restores it.</p>
              </div>
            </div>
          ) : isCurriculum ? (
            loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading content…
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                This curriculum has no classes yet.
              </div>
            ) : (
              classes.map((c) => {
                const meta = contentTypeMeta[c.content_type] || contentTypeMeta.pdf;
                const quiz = quizzesByClass[c.id];
                return (
                  <div key={c.id} className={`rounded-lg border p-3 ${c.pending_operation === 'delete' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                    <div className="flex items-center gap-2">
                      <meta.Icon className={`h-4 w-4 ${meta.color}`} />
                      <span className={`flex-1 truncate text-sm font-medium ${c.pending_operation === 'delete' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{c.title}</span>
                      <span className="text-xs text-slate-400">{meta.label}</span>
                      {c.pending_operation === 'delete' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          <AlertCircle className="h-3 w-3" /> Will be removed
                        </span>
                      )}
                      {c.pending_operation === 'add' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">New</span>
                      )}
                      {quiz && c.pending_operation !== 'delete' && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${quiz._pending ? 'bg-rose-50 text-rose-700' : 'bg-violet-50 text-violet-700'}`}>
                          <HelpCircle className="h-3 w-3" /> {quiz._pending ? 'Quiz update' : 'Quiz'}
                        </span>
                      )}
                    </div>
                    {c.description?.trim() && (
                      <div className="mt-2 text-sm text-slate-600">{c.description}</div>
                    )}
                    {quiz && c.pending_operation !== 'delete' && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleQuiz(c.id, quiz)}
                          className="mt-2 flex w-full items-center gap-1 rounded-md border border-violet-100 bg-violet-50/50 p-2 text-left text-xs text-violet-700 transition hover:bg-violet-100/70"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          Quiz: {quiz.title} · Passing score {quiz.passing_score ?? 70}%
                          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-violet-400">
                            {expandedQuiz === c.id ? 'Hide exam' : 'Review exam →'}
                          </span>
                        </button>
                        {expandedQuiz === c.id && (
                          <div className="mt-2 space-y-2 border-t border-violet-100 bg-white p-2">
                            {quizLoading === c.id ? (
                              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading questions…
                              </div>
                            ) : (questionsByClass[c.id] || []).length === 0 ? (
                              <div className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">No questions in this quiz.</div>
                            ) : (
                              (questionsByClass[c.id] || []).map((q, qi) => <QuestionPreview key={q.id || qi} q={q} i={qi} />)
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )
          ) : request.target_type === 'quiz' ? (
            <QuizPayloadPreview payload={request.payload || {}} />
          ) : request.operation === 'delete' ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" /> This will remove “{request.class_title}” from the curriculum.
            </div>
          ) : (
            <ClassPayloadPreview payload={request.payload || {}} />
          )}
        </div>

        {mode === 'review' ? (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="outline" onClick={() => setMode('rejecting')} disabled={busy}>
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => onApprove(request)} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Approve
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason for rejection <span className="text-rose-500">*</span></label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this is being rejected. This will be visible to the requester."
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('review')} disabled={busy}>Back</Button>
              <Button variant="destructive" onClick={() => onReject(request, reason.trim())} disabled={busy || !reason.trim()}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />} Confirm rejection
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}