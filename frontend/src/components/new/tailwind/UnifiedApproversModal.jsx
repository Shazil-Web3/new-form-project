import React, { useState } from 'react';
import PropTypes from 'prop-types';
import SearchableSelect from './SearchableSelect';

/**
 * ApproverPicker - isolated transient picker so it can hold its own state
 * independently of the modal's early return.
 */
function ApproverPicker({ availableUsers, onAdd, isArchiveMode = false }) {
  const [pickerValue, setPickerValue] = useState('');

  const userOptions = availableUsers.map((u) => {
    const fullName = u.name || `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() || u.username || 'Unknown';
    return {
      value: String(u.id || u.userId),
      label: `${fullName} (${u.email})`,
    };
  });

  const handleChange = (val) => {
    if (!val) return;
    onAdd(val);
    setPickerValue('');
  };

  return (
    <SearchableSelect
      value={pickerValue}
      onChange={handleChange}
      options={userOptions}
      placeholder="Search and select user by name or email..."
      resetOnSelect={true}
      className={isArchiveMode ? "focus:ring-amber-500/20 focus:border-amber-500" : ""}
    />
  );
}

ApproverPicker.propTypes = {
  availableUsers: PropTypes.array.isRequired,
  onAdd: PropTypes.func.isRequired,
  isArchiveMode: PropTypes.bool,
};

/**
 * UnifiedApproversModal - Redesigned Workflow Approvers Modal
 * 
 * Offers a premium, modern experience for selecting reviewers and approvers:
 * - Segmented controls with icons for submission type.
 * - Clean due date picker with subtle calendar accent.
 * - Rich avatar chips with email, name, and intuitive remove action.
 * - Contextual guidance banners tailored to the archive or standard workflow.
 */
export default function UnifiedApproversModal({
  visible,
  onCancel,
  approverType = 'approval',
  setApproverType,
  sharedDueDate,
  setSharedDueDate,
  templateApprovers = { reviewers: [], approvers: [] },
  users = [],
  handleAddTemplateApprover,
  handleRemoveTemplateApprover,
  onSubmit,
  entityLabel = 'Template',
  mode = 'default',
  title,
  submitButtonLabel,
}) {
  if (!visible) return null;

  const isArchiveMode = mode === 'archive';
  const effectiveApproverType = approverType || 'approval';
  const currentArray = (effectiveApproverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
  const entity = entityLabel || 'Template';

  const dueDatePart = sharedDueDate
    ? (typeof sharedDueDate === 'string' ? sharedDueDate.split('T')[0] : '')
    : '';

  const dueTimePart = (sharedDueDate && typeof sharedDueDate === 'string' && sharedDueDate.includes('T'))
    ? sharedDueDate.split('T')[1].substring(0, 5)
    : '17:00';

  const handleDateChange = (newDate) => {
    if (!newDate) {
      setSharedDueDate('');
    } else {
      const time = dueTimePart || '17:00';
      setSharedDueDate(`${newDate}T${time}:00`);
    }
  };

  const handleTimeChange = (newTime) => {
    const date = dueDatePart || new Date().toISOString().split('T')[0];
    setSharedDueDate(`${date}T${newTime || '17:00'}:00`);
  };

  // Exclude users already added for this specific role/type and filter by role
  const availableUsers = (users || []).filter((u) => {
    const alreadyAdded = currentArray.some((added) => String(added.id || added.userId) === String(u.id || u.userId));
    if (alreadyAdded) return false;

    if (effectiveApproverType === 'review') {
      return u.status !== 'inactive';
    } else {
      const isApprover = u.template_approver === 'yes' || u.role === 'approver' || u.role === 'admin' || u.role === 'superadmin';
      const hasDesignated = (users || []).some(user => user.template_approver === 'yes' || user.role === 'approver');
      return hasDesignated ? isApprover : u.status !== 'inactive';
    }
  });

  const getInitials = (nameStr) => {
    if (!nameStr) return '?';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  const modalTitle = title || (isArchiveMode
    ? `Submit ${entity} for Archive ${effectiveApproverType === 'review' ? 'Review' : 'Approval'}`
    : `Select ${entity} ${effectiveApproverType === 'review' ? 'Reviewers' : 'Approvers'}`);

  const modalSubtitle = isArchiveMode
    ? `Configure sign-off roles and schedule the archival process for this ${entity.toLowerCase()}.`
    : `Designate participants to review or grant final approval sign-off.`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[10050] flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="absolute inset-0 cursor-default" onClick={onCancel}></div>

      {/* Modal Container Box */}
      <div className="relative bg-surface border border-outline-variant/60 rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl z-10 animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isArchiveMode
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                : 'bg-blue-600/10 text-blue-700 border border-blue-600/20'
            }`}>
              <span className="material-symbols-outlined text-[22px]">
                {isArchiveMode ? 'archive' : 'verified_user'}
              </span>
            </div>
            <div>
              <h3 className="text-title-md font-bold text-on-surface leading-tight">
                {modalTitle}
              </h3>
              <p className="text-[12px] text-on-surface-variant font-medium mt-0.5">
                {modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high p-2 rounded-xl transition-colors flex items-center justify-center"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 max-h-[70vh]">
          
          {/* Workflow Type Switcher */}
          <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant/70">tune</span>
                {isArchiveMode ? 'Archive Workflow Type' : 'Submission Type'}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isArchiveMode ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
              }`}>
                Step 1 of 3
              </span>
            </div>

            {/* Segmented Pills */}
            <div className="grid grid-cols-2 p-1.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl gap-2">
              <button
                type="button"
                onClick={() => setApproverType && setApproverType('review')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  effectiveApproverType === 'review'
                    ? isArchiveMode
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-blue-700 text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">rate_review</span>
                <span>{isArchiveMode ? 'Submit for Archive Review' : 'Submit for Review'}</span>
              </button>

              <button
                type="button"
                onClick={() => setApproverType && setApproverType('approval')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  effectiveApproverType === 'approval'
                    ? isArchiveMode
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-blue-700 text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">verified_user</span>
                <span>{isArchiveMode ? 'Submit for Archive Approval' : 'Submit for Approval Sign-off'}</span>
              </button>
            </div>

            {/* Workflow Info Callout */}
            <div className={`flex items-start gap-2.5 p-3 rounded-xl text-xs leading-relaxed font-medium border ${
              isArchiveMode
                ? 'bg-amber-500/10 text-amber-900 border-amber-500/20'
                : 'bg-blue-700/5 text-blue-900 border-blue-700/10'
            }`}>
              <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                isArchiveMode ? 'text-amber-700' : 'text-blue-700'
              }`}>
                {isArchiveMode ? 'inventory_2' : 'info'}
              </span>
              <span>
                {isArchiveMode ? (
                  effectiveApproverType === 'review'
                    ? `Submitting for Archive Review will send this ${entity.toLowerCase()} to designated reviewers for feedback prior to final archival.`
                    : `Submitting for Archive Approval sends this ${entity.toLowerCase()} to assigned approvers. Once approved by all approvers, it will become obsolete and automatically move to the Archived tab.`
                ) : (
                  effectiveApproverType === 'review'
                    ? `Reviewers will evaluate and provide feedback on this ${entity.toLowerCase()} before it moves forward.`
                    : `Approvers will make the final decision to sign off or reject this ${entity.toLowerCase()}.`
                )}
              </span>
            </div>
          </div>

          {/* Workflow Due Date Card */}
          <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant/70">event</span>
                Workflow Due Date & Time <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isArchiveMode ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
              }`}>
                Step 2 of 3
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant/70 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDatePart}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className={`w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none text-body-md text-on-surface shadow-xs cursor-pointer font-medium ${
                    isArchiveMode
                      ? 'focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500'
                      : 'focus:ring-2 focus:ring-blue-700/30 focus:border-blue-700'
                  }`}
                  required
                />
              </div>
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant/70 mb-1">
                  Due Time
                </label>
                <input
                  type="time"
                  value={dueTimePart}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className={`w-full h-11 px-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none text-body-md text-on-surface shadow-xs cursor-pointer font-medium ${
                    isArchiveMode
                      ? 'focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500'
                      : 'focus:ring-2 focus:ring-blue-700/30 focus:border-blue-700'
                  }`}
                />
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant/75 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              This due date and time will apply to all selected {effectiveApproverType === 'review' ? 'reviewers' : 'approvers'}.
            </p>
          </div>

          {/* Add Approvers / Reviewers Card */}
          <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-on-surface-variant uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant/70">group_add</span>
                Assign {entity} {effectiveApproverType === 'review' ? 'Reviewers' : 'Approvers'} <span className="text-red-500">*</span>
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                currentArray.length > 0
                  ? (isArchiveMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                  : 'bg-surface-container-highest text-on-surface-variant/70'
              }`}>
                {currentArray.length} {currentArray.length === 1 ? 'assigned' : 'assigned'}
              </span>
            </div>
            
            <ApproverPicker
              availableUsers={availableUsers}
              onAdd={handleAddTemplateApprover}
              isArchiveMode={isArchiveMode}
            />

            {/* Selected approvers / reviewers list */}
            <div className="space-y-2 pt-1 border-t border-outline-variant/30">
              <div className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">
                Currently Assigned ({currentArray.length})
              </div>

              {currentArray.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {currentArray.map((userItem) => {
                    const idVal = userItem.id || userItem.userId;
                    const displayName = userItem.name || `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim() || userItem.username || 'Unknown';
                    const initials = getInitials(displayName);

                    return (
                      <div
                        key={idVal}
                        className="flex items-center justify-between gap-2.5 p-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-xs hover:border-outline-variant transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isArchiveMode
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-on-surface truncate" title={displayName}>
                              {displayName}
                            </div>
                            {userItem.email && (
                              <div className="text-[10px] text-on-surface-variant/70 truncate" title={userItem.email}>
                                {userItem.email}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTemplateApprover(idVal)}
                          className="text-on-surface-variant/60 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center justify-center shrink-0"
                          title="Remove user"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 px-4 bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-xl text-center">
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant/40 mb-1">
                    person_search
                  </span>
                  <span className="text-xs text-on-surface-variant/70 font-medium">
                    No {effectiveApproverType === 'review' ? 'reviewers' : 'approvers'} assigned yet.
                  </span>
                  <span className="text-[11px] text-on-surface-variant/50 mt-0.5">
                    Search and pick from the dropdown above to add assignees.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-outline-variant/60 flex items-center justify-between gap-3 bg-surface-container-low/90">
          <div className="text-[12px] text-on-surface-variant/80 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">
              {currentArray.length > 0 && sharedDueDate ? 'check_circle' : 'info'}
            </span>
            <span>
              {currentArray.length === 0
                ? `Assign at least one ${effectiveApproverType === 'review' ? 'reviewer' : 'approver'}`
                : !sharedDueDate
                ? 'Select a target due date'
                : `Ready to submit (${currentArray.length} assigned)`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-semibold h-10 px-4.5 rounded-xl transition-colors shadow-xs text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={currentArray.length === 0 || !sharedDueDate}
              className={`text-white font-extrabold h-10 px-5 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none text-xs flex items-center gap-2 ${
                isArchiveMode
                  ? 'bg-amber-600 hover:bg-amber-700 active:scale-98'
                  : 'bg-blue-700 hover:bg-blue-800 active:scale-98'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isArchiveMode ? 'archive' : 'send'}
              </span>
              <span>
                {submitButtonLabel || (isArchiveMode
                  ? `Submit for Archive ${effectiveApproverType === 'review' ? 'Review' : 'Approval'}`
                  : `Submit for ${effectiveApproverType === 'review' ? 'Review' : 'Approval'}`)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

UnifiedApproversModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  approverType: PropTypes.string,
  setApproverType: PropTypes.func,
  sharedDueDate: PropTypes.string,
  setSharedDueDate: PropTypes.func.isRequired,
  templateApprovers: PropTypes.object.isRequired,
  users: PropTypes.array,
  handleAddTemplateApprover: PropTypes.func.isRequired,
  handleRemoveTemplateApprover: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  entityLabel: PropTypes.string,
  mode: PropTypes.oneOf(['default', 'archive']),
  title: PropTypes.string,
  submitButtonLabel: PropTypes.string,
};
