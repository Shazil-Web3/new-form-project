import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, Video, Radio, HelpCircle, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import QuizPreviewDialog from './QuizPreviewDialog';
import { base44 } from '../../base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';

const contentTypeMeta = {
  pdf: { label: 'PDF', Icon: FileText, color: 'text-rose-500' },
  on_demand_video: { label: 'Video', Icon: Video, color: 'text-violet-500' },
  live_class: { label: 'Live class', Icon: Radio, color: 'text-sky-500' },
  linked_document: { label: 'Linked document', Icon: FileText, color: 'text-amber-500' },
};

export default function CurriculumPreviewDialog({ curriculum, onClose }) {
  const open = !!curriculum;
  const [classes, setClasses] = useState([]);
  const [quizzesByClass, setQuizzesByClass] = useState({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [quizPreview, setQuizPreview] = useState(null);

  useEffect(() => {
    let active = true;
    setClasses([]);
    setQuizzesByClass({});
    setExpanded({});
    if (!curriculum?.curriculum_id && !curriculum?.id) return;
    const curId = curriculum.curriculum_id || curriculum.id;
    setLoading(true);
    base44.entities.Class.filter({ curriculum_id: curId }, { sort: 'order', limit: 200 })
      .then(async (page) => {
        if (!active) return;
        const list = page.items || page || [];
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        setClasses(list);
        const qMap = {};
        await Promise.all(list.map(async (c) => {
          try {
            const qp = await base44.entities.Quiz.filter({ class_id: c.id }, { limit: 1 });
            const q = (qp.items || qp)[0];
            if (q) qMap[c.id] = q;
          } catch { /* ignore */ }
        }));
        if (active) setQuizzesByClass(qMap);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [curriculum?.curriculum_id, curriculum?.id]);

  const name = curriculum?.curriculum_name || curriculum?.name || 'Curriculum';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-500" /> {name}
          </DialogTitle>
          <DialogDescription>Read-only preview of this curriculum's content.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading content…
          </div>
        ) : (
          <div className="space-y-2">
            {classes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                This curriculum has no classes yet.
              </div>
            ) : (
              classes.map((c) => {
                const meta = contentTypeMeta[c.content_type] || contentTypeMeta.pdf;
                const quiz = quizzesByClass[c.id];
                const isOpen = !!expanded[c.id];
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/60">
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      className="flex w-full items-center gap-2 p-3 text-left"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <meta.Icon className={`h-4 w-4 ${meta.color}`} />
                      <span className="flex-1 truncate text-sm font-medium text-slate-900">{c.title}</span>
                      <span className="text-xs text-slate-400">{meta.label}</span>
                      {quiz && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          <HelpCircle className="h-3 w-3" /> Quiz
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                        {c.description?.trim() && (
                          <div className="text-sm text-slate-600">{c.description}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          <div><span className="text-slate-400">Type:</span> <span className="font-medium text-slate-700">{c.type || 'required'}</span></div>
                          {c.duration_minutes ? <div><span className="text-slate-400">Duration:</span> <span className="font-medium text-slate-700">{c.duration_minutes} min</span></div> : null}
                          {c.live_class_date ? <div><span className="text-slate-400">Live:</span> <span className="font-medium text-slate-700">{new Date(c.live_class_date).toLocaleString()}</span></div> : null}
                        </div>
                        {quiz && (
                          <button
                            type="button"
                            onClick={() => setQuizPreview(quiz)}
                            className="flex w-full items-center gap-1 rounded-md border border-violet-100 bg-violet-50/50 p-2 text-left text-xs text-violet-700 transition hover:bg-violet-100/70"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            Quiz: {quiz.title} · Passing score {quiz.passing_score ?? 70}%
                            <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-violet-400">View →</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
      <QuizPreviewDialog quiz={quizPreview} onClose={() => setQuizPreview(null)} />
    </Dialog>
  );
}