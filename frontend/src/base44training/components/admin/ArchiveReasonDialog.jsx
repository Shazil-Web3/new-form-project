import React, { useEffect, useState } from 'react';
import { Archive, ShieldCheck, Clock } from 'lucide-react';
import { base44 } from '../../base44Client';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

// Supports both curriculum and specialty archive reasons. Pass either prop.
export default function ArchiveReasonDialog({ curriculum, specialty, onClose }) {
  const item = specialty || curriculum;
  const kind = specialty ? 'specialty' : 'curriculum';
  const open = !!item;
  const [request, setRequest] = useState(null);
  const [loadingReq, setLoadingReq] = useState(false);

  useEffect(() => {
    let active = true;
    setRequest(null);
    if (!item?.id) return;
    const query = kind === 'specialty'
      ? { target_type: 'specialty', specialty_id: item.id }
      : { curriculum_id: item.id };
    setLoadingReq(true);
    base44.entities.ArchiveRequest.filter(query, { sort: '-created_date', limit: 1 })
      .then((page) => { if (active) setRequest((page.items || page)[0] || null); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingReq(false); });
    return () => { active = false; };
  }, [item?.id, kind]);

  const decided = request?.decided_date;
  const approvalState = request?.status === 'approved' ? 'Approved'
    : request?.status === 'rejected' ? 'Rejected'
    : request?.status === 'pending' ? 'Pending approval'
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-slate-500" />
            Archive history
          </DialogTitle>
          <DialogDescription className="sr-only">Why this {kind} was archived</DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{kind === 'specialty' ? 'Specialty' : 'Curriculum'}</div>
              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Archived on</div>
              <div className="text-sm text-slate-700">{fmtDate(item.updated_date)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Manager approval</div>
              {loadingReq ? (
                <div className="text-sm text-slate-400">Loading…</div>
              ) : approvalState ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    request.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                      : request.status === 'rejected' ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {request.status === 'approved' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {approvalState}
                  </span>
                  {request.approver_name && (
                    <span className="text-slate-600">by {request.approver_name}{request.self_approved ? ' (self-approved)' : ''}</span>
                  )}
                  <span className="text-slate-400">· {fmtDate(decided)}</span>
                </div>
              ) : (
                <div className="text-sm italic text-slate-400">No approval record found.</div>
              )}
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Reason</div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {item.archive_reason?.trim() || <span className="italic text-slate-400">No reason was provided.</span>}
              </div>
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