import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { Avatar, EmptyState, PageHeader } from '../../components/common';
import { useTrainingContext } from '../../context';
import { addDays, todayStr } from '../../dates';
import { teamOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { ui } from '../../theme';

export default function AssignTraining() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const navigate = useNavigate();
  const team = teamOf(state, persona.id);

  const [selected, setSelected] = useState([]);
  const [curriculumId, setCurriculumId] = useState('');
  const [dueDate, setDueDate] = useState(addDays(todayStr(), 14));

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  const allSelected = team.length > 0 && selected.length === team.length;
  const ready = selected.length > 0 && curriculumId && dueDate;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    const created = await trainingService.assignTraining({ employeeIds: selected, curriculumId, dueDate, assignedById: persona.id });
    const skipped = selected.length - created;
    if (created === 0) {
      message.info('Everyone selected already has this curriculum.');
      return;
    }
    message.success(`Training assigned to ${created} team member${created === 1 ? '' : 's'}${skipped ? ` (${skipped} already had it)` : ''}`);
    navigate('/training/monitor');
  };

  return (
    <div className={ui.narrow}>
      <PageHeader title="Assign Training" subtitle="Select team members and a curriculum. Required training defaults to a 2-week deadline." />

      {team.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="groups" message="You don't have any team members yet. Ask an admin to assign students to you as their manager." />
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-6">
          <section className={`${ui.card} p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Team members</h2>
              <button type="button" className={ui.link} onClick={() => setSelected(allSelected ? [] : team.map((member) => member.id))}>
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {team.map((member) => (
                <label
                  key={member.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    selected.includes(member.id) ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id)} className="rounded border-slate-300 text-violet-700 focus:ring-violet-600" />
                  <Avatar name={member.name} size="h-8 w-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{member.name}</span>
                    <span className="block truncate text-xs text-slate-400">{member.email}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={`${ui.card} grid gap-4 p-5 sm:grid-cols-2`}>
            <div>
              <label htmlFor="assign-curriculum" className={ui.label}>
                Curriculum
              </label>
              <select id="assign-curriculum" className={ui.input} value={curriculumId} onChange={(event) => setCurriculumId(event.target.value)}>
                <option value="">Select a curriculum…</option>
                {state.fieldSpecialties.map((specialty) => {
                  const options = state.curriculums.filter((entry) => entry.field_specialty_id === specialty.id);
                  if (options.length === 0) return null;
                  return (
                    <optgroup key={specialty.id} label={specialty.name}>
                      {options.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.type === 'required' ? 'Required' : 'Elective'})
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label htmlFor="assign-due" className={ui.label}>
                Due date
              </label>
              <input id="assign-due" type="date" min={todayStr()} className={ui.input} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </section>

          <div className="sticky bottom-0 -mx-2 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 px-2 py-4 backdrop-blur">
            <span className="text-sm text-slate-500">
              {!selected.length ? 'Pick at least one team member.' : !curriculumId ? 'Now choose a curriculum.' : 'Ready to assign.'}
            </span>
            <button type="submit" disabled={!ready} className={ui.btnDark}>
              <span className="material-symbols-outlined text-[20px]">assignment_add</span>
              Assign training{selected.length ? ` (${selected.length})` : ''}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
