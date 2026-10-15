import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { Breadcrumbs, ContentIcon, EmptyState, PageHeader, TypeBadge } from '../../components/common';
import { ConfirmModal } from '../../components/Modal';
import { formatDate } from '../../dates';
import { classesOf, curriculaOf, questionsOf, quizOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { CONTENT_TYPES, TONES, ui } from '../../theme';
import { ClassFormModal, CurriculumFormModal, SpecialtyFormModal } from './CatalogForms';

const CATALOG_TYPE_STYLE = {
  Field: 'bg-violet-50 text-violet-700',
  Curriculum: 'bg-emerald-50 text-emerald-700',
  Class: 'bg-amber-50 text-amber-700',
};

function ExpandToggle({ expanded, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
    >
      <span className="material-symbols-outlined text-[20px]">{expanded ? 'expand_more' : 'chevron_right'}</span>
    </button>
  );
}

function CatalogTypeIcon({ type }) {
  const style = { Field: TONES.violet, Curriculum: TONES.emerald, Class: TONES.amber }[type];
  const icon = { Field: 'sell', Curriculum: 'menu_book', Class: 'description' }[type];
  return (
    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${style}`}>
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </span>
  );
}

// A collapsible Field > Curriculum > Class tree (rendered as a table) so an admin can
// see the whole catalog without clicking through each level, or search across all of it.
function CatalogTable({ state, onEditSpecialty, onDeleteSpecialty, onAddCurriculum, onAddClass, onEditCurriculum, onDeleteCurriculum, onEditClass, onDeleteClass }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expandedFields, setExpandedFields] = useState(() => new Set());
  const [expandedCurricula, setExpandedCurricula] = useState(() => new Set());
  const [expandedClasses, setExpandedClasses] = useState(() => new Set());

  const toggleIn = (setState) => (id) =>
    setState((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleField = toggleIn(setExpandedFields);
  const toggleCurriculum = toggleIn(setExpandedCurricula);
  const toggleClass = toggleIn(setExpandedClasses);

  const query = search.trim().toLowerCase();

  // Flat, filtered rows across every level — only built/used while the admin is actively
  // searching. The search box itself lives in ONE place below (not duplicated per branch),
  // so typing never swaps out the <input> DOM node and never loses focus mid-keystroke.
  let searchRows = null;
  if (query) {
    const rows = [];
    state.fieldSpecialties.forEach((specialty) => {
      rows.push({
        type: 'Field',
        id: specialty.id,
        name: specialty.code ? `${specialty.name} (${specialty.code})` : specialty.name,
        path: '—',
        to: `/training/catalog/${specialty.id}`,
        publishedAt: specialty.created_at,
      });
      curriculaOf(state, specialty.id).forEach((curriculum) => {
        rows.push({
          type: 'Curriculum',
          id: curriculum.id,
          name: curriculum.code ? `${curriculum.name} (${curriculum.code})` : curriculum.name,
          path: specialty.name,
          to: `/training/catalog/${specialty.id}/${curriculum.id}`,
          publishedAt: curriculum.created_at,
        });
        classesOf(state, curriculum.id).forEach((entry) => {
          rows.push({
            type: 'Class',
            id: entry.id,
            name: entry.title,
            path: `${specialty.name} / ${curriculum.name}`,
            to: `/training/catalog/${specialty.id}/${curriculum.id}`,
            publishedAt: entry.created_at,
          });
        });
      });
    });
    searchRows = rows.filter((row) => row.name.toLowerCase().includes(query) || row.path.toLowerCase().includes(query));
  }

  return (
    <div className={`${ui.card} mt-6 overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          {query ? (
            <button type="button" onClick={() => setSearch('')} className={ui.iconBtn} aria-label="Back to catalog" title="Back">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          ) : null}
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a field, curriculum or class…"
              className={`${ui.input} max-w-xs pr-9`}
              aria-label="Search catalog"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {searchRows ? (
        <>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Under</th>
                <th className="px-4 py-2.5">Date Published</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {searchRows.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATALOG_TYPE_STYLE[row.type]}`}>{row.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{row.path}</td>
                  <td className="px-4 py-2.5 text-slate-500">{row.publishedAt ? formatDate(row.publishedAt) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={row.to} className={ui.link}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {searchRows.length === 0 ? <EmptyState icon="search_off" message="Nothing matches that search." /> : null}
        </>
      ) : (
      <>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Under</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.fieldSpecialties.map((specialty) => {
            const fieldOpen = expandedFields.has(specialty.id);
            const curricula = curriculaOf(state, specialty.id);
            return (
              <React.Fragment key={specialty.id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <ExpandToggle expanded={fieldOpen} onToggle={() => toggleField(specialty.id)} label={specialty.name} />
                      <CatalogTypeIcon type="Field" />
                      {specialty.name}
                      {specialty.code ? (
                        <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-500">
                          {specialty.code} · rev {specialty.revision}
                        </span>
                      ) : null}
                      <span className="text-xs font-normal text-slate-400">
                        {curricula.length} curriculum{curricula.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATALOG_TYPE_STYLE.Field}`}>Field</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">—</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => onAddCurriculum(specialty.id)} className={ui.iconBtn} aria-label={`Add curriculum to ${specialty.name}`} title="Add curriculum">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                      <RowActions label={specialty.name} onEdit={() => onEditSpecialty(specialty)} onDelete={() => onDeleteSpecialty(specialty)} />
                    </div>
                  </td>
                </tr>

                {fieldOpen
                  ? curricula.map((curriculum) => {
                      const curriculumOpen = expandedCurricula.has(curriculum.id);
                      const classes = classesOf(state, curriculum.id);
                      return (
                        <React.Fragment key={curriculum.id}>
                          <tr className="bg-slate-50/40 hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2 pl-6">
                                <ExpandToggle expanded={curriculumOpen} onToggle={() => toggleCurriculum(curriculum.id)} label={curriculum.name} />
                                <CatalogTypeIcon type="Curriculum" />
                                <span className="font-medium text-slate-800">{curriculum.name}</span>
                                {curriculum.code ? (
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-500">
                                    {curriculum.code} · rev {curriculum.revision}
                                  </span>
                                ) : null}
                                <TypeBadge type={curriculum.type} />
                                <span className="text-xs font-normal text-slate-400">
                                  {classes.length} class{classes.length === 1 ? '' : 'es'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATALOG_TYPE_STYLE.Curriculum}`}>Curriculum</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{specialty.name}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => onAddClass(curriculum.id)} className={ui.iconBtn} aria-label={`Add class to ${curriculum.name}`} title="Add class">
                                  <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                                <RowActions label={curriculum.name} onEdit={() => onEditCurriculum(curriculum)} onDelete={() => onDeleteCurriculum(curriculum)} />
                              </div>
                            </td>
                          </tr>

                          {curriculumOpen
                            ? classes.map((entry) => {
                                const quiz = entry.has_quiz ? quizOf(state, entry.id) : null;
                                const questionCount = quiz ? questionsOf(state, quiz.id).length : 0;
                                const classOpen = entry.has_quiz && expandedClasses.has(entry.id);
                                return (
                                  <React.Fragment key={entry.id}>
                                    <tr className="hover:bg-slate-50">
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2 pl-11 text-slate-700">
                                          {entry.has_quiz ? (
                                            <ExpandToggle expanded={classOpen} onToggle={() => toggleClass(entry.id)} label={entry.title} />
                                          ) : (
                                            <span className="w-6 flex-none" />
                                          )}
                                          <CatalogTypeIcon type="Class" />
                                          {entry.title}
                                          <span className="text-xs font-normal uppercase text-slate-400">{CONTENT_TYPES[entry.content_type]?.short}</span>
                                          {entry.duration_minutes > 0 ? <span className="text-xs font-normal text-slate-400">{entry.duration_minutes} min</span> : null}
                                          {entry.has_quiz ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
                                              <span className="material-symbols-outlined text-[12px]">checklist</span>
                                              Quiz
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATALOG_TYPE_STYLE.Class}`}>Class</span>
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-500">
                                        {specialty.name} / {curriculum.name}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <div className="flex justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/training/quiz-builder/${entry.id}`)}
                                            className={`${ui.link} text-xs`}
                                          >
                                            <span className="material-symbols-outlined text-[14px]">checklist</span>
                                            Edit
                                          </button>
                                          <RowActions label={entry.title} onEdit={() => onEditClass(entry)} onDelete={() => onDeleteClass(entry)} />
                                        </div>
                                      </td>
                                    </tr>
                                    {classOpen ? (
                                      <tr className="hover:bg-slate-50">
                                        <td colSpan={3} className="px-4 py-1.5 pl-[4.75rem] text-xs text-slate-400">
                                          {quiz ? (
                                            <>
                                              {entry.title} Quiz · Passing score {quiz.passing_score}% · {questionCount} question{questionCount === 1 ? '' : 's'}
                                            </>
                                          ) : (
                                            'No quiz attached.'
                                          )}
                                        </td>
                                        <td className="px-4 py-1.5 text-right">
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/training/quiz-builder/${entry.id}`)}
                                            className={`${ui.link} text-xs`}
                                          >
                                            {questionCount > 0 ? 'Open quiz builder' : 'Build one'}
                                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ) : null}
                                  </React.Fragment>
                                );
                              })
                            : null}
                          {curriculumOpen && classes.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-2 pl-14 text-xs text-slate-400">
                                No classes yet.
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })
                  : null}
                {fieldOpen && curricula.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 pl-6 text-xs text-slate-400">
                      No curriculums yet.
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {state.fieldSpecialties.length === 0 ? <EmptyState icon="search_off" message="No specialties yet." /> : null}
      </>
      )}
    </div>
  );
}

// The alternate flat view next to Tree — a plain sortable table of just the top-level
// Field Specialties, matching the simpler "drill in one level at a time" browsing style.
function SpecialtyTable({ state, onEditSpecialty, onDeleteSpecialty }) {
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const query = search.trim().toLowerCase();
  const rows = state.fieldSpecialties
    .filter((entry) => !query || entry.name.toLowerCase().includes(query) || (entry.description || '').toLowerCase().includes(query))
    .sort((a, b) => (sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));

  return (
    <div className={`${ui.card} mt-6 overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search specialties…"
          className={`${ui.input} max-w-xs`}
          aria-label="Search specialties"
        />
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-2.5">
              <button type="button" onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))} className="inline-flex items-center gap-1">
                Name
                <span className="material-symbols-outlined text-[16px]">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
              </button>
            </th>
            <th className="px-4 py-2.5">Description</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">
                <Link to={`/training/catalog/${entry.id}`} className={ui.link}>
                  {entry.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-slate-500">{entry.description || '—'}</td>
              <td className="px-4 py-2.5 text-right">
                <RowActions label={entry.name} onEdit={() => onEditSpecialty(entry)} onDelete={() => onDeleteSpecialty(entry)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <EmptyState icon="search_off" message="Nothing matches that search." /> : null}
    </div>
  );
}

function RowActions({ onEdit, onDelete, label }) {
  return (
    <div className="relative z-10 flex items-center gap-1">
      <button type="button" onClick={onEdit} className={ui.iconBtn} aria-label={`Edit ${label}`}>
        <span className="material-symbols-outlined text-[18px]">edit</span>
      </button>
      <button type="button" onClick={onDelete} className={`${ui.iconBtn} hover:text-red-600`} aria-label={`Delete ${label}`}>
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  );
}

export default function ContentCatalog() {
  const { specialtyId, curriculumId } = useParams();
  const navigate = useNavigate();
  const state = useTrainingState();
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('tree');

  const specialty = state.fieldSpecialties.find((entry) => entry.id === specialtyId);
  const curriculum = state.curriculums.find((entry) => entry.id === curriculumId);

  if (specialtyId && !specialty) return <Navigate to="/training/catalog" replace />;
  if (curriculumId && (!curriculum || curriculum.field_specialty_id !== specialtyId)) {
    return <Navigate to={`/training/catalog/${specialtyId}`} replace />;
  }

  const classesInCurriculum = curriculum ? classesOf(state, curriculum.id) : [];
  // "Add Class" from the tree view (no drilled-in curriculum in the URL) carries its own target.
  const classModalCurriculumId = modal?.curriculumId || modal?.item?.curriculum_id || curriculum?.id;
  const classModalCurriculum = state.curriculums.find((entry) => entry.id === classModalCurriculumId);
  const classModalSiblings = classModalCurriculumId ? classesOf(state, classModalCurriculumId) : [];

  const closeModal = () => setModal(null);
  const closeConfirm = () => setConfirm(null);

  const confirmDelete = () => {
    if (confirm.kind === 'specialty') {
      trainingService.deleteSpecialty(confirm.item.id);
      message.success('Specialty deleted');
    } else if (confirm.kind === 'curriculum') {
      trainingService.deleteCurriculum(confirm.item.id);
      message.success('Curriculum deleted');
    } else {
      trainingService.deleteClass(confirm.item.id);
      message.success('Class deleted');
    }
    closeConfirm();
  };

  const confirmText = {
    specialty: 'This also deletes its curriculums, classes, quizzes and assignments.',
    curriculum: 'This also deletes its classes, quizzes and assignments.',
    class: 'This also deletes its quiz and learner progress.',
  };

  let body;
  if (!specialtyId) {
    body = (
      <>
        <Breadcrumbs items={[{ label: 'Specialties' }]} />
        <PageHeader
          title="Content Catalog"
          subtitle="Expand a specialty to see its curriculums, a curriculum to see its classes, and a class to see its quiz."
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${viewMode === 'tree' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  Tree
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">table_rows</span>
                  Table
                </button>
              </div>
              <button type="button" className={ui.btnDark} onClick={() => setModal({ kind: 'specialty' })}>
                <span className="material-symbols-outlined text-[20px]">add</span>
                New Specialty
              </button>
            </div>
          }
        />
        {state.fieldSpecialties.length === 0 ? (
          <EmptyState icon="account_tree" message="No specialties yet. Create one to get started." />
        ) : viewMode === 'table' ? (
          <SpecialtyTable
            state={state}
            onEditSpecialty={(entry) => setModal({ kind: 'specialty', item: entry })}
            onDeleteSpecialty={(entry) => setConfirm({ kind: 'specialty', item: entry })}
          />
        ) : (
          <CatalogTable
            state={state}
            onEditSpecialty={(entry) => setModal({ kind: 'specialty', item: entry })}
            onDeleteSpecialty={(entry) => setConfirm({ kind: 'specialty', item: entry })}
            onAddCurriculum={(specialtyId) => setModal({ kind: 'curriculum', specialtyId })}
            onAddClass={(curriculumId) => setModal({ kind: 'class', curriculumId })}
            onEditCurriculum={(entry) => setModal({ kind: 'curriculum', item: entry })}
            onDeleteCurriculum={(entry) => setConfirm({ kind: 'curriculum', item: entry })}
            onEditClass={(entry) => setModal({ kind: 'class', item: entry })}
            onDeleteClass={(entry) => setConfirm({ kind: 'class', item: entry })}
          />
        )}
      </>
    );
  } else if (!curriculumId) {
    const curricula = curriculaOf(state, specialty.id);
    body = (
      <>
        <Breadcrumbs items={[{ label: 'Specialties', to: '/training/catalog' }, { label: specialty.name }]} />
        <PageHeader
          title={`Curriculums in ${specialty.name}`}
          subtitle="Group related classes into a curriculum."
          action={
            <button type="button" className={ui.btnDark} onClick={() => setModal({ kind: 'curriculum' })}>
              <span className="material-symbols-outlined text-[20px]">add</span>
              New Curriculum
            </button>
          }
        />
        <div className="mt-8 space-y-3">
          {curricula.map((entry) => (
            <div key={entry.id} className={`${ui.card} relative flex items-center gap-4 p-4 transition hover:border-violet-300`}>
              <Link to={`/training/catalog/${specialty.id}/${entry.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${entry.name}`} />
              <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${TONES.emerald}`}>
                <span className="material-symbols-outlined text-[22px]">menu_book</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{entry.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <TypeBadge type={entry.type} />
                  <span>{entry.description || 'No description'}</span>
                </div>
              </div>
              <RowActions
                label={entry.name}
                onEdit={() => setModal({ kind: 'curriculum', item: entry })}
                onDelete={() => setConfirm({ kind: 'curriculum', item: entry })}
              />
            </div>
          ))}
        </div>
        {curricula.length === 0 ? <EmptyState icon="menu_book" message="No curriculums yet." /> : null}
      </>
    );
  } else {
    const classes = classesInCurriculum;
    body = (
      <>
        <Breadcrumbs
          items={[
            { label: 'Specialties', to: '/training/catalog' },
            { label: specialty.name, to: `/training/catalog/${specialty.id}` },
            { label: curriculum.name },
          ]}
        />
        <PageHeader
          title={`Classes in ${curriculum.name}`}
          subtitle="Add PDFs, videos, or live sessions. Optionally add a quiz."
          action={
            <button type="button" className={ui.btnDark} onClick={() => setModal({ kind: 'class' })}>
              <span className="material-symbols-outlined text-[20px]">add</span>
              New Class
            </button>
          }
        />
        <div className="mt-8 space-y-3">
          {classes.map((entry) => (
            <div key={entry.id} className={`${ui.card} flex flex-wrap items-center gap-4 p-4`}>
              <ContentIcon type={entry.content_type} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{entry.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <span>{CONTENT_TYPES[entry.content_type]?.label}</span>
                  {entry.has_quiz ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      <span className="material-symbols-outlined text-[14px]">checklist</span>
                      Quiz
                    </span>
                  ) : null}
                  {entry.duration_minutes > 0 ? <span>{entry.duration_minutes} min</span> : null}
                </div>
              </div>
              <button type="button" className={ui.btnTint} onClick={() => navigate(`/training/quiz-builder/${entry.id}`)}>
                <span className="material-symbols-outlined text-[16px]">checklist</span>
                {entry.has_quiz ? 'Edit Quiz' : 'Build Quiz'}
              </button>
              <RowActions
                label={entry.title}
                onEdit={() => setModal({ kind: 'class', item: entry })}
                onDelete={() => setConfirm({ kind: 'class', item: entry })}
              />
            </div>
          ))}
        </div>
        {classes.length === 0 ? <EmptyState icon="assignment" message="No classes yet." /> : null}
      </>
    );
  }

  return (
    <div className={ui.page}>
      {body}

      <SpecialtyFormModal
        open={modal?.kind === 'specialty'}
        initial={modal?.item}
        onClose={closeModal}
        onSave={async (values) => {
          if (modal.item) await trainingService.updateSpecialty(modal.item.id, values);
          else await trainingService.createSpecialty(values);
          message.success(modal.item ? 'Specialty updated' : 'Specialty created');
          closeModal();
        }}
      />
      <CurriculumFormModal
        open={modal?.kind === 'curriculum'}
        initial={modal?.item}
        onClose={closeModal}
        onSave={async (values) => {
          if (modal.item) await trainingService.updateCurriculum(modal.item.id, values);
          else await trainingService.createCurriculum(modal.specialtyId ?? specialty.id, values);
          message.success(modal.item ? 'Curriculum updated' : 'Curriculum created');
          closeModal();
        }}
      />
      <ClassFormModal
        open={modal?.kind === 'class'}
        initial={modal?.item}
        curriculumType={classModalCurriculum?.type}
        siblingClasses={classModalSiblings}
        onClose={closeModal}
        onSave={async (values) => {
          let newId;
          if (modal.item) await trainingService.updateClass(modal.item.id, values);
          else newId = await trainingService.createClass(classModalCurriculumId, values);
          message.success(modal.item ? 'Class updated' : 'Class created');
          closeModal();
          return newId;
        }}
      />
      <ConfirmModal
        open={Boolean(confirm)}
        title={`Delete ${confirm?.kind || ''}?`}
        message={confirm ? `"${confirm.item.name || confirm.item.title}" will be removed. ${confirmText[confirm.kind]}` : ''}
        onConfirm={confirmDelete}
        onClose={closeConfirm}
      />
    </div>
  );
}
