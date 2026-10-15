/**
 * @file UnifiedDashboard.jsx
 * @description Presentational container layout wrapper for documents and templates dashboards
 * @dependencies react, react-router-dom, hooks/useDashboardState, utils/dashboardUtils, subcomponents
 * @author Codegen
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import FilterBar from '../../../components/new/tailwind/FilterBar';
import EmptyState from '../../../components/new/tailwind/EmptyState';
import Pagination from '../../../components/new/tailwind/Pagination';
import { useAuth } from '../../../utils/authService';

// Subcomponents & Custom hooks / utilities

import PinnedSection from './components/PinnedSection';
import DashboardTable from './components/DashboardTable';
import DashboardCardGrid from './components/DashboardCardGrid';
import UnifiedPreviewModal from '../../../components/new/tailwind/UnifiedPreviewModal';
import ReassignAuthorityModal from './components/ReassignAuthorityModal';
import InboundReferencesModal from '../../../components/Unified/UnifiedTextEditor/components/InboundReferencesModal';
import useDashboardState from '../../../hooks/new/useDashboardState';
import { getDisplayCategory, getMockedDueDate, getApproversForTemplate, getApproversForDoc, formatId } from './utils/dashboardUtils';

export default function HubPage({ initialType, initialActiveTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const state = useDashboardState(initialType, user, initialActiveTab);

  const workspaceMetrics = useMemo(() => {
    const documents = state.documents || [];
    const templates = state.templates || [];

    // Total documents & templates available in workspace (or scope)
    const docCount = state.documentsCount !== undefined ? state.documentsCount : documents.length;
    const tempCount = state.templatesCount !== undefined ? state.templatesCount : templates.length;

    // In Progress count across current workspace (now includes drafts, reviews, approvals)
    const inProgressCount = typeof state.getTabCount === 'function' ? (state.getTabCount('In Progress') || 0) : 0;

    return {
      documentsCount: docCount,
      templatesCount: tempCount,
      draftsInProgress: inProgressCount,
    };
  }, [state.documents, state.templates, state.documentsCount, state.templatesCount, state.getTabCount]);

  const [selectedPreviewItem, setSelectedPreviewItem] = useState(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null);

  const handlePreviewItem = (item) => {
    setSelectedPreviewItem(item);
    setPreviewModalVisible(true);
  };

  const handleOpenReassign = (approver, item) => {
    setReassignTarget({ approver, app: approver, item });
    setReassignModalVisible(true);
  };

  const sharedProps = {
    onAction: state.handleAction,
    currentUser: user,
    onTogglePin: state.handleTogglePin,
    onProgressChange: state.handleProgressChange,
    getDisplayCategory,
    getMockedDueDate,
    getApproversForTemplate,
    getApproversForDoc,
    formatId,
    onPreviewItem: handlePreviewItem,
    onReassign: handleOpenReassign,
  };

  return (
    <MainLayout
      showSearch={true}
      searchVal={state.searchVal}
      onSearchChange={(val) => {
        state.setSearchVal(val);
        state.setAppliedSearch(val); // Real-time quick search update
      }}
    >
      <div className="max-w-container_max_width mx-auto">


        {/* Scope Selector and Add Buttons aligned row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30 shadow-sm select-none">
            {['all', 'documents', 'templates'].map(type => (
              <button
                key={type}
                onClick={() => state.setDashboardType(type)}
                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-200 capitalize ${state.dashboardType === type ? 'bg-blue-700 text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
              >
                <span>{type === 'all' ? 'All' : type}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${state.dashboardType === type
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container-highest text-on-surface-variant/80'
                  }`}>
                  {state.scopeCounts ? state.scopeCounts[type] : 0}
                </span>
              </button>
            ))}
          </div>

          {/* Add buttons relocated to the end of the main scope switcher row */}
          {user?.role !== 'viewer' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/document/new')}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 shadow-sm hover:shadow"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add Document</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/template/new')}
                  className="border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 active:bg-blue-100 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 shadow-sm hover:shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Template</span>
                </button>
              )}
            </div>
          )}
        </div>

        <FilterBar
          currentUser={user}
          activeTab={state.activeTab}
          searchVal={state.searchVal}
          onSearchChange={state.setSearchVal}
          departments={state.distinctDepts}
          selectedDept={state.selectedDept}
          onDeptChange={state.setSelectedDept}
          startDate={state.startDate}
          endDate={state.endDate}
          onDateChange={(start, end) => {
            state.setStartDate(start);
            state.setEndDate(end);
          }}
          owners={state.distinctOwners}
          selectedOwner={state.selectedOwner}
          onOwnerChange={state.setSelectedOwner}
          isPendingTab={state.activeTab === 'In Progress'}
          approverGroups={state.distinctApproverGroups}
          selectedApproverGroup={state.selectedApproverGroup}
          onApproverGroupChange={state.setSelectedApproverGroup}
          onClear={state.handleClearFilters}
          viewMode={state.viewMode}
          onViewModeChange={state.setViewMode}
          sortBy={state.sortBy}
          onSortChange={state.setSortBy}
          viewAllReadOnly={state.viewAllReadOnly}
          onViewAllReadOnlyChange={state.setViewAllReadOnly}
          showReadOnlyToggle={state.activeTab === 'In Progress'}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant mb-3">Documents</div>
            <div className="text-4xl font-extrabold text-on-surface">{workspaceMetrics.documentsCount}</div>
            <div className="mt-2 text-sm text-on-surface-variant">Total documents across your workspace</div>
          </div>
          <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant mb-3">Templates</div>
            <div className="text-4xl font-extrabold text-on-surface">{workspaceMetrics.templatesCount}</div>
            <div className="mt-2 text-sm text-on-surface-variant">Total templates available for review and publishing</div>
          </div>
          <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant mb-3">In Progress</div>
            <div className="text-4xl font-extrabold text-on-surface">{workspaceMetrics.draftsInProgress}</div>
            <div className="mt-2 text-sm text-on-surface-variant">Draft, review and approval items in progress</div>
          </div>
        </div>

        {/* TabsSwitch row (Draft merged into In Progress) */}
        <div className="border-b border-outline-variant pb-2 mb-6">
          <div className="flex gap-8 overflow-x-auto select-none scrollbar-none">
            {['In Progress', 'Published', 'Archived'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  state.setActiveTab(tab);
                  state.setCurrentPage(1);
                }}
                className={`font-title-md text-title-md pb-2 transition-all relative whitespace-nowrap ${state.activeTab === tab ? 'text-primary font-extrabold border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface font-semibold'
                  }`}
              >
                <span>{tab}</span>
                {state.getTabCount(tab) !== undefined && (
                  <span className="ml-1.5 bg-surface-container-high text-on-surface-variant text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                    {state.getTabCount(tab)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pinned section fixed above existing filters */}
        <PinnedSection items={state.pinnedItems} viewMode={state.viewMode} activeTab={state.activeTab} {...sharedProps} />

        {/* Content items render views */}
        {state.loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="material-symbols-outlined text-primary text-[48px] animate-spin">sync</span>
            <span className="text-on-surface-variant text-sm font-semibold">Fetching records...</span>
          </div>
        ) : state.paginatedItems.length === 0 ? (
          <EmptyState
            searchActive={!!state.searchVal}
            searchVal={state.searchVal}
            activeTab={state.activeTab}
            onClearSearch={state.handleClearFilters}
          />
        ) : state.viewMode === 'blocks' ? (
          <DashboardCardGrid items={state.paginatedItems} activeTab={state.activeTab} {...sharedProps} />
        ) : (
          <DashboardTable items={state.paginatedItems} activeTab={state.activeTab} {...sharedProps} />
        )}

        {/* Pagination Controls */}
        {!state.loading && state.tabItems.length > 0 && (
          <Pagination
            currentPage={state.currentPage}
            onPageChange={state.setCurrentPage}
            totalEntries={state.tabItems.length}
            pageSize={state.itemsPerPage}
          />
        )}

        {/* Unified Preview Modal */}
        {(() => {
          const activePreviewItem = selectedPreviewItem
            ? (state.tabItems.find(i => String(i.id) === String(selectedPreviewItem.id) && i.itemType === selectedPreviewItem.itemType)
              || state.pinnedItems.find(i => String(i.id) === String(selectedPreviewItem.id) && i.itemType === selectedPreviewItem.itemType)
              || selectedPreviewItem)
            : null;
          return (
            <UnifiedPreviewModal
              visible={previewModalVisible}
              item={activePreviewItem}
              onClose={() => setPreviewModalVisible(false)}
              onEdit={(item) => {
                setPreviewModalVisible(false);
                const isArch = item?.status === 'archive_draft' || item?.status === 'archive_reviewed';
                const suffix = isArch ? '?archive=true' : '';
                navigate(item.itemType === 'template' ? `/template/${item.id}${suffix}` : `/document/${item.id}${suffix}`);
              }}
              onAction={state.handleAction}
              onProgressChange={state.handleProgressChange}
              getDisplayCategory={getDisplayCategory}
              formatId={formatId}
            />
          );
        })()}

        {/* Reassign Authority Modal */}
        <ReassignAuthorityModal
          visible={reassignModalVisible}
          onClose={() => {
            setReassignModalVisible(false);
            setReassignTarget(null);
          }}
          targetUser={reassignTarget?.approver || reassignTarget?.app}
          item={reassignTarget?.item}
          currentUser={user}
          users={state.users}
          departments={state.departments}
          onSuccess={(newAssignee) => {
            if (typeof state.handleReassignSuccess === 'function') {
              state.handleReassignSuccess(reassignTarget?.item, reassignTarget?.approver || reassignTarget?.app, newAssignee);
            } else if (typeof state.fetchData === 'function') {
              state.fetchData();
            }
          }}
        />

        {/* Inbound References Blocking Modal (prevents archiving if referenced by active docs/templates) */}
        <InboundReferencesModal
          visible={state.inboundBlockedModalVisible}
          onClose={() => state.setInboundBlockedModalVisible(false)}
          documentTitle={state.inboundTargetTitle}
          referencingItems={state.inboundReferencingItems}
          onRecheck={state.handleRecheckInbound}
          isRechecking={state.isCheckingInbound}
        />

      </div>
    </MainLayout>
  );
}
