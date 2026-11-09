/**
 * CreateComments - Create Mode Comments Component
 * 
 * Provides comment/suggestion/lock functionality during template creation.
 * Features:
 * - Floating toolbar on text selection (Comment/Suggestion/Lock buttons)
 * - Right rail for viewing comments/suggestions
 * - Internal notes during creation
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import './styles/CreateComments.css';
import './styles/CommentCore.css';

// Import CommentCore - complete comment system logic
import { CommentCoreComponent as CommentCore, useCommentCore } from './CommentCore';

const CreateComments = ({
  user,
  pagesContainerRef,
  onContentChange,
  showFloatingElements = true, // Enable floating toolbar in create mode
  isDraft = false,
  isRevise = false,
  hideLockInFloatingToolbar = false,
  ...props
}) => {
  // Rendering in create mode with floating toolbar
  
  // Track mounting to handle ref availability for Portal
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveIsDraft = isRevise ? false : isDraft;

  // CommentCore returns an object with FloatingToolbar and RightRail components
  const commentSystem = useCommentCore({
    user,
    pagesContainerRef,
    onContentChange,
    showFloatingElements,
    enableReplies: false, // Disable reply system in creation mode
    disableAcceptReject: true, // Disable accept/reject actions during template creation
    isDraft: effectiveIsDraft,
    isRevise,
    hideLockInFloatingToolbar,
    hideSuggestInFloatingToolbar: true, // Hide suggest-edit button in create template/document mode
    ...props
  });
  
  const { FloatingToolbar, RightRail, ReferencePreview } = commentSystem;

  // Portal the FloatingToolbar into the scroll container (pagesContainerRef)
  // This ensures checking scrollTop in CommentCore logic aligns with the container's scroll
  const renderToolbar = () => {
    if (isMounted && pagesContainerRef && pagesContainerRef.current) {
      return (
        <>
          {ReactDOM.createPortal(
            <FloatingToolbar system={commentSystem} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
          {ReactDOM.createPortal(
            <ReferencePreview system={commentSystem} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
        </>
      );
    }
    return null;
  };

  const renderStrikePopup = () => {
    if (isMounted && pagesContainerRef && pagesContainerRef.current && commentSystem.StrikePopup) {
      return ReactDOM.createPortal(
        <commentSystem.StrikePopup system={commentSystem} />,
        pagesContainerRef.current.parentElement || pagesContainerRef.current
      );
    }
    return null;
  };
  
  // Render the floating toolbar (via portal) and right rail
  return (
    <div className="create-comments-wrapper">
      {renderToolbar()}
      {renderStrikePopup()}
      <RightRail system={commentSystem} />
    </div>
  );
};

export default CreateComments;
