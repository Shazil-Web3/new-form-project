/**
 * PreviewEditor - Preview Mode Component
 * 
 * This component is used when previewing templates (e.g., pending review).
 * Features:
 * - Read-only editor (not editable)
 * - NO toolbar
 * - TOC enabled
 * - Comment system enabled (UnifiedCommentSystem with mode="preview")
 * - Socket.io enabled for real-time updates
 * 
 * Uses EditorCore for all shared logic (pagination, DOM manipulation, etc.)
 */

import React, { useRef } from 'react';
import './styles/PreviewEditor.css';

// Import EditorCore - complete TemplateEditor.js with ALL DOM manipulation
import EditorCore from './EditorCore';
// Import UnifiedCommentSystem - will use CommentCore
import UnifiedCommentSystem from '../UnifiedCommentSystem';

const PreviewEditor = ({
  user,
  currentUser,  // Add currentUser for role checking
  userRole, // Receive userRole
  initialContent,
  logo,
  setLogo,
  onContentChange,
  templateId,
  documentId,
  socketEnabled = true,
  comments = [],
  suggestions = [],
  references = [],
  onCommentsChange, // NEW: Callback for instant save
  onSuggestionsChange, // NEW: Callback for instant save
  onReferencesChange,
  showTOC = true,
  onTyping, // NEW: Callback for active typing detection
  isApprovalState = false, // NEW: Prevent editing and comments
  isDocument = false,
  readOnly = false,
  documentTitle,
  syncTitleToHeader = false,
  lockHeaderEditing = false,
  isDraft = false,
  ...props
}) => {
  // Preview editor in read-only mode
  
  // Use ref from props or create local one
  const localRef = useRef(null);
  const pagesContainerRef = props.pagesContainerRef || localRef;
  
  // Socket.io is handled by parent (TemplatePreview), not here
  // This prevents duplicate socket listeners
  
  // Ref to store toggleBlockLock function from EditorCore
  const toggleBlockLockRef = React.useRef(null);
  
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
        logo: logo ?? initialContent?.logo ?? null,
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
    <div className={`preview-editor-wrapper ${readOnly ? "is-readonly" : ""}`}>
      <EditorCore
        user={user}
        currentUser={currentUser}  // Pass currentUser for role checking
        userRole={userRole}        // Pass userRole explicitly
        initialContent={initialContent}
        pagesContainerRef={pagesContainerRef}
        isPreviewMode={isDraft ? false : true}  // CRITICAL: Disable locked text protection in draft mode so editing/context menus work
        isApprovalState={isApprovalState} // NEW: Enforce read-only
        readOnly={readOnly}
        documentTitle={documentTitle}
        syncTitleToHeader={syncTitleToHeader}
        lockHeaderEditing={lockHeaderEditing || readOnly}
        logo={logo}
        setLogo={setLogo}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onContentChange={handleEditorChange}
        onTyping={onTyping} // Forward NEW prop
        isDocument={isDocument}
        templateId={templateId}
        documentId={documentId || props.documentId || props.document_id}
        enableTypedUnderlines={isDraft ? false : true}
        disableStrikeOnDelete={isDraft ? true : false}
        isDraft={isDraft}
        onToggleLockReady={(toggleFn) => {
          toggleBlockLockRef.current = toggleFn;
        }}
        {...props}
      />
      
      {/* UnifiedCommentSystem in preview mode */}
      <UnifiedCommentSystem
        mode="preview"
        user={user}
        userRole={userRole}
        templateId={templateId}
        pagesContainerRef={pagesContainerRef}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onCommentsChange={onCommentsChange} // NEW: Forward instant save callback
        onSuggestionsChange={onSuggestionsChange} // NEW: Forward instant save callback
        onReferencesChange={onReferencesChange}
        onContentChange={handleCommentSystemChange}
        showFloatingToolbar={!isApprovalState && !readOnly} // NEW: Disable comment icon if in approval state or read-only
        isDraft={isDraft}
        templateApprovers={props.templateApprovers}
        reviewers={props.reviewers}
        hideLockInFloatingToolbar={false}
        handleMakeEditable={(savedRange) => {
          if (toggleBlockLockRef.current) {
            toggleBlockLockRef.current(savedRange);
          }
        }}
        // Parent (TemplatePreview) handles socket emits, not here
      />
    </div>
  );
};

export default PreviewEditor;
