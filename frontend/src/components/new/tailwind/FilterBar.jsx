/**
 * @file FilterBar.jsx
 * @description Advanced filter bar supporting categories, owner sorting, inline date range popover, and custom indicators
 * @dependencies react, prop-types, ViewToggle
 * @author Codegen
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ViewToggle from './ViewToggle';

export default function FilterBar({
  currentUser,
  activeTab,
  searchVal,
  onSearchChange,
  departments,
  selectedDept,
  onDeptChange,
  startDate,
  endDate,
  onDateChange,
  owners,
  selectedOwner,
  onOwnerChange,
  isPendingTab,
  approverGroups,
  selectedApproverGroup,
  onApproverGroupChange,
  versions,
  selectedVersion,
  onVersionChange,
  onApply,
  onClear,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  viewAllReadOnly = false,
  onViewAllReadOnlyChange = () => {},
  showReadOnlyToggle = false
}) {
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate || '');
  const [tempEnd, setTempEnd] = useState(endDate || '');

  // Synchronize modal values with actual state when modal opens
  useEffect(() => {
    if (isDateModalOpen) {
      setTempStart(startDate || '');
      setTempEnd(endDate || '');
    }
  }, [isDateModalOpen, startDate, endDate]);

  const getDateRangeDisplayString = () => startDate && endDate ? `${startDate} ~ ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : 'Select Date Range';

  // Modern select style options with single chevron background image to prevent double arrow issues
  const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23727786' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.25em 1.25em' };

  const selectClass = "w-full pl-3 pr-8 py-1.5 bg-surface-container-lowest border border-outline-variant hover:border-blue-600/80 rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer appearance-none bg-no-repeat transition-colors duration-150";

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between bg-surface-container-low border border-outline-variant rounded-xl p-3 mb-6 gap-4 select-none relative">
      <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
        {/* Search Input - fixed width */}
        <div className="relative w-full sm:w-44">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
          <input
            className="w-full pl-8 pr-7 py-1.5 border border-outline-variant hover:border-blue-600/80 rounded bg-surface-container-lowest text-on-surface focus:ring-1 focus:ring-blue-600 text-xs outline-none transition-colors duration-150"
            placeholder="Search..."
            type="text"
            value={searchVal}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchVal && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface flex items-center justify-center p-0.5 rounded-full"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Category (Departments) Select */}
        <div className="relative w-full sm:w-40">
          <select
            style={selectStyle}
            className={selectClass}
            value={selectedDept}
            onChange={(e) => onDeptChange(e.target.value)}
          >
            <option value="">All Categories</option>
            {departments.map((dept, idx) => (
              <option key={idx} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Universal Owner Select */}
        {owners && onOwnerChange && (
          <div className="relative w-full sm:w-40">
            <select
              style={selectStyle}
              className={selectClass}
              value={selectedOwner}
              onChange={(e) => onOwnerChange(e.target.value)}
            >
              <option value="">All Owners</option>
              {owners.map((owner, idx) => (
                <option key={idx} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pending-Specific Approver Group Select */}
        {isPendingTab && approverGroups && onApproverGroupChange && (
          <div className="relative w-full sm:w-44">
            <select
              style={selectStyle}
              className={selectClass}
              value={selectedApproverGroup}
              onChange={(e) => onApproverGroupChange(e.target.value)}
            >
              <option value="">All Approver Groups</option>
              {approverGroups.map((group, idx) => (
                <option key={idx} value={group}>{group}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range Dropdown Popover Field */}
        <div className="relative w-full sm:w-48">
          <div
            onClick={() => setIsDateModalOpen(!isDateModalOpen)}
            className="w-full h-[32px] flex items-center justify-between pl-8 pr-8 bg-surface-container-lowest border border-outline-variant hover:border-blue-600/80 rounded text-xs text-on-surface cursor-pointer select-none focus-within:ring-1 focus-within:ring-blue-600 transition-colors duration-150"
          >
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[15px]">calendar_today</span>
            
            <span className="truncate text-xs">
              {getDateRangeDisplayString()}
            </span>

            {(startDate || endDate) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDateChange('start', '');
                  onDateChange('end', '');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                title="Clear dates"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Date Picker Dropdown Popover */}
          {isDateModalOpen && (
            <>
              {/* Overlay listener to close dropdown on outer click */}
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setIsDateModalOpen(false)}
              />
              <div className="absolute left-0 top-full mt-2 bg-surface-container-lowest border border-outline-variant p-4 rounded-xl shadow-xl w-72 z-50 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-outline-variant/30">
                  <span className="text-xs font-bold text-on-surface">Select Date Range</span>
                  <button onClick={() => setIsDateModalOpen(false)} className="p-0.5 hover:bg-surface-container-high rounded text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-on-surface-variant/80">From:</label>
                    <input
                      type="date"
                      value={tempStart}
                      onChange={(e) => setTempStart(e.target.value)}
                      className="w-full px-2 py-1 bg-surface-container-low border border-outline-variant rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-on-surface-variant/80">To:</label>
                    <input
                      type="date"
                      value={tempEnd}
                      onChange={(e) => setTempEnd(e.target.value)}
                      className="w-full px-2 py-1 bg-surface-container-low border border-outline-variant rounded text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/30">
                  <button
                    onClick={() => {
                      setTempStart('');
                      setTempEnd('');
                    }}
                    className="px-2.5 py-1 border border-outline-variant hover:bg-surface-container-high rounded text-[11px] text-on-surface-variant font-semibold"
                  >
                    Reset
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setIsDateModalOpen(false)}
                      className="px-2.5 py-1 border border-outline-variant hover:bg-surface-container-high rounded text-[11px] text-on-surface-variant font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDateChange('start', tempStart);
                        onDateChange('end', tempEnd);
                        setIsDateModalOpen(false);
                      }}
                      className="px-3.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-bold shadow-sm"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Versions Select */}
        {versions && onVersionChange && (
          <div className="relative w-full sm:w-32">
            <select
              style={selectStyle}
              className={selectClass}
              value={selectedVersion}
              onChange={(e) => onVersionChange(e.target.value)}
            >
              <option value="">All Versions</option>
              {versions.map((ver, idx) => (
                <option key={idx} value={ver}>{ver}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sort Selector */}
        <div className="relative w-full sm:w-36">
          <select
            style={selectStyle}
            className={selectClass}
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="">Sort By</option>
            <option value="name">Name</option>
            <option value="version">Version</option>
            <option value="date">Date</option>
            {activeTab !== 'Published' && activeTab !== 'Archived' && (
              <option value="completion">Completion Rate</option>
            )}
          </select>
        </div>

        {/* Main Action buttons - aligned next to the filters in the same line */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showReadOnlyToggle && (
            <label className={`flex items-center gap-2 text-xs text-on-surface font-bold select-none mr-2 ${currentUser?.role === 'viewer' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={viewAllReadOnly}
                disabled={currentUser?.role === 'viewer'}
                onChange={(e) => onViewAllReadOnlyChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-surface-container-lowest border-outline-variant rounded focus:ring-blue-600 cursor-pointer disabled:cursor-not-allowed"
              />
              <span>View all</span>
            </label>
          )}
          <button
            onClick={onClear}
            className="px-4 py-1.5 border border-outline-variant hover:bg-surface-container-high text-on-surface-variant text-xs rounded transition-colors font-semibold cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* View switcher toggle */}
      <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
        <span className="text-xs font-semibold text-on-surface-variant">View:</span>
        <ViewToggle currentView={viewMode} onViewChange={onViewModeChange} />
      </div>
    </div>
  );
}

FilterBar.propTypes = {
  searchVal: PropTypes.string.isRequired, onSearchChange: PropTypes.func.isRequired,
  departments: PropTypes.arrayOf(PropTypes.string).isRequired, selectedDept: PropTypes.string.isRequired,
  onDeptChange: PropTypes.func.isRequired, startDate: PropTypes.string.isRequired,
  endDate: PropTypes.string.isRequired, onDateChange: PropTypes.func.isRequired,
  owners: PropTypes.arrayOf(PropTypes.string), selectedOwner: PropTypes.string,
  onOwnerChange: PropTypes.func, isPendingTab: PropTypes.bool,
  approverGroups: PropTypes.arrayOf(PropTypes.string), selectedApproverGroup: PropTypes.string,
  onApproverGroupChange: PropTypes.func, versions: PropTypes.arrayOf(PropTypes.string),
  selectedVersion: PropTypes.string, onVersionChange: PropTypes.func,
  onClear: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['list', 'blocks']).isRequired, onViewModeChange: PropTypes.func.isRequired,
  sortBy: PropTypes.string.isRequired, onSortChange: PropTypes.func.isRequired,
  viewAllReadOnly: PropTypes.bool, onViewAllReadOnlyChange: PropTypes.func,
  showReadOnlyToggle: PropTypes.bool
};
