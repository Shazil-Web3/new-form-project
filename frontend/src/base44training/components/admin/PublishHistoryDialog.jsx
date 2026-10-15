import React, { useEffect, useMemo, useState } from 'react';
import {
  Send, ShieldCheck, Clock, XCircle, ChevronRight, ChevronsDown, ChevronsUp,
  FileText, Video, Radio, ListChecks,
} from 'lucide-react';
import { base44 } from '../../base44Client';
import { quizCorrectAnswer } from '../../lib/training';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const contentTypeMeta = {
  pdf: { label: 'PDF', icon: FileText },
  on_demand_video: { label: 'Video', icon: Video },
  live_class: { label: 'Live', icon: Radio },
  linked_document: { label: 'Doc Link', icon: FileText },
};

export default function PublishHistoryDialog({ curriculum, onClose }) {
  const open = !!curriculum;
  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [quizzesByClass, setQuizzesByClass] = useState({});
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let active = true;
    setRevisions([]);
    setRequests([]);
    setClasses([]);
    setQuizzesByClass({});
    setExpanded(new Set());
    if (!curriculum?.id) return;
    setLoading(true);
    (async () => {
      try {
        const [revPage, reqPage, clsPage] = await Promise.all([
          base44.entities.CurriculumRevision.filter({ curriculum_id: curriculum.id }, { sort: '-revision_number', limit: 50 }),
          base44.entities.PublishRequest.filter({ curriculum_id: curriculum.id }, { sort: '-created_date', limit: 50 }),
          base44.entities.Class.filter({ curriculum_id: curriculum.id }, { sort: 'order' }),
        ]);
        if (!active) return;
        const revs = revPage.items || revPage;
        const reqs = reqPage.items || reqPage;
        const cls = clsPage.items || clsPage;
        setRevisions(revs);
        setRequests(reqs);
        setClasses(cls);
        // Default: expand the latest revision only (or the synthesized one when none exist).
        setExpanded(new Set([revs[0]?.id || '__current__']));

        // Load quizzes + question counts for classes that have quizzes.
        const quizClassIds = cls.filter((c) => c.has_quiz).map((c) => c.id);
        const map = {};
        if (quizClassIds.length > 0) {
          const quizPage = await base44.entities.Quiz.filter({ class_id: { $in: quizClassIds } });
          const quizzes = quizPage.items || quizPage;
          const quizIds = quizzes.map((q) => q.id);
          let countsByQuiz = {};
          if (quizIds.length > 0) {
            const agg = await base44.entities.QuizQuestion.aggregate({ query: { quiz_id: { $in: quizIds } }, groupBy: 'quiz_id' });
            (agg.rows || []).forEach((r) => { countsByQuiz[r.quiz_id] = r.count; });
          }
          quizzes.forEach((q) => { map[q.class_id] = { quiz: q, questionCount: countsByQuiz[q.id] || 0 }; });
        }
        if (active) setQuizzesByClass(map);
      } catch {
        /* best effort */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [curriculum?.id]);

  const displayRevisions = revisions.length > 0 ? revisions : (curriculum ? [{
    id: '__current__',
    revision_number: 1,
    name: curriculum.name,
    description: curriculum.description,
    status: curriculum.status,
    created_date: curriculum.last_published_date || curriculum.updated_date || curriculum.created_date,
    publish_request_id: null,
  }] : []);

  const allExpanded = displayRevisions.length > 0 && displayRevisions.every((r) => expanded.has(r.id));
  const noneExpanded = displayRevisions.length > 0 && displayRevisions.every((r) => !expanded.has(r.id));

  function toggleRevision(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(revisions.map((r) => r.id)));
  }

  // Pair each revision with its approval: prefer the linked publish request, fall back to index.
  const requestById = useMemo(() => Object.fromEntries(requests.map((r) => [r.id, r])), [requests]);
  const latestApproved = useMemo(() => requests.find((r) => r.status === 'approved') || null, [requests]);
  const approvalByRev = useMemo(() => {
    const m = {};
    displayRevisions.forEach((r, i) => {
      if (r.id === '__current__') {
        // The synthesized rev 1 represents the currently published version, so
        // it pairs with the approval that published it — never a later rejection.
        m[r.id] = latestApproved;
      } else {
        m[r.id] = (r.publish_request_id && requestById[r.publish_request_id]) || requests[i] || null;
      }
    });
    return m;
  }, [displayRevisions, requests, requestById, latestApproved]);

  // Resolve the class list for a revision. Approved revisions carry a frozen
  // snapshot of exactly what was approved. Legacy revisions (published before
  // snapshotting) fall back to the current classes minus pending adds, since
  // pending adds are not yet part of any approved version.
  const classesForRevision = useMemo(() => {
    const m = {};
    displayRevisions.forEach((r) => {
      if (Array.isArray(r.classes_snapshot) && r.classes_snapshot.length > 0) {
        m[r.id] = r.classes_snapshot.map((c) => ({
          title: c.title,
          content_type: c.content_type,
          description: c.description || '',
          duration_minutes: c.duration_minutes || 0,
          has_quiz: !!c.has_quiz,
          quiz: c.has_quiz ? {
            title: c.quiz_title || `${c.title || 'Class'} Quiz`,
            passing_score: c.quiz_passing_score ?? 70,
            questionCount: c.quiz_question_count || 0,
            questions: c.quiz_questions || null,
          } : null,
        }));
      } else {
        m[r.id] = classes
          .filter((c) => c.pending_operation !== 'add')
          .map((c) => ({
            id: c.id,
            title: c.title,
            content_type: c.content_type,
            description: c.description || '',
            duration_minutes: c.duration_minutes || 0,
            has_quiz: !!c.has_quiz,
            quiz: quizzesByClass[c.id] ? {
              title: quizzesByClass[c.id].quiz.title,
              passing_score: quizzesByClass[c.id].quiz.passing_score,
              questionCount: quizzesByClass[c.id].questionCount,
              questions: null,
            } : null,
          }));
      }
    });
    return m;
  }, [displayRevisions, classes, quizzesByClass]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-500" />
              Publish history
            </span>
            {displayRevisions.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                title={allExpanded ? 'Collapse all' : 'Expand all'}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                {allExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Revision history with classes and quizzes</DialogDescription>
        </DialogHeader>

        {curriculum && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Curriculum</div>
              <div className="text-sm font-semibold text-slate-900">{curriculum.name}</div>
            </div>

            {loading ? (
              <div className="text-sm text-slate-400">Loading history…</div>
            ) : displayRevisions.length === 0 ? (
              <div className="text-sm italic text-slate-400">No revision history yet.</div>
            ) : (
              <div className="space-y-2">
                {displayRevisions.map((r) => {
                  const isOpen = expanded.has(r.id);
                  const req = approvalByRev[r.id];
                  return (
                    <RevisionCard
                      key={r.id}
                      revision={r}
                      request={req}
                      classes={classesForRevision[r.id] || []}
                      open={isOpen}
                      onToggle={() => toggleRevision(r.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisionCard({ revision, request, classes, open, onToggle }) {
  const decided = request?.decided_date;
  const approvalState = request?.status === 'approved' ? 'Approved'
    : request?.status === 'rejected' ? 'Rejected'
    : request?.status === 'pending' ? 'Pending approval'
    : null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-sm font-semibold text-slate-900">rev {revision.revision_number}</span>
        <span className="text-xs text-slate-400">· {fmtDate(revision.created_date)}</span>
        {approvalState && (
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            request.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
              : request.status === 'rejected' ? 'bg-rose-50 text-rose-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {request.status === 'approved' ? <ShieldCheck className="h-3 w-3" />
              : request.status === 'rejected' ? <XCircle className="h-3 w-3" />
              : <Clock className="h-3 w-3" />}
            {approvalState}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3">
          {approvalState && (
            <div className="text-xs text-slate-500">
              {request.approver_name && <span>by {request.approver_name}{request.self_approved ? ' (self-approved)' : ''} </span>}
              {decided && <span className="text-slate-400">· {fmtDate(decided)}</span>}
            </div>
          )}
          {request?.reason?.trim() && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{request.reason}</div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Classes & quizzes</div>
            {classes.length === 0 ? (
              <div className="text-sm italic text-slate-400">No classes in this curriculum.</div>
            ) : (
              <div className="space-y-1.5">
                {classes.map((cl, idx) => {
                  const Meta = contentTypeMeta[cl.content_type] || contentTypeMeta.pdf;
                  const Icon = Meta.icon;
                  return (
                    <div key={idx} className="rounded-md bg-slate-50/70 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-800">{cl.title}</span>
                        <span className="text-xs text-slate-400">{Meta.label}</span>
                        {cl.duration_minutes > 0 && <span className="text-xs text-slate-400">· {cl.duration_minutes} min</span>}
                        {cl.has_quiz && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                            <ListChecks className="h-3 w-3" /> Quiz
                          </span>
                        )}
                      </div>
                      {cl.has_quiz && <QuizHistoryRow cl={cl} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuizHistoryRow({ cl }) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(cl.quiz?.questions ?? null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // Snapshot revisions carry frozen questions; synthesized/legacy ones fall
    // back to the live quiz for the current class.
    if (next && questions == null && cl.id) {
      setLoading(true);
      try {
        const qp = await base44.entities.Quiz.filter({ class_id: cl.id }, { limit: 1 });
        const quiz = (qp.items || qp)[0];
        if (!quiz) { setQuestions([]); return; }
        const qqPage = await base44.entities.QuizQuestion.filter({ quiz_id: quiz.id }, { sort: 'created_date' });
        setQuestions((qqPage.items || qqPage).map((q) => ({
          question: q.question,
          question_type: q.question_type,
          correct_answer: quizCorrectAnswer(q),
        })));
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    }
  }

  if (!cl.quiz) {
    return <div className="mt-1 ml-6 text-xs italic text-slate-400">Quiz loading…</div>;
  }

  const summary = `${cl.quiz.title} · ${cl.quiz.questionCount} question${cl.quiz.questionCount !== 1 ? 's' : ''} · pass ${cl.quiz.passing_score}%`;

  return (
    <div className="mt-1 ml-6">
      <button type="button" onClick={toggle} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span>{summary}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 border-l border-slate-200 pl-3">
          {loading ? (
            <div className="text-xs text-slate-400">Loading questions…</div>
          ) : !questions || questions.length === 0 ? (
            <div className="text-xs italic text-slate-400">No questions available for this revision.</div>
          ) : (
            questions.map((q, i) => (
              <div key={i} className="text-xs">
                <div className="font-medium text-slate-700">{i + 1}. {q.question}</div>
                <div className="ml-3 font-medium text-emerald-700">✓ {q.correct_answer || '—'}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}