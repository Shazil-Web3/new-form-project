import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { approveChangeRequest, approveArchiveRequest, approvePublishRequest, approveBatchReviewRequest } from '../lib/approvals';
import ArchiveApprovalsPanel from '../components/admin/ArchiveApprovalsPanel';
import PublishApprovalsPanel from '../components/admin/PublishApprovalsPanel';
import ChangeApprovalsPanel from '../components/admin/ChangeApprovalsPanel';
import ReviewRequestDialog from '../components/admin/ReviewRequestDialog';
import LibraryBatchApprovalsPanel from '../components/admin/LibraryBatchApprovalsPanel';
import LibraryBatchReviewDialog from '../components/admin/LibraryBatchReviewDialog';
import { Inbox } from 'lucide-react';

export default function ManagerTasks() {
  const [user, setUser] = useState(null);
  const [archiveRequests, setArchiveRequests] = useState([]);
  const [publishRequests, setPublishRequests] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [batchReviews, setBatchReviews] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null); // { request, kind }
  const [batchReviewing, setBatchReviewing] = useState(null); // { review, batch }

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      await loadRequests();
      setLoading(false);
    })();
  }, []);

  async function loadRequests() {
    const [arch, pub, chg, batchRev] = await Promise.all([
      base44.entities.ArchiveRequest.filter({ status: 'pending' }, { sort: '-created_date' }),
      base44.entities.PublishRequest.filter({ status: 'pending' }, { sort: '-created_date' }),
      base44.entities.ChangeRequest.filter({ status: 'pending' }, { sort: '-created_date' }),
      base44.entities.LibraryBatchReview.filter({ status: 'pending' }, { sort: '-created_date' }),
    ]);
    setArchiveRequests(arch.items || arch || []);
    setPublishRequests(pub.items || pub || []);
    setChangeRequests(chg.items || chg || []);
    setBatchReviews(batchRev.items || batchRev || []);
  }


  async function approveChange(req) {
    setBusyId(req.id);
    try {
      await approveChangeRequest(req, user);
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectChange(req, note) {
    setBusyId(req.id);
    try {
      // Rejecting an add removes the provisionally-created class.
      if (req.target_type === 'class' && req.operation === 'add' && req.class_id) {
        await base44.entities.Class.delete(req.class_id);
      }
      await base44.entities.ChangeRequest.update(req.id, {
        status: 'rejected',
        approver_id: user?.id || '',
        approver_name: user?.full_name || user?.email || '',
        decided_date: new Date().toISOString(),
        decision_note: note || '',
      });
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function approveArchive(req) {
    setBusyId(req.id);
    try {
      await approveArchiveRequest(req, user);
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }


  async function rejectArchive(req, note) {
    setBusyId(req.id);
    try {
      // Rejecting a class archive restores the class so it is no longer archived.
      if (req.target_type === 'class' && req.class_id) {
        await base44.entities.Class.update(req.class_id, { archived: false });
      }
      await base44.entities.ArchiveRequest.update(req.id, {
        status: 'rejected',
        approver_id: user?.id || '',
        approver_name: user?.full_name || user?.email || '',
        decided_date: new Date().toISOString(),
        decision_note: note || '',
      });
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function approvePublish(req) {
    setBusyId(req.id);
    try {
      await approvePublishRequest(req, user);
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectPublish(req, note) {
    setBusyId(req.id);
    try {
      await base44.entities.PublishRequest.update(req.id, {
        status: 'rejected',
        approver_id: user?.id || '',
        approver_name: user?.full_name || user?.email || '',
        decided_date: new Date().toISOString(),
        decision_note: note || '',
      });
      setReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function approveBatchReview(review) {
    setBusyId(review.id);
    try {
      await approveBatchReviewRequest(review, user);
      setBatchReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function rejectBatchReview(review, note) {
    setBusyId(review.id);
    try {
      await base44.entities.LibraryBatchReview.update(review.id, {
        status: 'rejected',
        approver_id: user?.id || '',
        approver_name: user?.full_name || user?.email || '',
        decided_date: new Date().toISOString(),
        decision_note: note || '',
      });
      // Mark the batch completed when every affected curriculum has been decided.
      const batch = await base44.entities.LibraryBatch.get(review.batch_id);
      const allReviewsPage = await base44.entities.LibraryBatchReview.filter({ batch_id: batch.id });
      const allReviews = allReviewsPage.items || allReviewsPage;
      const allDecided = allReviews.every((r) => r.status === 'approved' || r.status === 'rejected');
      if (allDecided) {
        await base44.entities.LibraryBatch.update(batch.id, { status: 'completed' });
      }
      setBatchReviewing(null);
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function openBatchReview(review) {
    const batch = await base44.entities.LibraryBatch.get(review.batch_id);
    setBatchReviewing({ review, batch });
  }

  function handleApprove(req) {
    const kind = reviewing?.kind;
    if (kind === 'change') return approveChange(req);
    if (kind === 'archive') return approveArchive(req);
    return approvePublish(req);
  }

  function handleReject(req, note) {
    const kind = reviewing?.kind;
    if (kind === 'change') return rejectChange(req, note);
    if (kind === 'archive') return rejectArchive(req, note);
    return rejectPublish(req, note);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin' && user.role !== 'manager') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  const total = archiveRequests.length + publishRequests.length + changeRequests.length + batchReviews.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-500">Approvals and actions waiting on you.</p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">You're all caught up</p>
          <p className="text-xs text-slate-400">No pending approvals right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ChangeApprovalsPanel
            requests={changeRequests}
            onReview={(r) => setReviewing({ request: r, kind: 'change' })}
            busyId={busyId}
          />
          <LibraryBatchApprovalsPanel
            reviews={batchReviews}
            onReview={openBatchReview}
            busyId={busyId}
          />
          <PublishApprovalsPanel
            requests={publishRequests}
            onReview={(r) => setReviewing({ request: r, kind: 'publish' })}
            busyId={busyId}
          />
          <ArchiveApprovalsPanel
            requests={archiveRequests}
            onReview={(r) => setReviewing({ request: r, kind: 'archive' })}
            busyId={busyId}
          />
        </div>
      )}

      <ReviewRequestDialog
        request={reviewing?.request}
        kind={reviewing?.kind}
        onClose={() => setReviewing(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        busy={!!busyId}
      />
      <LibraryBatchReviewDialog
        review={batchReviewing?.review}
        batch={batchReviewing?.batch}
        onClose={() => setBatchReviewing(null)}
        onApprove={approveBatchReview}
        onReject={rejectBatchReview}
        busy={!!busyId}
      />
    </div>
  );
}