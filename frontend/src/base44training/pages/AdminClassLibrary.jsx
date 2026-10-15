/* eslint-disable no-restricted-globals */ // native confirm() kept as in the Base44 original
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Video, Radio, HelpCircle, Search, Library, Plus, Pencil, History, Send, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, BookOpen, Layers, Trash2, Archive, Undo2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/use-toast';
import AddClassDialog from '../components/admin/AddClassDialog';
import EditClassDialog from '../components/admin/EditClassDialog';
import ClassRevisionHistoryDialog from '../components/admin/ClassRevisionHistoryDialog';
import SubmitLibraryBatchDialog from '../components/admin/SubmitLibraryBatchDialog';
import InProgressActionsPanel from '../components/admin/InProgressActionsPanel';
import PlaceClassInCurriculaDialog from '../components/admin/PlaceClassInCurriculaDialog';
import ConfirmTrashClassDialog from '../components/admin/ConfirmTrashClassDialog';
import LibraryTrashDialog from '../components/admin/LibraryTrashDialog';
import ApprovalChoiceDialog from '../components/admin/ApprovalChoiceDialog';
import { approveBatchReviewRequest, approveArchiveRequest } from '../lib/approvals';

const TYPE_META = {
  pdf: { label: 'PDF', icon: FileText, tone: 'text-rose-600 bg-rose-50' },
  on_demand_video: { label: 'Video', icon: Video, tone: 'text-indigo-600 bg-indigo-50' },
  live_class: { label: 'Live', icon: Radio, tone: 'text-emerald-600 bg-emerald-50' },
  linked_document: { label: 'Doc Link', icon: FileText, tone: 'text-amber-600 bg-amber-50' },
};

function formatLiveDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminClassLibrary() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [quizClassIds, setQuizClassIds] = useState(new Set());
  const [approvedClassIds, setApprovedClassIds] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyClass, setHistoryClass] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchRefresh, setBatchRefresh] = useState(0);
  const [curriculumFilter, setCurriculumFilter] = useState('all');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('active'); // active = Draft + Approved
  const [placing, setPlacing] = useState(null);
  const [approving, setApproving] = useState(null); // { kind: 'update' | 'archive', cls }
  const [placingBusy, setPlacingBusy] = useState(false);
  const [trashTarget, setTrashTarget] = useState(null);
  const [trashing, setTrashing] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const [cls, curs, quizzes] = await Promise.all([
        base44.entities.Class.list(),
        base44.entities.Curriculum.list(),
        base44.entities.Quiz.list(),
      ]);
      setClasses(cls);
      setCurriculums(curs);
      setQuizClassIds(new Set((quizzes.items || quizzes).map((q) => q.class_id)));
      // A class is "approved" (archive-only) when it — or any of its linked
      // copies — belongs to a published curriculum. Publishing a curriculum
      // doesn't create a ClassRevision, so membership is the authoritative
      // signal, not revision history.
      const allClasses = cls.items || cls;
      const allCurs = curs.items || curs;
      const publishedCurriculumIds = new Set(
        allCurs.filter((c) => c.status === 'published').map((c) => c.id)
      );
      const approved = new Set();
      allClasses.forEach((c) => {
        if (c.curriculum_id && publishedCurriculumIds.has(c.curriculum_id)) {
          approved.add(c.id);
          if (c.library_class_id) approved.add(c.library_class_id);
        }
      });
      setApprovedClassIds(approved);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  // Map each library master to the curricula its copies belong to, so a curriculum
  // filter can surface the master classes used by that curriculum.
  const masterToCurricula = new Map();
  classes.forEach((c) => {
    if (c.library_class_id && c.curriculum_id) {
      if (!masterToCurricula.has(c.library_class_id)) masterToCurricula.set(c.library_class_id, new Set());
      masterToCurricula.get(c.library_class_id).add(c.curriculum_id);
    }
  });
  const classMatchesCurriculum = (c, filterId) =>
    c.curriculum_id === filterId || (masterToCurricula.get(c.id) || new Set()).has(filterId);

  const curName = (id) => curriculums.find((c) => c.id === id)?.name || '—';

  // A "child" is a copy placed in a curriculum (points at its library class); only library classes own a quiz.
  const isChild = (c) => !!c.library_class_id;
  const normTitle = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // Library classes must have unique names (copies keep their parent's name, so they are ignored).
  const isTitleTaken = (title, ignoreId) => {
    const t = normTitle(title);
    return !!t && classes.some((c) => !c.library_class_id && !c.curriculum_id && !c.trashed_at && c.id !== ignoreId && normTitle(c.title) === t);
  };
  const showError = (error, fallback) => toast({
    title: 'Could not save',
    description: error?.response?.data?.error || fallback,
    variant: 'destructive',
  });

  const pendingClasses = classes.filter((c) => c.pending_library_update && !c.trashed_at);

  const liveClasses = classes.filter((c) => !c.trashed_at && !c.archived);
  // The library table keeps archived classes visible (marked "To be archived")
  // so admins can still see them while removal awaits manager approval.
  const tableClasses = classes.filter((c) => !c.trashed_at);
  const isArchivedFinal = (c) => c.archive_status === 'archived';
  const statusOf = (c) => (isArchivedFinal(c) ? 'archived' : (c.library_approved || approvedClassIds.has(c.id)) ? 'approved' : 'draft');
  const STATUS_STYLE = {
    draft: 'bg-slate-100 text-slate-600',
    approved: 'bg-emerald-50 text-emerald-700',
    archived: 'bg-amber-50 text-amber-700',
  };
  const trashedClasses = classes.filter((c) => c.trashed_at);

  const filtered = tableClasses.filter((c) => {
    if (typeFilter !== 'all' && c.content_type !== typeFilter) return false;
    const st = statusOf(c);
    if (statusFilter === 'active' ? st === 'archived' : statusFilter !== 'all' && st !== statusFilter) return false;
    if (curriculumFilter !== 'all' && !classMatchesCurriculum(c, curriculumFilter)) return false;
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sortValue = (c) => {
    if (sortKey === 'title') return c.title?.toLowerCase() || '';
    if (sortKey === 'content_type') return c.content_type || '';
    if (sortKey === 'curriculum') return curName(c.curriculum_id).toLowerCase();
    return '';
  };
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const va = sortValue(a), vb = sortValue(b);
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Tree order: each library class is followed by its copies; copies whose library class is filtered out go last.
  const kidsByParent = {};
  sorted.filter(isChild).forEach((k) => { (kidsByParent[k.library_class_id] ||= []).push(k); });
  const masterIds = new Set(sorted.filter((c) => !isChild(c)).map((c) => c.id));
  const treeRows = [
    ...sorted.filter((c) => !isChild(c)).flatMap((m) => [m, ...(kidsByParent[m.id] || [])]),
    ...sorted.filter((c) => isChild(c) && !masterIds.has(c.library_class_id)),
  ];

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortIcon = (col) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-indigo-600" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-indigo-600" />;
  };

  // When a curriculum filter is active, the submission dialog only offers the
  // pending classes associated with that curriculum.
  const dialogPendingClasses = curriculumFilter === 'all'
    ? pendingClasses
    : pendingClasses.filter((c) => classMatchesCurriculum(c, curriculumFilter));

  async function handleUploadPdf(file) {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      return file_url;
    } finally {
      setUploading(false);
    }
  }

  async function reloadClasses() {
    const cls = await base44.entities.Class.list();
    setClasses(cls);
  }

  async function addClass(payload) {
    const { curriculum_ids = [], ...classData } = payload;
    let master;
    try {
      master = await base44.entities.Class.create({
        ...classData,
        curriculum_id: '',
        curriculum_name: '',
        order: 0,
      });
    } catch (error) {
      showError(error, 'The class could not be added.');
      return false;
    }
    // Create linked copies in each selected curriculum (specialty inferred from the curriculum).
    if (curriculum_ids.length > 0) {
      const copies = curriculum_ids.map((curId, idx) => {
        const cur = curriculums.find((c) => c.id === curId);
        return {
          title: master.title,
          description: master.description || '',
          curriculum_id: curId,
          curriculum_name: cur?.name || '',
          library_class_id: master.id,
          content_type: master.content_type,
          type: master.type || 'required',
          content_url: master.content_url || '',
          document_id: master.document_id || '',
          document_title: master.document_title || '',
          live_class_date: master.live_class_date || '',
          live_class_link: master.live_class_link || '',
          available_timings: master.available_timings || [],
          duration_minutes: master.duration_minutes || 0,
          certificate_validity_months: master.certificate_validity_months ?? null,
          retraining_interval_months: master.retraining_interval_months ?? null,
          order: idx,
          has_quiz: !!master.has_quiz,
          ...(cur?.status === 'published' ? { pending_operation: 'add' } : {}),
        };
      });
      await base44.entities.Class.bulkCreate(copies);
      // Mark published curricula as having unpublished changes.
      const publishedAffected = curriculum_ids
        .map((id) => curriculums.find((c) => c.id === id))
        .filter((c) => c && c.status === 'published');
      if (publishedAffected.length > 0) {
        await base44.entities.Curriculum.bulkUpdate(
          publishedAffected.map((c) => ({ id: c.id, has_unpublished_changes: true }))
        );
      }
    }
    setAddOpen(false);
    await reloadClasses();
  }

  async function placeInCurricula(chosenCurricula) {
    if (!placing || placing.library_class_id) return; // only library classes can be placed
    setPlacingBusy(true);
    try {
      const existingIds = new Set();
      classes.forEach((c) => {
        if (c.library_class_id === placing.id && c.curriculum_id) existingIds.add(c.curriculum_id);
      });
      const copies = [];
      chosenCurricula.forEach((cur, idx) => {
        if (existingIds.has(cur.id)) return;
        copies.push({
          title: placing.title,
          description: placing.description || '',
          curriculum_id: cur.id,
          curriculum_name: cur.name,
          library_class_id: placing.id,
          content_type: placing.content_type,
          type: placing.type || 'required',
          content_url: placing.content_url || '',
          document_id: placing.document_id || '',
          document_title: placing.document_title || '',
          live_class_date: placing.live_class_date || '',
          live_class_link: placing.live_class_link || '',
          available_timings: placing.available_timings || [],
          duration_minutes: placing.duration_minutes || 0,
          certificate_validity_months: placing.certificate_validity_months ?? null,
          retraining_interval_months: placing.retraining_interval_months ?? null,
          order: idx,
          has_quiz: !!placing.has_quiz,
          ...(cur.status === 'published' ? { pending_operation: 'add' } : {}),
        });
      });
      if (copies.length > 0) {
        await base44.entities.Class.bulkCreate(copies);
        const publishedAffected = chosenCurricula.filter((c) => c.status === 'published');
        if (publishedAffected.length > 0) {
          await base44.entities.Curriculum.bulkUpdate(
            publishedAffected.map((c) => ({ id: c.id, has_unpublished_changes: true }))
          );
        }
      }
      setPlacing(null);
      await reloadClasses();
    } catch (error) {
      showError(error, 'The class could not be placed.');
      await reloadClasses();
    } finally {
      setPlacingBusy(false);
    }
  }

  async function updateClass(cls, payload, note) {
    // The prior live state is archived as a revision only when the update is
    // approved in Manager Tasks, so rejected or unsubmitted edits leave no
    // revision behind. Here we just stage the new content and the admin's note.
    try {
      await base44.entities.Class.update(cls.id, {
        ...payload,
        pending_library_update: true,
        pending_change_note: note || '',
      });
    } catch (error) {
      showError(error, 'The class could not be updated.');
      return false;
    }
    setEditing(null);
    await reloadClasses();
    // Library classes are shared, so offer the approval choice right after saving.
    if (!cls.library_class_id) {
      try { setApproving({ kind: 'update', cls: await base44.entities.Class.get(cls.id) }); } catch (e) { /* the row's approve icon stays available */ }
    }
  }


  // When a curriculum filter is active, the dialog lists every class in that
  // curriculum (masters used by it + its copies) so the admin can select all
  // or pick specific ones, including quiz-bearing classes.
  const curriculumClasses = curriculumFilter === 'all'
    ? null
    : liveClasses.filter((c) => classMatchesCurriculum(c, curriculumFilter));
  const listedClasses = curriculumClasses || dialogPendingClasses;
  const filteredCurriculumName = curriculumFilter === 'all'
    ? null
    : curriculums.find((c) => c.id === curriculumFilter)?.name || null;

  async function submitBatch(selected, opts = {}) {
    setSubmitting(true);
    try {
      const { cleanQuestion } = await import('../lib/training');
      // Recompute affected curricula from the selected subset only.
      const selectedCurriculumIds = new Set();
      selected.forEach((pc) => {
        classes.filter((c) => c.library_class_id === pc.id).forEach((c) => {
          if (c.curriculum_id) selectedCurriculumIds.add(c.curriculum_id);
        });
      });
      const selectedAffectedCurricula = curriculums.filter((c) => selectedCurriculumIds.has(c.id));
      // Snapshot each selected library class's current content + quiz.
      const changedItems = [];
      for (const cls of selected) {
        const contentSnapshot = {
          title: cls.title,
          description: cls.description || '',
          content_type: cls.content_type,
          content_url: cls.content_url || '',
          document_id: cls.document_id || '',
          document_title: cls.document_title || '',
          available_timings: cls.available_timings || [],
          live_class_link: cls.live_class_link || '',
          live_class_date: cls.live_class_date || '',
          duration_minutes: cls.duration_minutes || 0,
          certificate_validity_months: cls.certificate_validity_months ?? null,
          retraining_interval_months: cls.retraining_interval_months ?? null,
          has_quiz: !!cls.has_quiz,
        };
        let quizSnapshot = null;
        if (cls.has_quiz) {
          const quizzes = await base44.entities.Quiz.filter({ class_id: cls.id });
          if (quizzes.length > 0) {
            const quiz = quizzes[0];
            const qsPage = await base44.entities.QuizQuestion.filter({ quiz_id: quiz.id });
            quizSnapshot = {
              passing_score: quiz.passing_score ?? 70,
              questions: (qsPage.items || qsPage).map(cleanQuestion),
            };
          }
        }
        changedItems.push({
          class_id: cls.id,
          class_title: cls.title,
          change_type: quizSnapshot ? 'both' : 'content',
          content_snapshot: contentSnapshot,
          quiz_snapshot: quizSnapshot,
        });
      }

      const batch = await base44.entities.LibraryBatch.create({
        status: 'pending',
        changed_items: changedItems,
        requested_by_id: user?.id || '',
        requested_by_name: user?.full_name || user?.email || '',
        summary: `${changedItems.length} class update(s) affecting ${selectedAffectedCurricula.length} curriculum/curricula`,
      });

      // Create one review request per affected curriculum (or one for the library itself when the class is not placed anywhere).
      const reviews = [];
      const reviewTargets = selectedAffectedCurricula.length > 0
        ? selectedAffectedCurricula.map((cur) => ({ id: cur.id, name: cur.name }))
        : [{ id: '', name: 'Class Library (not placed in a curriculum)' }];
      for (const cur of reviewTargets) {
        reviews.push(await base44.entities.LibraryBatchReview.create({
          batch_id: batch.id,
          curriculum_id: cur.id,
          curriculum_name: cur.name,
          status: 'pending',
        }));
      }

      // Clear the pending flag on the submitted library classes.
      if (selected.length > 0) {
        await base44.entities.Class.bulkUpdate(
          selected.map((c) => ({ id: c.id, pending_library_update: false }))
        );
      }

      // "Approve myself": do what the manager would do — roll the update out to every affected curriculum.
      if (opts.self) {
        for (const review of reviews) await approveBatchReviewRequest(review, user, { self: true });
      }

      setSubmitOpen(false);
      await reloadClasses();
      setBatchRefresh((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  // A class may only be trashed from the library if it has never been approved
  // (no revision history exists for it yet).
  const canTrash = (c) => !c.library_approved && !approvedClassIds.has(c.id) && !c.trashed_at;

  async function trashClass(cls) {
    setTrashing(true);
    try {
      const now = new Date().toISOString();
      const byName = user?.full_name || user?.email || '';
      // Trash the master plus any linked copies so they leave curricula too.
      const toTrash = classes.filter(
        (c) => c.id === cls.id || c.library_class_id === cls.id
      );
      await base44.entities.Class.bulkUpdate(
        toTrash.map((c) => ({ id: c.id, trashed_at: now, trashed_by_name: byName }))
      );
      setTrashTarget(null);
      await reloadClasses();
      toast({ title: 'Moved to trash', description: `"${cls.title}" will be permanently deleted in 30 days.` });
    } finally {
      setTrashing(false);
    }
  }

  // An approved class (one that has been published within a curriculum) cannot
  // be deleted from the library — it can only be archived. Archiving marks the
  // master and its linked copies so they leave active lists; the admin then
  // sends each copy for manager approval from the Content Catalog.
  async function archiveClass(cls) {
    const toArchive = classes.filter(
      (c) => c.id === cls.id || c.library_class_id === cls.id
    );
    await base44.entities.Class.bulkUpdate(
      toArchive.map((c) => ({ id: c.id, archived: true }))
    );
    await reloadClasses();
    setApproving({ kind: 'archive', cls });
  }

  // Archive approval for a library class: one request per curriculum copy plus one for the library class itself,
  // so a manager can approve them all in Tasks. "Approve myself" approves every request right away.
  async function submitArchive(cls, opts = {}) {
    const targets = [
      ...classes.filter((c) => c.library_class_id === cls.id && c.curriculum_id),
      cls,
    ];
    for (const t of targets) {
      const request = await base44.entities.ArchiveRequest.create({
        target_type: 'class',
        class_id: t.id,
        class_name: t.title,
        curriculum_id: t.curriculum_id || '',
        curriculum_name: t.curriculum_id ? (t.curriculum_name || curName(t.curriculum_id)) : 'Class Library',
        reason: '',
        requested_by_id: user?.id || '',
        requested_by_name: user?.full_name || user?.email || '',
        status: 'pending',
      });
      if (opts.self) await approveArchiveRequest(request, user, { self: true });
    }
    await reloadClasses();
    setBatchRefresh((k) => k + 1);
    toast({
      title: opts.self ? 'Archived' : 'Sent for review',
      description: opts.self ? `"${cls.title}" is now in the Archived list.` : 'A manager will review the archive request in Tasks.',
    });
  }

  // Revert a pending archival: unarchive the master and its linked copies, and
  // withdraw any pending archive requests so the manager no longer sees them.
  async function revertArchive(cls) {
    if (!confirm(`Revert the archival of "${cls.title}"? It returns to the library and its curricula.`)) return;
    const toRevert = classes.filter(
      (c) => c.id === cls.id || c.library_class_id === cls.id
    );
    const classIds = toRevert.map((c) => c.id);
    await base44.entities.Class.bulkUpdate(
      toRevert.map((c) => ({ id: c.id, archived: false }))
    );
    await base44.entities.ArchiveRequest.deleteMany({
      target_type: 'class', status: 'pending', class_id: { $in: classIds },
    });
    await reloadClasses();
    toast({ title: 'Archival reverted', description: `"${cls.title}" is back in the library.` });
  }

  async function restoreArchived(cls) {
    await base44.entities.Class.update(cls.id, { archive_status: '', archived_date: '' });
    await reloadClasses();
    toast({ title: 'Restored', description: `"${cls.title}" is back in the library as a draft. Place it in a curriculum again if needed.` });
  }

  async function restoreClass(cls) {
    setRestoring(true);
    try {
      const toRestore = classes.filter(
        (c) => c.id === cls.id || c.library_class_id === cls.id
      );
      await base44.entities.Class.bulkUpdate(
        toRestore.map((c) => ({ id: c.id, trashed_at: '', trashed_by_name: '' }))
      );
      await reloadClasses();
      toast({ title: 'Restored', description: `"${cls.title}" is back in the library.` });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-semibold text-slate-900">Class Library</h1>
          </div>
          <p className="text-sm text-slate-500">Every available class in one place, across PDFs, videos, and live sessions.</p>
        </div>
        <Button onClick={() => setTrashOpen(true)} variant="outline" className="relative shrink-0">
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Trash</span>
          {trashedClasses.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
              {trashedClasses.length}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes…" className="pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All content types</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="on_demand_video">On-demand video</SelectItem>
            <SelectItem value="live_class">Live class</SelectItem>
            <SelectItem value="linked_document">Linked document</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Draft + Approved</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={curriculumFilter} onValueChange={setCurriculumFilter}>
          <SelectTrigger className="w-[220px]"><span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-slate-400" /><SelectValue placeholder="All curricula" /></span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All curricula</SelectItem>
            {curriculums.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Class
        </Button>
        <Button onClick={() => setSubmitOpen(true)} disabled={listedClasses.length === 0} variant="default">
          <Send className="mr-1.5 h-4 w-4" /> Submit for Review
          {dialogPendingClasses.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-semibold">
              {dialogPendingClasses.length}
            </span>
          )}
        </Button>
      </div>

      <InProgressActionsPanel refreshKey={batchRefresh} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="cursor-pointer select-none px-4 py-3 hover:text-slate-700" onClick={() => toggleSort('title')}>Class {sortIcon('title')}</th>
              <th className="cursor-pointer select-none px-4 py-3 hover:text-slate-700" onClick={() => toggleSort('content_type')}>Type {sortIcon('content_type')}</th>
              <th className="cursor-pointer select-none px-4 py-3 hover:text-slate-700" onClick={() => toggleSort('curriculum')}>Curriculum {sortIcon('curriculum')}</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quiz</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3 text-right">Actions</th>
              <th className="px-4 py-3 text-right">Quiz Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {treeRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                  No classes match this filter.
                </td>
              </tr>
            ) : treeRows.map((c) => {
              const meta = TYPE_META[c.content_type] || TYPE_META.pdf;
              const Icon = meta.icon;
              const child = isChild(c);
              const hasQuiz = child ? (quizClassIds.has(c.library_class_id) || quizClassIds.has(c.id)) : quizClassIds.has(c.id);
              return (
                <tr key={c.id} className={`hover:bg-slate-50/60 ${child ? 'bg-sky-50/30' : ''}`}>
                  <td className={`py-3 font-medium text-slate-900 ${child ? 'border-l-2 border-sky-200 pl-9 pr-4' : 'px-4'}`}>
                    <div className="flex items-center gap-1.5">
                      {(c.pending_library_update || c.archived) && (
                        <RefreshCw className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      {child && <span className="text-sky-300">└</span>}
                      <span className={c.archived ? 'line-through text-slate-500' : ''}>{c.title}</span>
                      {c.archived && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600" title="To be archived — awaiting manager approval">
                          <Archive className="h-3 w-3" /> To be archived
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {child ? curName(c.curriculum_id) : <span className="text-xs text-slate-400">Parent</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[statusOf(c)]}`}>{statusOf(c)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {hasQuiz ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                        <HelpCircle className="h-3.5 w-3.5" /> Quiz
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.content_type === 'live_class' ? (
                      (c.available_timings && c.available_timings.length > 0) ? (
                        <ul className="space-y-0.5">
                          {c.available_timings.map((t, i) => (
                            <li key={i} className="text-xs text-slate-600">{formatLiveDate(t)}</li>
                          ))}
                        </ul>
                      ) : (formatLiveDate(c.live_class_date) || <span className="text-slate-400">Not scheduled</span>)
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {isArchivedFinal(c) && (
                        <button onClick={() => restoreArchived(c)} title="Restore from archive" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><Undo2 className="h-3.5 w-3.5" /> Restore</button>
                      )}
                      {!child && !isArchivedFinal(c) && (
                        <button onClick={() => setPlacing(c)} title="Place in curricula" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Layers className="h-4 w-4" /></button>
                      )}
                      {!child && (c.pending_library_update || statusOf(c) === 'draft') && !c.archived && !isArchivedFinal(c) && (
                        <button onClick={() => setApproving({ kind: 'update', cls: c })} title="Send for review / Approve myself" className="rounded-lg p-1.5 text-rose-500 hover:bg-emerald-50 hover:text-emerald-600"><CheckCircle2 className="h-4 w-4" /></button>
                      )}
                      {!isArchivedFinal(c) && <button onClick={() => setEditing(c)} title="Update class" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>}
                      <button onClick={() => setHistoryClass(c)} title="Revision history" className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><History className="h-4 w-4" /></button>
                      {canTrash(c) && !isArchivedFinal(c) && (
                        <button onClick={() => setTrashTarget(c)} title="Move to trash" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                      {!canTrash(c) && c.archived && (
                        <button onClick={() => revertArchive(c)} title="Revert archival" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Undo2 className="h-4 w-4" /></button>
                      )}
                      {!canTrash(c) && !c.archived && !isArchivedFinal(c) && (
                        <button onClick={() => archiveClass(c)} title="Archive (approved class)" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {child ? (
                      hasQuiz ? (
                        <Link to={`/training/class/${c.id}`} title="The quiz is managed on the library class" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          <HelpCircle className="h-3.5 w-3.5" /> View
                        </Link>
                      ) : <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <Link to={`/training/quiz/${c.id}`} state={{ from: 'library' }} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">
                        <HelpCircle className="h-3.5 w-3.5" /> {hasQuiz ? 'Edit' : 'Build'}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddClassDialog
        isTitleTaken={(t) => isTitleTaken(t, null)}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={addClass}
        uploading={uploading}
        onUploadFile={handleUploadPdf}
        curriculums={curriculums}
      />
      <EditClassDialog
        isTitleTaken={(t, id) => isTitleTaken(t, id)}
        open={!!editing}
        cls={editing}
        onClose={() => setEditing(null)}
        onSave={updateClass}
        uploading={uploading}
        onUploadFile={handleUploadPdf}
      />
      <ClassRevisionHistoryDialog cls={historyClass} onClose={() => setHistoryClass(null)} />
      <PlaceClassInCurriculaDialog
        open={!!placing}
        onClose={() => setPlacing(null)}
        cls={placing}
        curriculums={curriculums}
        classes={classes}
        onConfirm={placeInCurricula}
        busy={placingBusy}
      />
      <SubmitLibraryBatchDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={submitBatch}
        onApproveSelf={(selected) => submitBatch(selected, { self: true })}
        listedClasses={listedClasses}
        allClasses={classes}
        curriculums={curriculums}
        curriculumName={filteredCurriculumName}
        busy={submitting}
      />
      <ApprovalChoiceDialog
        open={!!approving}
        title={approving?.kind === 'archive' ? 'Archive class' : 'Approve class update'}
        description={approving?.kind === 'archive'
          ? `"${approving?.cls?.title}" will be removed from all curricula once approved. A manager can review it, or you can approve it yourself.`
          : `"${approving?.cls?.title}" has changes waiting. A manager can review them, or you can approve them yourself and roll them out right away.`}
        onClose={() => setApproving(null)}
        onSend={() => (approving.kind === 'archive' ? submitArchive(approving.cls) : submitBatch([approving.cls]))}
        onApproveSelf={() => (approving.kind === 'archive' ? submitArchive(approving.cls, { self: true }) : submitBatch([approving.cls], { self: true }))}
      />
      <ConfirmTrashClassDialog
        open={!!trashTarget}
        cls={trashTarget}
        busy={trashing}
        onClose={() => setTrashTarget(null)}
        onConfirm={() => trashClass(trashTarget)}
      />
      <LibraryTrashDialog
        open={trashOpen}
        trashed={trashedClasses}
        busy={restoring}
        onClose={() => setTrashOpen(false)}
        onRestore={restoreClass}
      />
    </div>
  );
}