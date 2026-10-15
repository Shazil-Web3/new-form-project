import { useCallback } from "react";
import { socket } from "../../../../utils/SocketProvider";
import { recreateRangeFromBlockOffsets } from "./RangeBlockHelpers";

export const useElementCreation = ({
  user,
  userRole,
  docId,
  effectiveIsDraft,
  pagesContainerRef,
  triggerBeforeAction,
  processedPropsElementIdsRef,
  sessionCreatedIds,
  freshlyResolvedIdsRef,
  selectedRangeRef,
  selectedRangeOffsetsRef,
  floatingElementsRef,
  setFloatingElements,
  onContentChange,
  onCommentsChange,
  onSuggestionsChange,
  onReferencesChange,
  references,
  getUserDisplayName,
  applyHighlight,
  storeSelectedRange,
  getPageFromSelection,
  getRangeBlockOffsets,
  setCommentPosition,
  setIsCommenting,
  setShowFloatingButton,
  setActiveRailTab,
  setCommentText,
  setSuggestEditPosition,
  setIsSuggestingEdit,
  setSuggestEditText,
  commentText,
  commentPosition,
  suggestEditText,
  suggestEditPosition,
  deleteFloatingElement
}) => {
  // Add a new floating element
  const addFloatingElement = useCallback((type, userData, text, position) => {
    triggerBeforeAction();
    if (!text.trim() || !position) return;

    const newId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // CRITICAL: Mark this ID as processed IMMEDIATELY to prevent duplication
    // when parent updates props after save
    processedPropsElementIdsRef.current.add(newId);
    sessionCreatedIds.current.add(String(newId));

    const userDisplayName = getUserDisplayName(userData);
    const newElement = {
      id: newId,
      user: userDisplayName,
      author: userDisplayName,
      email: userData?.email ?? null,
      userId: userData?.id ?? null,
      userEmail: userData?.email ?? null,
      creatorRole: userRole || userData?.role || '',
      text,
      timestamp: new Date().toISOString(),
      highlightedText: position.selectedText ?? '',
      selectedText: position.selectedText ?? '',
      avatar: userData?.avatar ?? null,
      replies: [],
      type: type === 'suggestededit' ? 'suggestededit' :
        type === 'reference' ? 'reference' : 'comment',
      createdInDraft: Boolean(effectiveIsDraft),
      origin: effectiveIsDraft ? 'draft' : 'review',
      stage: effectiveIsDraft ? 'draft' : 'review',
      // For references, add specific fields expected by referenceUtils
      ...(type === 'reference' && {
        refAnchor: newId,
        refText: text,
        refContent: '',
        refNumber: references.length + 1 // Start from 1 and use current length
      }),
      position: {
        ...(position || {}),
        offsets: selectedRangeOffsetsRef.current || position?.offsets || null,
      },
      status: type === "comment" ? "open" :
        type === "reference" ? "active" : "pending",
      fragmentId: `fragment-${newId}`,
    };

    // Recreate selection Range dynamically if DOM re-pagination happened while composing the comment
    let activeRange = selectedRangeRef.current;
    if (selectedRangeOffsetsRef.current && pagesContainerRef.current) {
      const recreated = recreateRangeFromBlockOffsets(pagesContainerRef.current, selectedRangeOffsetsRef.current);
      if (recreated) {
        activeRange = recreated;
      }
    }

    // APPLY HIGHLIGHT FIRST so that it is present in the DOM before any state changes trigger parent queries
    if (activeRange) {
      applyHighlight(
        activeRange,
        newId,
        type,
        text,
        type === "comment" ? "open" : "pending",
        {
          origin: effectiveIsDraft ? 'draft' : 'review',
          stage: effectiveIsDraft ? 'draft' : 'review',
          createdInDraft: Boolean(effectiveIsDraft)
        }
      );
      selectedRangeRef.current = null;
      selectedRangeOffsetsRef.current = null;
    }

    // Use functional update and notify parent with the latest array to avoid stale closures
    setFloatingElements((prev) => {
      if (prev.some(item => item.id === newId)) return prev;
      const updated = [...prev, newElement];

      // Emit to socket for real-time collaboration
      socket.emit("addDocElements", { docId: docId, [type]: newElement });

      // Notify parent with the current snapshot
      if (onContentChange && typeof onContentChange === 'function') {
        onContentChange({
          action: 'add_element',
          elementType: type,
          element: newElement,
          allElements: updated
        });
      }

      // NEW: Notify parent with separated comments and suggestions for instant save
      const updatedComments = updated.filter(el => el.type === 'comment');
      const updatedSuggestions = updated.filter(el => el.type === 'suggestededit');
      const updatedReferences = updated.filter(el => el.type === 'reference');

      if (type === 'comment' && onCommentsChange) {
        setTimeout(() => onCommentsChange(updatedComments), 0);
      } else if (type === 'suggestededit' && onSuggestionsChange) {
        setTimeout(() => onSuggestionsChange(updatedSuggestions), 0);
      } else if (type === 'reference' && onReferencesChange) {
        setTimeout(() => onReferencesChange(updatedReferences), 0);
      }

      return updated;
    });
  }, [triggerBeforeAction, processedPropsElementIdsRef, sessionCreatedIds, getUserDisplayName, userRole, references, selectedRangeOffsetsRef, selectedRangeRef, pagesContainerRef, applyHighlight, setFloatingElements, docId, onContentChange, onCommentsChange, onSuggestionsChange, onReferencesChange]);

  // Handle adding comments
  const handleAddComment = useCallback(() => {
    let hasStored = storeSelectedRange();
    if (!hasStored) {
      const container = pagesContainerRef.current;
      if (container) {
        const blocks = Array.from(container.querySelectorAll('[data-block-id]'));
        const activeBlock = blocks.find(b => b.textContent.trim().length > 0) || blocks[0];
        if (activeBlock) {
          const sel = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(activeBlock);
          sel.removeAllRanges();
          sel.addRange(r);
          hasStored = storeSelectedRange();
        }
      }
    }
    if (!hasStored) return;

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText.trim()) return;

    const rect = range.getBoundingClientRect();
    const editorRect = pagesContainerRef.current?.getBoundingClientRect();

    if (!editorRect || !pagesContainerRef.current) return;

    const pageEl = getPageFromSelection();
    const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page'));
    const pageIndex = pages.indexOf(pageEl);

    const startBlock = range.startContainer.nodeType === Node.TEXT_NODE 
      ? range.startContainer.parentElement?.closest('[data-block-id]') 
      : range.startContainer?.closest('[data-block-id]');
    const blockId = startBlock ? startBlock.getAttribute('data-block-id') : null;

    const offsets = selectedRangeOffsetsRef.current || getRangeBlockOffsets(range);

    setCommentPosition({
      selectedText,
      top: rect.top - editorRect.top + pagesContainerRef.current.scrollTop,
      left: rect.left - editorRect.left + pagesContainerRef.current.scrollLeft,
      pageIndex: pageIndex >= 0 ? pageIndex : 0,
      blockId,
      offsets,
    });
    setIsCommenting(true);
    setShowFloatingButton(false);
    setActiveRailTab("comments");
    setCommentText("");
  }, [storeSelectedRange, pagesContainerRef, getPageFromSelection, selectedRangeOffsetsRef, getRangeBlockOffsets, setCommentPosition, setIsCommenting, setShowFloatingButton, setActiveRailTab, setCommentText]);

  // Handle adding suggested edits
  const handleAddSuggestEdit = useCallback(() => {
    if (effectiveIsDraft) return;
    let hasStored = storeSelectedRange();
    if (!hasStored) {
      const container = pagesContainerRef.current;
      if (container) {
        const blocks = Array.from(container.querySelectorAll('[data-block-id]'));
        const activeBlock = blocks.find(b => b.textContent.trim().length > 0) || blocks[0];
        if (activeBlock) {
          const sel = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(activeBlock);
          sel.removeAllRanges();
          sel.addRange(r);
          hasStored = storeSelectedRange();
        }
      }
    }
    if (!hasStored) return;

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText.trim()) return;

    const rect = range.getBoundingClientRect();
    const editorRect = pagesContainerRef.current?.getBoundingClientRect();

    if (!editorRect || !pagesContainerRef.current) return;

    const pageEl = getPageFromSelection();
    const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page'));
    const pageIndex = pages.indexOf(pageEl);

    const startBlock = range.startContainer.nodeType === Node.TEXT_NODE 
      ? range.startContainer.parentElement?.closest('[data-block-id]') 
      : range.startContainer?.closest('[data-block-id]');
    const blockId = startBlock ? startBlock.getAttribute('data-block-id') : null;
    const offsets = selectedRangeOffsetsRef.current || getRangeBlockOffsets(range);

    setSuggestEditPosition({
      selectedText,
      top: rect.top - editorRect.top + pagesContainerRef.current.scrollTop,
      left: rect.left - editorRect.left + pagesContainerRef.current.scrollLeft,
      pageIndex: pageIndex >= 0 ? pageIndex : 0,
      blockId,
      offsets,
    });
    setIsSuggestingEdit(true);
    setShowFloatingButton(false);
    setActiveRailTab("changes");
    setSuggestEditText("");
  }, [effectiveIsDraft, storeSelectedRange, pagesContainerRef, getPageFromSelection, selectedRangeOffsetsRef, getRangeBlockOffsets, setSuggestEditPosition, setIsSuggestingEdit, setShowFloatingButton, setActiveRailTab, setSuggestEditText]);

  // Handle adding references
  const handleAddReference = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const container = pagesContainerRef.current;
    if (container) {
      const refSpans = Array.from(
        container.querySelectorAll('.reference-citation-wrapper')
      ).filter((span) => {
        try {
          return range.intersectsNode(span);
        } catch {
          return false;
        }
      });

      if (refSpans.length > 0) {
        refSpans.forEach(span => {
          const refId = span.getAttribute('data-reference-id');
          if (refId) deleteFloatingElement(refId, 'reference');
        });
        setShowFloatingButton(false);
        return;
      }
    }

    if (!storeSelectedRange()) return;

    const selectedText = range.toString();
    if (!selectedText.trim()) return;

    const rect = range.getBoundingClientRect();
    const editorRect = pagesContainerRef.current?.getBoundingClientRect();

    if (!editorRect || !pagesContainerRef.current) return;

    const pageEl = getPageFromSelection();
    const pages = Array.from(pagesContainerRef.current.querySelectorAll('.page'));
    const pageIndex = pages.indexOf(pageEl);

    const startBlock = range.startContainer.nodeType === Node.TEXT_NODE 
      ? range.startContainer.parentElement?.closest('[data-block-id]') 
      : range.startContainer?.closest('[data-block-id]');
    const blockId = startBlock ? startBlock.getAttribute('data-block-id') : null;

    const position = {
      selectedText,
      top: rect.top - editorRect.top + pagesContainerRef.current.scrollTop,
      left: rect.left - editorRect.left + pagesContainerRef.current.scrollLeft,
      pageIndex: pageIndex >= 0 ? pageIndex : 0,
      blockId,
    };

    addFloatingElement("reference", user, selectedText, position);
    setShowFloatingButton(false);
  }, [pagesContainerRef, storeSelectedRange, getPageFromSelection, addFloatingElement, user, setShowFloatingButton, deleteFloatingElement]);

  // Submit comment
  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim() || !commentPosition) return;

    addFloatingElement("comment", user, commentText, commentPosition);
    setCommentPosition(null);
    setIsCommenting(false);
    setCommentText("");
  }, [commentText, commentPosition, addFloatingElement, user, setCommentPosition, setIsCommenting, setCommentText]);

  // Submit suggested edit
  const handleSubmitSuggestEdit = useCallback(() => {
    if (!suggestEditText.trim() || !suggestEditPosition) return;

    addFloatingElement("suggestededit", user, suggestEditText, suggestEditPosition);
    setSuggestEditPosition(null);
    setIsSuggestingEdit(false);
    setSuggestEditText("");
  }, [suggestEditText, suggestEditPosition, addFloatingElement, user, setSuggestEditPosition, setIsSuggestingEdit, setSuggestEditText]);

  // Cancel floating element creation
  const cancelFloatingElement = useCallback(() => {
    setIsCommenting(false);
    setIsSuggestingEdit(false);
    setCommentText("");
    setSuggestEditText("");
    setCommentPosition(null);
    setSuggestEditPosition(null);
    selectedRangeRef.current = null;
  }, [setIsCommenting, setIsSuggestingEdit, setCommentText, setSuggestEditText, setCommentPosition, setSuggestEditPosition, selectedRangeRef]);

  // Approve suggested edit
  const approveSuggestedEdit = useCallback((id) => {
    triggerBeforeAction();
    freshlyResolvedIdsRef.current.add(id);
    console.log("Approving suggested edit:", id);
    const suggestedEdit = floatingElementsRef.current.find((edit) => edit.id === id);
    if (!suggestedEdit) {
      console.error("Suggested edit not found:", id);
      return;
    }

    const wrapper = document.querySelector(`[data-suggestededit-id="${id}"]`);
    if (!wrapper) {
      console.warn("No visual wrapper found for suggested edit:", id);
    }

    try {
      const { text } = suggestedEdit;

      if (wrapper) {
        const textNode = document.createTextNode(text);
        wrapper.parentNode.replaceChild(textNode, wrapper);
      }

      if (pagesContainerRef.current) {
        const updatedContent = pagesContainerRef.current.innerHTML;
        socket.emit("textChange", { docId: docId, content: updatedContent });
      }

      const root = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
      const remainingWrappers = root?.querySelectorAll(`[data-suggestededit-id="${id}"], [data-suggestion-id="${id}"]`);
      remainingWrappers?.forEach(w => {
        w.setAttribute('data-suggestion-status', 'approved');
        w.classList.add('suggestion-resolved');
      });

      socket.emit("updateSuggestedEditStatus", { docId: docId, suggestededitId: id, status: "approved" });

      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "approved" } : item
        )
      );

      if (onSuggestionsChange) {
        const updatedSuggestions = floatingElementsRef.current
          .filter(el => el.type === 'suggestededit')
          .map(el => el.id === id ? { ...el, status: 'approved' } : el);
        onSuggestionsChange(updatedSuggestions);
      }

      console.log("Successfully approved suggested edit:", id);
    } catch (error) {
      console.error("Error approving suggested edit:", error);
    }
  }, [triggerBeforeAction, freshlyResolvedIdsRef, floatingElementsRef, pagesContainerRef, docId, setFloatingElements, onSuggestionsChange]);

  // Decline suggested edit
  const declineSuggestedEdit = useCallback((id) => {
    triggerBeforeAction();
    freshlyResolvedIdsRef.current.add(id);
    console.log("Declining suggested edit:", id);
    const suggestedEdit = floatingElementsRef.current.find((edit) => edit.id === id);
    if (!suggestedEdit) {
      console.error("Suggested edit not found:", id);
      return;
    }

    const wrapper = document.querySelector(`[data-suggestededit-id="${id}"]`);
    if (!wrapper) {
      console.warn("No visual wrapper found for suggested edit:", id);
    }

    try {
      const { selectedText } = suggestedEdit;

      if (wrapper) {
        const textNode = document.createTextNode(selectedText || wrapper.textContent);
        const del = wrapper.querySelector('del');
        if (del) {
          while (del.firstChild) {
            wrapper.parentNode.insertBefore(del.firstChild, wrapper);
          }
          wrapper.parentNode.removeChild(wrapper);
        } else {
          wrapper.parentNode.replaceChild(textNode, wrapper);
        }
      }

      if (pagesContainerRef.current) {
        const updatedContent = pagesContainerRef.current.innerHTML;
        socket.emit("textChange", { docId: docId, content: updatedContent });
      }

      const root = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
      const remainingWrappers = root?.querySelectorAll(`[data-suggestededit-id="${id}"], [data-suggestion-id="${id}"]`);
      remainingWrappers?.forEach(w => {
        w.setAttribute('data-suggestion-status', 'declined');
        w.classList.add('suggestion-resolved');
      });

      socket.emit("updateSuggestedEditStatus", { docId: docId, suggestededitId: id, status: "declined" });

      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "declined" } : item
        )
      );

      if (onSuggestionsChange) {
        const updatedSuggestions = floatingElementsRef.current
          .filter(el => el.type === 'suggestededit')
          .map(el => el.id === id ? { ...el, status: 'declined' } : el);
        onSuggestionsChange(updatedSuggestions);
      }

      console.log("Successfully declined suggested edit:", id);
    } catch (error) {
      console.error("Error declining suggested edit:", error);
    }
  }, [triggerBeforeAction, freshlyResolvedIdsRef, floatingElementsRef, pagesContainerRef, docId, setFloatingElements, onSuggestionsChange]);

  return {
    addFloatingElement,
    handleAddComment,
    handleAddSuggestEdit,
    handleAddReference,
    handleSubmitComment,
    handleSubmitSuggestEdit,
    cancelFloatingElement,
    approveSuggestedEdit,
    declineSuggestedEdit
  };
};
