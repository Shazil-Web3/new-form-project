import React, { useEffect, useState } from 'react';
import { Info, CalendarPlus, ShieldCheck, Clock, GitCommit } from 'lucide-react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

const fmt = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const statusBadge = (status) => {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700';
  if (status === 'archived') return 'bg-slate-200 text-slate-600';
  return 'bg-amber-50 text-amber-700';
};
const statusLabel = (status) =>
  status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft';

export default function CurriculumInfoDialog({ curriculum, onClose }) {
  const open = !!curriculum;
  const [revisions, setRevisions] = useState([]);
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setRevisions([]);
    setApproval(null);
    if (!curriculum?.id) return;
    setLoading(true);
    Promise.all([
      base44.entities.CurriculumRevision.filter({ curriculum_id: curriculum.id }, { sort: '-revision_number', limit: 100 }),
      base44.entities.PublishRequest.filter({ curriculum_id: curriculum.id }, { sort: '-created_date', limit: 1 }),
      base44.entities.ArchiveRequest.filter({ curriculum_id: curriculum.id }, { sort: '-created_date', limit: 1 }),
    ])
      .then(([revs, pub, arch]) => {
        if (!active) return;
        const revList = revs.items || revs || [];
        // Fallback: if no revision records exist yet, show the current curriculum as Rev 1.
        if (revList.length === 0 && curriculum) {
          setRevisions([{
            revision_number: 1,
            name: curriculum.name,
            description: curriculum.description,
            status: curriculum.status,
            created_date: curriculum.updated_date || curriculum.created_date,
          }]);
        } else {
          setRevisions(revList);
        }
        const p = (pub.items || pub)[0];
        const a = (arch.items || arch)[0];
        const candidates = [p, a].filter(Boolean).filter((r) => r.decided_date);
        candidates.sort((x, y) => new Date(y.decided_date) - new Date(x.decided_date));
        setApproval(candidates[0] || null);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [curriculum?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-slate-500" /> Curriculum information
          </DialogTitle>
          <DialogDescription className="sr-only">Revision history and approval details</DialogDescription>
        </DialogHeader>
        {curriculum && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Curriculum</div>
              <div className="text-sm font-semibold text-slate-900">{curriculum.name}</div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revision history</h3>
              </div>
              {loading ? (
                <div className="text-sm text-slate-400">Loading…</div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {revisions.map((r, idx) => (
                    <div key={r.id || idx} className={`rounded-lg border p-3 ${idx === 0 ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">Rev {r.revision_number}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(r.status)}`}>{statusLabel(r.status)}</span>
                          {idx === 0 && <span className="text-xs font-medium text-sky-600">· Current</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {fmt(r.created_date)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</div>
                        <div className="text-sm text-slate-700">
                          {r.description?.trim() ? r.description : <span className="italic text-slate-400">No description provided.</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                {approval ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-slate-400" />}
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Manager approval</div>
              </div>
              {loading ? (
                <div className="mt-1 text-sm text-slate-400">Loading…</div>
              ) : approval ? (
                <div className="mt-1 text-sm text-slate-700">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    approval.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                      : approval.status === 'rejected' ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </span>
                  {approval.approver_name && <span className="ml-2 text-slate-600">by {approval.approver_name}{approval.self_approved ? ' (self-approved)' : ''}</span>}
                  <div className="mt-1 text-xs text-slate-500">Approved on {fmt(approval.decided_date)}</div>
                </div>
              ) : (
                <div className="mt-1 text-sm italic text-slate-400">No approval record found.</div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}