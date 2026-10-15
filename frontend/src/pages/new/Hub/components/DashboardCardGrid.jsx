/**
 * @file DashboardCardGrid.jsx
 * @description Document and template card view renderer with visual typography settings and spacing overrides
 * @dependencies react, prop-types, ProgressToggle, ApproverAvatars, ActionMenu
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import ProgressToggle from './ProgressToggle';
import ApproverAvatars from './ApproverAvatars';
import ActionMenu from './ActionMenu';
import { getStatusTagColor } from '../utils/dashboardUtils';

export default function DashboardCardGrid({
  items,
  activeTab,
  onAction,
  currentUser,
  onTogglePin,
  onProgressChange,
  getDisplayCategory,
  getMockedDueDate,
  getApproversForTemplate,
  getApproversForDoc,
  formatId,
  onPreviewItem,
  onReassign,
}) {
  const canReassignItem = (item) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'project_manager') return true;
    const currentId = currentUser.id ?? currentUser.userId;
    return currentId !== undefined && item.created_by !== undefined && (
      String(currentId) === String(item.created_by)
    );
  };

  const canReassignApp = (app, item) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'project_manager') return true;
    const currentId = currentUser.id ?? currentUser.userId;
    if (currentId !== undefined && item.created_by !== undefined && String(currentId) === String(item.created_by)) {
      return true;
    }
    // Reviewer/Approver self-reassignment: only allowed when hovering on their own pending avatar
    const isSelf = (currentId !== undefined && String(app?.userId ?? app?.id) === String(currentId)) ||
      (currentUser.email && app?.email && currentUser.email.toLowerCase() === app.email.toLowerCase());
    const isPending = !app?.status || String(app.status).toLowerCase() === 'pending';
    return Boolean(isSelf && isPending);
  };

  const getDueDateTag = (dueDateStr) => {
    if (!dueDateStr) return null;
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[13px] font-normal bg-red-50 text-red-700 border border-red-200">
          Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    }
    if (diffDays <= 3) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[13px] font-normal bg-orange-50 text-orange-700 border border-orange-200">
          Due in {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[13px] font-normal bg-emerald-50 text-emerald-700 border border-emerald-200">
        Due in {diffDays}d
      </span>
    );
  };

  const getContentPreviewText = (item) => {
    if (!item.content) return 'No preview content available.';
    try {
      const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      const htmlText = parsed.content || '';
      const cleanText = htmlText.replace(/<\/?[^>]+(>|$)/g, "");
      return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText || 'No preview content available.';
    } catch (default_catch) {
      const htmlText = String(item.content);
      const cleanText = htmlText.replace(/<\/?[^>]+(>|$)/g, "");
      return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText;
    }
  };

  const canEditItem = (item) => {
    if (!currentUser) return false;
    if (currentUser.role === 'author') {
      return Number(currentUser.id) === Number(item.created_by) && item.status === 'draft';
    }
    return currentUser.role === 'admin' || currentUser.role === 'project_manager' || Number(currentUser.id) === Number(item.created_by);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 select-none">
      {items.map((item) => {
        const isTemplate = item.itemType === 'template';
        const displayId = formatId(item.id, item.itemType);
        const progress = item.progress_value || item.completion_rate || 0;
        const displayDate = item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '';
        const statusLabel = String(item.status || '').toUpperCase().replace('_', ' ');
        const isAuthor = currentUser
          ? (currentUser.role === 'admin' || (Number(item.created_by) === Number(currentUser.id) && (currentUser.role !== 'author' || item.status === 'draft')))
          : false;

        const isArchiveFlow = item.status === 'archive_draft' || item.status === 'archive_reviewed' || item.status === 'pending_archive_review' || item.status === 'pending_archive_approval';

        return (
          <div
            key={item.id}
            className={`relative hover:z-20 bg-surface-container-lowest border ${isArchiveFlow ? 'border-amber-400/80 shadow-amber-500/5 ring-1 ring-amber-400/30' : 'border-outline-variant'} rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col min-h-[220px] cursor-pointer`}
            onDoubleClick={(e) => {
              if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('.action-menu-trigger')) {
                onPreviewItem && onPreviewItem(item);
              }
            }}
          >
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                {/* Spacing details to prevent Category/ID and Pinned/Version overlap */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-[13px] font-normal truncate">
                      {getDisplayCategory(item)}
                    </span>
                    {item.document_number && (
                      <span className="text-[11px] font-mono font-semibold text-on-surface-variant/60 flex-shrink-0">
                        {item.document_number}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 select-none">
                    {item.is_pinned === 1 && (
                      <span className="material-symbols-outlined text-blue-700 text-xs shrink-0" title="Pinned">keep</span>
                    )}
                    <span className="text-[11px] font-mono font-semibold text-on-surface-variant/60 bg-surface-container border border-outline-variant/40 px-2 py-0.5 rounded shrink-0">
                      v{item.version || '1.0'}
                    </span>
                  </div>
                </div>

                {/* 36x36px icon tile (w-9 h-9), 8px radius (rounded-lg), accent tint bg, centered 18px icon */}
                <div className="flex items-start gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-lg ${isArchiveFlow ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'} border flex items-center justify-center select-none flex-shrink-0`} title={isArchiveFlow ? 'Archive Item' : (isTemplate ? 'Template' : 'Document')}>
                    <span className={`material-symbols-outlined text-[18px] ${isArchiveFlow ? 'text-amber-700' : 'text-blue-700'} flex items-center justify-center`}>
                      {isArchiveFlow ? 'inventory_2' : (isTemplate ? 'assignment' : 'feed')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Typography: Title 15px, medium weight */}
                    <h4 className="text-[15px] font-medium text-on-surface flex items-center gap-1.5 min-w-0" title={item.name || item.title}>
                      <span className="truncate min-w-0">{item.name || item.title}</span>
                      {item.status === 'archive_draft' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider bg-amber-100 text-amber-900 border-amber-400 shrink-0 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                          Archive Draft
                        </span>
                      )}
                      {item.status === 'archive_reviewed' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider bg-amber-100 text-amber-900 border-amber-400 shrink-0 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                          Archive Reviewed
                        </span>
                      )}
                      {(item.status === 'pending_archive_approval' || item.status === 'pending_archive_review') && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200 shrink-0 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">inventory_2</span>
                          {item.status === 'pending_archive_review' ? 'Archive Review' : 'Archive Approval'}
                        </span>
                      )}
                    </h4>
                  </div>
                </div>

                {/* Typography: Description/subtext 13px, regular */}
                <p className="text-on-surface-variant text-[13px] font-normal mb-4 line-clamp-3 min-h-[48px]">
                  {activeTab === 'Published' || activeTab === 'Archived'
                    ? getContentPreviewText(item)
                    : (item.description || 'No description provided.')}
                </p>
              </div>

              <div className="space-y-3">
                {activeTab === 'In Progress' && (
                  <div className="flex items-center justify-between">
                    {(item.status === 'draft' || item.status === 'archive_draft') ? (
                      <span className="text-on-surface-variant/60 text-xs italic">—</span>
                    ) : (
                      getDueDateTag(isTemplate ? item.due_date : getMockedDueDate(item))
                    )}
                    <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded uppercase border ${getStatusTagColor(item.status)}`}>
                      {statusLabel}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3">
                  {activeTab !== 'Published' && activeTab !== 'Archived' && (
                    <div className="flex-grow max-w-[140px]">
                      <ProgressToggle value={progress} onChange={(newVal) => onProgressChange(item.id, newVal)} canEdit={canEditItem(item)} />
                    </div>
                  )}

                  {(activeTab === 'Published' || activeTab === 'Archived') && (
                    <div className="flex flex-col text-[13px] font-normal text-on-surface-variant/60">
                      <span>{activeTab === 'Published' ? 'Published: ' : 'Archived: '} {displayDate}</span>
                      {item.updated_at && (
                        <span className="text-[10px] text-on-surface-variant/50 font-normal">
                          {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </span>
                      )}
                    </div>
                  )}

                  {activeTab === 'In Progress' && (
                    <ApproverAvatars
                      approvers={isTemplate ? getApproversForTemplate(item) : getApproversForDoc(item)}
                      canReassign={(app) => canReassignApp(app, item)}
                      onReassign={onReassign ? (app) => onReassign(app, item) : undefined}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-2 rounded-b-xl flex items-center justify-between min-h-[46px] overflow-visible relative">
              <div className="truncate max-w-[170px] flex flex-col">
                <span className="text-[12px] font-medium text-on-surface-variant">By: {item.created_by_name || 'Sarah Jenkins'}</span>
                {item.created_at && (
                  <span className="text-[11px] font-bold text-on-surface mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-blue-700">schedule</span>
                    <span>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onTogglePin(item.id, item.itemType)}
                  className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/60 hover:text-blue-700 transition-colors"
                  title={item.is_pinned === 1 ? 'Unpin' : 'Pin'}
                >
                  <span className={`material-symbols-outlined text-[16px] ${item.is_pinned === 1 ? 'text-blue-700 font-bold' : ''}`}>
                    keep
                  </span>
                </button>

                {activeTab === 'In Progress' && (
                  (item.status === 'draft' || item.status === 'archive_draft') ? (
                    isAuthor ? (
                      <>
                        <button
                          onClick={() => onAction(item.status === 'archive_draft' ? 'archive_edit' : 'review', item.id, item.itemType)}
                          className={`p-1.5 ${item.status === 'archive_draft' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'} text-white rounded-lg flex items-center justify-center transition-colors shadow-sm`}
                          title={item.status === 'archive_draft' ? "Edit Archive Draft" : "Resume"}
                        >
                          <span className="material-symbols-outlined text-[16px]">{item.status === 'archive_draft' ? 'inventory_2' : 'edit'}</span>
                        </button>
                        <button
                          onClick={() => onAction('delete', item.id, item.itemType)}
                          className="p-1 hover:bg-error/10 rounded text-error transition-colors"
                          title="Discard"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onAction('preview', item.id, item.itemType)}
                        className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/40 transition-colors"
                        title="View Draft"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                    )
                  ) : (item.status === 'pending_archive_approval' || item.status === 'pending_archive_review') ? (
                    (() => {
                      const isReview = item.status === 'pending_archive_review';
                      const isAssigned = (() => {
                        const raw = isTemplate ? item.template_approvers : item.approvers;
                        try {
                          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                          const targetList = isReview ? (parsed?.reviewers || []) : (parsed?.approvers || (Array.isArray(parsed) ? parsed : []));
                          return targetList.some(a => Number(a.userId || a.id) === Number(currentUser?.id) || (a.email && currentUser?.email && a.email.toLowerCase() === currentUser?.email.toLowerCase()));
                        } catch (_) { return false; }
                      })();

                      if (isAssigned) {
                        return (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onAction(isReview ? 'review' : 'approve', item.id, item.itemType)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                              title={isReview ? "Review Archive" : "Approve Archive"}
                            >
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            </button>
                            <button
                              onClick={() => onAction('reject', item.id, item.itemType)}
                              className="p-1 hover:bg-error/10 rounded text-error transition-colors"
                              title="Decline Archive"
                            >
                              <span className="material-symbols-outlined text-[16px]">cancel</span>
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button
                          onClick={() => onAction('preview', item.id, item.itemType)}
                          className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/40 transition-colors"
                          title="View File"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                      );
                    })()
                  ) : (
                    currentUser?.role === 'viewer' ? (
                      <button
                        onClick={() => onAction('preview', item.id, item.itemType)}
                        className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/40 transition-colors"
                        title="View File"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onAction('review', item.id, item.itemType)}
                        className="p-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        title="Review"
                      >
                        <span className="material-symbols-outlined text-[16px]">rate_review</span>
                      </button>
                    )
                  )
                )}

                {activeTab === 'Published' && (
                  <button
                    onClick={() => onAction(currentUser?.role !== 'viewer' ? 'use' : 'preview', item.id, item.itemType)}
                    className="p-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                    title={currentUser?.role !== 'viewer' ? (isTemplate ? 'Use Template' : 'Use Document') : (isTemplate ? 'View Template' : 'View Document')}
                  >
                    <span className="material-symbols-outlined text-[16px]">{currentUser?.role !== 'viewer' ? 'note_add' : 'visibility'}</span>
                  </button>
                )}

                {activeTab === 'Archived' && (
                  (item.status === 'pending_archive_approval' || item.status === 'pending_archive_review') ? (
                    (() => {
                      const isReview = item.status === 'pending_archive_review';
                      const isAssigned = (() => {
                        const raw = isTemplate ? item.template_approvers : item.approvers;
                        try {
                          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                          const targetList = isReview ? (parsed?.reviewers || []) : (parsed?.approvers || []);
                          return targetList.some(a => Number(a.userId || a.id) === Number(currentUser?.id) || (a.email && currentUser?.email && a.email.toLowerCase() === currentUser?.email.toLowerCase()));
                        } catch (_) { return false; }
                      })();

                      if (isAssigned) {
                        return (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onAction(isReview ? 'review' : 'approve', item.id, item.itemType)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                              title={isReview ? "Review Archive" : "Approve Archive"}
                            >
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            </button>
                            <button
                              onClick={() => onAction('reject', item.id, item.itemType)}
                              className="p-1 hover:bg-error/10 rounded text-error transition-colors"
                              title="Decline Archive"
                            >
                              <span className="material-symbols-outlined text-[16px]">cancel</span>
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button
                          onClick={() => onAction('preview', item.id, item.itemType)}
                          className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/40 transition-colors"
                          title="View File"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                      );
                    })()
                  ) : (
                    currentUser?.role === 'viewer' ? (
                      <button
                        onClick={() => onAction('preview', item.id, item.itemType)}
                        className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant/40 transition-colors"
                        title="View File"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onAction('restore', item.id, item.itemType)}
                        className="p-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        title="Restore"
                      >
                        <span className="material-symbols-outlined text-[16px]">unarchive</span>
                      </button>
                    )
                  )
                )}

                <ActionMenu item={item} activeTab={activeTab} onAction={onAction} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

DashboardCardGrid.propTypes = {
  items: PropTypes.array.isRequired,
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
  onReassign: PropTypes.func,
};
