import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Plus, Pencil, Trash2, Archive, ChevronRight, ListChecks, Search, ArrowUp, ArrowDown, ArrowUpDown,
  FileText, Video, Radio, Send, Clock,
} from 'lucide-react';
import PublishHistoryDialog from './PublishHistoryDialog';

const contentTypeMeta = {
  pdf: { label: 'PDF Document', icon: FileText },
  on_demand_video: { label: 'On-Demand Video', icon: Video },
  live_class: { label: 'Live Class', icon: Radio },
  linked_document: { label: 'Linked Document', icon: FileText },
};

const statusMeta = {
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700' },
  published: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-slate-200 text-slate-600' },
  // legacy values from the previous status scheme
  approved: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
  active: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700' },
};

function compareValues(a, b, key) {
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
}

function SortHeader({ label, sortKey, sort, setSort, className }) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => setSort({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export default function ContentTableView({ specialties, curriculums, classes, onEdit, onDelete, onArchive, onArchiveSpecialty, onPublish, statusFilter = 'all', onPickClass, onViewQuiz, initialSpec, initialCur, onArchiveClass, onSendClassArchiveApproval, pendingClassArchiveIds = new Set() }) {
  const [selectedSpec, setSelectedSpec] = useState(initialSpec || null);
  const [selectedCur, setSelectedCur] = useState(initialCur || null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [publishHistoryCurriculum, setPublishHistoryCurriculum] = useState(null);

  const level = selectedCur ? 'classes' : selectedSpec ? 'curriculums' : 'specialties';

  useEffect(() => {
    setQuery('');
    setSort({ key: null, dir: 'asc' });
  }, [level]);

  const curriculumsForSpec = useMemo(
    () => (selectedSpec
      ? curriculums.filter((c) => {
          if (c.field_specialty_id !== selectedSpec.id) return false;
          if (statusFilter === 'all') return true;
          if (statusFilter === 'archived') return c.status === 'archived' || c.status === 'published';
          return c.status === statusFilter;
        })
      : []),
    [curriculums, selectedSpec, statusFilter]
  );
  const classesForCur = useMemo(
    () => (selectedCur ? classes.filter((c) => c.curriculum_id === selectedCur.id) : []),
    [classes, selectedCur]
  );

  const sortedSpecialties = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? specialties.filter((s) => `${s.name} ${s.description || ''}`.toLowerCase().includes(q)) : specialties;
    const arr = [...filtered];
    if (sort.key) arr.sort((a, b) => { const c = compareValues(a, b, sort.key); return sort.dir === 'asc' ? c : -c; });
    return arr;
  }, [specialties, query, sort]);

  const sortedCurriculums = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? curriculumsForSpec.filter((c) => `${c.name} ${c.description || ''}`.toLowerCase().includes(q)) : curriculumsForSpec;
    const arr = [...filtered];
    if (sort.key) arr.sort((a, b) => { const c = compareValues(a, b, sort.key); return sort.dir === 'asc' ? c : -c; });
    return arr;
  }, [curriculumsForSpec, query, sort]);

  const sortedClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? classesForCur.filter((c) => `${c.title} ${c.description || ''}`.toLowerCase().includes(q)) : classesForCur;
    const arr = [...filtered];
    if (sort.key) arr.sort((a, b) => { const c = compareValues(a, b, sort.key); return sort.dir === 'asc' ? c : -c; });
    return arr;
  }, [classesForCur, query, sort]);

  function goSpecialties() { setSelectedSpec(null); setSelectedCur(null); }
  function goCurriculums(spec) { setSelectedSpec(spec); setSelectedCur(null); }
  function goClasses(cur) { setSelectedCur(cur); }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={goSpecialties} className="hover:text-slate-900">Specialties</button>
        {selectedSpec && (
          <>
            <ChevronRight className="h-4 w-4" />
            <button onClick={() => goCurriculums(selectedSpec)} className="hover:text-slate-900">{selectedSpec.name}</button>
          </>
        )}
        {selectedCur && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-900">{selectedCur.name}</span>
          </>
        )}
      </div>

      {level === 'specialties' && (
        <div>
          <Toolbar
            title="Field Specialties"
            subtitle="Top-level training domains for your organization."
            query={query} setQuery={setQuery} placeholder="Search specialties…"
            onNew={() => onEdit({ type: 'specialty', data: { name: '', description: '' } })} newLabel="New Specialty"
          />
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Name" sortKey="name" sort={sort} setSort={setSort} />
                  <SortHeader label="Description" sortKey="description" sort={sort} setSort={setSort} />
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSpecialties.map((s) => {
                  const hasPublished = curriculums.some((c) => c.field_specialty_id === s.id && c.status === 'published');
                  const archived = s.status === 'archived';
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button onClick={() => goCurriculums(s)} className={`text-left font-medium hover:text-indigo-600 ${archived ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{s.name}</button> {s.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{s.code}</span>}
                          {archived && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Archived</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{s.description || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => onEdit({ type: 'specialty', data: { ...s } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                          {!archived && hasPublished && (
                            <button onClick={() => onArchiveSpecialty(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Archive specialty"><Archive className="h-4 w-4" /></button>
                          )}
                          {!archived && !hasPublished && (
                            <button onClick={() => onDelete('specialty', s.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {sortedSpecialties.length === 0 && (
              <Empty text={specialties.length === 0 ? 'No specialties yet. Create your first one.' : 'No specialties match your search.'} />
            )}
          </TableCard>
        </div>
      )}

      {level === 'curriculums' && (
        <div>
          <Toolbar
            title={`Curriculums in ${selectedSpec.name}`}
            subtitle="Group related classes into a curriculum."
            query={query} setQuery={setQuery} placeholder="Search curriculums…"
            onNew={() => onEdit({ type: 'curriculum', data: { name: '', description: '', type: 'required' }, parentId: selectedSpec.id })} newLabel="New Curriculum"
          />
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Name" sortKey="name" sort={sort} setSort={setSort} />
                  <SortHeader label="Type" sortKey="type" sort={sort} setSort={setSort} className="w-[120px]" />
                  <SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} className="w-[110px]" />
                  <SortHeader label="Description" sortKey="description" sort={sort} setSort={setSort} />
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCurriculums.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button onClick={() => goClasses(c)} className="text-left font-medium text-slate-900 hover:text-indigo-600">{c.name}</button> {c.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{c.code}</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.type === 'required' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>
                        {c.type === 'required' ? 'Required' : 'Elective'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => { if (c.status === 'published') setPublishHistoryCurriculum(c); }}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${(statusMeta[c.status] || statusMeta.draft).cls} ${c.status === 'published' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        title={c.status === 'published' ? 'View publish history' : undefined}
                      >
                        {(statusMeta[c.status] || statusMeta.draft).label}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {c.description || '—'}
                      {c.status === 'archived' && c.archive_reason && (
                        <span className="mt-0.5 block text-xs italic text-slate-400">Archived: {c.archive_reason}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {c.status !== 'published' && (
                          <button onClick={() => onPublish(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Request publish"><Send className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => onEdit({ type: 'curriculum', data: { ...c } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => onArchive(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Archive"><Archive className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedCurriculums.length === 0 && (
              <Empty text={curriculumsForSpec.length === 0 ? 'No curriculums yet.' : 'No curriculums match your search.'} />
            )}
          </TableCard>
        </div>
      )}

      {level === 'classes' && (
        <div>
          <Toolbar
            title={`Classes in ${selectedCur.name}`}
            subtitle="Add PDFs, videos, or live sessions. Optionally add a quiz."
            query={query} setQuery={setQuery} placeholder="Search classes…"
            onNew={() => onPickClass(selectedCur)} newLabel="Add from Library"
          />
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Title" sortKey="title" sort={sort} setSort={setSort} />
                  <SortHeader label="Content" sortKey="content_type" sort={sort} setSort={setSort} className="w-[150px]" />
                  <SortHeader label="Type" sortKey="type" sort={sort} setSort={setSort} className="w-[110px]" />
                  <SortHeader label="Duration" sortKey="duration_minutes" sort={sort} setSort={setSort} className="w-[100px] text-right" />
                  <SortHeader label="Order" sortKey="order" sort={sort} setSort={setSort} className="w-[80px] text-right" />
                  <TableHead className="w-[80px] text-center">Quiz</TableHead>
                  <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClasses.map((cl) => {
                  const Meta = contentTypeMeta[cl.content_type];
                  const Icon = Meta?.icon || FileText;
                  const isArchived = !!cl.archived;
                  const isApproved = selectedCur?.status === 'published' && cl.pending_operation !== 'add';
                  const pendingArchive = pendingClassArchiveIds.has(cl.id);
                  return (
                    <TableRow key={cl.id} className={cl.has_quiz ? 'bg-violet-50/40' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <Link to={`/training/class/${cl.id}`} className={`font-medium hover:text-indigo-600 ${isArchived ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{cl.title}</Link>
                          {isArchived && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                              <Archive className="h-3 w-3" /> Archived
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{Meta?.label || cl.content_type}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cl.type === 'elective' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                          {cl.type === 'elective' ? 'Elective' : 'Required'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">{cl.duration_minutes > 0 ? `${cl.duration_minutes} min` : '—'}</TableCell>
                      <TableCell className="text-right text-sm text-slate-500">{cl.order}</TableCell>
                      <TableCell className="text-center">
                        {cl.has_quiz ? <ListChecks className="mx-auto h-4 w-4 text-violet-600" /> : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isArchived ? (
                          pendingArchive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                              <Clock className="h-3.5 w-3.5" /> Awaiting approval
                            </span>
                          ) : (
                            <button onClick={() => onSendClassArchiveApproval?.(cl)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                              <Send className="h-3.5 w-3.5" /> Send for approval
                            </button>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {cl.has_quiz && (
                              <button onClick={() => onViewQuiz?.(cl)} className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">
                                <ListChecks className="h-3.5 w-3.5" /> View
                              </button>
                            )}
                            <button onClick={() => onEdit({ type: 'class', data: { ...cl } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                            {isApproved ? (
                              <button onClick={() => onArchiveClass?.(cl)} title="Archive (approved class)" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
                            ) : (
                              <button onClick={() => onDelete('class', cl.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {sortedClasses.length === 0 && (
              <Empty text={classesForCur.length === 0 ? 'No classes yet.' : 'No classes match your search.'} />
            )}
          </TableCard>
        </div>
      )}
        <PublishHistoryDialog curriculum={publishHistoryCurriculum} onClose={() => setPublishHistoryCurriculum(null)} />
    </div>
  );
}

function Toolbar({ title, subtitle, query, setQuery, placeholder, onNew, newLabel }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="w-56 pl-8" />
        </div>
        <Button onClick={onNew}>
          <Plus className="mr-1.5 h-4 w-4" /> {newLabel}
        </Button>
      </div>
    </div>
  );
}

function TableCard({ children }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{children}</div>;
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="inline-flex gap-1">
      <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
      <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function Empty({ text }) {
  return <div className="border-t border-slate-100 p-10 text-center text-sm text-slate-500">{text}</div>;
}