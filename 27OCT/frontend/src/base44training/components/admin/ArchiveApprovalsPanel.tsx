import React from 'react';
import { Button } from '../ui/button';
import { Clock, Eye } from 'lucide-react';

export default function ArchiveApprovalsPanel({ requests, onReview, busyId }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-900">Pending archive approvals</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{requests.length}</span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => {
          const isSpecialty = r.target_type === 'specialty';
          const isClass = r.target_type === 'class';
          const name = isSpecialty ? r.specialty_name : isClass ? r.class_name : r.curriculum_name;
          const typeLabel = isSpecialty ? 'Specialty' : isClass ? 'Class' : 'Curriculum';
          return (
            <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">{name || '—'}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {typeLabel}
                  </span>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {isClass && r.curriculum_name ? `In ${r.curriculum_name} · ` : ''}
                  Requested by {r.requested_by_name || '—'}
                  {r.reason ? ` · “${r.reason}”` : ' · No reason provided'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="default" onClick={() => onReview(r)} disabled={busyId === r.id}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> Review
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}