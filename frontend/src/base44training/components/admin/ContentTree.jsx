import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, FolderTree, BookOpen, FileText, Video, Radio, ListChecks, Pencil, Trash2, Archive, Plus, Send, Info, RefreshCw, Eye, History, Clock, Undo2,
} from 'lucide-react';
import ArchiveReasonDialog from './ArchiveReasonDialog';
import PublishHistoryDialog from './PublishHistoryDialog';
import CurriculumInfoDialog from './CurriculumInfoDialog';
import CurriculumRenameHistoryDialog from './CurriculumRenameHistoryDialog';
import { hasPendingUpdate } from '../../lib/training';

const contentTypeMeta = {
  pdf: { label: 'PDF', icon: FileText },
  on_demand_video: { label: 'Video', icon: Video },
  live_class: { label: 'Live', icon: Radio },
  linked_document: { label: 'Doc Link', icon: FileText },
};

const statusMeta = {
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700' },
  published: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-slate-200 text-slate-600' },
  // legacy values from the previous status scheme
  approved: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
  active: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
};

export default function ContentTree({
  specialties, curriculums, classes, quizzesByClass,
  expanded, onToggle, search, onEdit, onDelete, onArchive, onArchiveSpecialty, onPublish, statusFilter = 'all',
  pendingChangeRequests = [],
  pendingPublishCurriculumIds = new Set(),
  onPickClass,
  onViewQuiz,
  onArchiveClass,
  onSendClassArchiveApproval,
  onSendCurriculumArchiveApproval,
  onRevertArchive,
  pendingClassArchiveIds = new Set(),
}) {
  const [reasonCurriculum, setReasonCurriculum] = useState(null);
  const [reasonSpecialty, setReasonSpecialty] = useState(null);
  const [publishCurriculum, setPublishCurriculum] = useState(null);
  const [infoCurriculum, setInfoCurriculum] = useState(null);
  const [renameCurriculum, setRenameCurriculum] = useState(null);
  const q = search.trim().toLowerCase();

  const curriculumsBySpec = useMemo(() => {
    const m = {};
    curriculums
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .forEach((c) => { (m[c.field_specialty_id] ||= []).push(c); });
    return m;
  }, [curriculums, statusFilter]);

  const classesByCur = useMemo(() => {
    const m = {};
    classes.forEach((c) => { (m[c.curriculum_id] ||= []).push(c); });
    Object.keys(m).forEach((k) => {
      m[k].sort((a, b) => (a.order || 0) - (b.order || 0) || new Date(a.created_date) - new Date(b.created_date));
    });
    return m;
  }, [classes]);

  const specById = useMemo(() => Object.fromEntries(specialties.map((s) => [s.id, s])), [specialties]);
  const hasPublishedBySpec = useMemo(() => {
    const m = {};
    curriculums.forEach((c) => {
      if (c.status === 'published') m[c.field_specialty_id] = true;
    });
    return m;
  }, [curriculums]);
  const curById = useMemo(() => Object.fromEntries(curriculums.map((c) => [c.id, c])), [curriculums]);
  const pendingByCur = useMemo(() => {
    const m = {};
    pendingChangeRequests.forEach((r) => { if (r.curriculum_id) m[r.curriculum_id] = true; });
    classes.forEach((cl) => {
      if (cl.curriculum_id && ((cl.pending_operation && cl.pending_operation !== 'none') || cl.quiz_pending_update)) m[cl.curriculum_id] = true;
    });
    return m;
  }, [pendingChangeRequests, classes]);
  const pendingClassNamesByCur = useMemo(() => {
    const m = {};
    classes.forEach((cl) => {
      if (cl.curriculum_id && ((cl.pending_operation && cl.pending_operation !== 'none') || cl.quiz_pending_update)) (m[cl.curriculum_id] ||= new Set()).add(cl.title);
    });
    Object.keys(m).forEach((k) => { m[k] = [...m[k]]; });
    return m;
  }, [classes]);
  const archivedByCur = useMemo(() => {
    const m = {};
    classes.forEach((cl) => {
      if (cl.archived && cl.curriculum_id) (m[cl.curriculum_id] ||= []).push(cl);
    });
    return m;
  }, [classes]);

  // Search mode: flat list of matching classes, each with its Field > Curriculum breadcrumb
  if (q) {
    const matches = classes.filter((c) => `${c.title} ${c.description || ''}`.toLowerCase().includes(q));
    return (
      <div className="space-y-2">
        {matches.map((cl) => {
          const cur = curById[cl.curriculum_id];
          const spec = cur ? specById[cur.field_specialty_id] : null;
          const isOpen = expanded.has(cl.id);
          return (
            <div key={cl.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              <FolderTree className="h-3.5 w-3.5 text-indigo-500" />
              <span className="font-medium text-slate-700">{spec?.name || '—'}</span>
              <ChevronRight className="h-3 w-3" />
              <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-slate-700">{cur?.name || '—'}</span>
            </div>
            <ClassRow cl={cl} expanded={isOpen} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} pendingOperation={cl.pending_operation} canDelete={cl.pending_operation === 'delete' || !pendingPublishCurriculumIds.has(cl.curriculum_id)} onViewQuiz={onViewQuiz} isArchived={!!cl.archived} isApproved={curById[cl.curriculum_id]?.status === 'published' && cl.pending_operation !== 'add'} pendingArchive={pendingClassArchiveIds.has(cl.id)} onArchiveClass={onArchiveClass} onSendClassArchiveApproval={onSendClassArchiveApproval} onRevertArchive={onRevertArchive} />
            {isOpen && <QuizPanel cl={cl} quizzesByClass={quizzesByClass} onViewQuiz={onViewQuiz} />}
            </div>
          );
        })}
        {matches.length === 0 && <Empty text="No classes match your search." />}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {specialties.map((s) => {
        const open = expanded.has(s.id);
        const curs = curriculumsBySpec[s.id] || [];
        const specPending = !open && curs.some((c) => !!pendingByCur[c.id]);
        const specArchivePending = !open && curs.some((c) => (archivedByCur[c.id] || []).length > 0);
        return (
          <div key={s.id}>
            <SpecialtyRow
              s={s}
              open={open}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchiveSpecialty}
              onShowReason={setReasonSpecialty}
              hasPublished={!!hasPublishedBySpec[s.id]}
              onAddCurriculum={() => onEdit({ type: 'curriculum', data: { name: '', description: '', type: 'required' }, parentId: s.id })}
              count={curs.length}
              pendingUpdate={specPending}
              archivePending={specArchivePending}
            />
            {open && (
              <div className="ml-3 border-l border-slate-200 pl-1">
                {curs.map((c) => {
                  const cOpen = expanded.has(c.id);
                  const cls = classesByCur[c.id] || [];
                  const aCls = archivedByCur[c.id] || [];
                  const archivedUnsent = aCls.filter((cl) => !pendingClassArchiveIds.has(cl.id)).length;
                  return (
                    <div key={c.id}>
                      <CurriculumRow
                        c={c}
                        open={cOpen}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onArchive={onArchive}
                        onPublish={onPublish}
                        onShowReason={setReasonCurriculum}
                        onShowPublish={setPublishCurriculum}
                        onShowInfo={setInfoCurriculum}
                        onShowRename={setRenameCurriculum}
                        onAddClass={() => onPickClass(c)}
                        count={cls.length}
                        pendingUpdate={!!pendingByCur[c.id]}
                        pendingClassNames={pendingClassNamesByCur[c.id]}
                        archivedUnsentCount={archivedUnsent}
                        archivedPending={aCls.length - archivedUnsent > 0}
                        onSendArchiveApproval={() => onSendCurriculumArchiveApproval?.(c)}
                      />
                      {cOpen && (
                        <div className="ml-3 border-l border-slate-200 pl-1">
                          {cls.map((cl) => {
                            const clOpen = expanded.has(cl.id);
                            return (
                              <div key={cl.id}>
                                <ClassRow cl={cl} expanded={clOpen} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} pendingOperation={cl.pending_operation} canDelete={cl.pending_operation === 'delete' || !pendingPublishCurriculumIds.has(cl.curriculum_id)} onViewQuiz={onViewQuiz} isArchived={!!cl.archived} isApproved={curById[cl.curriculum_id]?.status === 'published' && cl.pending_operation !== 'add'} pendingArchive={pendingClassArchiveIds.has(cl.id)} onArchiveClass={onArchiveClass} onSendClassArchiveApproval={onSendClassArchiveApproval} onRevertArchive={onRevertArchive} />
                                {clOpen && <QuizPanel cl={cl} quizzesByClass={quizzesByClass} onViewQuiz={onViewQuiz} />}
                              </div>
                            );
                          })}
                          {cls.length === 0 && <Empty text="No classes yet." />}
                        </div>
                      )}
                    </div>
                  );
                })}
                {curs.length === 0 && <Empty text="No curriculums yet." />}
              </div>
            )}
          </div>
        );
      })}
      {specialties.length === 0 && <Empty text="No specialties yet. Create your first one." />}
      <ArchiveReasonDialog curriculum={reasonCurriculum} onClose={() => setReasonCurriculum(null)} />
      <ArchiveReasonDialog specialty={reasonSpecialty} onClose={() => setReasonSpecialty(null)} />
      <PublishHistoryDialog curriculum={publishCurriculum} onClose={() => setPublishCurriculum(null)} />
      <CurriculumInfoDialog curriculum={infoCurriculum} onClose={() => setInfoCurriculum(null)} />
      <CurriculumRenameHistoryDialog curriculum={renameCurriculum} onClose={() => setRenameCurriculum(null)} />
    </div>
  );
}

function SpecialtyRow({ s, open, onToggle, onEdit, onDelete, onArchive, onShowReason, onAddCurriculum, count, pendingUpdate, hasPublished, archivePending }) {
  const archived = s.status === 'archived';
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
      <ChevronButton open={open} onClick={() => onToggle(s.id)} />
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <FolderTree className="h-4 w-4" />
      </div>
      <button onClick={() => onToggle(s.id)} className="flex-1 text-left">
        <span className={`font-medium text-slate-900 ${archived ? 'line-through text-slate-500' : ''}`}>{s.name}</span>
        {s.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{s.code}</span>}
        <span className="ml-2 text-xs text-slate-400">{count} curriculum{count !== 1 ? 's' : ''}</span>
        {archived && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShowReason(s); }}
            className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:opacity-80"
            title="View archive reason"
          >
            Archived
          </button>
        )}
        {(pendingUpdate || archivePending) && (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="A curriculum under this specialty has changes awaiting approval">
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
      </button>
      <button onClick={onAddCurriculum} title="Add curriculum" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Plus className="h-4 w-4" /></button>
      <div className="flex gap-0.5">
        <button onClick={() => onEdit({ type: 'specialty', data: { ...s } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
        {!archived && hasPublished && (
          <button onClick={() => onArchive(s)} title="Archive specialty" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
        )}
        {!archived && !hasPublished && (
          <button onClick={() => onDelete('specialty', s.id)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

function CurriculumRow({ c, open, onToggle, onEdit, onDelete, onArchive, onPublish, onShowReason, onShowPublish, onShowInfo, onShowRename, onAddClass, count, pendingUpdate, pendingClassNames, archivedUnsentCount = 0, archivedPending = false, onSendArchiveApproval }) {
  const sm = statusMeta[c.status] || statusMeta.published;
  const showStatus = c.status && c.status !== 'draft';
  const canRequestPublish = count > 0 && (c.status !== 'published' || pendingUpdate || hasPendingUpdate(c));
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
      <ChevronButton open={open} onClick={() => onToggle(c.id)} />
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <BookOpen className="h-4 w-4" />
      </div>
      <button onClick={() => onToggle(c.id)} className="flex-1 text-left">
        <span className="font-medium text-slate-900">{c.name}</span>
        {c.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{c.code}</span>}
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'required' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>
          {c.type === 'required' ? 'Required' : 'Elective'}
        </span>
        {showStatus && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (c.status === 'archived') onShowReason(c); else if (c.status === 'published') onShowPublish(c); }}
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${sm.cls} ${(c.status === 'archived' || c.status === 'published') ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            title={c.status === 'archived' ? 'View archive reason' : c.status === 'published' ? 'View publish history' : undefined}
          >
            {sm.label}
          </button>
        )}
        <span className="ml-2 text-xs text-slate-400">{count} class{count !== 1 ? 'es' : ''}</span>
        {(pendingUpdate || archivedUnsentCount > 0 || archivedPending) && !open && (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Changes made since the last published version">
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
      </button>
      <button onClick={onAddClass} title="Add class" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Plus className="h-4 w-4" /></button>
      {archivedUnsentCount > 0 && !canRequestPublish && (
        <button onClick={onSendArchiveApproval} title={`Send ${archivedUnsentCount} archived class(es) for approval`} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
          <Send className="h-3.5 w-3.5" /> Send for approval ({archivedUnsentCount})
        </button>
      )}
      {archivedUnsentCount === 0 && archivedPending && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200" title="Archived classes awaiting manager approval">
          <Clock className="h-3.5 w-3.5" /> Awaiting approval
        </span>
      )}
      <div className="flex gap-0.5">
        <button onClick={() => onShowInfo(c)} title="Info" className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"><Info className="h-4 w-4" /></button>
        <button onClick={() => onShowRename(c)} title="Rename history" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><History className="h-4 w-4" /></button>
        {canRequestPublish && (
          <button onClick={() => onPublish(c)} title={pendingUpdate ? 'Request publish (new version)' : 'Request publish'} className={`rounded-lg p-1.5 hover:bg-emerald-50 hover:text-emerald-600 ${pendingUpdate ? 'text-emerald-600' : 'text-slate-400'}`}><Send className="h-4 w-4" /></button>
        )}
        <button onClick={() => onEdit({ type: 'curriculum', data: { ...c } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
        {c.status === 'published' ? (
          <button onClick={() => onArchive(c)} title="Archive" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
        ) : (
          <button onClick={() => onDelete('curriculum', c.id)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

function ClassRow({ cl, expanded, onToggle, onEdit, onDelete, pendingOperation, canDelete = true, onViewQuiz, isArchived = false, isApproved = false, pendingArchive = false, onArchiveClass, onSendClassArchiveApproval, onRevertArchive }) {
  const Meta = contentTypeMeta[cl.content_type];
  const Icon = Meta?.icon || FileText;
  const hasQuiz = cl.has_quiz;
  const op = pendingOperation && pendingOperation !== 'none' ? pendingOperation : null;
  const isDelete = op === 'delete';
  const opLabel = op === 'add' ? 'Pending add — awaiting publish approval'
    : op === 'edit' ? 'Pending edit — awaiting publish approval'
    : op === 'delete' ? 'Pending delete — removed on publish approval'
    : '';
  return (
    <div className={`group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 ${hasQuiz ? 'bg-violet-50/50 ring-1 ring-violet-200' : ''} ${isDelete ? 'opacity-60' : ''} ${isArchived ? 'opacity-70' : ''}`}>
      <ChevronButton open={expanded} onClick={() => onToggle(cl.id)} />
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${hasQuiz ? 'bg-violet-100 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <Link to={`/training/class/${cl.id}`} className="flex-1 text-left hover:text-indigo-600">
        <span className={`font-medium text-slate-900 hover:text-indigo-600 ${isDelete ? 'line-through' : ''} ${isArchived ? 'line-through text-slate-500' : ''}`}>{cl.title}</span>
        <span className="ml-2 text-xs text-slate-400">{Meta?.label}</span>
        {cl.type === 'elective' && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Elective</span>}
        {cl.duration_minutes > 0 && <span className="ml-2 text-xs text-slate-400">{cl.duration_minutes} min</span>}
        {hasQuiz && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
            <ListChecks className="h-3 w-3" /> Quiz
          </span>
        )}
        {isArchived && (
          <>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600" title="Archived — awaiting manager approval to remove">
              <Archive className="h-3 w-3" /> {pendingArchive ? 'Awaiting approval' : 'Archived'}
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Archived — change awaiting approval">
              <RefreshCw className="h-3 w-3" />
            </span>
          </>
        )}
        {op && (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title={opLabel}>
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
        {cl.quiz_pending_update && !expanded && (
          <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Quiz update pending — awaiting curriculum publish approval">
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
      </Link>
      {hasQuiz && !isArchived && (
        <button onClick={() => onViewQuiz?.(cl)} className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">
          <Eye className="h-3.5 w-3.5" /> View
        </button>
      )}
      {isArchived ? (
        <button onClick={() => onRevertArchive?.(cl)} title="Revert archival" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><Undo2 className="h-4 w-4" /></button>
      ) : isApproved ? (
        <div className="flex gap-0.5">
          <button onClick={() => onEdit({ type: 'class', data: { ...cl } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onArchiveClass?.(cl)} title="Archive (approved class)" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
        </div>
      ) : (
        <RowActions onEdit={() => onEdit({ type: 'class', data: { ...cl } })} onDelete={() => onDelete('class', cl.id)} deleteDisabled={!canDelete} deleteTitle={!canDelete ? 'Cannot delete while a publish request is awaiting review' : undefined} />
      )}
    </div>
  );
}

function QuizPanel({ cl, quizzesByClass, onViewQuiz }) {
  const quizChangePending = !!cl.quiz_pending_update;
  const data = quizzesByClass[cl.id];
  return (
    <div className="ml-6 mr-2 mb-1 rounded-lg bg-slate-50 p-3">
      {data === undefined ? (
        <span className="text-xs text-slate-400">Loading quiz…</span>
      ) : data === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>No quiz attached.</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-600" />
            <span className="font-medium text-slate-900">{data.quiz.title}</span>
            <span className="text-xs text-slate-400">Passing score: {data.quiz.passing_score}%</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {data.questionCount} question{data.questionCount !== 1 ? 's' : ''}
            </span>
            {quizChangePending && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Quiz update pending — awaiting curriculum publish approval">
                <RefreshCw className="h-3 w-3" />
              </span>
            )}
          </div>
          <button onClick={() => onViewQuiz?.(cl)} className="text-xs font-medium text-violet-700 hover:underline">View questions →</button>
        </div>
      )}
    </div>
  );
}

function ChevronButton({ open, onClick }) {
  return (
    <button onClick={onClick} className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200">
      <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
  );
}

function RowActions({ onEdit, onDelete, deleteDisabled = false, deleteTitle }) {
  return (
    <div className="flex gap-0.5">
      <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
      <button onClick={onDelete} disabled={deleteDisabled} title={deleteTitle} className={`rounded-lg p-1.5 ${deleteDisabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function Empty({ text }) {
  return <div className="ml-8 py-2 text-sm text-slate-400">{text}</div>;
}