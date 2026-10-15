import React from 'react';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import { ContentIcon, DaysChip, ProgressBar } from '../../components/common';
import { daysLeftLabel, daysUntil, formatDate } from '../../dates';
import { classesOf, curriculumProgress, progressOfClass, quizOf } from '../../selectors';
import { MAX_EXTENSIONS, trainingService } from '../../store';
import { CONTENT_TYPES, ui } from '../../theme';

export default function AssignmentCard({ state, assignment }) {
  const curriculum = state.curriculums.find((entry) => entry.id === assignment.curriculum_id);
  const progress = curriculumProgress(state, assignment.employee_id, assignment.curriculum_id);
  const classes = classesOf(state, assignment.curriculum_id);
  const left = MAX_EXTENSIONS - assignment.extensions_used;
  const days = daysUntil(assignment.due_date);

  return (
    <div className={`${ui.card} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-slate-900">{curriculum?.name || 'Removed curriculum'}</div>
          <div className="mt-0.5 text-sm text-slate-400">Due {formatDate(assignment.due_date)}</div>
        </div>
        <DaysChip days={days} label={daysLeftLabel(assignment.due_date)} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-slate-400">
          <span>
            {progress.completed} of {progress.total} completed
          </span>
          <span>{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} />
      </div>

      <div className="mt-4 space-y-2">
        {classes.map((entry) => {
          const record = progressOfClass(state, assignment.employee_id, entry.id);
          const done = record?.status === 'completed';
          const quiz = entry.has_quiz && quizOf(state, entry.id);
          const prerequisite = entry.prerequisite_class_id ? classes.find((item) => item.id === entry.prerequisite_class_id) : null;
          const locked = prerequisite && progressOfClass(state, assignment.employee_id, prerequisite.id)?.status !== 'completed';
          return (
            <div key={entry.id} className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 ${locked ? 'opacity-60' : ''}`}>
              <ContentIcon type={entry.content_type} size="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{entry.title}</div>
                <div className="text-xs text-slate-400">
                  {locked ? `Locked · complete "${prerequisite.title}" first` : (
                    <>
                      {CONTENT_TYPES[entry.content_type]?.short}
                      {quiz ? ' · Quiz' : ''}
                      {entry.duration_minutes > 0 ? ` · ${entry.duration_minutes} min` : ''}
                    </>
                  )}
                </div>
              </div>
              {done ? (
                <span className="material-symbols-outlined text-[22px] text-emerald-500" title="Completed">
                  check_circle
                </span>
              ) : null}
              {locked ? (
                <span className="flex h-9 w-9 items-center justify-center text-slate-400" aria-label={`${entry.title} is locked`}>
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </span>
              ) : (
                <Link
                  to={`/training/class/${entry.id}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-violet-700 transition hover:bg-violet-100"
                  aria-label={`Open ${entry.title}`}
                >
                  <span className="material-symbols-outlined text-[26px]">play_circle</span>
                </Link>
              )}
            </div>
          );
        })}
        {classes.length === 0 ? <div className="text-sm text-slate-400">No classes have been added to this curriculum yet.</div> : null}
      </div>

      <button
        type="button"
        disabled={left <= 0}
        onClick={() => {
          trainingService.extendDueDate(assignment.id);
          message.success('Due date extended by 7 days', 1.5);
        }}
        className={`${ui.link} mt-4 disabled:cursor-not-allowed disabled:text-slate-300`}
      >
        <span className="material-symbols-outlined text-[18px]">autorenew</span>
        {left > 0 ? `Extend due date (${left} left)` : 'No extensions left'}
      </button>
    </div>
  );
}
