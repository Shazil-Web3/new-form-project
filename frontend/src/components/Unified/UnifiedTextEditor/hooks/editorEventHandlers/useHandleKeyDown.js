import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";
import { applyTextAlignment } from "../../../../Editor/textAlignment/textAlignment";

export const useHandleKeyDown = ({
  pagesContainerRef,
  documentEngineRef,
  imagePasteHandlerRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  renderFreshFromEngineRef,
  setIsFullScreen,
  isFullScreen,
  onTyping,
  readOnly,
  disableStrikeOnDelete,
  undo,
  redo,
  pushToUndo,
  endTypingSession,
  ignoreNextTypingActionRef,
  caretManagerRef,
  selectAllActiveRef,
  shiftPressedCellRef,
  shiftHadOtherKeysRef,
  convertDeletionToStrike,
  setCaretInBlock,
  createParagraphBelow,
  containsLockedText,
  findLockedElementBefore,
  skipLockedTextBackward,
  deleteSelectionPreservingLocked,
  deleteAcrossHosts,
  handleBlockBackspace,
  handleEnter,
  handlePageBreak,
  handleTableCellNavigation,
  isDeletionInFlightRef,
}) => {
  function handleKeyDown(event) {
      if (readOnly) {
        const isModifier = event.key === 'Control' || event.key === 'Meta' || event.key === 'Shift' || event.key === 'Alt';
        const isNavigation = event.key.startsWith('Arrow') || event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'Home' || event.key === 'End';
        const isCopy = (event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C');
        const isSelectAll = (event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A');
        const isFind = (event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F' || event.key === 'h' || event.key === 'H');
        const isEscape = event.key === 'Escape';

        if (isEscape && isFullScreen) {
          setIsFullScreen(false);
          return;
        }

        if (isModifier || isNavigation || isCopy || isSelectAll || isFind) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onTyping?.();

      const isNavigationKey =
        event.key.startsWith('Arrow') ||
        event.key === 'PageUp' ||
        event.key === 'PageDown' ||
        event.key === 'Home' ||
        event.key === 'End';

      if (isNavigationKey) {
        caretManagerRef?.current?.onEditingAction('navigation', {
          behavior: (event.key === 'PageUp' || event.key === 'PageDown') ? 'smooth' : 'auto'
        });
      }

      const isModifier = event.key === 'Control' || event.key === 'Meta' || event.key === 'Alt' || event.ctrlKey || event.metaKey;
      if (!isModifier && !isNavigationKey) {
        caretManagerRef?.current?.onEditingAction(event.key === 'Backspace' || event.key === 'Delete' ? 'delete' : 'keydown');
      }

      // ═══ TABLE CELL KEYBOARD NAVIGATION (Tab / Shift + Tab / Shift) ═══
      let tableNavSelection = window.getSelection();
      let currentTableCell = null;
      if (tableNavSelection && tableNavSelection.rangeCount > 0) {
        let node = tableNavSelection.getRangeAt(0).startContainer;
        while (node && node !== pagesContainerRef.current) {
          if (node.nodeName === "TD" || node.nodeName === "TH") {
            currentTableCell = node;
            break;
          }
          node = node.parentNode;
        }
      }
      if (!currentTableCell && (event.target?.closest || document.activeElement?.closest)) {
        const target = event.target || document.activeElement;
        currentTableCell = target.closest?.("td, th");
      }

      if (currentTableCell) {
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          
          // Mark that Tab was pressed while Shift was down so Shift keyup won't trigger forward move
          shiftHadOtherKeysRef.current = true;
          shiftPressedCellRef.current = null;

          // Tab moves rightward (next cell); Shift + Tab moves leftward (previous cell)
          const moveForward = !event.shiftKey;
          handleTableCellNavigation(currentTableCell, moveForward);
          return;
        } else if (event.key === "Shift") {
          shiftPressedCellRef.current = currentTableCell;
          shiftHadOtherKeysRef.current = false;
        } else if (event.key === "Backspace" || event.key === "Delete") {
          shiftHadOtherKeysRef.current = true;
          let sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const textContent = currentTableCell.textContent || "";
            // Measure all visible text before the cursor within the entire cell.
            // A plain `startOffset === 0` check is unreliable when the cursor is inside
            // a nested text node (e.g. right after a locked span): offset would be 0
            // even though editable text exists earlier in the cell, causing all unlocked
            // content to be wiped in one backspace instead of one character at a time.
            let isAtStart = false;
            if (range.collapsed) {
              try {
                const preRange = document.createRange();
                preRange.selectNodeContents(currentTableCell);
                preRange.setEnd(range.startContainer, range.startOffset);
                isAtStart = preRange.toString().length === 0;
              } catch (_) {
                isAtStart = range.startOffset === 0;
              }
            }
            const isEntireCellSelected = range.toString().length >= textContent.length && textContent.length > 0;

            if (isEntireCellSelected || textContent.trim() === "" || (isAtStart && (event.key === "Backspace" || event.key === "Delete"))) {
              event.preventDefault();
              event.stopPropagation();

              const lockedInCell = Array.from(currentTableCell.querySelectorAll('[data-locked="true"], .locked-text'));
              if (lockedInCell.length > 0) {
                // Cell contains locked text - clear only unlocked nodes, walking into any
                // wrapper (e.g. a <p>) that merely CONTAINS locked content instead of
                // deleting the whole wrapper (which used to take the locked text with it).
                const isLockedNode = (node) => node.nodeType === Node.ELEMENT_NODE && node.matches?.('[data-locked="true"], .locked-text');
                const containsLocked = (node) => node.nodeType === Node.ELEMENT_NODE && !!node.querySelector?.('[data-locked="true"], .locked-text');
                const clearUnlockedContent = (node) => {
                  Array.from(node.childNodes).forEach(child => {
                    if (isLockedNode(child)) return;
                    if (containsLocked(child)) {
                      clearUnlockedContent(child);
                    } else {
                      child.remove();
                    }
                  });
                };
                clearUnlockedContent(currentTableCell);
                currentTableCell.normalize();
              } else {
                currentTableCell.innerHTML = "";
              }
              const newRange = document.createRange();
              newRange.selectNodeContents(currentTableCell);
              newRange.collapse(false);
              sel.removeAllRanges();
              sel.addRange(newRange);

              if (contentChangeHandlerRef.current && pagesContainerRef.current) {
                contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
              }
              syncAndNotify(null, null, null, null, null, true);
              return;
            }
          }
        } else if (event.key === "ArrowDown") {
          shiftHadOtherKeysRef.current = true;
          const tr = currentTableCell.closest("tr");
          const table = currentTableCell.closest("table");
          if (table && tr) {
            const rows = Array.from(table.querySelectorAll("tr"));
            const isLastRow = rows[rows.length - 1] === tr;
            if (isLastRow) {
              const sel = window.getSelection();
              let isAtCellEnd = true;
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                  if (range.startOffset < (range.startContainer.nodeValue?.length || 0)) {
                    isAtCellEnd = false;
                  }
                } else if (range.startContainer === currentTableCell && range.startOffset < currentTableCell.childNodes.length) {
                  isAtCellEnd = false;
                }
              }
              if (isAtCellEnd) {
                event.preventDefault();
                event.stopPropagation();
                let nextBlock = table.nextElementSibling;
                while (nextBlock && !['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(nextBlock.tagName.toLowerCase())) {
                  if (nextBlock.tagName.toLowerCase() === 'table') break;
                  nextBlock = nextBlock.nextElementSibling;
                }
                if (nextBlock && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(nextBlock.tagName.toLowerCase())) {
                  setCaretInBlock(nextBlock, false);
                } else {
                  const parentContent = table.closest(".page-content");
                  createParagraphBelow(table, parentContent);
                }
                return;
              }
            }
          }
        } else {
          shiftHadOtherKeysRef.current = true;
        }
      } else {
        if (event.key !== "Shift") {
          shiftHadOtherKeysRef.current = true;
        }
      }

      if (event.key === "Tab") {
        let selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let range = selection.getRangeAt(0);
          let listItem = range.startContainer;

          // Find the nearest <li> element
          while (listItem && listItem.nodeName !== "LI") {
            listItem = listItem.parentNode;
            if (!listItem) break;
          }

          // Only handle tabbing inside a list item
          if (listItem && (listItem.closest(".custom-numbered-list") || listItem.closest("ol, ul"))) {
            event.preventDefault();
            event.stopPropagation();
            endTypingSession?.();
            pushToUndo?.();

            if (event.shiftKey) {
              // Shift + Tab: Outdent
              let parentList = listItem.parentNode;
              if (parentList && (parentList.nodeName === "OL" || parentList.nodeName === "UL")) {
                const grandparentLi = parentList.parentNode;
                if (grandparentLi && grandparentLi.nodeName === "LI") {
                  // Nested item: promote it to a sibling of the grandparent <li>
                  // in the grandparent's parent list (the top-level <ol>/<ul>)
                  grandparentLi.parentNode.insertBefore(listItem, grandparentLi.nextSibling);
                } else {
                  // Already at root level: just move out of the list altogether
                  parentList.parentNode.insertBefore(listItem, parentList.nextSibling);
                }
                if (!parentList.hasChildNodes()) {
                  parentList.remove();
                }
              }
            } else {
              // Tab: Indent (limited to 1 level. If already nested, it outdents back to parent level)
              let parentList = listItem.parentNode;
              let grandparentLi = parentList?.parentNode;
              const isAlreadyNested = grandparentLi && grandparentLi.nodeName === "LI";

              if (isAlreadyNested) {
                // Already nested: outdent back to root level
                grandparentLi.parentNode.insertBefore(listItem, grandparentLi.nextSibling);
                if (!parentList.hasChildNodes()) {
                  parentList.remove();
                }
              } else {
                // At root level: indent — nest under the nearest preceding <li> sibling
                // Walk backwards past any non-LI elements (e.g. nested <ol>/<ul> blocks)
                let prevItem = listItem.previousElementSibling;
                while (prevItem && prevItem.nodeName !== "LI") {
                  prevItem = prevItem.previousElementSibling;
                }
                if (prevItem) {
                  // Find an existing direct-child sublist of prevItem, not a deeper descendant
                  let sublist = null;
                  for (const child of prevItem.children) {
                    if (child.nodeName === "OL" || child.nodeName === "UL") {
                      sublist = child;
                      break;
                    }
                  }
                  if (!sublist) {
                    const parentTag = listItem.parentNode.tagName.toLowerCase();
                    sublist = document.createElement(parentTag);
                    if (parentTag === "ol") {
                      sublist.classList.add("custom-numbered-list");
                    }
                    prevItem.appendChild(sublist);
                  }
                  sublist.appendChild(listItem);
                }
                // If there is no previous <li>, Tab on the first item does nothing
              }
            }

            // Sync with document engine and update pages synchronously
            if (contentChangeHandlerRef.current && pagesContainerRef.current) {
              contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
            }
            syncAndNotify(null, null, null, null, null, true);
            if (schedulePaginateRef.current) {
              schedulePaginateRef.current();
            }
            return;
          }
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
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
        event.preventDefault();
        event.stopPropagation();
        redo?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        const key = event.key.toLowerCase();
        const shortcutAlign =
          key === "l" ? "left" : key === "e" ? "center" : key === "r" ? "right" : key === "j" ? "justify" : null;
        if (shortcutAlign) {
          event.preventDefault();
          event.stopPropagation();
          pushToUndo?.();
          applyTextAlignment(shortcutAlign, {
            syncDOMToBlocksSync: () => {
              if (contentChangeHandlerRef.current && pagesContainerRef.current) {
                contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
              }
            },
            schedulePaginate: () => schedulePaginateRef.current?.(),
            onAfterAction: () => syncAndNotify?.(),
          });
          return;
        }
      }

      // For Backspace/Delete, make sure a snapshot is taken before deletion to preserve highlights/elements
      if (event.key === "Backspace" || event.key === "Delete") {
        endTypingSession?.();
        pushToUndo?.(true);
        if (ignoreNextTypingActionRef) {
          ignoreNextTypingActionRef.current = true;
        }
      } else if (event.key === " " || event.key === "Spacebar" || event.key === "Tab") {
        endTypingSession?.();
      } else if (event.key === "Enter") {
        endTypingSession?.();
        pushToUndo?.(true);
        if (ignoreNextTypingActionRef) {
          ignoreNextTypingActionRef.current = true;
        }
      }

      // Handle image deletion first
      if (imagePasteHandlerRef.current) {
        const imageDeleted = imagePasteHandlerRef.current.handleImageDeletion(event);
        if (imageDeleted) return;
      }

      // Smart Media Block (Video/Image) Deletion handler
      if (event.key === "Backspace" || event.key === "Delete") {
        const root = pagesContainerRef.current;
        if (root) {
          // 1. Check if a figure (video or image) is selected directly
          const selectedMedia = root.querySelector("figure.video-block.selected, figure.img-block.selected");
          if (selectedMedia) {
            event.preventDefault();
            pushToUndo?.(true);
            let targetCaret = selectedMedia.previousElementSibling || selectedMedia.nextElementSibling;
            selectedMedia.remove();
            if (targetCaret && targetCaret.hasAttribute("data-block-id")) {
              const r = document.createRange();
              r.selectNodeContents(targetCaret);
              r.collapse(false);
              const s = window.getSelection();
              s?.removeAllRanges();
              s?.addRange(r);
            }
            contentChangeHandlerRef.current?.syncDOMToBlocks(root);
            schedulePaginateRef.current?.();
            syncAndNotify?.();
            return;
          }

          // 2. Check if collapsed cursor is adjacent to a media block
          const sel = window.getSelection();
          if (sel && sel.rangeCount && sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const containerNode = range.startContainer;
            const offset = range.startOffset;

            let blockEl = containerNode.nodeType === Node.ELEMENT_NODE
              ? containerNode.closest("[data-block-id]")
              : containerNode.parentElement?.closest("[data-block-id]");

            if (blockEl) {
              if (event.key === "Backspace" && offset === 0) {
                let prev = blockEl.previousElementSibling;
                if (prev && (prev.classList.contains("video-block") || prev.classList.contains("img-block") || prev.tagName.toLowerCase() === "figure")) {
                  event.preventDefault();
                  pushToUndo?.(true);
                  prev.remove();
                  contentChangeHandlerRef.current?.syncDOMToBlocks(root);
                  schedulePaginateRef.current?.();
                  syncAndNotify?.();
                  return;
                }
              }
            }
          }

          // 3. Check if non-collapsed selection range intersects any media figure
          if (sel && sel.rangeCount && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const mediaBlocks = Array.from(root.querySelectorAll("figure.video-block, figure.img-block"));
            const intersected = mediaBlocks.filter(fig => range.intersectsNode(fig));
            if (intersected.length > 0) {
              pushToUndo?.(true);
              intersected.forEach(fig => fig.remove());
              contentChangeHandlerRef.current?.syncDOMToBlocks(root);
            }
          }
        }
      }
      // Reset select-all flag for any key that isn't Delete/Backspace/modifier
      if (event.key !== "Backspace" && event.key !== "Delete" && 
          event.key !== "Control" && event.key !== "Shift" && event.key !== "Alt" && event.key !== "Meta") {
        selectAllActiveRef.current = false;
      }

      if ((event.key === "Backspace" || event.key === "Delete")) {
        const sel = window.getSelection();
        
        // ═══ SELECT-ALL + DELETE: if Ctrl+A was just used, preserve locked text ═══
        if (selectAllActiveRef.current) {
          console.log('🗑️ [CTRL+A+DELETE] Starting full document deletion');
          event.preventDefault();
          event.stopPropagation();
          
          // Mark that a deletion is in flight to prevent LIVE SOURCE UPDATES from reverting content
          if (isDeletionInFlightRef) {
            isDeletionInFlightRef.current = true;
            console.log('🗑️ [CTRL+A+DELETE] Set isDeletionInFlightRef = true');
          }
          
          console.log('🗑️ [CTRL+A+DELETE] DOM before deletion:', pagesContainerRef?.current?.innerHTML?.substring(0, 100));
          deleteSelectionPreservingLocked(sel?.rangeCount ? sel.getRangeAt(0) : null);
          console.log('🗑️ [CTRL+A+DELETE] DOM after deleteSelectionPreservingLocked:', pagesContainerRef?.current?.innerHTML?.substring(0, 100));
          
          // Sync the DOM changes back to the document engine
          if (pagesContainerRef?.current) {
            contentChangeHandlerRef.current?.syncDOMToBlocks(pagesContainerRef.current);
            console.log('🗑️ [CTRL+A+DELETE] Called syncDOMToBlocks');
          }
          schedulePaginateRef.current?.();
          console.log('🗑️ [CTRL+A+DELETE] Called schedulePaginate');
          
          syncAndNotify?.();
          console.log('🗑️ [CTRL+A+DELETE] Called syncAndNotify');
          
          // Clear the flag after a short delay to allow the deletion to settle
          setTimeout(() => {
            if (isDeletionInFlightRef) {
              isDeletionInFlightRef.current = false;
              console.log('🗑️ [CTRL+A+DELETE] Cleared isDeletionInFlightRef after 500ms');
            }
          }, 500);
          
          selectAllActiveRef.current = false;
          return;
        }
        
        if (sel && sel.rangeCount && !sel.isCollapsed) {
          pushToUndo?.(true);
          const range = sel.getRangeAt(0);
          
          // LOCKED TEXT PROTECTION: If selection contains locked text, delete unlocked text while preserving locked text!
          const hasLockedText = containsLockedText(range);
          if (hasLockedText) {
            event.preventDefault();
            event.stopPropagation();
            deleteSelectionPreservingLocked(range);
            return;
          }
          
          const startHost = (range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement
          )?.closest(".page-content");
          const endHost = (range.endContainer.nodeType === Node.ELEMENT_NODE
            ? range.endContainer
            : range.endContainer.parentElement
          )?.closest(".page-content");

          if (startHost && endHost && startHost !== endHost) {
            event.preventDefault();
            const handled = deleteAcrossHosts();
            if (handled) return;

            // FALLBACK: deleteAcrossHosts couldn't handle it — clear the entire document
            const engine = documentEngineRef.current;
            if (engine) {
              const emptyBlock = engine.createBlock('paragraph', '');
              engine.document.pages = [{ id: 'page1', blocks: [emptyBlock] }];
              engine.currentPageIndex = 0;
              renderFreshFromEngineRef?.current?.();
              syncAndNotify();
              schedulePaginateRef.current();
            }
            return;
          }

          // Delete all selected text/nodes across single or multiple blocks cleanly
          event.preventDefault();
          event.stopPropagation();

          const containerRoot = pagesContainerRef.current;
          const startBlock = (range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement
          )?.closest('[data-block-id], p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, figure');

          range.deleteContents();

          if (startBlock) {
            const listParent = startBlock.tagName.toLowerCase() === 'li' 
              ? startBlock.closest('ol, ul') 
              : ((startBlock.tagName.toLowerCase() === 'ol' || startBlock.tagName.toLowerCase() === 'ul') ? startBlock : null);
            const isListEmpty = listParent && !(listParent.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();

            if (isListEmpty) {
              const blockId = listParent.getAttribute('data-block-id');
              const p = document.createElement('p');
              if (blockId) {
                p.setAttribute('data-block-id', blockId);
                const engine = documentEngineRef.current;
                if (engine && engine.getBlock(blockId)) {
                  engine.updateBlock(blockId, { type: BLOCK_TYPES.PARAGRAPH, content: '' });
                }
              }
              p.innerHTML = '<br>';
              p.contentEditable = 'true';
              listParent.replaceWith(p);
              const r = document.createRange();
              r.setStart(p, 0);
              r.collapse(true);
              const s = window.getSelection();
              if (s) {
                s.removeAllRanges();
                s.addRange(r);
              }
            } else {
              // After deleteContents() the range is already collapsed at the
              // deletion point — that is exactly where the caret should stay.
              // We only need a visible <br> when the block becomes empty, then
              // restore the caret to the deletion point instead of forcing it
              // to the start of the block.
              const text = (startBlock.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
              if (!text && !startBlock.querySelector('img, video, iframe, table, canvas, svg, br')) {
                startBlock.appendChild(document.createElement('br'));
              }
              const s = window.getSelection();
              if (s) {
                // range is collapsed at the correct position after
                // deleteContents(). If the caret is still inside the block,
                // keep it there; otherwise fall back to the block start.
                if (startBlock.contains(range.startContainer) || range.startContainer === startBlock) {
                  s.removeAllRanges();
                  s.addRange(range);
                } else {
                  const r = document.createRange();
                  r.selectNodeContents(startBlock);
                  r.collapse(true);
                  s.removeAllRanges();
                  s.addRange(r);
                }
              }
            }
          }

          if (containerRoot) {
            contentChangeHandlerRef.current?.syncDOMToBlocks(containerRoot);
          }
          schedulePaginateRef.current?.();
          syncAndNotify?.();
          return;
        } else if (sel && sel.rangeCount && sel.isCollapsed) {
          // Handle single character deletion (collapsed cursor)
          const range = sel.getRangeAt(0);
          const isBackspaceKey = event.key === "Backspace";
          const isForwardDeleteKey = event.key === "Delete";

          // ── Delete key with no selection: do nothing ──
          // The Delete key should only delete content when text is actually selected.
          // With a collapsed cursor it must NOT behave like Backspace (deleting the char
          // before the caret) nor perform a forward character delete — it simply does
          // nothing until the user makes a selection.
          if (isForwardDeleteKey) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          // 1. Block boundary merge — backward for Backspace only
          if (isBackspaceKey) {
            const handledBlockBackspace = handleBlockBackspace(range);
            if (handledBlockBackspace) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
          }

          // 2. Skip over locked text before cursor (Backspace only)
          if (isBackspaceKey) {
            const lockedBefore = findLockedElementBefore(range);
            if (lockedBefore) {
              event.preventDefault();
              event.stopPropagation();
              skipLockedTextBackward(lockedBefore, true);
              return;
            }
          }

          // 3. Collapsed deletion in tracking/review mode becomes a single-char strike.
          // (Only reached for Backspace — Delete already returned above. Backspace
          // strikes the char before the cursor.)
          if (!disableStrikeOnDelete) {
            const converted = convertDeletionToStrike(event.key);
            if (converted) {
              event.preventDefault();
              event.stopPropagation();
              syncAndNotify();
              schedulePaginateRef.current();
              return;
            }
          }

          // Backspace with collapsed cursor falls through to the browser's native
          // backspace behaviour (deletes the character before the caret).
        }
      }

      if (event.key === "Enter") {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          handlePageBreak();
          return;
        }

        caretManagerRef?.current?.onEditingAction('enter');
        if (!event.shiftKey) {
          pushToUndo?.();
          // Try custom handling first
          const handled = handleEnter();
          if (handled) {
            // Our custom handler processed the Enter key
            event.preventDefault();
            return;
          }
          // If not handled, allow native browser behavior for complex content
          // (like tables, where browsers naturally handle Enter key for line breaks)
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
                caretManagerRef?.current?.onEditingAction('enter');
              });
            }
          }, 0);
        }
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "a" || event.key === "A")
      ) {
        event.preventDefault();
        const root = pagesContainerRef.current;
        if (!root) return;

        // Save scroll position of scroll container and window before selecting
        const scrollParent = root.closest('.editor-scroll-container, .document-scroll-container, .editor-container') || root.parentElement || document.documentElement;
        const savedScrollTop = scrollParent.scrollTop !== undefined ? scrollParent.scrollTop : window.scrollY;
        const savedScrollLeft = scrollParent.scrollLeft !== undefined ? scrollParent.scrollLeft : window.scrollX;

        const blocks = root.querySelectorAll(".page-content [data-block-id]");
        if (blocks.length === 0) return;
        const first = blocks[0];
        const last = blocks[blocks.length - 1];

        const firstTextNode = (n) => {
          let node = n;
          while (node && node.firstChild) node = node.firstChild;
          return node || n;
        };
        const lastTextNode = (n) => {
          let node = n;
          while (node && node.lastChild) node = node.lastChild;
          return node || n;
        };

        const startNode = firstTextNode(first);
        const endNode = lastTextNode(last);

        const range = document.createRange();
        range.setStart(startNode, 0);
        const endOffset =
          endNode.nodeType === Node.TEXT_NODE
            ? endNode.textContent.length
            : endNode.childNodes?.length || 0;
        range.setEnd(endNode, endOffset);

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const startHost = first.closest(".page-content");
        if (startHost && startHost.focus) {
          try {
            startHost.focus({ preventScroll: true });
          } catch (_) {}
        }

        // Restore scroll position immediately to prevent auto-scrolling
        if (scrollParent.scrollTop !== undefined && scrollParent.scrollTop !== savedScrollTop) {
          scrollParent.scrollTop = savedScrollTop;
          scrollParent.scrollLeft = savedScrollLeft;
        }

        // Flag that select-all is active — next Delete/Backspace should clear everything
        selectAllActiveRef.current = true;
      }

      // Escape to exit full screen
      if (event.key === "Escape" && isFullScreen) setIsFullScreen(false);
  }


  return {
    handleKeyDown,
  };
};

export default useHandleKeyDown;
