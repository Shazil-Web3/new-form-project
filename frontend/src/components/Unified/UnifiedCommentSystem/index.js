/**
 * UnifiedCommentSystem - Router Component
 * 
 * This is the main entry point for the Unified Comment System.
 * It routes to the appropriate mode-specific comment component:
 * - CreateComments: Minimal comments for internal use during creation
 * - PreviewComments: Full comment system for reviewers
 * - ReviewComments: Comments with approval actions
 * 
 * All mode components share the same CommentCore logic.
 */

import React from 'react';
import CreateComments from './CreateComments';
import PreviewComments from './PreviewComments';
import ReviewComments from './ReviewComments';

const UnifiedCommentSystem = ({ mode = 'preview', isDraft = false, isRevise = false, ...props }) => {
  const isEffectiveRevise = Boolean(
    isRevise ||
    props.isRevise ||
    props.revising ||
    props.isRevising ||
    props.document?.revision_parent_id ||
    props.template?.revision_parent_id
  );

  const itemStatus = String(
    props.status ||
    props.document?.status ||
    props.template?.status ||
    (props.initialContent && typeof props.initialContent === 'object' && props.initialContent.status) ||
    ''
  ).trim().toLowerCase();
  const effectiveIsDraft = isEffectiveRevise ? false : Boolean(
    isDraft === true ||
    props.isDraft === true ||
    itemStatus === 'draft' ||
    itemStatus === 'archive_draft'
  );

  // Router logic - determines which mode component to render
  switch (mode) {
    case 'create':
      return <CreateComments isDraft={effectiveIsDraft} isRevise={isEffectiveRevise} {...props} />;
      
    case 'preview':
      return <PreviewComments isDraft={effectiveIsDraft} isRevise={isEffectiveRevise} {...props} />;
      
    case 'review':
      return <ReviewComments isDraft={effectiveIsDraft} isRevise={isEffectiveRevise} {...props} />;
      
    default:
      console.warn(`[UnifiedCommentSystem] Unknown mode: ${mode}, defaulting to preview`);
      return <PreviewComments isDraft={effectiveIsDraft} isRevise={isEffectiveRevise} {...props} />;
  }
};

export default UnifiedCommentSystem;
