import React from 'react';
import { Button } from '../ui/button';
import { Clock, Eye } from 'lucide-react';

export default function PublishApprovalsPanel({ requests, onReview, busyId }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-emerald-900">Pending publish approvals</h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{requests.length}</span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{r.curriculum_name}</div>
              <div className="truncate text-xs text-slate-500">
                Requested by {r.requested_by_name || '—'}
                {r.reason ? ` · “${r.reason}”` : ' · No notes provided'}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="default" onClick={() => onReview(r)} disabled={busyId === r.id}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Review
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}