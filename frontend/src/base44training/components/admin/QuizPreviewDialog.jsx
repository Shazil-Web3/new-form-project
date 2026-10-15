import React, { useEffect, useState } from 'react';
import { HelpCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '../../base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';

const typeLabel = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  fill_blank: 'Fill in the blank (typed)',
  fill_blank_choice: 'Fill in the blank',
  matching: 'Matching',
};

export default function QuizPreviewDialog({ quiz, onClose }) {
  const open = !!quiz;
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setQuestions([]);
    if (!quiz?.id) return;
    setLoading(true);
    base44.entities.QuizQuestion.filter({ quiz_id: quiz.id }, { sort: 'created_date', limit: 200 })
      .then((page) => { if (active) setQuestions(page.items || page || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quiz?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-violet-500" /> {quiz?.title || 'Quiz'}
          </DialogTitle>
          <DialogDescription>
            Read-only preview · Passing score {quiz?.passing_score ?? 70}% · {questions.length} question{questions.length === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading questions…
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            This quiz has no questions yet.
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={q.id || i} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">
                    <span className="mr-1 text-slate-400">Q{i + 1}.</span>{q.question}
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {typeLabel[q.question_type] || q.question_type}
                  </span>
                </div>

                {(q.question_type === 'multiple_choice' || q.question_type === 'fill_blank_choice') && Array.isArray(q.options) && (
                  <ul className="mt-2 space-y-1">
                    {q.options.map((opt, idx) => (
                      <li key={idx} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}>
                        {idx === q.correct_index ? <CheckCircle2 className="h-4 w-4" /> : <span className="ml-4 inline-block h-4 w-4" />}
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {q.question_type === 'true_false' && (
                  <div className="mt-2 flex gap-2">
                    {['True', 'False'].map((opt, idx) => (
                      <span key={opt} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${idx === q.correct_index ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                        {idx === q.correct_index && <CheckCircle2 className="h-4 w-4" />}{opt}
                      </span>
                    ))}
                  </div>
                )}

                {q.question_type === 'fill_blank' && Array.isArray(q.acceptable_answers) && q.acceptable_answers.length > 0 && (
                  <div className="mt-2 text-sm text-slate-600">
                    <span className="text-slate-400">Accepted answers:</span>{' '}
                    {q.acceptable_answers.map((a) => `"${a}"`).join(', ')}
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
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}