import React from 'react';
import PropTypes from 'prop-types';

/**
 * ImpactTab - Redesigned Document Impact Assessment Form
 * 
 * Includes checklist of departments, effort selection, and training toggles.
 */
export default function ImpactTab({
  impactData = {},
  setImpactData,
  departments = [],
  disabled = false,
}) {
  const handleFieldChange = (key, val) => {
    if (disabled) return;
    setImpactData((prev) => ({ ...prev, [key]: val }));
  };

  const handleDeptToggle = (deptName) => {
    if (disabled) return;
    const active = impactData.departmentImpacts || [];
    if (active.includes(deptName)) {
      handleFieldChange('departmentImpacts', active.filter(d => d !== deptName));
    } else {
      handleFieldChange('departmentImpacts', [...active, deptName]);
    }
  };

  return (
    <div className="space-y-6 select-none animate-fade-in">
      {/* Department Checklist */}
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 space-y-3.5 shadow-sm">
        <label className="text-label-sm font-bold text-on-surface">
          Affected Departments Scope
        </label>
        <p className="text-body-xs text-on-surface-variant font-medium">
          Check all departments whose procedures or tools will change.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-1">
          {departments.map((dept) => {
            const isChecked = (impactData.departmentImpacts || []).includes(dept.name);
            return (
              <label
                key={dept.id}
                className={`flex items-center gap-2.5 font-medium text-body-sm text-on-surface ${
                  disabled ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={isChecked}
                  onChange={() => handleDeptToggle(dept.name)}
                  className="w-4.5 h-4.5 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span>{dept.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Affected Systems Input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Affected Systems / Infrastructure
        </label>
        <input
          type="text"
          disabled={disabled}
          value={impactData.affectedSystems || ''}
          onChange={(e) => handleFieldChange('affectedSystems', e.target.value)}
          placeholder="e.g. CRM, ERP Database, Active Directory..."
          className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex flex-wrap gap-5 items-end">
        {/* Implementation Effort Select */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-label-sm font-semibold text-on-surface-variant">
            Implementation Effort Estimate
          </label>
          <select
            disabled={disabled}
            value={impactData.implementationEffort || 'medium'}
            onChange={(e) => handleFieldChange('implementationEffort', e.target.value)}
            className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="low">Low Effort (Fast Rollout)</option>
            <option value="medium">Medium Effort (Moderate Scope)</option>
            <option value="high">High Effort (Complex Transition)</option>
          </select>
        </div>

        {/* Training Required Toggle — compact inline card */}
        <label className={`flex items-center gap-3 px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-sm select-none h-11 w-fit whitespace-nowrap ${
          disabled ? 'cursor-default' : 'cursor-pointer'
        }`}>
          <span className="text-body-sm font-bold text-on-surface">Training Required</span>
          <input
            type="checkbox"
            disabled={disabled}
            checked={!!impactData.trainingRequired}
            onChange={(e) => handleFieldChange('trainingRequired', e.target.checked)}
            className="w-5 h-5 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 cursor-pointer flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </label>
      </div>

      {/* Impact Assessment Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-label-sm font-semibold text-on-surface-variant">
          Impact Assessment Notes
        </label>
        <textarea
          disabled={disabled}
          value={impactData.impactNotes || ''}
          onChange={(e) => handleFieldChange('impactNotes', e.target.value)}
          placeholder="Describe implementation timelines, dependencies, risks..."
          className="w-full min-h-[100px] p-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface resize-y disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

ImpactTab.propTypes = {
  impactData: PropTypes.object.isRequired,
  setImpactData: PropTypes.func.isRequired,
  departments: PropTypes.array,
  disabled: PropTypes.bool,
};
