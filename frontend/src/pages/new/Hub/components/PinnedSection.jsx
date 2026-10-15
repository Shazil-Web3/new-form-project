/**
 * @file PinnedSection.jsx
 * @description Pinned items section delegating rendering to DashboardTable and DashboardCardGrid to match active tab schemas
 * @dependencies react, prop-types, DashboardTable, DashboardCardGrid
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import DashboardTable from './DashboardTable';
import DashboardCardGrid from './DashboardCardGrid';

export default function PinnedSection({
  items,
  viewMode,
  activeTab,
  ...sharedProps
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8 select-none">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-blue-700" style={{ fontSize: '20px' }}>keep</span>
        <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Pinned Files</h3>
      </div>
      
      {viewMode === 'blocks' ? (
        <DashboardCardGrid items={items} activeTab={activeTab} {...sharedProps} />
      ) : (
        <DashboardTable items={items} activeTab={activeTab} {...sharedProps} />
      )}
      
      <div className="h-[8px] w-full bg-blue-700 rounded-xl my-6" />
    </div>
  );
}

PinnedSection.propTypes = {
  items: PropTypes.array,
  viewMode: PropTypes.oneOf(['list', 'blocks']).isRequired,
  activeTab: PropTypes.oneOf(['In Progress', 'Published', 'Archived', 'Draft']).isRequired,
  onAction: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  onTogglePin: PropTypes.func.isRequired,
  onProgressChange: PropTypes.func.isRequired,
  getDisplayCategory: PropTypes.func.isRequired,
  getMockedDueDate: PropTypes.func.isRequired,
  getApproversForTemplate: PropTypes.func.isRequired,
  getApproversForDoc: PropTypes.func.isRequired,
  formatId: PropTypes.func.isRequired,
};
