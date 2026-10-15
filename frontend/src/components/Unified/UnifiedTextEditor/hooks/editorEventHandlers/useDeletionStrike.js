import { useCallback } from "react";

export const useDeletionStrike = ({
  schedulePaginateRef,
  currentUser,
  user,
  userRole,
  undo,
  paginationTimeoutRef,
}) => {
  const debouncedPaginateInput = useCallback(() => {
    if (paginationTimeoutRef.current) clearTimeout(paginationTimeoutRef.current);
    paginationTimeoutRef.current = setTimeout(
      () => schedulePaginateRef.current(),
      100
    );
  }, [schedulePaginateRef]);

  const getTrackedUnderlineColor = useCallback((identity) => {
    const palette = [
      "#ff6b6b", // red
      "#4dabf7", // blue
      "#51cf66", // green
      "#f59f00", // amber
      "#845ef7", // purple
      "#20c997", // teal
      "#e64980", // pink
      "#228be6", // deep blue
    ];
    const key = String(identity || "").trim().toLowerCase();
    if (!key) return "#4dabf7";
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(hash) % palette.length];
  }, []);

  const hexToRgba = useCallback((hex, alpha) => {
    const safeHex = String(hex || "").replace("#", "").trim();
    const fullHex = safeHex.length === 3
      ? safeHex.split("").map(ch => ch + ch).join("")
      : safeHex;
    const intVal = Number.parseInt(fullHex, 16);
    if (!Number.isFinite(intVal)) return `rgba(77, 171, 247, ${alpha})`;
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Helper to determine if a given DOM node / element is owned by the current user
  const isNodeOwnedByCurrentUser = useCallback((node) => {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;

    const currentId = String(user?.id || currentUser?.id || user?._id || currentUser?._id || '').trim();
    const currentEmail = (user?.email || currentUser?.email || 'Unknown').trim().toLowerCase();

    // 1. Check for closest inline element with attribution metadata or lock metadata
    const ownerEl = el.closest('[data-owner-id], [data-user-email], [data-locked-by], [data-locked-by-email], .reviewer-edit, .admin-edit');
    if (ownerEl) {
      const lockedBy = (ownerEl.getAttribute('data-locked-by') || '').trim();
      const lockedByEmail = (ownerEl.getAttribute('data-locked-by-email') || '').trim().toLowerCase();
      const ownerId = (ownerEl.getAttribute('data-owner-id') || '').trim();
      const ownerEmail = (ownerEl.getAttribute('data-user-email') || '').trim().toLowerCase();

      // If this element was locked by the current user, they can definitively unlock/edit it!
      const isLockedByMatch = (currentId && lockedBy && currentId !== 'undefined' && lockedBy === currentId) ||
                              (currentEmail && lockedByEmail && currentEmail !== 'unknown' && lockedByEmail === currentEmail);
      if (isLockedByMatch) return true;

      const idMatch = currentId && ownerId && currentId !== 'undefined' && ownerId === currentId;
      const emailMatch = currentEmail && ownerEmail && currentEmail !== 'unknown' && ownerEmail === currentEmail;
      if (idMatch || emailMatch) return true;

      // If it explicitly has an owner or lock attribute that does NOT match current user, reject
      if (ownerId || (ownerEmail && ownerEmail !== 'unknown') || lockedBy || (lockedByEmail && lockedByEmail !== 'unknown')) {
        return false;
      }
    }

    // 2. Check block-level ownership
    const block = el.closest('[data-block-id]');
    if (block) {
      const blockOwnerId = (block.getAttribute('data-owner-id') || '').trim();
      if (currentId && blockOwnerId && currentId !== 'undefined' && blockOwnerId === currentId) {
        return true;
      }
    }

    return false;
  }, [user, currentUser]);

  // -------- Backspace/Delete -> strike helper logic --------
  const getTextPositionFromOffset = useCallback((container, targetOffset) => {
    if (!container) return null;
    let remaining = targetOffset;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node = walker.nextNode();

    while (node) {
      const len = node.textContent?.length || 0;
      // Use strict < so that when remaining === len (a boundary between two nodes),
      // we prefer the START of the next text node. This prevents the off-by-one bug
      // where adjacent strike spans cause the wrong span to be identified as the target.
      if (remaining < len) {
        return { node, offset: remaining };
      }
      if (remaining === len) {
        // Boundary: could be end of this node or start of next.
        // Prefer start of next node if one exists (gives correct parent element).
        const nextNode = walker.nextNode();
        if (nextNode) {
          return { node: nextNode, offset: 0 };
        }
        // No next node — return end of current node
        return { node, offset: len };
      }
      remaining -= len;
      node = walker.nextNode();
    }
    return null;
  }, []);

  const getSingleCharRange = useCallback((container, selection, key) => {
    if (!container || !selection || !selection.rangeCount) return null;
    const caretRange = selection.getRangeAt(0);
    if (!caretRange.collapsed) return null;

    const pre = document.createRange();
    pre.selectNodeContents(container);
    pre.setEnd(caretRange.startContainer, caretRange.startOffset);
    const caretOffset = pre.toString().length;

    if (key === "Backspace") {
      if (caretOffset <= 0) return null;
      const startPos = getTextPositionFromOffset(container, caretOffset - 1);
      const endPos = getTextPositionFromOffset(container, caretOffset);
      if (!startPos || !endPos) return null;
      
      // If we crossed a block boundary or complex element, return null to protect structure
      if (startPos.node.parentElement.closest('[data-block-id]') !== 
          endPos.node.parentElement.closest('[data-block-id]')) {
        return null;
      }

      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      return range;
    }

    if (key === "Delete") {
      const contentLength = container.textContent?.length || 0;
      if (caretOffset >= contentLength) return null;
      const startPos = getTextPositionFromOffset(container, caretOffset);
      const endPos = getTextPositionFromOffset(container, caretOffset + 1);
      if (!startPos || !endPos) return null;

      // If we crossed a block boundary or complex element, return null to protect structure
      if (startPos.node.parentElement.closest('[data-block-id]') !== 
          endPos.node.parentElement.closest('[data-block-id]')) {
        return null;
      }

      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      return range;
    }

    return null;
  }, [getTextPositionFromOffset]);

  const applyBackspaceStrike = useCallback((targetRange) => {
    if (!targetRange) return false;
    const selectedText = targetRange.toString();
    if (!selectedText) return false;

    const wrapper = document.createElement("span");
    wrapper.className = "backspace-strike-text";
    wrapper.setAttribute(
      "data-backspace-strike-id",
      `backspace-strike-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    const email = user?.email || currentUser?.email || "Unknown";
    const creatorId = (user?.id ?? currentUser?.id) != null
      ? String(user?.id ?? currentUser?.id)
      : "";
    const userColor = getTrackedUnderlineColor(email || creatorId);
    wrapper.setAttribute("data-user-email", email);
    if (creatorId) {
      wrapper.setAttribute("data-strike-created-by-id", creatorId);
      wrapper.setAttribute("data-owner-id", creatorId); // Ensure owner ID is present for logic
    }
    const role = userRole || currentUser?.role || user?.role;
    const isAdmin = role === 'admin' || role === 'Admin' || role === 1 || role === '1' || role === 'author';
    wrapper.setAttribute("data-creator-role", isAdmin ? "admin" : "reviewer");
    wrapper.setAttribute("data-strike-created-by-email", email);
    wrapper.title = `Edited by: ${email}`;
    wrapper.textContent = selectedText;
    wrapper.style.setProperty("text-decoration-line", "line-through");
    wrapper.style.setProperty("text-decoration-thickness", "1.5px");
    wrapper.style.setProperty("text-decoration-color", userColor, "important");
    wrapper.style.setProperty("-webkit-text-decoration-color", userColor, "important");
    wrapper.style.setProperty("background", hexToRgba(userColor, 0.14));

    targetRange.deleteContents();
    targetRange.insertNode(wrapper);

    const sel = window.getSelection();
    if (sel) {
      const newRange = document.createRange();
      newRange.setStartBefore(wrapper);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    return true;
  }, [currentUser, user, getTrackedUnderlineColor, hexToRgba]);

  const convertDeletionToStrike = useCallback((key) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    const anchorEl = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement);
    const inContent = anchorEl?.closest?.(".page-content");
    if (!inContent) return false;

    // Detect if we are inside a table cell to prevent striking across boundaries
    const activeCell = anchorEl?.closest?.('td, th');
    // FIND THE SPECIFIC BLOCK: Scope calculations to the current paragraph/block
    // instead of the entire page content. This is critical for reliability at boundaries.
    const blockEl = anchorEl?.closest?.('[data-block-id]');
    
    const container = activeCell || blockEl || inContent;

    if (!sel.isCollapsed) {
      // REVERSIBLE STRIKE for selections: If the entire selection is within
      // a struck span, revert/unwrap the strike instead of re-striking.
      const startEl = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement : range.startContainer;
      const endEl = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement : range.endContainer;
      const startStrike = startEl?.closest?.('.backspace-strike-text');
      const endStrike = endEl?.closest?.('.backspace-strike-text');
      
      if (startStrike && endStrike && startStrike === endStrike) {
        // Entire selection is within a single strike span — revert it
        const strikeText = startStrike.textContent || '';
        const parent = startStrike.parentNode;
        if (parent) {
          const restoredText = document.createTextNode(strikeText);
          parent.insertBefore(restoredText, startStrike);
          startStrike.remove();
          
          // Position cursor at start of restored text
          const newRange = document.createRange();
          newRange.setStart(restoredText, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          parent.normalize();
          return true;
        }
      }
      
      // NEW: ROBUST OWNERSHIP-BASED SELECTION DELETION
      // If the entire selection is within MY OWN content (tagged with data-owner-id or email), delete normally.
      const startOwnerEl = startEl?.closest('[data-owner-id], .admin-edit, .reviewer-edit');
      const endOwnerEl = endEl?.closest('[data-owner-id], .admin-edit, .reviewer-edit');
      
      if (startOwnerEl && endOwnerEl && startOwnerEl === endOwnerEl) {
        const currentId = String(user?.id || currentUser?.id || "");
        const currentEmail = (user?.email || currentUser?.email || "Unknown").trim().toLowerCase();
        
        const ownerId = startOwnerEl.getAttribute('data-owner-id');
        const ownerEmail = (startOwnerEl.getAttribute('data-user-email') || "").trim().toLowerCase();
        
        // STRICT OWNERSHIP CHECK: Only match if IDs/Emails are valid and non-default
        const isOwner = (currentId && ownerId && currentId !== "undefined" && ownerId === currentId) || 
                       (currentEmail && ownerEmail && currentEmail !== "unknown" && ownerEmail === currentEmail);
        
        if (isOwner) {
          range.deleteContents();
          if (startOwnerEl.textContent.length === 0) {
            startOwnerEl.remove();
          }
          return true;
        }
      }
      
      // For other selection deletions, strike the entire range. 
      // If it's in a cell, browser selection usually respects cell boundaries.
      return applyBackspaceStrike(range.cloneRange());
    }

    const strikeRange = getSingleCharRange(container, sel, key);
    
    if (!strikeRange) {
      // We are at a boundary (start of cell/page for Backspace, end for Delete).
      // If we are in a table cell, return true to prevent default backspace 
      // that would escape the cell or break the table layout.
      if (activeCell) return true;
      return false;
    }

    // SMART STRIKE: Determine which text node actually contains the target character.
    // When a range spans an element boundary (startContainer at end of one node,
    // endContainer at start of the next), the actual character lives in endContainer.
    let targetNode = strikeRange.startContainer;
    if (
      targetNode.nodeType === Node.TEXT_NODE &&
      strikeRange.startOffset === targetNode.textContent.length &&
      strikeRange.endContainer !== targetNode
    ) {
      targetNode = strikeRange.endContainer;
    }
    
    // Calculate targetParent early to ensure consistency between reversible strike check
    // and ownership check.
    const targetParent = targetNode.nodeType === Node.TEXT_NODE ? targetNode.parentElement : targetNode;
    
    // 1. REVERSIBLE STRIKE: If target character is inside an existing strike span,
    //    revert/undo the strike instead of re-striking or just skipping.
    //    This allows reviewers to correct accidental deletions naturally.
    if (targetParent.closest('.backspace-strike-text')) {
      const existingStrike = targetParent.closest('.backspace-strike-text');
      const strikeText = existingStrike.textContent || '';
      const parent = existingStrike.parentNode;
      
      if (!parent) return true; // Safety guard
      
      if (strikeText.length <= 1) {
        // Single-character strike span: revert entirely by replacing with plain text.
        const restoredText = document.createTextNode(strikeText);
        parent.insertBefore(restoredText, existingStrike);
        existingStrike.remove();
        
        // Position cursor BEFORE normalize (restoredText is still valid).
        // For Backspace: place cursor BEFORE restored char so next backspace
        //   targets the next struck char to the left (sequential reverting).
        // For Delete: place cursor AFTER restored char so next Delete
        //   targets the next struck char to the right.
        const newRange = document.createRange();
        if (key === "Backspace") {
          newRange.setStart(restoredText, 0);
        } else {
          newRange.setStart(restoredText, restoredText.textContent.length);
        }
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        
        // Normalize after cursor is set — browser will preserve cursor position
        parent.normalize();
      } else {
        // Multi-character strike span: peel off the adjacent character only.
        // For Backspace the target is at the end of the span; for Delete at the start.
        if (key === "Backspace") {
          // Remove the last character from the strike and restore it as plain text
          const lastChar = strikeText.charAt(strikeText.length - 1);
          existingStrike.textContent = strikeText.slice(0, -1);
          const restoredChar = document.createTextNode(lastChar);
          parent.insertBefore(restoredChar, existingStrike.nextSibling);
          // Clean up empty strike span
          if (!existingStrike.textContent) existingStrike.remove();
          
          // Cursor BEFORE restored char for sequential leftward reverting
          const newRange = document.createRange();
          newRange.setStart(restoredChar, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          parent.normalize();
        } else {
          // Delete key: remove the first character from the strike and restore it
          const firstChar = strikeText.charAt(0);
          existingStrike.textContent = strikeText.slice(1);
          const restoredChar = document.createTextNode(firstChar);
          parent.insertBefore(restoredChar, existingStrike);
          // Clean up empty strike span
          if (!existingStrike.textContent) existingStrike.remove();
          
          // Cursor AFTER restored char for sequential rightward reverting
          const newRange = document.createRange();
          newRange.setStart(restoredChar, restoredChar.textContent.length);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          parent.normalize();
        }
      }
      return true;
    }
    // THE TARGET CHARACTER HAS BEEN IDENTIFIED (strikeRange and targetParent from above)

    const ownerEl = targetParent.closest('[data-owner-id], .admin-edit, .reviewer-edit');
    if (ownerEl) {
       const currentId = String(user?.id || currentUser?.id || "");
       const currentEmail = (user?.email || currentUser?.email || "Unknown").trim().toLowerCase();
       
       const ownerId = ownerEl.getAttribute('data-owner-id');
       const ownerEmail = (ownerEl.getAttribute('data-user-email') || "").trim().toLowerCase();
       
       // STRICT OWNERSHIP CHECK: Only match if IDs/Emails are valid and non-default
       const isOwner = (currentId && ownerId && currentId !== "undefined" && ownerId === currentId) || 
                      (currentEmail && ownerEmail && currentEmail !== "unknown" && ownerEmail === currentEmail);
       
       if (isOwner) {
         // Current user's own content -> Truly delete it instead of striking
         strikeRange.deleteContents();
         // If span is now empty, remove it to keep DOM clean
         if (ownerEl.textContent.length === 0) {
           ownerEl.remove();
         }
         return true;
       }
       // If it's another user's content, fall through to strike it below
    }

    return applyBackspaceStrike(strikeRange);
  }, [applyBackspaceStrike, getSingleCharRange, currentUser, user]);

  // Helper to place caret inside a block with visible blinking cursor

  return {
    debouncedPaginateInput,
    getTrackedUnderlineColor,
    hexToRgba,
    isNodeOwnedByCurrentUser,
    getTextPositionFromOffset,
    getSingleCharRange,
    applyBackspaceStrike,
    convertDeletionToStrike,
  };
};

export default useDeletionStrike;
