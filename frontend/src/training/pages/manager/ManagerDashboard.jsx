import React from 'react';
import { Avatar, DaysChip, EmptyState, PageHeader, ProgressBar, StatCard, StatusChip } from '../../components/common';
import { useTrainingContext } from '../../context';
import { daysLeftLabel, daysUntil } from '../../dates';
import { assignmentStatus, curriculumProgress, statusCounts, teamOf } from '../../selectors';
import { useTrainingState } from '../../store';
import { ui } from '../../theme';

export default function ManagerDashboard() {
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  const team = teamOf(state, persona.id);
  const teamIds = team.map((member) => member.id);
  const assignments = state.assignments.filter((entry) => teamIds.includes(entry.employee_id));
  const counts = statusCounts(state, assignments);
  const active = assignments.length - counts.completed;

  return (
    <div className={ui.page}>
      <PageHeader title={`Welcome back, ${persona.name}`} subtitle="Assign and monitor training for your team." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="groups" tone="violet" value={team.length} label="Team Members" />
        <StatCard icon="schedule" tone="amber" value={active} label="Active Assignments" />
        <StatCard icon="warning" tone="rose" value={counts.overdue} label="Overdue" />
        <StatCard icon="check_circle" tone="emerald" value={counts.completed} label="Completed" />
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">Team training activity</h2>
      {assignments.length === 0 ? (
        <EmptyState icon="assignment" message="No training assigned yet." actionLabel="Assign training" actionTo="/training/assign" />
      ) : (
        <div className={`${ui.card} divide-y divide-slate-100`}>
          {assignments.map((assignment) => {
            const member = team.find((entry) => entry.id === assignment.employee_id);
            const curriculum = state.curriculums.find((entry) => entry.id === assignment.curriculum_id);
            const progress = curriculumProgress(state, assignment.employee_id, assignment.curriculum_id);
            return (
              <div key={assignment.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar name={member?.name} size="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{member?.name}</div>
                  <div className="text-xs text-slate-400">{curriculum?.name}</div>
                </div>
                <div className="w-40">
                  <ProgressBar percent={progress.percent} />
                  <div className="mt-1 text-right text-xs text-slate-400">{progress.percent}%</div>
                </div>
                <StatusChip status={assignmentStatus(state, assignment)} />
                <DaysChip days={daysUntil(assignment.due_date)} label={daysLeftLabel(assignment.due_date)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
