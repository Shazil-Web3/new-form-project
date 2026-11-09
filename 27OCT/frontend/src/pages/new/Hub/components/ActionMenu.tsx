/**
 * @file ActionMenu.jsx
 * @description Premium action dropdown menu for table list rows and card items
 * @dependencies react, prop-types, useAuth
 * @author Codegen
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../../../utils/authService';

export default function ActionMenu({ item, activeTab, onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const isTemplate = item.itemType === 'template';
  const { user } = useAuth();

  const isAuthor = user ? (Number(item.created_by) === Number(user.id) || user.role === 'admin') : false;
  const statusLower = String(item.status || '').toLowerCase();

  const isApprover = (() => {
    if (!user?.id) return false;
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    const raw = isTemplate ? item.template_approvers : item.approvers;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const approvers = Array.isArray(parsed?.approvers) ? parsed.approvers : (Array.isArray(parsed) ? parsed : []);
      return approvers.some(a => Number(a.userId || a.id) === Number(user.id) || (a.email && user.email && a.email.toLowerCase() === user.email.toLowerCase()));
    } catch (_) {}
    return false;
  })();

  const isAssignedApprover = (() => {
    if (!user?.id) return false;
    const raw = isTemplate ? item.template_approvers : item.approvers;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const approvers = Array.isArray(parsed?.approvers) ? parsed.approvers : (Array.isArray(parsed) ? parsed : []);
      return approvers.some(a => Number(a.userId || a.id) === Number(user.id) || (a.email && user.email && a.email.toLowerCase() === user.email.toLowerCase()));
    } catch (_) {}
    return false;
  })();

  const isAssignedReviewer = (() => {
    if (!user?.id) return false;
    const raw = isTemplate ? item.template_approvers : item.approvers;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reviewers = Array.isArray(parsed?.reviewers) ? parsed.reviewers : [];
      return reviewers.some(r => Number(r.userId || r.id) === Number(user.id) || (r.email && user.email && r.email.toLowerCase() === user.email.toLowerCase()));
    } catch (_) {}
    return false;
  })();

  const toggle = () => setIsOpen(!isOpen);

  const handleSelect = (action) => {
    setIsOpen(false);
    onAction(action, item.id || item.document_id, item.itemType);
  };

  // Determine if there are any options to display
  const isDraftItem = statusLower === 'draft' || statusLower === 'archive_draft';
  const hasDraftActions = (activeTab === 'Draft' || (activeTab === 'In Progress' && isDraftItem));
  const hasInProgressActions = activeTab === 'In Progress' && isAuthor && !isDraftItem;
  const hasPublishedActions = activeTab === 'Published' && user?.role !== 'viewer';
  const hasArchivedActions = activeTab === 'Archived';

  if (!hasDraftActions && !hasInProgressActions && !hasPublishedActions && !hasArchivedActions) {
    return null; // Don't render dropdown trigger if no options exist
  }

  return (
    <div className="relative inline-block text-left overflow-visible select-none action-menu-trigger">
      <button
        onClick={toggle}
        className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors flex items-center justify-center"
        title="More Actions"
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 py-1 text-left overflow-hidden">
            
            {(activeTab === 'Draft' || (activeTab === 'In Progress' && isDraftItem)) && (
              isAuthor ? (
                <>
                  <button
                    onClick={() => handleSelect(item.status === 'archive_draft' ? 'archive_edit' : 'edit')}
                    className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs">{item.status === 'archive_draft' ? 'inventory_2' : 'edit'}</span>
                    {item.status === 'archive_draft' ? 'Edit Archive Draft' : (isTemplate ? 'Resume' : 'Edit')}
                  </button>
                  <button
                    onClick={() => handleSelect('delete')}
                    className="w-full px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs text-error">delete</span>
                    Discard
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleSelect('preview')}
                  className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 font-semibold"
                >
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  View Draft
                </button>
              )
            )}

            {activeTab === 'In Progress' && isAuthor && !isDraftItem && (
              <>
                {statusLower === 'archive_reviewed' ? (
                  <>
                    <button
                      onClick={() => handleSelect('archive_edit')}
                      className="w-full px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs text-amber-700">inventory_2</span>
                      Submit for Archive Approval
                    </button>
                    <button
                      onClick={() => handleSelect('revert')}
                      className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs">undo</span>
                      Revert to Archive Draft
                    </button>
                  </>
                ) : statusLower === 'approved' ? (
                  <>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleSelect('publish')}
                        className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                      >
                        <span className="material-symbols-outlined text-xs">publish</span>
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() => handleSelect('revert')}
                      className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs">undo</span>
                      Revert to Draft
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSelect('unsubmit')}
                    className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs">cancel</span>
                    Unsubmit
                  </button>
                )}
              </>
            )}

            {activeTab === 'Published' && (
              <>
                {user?.role !== 'viewer' && (
                  <button
                    onClick={() => handleSelect('use')}
                    className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs">note_add</span>
                    {isTemplate ? 'Use Template' : 'Use Document'}
                  </button>
                )}
                {user?.role !== 'viewer' && (
                  <button
                    onClick={() => handleSelect('revise')}
                    className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs">build</span>
                    Revise
                  </button>
                )}
                <button
                  onClick={() => handleSelect('preview')}
                  className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                >
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  {isTemplate ? 'View Template' : 'View Document'}
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleSelect('archive')}
                    className="w-full px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs text-error">archive</span>
                    Archive
                  </button>
                )}
              </>
            )}

            {activeTab === 'Archived' && (
              <>
                {statusLower === 'pending_archive_review' && isAssignedReviewer && (
                  <>
                    <button
                      onClick={() => handleSelect('review')}
                      className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs text-emerald-700">check_circle</span>
                      Review Archive
                    </button>
                    <button
                      onClick={() => handleSelect('reject')}
                      className="w-full px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs text-error">cancel</span>
                      Decline Archive
                    </button>
                  </>
                )}
                {statusLower === 'pending_archive_approval' && isAssignedApprover && (
                  <>
                    <button
                      onClick={() => handleSelect('approve')}
                      className="w-full px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs text-emerald-700">check_circle</span>
                      Approve Archive
                    </button>
                    <button
                      onClick={() => handleSelect('reject')}
                      className="w-full px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs text-error">cancel</span>
                      Decline Archive
                    </button>
                  </>
                )}
                {(statusLower === 'pending_archive_approval' || statusLower === 'pending_archive_review') && (isAuthor || user?.role === 'admin') && (
                  <button
                    onClick={() => handleSelect('cancel_archive_request')}
                    className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 border-b border-outline-variant/30 font-semibold"
                  >
                    <span className="material-symbols-outlined text-xs">undo</span>
                    Cancel Archive Request
                  </button>
                )}
                <button
                  onClick={() => handleSelect('preview')}
                  className="w-full px-3 py-1.5 text-xs text-on-surface hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 font-semibold"
                >
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  View
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

ActionMenu.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    itemType: PropTypes.oneOf(['template', 'document']).isRequired,
    created_by: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    status: PropTypes.string,
  }).isRequired,
  activeTab: PropTypes.oneOf(['In Progress', 'Published', 'Archived', 'Draft']).isRequired,
  onAction: PropTypes.func.isRequired,
};
