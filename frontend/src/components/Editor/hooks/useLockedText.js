import { useCallback } from 'react';

export function useLockedText(pagesContainerRef) {
  // -------- Helper to check if an element is locked --------
  const isLockedElement = useCallback((el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    // Check for data-locked attribute
    if (el.getAttribute?.('data-locked') === 'true') return true;
    // Check for locked-text locked classes
    if (el.classList?.contains('locked-text') && el.classList?.contains('locked')) return true;
    return false;
  }, []);

  // -------- Find locked element before cursor (for Backspace) --------
  const findLockedElementBefore = useCallback((range) => {
    if (!range || !range.collapsed) return null;
    
    const container = range.startContainer;
    const offset = range.startOffset;
    
    // Case 1: Check if cursor is inside a locked element
    let current = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (isLockedElement(current)) {
        return current;
      }
      const locked = current.closest?.('[data-locked="true"], .locked-text.locked');
      if (locked) {
        return locked;
      }
      current = current.parentElement;
    }
    
    // Case 2: Cursor at start of text node - check previous siblings
    const isActuallyEmpty = (node) => {
      if (!node) return true;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        // Skip zero-width spaces, BOM, and whitespace-only nodes
        return !text.replace(/[\u200B\uFEFF\s]/g, '').length;
      }
      return false;
    };

    // Case 2: Cursor at start of text node - check previous siblings
    if (container.nodeType === Node.TEXT_NODE && offset === 0) {
      let prevNode = container.previousSibling;
      while (prevNode) {
        if (prevNode.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(prevNode)) {
            return prevNode;
          }
          const nestedLocked = prevNode.querySelector?.('[data-locked="true"], .locked-text.locked');
          if (nestedLocked) {
            return nestedLocked;
          }
          break; // Found a non-locked element
        } else if (!isActuallyEmpty(prevNode)) {
          // Found regular text
          break;
        }
        prevNode = prevNode.previousSibling;
      }
      
      if (!prevNode) {
        const parentElement = container.parentElement;
        if (parentElement && parentElement !== container) {
          let prevParentSibling = parentElement.previousSibling;
          if (prevParentSibling && isLockedElement(prevParentSibling)) {
            return prevParentSibling;
          }
        }
      }
    }
    
    // Case 3: Element node - check child at offset-1
    if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
      const prevChild = container.childNodes[offset - 1];
      if (prevChild && prevChild.nodeType === Node.ELEMENT_NODE) {
        if (isLockedElement(prevChild)) {
          return prevChild;
        }
        const lastLocked = prevChild.querySelector?.('[data-locked="true"]:last-child, .locked-text.locked:last-child');
        if (lastLocked) {
          return lastLocked;
        }
      }
    }
    
    // Case 4: Check if we're at position 1 in a text node where the previous char is inside locked
    if (container.nodeType === Node.TEXT_NODE && offset === 1) {
      const parent = container.parentElement;
      if (parent && isLockedElement(parent)) {
        return parent;
      }
    }
    
    return null;
  }, [isLockedElement]);

  // -------- Find locked element after cursor (for Delete) --------
  const findLockedElementAfter = useCallback((range) => {
    if (!range || !range.collapsed) return null;
    
    const container = range.startContainer;
    const offset = range.startOffset;
    
    let current = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (isLockedElement(current)) {
        return current;
      }
      const locked = current.closest?.('[data-locked="true"], .locked-text.locked');
      if (locked) {
        return locked;
      }
      current = current.parentElement;
    }
    
    if (container.nodeType === Node.TEXT_NODE && offset === container.textContent.length) {
      let nextNode = container.nextSibling;
      while (nextNode) {
        if (nextNode.nodeType === Node.ELEMENT_NODE) {
          if (isLockedElement(nextNode)) {
            return nextNode;
          }
          const nestedLocked = nextNode.querySelector?.('[data-locked="true"], .locked-text.locked');
          if (nestedLocked) {
            return nestedLocked;
          }
          break;
        } else if (nextNode.nodeType === Node.TEXT_NODE && nextNode.textContent.length > 0) {
          break;
        }
        nextNode = nextNode.nextSibling;
      }
    }
    
    if (container.nodeType === Node.ELEMENT_NODE && offset < container.childNodes.length) {
      const nextChild = container.childNodes[offset];
      if (nextChild && nextChild.nodeType === Node.ELEMENT_NODE) {
        if (isLockedElement(nextChild)) {
          return nextChild;
        }
        const firstLocked = nextChild.querySelector?.('[data-locked="true"]:first-child, .locked-text.locked:first-child');
        if (firstLocked) {
          return firstLocked;
        }
      }
    }
    
    if (container.nodeType === Node.TEXT_NODE && offset === container.textContent.length - 1) {
      const parent = container.parentElement;
      if (parent && isLockedElement(parent)) {
        return parent;
      }
    }
    
    return null;
  }, [isLockedElement]);

  const skipLockedTextBackward = useCallback((lockedElement) => {
    if (!lockedElement) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    
    try {
      const newRange = document.createRange();
      newRange.setStartBefore(lockedElement);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      
      // Ensure focus is maintained on the block
      const block = lockedElement.closest('[data-block-id]');
      if (block) {
        block.focus();
      }
      
      return true;
    } catch (e) {
      console.error('[Editor] Error skipping locked text backward:', e);
      return false;
    }
  }, []);

  const skipLockedTextForward = useCallback((lockedElement) => {
    if (!lockedElement) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    
    try {
      const newRange = document.createRange();
      newRange.setStartAfter(lockedElement);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      
      // Ensure focus is maintained on the block
      const block = lockedElement.closest('[data-block-id]');
      if (block) {
        block.focus();
      }
      
      return true;
    } catch (e) {
      console.error('[Editor] Error skipping locked text forward:', e);
      return false;
    }
  }, []);

  // Helper to check if node is in locked text
  const isInLockedText = useCallback((node) => {
    if (!node) return null;
    let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const container = pagesContainerRef.current;
    while (current && current !== container) {
      if (isLockedElement(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }, [isLockedElement]);

  return {
    isLockedElement,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    isInLockedText,
  };
}

export default useLockedText;
