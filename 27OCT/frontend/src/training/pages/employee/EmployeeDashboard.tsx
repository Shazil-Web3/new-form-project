import React from 'react';
import { Link } from 'react-router-dom';
import { DaysChip, EmptyState, PageHeader, ProgressBar, StatCard } from '../../components/common';
import { useTrainingContext } from '../../context';
import { daysLeftLabel, daysUntil, formatDate } from '../../dates';
import { assignmentStatus, assignmentsOf, curriculumProgress, statusCounts } from '../../selectors';
import { useTrainingState } from '../../store';
import { ui } from '../../theme';

export default function EmployeeDashboard() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const assignments = assignmentsOf(state, persona.id);
  const counts = statusCounts(state, assignments);
  const current = assignments
    .filter((entry) => assignmentStatus(state, entry) !== 'completed')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  return (
    <div className={ui.page}>
      <PageHeader title={`Welcome back, ${persona.name}`} subtitle="Track your assigned training and explore electives." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="assignment" tone="violet" value={counts.assigned} label="Assigned" />
        <StatCard icon="schedule" tone="amber" value={counts.in_progress} label="In Progress" />
        <StatCard icon="warning" tone="rose" value={counts.overdue} label="Overdue" />
        <StatCard icon="check_circle" tone="emerald" value={counts.completed} label="Completed" />
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Your current training</h2>
        <Link to="/training/my-training" className={ui.link}>
          View all
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </div>

      {current.length === 0 ? (
        <EmptyState icon="check_circle" tone="text-emerald-500" message="You're all caught up — no pending training." />
      ) : (
        <div className="space-y-3">
          {current.map((assignment) => {
            const curriculum = state.curriculums.find((entry) => entry.id === assignment.curriculum_id);
            const progress = curriculumProgress(state, persona.id, assignment.curriculum_id);
            return (
              <Link key={assignment.id} to="/training/my-training" className={`${ui.card} flex flex-wrap items-center gap-4 p-4 transition hover:border-violet-300`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{curriculum?.name}</div>
                  <div className="text-xs text-slate-400">Due {formatDate(assignment.due_date)}</div>
                </div>
                <div className="w-40">
                  <ProgressBar percent={progress.percent} />
                  <div className="mt-1 text-right text-xs text-slate-400">{progress.percent}%</div>
                </div>
                <DaysChip days={daysUntil(assignment.due_date)} label={daysLeftLabel(assignment.due_date)} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
