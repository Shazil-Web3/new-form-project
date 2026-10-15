/**
 * useHandlePaste
 *
 * Wraps the underlying PasteHandler class paste operation and, when
 * enableTypedUnderlines is true, applies the same reviewer/author underline
 * attribution to pasted content that useHandleBeforeInput applies to typed
 * content. This ensures consistent underline behavior regardless of how
 * content is inserted (Bug 2 fix).
 */
export const useHandlePaste = ({
  pasteHandlerRef,
  imagePasteHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  ensureOnePage,
  onTyping,
  isApprovalState,
  readOnly,
  pushToUndo,
  endTypingSession,
  ignoreNextTypingActionRef,
  caretManagerRef,
  getActivePageContentLocal,
  positionCursorAtEndOfBlock,
  // Reviewer-underline props (passed from useEditorEventHandlers → useHandleBeforeInput)
  enableTypedUnderlines = false,
  currentUser,
  user,
  userRole,
  getTrackedUnderlineColor,
}) => {
  /**
   * Applies reviewer/author underline spans to all bare text nodes inside
   * the given DOM container (a .page-content element or a block subtree).
   * Mirrors the span structure created by useHandleBeforeInput.
   */
  function applyReviewerUnderlineToPastedContent(container) {
    if (!enableTypedUnderlines || !container) return 0;

    // Determine identity — identical resolution as useHandleBeforeInput
    const rawRole = userRole ?? currentUser?.role ?? user?.role ?? '';
    const normalizedRole = String(rawRole).trim().toLowerCase();
    const isAdminRole = normalizedRole === 'admin' || normalizedRole === '1';
    const isReviewerRole = [
      'reviewer', 'template_reviewer', 'approver', 'template_approver', 'review'
    ].includes(normalizedRole);

    const email = user?.email || currentUser?.email || 'Unknown';
    const currentUserId = String(user?.id || currentUser?.id || '');

    if (!isAdminRole && !isReviewerRole && email === 'Unknown' && !currentUserId) return 0;

    const targetClass = isAdminRole ? 'admin-edit' : 'reviewer-edit';
    const creatorRole  = isAdminRole ? 'admin' : 'reviewer';
    const underlineColor = getTrackedUnderlineColor
      ? getTrackedUnderlineColor(email || currentUserId)
      : '#4dabf7'; // safe fallback

    let wrappedCount = 0;

    /**
     * Walk text nodes inside `root` that are not already inside an
     * attribution span, locked region, or control element.
     */
    function wrapTextNodes(root) {
      // Collect first so the DOM walk doesn't mutate mid-iteration
      const toWrap = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      while (node) {
        const raw = node.textContent || '';
        const normalized = raw.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
        if (normalized.length > 0) {
          const parent = node.parentElement;
          if (parent) {
            const alreadyOwned = parent.closest(
              '.admin-edit, .reviewer-edit, [data-backspace-strike-id], .backspace-strike-text'
            );
            const isLocked = parent.closest(
              '[data-locked="true"], .locked-text, .locked, [contenteditable="false"]'
            );
            const isControl = parent.closest('select, button, script, style');
            if (!alreadyOwned && !isLocked && !isControl) {
              toWrap.push(node);
            }
          }
        }
        node = walker.nextNode();
      }

      toWrap.forEach((textNode) => {
        const span = document.createElement('span');
        span.className = targetClass;
        span.setAttribute('data-user-email', email);
        if (currentUserId) span.setAttribute('data-owner-id', currentUserId);
        span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        span.setAttribute('data-creator-role', creatorRole);
        if (email !== 'Unknown') span.title = `Edited by: ${email}`;

        span.style.setProperty('text-decoration-line', 'underline');
        span.style.setProperty('text-decoration-thickness', '2px');
        span.style.setProperty('text-decoration-color', underlineColor, 'important');
        span.style.setProperty('-webkit-text-decoration-color', underlineColor, 'important');

        span.textContent = textNode.textContent;
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(span, textNode);
          wrappedCount++;
        }
      });
    }

    // Walk every editable block element in the container
    const blocks = container.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th'
    );

    if (blocks.length > 0) {
      blocks.forEach((block) => {
        const isBlockLocked =
          block.getAttribute('data-locked') === 'true' ||
          block.classList.contains('locked-text') ||
          block.classList.contains('locked') ||
          block.getAttribute('contenteditable') === 'false';
        if (!isBlockLocked) wrapTextNodes(block);
      });
    } else {
      // Plain-text paste may land directly in the container without block wrappers
      wrapTextNodes(container);
    }

    return wrappedCount;
  }

  async function handlePaste(event, pasteOptions = {}) {
    if (readOnly) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    // Claim paste immediately so hydration / empty-DOM sync cannot wipe mid-await.
    window.isPasteInProgress = true;

    endTypingSession?.();
    pushToUndo?.();
    if (ignoreNextTypingActionRef) {
      ignoreNextTypingActionRef.current = true;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const container = range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.parentElement 
          : range.startContainer;
      
      const inContent = container?.closest?.(".page-content");
      if (!inContent) {
        // Let native browser paste happen inside header/footer/logo text
        window.isPasteInProgress = false;
        return;
      }
    }

    if (event?.preventDefault) {
      event.preventDefault();
    }
    const nativeEvent = event?.nativeEvent || event || {};
    const clipboardData = nativeEvent?.clipboardData || nativeEvent?.dataTransfer;

    if (isApprovalState && clipboardData && !pasteOptions.plainTextOnly) {
      const hasDirectImageFile = Array.from(clipboardData.items || []).some(
        (item) => item?.kind === "file" && /^image\//i.test(item.type || "")
      );
      const htmlData = clipboardData.getData?.("text/html") || "";
      const hasHtmlImage = /<(img|figure)\b/i.test(htmlData);

      if (hasDirectImageFile || hasHtmlImage) {
        window.isPasteInProgress = false;
        alert("Images cannot be pasted while this template is in approval stage.");
        return;
      }
    }

    const targetContent =
      getActivePageContentLocal() ||
      ensureOnePage()?.querySelector(".page-content");
    if (!targetContent) {
      window.isPasteInProgress = false;
      return;
    }

    onTyping?.();

    // Prepare reviewer underline attribution info for PasteHandler
    const rawRole = userRole ?? currentUser?.role ?? user?.role ?? '';
    const normalizedRole = String(rawRole).trim().toLowerCase();
    const isAdminRole = normalizedRole === 'admin' || normalizedRole === '1';
    const isReviewerRole = [
      'reviewer', 'template_reviewer', 'approver', 'template_approver', 'review'
    ].includes(normalizedRole);

    const email = user?.email || currentUser?.email || 'Unknown';
    const currentUserId = String(user?.id || currentUser?.id || '');

    const shouldTrackReviewer = enableTypedUnderlines && (isAdminRole || isReviewerRole || email !== 'Unknown' || currentUserId);
    const targetClass = isAdminRole ? 'admin-edit' : 'reviewer-edit';
    const creatorRole = isAdminRole ? 'admin' : 'reviewer';
    const underlineColor = getTrackedUnderlineColor
      ? getTrackedUnderlineColor(email || currentUserId)
      : '#4dabf7';

    const reviewerInfo = shouldTrackReviewer ? {
      email,
      userId: currentUserId,
      userRole: normalizedRole,
      targetClass,
      creatorRole,
      underlineColor,
    } : null;

    let directImageHandled = false;
    let lastInsertedBlockId = null;
    
    try {
      if (imagePasteHandlerRef.current && !pasteOptions.plainTextOnly) {
        directImageHandled = await imagePasteHandlerRef.current.handleImagePaste(
          nativeEvent,
          targetContent
        );
        if (directImageHandled) {
          lastInsertedBlockId = imagePasteHandlerRef.current.getLastInsertedBlockId?.();
        }
      }

      let pasteHandled = false;

      if (!directImageHandled && pasteHandlerRef.current) {
        if (pasteHandlerRef.current.setReviewerInfo) {
          pasteHandlerRef.current.setReviewerInfo(reviewerInfo);
        }
        pasteHandled = await pasteHandlerRef.current.handlePaste(
          nativeEvent,
          targetContent,
          {
            ...pasteOptions,
            reviewerInfo,
          }
        );
        lastInsertedBlockId = pasteHandlerRef.current.getLastInsertedBlockId();
      }

      if (directImageHandled || pasteHandled || lastInsertedBlockId) {
        // Sync DOM -> blocks and trigger pagination.
        // Because PasteHandler embedded reviewer attribution directly into block.content
        // and DOM, documentEngine, and DOM are in sync with reviewer underlines from step 1.
        syncAndNotify();
        schedulePaginateRef.current?.();

        const shouldApplyUnderlines = enableTypedUnderlines && !directImageHandled;

        const finishPasteCaret = () => {
          if (shouldApplyUnderlines) {
            let newlyWrapped = 0;
            const allPageContents = document.querySelectorAll('.page-content');
            allPageContents.forEach((pc) => {
              if (pc && pc.isConnected) {
                newlyWrapped += applyReviewerUnderlineToPastedContent(pc);
              }
            });
            if (newlyWrapped > 0) {
              syncAndNotify();
            }
          }

          window.isPasteInProgress = false;
          if (lastInsertedBlockId && !window.isUserScrollingEditor) {
            positionCursorAtEndOfBlock(lastInsertedBlockId);
            caretManagerRef?.current?.onEditingAction('paste', { behavior: 'auto' });
            if (pasteHandlerRef.current?.clearLastInsertedBlockId) {
              pasteHandlerRef.current.clearLastInsertedBlockId();
            }
            if (imagePasteHandlerRef.current?.clearLastInsertedBlockId) {
              imagePasteHandlerRef.current.clearLastInsertedBlockId();
            }
          }
        };

        // Wait for pagination (and any queued follow-up) before moving the caret.
        let attempts = 0;
        const waitForPaginate = () => {
          attempts += 1;
          if (window.isPaginatingEditor && attempts < 60) {
            setTimeout(waitForPaginate, 50);
            return;
          }
          // One extra frame so DOM from the last paginate pass is committed.
          requestAnimationFrame(() => {
            requestAnimationFrame(finishPasteCaret);
          });
        };
        setTimeout(waitForPaginate, 50);
      } else {
        window.isPasteInProgress = false;
      }
    } catch (err) {
      window.isPasteInProgress = false;
      throw err;
    }
  }

  return {
    handlePaste,
  };
};

export default useHandlePaste;
