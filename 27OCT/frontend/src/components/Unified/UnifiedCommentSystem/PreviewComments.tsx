import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import './styles/PreviewComments.css';
import './styles/CommentCore.css'; // Ensure core styles are loaded

// Import CommentCore - complete CommentEditSystem.js
import { CommentCoreComponent as CommentCore, useCommentCore } from './CommentCore';

const PreviewComments = ({
  user,
  pagesContainerRef,
  templateId,
  socketEnabled = true,
  comments = [],
  suggestions = [],
  onCommentAdd,
  onSuggestionAdd,
  onCommentsChange, // NEW: Callback for instant save
  onSuggestionsChange, // NEW: Callback for instant save
  showFloatingToolbar = true,
  showRightRail = true,
  handleMakeEditable,
  isDraft = false,
  isRevise = false,
  hideLockInFloatingToolbar = false,
  ...props
}) => {
  // Preview mode comment system
  
  // Track mounting to handle ref availability for Portal
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    console.log('[PreviewComments] Mounted, container ref:', !!pagesContainerRef?.current);
    setIsMounted(true);
  }, []);

  const effectiveIsDraft = isRevise ? false : isDraft;

  // Use CommentCore as a hook
  // We pass minimal socket callbacks because CommentCore handles most native events
  // assuming it has the same logic as CommentEditSystem.js.
  // Actually, CommentCore (legacy) joins the room and sets up listeners itself.
  
  const system = useCommentCore({
    user,
    pagesContainerRef,
    comments,
    suggestions,
    onContentChange: (change) => {
        console.log('[PreviewComments] Content Change:', change);
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
    onCommentsChange, // NEW: Forward instant save callback
    onSuggestionsChange, // NEW: Forward instant save callback
    showFloatingElements: showFloatingToolbar,
    handleMakeEditable,
    isDraft: effectiveIsDraft,
    isRevise,
    hideLockInFloatingToolbar,
    ...props
  });

  const { FloatingToolbar, RightRail, ReferencePreview } = system;

  // Portal the FloatingToolbar into the scroll container (pagesContainerRef)
  // This ensures checking scrollTop in CommentCore logic aligns with the container's scroll
  const renderToolbar = () => {
    if (isMounted && showFloatingToolbar && pagesContainerRef && pagesContainerRef.current) {
      return (
        <>
          {ReactDOM.createPortal(
            <FloatingToolbar system={system} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
          {ReactDOM.createPortal(
            <ReferencePreview system={system} />,
            pagesContainerRef.current.parentElement || pagesContainerRef.current
          )}
        </>
      );
    }
    return null;
  };

  const renderStrikePopup = () => {
    if (isMounted && pagesContainerRef && pagesContainerRef.current && system.StrikePopup) {
      return ReactDOM.createPortal(
        <system.StrikePopup system={system} />,
        pagesContainerRef.current.parentElement || pagesContainerRef.current
      );
    }
    return null;
  };
  
  return (
    <div className="preview-comments-wrapper">
      {renderToolbar()}
      {renderStrikePopup()}
      {showRightRail && <RightRail system={system} />}
    </div>
  );
};

export default PreviewComments;
