/* eslint-disable no-restricted-globals */ // native confirm() kept as in the Base44 original
import React, { useEffect, useState } from 'react';
import { base44 } from '../base44Client';
import { getCurrentUser } from '../lib/training';
import { useToast } from '../components/ui/use-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Search, ListTree, Table2, ArrowLeftRight } from 'lucide-react';
import ContentTree from '../components/admin/ContentTree';
import ContentTableView from '../components/admin/ContentTableView';
import ContentEditDialog from '../components/admin/ContentEditDialog';
import ClassFindReplaceDialog from '../components/admin/ClassFindReplaceDialog';
import PickLibraryClassDialog from '../components/admin/PickLibraryClassDialog';
import ArchiveCurriculumDialog from '../components/admin/ArchiveCurriculumDialog';
import ArchiveSpecialtyDialog from '../components/admin/ArchiveSpecialtyDialog';
import PublishCurriculumDialog from '../components/admin/PublishCurriculumDialog';
import PublishPendingWarningDialog from '../components/admin/PublishPendingWarningDialog';
import ArchivePendingWarningDialog from '../components/admin/ArchivePendingWarningDialog';
import InProgressActionsPanel from '../components/admin/InProgressActionsPanel';
import QuizPreviewDialog from '../components/admin/QuizPreviewDialog';
import ApprovalChoiceDialog from '../components/admin/ApprovalChoiceDialog';
import { approveArchiveRequest, approvePublishRequest } from '../lib/approvals';

export default function AdminContent() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [classes, setClasses] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [quizzesByClass, setQuizzesByClass] = useState({});
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'table'
  const [statusFilter, setStatusFilter] = useState('all');
  const [findOpen, setFindOpen] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [archivingSpecialty, setArchivingSpecialty] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [publishWarning, setPublishWarning] = useState(null);
  const [checkingPublish, setCheckingPublish] = useState(false);
  const [archiveWarning, setArchiveWarning] = useState(null);
  const [checkingArchive, setCheckingArchive] = useState(false);
  const [pendingChangeRequests, setPendingChangeRequests] = useState([]);
  const [pendingPublishCurriculumIds, setPendingPublishCurriculumIds] = useState(new Set());
  const [pendingClassArchiveIds, setPendingClassArchiveIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { type, data, parentId? }
  const [pickingFor, setPickingFor] = useState(null); // curriculum being added to
  const [quizClassIds, setQuizClassIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [previewQuiz, setPreviewQuiz] = useState(null);
  const [approvalChoice, setApprovalChoice] = useState(null); // { kind, target, count? }
  const [initialSpec, setInitialSpec] = useState(null);
  const [initialCur, setInitialCur] = useState(null);
  const focusCurriculumId = useState(() => new URLSearchParams(window.location.search).get('curriculum'))[0];

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      const { specs, curs } = await reloadAll();
      if (focusCurriculumId) {
        const cur = curs.find((c) => c.id === focusCurriculumId);
        if (cur) {
          setExpanded((prev) => new Set(prev).add(cur.field_specialty_id).add(cur.id));
          setInitialSpec(specs.find((s) => s.id === cur.field_specialty_id) || null);
          setInitialCur(cur);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadAll() {
    const [specs, curs, cls, changes, pubReqs, classArchReqs] = await Promise.all([
      base44.entities.FieldSpecialty.list(),
      base44.entities.Curriculum.list(),
      base44.entities.Class.list(),
      base44.entities.ChangeRequest.filter({ status: 'pending' }),
      base44.entities.PublishRequest.filter({ status: 'pending' }),
      base44.entities.ArchiveRequest.filter({ target_type: 'class', status: 'pending' }),
    ]);
    setSpecialties(specs);
    setCurriculums(curs);
    setClasses(cls);
    setPendingChangeRequests(changes.items || changes);
    setPendingPublishCurriculumIds(new Set((pubReqs.items || pubReqs).map((r) => r.curriculum_id)));
    setPendingClassArchiveIds(new Set((classArchReqs.items || classArchReqs).map((r) => r.class_id)));
    const quizzes = await base44.entities.Quiz.list();
    setQuizClassIds(new Set((quizzes.items || quizzes).map((q) => q.class_id)));
    return { specs, curs };
  }

  // An approved class (one in a published curriculum) cannot be deleted — it can
  // only be archived. Archiving marks the copy so it leaves the active catalog;
  // the admin then sends it for manager approval to permanently remove it.
  async function archiveClassCopy(cl) {
    if (!confirm(`Archive "${cl.title}"? It will be removed once the manager approves.`)) return;
    await base44.entities.Class.update(cl.id, { archived: true });
    await reloadAll();
  }

  // Revert a pending archival on a single curriculum copy: unarchive it and
  // withdraw its pending archive request so the manager no longer sees it.
  async function revertClassArchive(cl) {
    if (!confirm(`Revert the archival of "${cl.title}"? It returns to this curriculum.`)) return;
    await base44.entities.Class.update(cl.id, { archived: false });
    await base44.entities.ArchiveRequest.deleteMany({
      target_type: 'class', status: 'pending', class_id: cl.id,
    });
    await reloadAll();
  }

  // Opens the "send for review / approve myself" choice for one archived class.
  function sendClassArchiveApproval(cl) {
    setApprovalChoice({ kind: 'class', target: cl });
  }

  async function submitClassArchive(cl, opts = {}) {
    const request = await base44.entities.ArchiveRequest.create({
      target_type: 'class',
      class_id: cl.id,
      class_name: cl.title,
      curriculum_id: cl.curriculum_id || '',
      curriculum_name: cl.curriculum_name || '',
      reason: '',
      requested_by_id: user?.id || '',
      requested_by_name: user?.full_name || user?.email || '',
      status: 'pending',
    });
    if (opts.self) await approveArchiveRequest(request, user, { self: true });
    await reloadAll();
  }

  // Send every archived (not-yet-sent) class under a curriculum for archive
  // approval in one batch, so several removals go through a single
  // curriculum-level action instead of one send per class.
  function sendCurriculumArchiveApproval(cur) {
    const unsent = classes.filter((c) => c.curriculum_id === cur.id && c.archived && !pendingClassArchiveIds.has(c.id));
    if (unsent.length === 0) {
      toast({ title: 'Nothing to send', description: 'No archived classes are awaiting approval.' });
      return;
    }
    setApprovalChoice({ kind: 'curriculum-classes', target: cur, count: unsent.length });
  }

  async function submitCurriculumArchive(cur, opts = {}) {
    const unsent = classes.filter((c) => c.curriculum_id === cur.id && c.archived && !pendingClassArchiveIds.has(c.id));
    if (unsent.length === 0) return;
    const created = await base44.entities.ArchiveRequest.bulkCreate(
      unsent.map((cl) => ({
        target_type: 'class',
        class_id: cl.id,
        class_name: cl.title,
        curriculum_id: cl.curriculum_id || '',
        curriculum_name: cl.curriculum_name || cur.name,
        reason: '',
        requested_by_id: user?.id || '',
        requested_by_name: user?.full_name || user?.email || '',
        status: 'pending',
      }))
    );
    if (opts.self) for (const request of created) await approveArchiveRequest(request, user, { self: true });
    await reloadAll();
  }

  async function openQuizPreview(cl) {
    const quizzes = await base44.entities.Quiz.filter({ class_id: cl.id });
    if (quizzes.length > 0) setPreviewQuiz(quizzes[0]);
  }

  async function loadQuizForClass(classId) {
    try {
      const quizzes = await base44.entities.Quiz.filter({ class_id: classId });
      if (quizzes.length === 0) {
        setQuizzesByClass((p) => ({ ...p, [classId]: null }));
        return;
      }
      const quiz = quizzes[0];
      const questionCount = await base44.entities.QuizQuestion.count({ quiz_id: quiz.id });
      setQuizzesByClass((p) => ({ ...p, [classId]: { quiz, questionCount } }));
    } catch {
      setQuizzesByClass((p) => ({ ...p, [classId]: null }));
    }
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (classes.some((c) => c.id === id) && quizzesByClass[id] === undefined) {
          loadQuizForClass(id);
        }
      }
      return next;
    });
  }

  async function handleUploadPdf(file) {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      return file_url;
    } finally {
      setUploading(false);
    }
  }

  async function addLibraryClassToCurriculum(cls) {
    const cur = pickingFor;
    if (!cur || !cls) return;
    // Prevent placing the same library class into a curriculum more than once.
    const alreadyInCurriculum = classes.find(
      (c) => c.curriculum_id === cur.id && c.library_class_id === cls.id
    );
    if (alreadyInCurriculum) {
      toast({
        title: 'Already in this curriculum',
        description: `"${cls.title}" is already part of "${cur.name}". A class can only appear once per curriculum.`,
        variant: 'destructive',
      });
      setPickingFor(null);
      return;
    }
    const existing = classes.filter((c) => c.curriculum_id === cur.id);
    const nextOrder = existing.length;
    const payload = {
      title: cls.title,
      description: cls.description || '',
      curriculum_id: cur.id,
      curriculum_name: cur.name,
      library_class_id: cls.id,
      content_type: cls.content_type,
      type: cls.type || 'required',
      content_url: cls.content_url || '',
      document_id: cls.document_id || '',
      document_title: cls.document_title || '',
      live_class_date: cls.live_class_date || '',
      live_class_link: cls.live_class_link || '',
      available_timings: cls.available_timings || [],
      duration_minutes: cls.duration_minutes || 0,
      certificate_validity_months: cls.certificate_validity_months ?? null,
      retraining_interval_months: cls.retraining_interval_months ?? null,
      order: nextOrder,
      has_quiz: !!cls.has_quiz,
    };
    const parentCur = curriculums.find((c) => c.id === cur.id);
    const isPublished = parentCur && parentCur.status === 'published';
    if (isPublished) payload.pending_operation = 'add';
    try {
      await base44.entities.Class.create(payload);
    } catch (error) {
      toast({ title: 'Could not add class', description: error?.response?.data?.error || 'The class could not be added.', variant: 'destructive' });
      setPickingFor(null);
      await reloadAll();
      return;
    }
    if (isPublished) {
      await base44.entities.Curriculum.update(parentCur.id, { has_unpublished_changes: true });
    }
    setPickingFor(null);
    await reloadAll();
  }

  async function saveItem() {
    const { type, data, parentId } = editing;
    if (type === 'specialty') {
      if (data.id) {
        await base44.entities.FieldSpecialty.update(data.id, { name: data.name, description: data.description });
      } else {
        await base44.entities.FieldSpecialty.create({ name: data.name, description: data.description });
      }
    } else if (type === 'curriculum') {
      const spec = specialties.find((s) => s.id === parentId);
      const existing = data.id ? curriculums.find((c) => c.id === data.id) : null;
      const payload = {
        name: data.name,
        description: data.description,
        field_specialty_id: parentId,
        field_specialty_name: spec?.name || '',
        type: data.type || 'required',
        status: data.status || 'draft',
      };
      // Editing a published curriculum marks it as having unpublished changes,
      // but only for structural changes — a rename is a lightweight event that
      // does not require re-approval or a full curriculum revision.
      const isRename = existing && existing.name !== data.name;
      if (existing && existing.status === 'published' && !isRename) {
        payload.has_unpublished_changes = true;
      }
      if (data.id) {
        await base44.entities.Curriculum.update(data.id, payload);
        if (isRename) {
          // Record a lightweight rename event, separate from full curriculum revisions.
          await base44.entities.CurriculumRename.create({
            curriculum_id: data.id,
            old_name: existing.name,
            new_name: data.name,
            changed_by_id: user?.id || '',
            changed_by_name: user?.full_name || user?.email || '',
          });
          // Keep the denormalized curriculum_name on classes in sync.
          const curClasses = classes.filter((c) => c.curriculum_id === data.id);
          if (curClasses.length > 0) {
            await base44.entities.Class.bulkUpdate(
              curClasses.map((c) => ({ id: c.id, curriculum_name: data.name }))
            );
          }
        }
      } else {
        await base44.entities.Curriculum.create(payload);
      }
    } else if (type === 'class') {
      const cur = curriculums.find((c) => c.id === parentId);
      const payload = {
        title: data.title,
        description: data.description,
        curriculum_id: parentId,
        curriculum_name: cur?.name || '',
        type: data.type || 'required',
        content_type: data.content_type,
        content_url: data.content_url || '',
        document_id: data.document_id || '',
        document_title: data.document_title || '',
        live_class_date: data.live_class_date || '',
        live_class_link: data.live_class_link || '',
        duration_minutes: Number(data.duration_minutes) || 0,
        order: Number(data.order) || 0,
        has_quiz: !!data.has_quiz,
      };
      const parentCur = curriculums.find((c) => c.id === parentId);
      const isPublished = parentCur && parentCur.status === 'published';
      if (data.id) {
        const existing = classes.find((c) => c.id === data.id);
        // Editing a class in a published curriculum stages it as a pending edit,
        // unless it is itself a pending add (keep it flagged as an add).
        if (isPublished) payload.pending_operation = existing?.pending_operation === 'add' ? 'add' : 'edit';
        await base44.entities.Class.update(data.id, payload);
        setQuizzesByClass((p) => { const n = { ...p }; delete n[data.id]; return n; });
      } else {
        if (isPublished) payload.pending_operation = 'add';
        await base44.entities.Class.create(payload);
      }
      // Saving a class in a published curriculum marks it as having unpublished changes,
      // so the admin can request one curriculum-level approval instead of per-class approvals.
      if (isPublished) {
        await base44.entities.Curriculum.update(parentCur.id, { has_unpublished_changes: true });
      }
    }
    setEditing(null);
    await reloadAll();
  }

  async function deleteItem(type, id) {
    if (type === 'class') {
      const cl = classes.find((c) => c.id === id);
      const parentCur = cl ? curriculums.find((c) => c.id === cl.curriculum_id) : null;
      // Already marked for deletion -> restore it.
      if (cl && cl.pending_operation === 'delete') {
        if (!confirm('Restore this class? It will no longer be marked for deletion.')) return;
        await base44.entities.Class.update(id, { pending_operation: 'none' });
        await reloadAll();
        return;
      }
      // A newly added class (not yet part of a published version) can be removed outright.
      if (cl && cl.pending_operation === 'add') {
        if (!confirm('Delete this class? This cannot be undone.')) return;
        await base44.entities.Class.delete(id);
        await reloadAll();
        return;
      }
      // Deleting a class in a published curriculum stages it for deletion (soft delete);
      // the class is removed once the manager approves the curriculum re-publish.
      if (parentCur && parentCur.status === 'published') {
        if (!confirm('Mark this class for deletion? It is removed once the curriculum update is approved.')) return;
        await base44.entities.Class.update(id, { pending_operation: 'delete' });
        await base44.entities.Curriculum.update(parentCur.id, { has_unpublished_changes: true });
        await reloadAll();
        return;
      }
    }
    if (!confirm('Delete this item? This cannot be undone.')) return;
    if (type === 'specialty') await base44.entities.FieldSpecialty.delete(id);
    else if (type === 'curriculum') await base44.entities.Curriculum.delete(id);
    else if (type === 'class') await base44.entities.Class.delete(id);
    await reloadAll();
  }

  async function requestArchive(c) {
    if (!c) return;
    setCheckingArchive(true);
    try {
      const pending = await base44.entities.ArchiveRequest.filter({
        curriculum_id: c.id, status: 'pending',
      });
      if (pending.length > 0) {
        const latest = pending.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        setArchiveWarning({
          request_id: latest.id,
          item_name: c.name,
          curriculum_name: c.name,
          sent_on: latest.created_date,
          requested_by_name: latest.requested_by_name,
        });
        return;
      }
      setArchiving(c);
    } finally {
      setCheckingArchive(false);
    }
  }

  async function requestArchiveSpecialty(s) {
    if (!s) return;
    setCheckingArchive(true);
    try {
      const pending = await base44.entities.ArchiveRequest.filter({
        target_type: 'specialty', specialty_id: s.id, status: 'pending',
      });
      if (pending.length > 0) {
        const latest = pending.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        setArchiveWarning({
          request_id: latest.id,
          item_name: s.name,
          sent_on: latest.created_date,
          requested_by_name: latest.requested_by_name,
        });
        return;
      }
      setArchivingSpecialty(s);
    } finally {
      setCheckingArchive(false);
    }
  }

  async function withdrawArchiveRequest() {
    if (!archiveWarning?.request_id) return;
    if (!confirm('Withdraw this archive request? The manager will no longer see it for review.')) return;
    await base44.entities.ArchiveRequest.delete(archiveWarning.request_id);
    setArchiveWarning(null);
    setFeedbackKey((k) => k + 1);
    await reloadAll();
  }

  async function archiveCurriculum(reason, opts = {}) {
    if (!archiving) return;
    const request = await base44.entities.ArchiveRequest.create({
      target_type: 'curriculum',
      curriculum_id: archiving.id,
      curriculum_name: archiving.name,
      reason: reason || '',
      requested_by_id: user?.id || '',
      requested_by_name: user?.full_name || user?.email || '',
      status: 'pending',
    });
    if (opts.self) await approveArchiveRequest(request, user, { self: true });
    setArchiving(null);
    setFeedbackKey((k) => k + 1);
    await reloadAll();
  }

  async function archiveSpecialty(reason, opts = {}) {
    if (!archivingSpecialty) return;
    const request = await base44.entities.ArchiveRequest.create({
      target_type: 'specialty',
      specialty_id: archivingSpecialty.id,
      specialty_name: archivingSpecialty.name,
      reason: reason || '',
      requested_by_id: user?.id || '',
      requested_by_name: user?.full_name || user?.email || '',
      status: 'pending',
    });
    if (opts.self) await approveArchiveRequest(request, user, { self: true });
    setArchivingSpecialty(null);
    setFeedbackKey((k) => k + 1);
    await reloadAll();
  }

  async function requestPublish(c) {
    if (!c) return;
    setCheckingPublish(true);
    try {
      const pending = await base44.entities.PublishRequest.filter({
        curriculum_id: c.id, status: 'pending',
      });
      if (pending.length > 0) {
        const latest = pending.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        setPublishWarning({
          request_id: latest.id,
          curriculum_name: c.name,
          sent_on: latest.created_date,
          requested_by_name: latest.requested_by_name,
        });
        return;
      }
      setPublishing(c);
    } finally {
      setCheckingPublish(false);
    }
  }

  async function withdrawPublishRequest() {
    if (!publishWarning?.request_id) return;
    if (!confirm('Withdraw this publish request? The manager will no longer see it for review.')) return;
    await base44.entities.PublishRequest.delete(publishWarning.request_id);
    setPublishWarning(null);
    setFeedbackKey((k) => k + 1);
    await reloadAll();
  }

  async function publishCurriculum(reason, opts = {}) {
    if (!publishing) return;
    const publishRequest = await base44.entities.PublishRequest.create({
      curriculum_id: publishing.id,
      curriculum_name: publishing.name,
      reason: reason || '',
      requested_by_id: user?.id || '',
      requested_by_name: user?.full_name || user?.email || '',
      status: 'pending',
    });
    // Bundle unsent archived classes into the same approval send so a
    // curriculum has a single "Send for approval" action covering both
    // pending structure changes and archived class removals.
    const unsentArchived = classes.filter((c) => c.curriculum_id === publishing.id && c.archived && !pendingClassArchiveIds.has(c.id));
    let archiveRequests = [];
    if (unsentArchived.length > 0) {
      archiveRequests = await base44.entities.ArchiveRequest.bulkCreate(
        unsentArchived.map((cl) => ({
          target_type: 'class',
          class_id: cl.id,
          class_name: cl.title,
          curriculum_id: cl.curriculum_id || '',
          curriculum_name: cl.curriculum_name || publishing.name,
          reason: '',
          requested_by_id: user?.id || '',
          requested_by_name: user?.full_name || user?.email || '',
          status: 'pending',
        }))
      );
    }
    if (opts.self) {
      // Same steps a manager would take: remove the archived classes first, then publish.
      for (const request of archiveRequests) await approveArchiveRequest(request, user, { self: true });
      await approvePublishRequest(publishRequest, user, { self: true });
    }
    setPublishing(null);
    setFeedbackKey((k) => k + 1);
    await reloadAll();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  if (user && user.role !== 'admin') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You don't have access to this page.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <InProgressActionsPanel refreshKey={feedbackKey} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Content Catalog</h1>
          <p className="text-sm text-slate-500">
            {viewMode === 'tree'
              ? 'Expand a specialty to see its curriculums, a curriculum to see its classes, and a class to see its quiz.'
              : 'Browse specialties, curriculums, and classes in sortable tables. Click a name to drill in.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${viewMode === 'tree' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ListTree className="h-4 w-4" /> Tree
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Table2 className="h-4 w-4" /> Table
            </button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'tree' && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes…" className="w-56 pl-8" />
            </div>
          )}
          <Button onClick={() => setEditing({ type: 'specialty', data: { name: '', description: '' } })}>
            <Plus className="mr-1.5 h-4 w-4" /> New Specialty
          </Button>
          <Button onClick={() => setFindOpen(true)} variant="outline">
            <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Find & Replace
          </Button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <ContentTree
          specialties={specialties}
          curriculums={curriculums}
          classes={classes}
          quizzesByClass={quizzesByClass}
          expanded={expanded}
          onToggle={toggleExpand}
          search={search}
          onEdit={setEditing}
          onDelete={deleteItem}
          onArchive={requestArchive}
          onArchiveSpecialty={requestArchiveSpecialty}
          onPublish={requestPublish}
          statusFilter={statusFilter}
          pendingChangeRequests={pendingChangeRequests}
          pendingPublishCurriculumIds={pendingPublishCurriculumIds}
          onPickClass={setPickingFor}
          onViewQuiz={openQuizPreview}
          onArchiveClass={archiveClassCopy}
          onSendClassArchiveApproval={sendClassArchiveApproval}
          onSendCurriculumArchiveApproval={sendCurriculumArchiveApproval}
          onRevertArchive={revertClassArchive}
          pendingClassArchiveIds={pendingClassArchiveIds}
        />
      ) : (
        <ContentTableView
          specialties={specialties}
          curriculums={curriculums}
          classes={classes}
          onEdit={setEditing}
          onDelete={deleteItem}
          onArchive={requestArchive}
          onArchiveSpecialty={requestArchiveSpecialty}
          onPublish={requestPublish}
          statusFilter={statusFilter}
          onPickClass={setPickingFor}
          onViewQuiz={openQuizPreview}
          initialSpec={initialSpec}
          initialCur={initialCur}
          onArchiveClass={archiveClassCopy}
          onSendClassArchiveApproval={sendClassArchiveApproval}
          pendingClassArchiveIds={pendingClassArchiveIds}
        />
      )}

      <ContentEditDialog
        editing={editing}
        setEditing={setEditing}
        uploading={uploading}
        onUploadFile={handleUploadPdf}
        onSave={saveItem}
      />

      <ClassFindReplaceDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        classes={classes}
        curriculums={curriculums}
        specialties={specialties}
        onDone={reloadAll}
      />

      <ArchiveCurriculumDialog
        curriculum={archiving}
        onClose={() => setArchiving(null)}
        onConfirm={archiveCurriculum}
        onApproveSelf={(reason) => archiveCurriculum(reason, { self: true })}
      />

      <ArchiveSpecialtyDialog
        specialty={archivingSpecialty}
        onClose={() => setArchivingSpecialty(null)}
        onConfirm={archiveSpecialty}
        onApproveSelf={(reason) => archiveSpecialty(reason, { self: true })}
      />

      <PublishCurriculumDialog
        curriculum={publishing}
        onClose={() => setPublishing(null)}
        onConfirm={publishCurriculum}
        onApproveSelf={(reason) => publishCurriculum(reason, { self: true })}
      />

      <PublishPendingWarningDialog
        warning={publishWarning}
        onClose={() => setPublishWarning(null)}
        onWithdraw={withdrawPublishRequest}
      />

      <ArchivePendingWarningDialog
        warning={archiveWarning}
        onClose={() => setArchiveWarning(null)}
        onWithdraw={withdrawArchiveRequest}
      />

      <PickLibraryClassDialog
        open={!!pickingFor}
        onClose={() => setPickingFor(null)}
        classes={classes.filter((c) => !c.library_class_id && !c.curriculum_id && !c.trashed_at && c.archive_status !== 'archived')}
        quizClassIds={quizClassIds}
        curriculum={pickingFor}
        existingClassIds={
          pickingFor
            ? new Set(
                classes
                  .filter((c) => c.curriculum_id === pickingFor.id && c.library_class_id)
                  .map((c) => c.library_class_id)
              )
            : new Set()
        }
        onPick={addLibraryClassToCurriculum}
      />

      <QuizPreviewDialog quiz={previewQuiz} onClose={() => setPreviewQuiz(null)} />

      <ApprovalChoiceDialog
        open={!!approvalChoice}
        title="Archive approval"
        description={approvalChoice?.kind === 'class'
          ? `Send "${approvalChoice.target.title}" for archive approval? A manager reviews the removal, or you can approve it yourself.`
          : approvalChoice ? `Send ${approvalChoice.count} archived class(es) from "${approvalChoice.target.name}" for approval? A manager reviews the removal, or you can approve it yourself.` : ''}
        onClose={() => setApprovalChoice(null)}
        onSend={() => (approvalChoice.kind === 'class' ? submitClassArchive(approvalChoice.target) : submitCurriculumArchive(approvalChoice.target))}
        onApproveSelf={() => (approvalChoice.kind === 'class' ? submitClassArchive(approvalChoice.target, { self: true }) : submitCurriculumArchive(approvalChoice.target, { self: true }))}
      />
    </div>
  );
}