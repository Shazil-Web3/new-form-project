/**
 * @file DocumentImpactTab.jsx
 * @description Redesigned consolidated Impact Assessment Tab for documents.
 *   Shows and edits rollout impact forms (ImpactFormEditor) and metadata fields (departments checklist, systems, effort, training).
 *   Supports both interactive (draft) and read-only (monitoring/approval) modes.
 * @dependencies react, prop-types, ImpactFormEditor
 * @author Codegen
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ImpactFormEditor from '../../../../components/Home/components/Dashboard/Documents/ImpactFormEditor';

export default function DocumentImpactTab({
  impactData = {},
  setImpactData,
  departments = [],
  readOnly = false,
  documentId = null,
  currentUser = null,
}) {
  const [activeSubTab, setActiveSubTab] = useState(0);

  const subTemplates = impactData.impactTemplates || [];
  const hasTemplateForm = subTemplates.length > 0 || !!(impactData.impactTemplateContent || impactData.impactTemplateHtml);

  // --- Handlers for metadata fields ---
  const handleFieldChange = (key, val) => {
    if (readOnly) return;
    setImpactData((prev) => ({ ...prev, [key]: val }));
  };

  const handleDeptToggle = (deptName) => {
    if (readOnly) return;
    const active = impactData.departmentImpacts || [];
    if (active.includes(deptName)) {
      handleFieldChange('departmentImpacts', active.filter(d => d !== deptName));
    } else {
      handleFieldChange('departmentImpacts', [...active, deptName]);
    }
  };

  // --- Handlers for template form updates ---
  const handleTemplateFormChange = (index, nextFilled, nextDropdown) => {
    if (readOnly) return;
    if (subTemplates.length > 0) {
      const updated = [...subTemplates];
      updated[index] = {
        ...updated[index],
        filledValues: nextFilled,
        dropdownValues: nextDropdown,
      };
      handleFieldChange('impactTemplates', updated);
    } else {
      setImpactData((prev) => ({
        ...prev,
        impactFilledValues: nextFilled,
        impactDropdownValues: nextDropdown,
      }));
    }
  };

  // --- Handlers for impact comments updates ---
  const handleCommentsChange = (index, nextComments) => {
    if (subTemplates.length > 0) {
      const updated = [...subTemplates];
      updated[index] = {
        ...updated[index],
        comments: nextComments,
      };
      setImpactData((prev) => ({
        ...prev,
        impactTemplates: updated,
        comments: nextComments,
      }));
    } else {
      setImpactData((prev) => ({
        ...prev,
        comments: nextComments,
      }));
    }
  };

  // Circular gauge config
  const getEffortColorClass = (effort) => {
    switch (effort?.toLowerCase()) {
      case 'low': return 'text-emerald-500 stroke-emerald-500';
      case 'medium': return 'text-blue-500 stroke-blue-500';
      case 'high': return 'text-amber-500 stroke-amber-500';
      case 'critical': return 'text-red-500 stroke-red-500';
      default: return 'text-blue-500 stroke-blue-500';
    }
  };

  const getEffortBgClass = (effort) => {
    switch (effort?.toLowerCase()) {
      case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'high': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getEffortPercent = (effort) => {
    switch (effort?.toLowerCase()) {
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      case 'critical': return 100;
      default: return 50;
    }
  };

  const effortValue = impactData.implementationEffort || 'medium';
  const percent = getEffortPercent(effortValue);
  const effortClass = getEffortColorClass(effortValue);
  const strokeDash = `${(percent / 100) * 126} 126`;

  return (
    <div className="space-y-6 select-none animate-fade-in text-xs font-semibold">
      {/* 1. Template-based Assessment Forms (ImpactFormEditor) */}
      {hasTemplateForm && (
        <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider pb-2 border-b border-outline-variant/20">
            Rollout Assessment Documentation
          </h4>
          {subTemplates.length > 0 ? (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto border-b border-outline-variant/25 pb-2">
                {subTemplates.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSubTab(idx)}
                    className={`px-3.5 py-1.5 rounded-lg border font-bold transition-all text-[11px] ${
                      activeSubTab === idx
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-surface-container border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-inner">
                <ImpactFormEditor
                  templateHtml={subTemplates[activeSubTab].content}
                  filledValues={subTemplates[activeSubTab].filledValues || []}
                  dropdownValues={subTemplates[activeSubTab].dropdownValues || []}
                  onChange={(filled, dropdown) => handleTemplateFormChange(activeSubTab, filled, dropdown)}
                  readOnly={readOnly}
                  comments={subTemplates[activeSubTab].comments || impactData.comments || []}
                  onCommentsChange={(nextComments) => handleCommentsChange(activeSubTab, nextComments)}
                  documentId={documentId}
                  currentUser={currentUser}
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-inner">
              <ImpactFormEditor
                templateHtml={impactData.impactTemplateContent || impactData.impactTemplateHtml}
                filledValues={impactData.impactFilledValues || []}
                dropdownValues={impactData.impactDropdownValues || []}
                onChange={(filled, dropdown) => handleTemplateFormChange(0, filled, dropdown)}
                readOnly={readOnly}
                comments={impactData.comments || []}
                onCommentsChange={(nextComments) => handleCommentsChange(0, nextComments)}
                documentId={documentId}
                currentUser={currentUser}
              />
            </div>
          )}
        </div>
      )}

      {/* 2. Department & Systems Rollout Assessment Fields */}
      <div className="bg-surface border border-outline-variant/30 rounded-xl p-5 shadow-sm space-y-6">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/20 pb-3">
          Organizational Impact & Effort
        </h3>

        {/* Read-Only Mode Presentation */}
        {readOnly ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Impacted Departments */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4.5 space-y-3 shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">groups</span>
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wide">Impacted Departments</span>
              </div>
              {impactData.departmentImpacts && impactData.departmentImpacts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {impactData.departmentImpacts.map(dept => (
                    <span key={dept} className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 font-extrabold text-[10px]">
                      {dept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant/40 italic py-2">No departments specified</p>
              )}
            </div>

            {/* Affected Systems */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4.5 space-y-3 shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">devices</span>
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wide">Affected Systems</span>
              </div>
              {impactData.affectedSystems && impactData.affectedSystems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(impactData.affectedSystems) ? impactData.affectedSystems : String(impactData.affectedSystems).split(',')).map(system => (
                    <span key={system} className="px-2.5 py-1 rounded bg-cyan-50 text-cyan-700 border border-cyan-100 font-extrabold text-[10px]">
                      {system.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant/40 italic py-2">None specified</p>
              )}
            </div>

            {/* Implementation Effort */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4.5 space-y-3 shadow-sm flex flex-col items-center justify-center">
              <div className="w-full flex items-center gap-1.5 border-b border-outline-variant/20 pb-2 self-start">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">build</span>
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wide">Implementation Effort</span>
              </div>
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="20" className="stroke-outline-variant/20 fill-none" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="20"
                      className={`fill-none transition-all duration-500 ${effortClass}`}
                      strokeWidth="6"
                      strokeDasharray={strokeDash}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${getEffortBgClass(effortValue)}`}>
                      {effortValue}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-on-surface-variant/60 text-center font-bold">Estimated organizational rollout effort</p>
              </div>
            </div>

            {/* Training & Readiness */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4.5 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">school</span>
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wide">Training & Readiness</span>
              </div>
              <div className="space-y-3 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="text-on-surface-variant">Training Required:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    impactData.trainingRequired ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {impactData.trainingRequired ? 'REQUIRED' : 'NOT REQUIRED'}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block mb-1">Implementation Notes:</span>
                  <div className="p-3 bg-surface-container border border-outline-variant/15 rounded-lg text-on-surface leading-relaxed min-h-[60px] font-medium">
                    {impactData.impactNotes || impactData.notes || 'No specific implementation notes provided.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Editable Mode Form */
          <div className="space-y-5">
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
                  const isChecked = (impactData.departmentImpacts || []).includes(dept.name || dept.department_name);
                  const name = dept.name || dept.department_name;
                  return (
                    <label
                      key={dept.id}
                      className="flex items-center gap-2.5 font-medium text-body-sm text-on-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDeptToggle(name)}
                        className="w-4.5 h-4.5 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50"
                      />
                      <span>{name}</span>
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
                value={impactData.affectedSystems || ''}
                onChange={(e) => handleFieldChange('affectedSystems', e.target.value)}
                placeholder="e.g. CRM, ERP Database, Active Directory..."
                className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-5 items-end">
              {/* Implementation Effort Select */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-label-sm font-semibold text-on-surface-variant">
                  Implementation Effort Estimate
                </label>
                <select
                  value={impactData.implementationEffort || 'medium'}
                  onChange={(e) => handleFieldChange('implementationEffort', e.target.value)}
                  className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm"
                >
                  <option value="low">Low Effort (Fast Rollout)</option>
                  <option value="medium">Medium Effort (Moderate Scope)</option>
                  <option value="high">High Effort (Complex Transition)</option>
                  <option value="critical">Critical Effort (Major Organizational Change)</option>
                </select>
              </div>

              {/* Training Required Toggle */}
              <label className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl shadow-sm cursor-pointer h-11 w-fit whitespace-nowrap">
                <span className="text-body-sm font-bold text-on-surface">Training Required</span>
                <input
                  type="checkbox"
                  checked={!!impactData.trainingRequired}
                  onChange={(e) => handleFieldChange('trainingRequired', e.target.checked)}
                  className="w-5 h-5 rounded border-outline-variant text-blue-700 focus:ring-blue-700/50 cursor-pointer flex-shrink-0"
                />
              </label>
            </div>

            {/* Impact Assessment Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">
                Impact Assessment Notes
              </label>
              <textarea
                value={impactData.impactNotes || impactData.notes || ''}
                onChange={(e) => handleFieldChange('impactNotes', e.target.value)}
                placeholder="Describe implementation timelines, dependencies, risks..."
                className="w-full min-h-[100px] p-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface resize-y"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

DocumentImpactTab.propTypes = {
  impactData: PropTypes.object,
  setImpactData: PropTypes.func.isRequired,
  departments: PropTypes.array,
  readOnly: PropTypes.bool,
};
