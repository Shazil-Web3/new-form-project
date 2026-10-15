/**
 * CreateEditor - Create Mode Component
 * 
 * This component is used when creating new templates.
 * Features:
 * - Full editing capabilities
 * - Toolbar enabled
 * - TOC (Table of Contents) enabled
 * - Comment/Suggestion/Lock floating toolbar
 * - NO Socket.io (no real-time collaboration during creation)
 * 
 * Uses EditorCore for all shared logic (pagination, DOM manipulation, etc.)
 */

import React, { useRef } from 'react';
import './styles/CreateEditor.css';
import { useTemplateSocket } from '../hooks/useTemplateSocket';

// Import EditorCore - this is the complete TemplateEditor.js with ALL DOM manipulation
import EditorCore from './EditorCore';
import UnifiedCommentSystem from '../UnifiedCommentSystem';

const CreateEditor = ({
  user,
  initialContent,
  templateId,
  documentId,
  documentTitle,
  socketEnabled = true,
  onContentChange,
  showToolbar = true,
  showTOC = true,
  paperSize = 'A4',
  orientation = 'portrait',
  isDocument = false,
  isDraft = false,
  ...props
}) => {
  // Ref to the pages container (will be set by EditorCore)
  const pagesContainerRef = useRef(null);

  // EditorCore is the complete TemplateEditor component with:
  // - ALL DOM manipulation for pagination
  // - DocumentEngine integration
  // - Content change handlers
  // - Keyboard/paste event handling
  // - Logo/header/footer management
  // Everything is preserved from the original TemplateEditor.js

  // State for content and comments
  // State for content and comments
  const [content, setContent] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'content' in initialContent) {
      return initialContent.content || '';
    }
    return initialContent || '';
  });
  const [comments, setComments] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'comments' in initialContent) {
      return initialContent.comments || [];
    }
    return props.comments || [];
  });
  const [suggestions, setSuggestions] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'suggestions' in initialContent) {
      return initialContent.suggestions || [];
    }
    return props.suggestions || [];
  });
  const [references, setReferences] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'references' in initialContent) {
      return initialContent.references || [];
    }
    return props.references || [];
  });
  const [headerHTML, setHeaderHTML] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'headerHTML' in initialContent) {
      return initialContent.headerHTML || '';
    }
    return '';
  });
  const [footerHTML, setFooterHTML] = React.useState(() => {
    if (initialContent && typeof initialContent === 'object' && 'footerHTML' in initialContent) {
      return initialContent.footerHTML || '';
    }
    return '';
  });

  const commentsRef = React.useRef(comments);
  const suggestionsRef = React.useRef(suggestions);
  const referencesRef = React.useRef(references);

  React.useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  React.useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  React.useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  // FIX: Sync content/comments/suggestions when initialContent changes (e.g., when draft loads after mount)
  React.useEffect(() => {
    if (initialContent && typeof initialContent === 'object') {
      if ('content' in initialContent && initialContent.content) {
        setContent(initialContent.content);
      }
      if ('comments' in initialContent && Array.isArray(initialContent.comments)) {
        setComments(initialContent.comments);
        commentsRef.current = initialContent.comments;
      }
      if (initialContent.suggestions && Array.isArray(initialContent.suggestions)) {
        setSuggestions(initialContent.suggestions);
        suggestionsRef.current = initialContent.suggestions;
      }
      if (initialContent.references && Array.isArray(initialContent.references)) {
        setReferences(initialContent.references);
        referencesRef.current = initialContent.references;
      }
      if (initialContent.headerHTML !== undefined) {
        setHeaderHTML(initialContent.headerHTML);
      }
      if (initialContent.footerHTML !== undefined) {
        setFooterHTML(initialContent.footerHTML);
      }
    }
  }, [initialContent]);

  // Ref to store toggleBlockLock function from EditorCore
  const toggleBlockLockRef = React.useRef(null);

  // Socket.io for real-time sync (if enabled)
  const socketCallbacks = React.useMemo(() => (socketEnabled ? {
    onContentUpdate: (data) => {
      // Optional: Update local content if another user edits
      // setContent(data.content); 
    },
    onCommentAdded: (data) => {
      setComments(prev => [...prev, data]);
    },
    onSuggestionAdded: (data) => {
      setSuggestions(prev => [...prev, data]);
    },
  } : {}), [socketEnabled]);

  const {
    emitContentChange,
    emitCommentAdded,
    emitSuggestionAdded,
    emitCommentDeleted,
    emitSuggestionDeleted
  } = useTemplateSocket(socketEnabled ? templateId : null, 'create', socketCallbacks);

  // Handler for content changes from EditorCore
  const handleEditorChange = (changeData) => {
    // Extract the HTML content (EditorCore emits htmlContent for clean HTML, and sometimes content for blocks JSON)
    const htmlContent = changeData?.htmlContent || changeData?.content || '';
    setContent(htmlContent);

    if (changeData?.headerHTML !== undefined) setHeaderHTML(changeData.headerHTML);
    if (changeData?.footerHTML !== undefined) setFooterHTML(changeData.footerHTML);

    const currentComments = commentsRef.current || [];
    const currentSuggestions = suggestionsRef.current || [];
    const currentReferences = referencesRef.current || [];

    const dataToSend = {
      ...changeData,
      content: htmlContent,
      comments: currentComments,
      suggestions: currentSuggestions,
      references: currentReferences,
      headerHTML: changeData?.headerHTML || '',
      footerHTML: changeData?.footerHTML || '',
      logo: changeData?.logo || null,
      orientation: changeData?.orientation || orientation || 'portrait',
      paperSize: changeData?.paperSize || paperSize || 'A4',
      pagesState: changeData?.pagesState || null,
      source: 'editor'
    };

    // Propagate up to parent (CreateTemplate) with full structure
    if (onContentChange) {
      onContentChange(dataToSend);
    }

    if (socketEnabled) {
      emitContentChange({
        content: htmlContent,
        headerHTML: changeData?.headerHTML || headerHTML,
        footerHTML: changeData?.footerHTML || footerHTML
      });
    }
  };

  const handleReferencesChange = (updatedReferences) => {
    setReferences(updatedReferences);
    if (onContentChange) {
      onContentChange({
        content: content || '',
        comments,
        suggestions,
        references: updatedReferences,
        headerHTML,
        footerHTML,
        logo: props.logo ?? null,
        logoText: props.logoText ?? props.logo?.logoText ?? '',
        logoTextRight: props.logoTextRight ?? props.logo?.logoTextRight ?? '',
        orientation,
        paperSize,
        source: 'comment-system'
      });
    }
  };

  // Handler for comment system changes
  const handleCommentSystemChange = (data) => {

    // CommentCore sends { action, element, allElements, ... }
    // We need to parse allElements to separate comments and suggestions

    let newComments = comments;
    let newSuggestions = suggestions;
    let newReferences = references;

    if (data.allElements) {
      // If we have the full list, use it directly (safer)
      newComments = data.allElements.filter(el => el.type === 'comment');
      newSuggestions = data.allElements.filter(el => el.type === 'suggestededit');
      newReferences = data.allElements.filter(el => el.type === 'reference');

      setComments(newComments);
      setSuggestions(newSuggestions);
      setReferences(newReferences);
    }
    // Fallback to incremental updates if needed (legacy behavior)
    else if (data.action === 'add') {
      if (data.element.type === 'comment') {
        newComments = [...comments, data.element];
        setComments(newComments);
        if (socketEnabled) emitCommentAdded(data.element);
      } else if (data.element.type === 'suggestededit') {
        newSuggestions = [...suggestions, data.element];
        setSuggestions(newSuggestions);
        if (socketEnabled) emitSuggestionAdded(data.element);
      } else if (data.element.type === 'reference') {
        newReferences = [...references, data.element];
        setReferences(newReferences);
      }
    } else if (data.action === 'delete') {
      if (data.type === 'comment') {
        newComments = comments.filter(c => c.id !== data.id);
        setComments(newComments);
        if (socketEnabled) emitCommentDeleted(data.id);
      } else if (data.type === 'suggestededit') {
        newSuggestions = suggestions.filter(s => s.id !== data.id);
        setSuggestions(newSuggestions);
        if (socketEnabled) emitSuggestionDeleted(data.id);
      } else if (data.type === 'reference') {
        newReferences = references.filter(r => r.id !== data.id);
        setReferences(newReferences);
      }
    }

    // CRITICAL FIX: Collect HTML from ALL pages, but DEDUPLICATE blocks.
    // When applyHighlight uses extractContents() for cross-block selections, it can
    // nest <p data-block-id> elements inside <span> inside another <p data-block-id>.
    // Naive innerHTML.join() captures the parent block (with nested children) AND the
    // nested blocks separately, causing text duplication on save/reload.
    // Fix: Only collect TOP-LEVEL blocks (skip any block nested inside another block),
    // and deduplicate by block ID to handle pagination splits.
    const allPageContents = pagesContainerRef.current?.querySelectorAll('.page-content');
    let freshHtml = '';
    if (allPageContents && allPageContents.length > 0) {
      const seenBlockIds = new Set();
      const blockHtmlParts = [];

      allPageContents.forEach(pc => {
        const blocks = pc.querySelectorAll('[data-block-id]');
        blocks.forEach(block => {
          const blockId = block.getAttribute('data-block-id');

          // Skip blocks nested inside other blocks (artifact of extractContents)
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
      freshHtml = content || '';
    }

    // Propagate up to parent with deduplicated content (keep logo in sync with template create flow)
    if (onContentChange) {
      onContentChange({
        content: freshHtml,
        comments: newComments,
        suggestions: newSuggestions,
        references: newReferences,
        headerHTML,
        footerHTML,
        logo: props.logo ?? null,
        logoText: props.logoText ?? props.logo?.logoText ?? '',
        logoTextRight: props.logoTextRight ?? props.logo?.logoTextRight ?? '',
        orientation,
        paperSize,
        source: 'comment-system'
      });
    }
  };

  const isRevise = Boolean(
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
    (initialContent && typeof initialContent === 'object' && initialContent.status) ||
    ''
  ).trim().toLowerCase();
  const isExplicitDraftStatus = itemStatus === 'draft' || itemStatus === 'archive_draft';
  const effectiveIsDraft = isRevise ? false : Boolean(
    isDraft === true ||
    props.isDraft === true ||
    isExplicitDraftStatus
  );

  return (
    <div className="create-editor-wrapper">
      <EditorCore
        user={user}
        currentUser={user} // Pass user as currentUser for role checks
        userRole={props.userRole || user?.role} // Explicitly pass role
        initialContent={initialContent}
        enableTypedUnderlines={false}
        disableStrikeOnDelete={true}
        logo={initialContent?.logo || props.logo}
        setLogo={props.setLogo}
        onContentChange={handleEditorChange}
        pagesContainerRef={pagesContainerRef}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onToggleLockReady={(toggleFn) => {
          toggleBlockLockRef.current = toggleFn;
        }}
        documentTitle={documentTitle}
        isDocument={isDocument}
        templateId={templateId}
        documentId={props.documentId || props.document_id}
        isDraft={effectiveIsDraft}
        isRevise={isRevise}
        {...props}
      />
      <UnifiedCommentSystem
        mode="create"
        user={user}
        userRole={props.userRole || user?.role}
        pagesContainerRef={pagesContainerRef}
        onContentChange={handleCommentSystemChange}
        comments={comments}
        suggestions={suggestions}
        references={references}
        onCommentsChange={setComments}
        onSuggestionsChange={setSuggestions}
        onReferencesChange={handleReferencesChange}
        isDraft={effectiveIsDraft}
        isRevise={isRevise}
        isDocument={isDocument}
        hideLockInFloatingToolbar={props.hideLockInFloatingToolbar || false}
        handleMakeEditable={(savedRange) => {
          if (toggleBlockLockRef.current) {
            toggleBlockLockRef.current(savedRange);
          }
        }}
      />
    </div>
  );
};

export default CreateEditor;
