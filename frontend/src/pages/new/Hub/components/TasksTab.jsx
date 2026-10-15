import React from 'react';
import PropTypes from 'prop-types';
import SearchableSelect from '../../../../components/new/tailwind/SearchableSelect';

/**
 * TasksTab - Redesigned Document Task Manager
 * 
 * Renders a list of tasks with custom field inputs:
 * - Task Title, description textarea, assignee select, due date datepicker.
 * - Add/Remove dynamic tasks.
 */
export default function TasksTab({
  tasks = [],
  onTasksChange,
  orgMembers = [],
  disabled = false,
}) {
  const handleTaskChange = (index, key, val) => {
    if (disabled) return;
    const updated = [...tasks];
    updated[index] = { ...updated[index], [key]: val };
    onTasksChange(updated);
  };

  const handleAddTask = () => {
    if (disabled) return;
    onTasksChange([...tasks, { title: '', description: '', assignedTo: '', dueDate: '' }]);
  };

  const handleRemoveTask = (index) => {
    if (disabled) return;
    onTasksChange(tasks.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-6 select-none animate-fade-in">
      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
        <h3 className="text-label-md font-bold text-on-surface">Manage Action Items / Tasks</h3>
        {!disabled && (
          <button
            type="button"
            onClick={handleAddTask}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Action Item</span>
          </button>
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-5 relative space-y-4 shadow-sm animate-scale-up"
            >
              {/* Remove Button top-right */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTask(index)}
                  className="absolute top-4 right-4 text-on-surface-variant hover:text-red-700 p-1.5 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center"
                  title="Delete Task"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}

              {/* Task Title */}
              <div className="flex flex-col gap-1.5 pr-8">
                <label className="text-label-sm font-semibold text-on-surface-variant">
                  Task Title
                </label>
                <input
                  type="text"
                  disabled={disabled}
                  value={task.title || ''}
                  onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>

              {/* Task Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">
                  Description
                </label>
                <textarea
                  disabled={disabled}
                  value={task.description || ''}
                  onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                  placeholder="Provide task expectations and constraints details..."
                  className="w-full min-h-[80px] p-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Task Assignee */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm font-semibold text-on-surface-variant">
                    Assign To
                  </label>
                  <SearchableSelect
                    value={String(task.assignedTo || '')}
                    onChange={(val) => handleTaskChange(index, 'assignedTo', val)}
                    options={orgMembers.map((m) => {
                      const fullName = m.name || `${m.first_name || m.firstName || ''} ${m.last_name || m.lastName || ''}`.trim() || m.username || 'Unknown';
                      return {
                        value: String(m.id || m.userId),
                        label: `${fullName} (${m.email})`,
                      };
                    })}
                    placeholder="Select assignee..."
                    disabled={disabled}
                  />
                </div>

                {/* Task Due Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-sm font-semibold text-on-surface-variant">
                    Due Date
                  </label>
                  <input
                    type="date"
                    disabled={disabled}
                    value={task.dueDate || ''}
                    onChange={(e) => handleTaskChange(index, 'dueDate', e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => !disabled && handleAddTask()}
          className={`border-2 border-dashed border-outline-variant bg-surface-container-low rounded-2xl flex flex-col items-center justify-center p-10 group ${
            disabled ? 'cursor-default' : 'cursor-pointer hover:border-blue-700/50 hover:bg-surface-container-high/40'
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 group-hover:text-blue-700/60 mb-2 transition-colors">
            add_task
          </span>
          <span className="text-body-md font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">
            {disabled ? 'No action items defined.' : 'No action items defined. Click here to add one.'}
          </span>
        </div>
      )}
    </div>
  );
}

TasksTab.propTypes = {
  tasks: PropTypes.array.isRequired,
  onTasksChange: PropTypes.func.isRequired,
  orgMembers: PropTypes.array,
  disabled: PropTypes.bool,
};
