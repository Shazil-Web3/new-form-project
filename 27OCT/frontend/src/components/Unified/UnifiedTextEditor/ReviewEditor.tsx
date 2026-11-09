/**
 * ReviewEditor - Review Mode Component
 * 
 * This component is used when reviewing templates (approvers reviewing).
 * Features:
 * - Editable editor (for making suggestions)
 * - Toolbar enabled
 * - TOC enabled
 * - Comment system enabled (UnifiedCommentSystem with mode="review")
 * - Socket.io enabled for real-time collaboration
 * - Approval actions available
 * 
 * Uses EditorCore for all shared logic (pagination, DOM manipulation, etc.)
 */

import React, { useEffect, useRef } from 'react';
import { useTemplateSocket } from '../hooks/useTemplateSocket';
import './styles/ReviewEditor.css';

// Import EditorCore - complete TemplateEditor.js with ALL DOM manipulation
import EditorCore from './EditorCore';
// Import UnifiedCommentSystem - will use CommentCore
import UnifiedCommentSystem from '../UnifiedCommentSystem';

const ReviewEditor = ({
  user,
  initialContent,
  onContentChange,
  templateId,
  documentId,
  socketEnabled = true,
  comments = [],
  suggestions = [],
  references = [],
  showToolbar = true,
  showTOC = true,
  showPreviousComments = true,
  isDocument = false,
  onCommentsChange,
  onSuggestionsChange,
  onReferencesChange,
  ...props
}) => {
  console.log('[ReviewEditor] Rendering in review mode', { templateId, socketEnabled });
  
  const pagesContainerRef = useRef(null);

  
  // Socket.io for real-time collaboration (if enabled)
  const socketCallbacks = socketEnabled ? {
    onContentUpdate: (data) => {
      console.log('[ReviewEditor] Content updated from socket:', data);
      onContentChange?.(data.content);
    },
    onCommentAdded: (data) => {
      console.log('[ReviewEditor] Comment added from socket:', data);
      // TODO: Update local comments state
    },
    onSuggestionAdded: (data) => {
      console.log('[ReviewEditor] Suggestion added from socket:', data);
      // TODO: Update local suggestions state
    },
  } : {};
  
  const { emitContentChange, emitCommentAdded, emitSuggestionAdded } = 
    useTemplateSocket(socketEnabled ? templateId : null, 'review', socketCallbacks);
  
  // Ref to store toggleBlockLock function from EditorCore
  const toggleBlockLockRef = useRef(null);

  // EditorCore has ALL DOM manipulation preserved from TemplateEditor.js
  
  // Handler for content changes from EditorCore (including undo/redo snapshots)
  const handleEditorChange = (changeData) => {
    if (changeData?.isUndoRedo) {
      const receivedComments = changeData?.comments || [];
      const receivedSuggestions = changeData?.suggestions || [];
      const receivedReferences = changeData?.references || [];

      // Propagate restored collections up to parent hooks only on undo/redo
      onCommentsChange?.(receivedComments);
      onSuggestionsChange?.(receivedSuggestions);
      onReferencesChange?.(receivedReferences);
    }

    if (onContentChange) {
      onContentChange(changeData);
    }

    const htmlContent = changeData?.htmlContent || changeData?.content || '';

    if (socketEnabled) {
      emitContentChange({
        content: htmlContent,
        headerHTML: changeData?.headerHTML || '',
        footerHTML: changeData?.footerHTML || ''
      });
    }
  };

  // Handler for comment system changes
  const handleCommentSystemChange = (data) => {
    let newComments = comments;
    let newSuggestions = suggestions;
    let newReferences = references;

    if (data.allElements) {
      newComments = data.allElements.filter(el => el.type === 'comment');
      newSuggestions = data.allElements.filter(el => el.type === 'suggestededit');
      newReferences = data.allElements.filter(el => el.type === 'reference');

      onCommentsChange?.(newComments);
      onSuggestionsChange?.(newSuggestions);
      onReferencesChange?.(newReferences);
    }

    const allPageContents = pagesContainerRef.current?.querySelectorAll('.page-content');
    let freshHtml = '';
    if (allPageContents && allPageContents.length > 0) {
      const seenBlockIds = new Set();
      const blockHtmlParts = [];

      allPageContents.forEach(pc => {
        const blocks = pc.querySelectorAll('[data-block-id]');
        blocks.forEach(block => {
          const blockId = block.getAttribute('data-block-id');

          let parent = block.parentElement;
          let isNested = false;
          while (parent && parent !== pc) {
            if (parent.hasAttribute('data-block-id')) {
              isNested = true;
              break;
            }
            parent = parent.parentElement;
          }

          if (!isNested && !seenBlockIds.has(blockId)) {
            seenBlockIds.add(blockId);
            blockHtmlParts.push(block.outerHTML);
          }
        });
      });

      freshHtml = blockHtmlParts.join('');
    } else {
      freshHtml = (initialContent && typeof initialContent === 'object' && initialContent.content) || initialContent || '';
    }

    if (onContentChange) {
      onContentChange({
        content: freshHtml,
        comments: newComments,
        suggestions: newSuggestions,
        references: newReferences,
        headerHTML: props.headerHTML !== undefined ? props.headerHTML : (initialContent?.headerHTML || ''),
        footerHTML: props.footerHTML !== undefined ? props.footerHTML : (initialContent?.footerHTML || ''),
        logo: props.logo ?? initialContent?.logo ?? null,
        logoText: props.logoText !== undefined ? props.logoText : (initialContent?.logoText || ''),
        logoTextRight: props.logoTextRight !== undefined ? props.logoTextRight : (initialContent?.logoTextRight || ''),
        orientation: props.orientation || initialContent?.orientation || 'portrait',
        paperSize: props.paperSize || initialContent?.paperSize || 'A4',
        pagesState: props.pagesState || initialContent?.pagesState || null,
        source: 'comment-system'
      });
    }
  };

  return (
    <div className="review-editor-wrapper">
      <EditorCore
        user={user}
        currentUser={user} // Pass user as currentUser
        userRole={props.userRole} // Pass userRole
        isReviewMode={true}
        mode="review"
        initialContent={initialContent}
        pagesContainerRef={pagesContainerRef}
        logo={props.logo}
        setLogo={props.setLogo}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onContentChange={handleEditorChange}
        isDocument={isDocument}
        templateId={templateId}
        documentId={documentId || props.documentId || props.document_id}
        onToggleLockReady={(toggleFn) => {
          toggleBlockLockRef.current = toggleFn;
        }}
        {...props}
      />
      
      {/* UnifiedCommentSystem in review mode with approval actions */}
      <UnifiedCommentSystem
        mode="review"
        user={user}
        userRole={props.userRole || user?.role}
        templateId={templateId}
        pagesContainerRef={pagesContainerRef}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onCommentsChange={onCommentsChange}
        onSuggestionsChange={onSuggestionsChange}
        onReferencesChange={onReferencesChange}
        onContentChange={handleCommentSystemChange}
        onCommentAdd={(comment) => {
          if (socketEnabled) {
            emitCommentAdded(comment);
          }
        }}
        onSuggestionAdd={(suggestion) => {
          if (socketEnabled) {
            emitSuggestionAdded(suggestion);
          }
        }}
        templateApprovers={props.templateApprovers}
        reviewers={props.reviewers}
        showApprovalActions={true}
        handleMakeEditable={(savedRange) => {
          if (toggleBlockLockRef.current) {
            toggleBlockLockRef.current(savedRange);
          }
        }}
      />
    </div>
  );
};

export default ReviewEditor;
