import React from 'react';
import { EmptyState, PageHeader } from '../../components/common';
import { useTrainingContext } from '../../context';
import { assignmentsOf } from '../../selectors';
import { useTrainingState } from '../../store';
import { ui } from '../../theme';
import AssignmentCard from './AssignmentCard';

function Section({ icon, title, count, empty, children }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="material-symbols-outlined text-[22px] text-slate-400">{icon}</span>
        {title}
        <span className="text-sm font-normal text-slate-400">({count})</span>
      </h2>
      {count === 0 ? <EmptyState message={empty} icon="inbox" /> : <div className="space-y-4">{children}</div>}
    </section>
  );
}

export default function MyTraining() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const assignments = assignmentsOf(state, persona.id);
  const required = assignments.filter((entry) => entry.assignment_type === 'required');
  const electives = assignments.filter((entry) => entry.assignment_type === 'elective');

  return (
    <div className={ui.narrow}>
      <PageHeader title="My Training" subtitle="Complete your assigned training before the due date." />
      <Section icon="schedule" title="Required Training" count={required.length} empty="No required training yet.">
        {required.map((assignment) => (
          <AssignmentCard key={assignment.id} state={state} assignment={assignment} />
        ))}
      </Section>
      <Section icon="menu_book" title="Electives" count={electives.length} empty="No electives yet.">
        {electives.map((assignment) => (
          <AssignmentCard key={assignment.id} state={state} assignment={assignment} />
        ))}
      </Section>
    </div>
  );
}
