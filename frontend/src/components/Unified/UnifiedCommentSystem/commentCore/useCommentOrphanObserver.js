import { useEffect, useRef, useCallback } from "react";
import { socket } from "../../../../utils/SocketProvider";

export const useCommentOrphanObserver = ({
  pagesContainerRef,
  setFloatingElements,
  deletedElementIdsRef,
  onContentChange,
  onCommentsChange,
  onSuggestionsChange,
  onReferencesChange,
  docId
}) => {
  // Ref to suppress orphan checks during programmatic DOM changes (pagination, render)
  // FIX: Start as true to prevent race conditions during initial highlight reconstruction
  const suppressOrphanCheckRef = useRef(true);

  // Fallback safety net to ensure orphan checks are eventually enabled even if no comments/suggestions are present
  useEffect(() => {
    const timer = setTimeout(() => {
      suppressOrphanCheckRef.current = false;
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const checkForOrphanedElements = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    // Skip during programmatic DOM changes, undo/redo restoration, or editor pagination
    if (suppressOrphanCheckRef.current || window.isUndoRedoRestoring || window.isPaginatingEditor) return;

    // Safety check: Don't check for orphans if container has no editor blocks yet (initial render in progress)
    if (!container.querySelector('[data-block-id]')) return;

    setFloatingElements(prev => {
      if (!prev || prev.length === 0) return prev;

      const orphanedIds = [];
      const surviving = prev.filter(el => {
        // IMPORTANT: NEVER auto-remove suggestions via the orphan checker.
        if (el.type === 'suggestededit') {
          return true;
        }

        const attr = (el.type === 'reference') ? 'data-reference-id' : 'data-comment-id';
        const exists = container.querySelector(`[${attr}="${el.id}"]`);
        
        // Element is orphaned if it doesn't exist in DOM, or exists but has no text content
        const isOrphaned = !exists || !exists.textContent.trim();
        
        if (isOrphaned) {
          if (exists && !exists.textContent.trim()) {
            try { exists.remove(); } catch {}
          }
          orphanedIds.push({ id: el.id, type: el.type || 'comment' });
          return false;
        }
        return true;
      });

      if (orphanedIds.length > 0) {
        console.log('[CommentCore] Auto-removing orphaned elements:', orphanedIds.map(o => o.id));

        // CRITICAL: Record deleted IDs so they are NEVER re-added from props or reconstruction
        orphanedIds.forEach(({ id }) => deletedElementIdsRef.current.add(id));

        // Notify parent for each removed element (triggers handleCommentsChange in EditorCore)
        setTimeout(() => {
          orphanedIds.forEach(({ id, type }) => {
            if (onContentChange && typeof onContentChange === 'function') {
              onContentChange({
                action: 'remove_element',
                elementType: type,
                elementId: id,
                allElements: surviving
              });
            }

            if (type === 'comment') {
              socket.emit("removeTemplateComment", { templateId: docId, commentId: id });
            } else if (type === 'reference') {
              socket.emit("removeTemplateReference", { templateId: docId, referenceId: id });
            }
          });

          // Trigger instant save callbacks
          const survivingComments = surviving.filter(el => el.type === 'comment');
          const survivingSuggestions = surviving.filter(el => el.type === 'suggestededit');
          const survivingReferences = surviving.filter(el => el.type === 'reference');

          if (onCommentsChange && orphanedIds.some(o => o.type === 'comment')) {
            onCommentsChange(survivingComments);
          }
          if (onSuggestionsChange && orphanedIds.some(o => o.type === 'suggestededit')) {
            onSuggestionsChange(survivingSuggestions);
          }
          if (onReferencesChange && orphanedIds.some(o => o.type === 'reference')) {
            onReferencesChange(survivingReferences);
          }

          if (pagesContainerRef.current) {
            const updatedContent = pagesContainerRef.current.innerHTML;
            socket.emit("textChange", { docId: docId, content: updatedContent });
          }
        }, 0);

        return surviving;
      }

      return prev; // No change
    });
  }, [pagesContainerRef, onContentChange, onCommentsChange, onSuggestionsChange, onReferencesChange, docId, deletedElementIdsRef, setFloatingElements]);

  // MutationObserver that triggers orphan detection on DOM changes
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
      if (window.isResizingTable) return;
      
      // Trigger on childList changes (node removals) or characterData changes (text deletes)
      const relevant = mutations.some(m => 
        m.type === 'childList' || 
        m.type === 'characterData'
      );
      if (!relevant) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkForOrphanedElements();
      }, 100);
    });

    observer.observe(container, { childList: true, characterData: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pagesContainerRef, checkForOrphanedElements]);

  return {
    suppressOrphanCheckRef,
    checkForOrphanedElements
  };
};
