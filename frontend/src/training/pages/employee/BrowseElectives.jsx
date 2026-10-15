import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import { EmptyState, PageHeader } from '../../components/common';
import Modal from '../../components/Modal';
import { useTrainingContext } from '../../context';
import { addDays, formatDate, todayStr } from '../../dates';
import { assignmentsOf, classesOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { CONTENT_TYPES, TONES, ui } from '../../theme';

export default function BrowseElectives() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const [target, setTarget] = useState(null);
  const defaultDate = addDays(todayStr(), 14);
  const [dueDate, setDueDate] = useState(defaultDate);

  const electives = state.curriculums.filter((entry) => entry.type === 'elective');
  const enrolledIds = assignmentsOf(state, persona.id).map((entry) => entry.curriculum_id);

  const open = (curriculum) => {
    setDueDate(defaultDate);
    setTarget(curriculum);
  };

  const enroll = (event) => {
    event.preventDefault();
    trainingService.enroll({ employeeId: persona.id, curriculumId: target.id, dueDate });
    message.success(`Enrolled in ${target.name}`);
    setTarget(null);
  };

  return (
    <div className={ui.narrow}>
      <PageHeader title="Browse Electives" subtitle="Enroll in elective curriculums to expand your skills. Due dates can be extended up to 3 times." />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {electives.map((curriculum) => {
          const classes = classesOf(state, curriculum.id);
          const enrolled = enrolledIds.includes(curriculum.id);
          return (
            <div key={curriculum.id} className={`${ui.card} flex flex-col p-6`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES.violet}`}>
                <span className="material-symbols-outlined text-[22px]">menu_book</span>
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{curriculum.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{curriculum.description || 'No description'}</p>
              <p className="mt-3 text-xs text-slate-400">
                {classes.length} class{classes.length === 1 ? '' : 'es'}
              </p>
              <ul className="mt-2 flex-1 space-y-1">
                {classes.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">{CONTENT_TYPES[entry.content_type]?.icon}</span>
                    {entry.title}
                    {entry.has_quiz ? <span className="material-symbols-outlined text-[14px] text-violet-600">checklist</span> : null}
                  </li>
                ))}
              </ul>
              {enrolled ? (
                <Link to="/training/my-training" className={`${ui.btnLight} mt-5 w-full`}>
                  <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
                  Enrolled — Go to training
                </Link>
              ) : (
                <button type="button" className={`${ui.btnDark} mt-5 w-full`} onClick={() => open(curriculum)}>
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Enroll
                </button>
              )}
            </div>
          );
        })}
      </div>
      {electives.length === 0 ? <div className="mt-8"><EmptyState icon="explore" message="No electives are available yet." /></div> : null}

      <Modal open={Boolean(target)} title={`Enroll in ${target?.name || ''}`} onClose={() => setTarget(null)}>
        <form onSubmit={enroll}>
          <p className="text-sm text-slate-500">Set your target completion date. You can extend it up to 3 times.</p>
          <input type="date" min={todayStr()} required value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${ui.input} mt-4`} aria-label="Target completion date" />
          <p className="mt-2 text-xs text-slate-400">Default: {formatDate(defaultDate)}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setTarget(null)} className={ui.btnLight}>
              Cancel
            </button>
            <button type="submit" disabled={!dueDate} className={ui.btnDark}>
              Enroll
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
