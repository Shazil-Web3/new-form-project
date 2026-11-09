import React from 'react';
import { message } from 'antd';
import { Avatar, DaysChip, EmptyState, PageHeader, ProgressBar, TypeBadge } from '../../components/common';
import { daysLeftLabel, daysUntil, formatDate } from '../../dates';
import { assignmentsOf, curriculumProgress } from '../../selectors';
import { MAX_EXTENSIONS, trainingService, useTrainingState } from '../../store';
import { ui } from '../../theme';

export default function AdminAssignments() {
  const state = useTrainingState();
  const groups = state.users
    .map((user) => ({ user, assignments: assignmentsOf(state, user.id) }))
    .filter((group) => group.assignments.length > 0);

  return (
    <div className={ui.page}>
      <PageHeader title="Assignments" subtitle="View all training assignments across the organization and extend due dates as needed." />

      <div className="mt-8 space-y-5">
        {groups.map(({ user, assignments }) => (
          <div key={user.id} className={`${ui.card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <Avatar name={user.name} />
              <div>
                <div className="font-semibold text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
            </div>
            {assignments.map((assignment) => {
              const curriculum = state.curriculums.find((entry) => entry.id === assignment.curriculum_id);
              const progress = curriculumProgress(state, assignment.employee_id, assignment.curriculum_id);
              const left = MAX_EXTENSIONS - assignment.extensions_used;
              return (
                <div key={assignment.id} className="border-b border-slate-100 px-6 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">{curriculum?.name || 'Removed curriculum'}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <TypeBadge type={assignment.assignment_type} />
                        <span>Due {formatDate(assignment.due_date)}</span>
                      </div>
                    </div>
                    <DaysChip days={daysUntil(assignment.due_date)} label={daysLeftLabel(assignment.due_date)} />
                  </div>
                  {progress.total > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                        <span>
                          {progress.completed} of {progress.total} completed
                        </span>
                        <span>{progress.percent}%</span>
                      </div>
                      <ProgressBar percent={progress.percent} />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={left <= 0}
                    onClick={() => {
                      trainingService.extendDueDate(assignment.id);
                      message.success('Due date extended by 7 days', 1.5);
                    }}
                    className={`${ui.link} mt-3 disabled:cursor-not-allowed disabled:text-slate-300`}
                  >
                    <span className="material-symbols-outlined text-[18px]">autorenew</span>
                    {left > 0 ? `Extend due date (${left} left)` : 'No extensions left'}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
        {groups.length === 0 ? <EmptyState icon="event_available" message="No training has been assigned yet." /> : null}
      </div>
    </div>
  );
}
