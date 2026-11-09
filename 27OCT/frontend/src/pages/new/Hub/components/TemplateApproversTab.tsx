/**
 * @file TemplateApproversTab.jsx
 * @description Department-based approvers configuration tab for CreateTemplateHub.
 *   1:1 field mapping from old ApproversManager.js — Department, Mandatory, Stage columns.
 *   Redesigned in Tailwind CSS with M3 design theme.
 * @dependencies react, prop-types, SearchableSelect
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import SearchableSelect from '../../../../components/new/tailwind/SearchableSelect';

/**
 * TemplateApproversTab
 *
 * Manages a list of department approvers for the template.
 * Each approver row has: Department (dropdown), Mandatory (checkbox), Stage (number select), Remove (button).
 *
 * @param {Array}    approvers                   - List of approver rows { key, department, mandatory, stage }
 * @param {Array}    departments                 - Available department options
 * @param {Function} onAddApprover               - Add a new blank approver row
 * @param {Function} onRemoveApprover            - Remove an approver row by key
 * @param {Function} onApproverChange            - Update a field on an approver row (key, field, value)
 * @param {Function} onApproverDepartmentChange  - Update the department on an approver row (key, deptName)
 */
export default function TemplateApproversTab({
  approvers = [],
  departments = [],
  onAddApprover,
  onRemoveApprover,
  onApproverChange,
  onApproverDepartmentChange,
  disabled = false,
}) {
  // Build stage options: all existing stages + up to maxStage+1
  const getStageOptions = () => {
    const existingStages = [...new Set(approvers.map(a => a.stage))].sort((a, b) => a - b);
    const maxStage = Math.max(...existingStages, 0);
    const options = [];
    for (let i = 1; i <= maxStage + 1; i++) {
      options.push({ value: String(i), label: `Stage ${i}` });
    }
    return options.length > 0 ? options : [{ value: '1', label: 'Stage 1' }];
  };

  return (
    <div className="space-y-4 animate-fade-in select-none">
      {/* Section header */}
      <div className="border-b border-outline-variant/60 pb-3 mb-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-label-md font-bold text-on-surface">Template Approvers Configuration</h3>
          <span
            className="material-symbols-outlined text-[16px] text-on-surface-variant/60 cursor-help"
            title="Define which departments must approve documents created from this template, whether their approval is mandatory, and at which stage they should review the document."
          >
            info
          </span>
        </div>
        <p className="text-body-xs text-on-surface-variant font-medium">
          Add departments that must review and approve documents created from this template.
        </p>
      </div>

      {/* Add Approver button */}
      {!disabled && (
        <div>
          <button
            type="button"
            onClick={onAddApprover}
            disabled={departments.length <= approvers.length}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold h-9 px-4 rounded-xl text-xs transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Approver</span>
          </button>
        </div>
      )}

      {/* Approvers table */}
      {approvers.length > 0 ? (
        <div className="rounded-xl border border-outline-variant/40 overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_130px_44px] bg-surface-container-low border-b border-outline-variant/40 px-4 py-2.5">
            <span className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</span>
            <span className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Mandatory</span>
            <span className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Stage</span>
            <span className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Del</span>
          </div>

          {/* Approver rows */}
          {approvers.map((approver) => {
            // Departments not already selected by other rows
            const selectedDepts = approvers
              .filter(a => a.key !== approver.key)
              .map(a => a.department);
            const availableDepts = departments.filter(d => !selectedDepts.includes(d.name || d.department_name));
            // Re-add current row's dept if missing
            const currentDeptName = approver.department;
            const deptIsInList = availableDepts.some(d => (d.name || d.department_name) === currentDeptName);
            const deptOptions = [
              ...availableDepts,
              ...(currentDeptName && !deptIsInList
                ? departments.filter(d => (d.name || d.department_name) === currentDeptName)
                : []),
            ].map(d => ({
              value: d.name || d.department_name || '',
              label: d.name || d.department_name || '',
            }));

            return (
              <div
                key={approver.key}
                className="grid grid-cols-[1fr_120px_130px_44px] items-center px-4 py-3 border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-high/20 transition-colors"
              >
                {/* Department dropdown */}
                <div className="pr-3">
                  <SearchableSelect
                    value={approver.department || ''}
                    onChange={(val) => !disabled && onApproverDepartmentChange(approver.key, val)}
                    options={deptOptions}
                    placeholder="Select department..."
                    disabled={disabled}
                  />
                </div>

                {/* Mandatory checkbox */}
                <div className="flex justify-center">
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    title="When checked, the document cannot proceed to the next stage without this department's approval"
                  >
                    <input
                      type="checkbox"
                      checked={!!approver.mandatory}
                      onChange={(e) => !disabled && onApproverChange(approver.key, 'mandatory', e.target.checked)}
                      disabled={disabled}
                      className="w-4 h-4 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Stage select */}
                <div className="flex justify-center">
                  <SearchableSelect
                    value={String(approver.stage || 1)}
                    onChange={(val) => !disabled && onApproverChange(approver.key, 'stage', Number(val))}
                    options={getStageOptions()}
                    placeholder="Stage..."
                    disabled={disabled}
                  />
                </div>

                {/* Remove button */}
                <div className="flex justify-center">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onRemoveApprover(approver.key)}
                      className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                      title="Remove approver"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">group_add</span>
          <p className="text-body-sm text-on-surface-variant/60 font-medium">No approvers added yet.</p>
          <p className="text-body-xs text-on-surface-variant/40">Click "Add Approver" to define which departments must review documents from this template.</p>
        </div>
      )}

      {/* Info note */}
      {approvers.length > 0 && (
        <p className="text-body-xs text-on-surface-variant/60 leading-relaxed pt-1">
          <strong>Note:</strong> The <em>Mandatory</em> field determines if approval from this department is required.
          The <em>Stage</em> field determines the order in which departments will review the document.
        </p>
      )}
    </div>
  );
}

TemplateApproversTab.propTypes = {
  approvers: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    department: PropTypes.string,
    mandatory: PropTypes.bool,
    stage: PropTypes.number,
  })),
  departments: PropTypes.array,
  onAddApprover: PropTypes.func.isRequired,
  onRemoveApprover: PropTypes.func.isRequired,
  onApproverChange: PropTypes.func.isRequired,
  onApproverDepartmentChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
