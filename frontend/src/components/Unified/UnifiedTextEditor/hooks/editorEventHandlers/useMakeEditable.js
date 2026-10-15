import { useCallback } from "react";
import { toastAlert } from "../../../../../utils/alerts";

export const useMakeEditable = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  currentUser,
  user,
  userRole,
  savedSelectionRef,
  updateTOC,
  pushToUndo,
  getTrackedUnderlineColor,
  isNodeOwnedByCurrentUser,
}) => {
  const handleMakeEditable = useCallback((explicitRange = null) => {
    let range = explicitRange;
    if (!range) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
      }
    }
    if (!range && savedSelectionRef.current) {
      range = savedSelectionRef.current.cloneRange();
    }
    if (!range) return;

    const root = pagesContainerRef.current;
    if (!root) return;

    // Determine user role and identity
    const rawRole = userRole ?? currentUser?.role ?? user?.role ?? '';
    const normalizedRole = String(rawRole).trim().toLowerCase();
    const isAdminRole = normalizedRole === 'admin' || normalizedRole === '1';

    const currentUserId = String(user?.id || currentUser?.id || user?._id || currentUser?._id || '').trim();
    const currentEmail = (user?.email || currentUser?.email || 'Unknown').trim().toLowerCase();

    const commonNode = range.commonAncestorContainer;
    const commonEl = commonNode.nodeType === Node.ELEMENT_NODE ? commonNode : commonNode.parentElement;

    // 1. Gather all locked spans intersecting or containing the range
    const allLockedSpans = Array.from(root.querySelectorAll('[data-locked="true"], .locked-text'));
    const intersectingLocked = [];

    // Check if common ancestor, start/end nodes, or anchor/focus are inside locked text
    const enclosingLocked = commonEl?.closest?.('[data-locked="true"], .locked-text');
    if (enclosingLocked) intersectingLocked.push(enclosingLocked);

    const startEl = range.startContainer?.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer?.parentElement;
    const endEl = range.endContainer?.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer?.parentElement;
    const startLocked = startEl?.closest?.('[data-locked="true"], .locked-text');
    const endLocked = endEl?.closest?.('[data-locked="true"], .locked-text');
    if (startLocked) intersectingLocked.push(startLocked);
    if (endLocked && endLocked !== startLocked) intersectingLocked.push(endLocked);

    allLockedSpans.forEach(span => {
      try {
        if (range.intersectsNode(span)) {
          intersectingLocked.push(span);
        }
      } catch (e) {
        const spanRange = document.createRange();
        spanRange.selectNode(span);
        const isBefore = range.compareBoundaryPoints(Range.END_TO_START, spanRange) <= 0;
        const isAfter = range.compareBoundaryPoints(Range.START_TO_END, spanRange) >= 0;
        if (!isBefore && !isAfter) {
          intersectingLocked.push(span);
        }
      }
    });

    // ══════════════════════════════════════════════════════════════════
    // UNLOCK MODE: If any locked elements are selected/clicked, unwrap them
    // ══════════════════════════════════════════════════════════════════
    if (intersectingLocked.length > 0) {
      const uniqueSpans = Array.from(new Set(intersectingLocked));

      let spansToUnlock = uniqueSpans;
      if (!isAdminRole) {
        // Reviewers can ONLY unlock their own locked text!
        spansToUnlock = uniqueSpans.filter(isNodeOwnedByCurrentUser);

        if (spansToUnlock.length === 0) {
          toastAlert("Reviewers can only unlock their own text.", "warning");
          return;
        }

        if (spansToUnlock.length < uniqueSpans.length) {
          toastAlert("Unlocked your text. Other users' locked text remains locked.", "info");
        }
      }

      pushToUndo?.(true);

      // Sort deepest first to prevent unwrap hierarchy issues
      spansToUnlock.sort((a, b) => {
        const getDepth = el => {
          let d = 0, p = el;
          while (p) { d++; p = p.parentElement; }
          return d;
        };
        return getDepth(b) - getDepth(a);
      });

      const touchedBlocks = new Set();
      let lastRestoredNode = null;

      spansToUnlock.forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        const block = span.closest?.('[data-block-id]');
        if (block) touchedBlocks.add(block);

        // Check if span was reviewer text
        const spanOwnerId = span.getAttribute('data-owner-id') || span.getAttribute('data-locked-by');
        const spanOwnerEmail = span.getAttribute('data-user-email') || span.getAttribute('data-locked-by-email');
        const spanRole = span.getAttribute('data-creator-role');
        const isReviewerSpan = spanRole === 'reviewer' || span.classList.contains('reviewer-edit') || (!isAdminRole && isNodeOwnedByCurrentUser(span));

        const isAlreadyInsideReviewerEdit = span.parentElement?.closest?.('.reviewer-edit');

        if (isReviewerSpan && !isAlreadyInsideReviewerEdit) {
          const underlineColor = getTrackedUnderlineColor(spanOwnerEmail || spanOwnerId || currentEmail || currentUserId);
          const reviewerWrapper = document.createElement('span');
          reviewerWrapper.className = 'reviewer-edit';
          if (spanOwnerId || currentUserId) reviewerWrapper.setAttribute('data-owner-id', spanOwnerId || currentUserId);
          if (spanOwnerEmail || currentEmail) reviewerWrapper.setAttribute('data-user-email', spanOwnerEmail || currentEmail);
          reviewerWrapper.setAttribute('data-creator-role', 'reviewer');
          reviewerWrapper.title = `Edited by: ${spanOwnerEmail || currentEmail}`;
          reviewerWrapper.style.setProperty('text-decoration-line', 'underline');
          reviewerWrapper.style.setProperty('text-decoration-thickness', '2px');
          reviewerWrapper.style.setProperty('text-decoration-color', underlineColor, 'important');
          reviewerWrapper.style.setProperty('-webkit-text-decoration-color', underlineColor, 'important');

          while (span.firstChild) {
            reviewerWrapper.appendChild(span.firstChild);
          }
          parent.replaceChild(reviewerWrapper, span);
          lastRestoredNode = reviewerWrapper;
        } else {
          const firstChild = span.firstChild;
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
          lastRestoredNode = firstChild || parent;
        }
      });

      touchedBlocks.forEach(b => b.normalize?.());

      // Place caret inside the restored content so user can immediately type
      if (lastRestoredNode && lastRestoredNode.isConnected) {
        try {
          const newSel = window.getSelection();
          if (newSel) {
            const newRange = document.createRange();
            newRange.selectNodeContents(lastRestoredNode);
            newRange.collapse(false);
            newSel.removeAllRanges();
            newSel.addRange(newRange);
          }
        } catch {}
      }

      // Sync DOM to blocks across all pages & repaginate
      if (contentChangeHandlerRef.current && root) {
        contentChangeHandlerRef.current.syncDOMToBlocks(root);
      }
      schedulePaginateRef.current?.();
      syncAndNotify();
      updateTOC?.();
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // LOCK MODE: Wrap selected text in locked spans
    // ══════════════════════════════════════════════════════════════════
    if (range.collapsed) return;
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    // Collect all text nodes that intersect the selection range
    const textNodes = [];
    const walker = document.createTreeWalker(
      commonEl || root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node || !node.textContent || !node.textContent.length) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip UI elements (floating toolbars, rails, drag handles)
          if (node.parentElement?.closest?.('[data-ui-element="true"], .selection-pill, .doc-rail')) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip if already locked
          if (node.parentElement?.closest?.('[data-locked="true"], .locked-text')) {
            return NodeFilter.FILTER_REJECT;
          }
          try {
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        }
      }
    );

    let n;
    while ((n = walker.nextNode())) {
      textNodes.push(n);
    }

    if (!textNodes.length) return;

    // Reviewers can ONLY lock their own text!
    let candidateNodes = textNodes;
    if (!isAdminRole) {
      const myTextNodes = textNodes.filter(isNodeOwnedByCurrentUser);

      if (myTextNodes.length === 0) {
        toastAlert("Reviewers can only lock their own text.", "warning");
        return;
      }

      if (myTextNodes.length < textNodes.length) {
        toastAlert("Only your own text was locked. Other text was not locked.", "info");
      }

      candidateNodes = myTextNodes;
    }

    pushToUndo?.(true);

    const modifiedBlocks = new Set();
    let lastLockedSpan = null;

    // Process in reverse order to preserve DOM offsets during mutation
    for (let i = candidateNodes.length - 1; i >= 0; i--) {
      const textNode = candidateNodes[i];
      let startOffset = 0;
      let endOffset = textNode.textContent.length;

      if (textNode === range.startContainer) startOffset = range.startOffset;
      if (textNode === range.endContainer) endOffset = range.endOffset;
      if (startOffset >= endOffset) continue;

      const subRange = document.createRange();
      subRange.setStart(textNode, startOffset);
      subRange.setEnd(textNode, endOffset);

      const span = document.createElement("span");
      span.className = "locked-text locked";
      span.setAttribute("data-locked", "true");
      span.setAttribute("contenteditable", "false");
      span.style.userSelect = "text";
      span.style.cursor = "text";

      // Detect ownership and role of this text node
      const ownerEl = textNode.parentElement?.closest?.('[data-owner-id], [data-user-email], .reviewer-edit, .admin-edit');
      const nodeOwnerId = ownerEl?.getAttribute('data-owner-id') || currentUserId;
      const nodeOwnerEmail = ownerEl?.getAttribute('data-user-email') || currentEmail;
      const nodeRole = ownerEl?.getAttribute('data-creator-role') || (isAdminRole ? 'admin' : 'reviewer');

      if (nodeOwnerId) span.setAttribute("data-owner-id", nodeOwnerId);
      if (nodeOwnerEmail) span.setAttribute("data-user-email", nodeOwnerEmail);
      if (currentUserId) span.setAttribute("data-locked-by", currentUserId);
      if (currentEmail) span.setAttribute("data-locked-by-email", currentEmail);
      span.setAttribute("data-creator-role", nodeRole);

      // Preserve reviewer's underline color on the locked span so it's visually apparent who owns it!
      const userColor = getTrackedUnderlineColor(nodeOwnerEmail || nodeOwnerId || currentEmail || currentUserId);
      if (nodeRole === 'reviewer' || !isAdminRole) {
        span.classList.add("reviewer-edit");
        span.style.setProperty("text-decoration-line", "underline");
        span.style.setProperty("text-decoration-thickness", "2px");
        span.style.setProperty("text-decoration-color", userColor, "important");
        span.style.setProperty("-webkit-text-decoration-color", userColor, "important");
      }

      try {
        subRange.surroundContents(span);
      } catch (e) {
        try {
          const content = subRange.extractContents();
          span.appendChild(content);
          subRange.insertNode(span);
        } catch (err) {
          console.warn("Could not wrap text node in locked span:", err);
        }
      }

      // First span created in reverse loop is the last span in document order
      if (!lastLockedSpan) {
        lastLockedSpan = span;
      }

      const block = textNode.parentElement?.closest?.('[data-block-id]');
      if (block) modifiedBlocks.add(block);
    }

    modifiedBlocks.forEach(b => b.normalize?.());

    // CRITICAL: Position cursor immediately AFTER the locked text so cursor does not get redirected to first character!
    if (lastLockedSpan && lastLockedSpan.parentNode) {
      const parent = lastLockedSpan.parentNode;
      let nextTextNode = lastLockedSpan.nextSibling;
      let targetOffset = 0;
      if (!nextTextNode || nextTextNode.nodeType !== Node.TEXT_NODE) {
        nextTextNode = document.createTextNode('');
        if (lastLockedSpan.nextSibling) {
          parent.insertBefore(nextTextNode, lastLockedSpan.nextSibling);
        } else {
          parent.appendChild(nextTextNode);
        }
      }
      try {
        const sel = window.getSelection();
        if (sel) {
          const newRange = document.createRange();
          newRange.setStart(nextTextNode, targetOffset);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          if (savedSelectionRef) {
            savedSelectionRef.current = newRange.cloneRange();
          }
        }
        if (root && root.focus) {
          root.focus({ preventScroll: true });
        }
      } catch (err) {
        console.warn('Could not position cursor after locked text:', err);
      }
    }

    // Sync with DocumentEngine and update all pages
    if (contentChangeHandlerRef.current && root) {
      contentChangeHandlerRef.current.syncDOMToBlocks(root);
    }
    schedulePaginateRef.current?.();
    syncAndNotify();
    updateTOC?.();
  }, [
    syncAndNotify,
    updateTOC,
    pagesContainerRef,
    documentEngineRef,
    savedSelectionRef,
    contentChangeHandlerRef,
    schedulePaginateRef,
    pushToUndo,
    userRole,
    currentUser,
    user,
    isNodeOwnedByCurrentUser,
    getTrackedUnderlineColor
  ]);

  const toggleBlockLock = handleMakeEditable;


  return {
    handleMakeEditable,
    toggleBlockLock,
  };
};

export default useMakeEditable;
