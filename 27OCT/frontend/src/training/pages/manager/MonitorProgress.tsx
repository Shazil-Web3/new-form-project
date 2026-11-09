import React from 'react';
import { Avatar, DaysChip, EmptyState, PageHeader, ProgressBar, StatusChip, TypeBadge } from '../../components/common';
import { useTrainingContext } from '../../context';
import { daysLeftLabel, daysUntil, formatDate } from '../../dates';
import { assignmentStatus, assignmentsOf, attemptsOf, classesOf, curriculumProgress, progressOfClass, teamOf } from '../../selectors';
import { useTrainingState } from '../../store';
import { ui } from '../../theme';

const CLASS_STATUS = {
  completed: { icon: 'check_circle', tone: 'text-emerald-500', label: 'Completed' },
  in_progress: { icon: 'timelapse', tone: 'text-amber-500', label: 'In progress' },
  not_started: { icon: 'radio_button_unchecked', tone: 'text-slate-300', label: 'Not started' },
};

export default function MonitorProgress() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const members = teamOf(state, persona.id)
    .map((member) => ({ member, assignments: assignmentsOf(state, member.id) }))
    .filter((group) => group.assignments.length > 0);

  return (
    <div className={ui.page}>
      <PageHeader title="Monitor Progress" subtitle="Track your team's training completion and due dates." />

      <div className="mt-8 space-y-5">
        {members.map(({ member, assignments }) => (
          <div key={member.id} className={`${ui.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <Avatar name={member.name} />
              <div>
                <div className="font-semibold text-slate-900">{member.name}</div>
                <div className="text-xs text-slate-400">{member.email}</div>
              </div>
            </div>
            {assignments.map((assignment) => {
              const curriculum = state.curriculums.find((entry) => entry.id === assignment.curriculum_id);
              const progress = curriculumProgress(state, member.id, assignment.curriculum_id);
              const classes = classesOf(state, assignment.curriculum_id);
              return (
                <div key={assignment.id} className="border-b border-slate-100 px-6 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{curriculum?.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <TypeBadge type={assignment.assignment_type} />
                        <span>Due {formatDate(assignment.due_date)}</span>
                      </div>
                    </div>
                    <StatusChip status={assignmentStatus(state, assignment)} />
                    <DaysChip days={daysUntil(assignment.due_date)} label={daysLeftLabel(assignment.due_date)} />
                  </div>
                  <div className="mt-3">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                      <span>
                        {progress.completed} of {progress.total} classes completed
                      </span>
                      <span>{progress.percent}%</span>
                    </div>
                    <ProgressBar percent={progress.percent} />
                  </div>
                  {classes.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {classes.map((entry) => {
                        const record = progressOfClass(state, member.id, entry.id);
                        const status = CLASS_STATUS[record?.status || 'not_started'];
                        const attempts = attemptsOf(state, member.id, entry.id).length;
                        return (
                          <li key={entry.id} className="flex items-center gap-2 text-sm text-slate-600">
                            <span className={`material-symbols-outlined text-[18px] ${status.tone}`} title={status.label}>
                              {status.icon}
                            </span>
                            <span className="flex-1 truncate">{entry.title}</span>
                            {entry.has_quiz ? (
                              <span className="text-xs text-slate-400">
                                {attempts > 0 ? `Quiz ${record?.quiz_score ?? 0}% · ${attempts} attempt${attempts === 1 ? '' : 's'}` : 'Quiz not taken'}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        {members.length === 0 ? <EmptyState icon="bar_chart" message="No training assignments to monitor yet." actionLabel="Assign training" actionTo="/training/assign" /> : null}
      </div>
    </div>
  );
}
