/**
 * @file PreviewStatusBanner.jsx
 * @description Contextual top banner inside the right pane of the preview modal.
 *   Shows stage-appropriate icon, message, and colour.
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

const STAGE_CONFIG = {
  draft: {
    icon: 'draft',
    msg: 'Draft — Not yet submitted. Fill out all tabs and submit for review when ready.',
    bg: 'bg-blue-50 border-blue-200 text-blue-800',
    iconColor: 'text-blue-600',
  },
  in_progress: {
    icon: 'sync',
    msg: 'In Progress — Workflow is active. Content is locked pending reviewer/approver sign-off.',
    bg: 'bg-orange-50 border-orange-200 text-orange-800',
    iconColor: 'text-orange-600',
  },
  published: {
    icon: 'verified',
    msg: 'Published — This is the active approved version. Create a revision to make changes.',
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
  },
  archived: {
    icon: 'inventory_2',
    msg: 'Archived — This file is retired and read-only. Restore to draft to reactivate.',
    bg: 'bg-zinc-100 border-zinc-300 text-zinc-700',
    iconColor: 'text-zinc-500',
  },
};

export default function PreviewStatusBanner({ stage, isReviewerOrApprover = false, onAction = null }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.draft;

  const showActiveControls = stage === 'in_progress' && isReviewerOrApprover && onAction;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-semibold leading-relaxed ${
      showActiveControls ? 'bg-amber-50 border-amber-200 text-amber-900' : cfg.bg
    }`}>
      <div className="flex items-start gap-2.5">
        <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
          showActiveControls ? 'text-amber-700' : cfg.iconColor
        }`}>
          {showActiveControls ? 'shield_person' : cfg.icon}
        </span>
        <span className="flex-1">
          {showActiveControls 
            ? 'Action Required — You are assigned to sign off on this file. Please review the details and sign off using the actions in the left sidebar.' 
            : cfg.msg
          }
        </span>
      </div>
    </div>
  );
}

PreviewStatusBanner.propTypes = {
  stage: PropTypes.oneOf(['draft', 'in_progress', 'published', 'archived']).isRequired,
  isReviewerOrApprover: PropTypes.bool,
  onAction: PropTypes.func,
};
