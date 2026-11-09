/**
 * @file PreviewLeftPane.jsx
 * @description Always-visible left sidebar of the preview modal.
 *   Shows: type badge, ID, title, status pill, progress bar, all metadata rows,
 *   due date chip, owner, and a stage-specific primary action button.
 * @dependencies react, prop-types, dashboardUtils, useAuth
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { formatId, getDisplayCategory, getMockedDueDate, getInlineDueDateInfo, getReceivedAt } from '../../../../pages/new/Hub/utils/dashboardUtils';
import { useAuth } from '../../../../utils/authService';
import ProgressToggle from '../../../../pages/new/Hub/components/ProgressToggle';

const STATUS_PILL = {
  draft: 'bg-blue-50 text-blue-700 border border-blue-200',
  pending_review: 'bg-orange-50 text-orange-700 border border-orange-200',
  reviewed: 'bg-orange-50 text-orange-700 border border-orange-200',
  pending_approval: 'bg-purple-50 text-purple-700 border border-purple-200',
  approved: 'bg-purple-50 text-purple-700 border border-purple-200',
  published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  archived: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
  old: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
  pending_archive_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
  pending_archive_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  archive_draft: 'bg-amber-50 text-amber-800 border border-amber-300 font-bold',
  archive_reviewed: 'bg-amber-50 text-amber-800 border border-amber-300 font-bold',
};

function fmt(d) {
  if (!d) return null;
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    return (
      <div className="flex flex-col items-end">
        <span>{dateObj.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span className="text-[10px] text-on-surface-variant/60 font-normal">
          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </span>
      </div>
    );
  }
  catch { return d; }
}

function MetaRow({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-2 text-xs text-on-surface-variant">
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 shrink-0">{icon}</span>
        <span className="font-medium shrink-0">{label}:</span>
      </div>
      <div className="text-on-surface font-semibold text-right">{value}</div>
    </div>
  );
}

function ActionButton({ stage, item, isDocument, onEdit, onAction, isAuthor, isReviewerOrApprover, currentUser }) {
  const statusLower = String(item.status || '').toLowerCase();
  console.log('isAuthor', isAuthor)
  console.log('isReviewerOrApprover', isReviewerOrApprover)
  console.log('currentUser?.role', currentUser?.role)
  console.log('stage', stage)
  console.log('isDocument', isDocument)

  if (currentUser?.role === 'viewer') {
    return (
      <button
        onClick={() => onEdit(item)}
        className="w-full border border-blue-700 text-blue-700 bg-white hover:bg-blue-700/5 font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
      >
        <span className="material-symbols-outlined text-[18px]">visibility</span>
        <span>View Full File</span>
      </button>
    );
  }

  if (stage === 'draft') {
    if (!isAuthor) {
      return (
        <button
          disabled
          className="w-full bg-zinc-100 text-zinc-400 font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-zinc-200 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          <span>Read Only (Non-Author)</span>
        </button>
      );
    }
    if (statusLower === 'archive_draft') {
      return (
        <button
          onClick={() => onEdit(item)}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          <span>Edit Archive Draft</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => onEdit(item)}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        <span>Edit Draft</span>
      </button>
    );
  }

  if (stage === 'in_progress') {
    if (statusLower === 'archive_reviewed') {
      return (
        <button
          onClick={() => onEdit(item)}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          <span>Submit for Archive Approval</span>
        </button>
      );
    }
    // If status is approved, author gets Publish and Revert to Draft buttons
    if (statusLower === 'approved') {
      if (isAuthor) {
        return (
          <div className="space-y-2 w-full">
            <button
              onClick={() => onAction('publish', item.id, item.itemType)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">publish</span>
              <span>Publish</span>
            </button>
            <button
              onClick={() => onAction('revert', item.id, item.itemType)}
              className="w-full border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">undo</span>
              <span>Revert to Draft</span>
            </button>
          </div>
        );
      }
    }

    // If they are active reviewer/approver, show Approve and Reject controls
    if (isReviewerOrApprover) {
      const isArchiveReview = statusLower === 'pending_archive_review';
      const isArchiveApproval = statusLower === 'pending_archive_approval';
      const approveLabel = isArchiveApproval ? 'Approve Archive' : isArchiveReview ? 'Complete Archive Review' : 'Approve & Sign';
      const rejectLabel = (isArchiveReview || isArchiveApproval) ? 'Decline Archive' : 'Decline / Reject';

      return (
        <div className="space-y-2 w-full">
          <button
            onClick={() => onAction('approve', item.id, item.itemType)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{approveLabel}</span>
          </button>
          <button
            onClick={() => onAction('reject', item.id, item.itemType)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            <span>{rejectLabel}</span>
          </button>
        </div>
      );
    }

    // Default view button for non-reviewer/non-approver
    return (
      <button
        onClick={() => onEdit(item)}
        className="w-full border border-blue-700 text-blue-700 bg-white hover:bg-blue-700/5 font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
      >
        <span className="material-symbols-outlined text-[18px]">visibility</span>
        <span>View Full File</span>
      </button>
    );
  }

  if (stage === 'published') {
    if (!isDocument) {
      return (
        <button
          onClick={() => onAction('use', item.id, item.itemType)}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">post_add</span>
          <span>Instantiate Document</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => onEdit(item)}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
      >
        <span className="material-symbols-outlined text-[18px]">edit_document</span>
        <span>Create Revision</span>
      </button>
    );
  }

  if (stage === 'archived') {
    if (statusLower === 'pending_archive_approval' || statusLower === 'pending_archive_review') {
      const isReview = statusLower === 'pending_archive_review';
      if (isReviewerOrApprover) {
        return (
          <div className="space-y-2 w-full">
            <button
              onClick={() => onAction(isReview ? 'review' : 'approve', item.id, item.itemType)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{isReview ? 'Review Archive' : 'Approve Archive'}</span>
            </button>
            <button
              onClick={() => onAction('reject', item.id, item.itemType)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>Decline Archive</span>
            </button>
          </div>
        );
      }
      if (isAuthor || currentUser?.role === 'admin') {
        return (
          <button
            onClick={() => onAction('cancel_archive_request', item.id, item.itemType)}
            className="w-full border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
            <span>Cancel Archive Request</span>
          </button>
        );
      }
      return null;
    }

    return (
      <button
        onClick={() => onAction('restore', item.id, item.itemType)}
        className="w-full border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
      >
        <span className="material-symbols-outlined text-[18px]">restore</span>
        <span>Restore to Draft</span>
      </button>
    );
  }

  return null;
}

export default function PreviewLeftPane({ item, stage, onEdit, onAction, onProgressChange, isReviewerOrApprover }) {
  const { user } = useAuth();
  const isAuthor = user ? (Number(item.created_by) === Number(user.id) || user.role === 'admin') : false;

  const isDocument = item.itemType !== 'template';
  const displayId = formatId(item.id, item.itemType);
  const category = getDisplayCategory(item);
  const rawDueDate = isDocument ? getMockedDueDate(item) : item.due_date;
  const dueDateInfo = getInlineDueDateInfo(item.due_date, !isDocument, item);
  const receivedDate = getReceivedAt(item, user);
  const initials = String(item.owner_name || item.created_by_name || 'U').substring(0, 2).toUpperCase();
  const statusKey = (item.status || 'draft').toLowerCase();
  const pillClass = STATUS_PILL[statusKey] || STATUS_PILL.draft;
  const progress = item.progress_value ?? item.completion_rate ?? 0;

  return (
    <div className="w-full md:w-[32%] bg-surface-container-low border-r border-outline-variant p-5 flex flex-col justify-between h-full select-none shrink-0">
      <div className="space-y-5 overflow-y-auto">
        {/* Badge row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isDocument ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
            {isDocument ? 'Document' : 'Template'}
          </span>
          {item.document_number && (
            <span className="text-body-sm font-mono font-bold text-on-surface-variant/60">{item.document_number}</span>
          )}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-base font-extrabold text-on-surface leading-snug line-clamp-3">
            {item.name || item.title}
          </h2>
          {item.description && (
            <p className="text-xs text-on-surface-variant/70 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
        </div>

        {/* Status + Version + Due Date Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${pillClass}`}>
            {String(item.status || 'draft').replace(/_/g, ' ')}
          </span>
          <span className="text-xs font-mono font-bold text-on-surface-variant/60 bg-surface-container border border-outline-variant/40 px-2 py-0.5 rounded">
            v{item.version || '1.0'}
          </span>
          {dueDateInfo?.dateStr && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${dueDateInfo.colorClass}`}>
              <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
              {dueDateInfo.label}
            </span>
          )}
        </div>

        {/* Progress bar (Draft/In Progress only) */}
        {(stage === 'draft' || stage === 'in_progress') && (
          <div className="flex-grow max-w-full">
            <ProgressToggle
              value={progress}
              onChange={(newVal) => onProgressChange && onProgressChange(item.id, newVal)}
              canEdit={user?.role === 'admin' || user?.role === 'project_manager' || Number(user?.id) === Number(item.created_by)}
            />
          </div>
        )}

        {/* Meta rows */}
        <div className="space-y-2 pt-1 border-t border-outline-variant/40">
          <MetaRow icon="category" label="Category" value={category} />
          {item.document_number && <MetaRow icon="tag" label="Doc Number" value={item.document_number} />}
          {item.project_number && <MetaRow icon="folder_open" label="Project No" value={item.project_number} />}
          {item.cost_center_number && <MetaRow icon="account_balance_wallet" label="Cost Center" value={item.cost_center_number} />}
          {item.department && <MetaRow icon="apartment" label="Dept" value={item.department} />}
          {rawDueDate && (
            <MetaRow
              icon="event"
              label="Due Date"
              value={
                <div className="flex flex-col items-end">
                  <span>{dueDateInfo?.dateStr || (typeof rawDueDate === 'string' ? new Date(rawDueDate).toLocaleDateString() : '')}</span>
                  {dueDateInfo?.label && (
                    <span className="text-[10px] text-on-surface-variant/70 font-normal">
                      {dueDateInfo.label}
                    </span>
                  )}
                </div>
              }
            />
          )}
          {receivedDate && <MetaRow icon="inbox" label="Received" value={fmt(receivedDate)} />}
          <MetaRow icon="calendar_today" label="Created" value={fmt(item.created_at)} />
          {stage === 'published' ? (
            <MetaRow icon="verified" label="Approved" value={fmt(item.approved_at || item.published_at || item.updated_at)} />
          ) : stage === 'archived' ? (
            <MetaRow icon="archive" label="Archived" value={fmt(item.archived_at || item.updated_at)} />
          ) : (
            <MetaRow icon="update" label="Updated" value={fmt(item.updated_at)} />
          )}
        </div>

        {/* Owner */}
        <div className="flex items-center gap-3 border-t border-outline-variant/40 pt-4">
          <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-inner uppercase shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wide block">Owner</span>
            <span className="text-xs text-on-surface font-bold truncate block">
              {item.owner_name || item.created_by_name || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Primary action button */}
      <div className="pt-4 border-t border-outline-variant/40 mt-4 shrink-0">
        <ActionButton
          stage={stage}
          item={item}
          isDocument={isDocument}
          onEdit={onEdit}
          onAction={onAction}
          isAuthor={isAuthor}
          isReviewerOrApprover={isReviewerOrApprover}
          currentUser={user}
        />
      </div>
    </div>
  );
}

PreviewLeftPane.propTypes = {
  item: PropTypes.object.isRequired,
  stage: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
  isReviewerOrApprover: PropTypes.bool,
};
