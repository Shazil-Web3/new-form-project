/**
 * ReviewComments - Review Mode Comments Component
 * 
 * Full comment and suggestion system for review mode with approval actions.
 * Features:
 * - Floating toolbar for adding comments/suggestions
 * - Right rail showing all comments
* - Approval/rejection actions on comments
 * - Socket.io integration for real-time collaboration
 * - Ability to accept/reject suggestions
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTemplateSocket } from '../hooks/useTemplateSocket';
import './styles/CommentCore.css';
import './styles/ReviewComments.css';

// Import CommentCore - complete CommentEditSystem.js
import { CommentCoreComponent as CommentCore, useCommentCore } from './CommentCore';

const ReviewComments = ({
  user,
  pagesContainerRef,
  templateId,
  socketEnabled = true,
  comments = [],
  suggestions = [],
  onCommentAdd,
  onSuggestionAdd,
  onCommentUpdate,
  onSuggestionUpdate,
  showFloatingToolbar = true,
  showRightRail = true,
  showApprovalActions = true,
  handleMakeEditable,
  isDraft = false,
  isRevise = false,
  ...props
}) => {
  console.log('[ReviewComments] Rendering in review mode', { templateId, socketEnabled });
  
  // Track mounting to handle ref availability for Portal
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveIsDraft = isRevise ? false : isDraft;

  // Socket.io for real-time comment sync
  const socketCallbacks = socketEnabled ? {
    onCommentAdded: (data) => {
      console.log('[ReviewComments] Comment added from socket:', data);
      onCommentAdd?.(data.comment);
    },
    onSuggestionAdded: (data) => {
      console.log('[ReviewComments] Suggestion added from socket:', data);
      onSuggestionAdd?.(data.suggestion);
    },
    onCommentUpdated: (data) => {
      console.log('[ReviewComments] Comment updated from socket:', data);
      onCommentUpdate?.(data.comment);
    },
  } : {};
  
  const { emitCommentAdded, emitSuggestionAdded, emitCommentUpdated } = 
    useTemplateSocket(socketEnabled ? templateId : null, 'review', socketCallbacks);
  
  // Use CommentCore as a hook (same pattern as CreateComments/PreviewComments)
  const system = useCommentCore({
    user,
    pagesContainerRef,
    comments,
    suggestions,
    onContentChange: (change) => {
      console.log('[ReviewComments] Content Change:', change);
      if (change.action === 'add_element') {
        if (change.elementType === 'comment' && onCommentAdd) onCommentAdd(change.element);
        if (change.elementType === 'suggestededit' && onSuggestionAdd) onSuggestionAdd(change.element);
      } else if (change.action === 'remove_element') {
        if (change.elementType === 'comment' && props.onCommentDelete) props.onCommentDelete(change.elementId);
        if (change.elementType === 'suggestededit' && props.onSuggestionDelete) props.onSuggestionDelete(change.elementId);
      }
      if (props.onContentChange && typeof props.onContentChange === 'function') {
        props.onContentChange(change);
      }
    },
    showFloatingElements: showFloatingToolbar,
    handleMakeEditable,
    enableReplies: true, // Enable reply system in review mode
    isDraft: effectiveIsDraft,
    isRevise,
    ...props
  });

  // Portal the FloatingToolbar into the scroll container (pagesContainerRef)
  // This ensures checking scrollTop in CommentCore logic aligns with the container's scroll
  const renderToolbar = () => {
    if (isMounted && showFloatingToolbar && pagesContainerRef && pagesContainerRef.current) {
      return (
        <>
          {ReactDOM.createPortal(
            <system.FloatingToolbar system={system} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
          {ReactDOM.createPortal(
            <system.ReferencePreview system={system} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
        </>
      );
    }
    return null;
  };

  const renderStrikePopup = () => {
    if (isMounted && pagesContainerRef && pagesContainerRef.current) {
      return ReactDOM.createPortal(
        <system.StrikePopup system={system} />,
        pagesContainerRef.current.parentElement || pagesContainerRef.current
      );
    }
    return null;
  };
  
  return (
    <div className="review-comments-wrapper">
      {renderToolbar()}
      {renderStrikePopup()}
      {showRightRail && <system.RightRail system={system} />}
      
      {/* Approval actions UI is handled by ReviewComments.css styling */}
      {showApprovalActions && (
        <div className="approval-actions">
          {/* Approve/Reject buttons are rendered by CommentCore */}
        </div>
      )}
    </div>
  );
};

export default ReviewComments;

