import React from 'react';
import { Button } from '../ui/button';
import { ShieldAlert, Eye } from 'lucide-react';

const opLabel = (op, targetType) => {
  if (targetType === 'quiz') return 'Quiz update';
  return op === 'add' ? 'Add class' : op === 'delete' ? 'Remove class' : 'Edit class';
};

export default function ChangeApprovalsPanel({ requests, onReview, busyId }) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-800">Pending change approvals</h2>
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-700">
          {requests.length}
        </span>
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                {opLabel(req.operation, req.target_type)}: {req.class_title || 'Quiz'}
              </div>
              <div className="truncate text-xs text-slate-500">
                in {req.curriculum_name} · Requested by {req.requested_by_name || '—'}
                {req.reason ? ` · “${req.reason}”` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => onReview(req)} disabled={busyId === req.id}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Review
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}