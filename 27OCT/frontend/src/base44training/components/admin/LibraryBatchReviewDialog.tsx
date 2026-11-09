import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  FileText, Video, Radio, HelpCircle, ShieldAlert, Check, X, Loader2, BookOpen, Layers,
} from 'lucide-react';

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

export default function LibraryBatchReviewDialog({ review, batch, onClose, onApprove, onReject, busy }) {
  const open = !!review;
  const [mode, setMode] = useState('review');
  const [reason, setReason] = useState('');

  useEffect(() => {
    setMode('review');
    setReason('');
  }, [review?.id]);

  if (!review) return null;

  const changedItems = batch?.changed_items || [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" /> Library update for {review.curriculum_name}
          </DialogTitle>
          <DialogDescription>
            Review the shared library changes below. Approving rolls these updates out to this
            curriculum immediately. Other curricula are reviewed separately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {changedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No changed items in this batch.
            </div>
          ) : (
            changedItems.map((item, i) => {
              const cs = item.content_snapshot || {};
              const meta = contentTypeMeta[cs.content_type] || contentTypeMeta.pdf;
              const qs = item.quiz_snapshot;
              return (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-2">
                    <meta.Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className="flex-1 truncate text-sm font-medium text-slate-900">{cs.title || item.class_title}</span>
                    <span className="text-xs text-slate-400">{meta.label}</span>
                    {qs && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        <HelpCircle className="h-3 w-3" /> Quiz
                      </span>
                    )}
                  </div>
                  {cs.description?.trim() && (
                    <div className="mt-2 text-sm text-slate-600">{cs.description}</div>
                  )}
                  {cs.duration_minutes > 0 && (
                    <div className="mt-1 text-xs text-slate-400">{cs.duration_minutes} min</div>
                  )}
                  {qs && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5">
                      <div className="text-xs text-slate-500">
                        Passing score <span className="font-medium text-slate-700">{qs.passing_score ?? 70}%</span> · {(qs.questions || []).length} question{(qs.questions || []).length === 1 ? '' : 's'}
                      </div>
                      {(qs.questions || []).length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">No questions.</div>
                      ) : (
                        <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1">
                          {(qs.questions || []).map((q, qi) => <QuestionPreview key={qi} q={q} i={qi} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {mode === 'review' ? (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="outline" onClick={() => setMode('rejecting')} disabled={busy}>
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => onApprove(review)} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Approve & Roll out
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason for rejection <span className="text-rose-500">*</span></label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this update is being rejected for this curriculum."
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('review')} disabled={busy}>Back</Button>
              <Button variant="destructive" onClick={() => onReject(review, reason.trim())} disabled={busy || !reason.trim()}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />} Confirm rejection
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}