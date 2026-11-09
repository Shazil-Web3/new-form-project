import React, { useState } from 'react';
import PropTypes from 'prop-types';
import SearchableSelect from '../../../../components/new/tailwind/SearchableSelect';

/**
 * RoleMemberPicker - Transient searchable select that resets after each selection.
 * Kept as a separate component so each role card has its own isolated picker state.
 */
function RoleMemberPicker({ role, availableMembers, onSelect }) {
  const [pickerValue, setPickerValue] = useState('');

  const memberOptions = availableMembers.map((m) => {
    const fullName = m.name || `${m.first_name || m.firstName || ''} ${m.last_name || m.lastName || ''}`.trim() || m.username || 'Unknown';
    return {
      value: String(m.id || m.userId),
      label: `${fullName} (${m.email})`,
    };
  });

  const handleChange = (val) => {
    if (!val) return;
    onSelect(role.key, val);
    setPickerValue('');
  };

  return (
    <div className="flex-1">
      <SearchableSelect
        value={pickerValue}
        onChange={handleChange}
        options={memberOptions}
        placeholder="Search & add member to this role..."
      />
    </div>
  );
}

/**
 * ParticipantsStep - Step 2 of Document Wizard
 * 
 * Manages adding authors, reviewers, and approvers to the document.
 * Displays added participants as responsive tags.
 */
export default function ParticipantsStep({
  participants = [],
  onAddParticipant,
  onRemoveParticipant,
  orgMembers = [],
  disabled = false,
}) {
  const roles = [
    { key: 'author', label: 'Authors (Full Write Access)' },
    { key: 'document_reviewer', label: 'Reviewers (Comment & Feedback)' },
    { key: 'document_approver', label: 'Approvers (Sign-off & Release)' },
  ];

  console.log('Participants', participants)

  const handleRoleSelect = (roleKey, userId) => {
    if (disabled || !userId) return;
    const member = orgMembers.find(m => String(m.id || m.userId) === String(userId));
    if (member) {

      console.log('selected member: ', member)
      const fullName = member.name || `${member.first_name || member.firstName || ''} ${member.last_name || member.lastName || ''}`.trim() || member.username || 'Unknown';
      onAddParticipant({
        id: member.id || member.userId,
        name: fullName,
        email: member.email,
        role: roleKey,
        user_role: member.role


      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {roles.map((role) => {
        const addedOfRole = participants.filter(p => p.role === role.key);
        // Exclude members already added for this specific role and filter by role
        const availableMembers = orgMembers.filter(
          m => {
            const alreadyAdded = addedOfRole.some(p => String(p.id) === String(m.id || m.userId));
            if (alreadyAdded) return false;

            if (role.key === 'document_reviewer') {
              return m.role === 'reviewer';
            }
            if (role.key === 'document_approver') {
              return m.role === 'approver';
            }
            return true;
          }
        );

        return (
          <div key={role.key} className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-4.5 space-y-3 shadow-sm">
            <label className="text-label-sm font-bold text-on-surface">
              {role.label}
            </label>

            {/* Searchable Member Picker */}
            {!disabled && (
              <div className="flex gap-2">
                <RoleMemberPicker
                  role={role}
                  availableMembers={availableMembers}
                  onSelect={handleRoleSelect}
                />
              </div>
            )}

            {/* Chips of added participants */}
            <div className="flex flex-wrap gap-2 pt-1.5">
              {addedOfRole.length > 0 ? (
                addedOfRole.map((part) => (
                  <div
                    key={part.id}
                    className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1 bg-surface-container-highest text-on-surface border border-outline-variant/60 rounded-full text-xs font-semibold shadow-inner ${disabled ? 'pr-3' : ''
                      }`}
                  >
                    <span>{part.name}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveParticipant(part.id, role.key)}
                        className="text-on-surface-variant hover:text-red-700 p-0.5 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-[12px] text-on-surface-variant/50 italic font-medium pl-1">
                  No participants assigned to this role yet.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

ParticipantsStep.propTypes = {
  participants: PropTypes.array.isRequired,
  onAddParticipant: PropTypes.func.isRequired,
  onRemoveParticipant: PropTypes.func.isRequired,
  orgMembers: PropTypes.array,
  disabled: PropTypes.bool,
};
