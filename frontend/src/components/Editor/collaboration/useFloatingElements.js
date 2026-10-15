import { useState, useEffect, useCallback, useRef } from "react";
import { socket } from "../../../utils/SocketProvider";

const useFloatingElements = (docId, editorRef) => {
  const [floatingElements, setFloatingElements] = useState([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isSuggestingEdit, setIsSuggestingEdit] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [suggestEditText, setSuggestEditText] = useState("");
  const [commentPosition, setCommentPosition] = useState(null);
  const [suggestEditPosition, setSuggestEditPosition] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");
  
  // Use refs to track state and prevent race conditions
  const lastAdjustmentTimeRef = useRef(Date.now());
  const isAdjustingRef = useRef(false);
  const floatingElementsRef = useRef(floatingElements);
  // Add a new ref to track selected ranges
  const selectedRangeRef = useRef(null);

  // Update ref when state changes
  useEffect(() => {
    floatingElementsRef.current = floatingElements;
  }, [floatingElements]);

  // Store the selected range when making a comment or suggestion
  const storeSelectedRange = useCallback(() => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      // Store a clone of the range to use later
      selectedRangeRef.current = selection.getRangeAt(0).cloneRange();
      return true;
    }
    return false;
  }, []);

  // Function to recalculate positions based on text selection
  const realignFloatingItems = useCallback(() => {
    if (!editorRef.current) return;
    
    floatingElementsRef.current.forEach(element => {
      // Find the highlight associated with this element
      const highlightSelector = element.type === "comment" 
        ? `[data-comment-id="${element.id}"]` 
        : `[data-suggestededit-id="${element.id}"]`;
      
      const highlight = document.querySelector(highlightSelector);
      
      if (highlight) {
        // Get the position of the highlighted text
        const rect = highlight.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        
        // Update the element's position to align with the highlight
        if (rect && rect.top !== 0) {
          const newTop = rect.top - editorRect.top + editorRef.current.scrollTop;
          
          // Only update if position has significantly changed
          if (Math.abs(newTop - element.position.top) > 5) {
            // Update the element position in state
            setFloatingElements(prev => 
              prev.map(item => 
                item.id === element.id 
                  ? {...item, position: {...item.position, top: newTop}} 
                  : item
              )
            );
          }
        }
      }
    });
  }, []);

const adjustItemPositions = useCallback(() => {
  // Existing throttle/cooldown logic remains
  const now = Date.now();
  if (isAdjustingRef.current || now - lastAdjustmentTimeRef.current < 100) return;
  isAdjustingRef.current = true;
  lastAdjustmentTimeRef.current = now;

  const editor = document.querySelector(".text-editor");
  if (!editor) {
    isAdjustingRef.current = false;
    return;
  }
  const editorRect = editor.getBoundingClientRect();

  // Get all floating elements
  const elements = Array.from(
    document.querySelectorAll(".floating-comment, .floating-suggestededit")
  );

  // Map elements with their highlight positions and heights
  const elementsWithData = elements.map(element => {
    const type = element.classList.contains("floating-comment") ? "comment" : "suggestededit";
    const id = element.dataset[`${type}Id`];
    const highlight = document.querySelector(`[data-${type}-id="${id}"]`);
    
    let highlightTop = Infinity;
    let highlightHeight = 0;
    if (highlight) {
      const highlightRect = highlight.getBoundingClientRect();
      highlightTop = highlightRect.top - editorRect.top;
      highlightHeight = highlightRect.height;
    }

    return {
      element,
      highlightTop,
      highlightHeight,
      elementHeight: element.offsetHeight
    };
  });

  // Sort by highlight position in the document
  elementsWithData.sort((a, b) => a.highlightTop - b.highlightTop);

  let lastBottom = 0;
  const spacing = 10;

  elementsWithData.forEach(({ element, highlightTop, highlightHeight, elementHeight }) => {
    const maxTop = editorRect.height - elementHeight - spacing;
    
    // Calculate ideal position aligned with highlight
    let desiredTop = highlightTop + highlightHeight;
    
    // Ensure we don't position below existing elements
    let top = Math.max(desiredTop, lastBottom);
    
    // Clamp to editor bounds
    top = Math.min(top, maxTop);
    top = Math.max(top, spacing);  // Prevent sticking to top edge

    // Apply the position
    element.style.top = `${top}px`;
    element.style.transition = "top 0.2s ease-in-out";

    // Update lastBottom for next element
    lastBottom = top + elementHeight + spacing;
  });

  // Existing cleanup
  setTimeout(() => {
    isAdjustingRef.current = false;
  }, 200);
}, []);

  // Clear all highlights
  const clearHighlight = useCallback(() => {
    document.querySelectorAll(".highlighted-active").forEach((el) => 
      el.classList.remove("highlighted-active")
    );
    setActiveItemId(null);
  }, []);

  const handleTextClick = useCallback((event, type) => {
    event.stopPropagation();
    
    const targetElement = event.target.closest(`[data-${type}-id]`);
    if (!targetElement) {
      console.warn("Clicked element does not have a valid ID.");
      return;
    }

    const id = targetElement.dataset[`${type}Id`];
    clearHighlight();
    setActiveItemId(id);

    const floatingElement = document.querySelector(
      `.floating-${type}[data-${type}-id="${id}"]`
    );

    if (floatingElement) {
      floatingElement.classList.add("highlighted-active");
      // Optional smooth scroll
      // floatingElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clearHighlight]);

  // Apply highlights to the document with improved handling
  const applyHighlight = useCallback((range, id, type, text, status) => {
    // Skip if range is invalid
    if (!range || !id) return;
    
    try {
      // Remove existing highlights with the same ID (except comments, to retain highlights)
      if (type !== 'comment') {
        document.querySelectorAll(`[data-${type}-id="${id}"]`).forEach((el) => {
          // Use proper DOM mutation
          const parent = el.parentNode;
          if (parent) {
            // Replace the element with its contents
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        });
      }

      if (status === "deleted") {
        range.deleteContents(); // Remove original text
      }

      // Handle special case for suggested edits
      if (type === "suggestededit" && status === "pending") {
        // For suggested edits, replace the selected text with the suggested text
        const delTag = document.createElement("del"); // Strikeout original text
        delTag.textContent = range.toString(); // Original text

        const insTag = document.createElement("ins"); // Insert suggested text
        insTag.textContent = text;

        range.deleteContents(); // Remove original text
        range.insertNode(delTag); // Insert striked-out original text
        range.insertNode(insTag); // Insert suggested text
      }

      if (type === "suggestededit" && status === "approved") {
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        /* return; // No need to highlight after approval */
      }

      // Create a new span for the highlight
      const span = document.createElement("span");
      span.style.backgroundColor = type === "comment" ? "lightgreen" : "lightblue";
      span.className = "highlighted-text";
      span.dataset[type === "comment" ? "commentId" : "suggestededitId"] = id;
      span.contentEditable = "false"; // Make span uneditable
      
      // Surround the range with our highlight span
      range.surroundContents(span);
      
      // Make sure the editor is updated after highlighting
      if (editorRef.current) {
        const updatedContent = editorRef.current.innerHTML;
        socket.emit("textChange", { docId, content: updatedContent });
      }
    } catch (error) {
      console.warn("Error highlighting text:", error);
    }
  }, [docId]);

    // Event delegation setup
  useEffect(() => {
    const handleClick = (event) => {
      // Check if clicked element is a highlight
      const target = event.target.closest('[data-comment-id], [data-suggestededit-id]');
      if (!target) return;

      // Determine the type from the data attribute
      const type = target.dataset.commentId ? 'comment' : 'suggestededit';
      handleTextClick(event, type);
    };

    if (editorRef.current) {
      editorRef.current.addEventListener('click', handleClick);
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('click', handleClick);
      }
    };
  }, [handleTextClick]);  

  // Improved reconstruct highlights function
  const reconstructHighlight = useCallback((element, type) => {
    if (!element || !element.selectedText || !element.selectedText.trim()) return;
    
    const editor = editorRef.current;
    if (!editor) return;

    // Check if highlight already exists for this element
    const existingHighlight = document.querySelector(
      `[data-${type === "comment" ? "comment-id" : "suggestededit-id"}="${element.id}"]`
    );
    if (existingHighlight) return; // Skip if already highlighted

    const exactText = element.selectedText.trim();
    const textNodes = [];

    function findTextNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node);
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          findTextNodes(node.childNodes[i]);
        }
      }
    }

    const blockId = element.position?.blockId;
    let targetContainer = editor;
    if (blockId) {
      const blockEl = editor.querySelector(`[data-block-id="${blockId}"]`);
      if (blockEl) {
        targetContainer = blockEl;
      }
    }

    findTextNodes(targetContainer);

    // Try to find the exact text match
    for (const node of textNodes) {
      const nodeText = node.textContent;
      const matchIndex = nodeText.indexOf(exactText);
      
      if (matchIndex !== -1) {
        try {
          const range = document.createRange();
          range.setStart(node, matchIndex);
          range.setEnd(node, matchIndex + exactText.length);
          
          applyHighlight(range, element.id, type, element.text, element.status);
          return; // Exit after successful highlight
        } catch (error) {
          console.warn("Error creating range:", error);
        }
      }
    }
    
    // If exact match failed, try a fuzzy match as fallback
    if (exactText.length > 5) {
      const shortExactText = exactText.substring(0, Math.min(exactText.length, 30));
      
      for (const node of textNodes) {
        const nodeText = node.textContent;
        if (nodeText.includes(shortExactText)) {
          try {
            const matchIndex = nodeText.indexOf(shortExactText);
            const range = document.createRange();
            range.setStart(node, matchIndex);
            range.setEnd(node, matchIndex + shortExactText.length);
            
            applyHighlight(range, element.id, type, element.text, element.status);
            return;
          } catch (error) {
            console.warn("Error in fuzzy matching:", error);
          }
        }
      }
    }
  }, [applyHighlight]);

  // Add a new floating element with improved handling
  const addFloatingElement = useCallback((type, user, text, position) => {
    if (!text.trim() || !position) return;

    // Generate a unique ID
    const newId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newElement = {
      id: newId,
      type,
      user,
      selectedText: position.selectedText,
      text,
      position,
      status: type === "comment" ? "open" : "pending",
      replies: [],
    };

    // Update local state
    setFloatingElements((prev) => {
      // Check for duplicates
      if (prev.some(item => item.id === newId)) {
        return prev;
      }
      return [...prev, newElement];
    });

    // Apply highlight immediately if we have a stored range
    if (selectedRangeRef.current) {
      applyHighlight(
        selectedRangeRef.current, 
        newId, 
        type, 
        text, 
        type === "comment" ? "open" : "pending"
      );
      // Clear the stored range
      selectedRangeRef.current = null;
    }

    // Emit to server
    socket.emit("addDocElements", { docId, [type]: newElement });

    // Reset input fields and states
    if (type === "comment") {
      setIsCommenting(false);
      setCommentText("");
    } else {
      setIsSuggestingEdit(false);
      setSuggestEditText("");
    }
  }, [docId, applyHighlight]);

  // Cancel adding a floating element
  const cancelFloatingElement = useCallback((type) => {
    // Clear stored range
    selectedRangeRef.current = null;
    
    if (type === "comment") {
      setIsCommenting(false);
      setCommentText("");
    } else {
      setIsSuggestingEdit(false);
      setSuggestEditText("");
    }
    
    // Run adjustments after canceling
    setTimeout(() => {
      adjustItemPositions();
      realignFloatingItems();
    }, 10);
  }, [adjustItemPositions, realignFloatingItems]);

  const markCommentAsDone = useCallback((id) => {
    socket.emit("updateCommentStatus", { docId, commentId: id, status: "done" });
    
    // Update local state immediately for better UX
    setFloatingElements((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "done" } : item
      )
    );
  }, [docId]);

  const replyComment = useCallback((user, commentId) => {
    if (!replyText.trim()) return;

    const reply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user,
      text: replyText,
    };

    socket.emit("updateCommentReplies", { docId, commentId, reply });

    // Update local state immediately for better UX
    setFloatingElements((prev) =>
      prev.map((item) =>
        item.id === commentId
          ? { ...item, replies: [...item.replies, reply] }
          : item
      )
    );

    setReplyText("");
    setActiveReplyId(null);
  }, [docId, replyText]);

  const approveSuggestedEdit = useCallback((id) => {
    // Find the suggested edit in the state
    const suggestedEdit = floatingElementsRef.current.find((edit) => edit.id === id);
    if (!suggestedEdit) return;

    // Find the highlighted span in the DOM
    const highlightedSpan = document.querySelector(
      `[data-suggestededit-id="${id}"]`
    );
    
    if (!highlightedSpan) return;

    try {
      // Get the selected text and suggested text
      const { text } = suggestedEdit;

      // Replace the contents of the <span> with the suggested text
      highlightedSpan.textContent = text;
      
      // Remove the highlight class but keep the data attribute
      /* highlightedSpan.style.backgroundColor = "transparent"; */

      // Update the document content and emit to the server
      if (editorRef.current) {
        const updatedContent = editorRef.current.innerHTML;
        socket.emit("textChange", { docId, content: updatedContent });
      }

      socket.emit("updateSuggestedEditStatus", { docId, suggestededitId: id, status: "approved" });

      // Update local state immediately for better UX
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "approved" } : item
        )
      );
    } catch (error) {
      console.error("Error approving suggested edit:", error);
    }
  }, [docId]);

  const declineSuggestedEdit = useCallback((id) => {
    // Find the suggested edit in the state
    const suggestedEdit = floatingElementsRef.current.find((edit) => edit.id === id);
    if (!suggestedEdit || !suggestedEdit.text) return;

    // Find the highlighted span in the DOM
    const highlightedSpan = document.querySelector(
      `[data-suggestededit-id="${id}"]`
    );

    if (!highlightedSpan) return;

    try {
      // Get the original text
      const { selectedText } = suggestedEdit;

      // Replace the contents of the <span> with the original text
      highlightedSpan.textContent = selectedText;

      if (editorRef.current) {
        const updatedContent = editorRef.current.innerHTML;
        // Emit the updated document content to the server
        socket.emit("textChange", { docId, content: updatedContent });
      }

      socket.emit("updateSuggestedEditStatus", { docId, suggestededitId: id, status: "declined" });

      // Update local state immediately for better UX
      setFloatingElements((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "declined" } : item
        )
      );
    } catch (error) {
      console.error("Error declining suggested edit:", error);
    }
  }, [docId]);

  const replySuggestedEdit = useCallback((user, suggestededitId) => {
    if (!replyText.trim()) return;

    const reply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user,
      text: replyText,
    };

    socket.emit("updateSuggestedEditReplies", { docId, suggestededitId, reply });

    // Update local state immediately for better UX
    setFloatingElements((prev) =>
      prev.map((item) =>
        item.id === suggestededitId
          ? { ...item, replies: [...item.replies, reply] }
          : item
      )
    );

    setReplyText("");
    setActiveReplyId(null);
  }, [docId, replyText]);

  // Handle clicking on a floating element
  const handleFloatingElementClick = useCallback((id, type) => {
    clearHighlight();
    setActiveItemId(id);
    
    const highlightElement = document.querySelector(`[data-${type}-id="${id}"]`);
    if (highlightElement) {
      highlightElement.classList.add("highlighted-active");
      
      // Scroll element into view if needed
      const editorContainer = document.querySelector(".editor-container");
      if (editorContainer) {
        const elementRect = highlightElement.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();
        
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
          highlightElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, []);

const deleteFloatingElement = useCallback((elementId, elementType) => {
  // Handle suggested edits with pending status
  if (elementType === 'suggestededit') {
    const suggestedEdit = floatingElementsRef.current.find(edit => edit.id === elementId);
    
    if (suggestedEdit && suggestedEdit.status === 'pending') {
      // Restore the original text in the editor
      const highlightedSpan = document.querySelector(`[data-suggestededit-id="${elementId}"]`);
      
      if (highlightedSpan && suggestedEdit.selectedText) {
        highlightedSpan.textContent = suggestedEdit.selectedText;
        
        // Create a text node to replace the span
        const textNode = document.createTextNode(suggestedEdit.selectedText);
        highlightedSpan.parentNode.replaceChild(textNode, highlightedSpan);
      }
    }
  }

  // 1. Remove from state
  setFloatingElements(prevElements => 
    prevElements.filter(el => el.id !== elementId)
  );

  // 2. Clean up DOM highlights (general case)
  const selector = elementType === 'comment' 
    ? `[data-comment-id="${elementId}"]`
    : `[data-suggestededit-id="${elementId}"]`;

  const highlights = editorRef.current.querySelectorAll(selector);
  highlights.forEach(highlight => {
    const textContent = highlight.textContent;
    const textNode = document.createTextNode(textContent);
    highlight.parentNode.replaceChild(textNode, highlight);
  });

  // 3. Emit socket event
  const eventType = elementType === 'comment' 
    ? 'removeComment' 
    : 'removeSuggestedEdit';
    
  socket.emit(eventType, { 
    docId,
    [elementType === 'comment' ? 'commentId' : 'suggestededitId']: elementId
  });

  // 4. Trigger position adjustments after DOM changes
  setTimeout(() => {
    adjustItemPositions();
    realignFloatingItems();
  }, 50);

  // Update document content
  if (editorRef.current) {
    const updatedContent = editorRef.current.innerHTML;
    socket.emit("textChange", { docId, content: updatedContent });
  }
}, [docId, adjustItemPositions, realignFloatingItems]);

const handleTextDeletion = useCallback((event) => {
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "Enter") {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const deletionRange = range.cloneRange();
    
    // Extend range based on deletion type
    if (event.key === "Backspace" && !range.collapsed) {
      // Use selection as-is for non-collapsed backspace
    } else if (event.key === "Backspace" && range.collapsed) {
      try {
        deletionRange.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
      } catch (e) {
        console.log("At node boundary, can't extend left");
      }
    } else if (event.key === "Delete" && range.collapsed) {
      try {
        const maxOffset = range.endContainer.nodeType === Node.TEXT_NODE ? 
          range.endContainer.length : range.endContainer.childNodes.length;
        deletionRange.setEnd(range.endContainer, Math.min(maxOffset, range.endOffset + 1));
      } catch (e) {
        console.log("At node boundary, can't extend right");
      }
    }
    
    // Find affected highlights
    let affectedHighlights = [];
    const checkNodeForHighlights = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE && 
          node.classList?.contains("highlighted-text") &&
          deletionRange.intersectsNode(node)) {
        affectedHighlights.push(node);
        return;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(checkNodeForHighlights);
      }
    };
    
    let searchRoot = range.commonAncestorContainer;
    if (searchRoot.nodeType === Node.TEXT_NODE) {
      searchRoot = searchRoot.parentNode;
    }
    
    while (searchRoot && !searchRoot.id && searchRoot !== editorRef.current) {
      searchRoot = searchRoot.parentNode;
    }
    
    checkNodeForHighlights(searchRoot);
    
    if (affectedHighlights.length > 0) {
      event.preventDefault();
      
      const confirmDelete = window.confirm(
        `This deletion affects ${affectedHighlights.length} highlighted ${affectedHighlights.length > 1 ? 'elements' : 'element'}. Continue?`
      );
      
      if (!confirmDelete) return;

      const elementsToRemove = new Set();
      const isSingleDeletion = affectedHighlights.length === 1;

      // Process each highlight
      affectedHighlights.forEach((highlight) => {
        const commentId = highlight.dataset.commentId;
        const suggestededitId = highlight.dataset.suggestededitId;
        const elementId = commentId || suggestededitId;

        if (isSingleDeletion) {
          // Notify server of status change
          if (commentId) {
            socket.emit("updateCommentStatus", {
              docId,
              commentId,
              status: "deleted"
            });
          } else if (suggestededitId) {
            socket.emit("updateSuggestedEditStatus", {
              docId,
              suggestededitId,
              status: "deleted"
            });
          }
          // Preserve the element but mark as orphaned
          highlight.textContent = '';
          highlight.style.backgroundColor = 'transparent';
          highlight.classList.add('orphaned-highlight');
          
          // Update local state to mark as orphaned
          setFloatingElements(prev => 
            prev.map(item => 
              item.id === elementId 
                ? { ...item, isOrphaned: true } 
                : item
            )
          );
        } else {
          // Full cleanup for multiple deletions
          const element = floatingElementsRef.current.find(el => el.id === elementId);
          const originalText = element?.selectedText || highlight.textContent;
          
          const textNode = document.createTextNode(originalText);
          highlight.parentNode.replaceChild(textNode, highlight);
          
          if (elementId) elementsToRemove.add(elementId);
        }
      });

      // Update document content
      if (editorRef.current) {
        const updatedContent = editorRef.current.innerHTML;
        socket.emit("textChange", { docId, content: updatedContent });
      }

      // Handle multi-deletion server sync
      if (!isSingleDeletion && elementsToRemove.size > 0) {
        // Update local state
        setFloatingElements(prev => 
          prev.filter(element => !elementsToRemove.has(element.id))
        );

        // Batch delete from server
        const deletions = Array.from(elementsToRemove).map(id => ({
          type: id.startsWith("comment-") ? "comment" : "suggestededit",
          id
        }));

        socket.emit("batchDeleteElements", { 
          docId, 
          deletions 
        });
      }

      // Adjust UI after changes
      setTimeout(() => {
        adjustItemPositions();
        realignFloatingItems();
        
        // Additional check for orphaned elements
        if (isSingleDeletion) {
          const orphanedElements = document.querySelectorAll('.orphaned-highlight');
          orphanedElements.forEach(el => {
            if (!el.textContent.trim()) {
              el.style.borderLeft = "2px dashed #ff9800";
              el.style.paddingLeft = "2px";
            }
          });
        }
      }, 50);
    }
  }
}, [docId, adjustItemPositions, realignFloatingItems]);

  // Set up socket event listeners with deduplication logic
  useEffect(() => {
    // Track processed element IDs to prevent duplication
    const processedElementIds = new Set();
    
    // Improved handler for new document elements
    const handleReceiveDocElements = ({ comment, suggestededit }) => {
      if (comment) {
        // Check if we've already processed this comment
        if (!processedElementIds.has(comment.id)) {
          processedElementIds.add(comment.id);
          
          setFloatingElements((prev) => {
            // Double-check in callback to prevent race conditions
            if (prev.some(item => item.id === comment.id)) {
              return prev;
            }
            return [...prev, comment];
          });
          
          // Delay reconstruction to ensure DOM is ready
          setTimeout(() => {
            reconstructHighlight(comment, "comment");
            adjustItemPositions();
          }, 100);
        }
      }
      
      if (suggestededit) {
        // Check if we've already processed this suggested edit
        if (!processedElementIds.has(suggestededit.id)) {
          processedElementIds.add(suggestededit.id);
          
          setFloatingElements((prev) => {
            // Double-check in callback to prevent race conditions
            if (prev.some(item => item.id === suggestededit.id)) {
              return prev;
            }
            return [...prev, suggestededit];
          });
          
          // Delay reconstruction to ensure DOM is ready
          setTimeout(() => {
            reconstructHighlight(suggestededit, "suggestededit");
            adjustItemPositions();
          }, 100);
        }
      }
    };

    // Remove previous listeners to prevent duplication
    socket.off("receiveDocElements");
    socket.off("updateCommentStatus");
    socket.off("updateCommentReplies");
    socket.off("updateSuggestedEditStatus");
    socket.off("updateSuggestedEditReplies");
    
    // Add new listeners
    socket.on("receiveDocElements", handleReceiveDocElements);
    
// For comment status updates
socket.on("updateCommentStatus", ({ commentId, status }) => {
  setFloatingElements((prev) => {
    // Check if the comment already has this status
    const existingComment = prev.find(item => item.id === commentId);
    if (existingComment && existingComment.status === status) {
      return prev; // Skip update if status is already set
    }
    
    return prev.map((comment) =>
      comment.id === commentId ? { ...comment, status } : comment
    );
  });
});

// For comment replies
socket.on("updateCommentReplies", ({ commentId, reply }) => {
  setFloatingElements((prev) => {
    // Check if this reply already exists
    const existingComment = prev.find(item => item.id === commentId);
    if (existingComment && existingComment.replies.some(r => r.id === reply.id)) {
      return prev; // Skip update if reply already exists
    }
    
    return prev.map((comment) =>
      comment.id === commentId
        ? { ...comment, replies: [...comment.replies, reply] }
        : comment
    );
  });
});

// For suggested edit status updates
socket.on("updateSuggestedEditStatus", ({ suggestededitId, status }) => {
  setFloatingElements((prev) => {
    // Check if the suggested edit already has this status
    const existingEdit = prev.find(item => item.id === suggestededitId);
    if (existingEdit && existingEdit.status === status) {
      return prev; // Skip update if status is already set
    }
    
    return prev.map((suggestededit) =>
      suggestededit.id === suggestededitId 
        ? { ...suggestededit, status } 
        : suggestededit
    );
  });
});

// For suggested edit replies
socket.on("updateSuggestedEditReplies", ({ suggestededitId, reply }) => {
  setFloatingElements((prev) => {
    // Check if this reply already exists
    const existingEdit = prev.find(item => item.id === suggestededitId);
    if (existingEdit && existingEdit.replies.some(r => r.id === reply.id)) {
      return prev; // Skip update if reply already exists
    }
    
    return prev.map((suggestededit) =>
      suggestededit.id === suggestededitId
        ? { ...suggestededit, replies: [...suggestededit.replies, reply] }
        : suggestededit
    );
  });
});

// Add to the socket event listeners in useFloatingElements.js useEffect
socket.on("commentRemoved", ({ commentId }) => {
  setFloatingElements((prev) => 
    prev.filter((element) => element.id !== commentId)
  );
  
  // Run realignment after element is removed
  setTimeout(() => {
    adjustItemPositions();
    realignFloatingItems();
  }, 50);
});

socket.on("suggestedEditRemoved", ({ suggestededitId }) => {
  setFloatingElements((prev) => 
    prev.filter((element) => element.id !== suggestededitId)
  );
  
  // Run realignment after element is removed
  setTimeout(() => {
    adjustItemPositions();
    realignFloatingItems();
  }, 50);
});
    // Clean up listeners on unmount
    return () => {
      socket.off("receiveDocElements");
      socket.off("updateCommentStatus");
      socket.off("updateCommentReplies");
      socket.off("updateSuggestedEditStatus");
      socket.off("updateSuggestedEditReplies");
      socket.off("commentRemoved");
      socket.off("suggestedEditRemoved");
    };
  }, [adjustItemPositions, reconstructHighlight]);

  return {
    floatingElements,
    setFloatingElements,
    addFloatingElement,
    cancelFloatingElement,
    isCommenting,
    isSuggestingEdit,
    setIsCommenting,
    setIsSuggestingEdit,
    commentText,
    setCommentText,
    suggestEditText,
    setSuggestEditText,
    commentPosition,
    setCommentPosition,
    suggestEditPosition,
    setSuggestEditPosition,
    adjustItemPositions,
    reconstructHighlight,
    markCommentAsDone,
    replyComment,
    replySuggestedEdit,
    activeReplyId,
    setActiveReplyId,
    replyText,
    setReplyText,
    approveSuggestedEdit,
    declineSuggestedEdit,
    handleFloatingElementClick,
    clearHighlight,
    activeItemId,
    deleteFloatingElement,
    handleTextDeletion,
    storeSelectedRange, // Export the new function
    realignFloatingItems, // Added realignFloatingItems
  };
};

export default useFloatingElements;