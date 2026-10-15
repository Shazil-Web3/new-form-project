import React from 'react';
import PropTypes from 'prop-types';

/**
 * BasicInfoStep - Step 1 of Document Wizard
 * 
 * Captures title, template reference, department, and target due date.
 * Styled using Tailwind CSS variables.
 */
export default function BasicInfoStep({
  values,
  onChange,
  templates = [],
  departments = [],
}) {
  return (
    <div className="space-y-5 animate-fade-in select-none">
      {/* Title Field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Document Title
        </label>
        <input
          type="text"
          value={values.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="Enter a descriptive document name..."
          className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm"
          required
        />
      </div>

      {/* Template Select Dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Base Template Layout
        </label>
        <select
          value={values.template_id || ''}
          onChange={(e) => onChange('template_id', e.target.value)}
          className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer"
          required
        >
          <option value="" disabled>Select a standard template to clone from...</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name || tpl.title} (v{tpl.version || '1.0'})
            </option>
          ))}
        </select>
      </div>

      {/* Department Dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Assigned Department
        </label>
        <select
          value={values.department_id || ''}
          onChange={(e) => onChange('department_id', e.target.value)}
          className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer"
          required
        >
          <option value="" disabled>Select target department...</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {/* Due Date Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Completion Target Date (Due Date)
        </label>
        <input
          type="date"
          value={values.due_date || ''}
          onChange={(e) => onChange('due_date', e.target.value)}
          className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer"
          required
        />
      </div>
    </div>
  );
}

BasicInfoStep.propTypes = {
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  templates: PropTypes.array,
  departments: PropTypes.array,
};
