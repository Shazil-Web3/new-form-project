import React from 'react';
import { Button } from '../ui/button';
import { Layers, Eye } from 'lucide-react';

export default function LibraryBatchApprovalsPanel({ reviews, onReview, busyId }) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-5 w-5 text-indigo-600" />
        <h2 className="text-sm font-semibold text-indigo-800">Library update approvals</h2>
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700">
          {reviews.length}
        </span>
      </div>
      <div className="space-y-2">
        {reviews.map((rev) => (
          <div key={rev.id} className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                Library batch update
              </div>
              <div className="truncate text-xs text-slate-500">
                for {rev.curriculum_name || '—'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => onReview(rev)} disabled={busyId === rev.id}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Review
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}