/**
 * @file TasksTab.jsx
 * @description Read-only task list displayed in Draft/In-Progress document previews.
 *   Mirrors the TasksTab wizard fields: title, description, assignedTo, dueDate.
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

function fmt(dateStr) {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function TaskCard({ task, index }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-700/10 text-blue-700 text-xs font-extrabold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-bold text-on-surface truncate">{task.title || 'Untitled Task'}</span>
        </div>
        {task.dueDate && (
          <span className="text-xs font-semibold text-on-surface-variant/70 shrink-0 bg-surface-container border border-outline-variant/30 px-2 py-0.5 rounded-full">
            {fmt(task.dueDate)}
          </span>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-on-surface-variant leading-relaxed pl-8.5">{task.description}</p>
      )}
      {task.assignedTo && (
        <div className="flex items-center gap-1.5 pl-8.5">
          <span className="material-symbols-outlined text-[13px] text-on-surface-variant/50">person</span>
          <span className="text-xs text-on-surface-variant font-medium">{task.assignedTo}</span>
        </div>
      )}
    </div>
  );
}

export default function TasksTab({ item }) {
  const tasks = Array.isArray(item.tasks) ? item.tasks : [];

  if (tasks.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-12 select-none text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">task_alt</span>
        <span className="text-sm font-medium text-on-surface-variant/50">No action items have been defined.</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider mb-3">
        Action Items ({tasks.length})
      </p>
      {tasks.map((task, i) => <TaskCard key={i} task={task} index={i} />)}
    </div>
  );
}

TasksTab.propTypes = {
  item: PropTypes.object.isRequired,
};
