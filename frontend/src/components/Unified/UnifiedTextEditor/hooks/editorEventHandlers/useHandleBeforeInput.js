export const useHandleBeforeInput = ({
  pagesContainerRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  currentUser,
  user,
  userRole,
  onTyping,
  readOnly,
  enableTypedUnderlines,
  disableStrikeOnDelete,
  registerTypingAction,
  caretManagerRef,
  debouncedPaginateInput,
  getTrackedUnderlineColor,
  convertDeletionToStrike,
  containsLockedText,
  findLockedElementBefore,
  skipLockedTextBackward,
  deleteSelectionPreservingLocked,
  handleBlockBackspace,
  handleEnter,
  handlePaste,
}) => {
  function handleBeforeInput(e) {
      if (readOnly) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      caretManagerRef?.current?.onEditingAction('beforeinput');

      const inputType = (e.nativeEvent && e.nativeEvent.inputType) || "";

      // LOCKED TEXT PROTECTION: Prevent typing inside locked text or overwriting locked text selections on insertion
      if (inputType.startsWith("insert") || inputType === "insertText" || inputType === "insertFromPaste") {
        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount) {
          const selRange = currentSel.getRangeAt(0);
          const startEl = selRange.startContainer.nodeType === Node.ELEMENT_NODE
            ? selRange.startContainer
            : selRange.startContainer.parentElement;
          const isInsideLocked = startEl?.closest?.('[data-locked="true"], .locked-text');
          if (isInsideLocked) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (!currentSel.isCollapsed && containsLockedText(selRange)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      onTyping?.();
      if (e.data && typeof e.data === 'string' && inputType !== "insertFromPaste") {
        registerTypingAction?.();
      }
      // ADMIN/REVIEWER UNDERLINE MECHANISM
      // Note: we capture all text insertions to ensure ownership metadata is attached
      if (enableTypedUnderlines && e.data && typeof e.data === 'string') {
        // Determine role and identity
        const rawRole = userRole ?? currentUser?.role ?? user?.role ?? '';
        const normalizedRole = String(rawRole).trim().toLowerCase();
        const isAdminRole = normalizedRole === 'admin' || normalizedRole === '1';
        const isReviewerRole = ['reviewer', 'template_reviewer', 'approver', 'template_approver', 'review'].includes(normalizedRole);

        const email = user?.email || currentUser?.email || 'Unknown';
        const currentUserId = String(user?.id || currentUser?.id || '');
        
        if (isAdminRole || isReviewerRole || email !== 'Unknown' || currentUserId) {
          const targetClass = isAdminRole ? 'admin-edit' : 'reviewer-edit';
          const sel = window.getSelection();
          
          if (sel && sel.rangeCount) {
             const range = sel.getRangeAt(0);
             const container = range.startContainer.nodeType === Node.TEXT_NODE 
                 ? range.startContainer.parentElement 
                 : range.startContainer;
             
             // Check if selection is inside the main page content block area.
             // We MUST ignore edits in header, footer, logo-strip, etc.
             const inContent = container?.closest?.(".page-content");
             if (!inContent) return;
             
             // Check if we are already inside ANY attribution span
             const anyAttributionSpan = container.closest('span.admin-edit, span.reviewer-edit, span.author-attribution, span[data-user-email], span[data-owner-id]');
             const existingId = anyAttributionSpan?.getAttribute('data-owner-id');
             const existingEmail = anyAttributionSpan?.getAttribute('data-user-email');
             
             const isSameOwner = anyAttributionSpan && (
               (currentUserId && existingId === currentUserId) || 
               (email !== 'Unknown' && existingEmail === email)
             );
             
             const underlineColor = getTrackedUnderlineColor(email || currentUserId);
             
             // If we are NOT in our own span (either not in an attribution span, or in someone else's span), we must wrap/create new
             if (!anyAttributionSpan || !isSameOwner) {
                  e.preventDefault();
                  
                  if (!sel.isCollapsed) {
                     range.deleteContents();
                  }

                  const span = document.createElement('span');
                  span.className = targetClass;
                  span.textContent = e.data;
                  
                  // Add attribution metadata
                  span.setAttribute('data-user-email', email);
                  if (currentUserId) span.setAttribute('data-owner-id', currentUserId);
                  span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
                  span.setAttribute('data-creator-role', isAdminRole ? 'admin' : 'reviewer');
                  
                  span.title = `Edited by: ${email}`;
                  span.style.setProperty('text-decoration-line', 'underline');
                  span.style.setProperty('text-decoration-thickness', '2px');
                  span.style.setProperty('text-decoration-color', underlineColor, 'important');
                  span.style.setProperty('-webkit-text-decoration-color', underlineColor, 'important');
                  
                  if (anyAttributionSpan && !isSameOwner && anyAttributionSpan.parentNode) {
                     // Split anyAttributionSpan so the new span is inserted as a sibling, NEVER nested
                     const parentNode = anyAttributionSpan.parentNode;
                     const splitRange = document.createRange();
                     splitRange.setStart(range.startContainer, range.startOffset);
                     splitRange.setEndAfter(anyAttributionSpan.lastChild || anyAttributionSpan);
                     const rightContent = splitRange.extractContents();

                     let rightSpan = null;
                     if (rightContent.textContent && rightContent.textContent.length > 0) {
                       rightSpan = anyAttributionSpan.cloneNode(false);
                       rightSpan.appendChild(rightContent);
                     }

                     const nextSibling = anyAttributionSpan.nextSibling;
                     parentNode.insertBefore(span, nextSibling);
                     if (rightSpan) {
                       parentNode.insertBefore(rightSpan, span.nextSibling);
                     }

                     if (!anyAttributionSpan.textContent || anyAttributionSpan.textContent.length === 0) {
                       anyAttributionSpan.remove();
                     }
                  } else {
                     range.insertNode(span);
                  }
                  
                  const newRange = document.createRange();
                  if (span.firstChild) {
                     newRange.setStart(span.firstChild, e.data.length);
                     newRange.collapse(true);
                  } else {
                     newRange.setStartAfter(span);
                  }
                  
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                  
                  setTimeout(() => syncAndNotify(), 0);
                  return;
             }
             // If we ARE in our own span, ensure metadata, title tooltip, and styling are present
             if (currentUserId && !anyAttributionSpan.hasAttribute('data-owner-id')) {
                anyAttributionSpan.setAttribute('data-owner-id', currentUserId);
             }
             if (email !== 'Unknown' && (!anyAttributionSpan.hasAttribute('data-user-email') || anyAttributionSpan.getAttribute('data-user-email') !== email)) {
                anyAttributionSpan.setAttribute('data-user-email', email);
             }
             if (email !== 'Unknown') {
                anyAttributionSpan.title = `Edited by: ${email}`;
             }
             anyAttributionSpan.style.setProperty('text-decoration-line', 'underline');
             anyAttributionSpan.style.setProperty('text-decoration-color', underlineColor, 'important');
             anyAttributionSpan.style.setProperty('-webkit-text-decoration-color', underlineColor, 'important');
           }
        }
      }

      // LOCKED TEXT PROTECTION: Skip over locked text or purge unlocked selection on deletion
      if (inputType === "deleteContentBackward" || inputType === "deleteContentForward") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          
          // For collapsed selection (single character delete)
          if (sel.isCollapsed) {
            const lockedBefore = findLockedElementBefore(range);
            if (lockedBefore) {
              e.preventDefault();
              e.stopPropagation();
              skipLockedTextBackward(lockedBefore, true);
              return;
            }

            if (inputType === "deleteContentForward") {
              // Delete key without selection: convert forward deletion to backward deletion (Backspace behavior)
              e.preventDefault();
              e.stopPropagation();

              const handledBlockBackspace = handleBlockBackspace(range);
              if (handledBlockBackspace) {
                return;
              }

              if (!disableStrikeOnDelete) {
                const converted = convertDeletionToStrike("Backspace");
                if (converted) {
                  setTimeout(() => {
                    syncAndNotify();
                    schedulePaginateRef.current();
                  }, 0);
                  return;
                }
              }

              const executed = document.execCommand('delete');
              if (!executed) {
                const node = range.startContainer;
                const offset = range.startOffset;
                if (node.nodeType === Node.TEXT_NODE && offset > 0) {
                  node.deleteData(offset - 1, 1);
                  const newR = document.createRange();
                  newR.setStart(node, offset - 1);
                  newR.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(newR);
                }
              }
              if (contentChangeHandlerRef.current && pagesContainerRef.current) {
                contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
              }
              syncAndNotify();
              schedulePaginateRef.current?.();
              return;
            }
          }
          else if (!sel.isCollapsed && containsLockedText(range)) {
            e.preventDefault();
            e.stopPropagation();
            deleteSelectionPreservingLocked(range);
            return;
          }
        }

        // Convert deletion into strike mark for normal editable content (for non-collapsed selections)
        if (!disableStrikeOnDelete) {
          const deletionKey = inputType === "deleteContentBackward" ? "Backspace" : "Delete";
          const converted = convertDeletionToStrike(deletionKey);
          if (converted) {
            e.preventDefault();
            setTimeout(() => {
              syncAndNotify();
              schedulePaginateRef.current();
            }, 0);
            return;
          }
        }
      }
      
      if (inputType === "insertFromPaste") {
        e.preventDefault();
        handlePaste(e);
        return;
      }
      if (inputType === "insertParagraph") {
        // Try custom handling first
        const handled = handleEnter();
        if (handled) {
          // Our custom handler processed the paragraph insertion
          e.preventDefault();
          return;
        }
        // If not handled, allow native browser behavior for complex content
        // Schedule content sync after native handling for complex structures
        setTimeout(() => {
          const sel = window.getSelection();
          const el = sel && sel.rangeCount ?
            (sel.getRangeAt(0).startContainer.nodeType === 1
              ? sel.getRangeAt(0).startContainer
              : sel.getRangeAt(0).startContainer.parentElement) : null;
          const isInComplexStructure = el?.closest('table, tr, td, th, ol, ul, li');
          if (isInComplexStructure) {
            syncAndNotify();
            // Force immediate page reflow for table growth near footer.
            schedulePaginateRef.current();
            requestAnimationFrame(() => {
              schedulePaginateRef.current();
            });
          }
        }, 0);
      }
      if (inputType === "insertLineBreak") {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode("\n"));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        debouncedPaginateInput();
      }
  }


  return {
    handleBeforeInput,
  };
};

export default useHandleBeforeInput;
