/**
 * @file DashboardTable.jsx
 * @description Presentational grid table for document and template files with status tags, completion tracking, and inline due dates
 * @dependencies react, prop-types, ProgressToggle, ApproverAvatars, ActionMenu
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import ProgressToggle from './ProgressToggle';
import ApproverAvatars from './ApproverAvatars';
import ActionMenu from './ActionMenu';
import { getStatusTagColor, getInlineDueDateInfo, getContentPreviewText, getReceivedAt } from '../utils/dashboardUtils';

export default function DashboardTable({
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
  const canEditItem = (item) => {
    if (!currentUser) return false;
    if (currentUser.role === 'author') {
      return Number(currentUser.id) === Number(item.created_by) && item.status === 'draft';
    }
    return currentUser.role === 'admin' || currentUser.role === 'project_manager' || Number(currentUser.id) === Number(item.created_by);
  };

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

  const cellPadding = activeTab === 'In Progress' ? 'px-3' : 'px-4';

  return (
    <div className="w-full border border-outline-variant rounded-xl overflow-visible bg-surface-container-lowest shadow-sm select-none">
      <table className="w-full text-left border-collapse table-fixed">
        <thead className="bg-surface-container-low border-b border-outline-variant">
          <tr>
            {/* Dedicated Icon Column */}
            <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant w-[4%]`}></th>
            <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant ${activeTab === 'In Progress' ? 'w-[16%]' : 'w-[26%]'}`}>Name & Metadata</th>
            {activeTab === 'In Progress' && (
              <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant w-[10%]`}>Received At</th>
            )}
            {activeTab === 'In Progress' && (
              <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant w-[8%]`}>Status</th>
            )}
            <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant ${activeTab === 'In Progress' ? 'w-[10%]' : 'w-[10%]'}`}>Category</th>
            <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant ${activeTab === 'In Progress' ? 'w-[10%]' : 'w-[11%]'}`}>Created By</th>

            {activeTab === 'In Progress' && (
              <>
                <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant w-[14%]`}>Completion</th>
                <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant w-[11%]`}>Teams</th>
              </>
            )}

            {activeTab === 'Published' && (
              <>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant w-[20%]">Content</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant w-[15%]">Revision Date</th>
              </>
            )}

            {activeTab === 'Archived' && (
              <>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant w-[20%]">Content</th>
                <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant w-[15%]">Archived Date</th>
              </>
            )}

            <th className={`${cellPadding} py-3 text-xs font-semibold text-on-surface-variant text-right ${activeTab === 'In Progress' ? 'w-[11%]' : 'w-[8%]'} whitespace-nowrap`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {items.map((item) => {
            const isTemplate = item.itemType === 'template';
            const displayId = formatId(item.id, item.itemType);
            const progress = item.progress_value || item.completion_rate || 0;
            const displayDate = item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '';
            const statusLabel = item.status === 'pending_archive_review'
              ? 'ARCHIVE REVIEW'
              : item.status === 'pending_archive_approval'
                ? 'ARCHIVE APPROVAL'
                : String(item.status || '').toUpperCase().replace(/_/g, ' ');
            const isAuthor = currentUser
              ? (currentUser.role === 'admin' || (Number(item.created_by) === Number(currentUser.id) && (currentUser.role !== 'author' || item.status === 'draft')))
              : false;

            const isArchiveFlow = item.status === 'archive_draft' || item.status === 'archive_reviewed' || item.status === 'pending_archive_review' || item.status === 'pending_archive_approval';

            return (
              <tr
                key={item.id}
                className={`hover:bg-surface-container-high/20 transition-colors cursor-pointer h-[88px] min-h-[88px] align-middle ${isArchiveFlow ? 'border-l-4 border-l-amber-500 bg-amber-500/[0.03]' : ''}`}
                onDoubleClick={(e) => {
                  if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('.action-menu-trigger')) {
                    onPreviewItem && onPreviewItem(item);
                  }
                }}
              >
                {/* Type Icon Start Column - 36x36px container, 8px radius, accent tint bg, centered 18px icon in accent color */}
                <td className={`${cellPadding} py-3 w-[4%] align-middle`}>
                  <div className={`${isArchiveFlow ? 'border-amber-500 bg-amber-500/15' : isTemplate ? 'border-purple-600 bg-purple-600/10' : 'border-blue-600 bg-blue-700/10'} b-4 w-9 h-9 rounded-lg text-white border border-1px flex items-center justify-center select-none flex-shrink-0`} title={isArchiveFlow ? 'Archive Item' : (isTemplate ? 'Template' : 'Document')}>
                    <span className={`${isArchiveFlow ? 'text-amber-700' : isTemplate ? 'text-purple-600' : 'text-blue-700'} material-symbols-outlined text-[22px] flex items-center justify-center`}>
                      {isArchiveFlow ? 'inventory_2' : (isTemplate ? 'assignment' : 'feed')}
                    </span>
                  </div>
                </td>

                <td className={`${cellPadding} py-3 align-middle max-w-0`}>
                  <div className="flex flex-col min-w-0">
                    {/* Typography: Title 15px, medium weight, primary text */}
                    <div className="flex items-center gap-1.5 text-[15px] font-medium text-on-surface min-w-0" title={item.name || item.title}>
                      <span className="truncate min-w-0">{item.name || item.title}</span>
                      {item.is_pinned === 1 && (
                        <span className="material-symbols-outlined text-blue-700 text-xs shrink-0" title="Pinned">keep</span>
                      )}
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
                    </div>
                    {/* Typography: Metadata 11px, monospace, muted tertiary */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-mono text-on-surface-variant/70 font-semibold min-w-0">
                      {item.document_number && (
                        <>
                          <span className="bg-surface-container-high px-1.5 py-0.5 rounded shrink-0">{item.document_number}</span>
                          <span className="text-on-surface-variant/30">•</span>
                        </>
                      )}
                      <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded shrink-0">v{item.version || '1.0'}</span>
                    </div>
                  </div>
                </td>

                {activeTab === 'In Progress' && (
                  <td className={`${cellPadding} py-3 align-middle`}>
                    {(() => {
                      const receivedDate = getReceivedAt(item, currentUser);
                      if (!receivedDate) {
                        return (
                          <span className="text-on-surface-variant/40 text-sm font-medium select-none" title="Not received (author / none)">
                            —
                          </span>
                        );
                      }
                      const dateObj = new Date(receivedDate);
                      if (isNaN(dateObj.getTime())) {
                        return (
                          <span className="text-on-surface-variant/40 text-sm font-medium select-none">
                            —
                          </span>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 text-[12px] font-bold text-on-surface">
                            <span className="material-symbols-outlined text-[14px] text-blue-700">calendar_today</span>
                            <span>{dateObj.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-on-surface-variant/80">
                            <span className="material-symbols-outlined text-[13px] text-blue-700">schedule</span>
                            <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                )}

                {activeTab === 'In Progress' && (
                  <td className={`${cellPadding} py-3 align-middle`}>
                    <div className="flex flex-col gap-0.5 items-start">
                      {statusLabel.split(' ').map((word, wIdx) => (
                        <span key={wIdx} className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${getStatusTagColor(item.status)}`}>
                          {word}
                        </span>
                      ))}
                    </div>
                  </td>
                )}

                {/* Typography: Description/subtext 13px, regular, secondary text */}
                <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant align-middle`}>{getDisplayCategory(item)}</td>
                <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant align-middle`}>{item.created_by_name || 'Sarah Jenkins'}</td>

                {activeTab === 'In Progress' && (
                  <>
                    <td className={`${cellPadding} py-3 align-middle`}>
                      <ProgressToggle value={progress} onChange={(newVal) => onProgressChange(item.id, newVal)} canEdit={canEditItem(item)} />
                      {(() => {
                        const info = getInlineDueDateInfo(item.due_date, isTemplate, item);
                        return (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[13px] font-normal">
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded border ${info.colorClass}`}>
                              <span className="material-symbols-outlined text-[10px] mr-0.5">schedule</span>
                              {info.label} ({info.dateStr})
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`${cellPadding} py-3 align-middle overflow-visible relative hover:z-20`}>
                      <div className="overflow-visible">
                        {(item.status === 'draft' || item.status === 'archive_draft') ? (
                          <span className="text-on-surface-variant/60 text-xs italic">—</span>
                        ) : (
                          <ApproverAvatars
                            approvers={isTemplate ? getApproversForTemplate(item) : getApproversForDoc(item)}
                            canReassign={(app) => canReassignApp(app, item)}
                            onReassign={onReassign ? (app) => onReassign(app, item) : undefined}
                          />
                        )}
                      </div>
                    </td>
                  </>
                )}

                {activeTab === 'Published' && (
                  <>
                    <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant max-w-[200px] truncate`}>
                      {getContentPreviewText(item)}
                    </td>
                    <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant`}>
                      <div className="font-bold text-[12px] text-on-surface">{displayDate}</div>
                      {item.updated_at && (
                        <div className="text-[12px] font-bold text-on-surface flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px] text-blue-700">schedule</span>
                          <span>Time: {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                        </div>
                      )}
                    </td>
                  </>
                )}

                {activeTab === 'Archived' && (
                  <>
                    <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant max-w-[200px] truncate`}>
                      {getContentPreviewText(item)}
                    </td>
                    <td className={`${cellPadding} py-3 text-[13px] font-normal text-on-surface-variant`}>
                      <div className="font-bold text-[12px] text-on-surface">{displayDate}</div>
                      {item.updated_at && (
                        <div className="text-[12px] font-bold text-on-surface flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[13px] text-blue-700">schedule</span>
                          <span>Time: {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                        </div>
                      )}
                    </td>
                  </>
                )}

                {/* Actions */}
                <td className={`${cellPadding} py-3 text-right overflow-visible relative align-middle whitespace-nowrap`}>
                  <div className="flex items-center justify-end gap-1.5 flex-nowrap">
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
                              <>
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
                              </>
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
                              <>
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
                              </>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

DashboardTable.propTypes = {
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
