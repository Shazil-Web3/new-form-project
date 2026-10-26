import { useCallback } from 'react';
import { BLOCK_TYPES } from '../DocumentEngineConstants';

export function useEditorKeyboard({
  documentEngineRef,
  pagesContainerRef,
  imagePasteHandlerRef,
  ignoreNextTypingActionRef,
  selectAllAcrossPages,
  schedulePaginate,
  checkEarlyBreak,
  handleEnter,
  handleTextChange,
  renderFreshFromEngine,
  getPages,
  isPageEmpty,
  isCaretAtStartOf,
  placeCaretAtEnd,
  renumberPages,
  setCurrentPage,
  isInLockedText,
  findLockedElementBefore,
  findLockedElementAfter,
  skipLockedTextBackward,
  skipLockedTextForward,
  undo,
  redo,
  endTypingSession,
  pushToUndo,
}) {
  // Handle list-specific keyboard operations
  const handleListKeyDown = useCallback((event, listElement) => {
    let listItem = event.target;
    
    // Find the nearest <li> element
    while (listItem && listItem.nodeName !== "LI") {
      listItem = listItem.parentNode;
    }

    if (listItem && listItem.closest(".custom-numbered-list")) {
      if (event.key === "Tab") {
        event.preventDefault();

        if (event.shiftKey) {
          // Shift + Tab: Outdent
          let parentList = listItem.parentNode;
          if (parentList.nodeName === "OL" && parentList.classList.contains("custom-numbered-list")) {
            const grandparentLi = parentList.parentNode;
            if (grandparentLi && grandparentLi.nodeName === "LI") {
              // Nested item: promote it to a sibling of the grandparent <li>
              grandparentLi.parentNode.insertBefore(listItem, grandparentLi.nextSibling);
            } else {
              // Already at root level: move out of the list
              parentList.parentNode.insertBefore(listItem, parentList.nextSibling);
            }
            if (!parentList.hasChildNodes()) {
              parentList.remove();
            }
          }
        } else {
          // Tab: Indent — nest under the nearest preceding <li> sibling
          let prevItem = listItem.previousElementSibling;
          while (prevItem && prevItem.nodeName !== "LI") {
            prevItem = prevItem.previousElementSibling;
          }
          if (prevItem) {
            // Find an existing direct-child sublist of prevItem only
            let sublist = null;
            for (const child of prevItem.children) {
              if (child.nodeName === "OL" || child.nodeName === "UL") {
                sublist = child;
                break;
              }
            }
            if (!sublist) {
              sublist = document.createElement("ol");
              sublist.classList.add("custom-numbered-list");
              prevItem.appendChild(sublist);
            }
            sublist.appendChild(listItem);
          }
          // If there is no previous <li>, Tab on the first item does nothing
        }
      }
    }
  }, []);

  // Handle general keyboard operations
  const handleGeneralKeyDown = useCallback((event, element, block) => {
    if (event.key === "Tab") {
      event.preventDefault();
      // Use Range API instead of execCommand
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode('    '));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // Enter key handling is now done in handleBeforeInput
  }, []);

  // Enhanced keyboard handler with block-aware operations
  const handleKeyDown = useCallback((event) => {
    const debugPrefix = '[DEBUG:KeyDown]';

    // ── ENTRY LOG ──────────────────────────────────────────────────────────────
    console.log(`${debugPrefix} ▶ key="${event.key}" ctrl=${event.ctrlKey} meta=${event.metaKey} shift=${event.shiftKey} target=`, event.target);

    const selAtEntry = window.getSelection();
    if (selAtEntry && selAtEntry.rangeCount) {
      const _r = selAtEntry.getRangeAt(0);
      console.log(`${debugPrefix} SELECTION at entry: collapsed=${selAtEntry.isCollapsed}`);
      console.log(`${debugPrefix}   startContainer=`, _r.startContainer, `startOffset=${_r.startOffset}`);
      console.log(`${debugPrefix}   endContainer=`, _r.endContainer, `endOffset=${_r.endOffset}`);
      console.log(`${debugPrefix}   selected text (first 200 chars): "${selAtEntry.toString().slice(0, 200)}"`);
    } else {
      console.log(`${debugPrefix} SELECTION at entry: NONE (rangeCount=0)`);
    }
    // Intercept Undo / Redo key combinations
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
      console.log(`${debugPrefix} → Undo/Redo intercepted (Ctrl+Z shift=${event.shiftKey})`);
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        redo?.();
      } else {
        undo?.();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "y") {
      console.log(`${debugPrefix} → Redo intercepted (Ctrl+Y)`);
      event.preventDefault();
      event.stopPropagation();
      redo?.();
      return;
    }

    // For Backspace/Delete, end active typing sessions and record a snapshot before action
    if (event.key === "Backspace" || event.key === "Delete") {
      console.log(`${debugPrefix} SNAPSHOT: endTypingSession + pushToUndo for Backspace/Delete; ignoreNextTypingActionRef.current BEFORE=${ignoreNextTypingActionRef?.current}`);
      endTypingSession?.();
      pushToUndo?.();
      if (ignoreNextTypingActionRef) ignoreNextTypingActionRef.current = true;
      console.log(`${debugPrefix} SNAPSHOT: ignoreNextTypingActionRef.current AFTER=${ignoreNextTypingActionRef?.current}`);
    } else if (event.key === "Enter") {
      endTypingSession?.();
      pushToUndo?.();
      if (ignoreNextTypingActionRef) ignoreNextTypingActionRef.current = true;
    }

    // Ignore keyboard events from header/footer elements
    const isInHeader = event.target?.closest?.('.page-header');
    const isInFooter = event.target?.closest?.('.page-footer');
    console.log(`${debugPrefix} HEADER/FOOTER check: isInHeader=${!!isInHeader} isInFooter=${!!isInFooter}`);
    if (isInHeader || isInFooter) {
      console.log(`${debugPrefix} EARLY RETURN: event target is inside header/footer`);
      return; // Skip processing for header/footer input
    }

    // Locked text protection & skip behavior
    const sel = window.getSelection();
    console.log(`${debugPrefix} LOCKED TEXT CHECK: sel exists=${!!sel} rangeCount=${sel?.rangeCount}`);
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      
      // If we're inside locked text, allow ONLY navigation
      const _startInLocked = isInLockedText?.(range.startContainer);
      const _endInLocked = isInLockedText?.(range.endContainer);
      console.log(`${debugPrefix}   startInLocked=${_startInLocked} endInLocked=${_endInLocked}`);
      if (_startInLocked || _endInLocked) {
        if (!event.key.startsWith('Arrow') && !event.ctrlKey && !event.metaKey) {
          console.log(`${debugPrefix} EARLY RETURN: inside locked text, non-navigation key`);
          event.preventDefault();
          return;
        }
      }

      // Skip behavior for Backspace/Delete keys
      console.log(`${debugPrefix}   sel.isCollapsed=${sel.isCollapsed}`);
      if (sel.isCollapsed) {
        if (event.key === 'Backspace') {
          const lockedBefore = findLockedElementBefore?.(range);
          console.log(`${debugPrefix}   COLLAPSED Backspace: lockedBefore=`, lockedBefore);
          if (lockedBefore) {
            console.log(`${debugPrefix} EARLY RETURN: skipping locked text backward`);
            // Automatically jump and let the natural backspace continue
            skipLockedTextBackward?.(lockedBefore);
            return;
          }
        } else if (event.key === 'Delete') {
          const lockedAfter = findLockedElementAfter?.(range);
          console.log(`${debugPrefix}   COLLAPSED Delete: lockedAfter=`, lockedAfter);
          if (lockedAfter) {
            console.log(`${debugPrefix} EARLY RETURN: skipping locked text forward`);
            // Automatically jump and let the natural delete continue
            skipLockedTextForward?.(lockedAfter);
            return;
          }
        }
      } else {
        // Selection-based deletion: prevent if it contains locked text
        const hasLockedInRange = (() => {
          const frag = range.cloneContents();
          return frag.querySelector?.('[data-locked="true"], .locked-text.locked');
        })();
        console.log(`${debugPrefix}   NON-COLLAPSED selection (Backspace/Delete): hasLockedInRange=`, hasLockedInRange);
        
        if (hasLockedInRange && (event.key === 'Backspace' || event.key === 'Delete')) {
          console.log(`${debugPrefix} EARLY RETURN: selection contains locked text, preventing deletion`);
          event.preventDefault();
          return;
        }
      }
    }
    
    // Handle image deletion first
    if (imagePasteHandlerRef?.current) {
      const imageDeleted = imagePasteHandlerRef.current.handleImageDeletion(event);
      console.log(`${debugPrefix} IMAGE DELETION: handleImageDeletion returned=${imageDeleted}`);
      if (imageDeleted) {
        console.log(`${debugPrefix} EARLY RETURN: image was deleted by imagePasteHandler`);
        return;
      }
    } else {
      console.log(`${debugPrefix} IMAGE DELETION: imagePasteHandlerRef.current is null/undefined, skipping`);
    }
    
    // Handle ArrowDown with early break detection
    if (event.key === 'ArrowDown') {
      // Let the default behavior happen first, then check for pagination
      setTimeout(() => {
        // Get the current page content where the cursor is located
        const selection = window.getSelection();
        let currentContent = null;
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const startContainer = range.startContainer;
          const pageContent = startContainer.closest?.('.page-content');
          if (pageContent) {
            currentContent = pageContent;
          }
        }
        
        // Fallback to first page if we can't determine current page
        if (!currentContent) {
          currentContent = pagesContainerRef.current?.querySelector('.page .page-content');
        }
        
        if (currentContent && checkEarlyBreak?.(currentContent)) {
          console.log('ArrowDown triggered early break, forcing pagination');
          schedulePaginate?.();
        }
      }, 0);
    }

    // Handle Enter key as backup if beforeinput doesn't work
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleEnter?.();
      return;
    }

    // Global Select All across all pages
    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
      console.log(`${debugPrefix} CTRL+A: calling selectAllAcrossPages`);
      event.preventDefault();
      selectAllAcrossPages?.();
      // Log what was actually selected after selectAllAcrossPages runs
      setTimeout(() => {
        const _selAfterA = window.getSelection();
        if (_selAfterA && _selAfterA.rangeCount) {
          const _rA = _selAfterA.getRangeAt(0);
          console.log(`${debugPrefix} CTRL+A POST (async 0ms): collapsed=${_selAfterA.isCollapsed} text="${_selAfterA.toString().slice(0, 200)}"`  );
          console.log(`${debugPrefix}   startContainer=`, _rA.startContainer, `startOffset=${_rA.startOffset}`);
          console.log(`${debugPrefix}   endContainer=`, _rA.endContainer, `endOffset=${_rA.endOffset}`);
        } else {
          console.log(`${debugPrefix} CTRL+A POST (async 0ms): no selection after selectAllAcrossPages!`);
        }
      }, 0);
      return;
    }

    // Delete blank page when caret at page start (Google Docs behavior)
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      // If there is a selection (Ctrl+A), handle deletion across all pages
      console.log(`${debugPrefix} BACKSPACE BRANCH: sel.isCollapsed=${sel.isCollapsed}`);
      if (!sel.isCollapsed) {
        console.log(`${debugPrefix} BACKSPACE BRANCH: NON-COLLAPSED → entering custom multi-block deletion path`);
        event.preventDefault();
        
        // Get all selected content across all pages
        const range = sel.getRangeAt(0);
        console.log(`${debugPrefix}   Selection range: startContainer=`, range.startContainer, `startOffset=${range.startOffset}`);
        console.log(`${debugPrefix}   Selection range: endContainer=`, range.endContainer, `endOffset=${range.endOffset}`);
        console.log(`${debugPrefix}   Selected text (first 200): "${sel.toString().slice(0, 200)}"`);
        
        // Find all blocks that are selected across all pages
        const allBlocks = pagesContainerRef.current?.querySelectorAll('.page-content [data-block-id]') || [];
        const selectedBlocks = [];
        
        // Check which blocks are within the selection range
        allBlocks.forEach(block => {
          if (range.intersectsNode(block)) {
            selectedBlocks.push(block);
          }
        });

        console.log(`${debugPrefix}   Total DOM blocks found: ${allBlocks.length}`);
        console.log(`${debugPrefix}   Blocks intersecting selection: ${selectedBlocks.length}`);
        selectedBlocks.forEach((b, i) => {
          console.log(`${debugPrefix}     selectedBlock[${i}]: id="${b.dataset.blockId}" tag=${b.tagName} text="${b.textContent.slice(0, 80)}"`);
        });
        
        // If no blocks are selected but there's a selection, it might be partial text selection
        // In this case, we should clear the selection and let the browser handle it
        if (selectedBlocks.length === 0) {
          console.log(`${debugPrefix} ⚠️  selectedBlocks.length === 0 → EARLY RETURN (falling through to browser-native deletion)`);
          console.log(`${debugPrefix}   THIS IS A KEY CLUE: if you see this on the FIRST Ctrl+A+Backspace, the range is not intersecting any block-id elements`);
          // Let the browser handle partial text deletion
          return;
        }
        
        // Remove all selected blocks from the document engine
        console.log(`${debugPrefix}   Proceeding to remove ${selectedBlocks.length} block(s) from document engine`);
        selectedBlocks.forEach(block => {
          const blockId = block.dataset.blockId;
          if (blockId) {
            // Remove from all pages since removeBlock only works on current page
            documentEngineRef.current.document.pages.forEach((page, pIdx) => {
              const blockIndex = page.blocks.findIndex(b => b.id === blockId);
              if (blockIndex !== -1) {
                console.log(`${debugPrefix}     Removing blockId="${blockId}" from page[${pIdx}] at index ${blockIndex}`);
                page.blocks.splice(blockIndex, 1);
              }
            });
          } else {
            console.log(`${debugPrefix}     Block has no data-block-id, skipping engine removal`);
          }
        });
        
        // Clear the selection and place cursor at the beginning of the first page
        const firstPageContent = pagesContainerRef.current?.querySelector('.page .page-content');
        console.log(`${debugPrefix}   firstPageContent element:`, firstPageContent);
        if (firstPageContent) {
          const newRange = document.createRange();
          newRange.setStart(firstPageContent, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          console.log(`${debugPrefix}   Cursor repositioned to start of firstPageContent`);
        }
        
        // Ensure there's at least one empty block if all content was deleted
        const remainingBlocks = documentEngineRef.current.getAllBlocks();
        console.log(`${debugPrefix}   Remaining blocks in engine after removal: ${remainingBlocks.length}`);
        remainingBlocks.forEach((b, i) => console.log(`${debugPrefix}     engineBlock[${i}]: id="${b.id}" type="${b.type}" content="${String(b.content || '').slice(0, 80)}"`));

        if (remainingBlocks.length === 0) {
          console.log(`${debugPrefix}   No engine blocks remain → inserting empty paragraph block`);
          documentEngineRef.current.addBlock(
            documentEngineRef.current.createBlock(BLOCK_TYPES.PARAGRAPH, '')
          );
        }
        
        // Re-render the document with updated content
        console.log(`${debugPrefix}   Calling renderFreshFromEngine()...`);
        renderFreshFromEngine?.();

        // Async post-render check
        setTimeout(() => {
          const _blocksAfter = pagesContainerRef.current?.querySelectorAll('.page-content [data-block-id]') || [];
          console.log(`${debugPrefix} POST-RENDER CHECK (50ms async): DOM blocks count=${_blocksAfter.length}`);
          _blocksAfter.forEach((b, i) => {
            console.log(`${debugPrefix}   domBlock[${i}]: id="${b.dataset.blockId}" text="${b.textContent.slice(0, 80)}"`);
          });
          const _selPR = window.getSelection();
          if (_selPR && _selPR.rangeCount) {
            const _rPR = _selPR.getRangeAt(0);
            console.log(`${debugPrefix} POST-RENDER selection: collapsed=${_selPR.isCollapsed} startContainer=`, _rPR.startContainer, `offset=${_rPR.startOffset}`);
          }
        }, 50);

        return;
      }

      const firstContent = pagesContainerRef.current?.querySelector('.page .page-content');
      if (!firstContent) return;

      // caret inside any .page-content?
      const anchorEl = (sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement);
      const inContent = anchorEl?.closest?.('.page-content');

      // helper: is caret at very start of firstContent
      const atVeryStart = (() => {
        if (!inContent) return false;
        if (inContent !== firstContent) return false;
        const r = sel.getRangeAt(0).cloneRange();
        const before = document.createRange();
        before.selectNodeContents(firstContent);
        before.setEnd(r.startContainer, r.startOffset);
        return before.toString().length === 0;
      })();

      if (!inContent || atVeryStart) {
        event.preventDefault();
        // keep caret at start of firstContent
        const r = document.createRange();
        r.setStart(firstContent, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }

      // Handle page deletion when caret at start

      // find the page the caret is in
      const page = anchorEl?.closest?.('.page');
      const content = inContent || page?.querySelector('.page-content');

      if (page && content && isCaretAtStartOf?.(content)) {
        const pages = getPages?.() || [];
        const idx = pages.indexOf(page);

        // never remove the first page; only remove if this page is empty
        if (idx > 0 && isPageEmpty?.(page)) {
          event.preventDefault();

          // move caret to end of the previous page's content
          const prevPage = pages[idx - 1];
          const prevContent = prevPage.querySelector('.page-content');
          placeCaretAtEnd?.(prevContent);

          // remove the empty page
          page.remove();

          // renumber and reflect counters
          renumberPages?.();
          setCurrentPage?.(idx); // we just moved to previous page (1-based is idx)
          
          // optional: reflow to be safe (won't recreate the blank page)
          setTimeout(() => {
            schedulePaginate?.();        // keeps page X of Y consistent
            // no content change, but TOC and others are harmless to call
          }, 0);
          return;
        }
      }
    }

    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    let element = range.startContainer;

    // Find the current block element
    while (element && !element.dataset?.blockId) {
      element = element.parentElement;
    }

    if (element) {
      const blockId = element.dataset.blockId;
      const block = documentEngineRef.current.getBlock(blockId);
      
      if (block?.type === BLOCK_TYPES.LIST) {
        handleListKeyDown(event, element);
      } else {
        handleGeneralKeyDown(event, element, block);
      }
    }
  }, [
    documentEngineRef,
    pagesContainerRef,
    imagePasteHandlerRef,
    ignoreNextTypingActionRef,
    selectAllAcrossPages,
    schedulePaginate,
    checkEarlyBreak,
    handleEnter,
    renderFreshFromEngine,
    getPages,
    isPageEmpty,
    isCaretAtStartOf,
    placeCaretAtEnd,
    renumberPages,
    setCurrentPage,
    isInLockedText,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    undo,
    redo,
    endTypingSession,
    pushToUndo,
    handleListKeyDown,
    handleGeneralKeyDown,
  ]);

  return {
    handleKeyDown,
    handleListKeyDown,
    handleGeneralKeyDown,
  };
}

export default useEditorKeyboard;
