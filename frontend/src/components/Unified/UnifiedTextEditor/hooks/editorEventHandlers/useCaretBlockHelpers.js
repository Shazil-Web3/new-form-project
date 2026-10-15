import { useCallback } from "react";
import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";

export const useCaretBlockHelpers = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  currentUser,
  user,
  savedSelectionRef,
}) => {
  const setCaretInBlock = useCallback((block, atEnd = true) => {
    if (!block) return;
    if (block.classList?.contains('page-break-marker') || block.getAttribute?.('data-page-break') === 'true') {
      return;
    }

    const tag = block.tagName ? block.tagName.toLowerCase() : '';

    // Empty paragraph or block element without child nodes cannot anchor a visible caret in Chrome.
    // Ensure empty non-table blocks contain a <br> child!
    if (tag !== 'table' && !block.querySelector('img, video, iframe, table, canvas, svg')) {
      const txt = (block.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF\s]/g, '');
      if (block.childNodes.length === 0 || (txt.length === 0 && !block.querySelector('br'))) {
        block.innerHTML = '<br>';
      }
    }

    const range = document.createRange();

    if (tag === 'table') {
      const cells = Array.from(block.querySelectorAll('td, th'));
      const targetCell = atEnd ? cells[cells.length - 1] : cells[0];
      if (targetCell) {
        let targetNode = targetCell;
        if (atEnd) {
          while (targetNode.lastChild) {
            targetNode = targetNode.lastChild;
          }
          if (targetNode.nodeType === Node.TEXT_NODE) {
            range.setStart(targetNode, targetNode.nodeValue ? targetNode.nodeValue.length : 0);
            range.collapse(true);
          } else {
            range.selectNodeContents(targetNode);
            range.collapse(false);
          }
        } else {
          while (targetNode.firstChild) {
            targetNode = targetNode.firstChild;
          }
          if (targetNode.nodeType === Node.TEXT_NODE) {
            range.setStart(targetNode, 0);
            range.collapse(true);
          } else {
            range.setStart(targetNode, 0);
            range.collapse(true);
          }
        }
      } else {
        range.selectNodeContents(block);
        range.collapse(!atEnd);
      }
    } else {
      const hasRealText = (block.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim().length > 0;
      if (!hasRealText) {
        // Empty block (may contain only <br>): always position caret at start/before <br> so cursor is visible!
        const br = block.querySelector('br');
        if (br) {
          range.setStartBefore(br);
        } else {
          range.setStart(block, 0);
        }
        range.collapse(true);
      } else if (atEnd) {
        let targetNode = block;
        while (targetNode.lastChild) {
          targetNode = targetNode.lastChild;
        }
        if (targetNode.nodeType === Node.TEXT_NODE) {
          range.setStart(targetNode, targetNode.nodeValue ? targetNode.nodeValue.length : 0);
          range.collapse(true);
        } else if (targetNode.tagName && targetNode.tagName.toLowerCase() === 'br') {
          range.setStartBefore(targetNode);
          range.collapse(true);
        } else {
          range.selectNodeContents(targetNode);
          range.collapse(false);
        }
      } else {
        let targetNode = block;
        while (targetNode.firstChild) {
          targetNode = targetNode.firstChild;
        }
        if (targetNode.nodeType === Node.TEXT_NODE) {
          range.setStart(targetNode, 0);
          range.collapse(true);
        } else if (targetNode.tagName && targetNode.tagName.toLowerCase() === 'br') {
          range.setStartBefore(targetNode);
          range.collapse(true);
        } else {
          range.setStart(targetNode, 0);
          range.collapse(true);
        }
      }
    }

    const root = pagesContainerRef.current;
    const content = block.closest?.('.page-content');

    if (root) {
      try { root.focus({ preventScroll: true }); } catch (_) {}
    }
    if (content) {
      try { content.focus({ preventScroll: true }); } catch (_) {}
    }
    if (block && typeof block.focus === 'function') {
      try { block.focus({ preventScroll: true }); } catch (_) {}
    }

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    if (savedSelectionRef) {
      savedSelectionRef.current = range.cloneRange();
    }
  }, [pagesContainerRef, savedSelectionRef]);

  // Helper to retrieve all valid blocks in a container
  const getBlockElements = useCallback((container) => {
    if (!container) return [];
    const selector = '[data-block-id], p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, figure';
    const rawElements = Array.from(container.querySelectorAll(selector));
    const validBlocks = [];

    rawElements.forEach((el) => {
      if (el.closest('.page-header, .page-footer, .page-logo-strip, .cell-dropdown')) return;
      if (el.classList.contains('page-break-marker') || el.getAttribute('data-page-break') === 'true' || el.closest('.page-break-marker')) return;

      // CRITICAL FIX: Skip elements that are nested descendants of complex structures (tables, lists, list items).
      // A nested sublist (ol.custom-numbered-list inside an li) or sub-element must NEVER have data-block-id
      // auto-assigned to it or be registered as a separate independent block.
      let parent = el.parentElement;
      let isNestedDescendant = false;
      while (parent && parent !== container) {
        const pTag = parent.tagName ? parent.tagName.toLowerCase() : '';
        if (pTag === 'ul' || pTag === 'ol' || pTag === 'table' || pTag === 'li') {
          isNestedDescendant = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (isNestedDescendant) {
        // Strip any erroneous data-block-id if accidentally set earlier
        if (el.hasAttribute('data-block-id')) {
          el.removeAttribute('data-block-id');
        }
        return;
      }

      // Auto-assign data-block-id if missing on editable block elements
      if (!el.hasAttribute('data-block-id')) {
        const engine = documentEngineRef.current;
        let newId = null;
        if (engine) {
          try {
            const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, el.innerHTML || el.textContent || '');
            newId = newBlock.id;
            engine.addBlock(newBlock);
          } catch (_) {}
        }
        if (!newId) {
          newId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        }
        el.setAttribute('data-block-id', newId);
      }

      if (!validBlocks.includes(el)) {
        validBlocks.push(el);
      }
    });

    return validBlocks;
  }, [documentEngineRef]);

  // Helper to create an editable paragraph below a table (or other element) and place caret inside it
  const createParagraphBelow = useCallback((anchorEl, parentContent = null) => {
    const engine = documentEngineRef.current;
    const container = pagesContainerRef.current;
    if (!engine) return null;

    const anchorBlock = anchorEl?.closest ? anchorEl.closest('[data-block-id]') : null;
    const anchorBlockId = anchorBlock?.getAttribute('data-block-id');

    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '<br>', {
      ownerId: currentUser?.id || user?._id || user?.id || null
    });

    // Insert into engine.document.pages
    const allBlocks = engine.getAllBlocks();
    let insertIndex = allBlocks.length;
    if (anchorBlockId) {
      const rawId = anchorBlockId.split('_p')[0];
      const idx = allBlocks.findIndex(b => b.id === anchorBlockId || b.id === rawId);
      if (idx !== -1) {
        insertIndex = idx + 1;
      }
    }

    if (engine.document && engine.document.pages && engine.document.pages.length > 0) {
      let blockPlaced = false;
      for (const pg of engine.document.pages) {
        const rawId = anchorBlockId ? anchorBlockId.split('_p')[0] : null;
        const idx = pg.blocks.findIndex(b => b.id === anchorBlockId || (rawId && b.id === rawId));
        if (idx !== -1) {
          pg.blocks.splice(idx + 1, 0, newBlock);
          blockPlaced = true;
          break;
        }
      }
      if (!blockPlaced) {
        engine.document.pages[engine.document.pages.length - 1].blocks.push(newBlock);
      }
    } else {
      const nextBlocks = [...allBlocks];
      nextBlocks.splice(insertIndex, 0, newBlock);
      engine.document.pages = [{ id: `page-${Date.now()}`, blocks: nextBlocks }];
    }

    // Create DOM element
    const p = document.createElement('p');
    p.setAttribute('data-block-id', newBlock.id);
    p.innerHTML = '<br>';

    if (anchorBlock && anchorBlock.parentNode) {
      anchorBlock.parentNode.insertBefore(p, anchorBlock.nextSibling);
    } else if (parentContent) {
      const breakMarker = parentContent.querySelector('.page-break-marker');
      if (breakMarker) {
        parentContent.insertBefore(p, breakMarker);
      } else {
        parentContent.appendChild(p);
      }
    } else if (container) {
      const activeContent = container.querySelector('.page-content');
      if (activeContent) {
        const breakMarker = activeContent.querySelector('.page-break-marker');
        if (breakMarker) {
          activeContent.insertBefore(p, breakMarker);
        } else {
          activeContent.appendChild(p);
        }
      }
    }

    // Sync to blocks & notify
    if (contentChangeHandlerRef.current && container) {
      contentChangeHandlerRef.current.syncDOMToBlocks(container);
    }
    if (typeof syncAndNotify === 'function') {
      syncAndNotify(null, null, null, null, null, { skipPaginate: true });
    }

    // Place caret in the newly created paragraph
    setCaretInBlock(p, false);
    return p;
  }, [documentEngineRef, pagesContainerRef, contentChangeHandlerRef, syncAndNotify, currentUser, user, setCaretInBlock]);

  // Helper to create an editable paragraph above an element and place caret inside it
  const createParagraphAbove = useCallback((anchorEl, parentContent = null) => {
    const engine = documentEngineRef.current;
    const container = pagesContainerRef.current;
    if (!engine) return null;

    const anchorBlock = anchorEl?.closest ? anchorEl.closest('[data-block-id]') : null;
    const anchorBlockId = anchorBlock?.getAttribute('data-block-id');

    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '<br>', {
      ownerId: currentUser?.id || user?._id || user?.id || null
    });

    const allBlocks = engine.getAllBlocks();
    let insertIndex = 0;
    if (anchorBlockId) {
      const rawId = anchorBlockId.split('_p')[0];
      const idx = allBlocks.findIndex(b => b.id === anchorBlockId || b.id === rawId);
      if (idx !== -1) {
        insertIndex = idx;
      }
    }

    if (engine.document && engine.document.pages && engine.document.pages.length > 0) {
      let blockPlaced = false;
      for (const pg of engine.document.pages) {
        const rawId = anchorBlockId ? anchorBlockId.split('_p')[0] : null;
        const idx = pg.blocks.findIndex(b => b.id === anchorBlockId || (rawId && b.id === rawId));
        if (idx !== -1) {
          pg.blocks.splice(idx, 0, newBlock);
          blockPlaced = true;
          break;
        }
      }
      if (!blockPlaced) {
        engine.document.pages[0].blocks.unshift(newBlock);
      }
    } else {
      const nextBlocks = [...allBlocks];
      nextBlocks.splice(insertIndex, 0, newBlock);
      engine.document.pages = [{ id: `page-${Date.now()}`, blocks: nextBlocks }];
    }

    // Create DOM element
    const p = document.createElement('p');
    p.setAttribute('data-block-id', newBlock.id);
    p.innerHTML = '<br>';

    if (anchorBlock && anchorBlock.parentNode) {
      anchorBlock.parentNode.insertBefore(p, anchorBlock);
    } else if (parentContent) {
      parentContent.insertBefore(p, parentContent.firstChild);
    } else if (container) {
      const activeContent = container.querySelector('.page-content');
      if (activeContent) activeContent.insertBefore(p, activeContent.firstChild);
    }

    if (contentChangeHandlerRef.current && container) {
      contentChangeHandlerRef.current.syncDOMToBlocks(container);
    }
    if (typeof syncAndNotify === 'function') {
      syncAndNotify(null, null, null, null, null, { skipPaginate: true });
    }

    setCaretInBlock(p, false);
    return p;
  }, [documentEngineRef, pagesContainerRef, contentChangeHandlerRef, syncAndNotify, currentUser, user, setCaretInBlock]);

  // -------- Page Focus/Switching Management --------

  return {
    setCaretInBlock,
    getBlockElements,
    createParagraphBelow,
    createParagraphAbove,
  };
};

export default useCaretBlockHelpers;
