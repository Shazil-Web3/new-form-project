import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { formatDateTime } from '../../lib/training';
import { Check, X, Clock, Loader2, Layers, BookOpen } from 'lucide-react';

export default function LibraryBatchStatusPanel({ refreshKey }) {
  const [batches, setBatches] = useState([]);
  const [reviewsByBatch, setReviewsByBatch] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const page = await base44.entities.LibraryBatch.filter(
          { status: 'pending' },
          { sort: '-created_date', limit: 20 }
        );
        const list = page.items || page;
        setBatches(list);
        if (list.length === 0) {
          setReviewsByBatch({});
          return;
        }
        const batchIds = list.map((b) => b.id);
        const revPage = await base44.entities.LibraryBatchReview.filter(
          { batch_id: { $in: batchIds } },
          { sort: '-created_date', limit: 500 }
        );
        const revs = revPage.items || revPage;
        const map = {};
        revs.forEach((r) => { (map[r.batch_id] ||= []).push(r); });
        setReviewsByBatch(map);
      } catch {
        setBatches([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading batch status…
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-900">Library batches</span>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">0</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          No library update batches pending review. Batches you submit from the Class Library will appear here with their per-curriculum review status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const reviews = reviewsByBatch[batch.id] || [];
        const approved = reviews.filter((r) => r.status === 'approved');
        const rejected = reviews.filter((r) => r.status === 'rejected');
        const pending = reviews.filter((r) => r.status === 'pending');
        return (
          <div key={batch.id} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">Library batch</span>
              <span className="text-xs text-slate-500">
                {(batch.changed_items || []).length} class update{(batch.changed_items || []).length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-slate-400">· {formatDateTime(batch.created_date)}</span>
              <span className="ml-auto flex items-center gap-2 text-xs">
                {approved.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                    <Check className="h-3 w-3" /> {approved.length} approved
                  </span>
                )}
                {pending.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                    <Clock className="h-3 w-3" /> {pending.length} pending
                  </span>
                )}
                {rejected.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                    <X className="h-3 w-3" /> {rejected.length} rejected
                  </span>
                )}
              </span>
            </div>
            {reviews.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {reviews.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span className="flex-1 truncate font-medium text-slate-700">{r.curriculum_name}</span>
                    {r.status === 'pending' && <span className="text-amber-600">Awaiting review</span>}
                    {r.status === 'approved' && <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" /> Rolled out</span>}
                    {r.status === 'rejected' && <span className="inline-flex items-center gap-1 text-rose-700"><X className="h-3 w-3" /> Rejected</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}