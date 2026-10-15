import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { getCurrentUser } from '../../lib/training';
import { MessageSquare, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const kindLabel = (k) => (k === 'publish' ? 'Publish' : k === 'archive' ? 'Archive' : 'Change');

const statusMeta = {
  pending: { label: 'In review', Icon: Clock, badge: 'bg-amber-100 text-amber-700', note: 'bg-amber-50 text-amber-800' },
  rejected: { label: 'Rejected', Icon: XCircle, badge: 'bg-rose-100 text-rose-700', note: 'bg-rose-50 text-rose-800' },
  approved: { label: 'Approved', Icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', note: 'bg-emerald-50 text-emerald-800' },
};

export default function RejectedFeedbackPanel({ refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const handleDelete = async (r) => {
    const key = `${r._kind}-${r.id}`;
    setBusyId(key);
    try {
      const entity =
        r._kind === 'publish' ? base44.entities.PublishRequest
          : r._kind === 'archive' ? base44.entities.ArchiveRequest
            : base44.entities.ChangeRequest;
      await entity.delete(r.id);
      setItems((prev) => prev.filter((x) => `${x._kind}-${x.id}` !== key));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      const uid = me?.id || '';
      const [pub, arch, chg] = await Promise.all([
        base44.entities.PublishRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 20 }),
        base44.entities.ArchiveRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 20 }),
        base44.entities.ChangeRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 20 }),
      ]);
      const flat = (arr, kind) => (arr.items || arr || []).map((r) => ({ ...r, _kind: kind }));
      const all = [...flat(pub, 'publish'), ...flat(arch, 'archive'), ...flat(chg, 'change')]
        .filter((r) => !uid || r.requested_by_id === uid)
        .sort((a, b) => new Date(b.decided_date || b.created_date) - new Date(a.decided_date || a.created_date))
        .slice(0, 12);
      setItems(all);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Your approval requests</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">0</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          No approval requests sent yet. Publish, archive, or change requests you send for manager approval will appear here with their review status.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center gap-2"
      >
        {open ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
        <MessageSquare className="h-4 w-4 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-900">Your approval requests</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{items.length}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {items.map((r) => {
            const meta = statusMeta[r.status] || statusMeta.pending;
            const isPending = r.status === 'pending';
            return (
              <div key={`${r._kind}-${r.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">
                    {kindLabel(r._kind)} · {r.specialty_name || r.curriculum_name || r.class_title || '—'}
                  </div>
                  <span className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    <meta.Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {isPending
                      ? `Sent for review${r.created_date ? ` · ${new Date(r.created_date).toLocaleDateString()}` : ''}`
                      : `Reviewed by ${r.approver_name || '—'}${r.self_approved ? ' (self-approved)' : ''}${r.decided_date ? ` · ${new Date(r.decided_date).toLocaleDateString()}` : ''}`}
                  </span>
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={busyId === `${r._kind}-${r.id}`}
                      title="Delete this request"
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
                {isPending ? (
                  <div className={`mt-2 rounded-md p-2 text-sm ${meta.note}`}>
                    Awaiting manager review.
                  </div>
                ) : r.decision_note?.trim() ? (
                  <div className={`mt-2 rounded-md p-2 text-sm ${meta.note}`}>
                    “{r.decision_note}”
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}