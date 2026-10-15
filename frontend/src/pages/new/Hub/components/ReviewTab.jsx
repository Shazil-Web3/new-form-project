import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeHtml } from '../../../../utils/sanitizeHtml';

/**
 * ReviewTab - Redesigned Verification Tab
 * 
 * Renders summary metrics and triggers final submission:
 * - Details breakdown card.
 * - Submit for Review and Submit for Approval CTA triggers.
 */
export default function ReviewTab({
  isDocument = true,
  values = {},
  tasksCount = 0,
  participantsCount = 0,
  locksCount = 0,
  content = '',
  onSubmitReview,
  onSubmitApproval,
}) {
  return (
    <div className="space-y-6 select-none animate-fade-in">
      <div className="border-b border-outline-variant/60 pb-3">
        <h3 className="text-label-md font-bold text-on-surface">Review Summary & Release</h3>
        <p className="text-body-xs text-on-surface-variant font-medium">Verify your configuration details before submitting for workflow routing.</p>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl text-center shadow-sm">
          <span className="text-label-xs text-on-surface-variant/70 uppercase tracking-wider font-semibold block mb-1">Title</span>
          <span className="text-body-sm font-bold text-on-surface line-clamp-1">
            {(isDocument ? values.title : values.name) || 'Not Defined'}
          </span>
        </div>

        {isDocument && (
          <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl text-center shadow-sm">
            <span className="text-label-xs text-on-surface-variant/70 uppercase tracking-wider font-semibold block mb-1">Action Items</span>
            <span className="text-title-md font-extrabold text-blue-700">{tasksCount}</span>
          </div>
        )}

        <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl text-center shadow-sm">
          <span className="text-label-xs text-on-surface-variant/70 uppercase tracking-wider font-semibold block mb-1">
            {isDocument ? 'Participants' : 'Categories'}
          </span>
          <span className="text-title-md font-extrabold text-blue-700">
            {isDocument ? participantsCount : (values.category_id ? 1 : 0)}
          </span>
        </div>

        <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl text-center shadow-sm">
          <span className="text-label-xs text-on-surface-variant/70 uppercase tracking-wider font-semibold block mb-1">
            {isDocument ? 'Due Date' : 'Locked Items'}
          </span>
          <span className="text-body-sm font-bold text-on-surface">
            {isDocument ? (values.due_date || 'N/A') : `${locksCount} Locks`}
          </span>
        </div>
      </div>

      {/* HTML Content Preview Pane */}
      <div className="space-y-2">
        <label className="text-label-sm font-bold text-on-surface-variant block">Content Preview</label>
        <div className="border border-outline-variant rounded-xl p-6 bg-white shadow-inner max-h-[300px] overflow-y-auto">
          {content ? (
            <div
              className="prose max-w-none text-body-sm font-sans leading-relaxed text-on-surface"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          ) : (
            <span className="text-body-sm text-on-surface-variant/50 italic block text-center py-6">
              No content outlines drafted yet.
            </span>
          )}
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-outline-variant/60">
        <button
          type="button"
          onClick={onSubmitReview}
          className="w-full sm:w-auto border border-blue-700 text-blue-700 bg-white hover:bg-blue-700/5 font-bold h-11 px-6 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">rate_review</span>
          <span>Submit for Review</span>
        </button>

        <button
          type="button"
          onClick={onSubmitApproval}
          className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-extrabold h-11 px-6 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          <span>Submit for Approval Sign-off</span>
        </button>
      </div>
    </div>
  );
}

ReviewTab.propTypes = {
  isDocument: PropTypes.bool,
  values: PropTypes.object.isRequired,
  tasksCount: PropTypes.number,
  participantsCount: PropTypes.number,
  locksCount: PropTypes.number,
  content: PropTypes.string,
  onSubmitReview: PropTypes.func.isRequired,
  onSubmitApproval: PropTypes.func.isRequired,
};
