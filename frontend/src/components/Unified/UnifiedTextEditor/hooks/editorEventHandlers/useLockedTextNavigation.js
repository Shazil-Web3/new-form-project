import { useCallback } from "react";

export const useLockedTextNavigation = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  renderFreshFromEngineRef,
  savedSelectionRef,
  pushToUndo,
  selectAllActiveRef,
}) => {
  const containsLockedText = useCallback((range) => {
    if (!range) return false;
    
    // Check if the range contains any locked text spans
    const container = range.commonAncestorContainer;
    const parentElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container;
    
    // Check if we're inside or selecting locked text
    const lockedSpan = parentElement?.closest?.('[data-locked="true"], .locked-text');
    if (lockedSpan) return true;
    
    // Check if the range contains locked text elements
    const tempDiv = document.createElement('div');
    try {
      const clonedContents = range.cloneContents();
      tempDiv.appendChild(clonedContents);
      const hasLocked = tempDiv.querySelector('[data-locked="true"], .locked-text');
      if (hasLocked) return true;
    } catch (e) {}

    // Fallback: check intersecting elements from parent or pages container
    const searchRoot = parentElement || pagesContainerRef.current;
    if (searchRoot) {
      const lockedElements = searchRoot.querySelectorAll('[data-locked="true"], .locked-text');
      for (const locked of lockedElements) {
        try {
          if (range.intersectsNode(locked)) {
            return true;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return false;
  }, [pagesContainerRef]);

  // -------- Helper to check if an element is locked --------
  const isLockedElement = useCallback((el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    // Check for data-locked attribute
    if (el.getAttribute?.('data-locked') === 'true') return true;
    // Check for locked-text class
    if (el.classList?.contains('locked-text')) return true;
    // Check for contenteditable false with locked styling or locked classes
    if (el.getAttribute?.('contenteditable') === 'false' && 
        (el.style?.background?.includes('#e1e1e3') || el.hasAttribute?.('data-locked') || el.className?.includes?.('locked'))) return true;
    return false;
  }, []);

  // -------- Find locked element before cursor (for Backspace) --------
  const findLockedElementBefore = useCallback((range) => {
    if (!range || !range.collapsed) return null;
    
    const container = range.startContainer;
    const offset = range.startOffset;
    
    // Case 1: Check if cursor is inside a locked element
    let current = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== pagesContainerRef.current) {
      if (isLockedElement(current)) {
        return current;
      }
      const locked = current.closest?.('[data-locked="true"], .locked-text');
      if (locked) {
        return locked;
      }
      current = current.parentElement;
    }
    
    // Helper to check if text node has no visible characters
    const isTextEmpty = (txt) => !txt || !txt.replace(/[\u200B\u200C\u200D\uFEFF\s]/g, '').length;

    // Case 2: Cursor in text node, with no visible text before the cursor offset
    if (container.nodeType === Node.TEXT_NODE && isTextEmpty(container.textContent.slice(0, offset))) {
      let prevNode = container.previousSibling;
      while (prevNode) {
        if (prevNode.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(prevNode)) return prevNode;
          const nestedLocked = prevNode.querySelector?.('[data-locked="true"], .locked-text');
          if (nestedLocked) return nestedLocked;
          if (prevNode.textContent?.trim()) break;
        } else if (prevNode.nodeType === Node.TEXT_NODE) {
          if (!isTextEmpty(prevNode.textContent)) break;
        }
        prevNode = prevNode.previousSibling;
      }
      
      // If we're at start of parent element, look at parent's previous siblings
      if (!prevNode) {
        let parentEl = container.parentElement;
        while (parentEl && parentEl !== pagesContainerRef.current && !parentEl.hasAttribute?.('data-block-id')) {
          let pPrev = parentEl.previousSibling;
          while (pPrev) {
            if (pPrev.nodeType === Node.ELEMENT_NODE) {
              if (isLockedElement(pPrev)) return pPrev;
              const nested = pPrev.querySelector?.('[data-locked="true"], .locked-text');
              if (nested) return nested;
              if (pPrev.textContent?.trim()) break;
            } else if (pPrev.nodeType === Node.TEXT_NODE) {
              if (!isTextEmpty(pPrev.textContent)) break;
            }
            pPrev = pPrev.previousSibling;
          }
          parentEl = parentEl.parentElement;
        }
      }
    }
    
    // Case 3: Element node - check children before offset
    if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
      let idx = offset - 1;
      while (idx >= 0) {
        const prevChild = container.childNodes[idx];
        if (prevChild.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(prevChild)) return prevChild;
          const nestedLocked = prevChild.querySelector?.('[data-locked="true"], .locked-text');
          if (nestedLocked) return nestedLocked;
          if (prevChild.textContent?.trim()) break;
        } else if (prevChild.nodeType === Node.TEXT_NODE) {
          if (!isTextEmpty(prevChild.textContent)) break;
        }
        idx--;
      }
    }
    
    return null;
  }, [isLockedElement, pagesContainerRef]);

  // -------- Find locked element after cursor (for Delete) --------
  const findLockedElementAfter = useCallback((range) => {
    if (!range || !range.collapsed) return null;
    
    const container = range.startContainer;
    const offset = range.startOffset;
    
    // Case 1: Check if cursor is inside a locked element
    let current = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== pagesContainerRef.current) {
      if (isLockedElement(current)) {
        return current;
      }
      const locked = current.closest?.('[data-locked="true"], .locked-text');
      if (locked) {
        return locked;
      }
      current = current.parentElement;
    }
    
    const isTextEmpty = (txt) => !txt || !txt.replace(/[\u200B\u200C\u200D\uFEFF\s]/g, '').length;

    // Case 2: Cursor at end of text node (or only whitespace remaining after offset)
    if (container.nodeType === Node.TEXT_NODE && isTextEmpty(container.textContent.slice(offset))) {
      let nextNode = container.nextSibling;
      while (nextNode) {
        if (nextNode.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(nextNode)) return nextNode;
          const nestedLocked = nextNode.querySelector?.('[data-locked="true"], .locked-text');
          if (nestedLocked) return nestedLocked;
          if (nextNode.textContent?.trim()) break;
        } else if (nextNode.nodeType === Node.TEXT_NODE) {
          if (!isTextEmpty(nextNode.textContent)) break;
        }
        nextNode = nextNode.nextSibling;
      }
      
      if (!nextNode) {
        let parentEl = container.parentElement;
        while (parentEl && parentEl !== pagesContainerRef.current && !parentEl.hasAttribute?.('data-block-id')) {
          let pNext = parentEl.nextSibling;
          while (pNext) {
            if (pNext.nodeType === Node.ELEMENT_NODE) {
              if (isLockedElement(pNext)) return pNext;
              const nested = pNext.querySelector?.('[data-locked="true"], .locked-text');
              if (nested) return nested;
              if (pNext.textContent?.trim()) break;
            } else if (pNext.nodeType === Node.TEXT_NODE) {
              if (!isTextEmpty(pNext.textContent)) break;
            }
            pNext = pNext.nextSibling;
          }
          parentEl = parentEl.parentElement;
        }
      }
    }
    
    // Case 3: Element node with locked child at or after offset
    if (container.nodeType === Node.ELEMENT_NODE && offset < container.childNodes.length) {
      let idx = offset;
      while (idx < container.childNodes.length) {
        const nextChild = container.childNodes[idx];
        if (nextChild.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(nextChild)) return nextChild;
          const firstLocked = nextChild.querySelector?.('[data-locked="true"], .locked-text');
          if (firstLocked) return firstLocked;
          if (nextChild.textContent?.trim()) break;
        } else if (nextChild.nodeType === Node.TEXT_NODE) {
          if (!isTextEmpty(nextChild.textContent)) break;
        }
        idx++;
      }
    }
    
    return null;
  }, [isLockedElement, pagesContainerRef]);

  // -------- Skip locked text backward (Backspace) --------
  const skipLockedTextBackward = useCallback((lockedElement, performDelete = false) => {
    if (!lockedElement) return false;
    
    const sel = window.getSelection();
    if (!sel) return false;
    
    try {
      pushToUndo?.(true);
      const newRange = document.createRange();
      
      // Look backwards past any consecutive locked elements or empty text nodes
      let prev = lockedElement.previousSibling;
      while (prev && (isLockedElement(prev) || (prev.nodeType === Node.TEXT_NODE && !prev.textContent?.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').length && prev.previousSibling && isLockedElement(prev.previousSibling)))) {
        prev = prev.previousSibling;
      }

      let targetNode = null;
      let targetOffset = 0;
      
      if (prev) {
        if (prev.nodeType === Node.TEXT_NODE) {
          targetNode = prev;
          targetOffset = prev.textContent.length;
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
          let last = prev;
          while (last && last.lastChild) last = last.lastChild;
          if (last && last.nodeType === Node.TEXT_NODE && !last.parentElement?.closest('[data-locked="true"], .locked-text')) {
            targetNode = last;
            targetOffset = last.textContent.length;
          }
        }
      }
      
      if (!targetNode) {
        // No preceding editable text node — create one right before the locked element
        const parent = lockedElement.parentNode;
        if (parent) {
          targetNode = document.createTextNode('');
          parent.insertBefore(targetNode, lockedElement);
          targetOffset = 0;
        }
      }

      // Check if cursor was originally inside the locked element
      const curRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const isOriginallyInside = curRange && (
        lockedElement.contains(curRange.startContainer) || 
        curRange.startContainer.parentElement?.closest?.('[data-locked="true"], .locked-text') === lockedElement
      );

      // Only perform deletion if requested AND cursor was outside at the boundary AND there is text to delete
      const shouldDelete = performDelete && !isOriginallyInside && targetNode && targetOffset > 0;
      if (shouldDelete) {
        const text = targetNode.textContent;
        targetNode.textContent = text.slice(0, targetOffset - 1) + text.slice(targetOffset);
        targetOffset = Math.max(0, targetOffset - 1);
      }
      
      if (targetNode) {
        newRange.setStart(targetNode, targetOffset);
        newRange.collapse(true);
      } else {
        newRange.setStartBefore(lockedElement);
        newRange.collapse(true);
      }
      
      // Focus contenteditable root FIRST before applying the new selection range
      const root = pagesContainerRef.current;
      if (root && root.focus) {
        try {
          root.focus({ preventScroll: true });
        } catch (_) {}
      }

      sel.removeAllRanges();
      sel.addRange(newRange);
      if (savedSelectionRef) {
        savedSelectionRef.current = newRange.cloneRange();
      }

      if (shouldDelete) {
        if (contentChangeHandlerRef.current && root) {
          contentChangeHandlerRef.current.syncDOMToBlocks(root);
        }
        syncAndNotify(null, null, null, null, null, false, null, null, null, { skipPaginate: true });
      }

      // Re-assert focus so browser microtasks/state cannot blur the editor
      const ensureActive = () => {
        if (root && document.activeElement !== root) {
          try {
            root.focus({ preventScroll: true });
          } catch (_) {}
        }
        const curSel = window.getSelection();
        if (curSel && newRange) {
          try {
            curSel.removeAllRanges();
            curSel.addRange(newRange);
          } catch (_) {}
        }
      };

      setTimeout(ensureActive, 0);
      requestAnimationFrame(ensureActive);
      
      return true;
    } catch (e) {
      console.error('[EditorCore] Error skipping locked text backward:', e);
      return false;
    }
  }, [isLockedElement, pagesContainerRef, pushToUndo, savedSelectionRef, contentChangeHandlerRef, syncAndNotify]);

  // -------- Skip locked text forward (Delete) --------
  const skipLockedTextForward = useCallback((lockedElement, performDelete = false) => {
    if (!lockedElement) return false;
    
    const sel = window.getSelection();
    if (!sel) return false;
    
    try {
      pushToUndo?.(true);
      const newRange = document.createRange();
      
      // Look forwards past any consecutive locked elements or empty text nodes
      let next = lockedElement.nextSibling;
      while (next && (isLockedElement(next) || (next.nodeType === Node.TEXT_NODE && !next.textContent?.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').length && next.nextSibling && isLockedElement(next.nextSibling)))) {
        next = next.nextSibling;
      }

      let targetNode = null;
      let targetOffset = 0;
      
      if (next) {
        if (next.nodeType === Node.TEXT_NODE) {
          targetNode = next;
          targetOffset = 0;
        } else if (next.nodeType === Node.ELEMENT_NODE) {
          let first = next;
          while (first && first.firstChild) first = first.firstChild;
          if (first && first.nodeType === Node.TEXT_NODE && !first.parentElement?.closest('[data-locked="true"], .locked-text')) {
            targetNode = first;
            targetOffset = 0;
          }
        }
      }
      
      if (!targetNode) {
        const parent = lockedElement.parentNode;
        if (parent) {
          targetNode = document.createTextNode('');
          if (lockedElement.nextSibling) {
            parent.insertBefore(targetNode, lockedElement.nextSibling);
          } else {
            parent.appendChild(targetNode);
          }
          targetOffset = 0;
        }
      }

      // Check if cursor was originally inside the locked element
      const curRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const isOriginallyInside = curRange && (
        lockedElement.contains(curRange.startContainer) || 
        curRange.startContainer.parentElement?.closest?.('[data-locked="true"], .locked-text') === lockedElement
      );

      // Only perform deletion if requested AND cursor was outside at boundary AND there is text after locked element
      const shouldDelete = performDelete && !isOriginallyInside && targetNode && targetNode.textContent.length > 0;
      if (shouldDelete) {
        const text = targetNode.textContent;
        targetNode.textContent = text.slice(1);
        targetOffset = 0;
      }
      
      if (targetNode) {
        newRange.setStart(targetNode, targetOffset);
        newRange.collapse(true);
      } else {
        newRange.setStartAfter(lockedElement);
        newRange.collapse(true);
      }
      
      const root = pagesContainerRef.current;
      if (root && root.focus) {
        try {
          root.focus({ preventScroll: true });
        } catch (_) {}
      }

      sel.removeAllRanges();
      sel.addRange(newRange);
      if (savedSelectionRef) {
        savedSelectionRef.current = newRange.cloneRange();
      }

      if (shouldDelete) {
        if (contentChangeHandlerRef.current && root) {
          contentChangeHandlerRef.current.syncDOMToBlocks(root);
        }
        syncAndNotify(null, null, null, null, null, false, null, null, null, { skipPaginate: true });
      }

      const ensureActive = () => {
        if (root && document.activeElement !== root) {
          try {
            root.focus({ preventScroll: true });
          } catch (_) {}
        }
        const curSel = window.getSelection();
        if (curSel && newRange) {
          try {
            curSel.removeAllRanges();
            curSel.addRange(newRange);
          } catch (_) {}
        }
      };

      setTimeout(ensureActive, 0);
      requestAnimationFrame(ensureActive);
      
      return true;
    } catch (e) {
      console.error('[EditorCore] Error skipping locked text forward:', e);
      return false;
    }
  }, [isLockedElement, pagesContainerRef, pushToUndo, savedSelectionRef, contentChangeHandlerRef, syncAndNotify]);

  // -------- Delete Selection Preserving Locked Content --------
  const deleteSelectionPreservingLocked = useCallback((explicitRange = null) => {
    pushToUndo?.(true);
    const root = pagesContainerRef.current;
    if (!root) return;

    const sel = window.getSelection();
    const range = explicitRange || (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
    if (!range) return;

    const allBlocks = Array.from(root.querySelectorAll('.page-content [data-block-id]'));
    const isFullDoc = () => {
      if (selectAllActiveRef.current) return true;
      if (allBlocks.length <= 1) {
        const first = allBlocks[0];
        if (!first) return false;
        const text = first.textContent || '';
        return range.toString().length >= text.length;
      }
      const first = allBlocks[0];
      const last = allBlocks[allBlocks.length - 1];
      const pageContentText = Array.from(root.querySelectorAll('.page-content')).map(el => el.textContent || '').join('');
      return (first.contains(range.startContainer) || range.startContainer === root || root.contains(range.startContainer)) &&
             (last.contains(range.endContainer) || range.endContainer === root || root.contains(range.endContainer)) &&
             (pageContentText.length === 0 || range.toString().length >= pageContentText.length * 0.85);
    };

    const isAll = isFullDoc();
    selectAllActiveRef.current = false;

    // Helper to recursively purge unlocked nodes inside an element
    const purgeUnlockedFromElement = (el, lockedList) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      Array.from(el.childNodes).forEach(c => {
        if (lockedList.includes(c)) return;
        if (c.nodeType === Node.TEXT_NODE) {
          c.remove();
        } else if (c.nodeType === Node.ELEMENT_NODE) {
          const containsLocked = lockedList.some(l => c.contains(l));
          if (!containsLocked) {
            c.remove();
          } else {
            purgeUnlockedFromElement(c, lockedList);
          }
        }
      });
    };

    if (isAll) {
      const lockedSpansInDoc = Array.from(root.querySelectorAll('[data-locked="true"], .locked-text'));
      if (lockedSpansInDoc.length === 0) {
        const engine = documentEngineRef.current;
        if (engine) {
          const emptyBlock = engine.createBlock('paragraph', '');
          engine.document.pages = [{ id: 'page1', blocks: [emptyBlock] }];
          engine.currentPageIndex = 0;
          renderFreshFromEngineRef?.current?.();
          syncAndNotify();
          schedulePaginateRef.current?.();
        }
        return;
      }

      let remainingBlocks = 0;
      let firstPreservedLocked = null;

      allBlocks.forEach(block => {
        const lockedInBlock = Array.from(block.querySelectorAll('[data-locked="true"], .locked-text'));
        if (lockedInBlock.length === 0) {
          block.remove();
        } else {
          remainingBlocks++;
          if (!firstPreservedLocked && lockedInBlock[0]) {
            firstPreservedLocked = lockedInBlock[0];
          }
          const tag = block.tagName.toLowerCase();
          if (tag === 'table') {
            const cells = Array.from(block.querySelectorAll('td, th'));
            cells.forEach(cell => {
              const lockedInCell = Array.from(cell.querySelectorAll('[data-locked="true"], .locked-text'));
              if (lockedInCell.length === 0) {
                cell.innerHTML = '<br>';
              } else {
                Array.from(cell.childNodes).forEach(child => {
                  const hasLocked = lockedInCell.includes(child) || (child.nodeType === Node.ELEMENT_NODE && child.querySelector?.('[data-locked="true"], .locked-text'));
                  if (!hasLocked) {
                    child.remove();
                  } else if (!lockedInCell.includes(child)) {
                    purgeUnlockedFromElement(child, lockedInCell);
                  }
                });
              }
            });
          } else if (tag === 'ul' || tag === 'ol') {
            const lis = Array.from(block.querySelectorAll('li'));
            lis.forEach(li => {
              const lockedInLi = Array.from(li.querySelectorAll('[data-locked="true"], .locked-text'));
              if (lockedInLi.length === 0) {
                li.remove();
              } else {
                Array.from(li.childNodes).forEach(child => {
                  const hasLocked = lockedInLi.includes(child) || (child.nodeType === Node.ELEMENT_NODE && child.querySelector?.('[data-locked="true"], .locked-text'));
                  if (!hasLocked) {
                    child.remove();
                  } else if (!lockedInLi.includes(child)) {
                    purgeUnlockedFromElement(child, lockedInLi);
                  }
                });
              }
            });
          } else {
            Array.from(block.childNodes).forEach(child => {
              const hasLocked = lockedInBlock.includes(child) || (child.nodeType === Node.ELEMENT_NODE && child.querySelector?.('[data-locked="true"], .locked-text'));
              if (!hasLocked) {
                child.remove();
              } else if (!lockedInBlock.includes(child)) {
                purgeUnlockedFromElement(child, lockedInBlock);
              }
            });
          }
          block.normalize();
        }
      });

      if (remainingBlocks === 0) {
        const engine = documentEngineRef.current;
        if (engine) {
          const emptyBlock = engine.createBlock('paragraph', '');
          engine.document.pages = [{ id: 'page1', blocks: [emptyBlock] }];
        }
      }

      if (firstPreservedLocked) {
        skipLockedTextBackward(firstPreservedLocked, false);
      }

      if (contentChangeHandlerRef.current && root) {
        contentChangeHandlerRef.current.syncDOMToBlocks(root);
      }
      schedulePaginateRef.current?.();
      syncAndNotify();
      return;
    }

    // Partial selection: delete unlocked text inside range, preserve locked spans
    const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

    const treeWalker = document.createTreeWalker(
      ancestor || root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (range.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNodes = [];
    while (treeWalker.nextNode()) {
      textNodes.push(treeWalker.currentNode);
    }

    textNodes.forEach(node => {
      // If node is inside locked element, DO NOT TOUCH IT!
      if (node.parentElement?.closest('[data-locked="true"], .locked-text')) {
        return;
      }

      const isStart = node === range.startContainer;
      const isEnd = node === range.endContainer;

      if (isStart && isEnd) {
        const val = node.textContent;
        node.textContent = val.slice(0, range.startOffset) + val.slice(range.endOffset);
      } else if (isStart) {
        node.textContent = node.textContent.slice(0, range.startOffset);
      } else if (isEnd) {
        node.textContent = node.textContent.slice(range.endOffset);
      } else {
        node.remove();
      }
    });

    // Remove any empty blocks completely within range that have no locked text
    const intersectedBlocks = allBlocks.filter(b => range.intersectsNode(b));
    intersectedBlocks.forEach(b => {
      const lockedInB = b.querySelectorAll('[data-locked="true"], .locked-text');
      if (lockedInB.length === 0) {
        const text = (b.textContent || '').replace(/[\u200B\uFEFF\s]/g, '');
        if (text.length === 0 && intersectedBlocks.length > 1) {
          b.remove();
        }
      } else {
        b.normalize();
      }
    });

    if (sel) {
      let anchorNode = range.startContainer;
      let anchorOffset = range.startOffset;

      if (anchorNode.parentElement?.closest?.('[data-locked="true"], .locked-text')) {
        const lockedEl = anchorNode.parentElement.closest('[data-locked="true"], .locked-text');
        skipLockedTextBackward(lockedEl, false);
      } else if (anchorNode.parentNode) {
        const newR = document.createRange();
        newR.setStart(anchorNode, Math.min(anchorOffset, anchorNode.textContent?.length || 0));
        newR.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newR);
      }
    }

    if (contentChangeHandlerRef.current && root) {
      contentChangeHandlerRef.current.syncDOMToBlocks(root);
    }
    schedulePaginateRef.current?.();
    syncAndNotify();
  }, [skipLockedTextBackward, syncAndNotify, pushToUndo]);

  // -------- Comprehensive Lock/Unlock Selection (Single-line, Multi-line, Tables) --------

  return {
    containsLockedText,
    isLockedElement,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    deleteSelectionPreservingLocked,
  };
};

export default useLockedTextNavigation;
