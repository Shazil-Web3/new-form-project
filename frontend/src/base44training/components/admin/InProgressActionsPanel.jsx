import React, { useEffect, useState } from 'react';
import { base44 } from '../../base44Client';
import { getCurrentUser, formatDateTime } from '../../lib/training';
import {
  ClipboardList, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle,
  Trash2, Plus, Pencil, Archive, FileX2, Layers, BookOpen,
} from 'lucide-react';

const opMeta = {
  add: { label: 'Add', Icon: Plus, badge: 'bg-emerald-100 text-emerald-700' },
  edit: { label: 'Edit', Icon: Pencil, badge: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Delete', Icon: FileX2, badge: 'bg-rose-100 text-rose-700' },
};

const reqStatusMeta = {
  pending: { label: 'In review', Icon: Clock, badge: 'bg-amber-100 text-amber-700', note: 'bg-amber-50 text-amber-800' },
  rejected: { label: 'Rejected', Icon: XCircle, badge: 'bg-rose-100 text-rose-700', note: 'bg-rose-50 text-rose-800' },
  approved: { label: 'Approved', Icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', note: 'bg-emerald-50 text-emerald-800' },
};

const reqKindLabel = (k) => (k === 'publish' ? 'Publish' : k === 'archive' ? 'Archive' : 'Change');

function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2">
        {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{count}</span>
      </button>
      {open && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

export default function InProgressActionsPanel({ refreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [staged, setStaged] = useState([]);
  const [requests, setRequests] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reviewsByBatch, setReviewsByBatch] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const me = await getCurrentUser();
        const uid = me?.id || '';

        const [clsPage, pub, arch, chg, batchPage] = await Promise.all([
          base44.entities.Class.filter(
            { $or: [{ pending_operation: { $ne: 'none' } }, { archived: true }] },
            { sort: '-created_date', limit: 200 }
          ),
          base44.entities.PublishRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 30 }),
          base44.entities.ArchiveRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 30 }),
          base44.entities.ChangeRequest.filter({ status: { $in: ['pending', 'rejected'] } }, { sort: '-decided_date', limit: 30 }),
          base44.entities.LibraryBatch.filter({ status: 'pending' }, { sort: '-created_date', limit: 20 }),
        ]);

        const classes = clsPage.items || clsPage || [];
        // Staged class actions: pending add/edit/delete, plus archived copies.
        const stagedList = classes
          .filter((c) => c.pending_operation !== 'none' || c.archived)
          .map((c) => ({
            id: c.id,
            title: c.title,
            curriculum_name: c.curriculum_name || '—',
            op: c.archived ? 'archive' : c.pending_operation,
            date: c.updated_date || c.created_date,
          }));
        setStaged(stagedList);

        const flat = (arr, kind) => (arr.items || arr || []).map((r) => ({ ...r, _kind: kind }));
        const allReq = [...flat(pub, 'publish'), ...flat(arch, 'archive'), ...flat(chg, 'change')]
          .filter((r) => !uid || r.requested_by_id === uid)
          .sort((a, b) => new Date(b.decided_date || b.created_date) - new Date(a.decided_date || a.created_date));
        setRequests(allReq);

        const batchList = batchPage.items || batchPage || [];
        setBatches(batchList);
        if (batchList.length > 0) {
          const ids = batchList.map((b) => b.id);
          const revPage = await base44.entities.LibraryBatchReview.filter(
            { batch_id: { $in: ids } }, { sort: '-created_date', limit: 500 }
          );
          const revs = revPage.items || revPage;
          const map = {};
          revs.forEach((r) => { (map[r.batch_id] ||= []).push(r); });
          setReviewsByBatch(map);
        } else {
          setReviewsByBatch({});
        }
      } catch {
        setStaged([]);
        setRequests([]);
        setBatches([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  async function handleDeleteRequest(r) {
    const key = `${r._kind}-${r.id}`;
    setBusyId(key);
    try {
      const entity =
        r._kind === 'publish' ? base44.entities.PublishRequest
          : r._kind === 'archive' ? base44.entities.ArchiveRequest
            : base44.entities.ChangeRequest;
      await entity.delete(r.id);
      setRequests((prev) => prev.filter((x) => `${x._kind}-${x.id}` !== key));
    } finally {
      setBusyId(null);
    }
  }

  const pendingReqs = requests.filter((r) => r.status === 'pending');
  const rejectedReqs = requests.filter((r) => r.status === 'rejected');
  const total = staged.length + pendingReqs.length + rejectedReqs.length + batches.length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-400">
        <ClipboardList className="h-4 w-4 animate-pulse" /> Loading in-progress actions…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">In progress</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">0</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          No actions in progress. Staged class changes (add, edit, delete, archive), approval requests you send, and library update batches will all appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="mb-1 flex w-full items-center gap-2">
        {open ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
        <ClipboardList className="h-4 w-4 text-slate-600" />
        <h2 className="text-sm font-semibold text-slate-900">In progress</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{total}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {staged.length > 0 && (
            <Section title="Staged changes" count={staged.length}>
              {staged.map((s) => {
                const isArchive = s.op === 'archive';
                const meta = isArchive
                  ? { label: 'Archive', Icon: Archive, badge: 'bg-amber-100 text-amber-700' }
                  : opMeta[s.op] || opMeta.edit;
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
                    <meta.Icon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="flex-1 truncate font-medium text-slate-700">{s.title}</span>
                    <span className="text-slate-400">{s.curriculum_name}</span>
                    {s.date && <span className="text-slate-400">{new Date(s.date).toLocaleDateString()}</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                      <meta.Icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                );
              })}
              <p className="px-1 pt-1 text-xs text-slate-400">
                Staged changes are sent to the manager when you request curriculum approval.
              </p>
            </Section>
          )}

          {pendingReqs.length > 0 && (
            <Section title="Awaiting manager review" count={pendingReqs.length}>
              {pendingReqs.map((r) => (
                <div key={`${r._kind}-${r.id}`} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium text-slate-700">{reqKindLabel(r._kind)}</span>
                  <span className="flex-1 truncate text-slate-600">{r.specialty_name || r.curriculum_name || r.class_title || '—'}</span>
                  <span className="text-slate-400">{r.created_date ? new Date(r.created_date).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </Section>
          )}

          {rejectedReqs.length > 0 && (
            <Section title="Rejected — needs attention" count={rejectedReqs.length}>
              {rejectedReqs.map((r) => (
                <div key={`${r._kind}-${r.id}`} className="rounded-md bg-white p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {reqKindLabel(r._kind)} · {r.specialty_name || r.curriculum_name || r.class_title || '—'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(r)}
                        disabled={busyId === `${r._kind}-${r.id}`}
                        title="Delete this request"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {r.decision_note?.trim() && (
                    <div className="mt-1.5 rounded-md bg-rose-50 p-2 text-rose-800">“{r.decision_note}”</div>
                  )}
                  <div className="mt-1 text-slate-400">Reviewed by {r.approver_name || '—'}{r.self_approved ? ' (self-approved)' : ''}</div>
                </div>
              ))}
            </Section>
          )}

          {batches.length > 0 && (
            <Section title="Library batches" count={batches.length}>
              {batches.map((batch) => {
                const reviews = reviewsByBatch[batch.id] || [];
                const approved = reviews.filter((r) => r.status === 'approved').length;
                const rejected = reviews.filter((r) => r.status === 'rejected').length;
                const pending = reviews.filter((r) => r.status === 'pending').length;
                return (
                  <div key={batch.id} className="rounded-md bg-white p-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="font-medium text-slate-700">
                        {(batch.changed_items || []).length} class update{(batch.changed_items || []).length === 1 ? '' : 's'}
                      </span>
                      <span className="text-slate-400">· {formatDateTime(batch.created_date)}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {approved > 0 && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">{approved} ✓</span>}
                        {pending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">{pending} ⏳</span>}
                        {rejected > 0 && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">{rejected} ✕</span>}
                      </span>
                    </div>
                    {reviews.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {reviews.map((r) => (
                          <div key={r.id} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-xs">
                            <BookOpen className="h-3 w-3 text-slate-400" />
                            <span className="flex-1 truncate text-slate-600">{r.curriculum_name}</span>
                            {r.status === 'pending' && <span className="text-amber-600">Awaiting</span>}
                            {r.status === 'approved' && <span className="text-emerald-700">Rolled out</span>}
                            {r.status === 'rejected' && <span className="text-rose-700">Rejected</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}