import { useCallback } from "react";
import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";

export const usePageClick = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  currentUser,
  user,
  savedSelectionRef,
  setCurrentPage,
  readOnly,
  endTypingSession,
  activeTableResizeRef,
  setCaretInBlock,
  getBlockElements,
  createParagraphBelow,
  createParagraphAbove,
}) => {
  const handlePageClick = useCallback((e) => {
    if (readOnly) return;

    // If we are resizing a table or if it's not a left click or modifier key is pressed, don't do anything
    if (
      window.isResizingTable ||
      activeTableResizeRef.current ||
      e.button !== 0 ||
      e.shiftKey ||
      e.ctrlKey ||
      e.altKey ||
      e.metaKey
    ) {
      return;
    }

    if (
      e.target.closest?.(".cell-dropdown") ||
      e.target.closest?.('td[data-type="dropdown"], th[data-type="dropdown"]') ||
      e.target.closest?.("figure.video-block") ||
      e.target.closest?.(".video-wrapper") ||
      e.target.closest?.("video") ||
      e.target.closest?.("iframe")
    ) {
      return;
    }

    endTypingSession?.();

    const root = pagesContainerRef.current;
    if (!root) return;

    const page = e.target.closest('.page');
    if (!page) return;

    const isInHeader = e.target.closest('.page-header');
    const isInFooter = e.target.closest('.page-footer');
    const isLogoCenter = e.target.closest('.logo-center');
    if (isInHeader || isInFooter || isLogoCenter) {
      return;
    }

    // 1. Update current page immediately on click
    const pages = Array.from(root.querySelectorAll('.page'));
    const pageIndex = pages.indexOf(page);

    window.isInteractingWithEditor = true;
    if (window.interactionTimeout) clearTimeout(window.interactionTimeout);
    window.interactionTimeout = setTimeout(() => {
      window.isInteractingWithEditor = false;
    }, 300);

    if (pageIndex !== -1) {
      setTimeout(() => {
        setCurrentPage((prev) => {
          const next = pageIndex + 1;
          return prev === next ? prev : next;
        });
      }, 50);
    }

    const content = page.querySelector('.page-content');
    if (!content) return;

    // Helper to check if a block is an empty paragraph
    const isEmptyParagraphBlock = (el) => {
      if (!el) return false;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag !== 'p') return false;
      if (el.querySelector('img, table, figure, video, iframe, audio')) return false;
      const txt = (el.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF\s]/g, '');
      return txt.length === 0;
    };

    // 2. Check if clicked directly inside an existing block
    const targetLi = e.target.closest('li');
    const blockSelector = 'li, [data-block-id], p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, figure';
    const hitCandidate = targetLi || e.target.closest(blockSelector);
    const directHitBlock = (hitCandidate && !hitCandidate.classList.contains('page-break-marker') && hitCandidate.getAttribute('data-page-break') !== 'true') ? hitCandidate : null;

    if (directHitBlock) {
      const tag = directHitBlock.tagName ? directHitBlock.tagName.toLowerCase() : '';
      
      // If clicking inside a table cell or table control, let native handling proceed
      if (tag === 'table' || directHitBlock.closest('table')) {
        return;
      }
      
      // If clicking non-table editable block (e.g. paragraph, heading, list item, list, etc.)
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li'].includes(tag)) {
        // If user clicked inside a list container (ul/ol) but not directly inside an li (e.g. padding)
        if (tag === 'ul' || tag === 'ol') {
          const lis = Array.from(directHitBlock.querySelectorAll(':scope > li, li'));
          if (lis.length > 0) {
            let itemUnderCursor = null;
            for (const li of lis) {
              const r = li.getBoundingClientRect();
              if (e.clientY >= r.top && e.clientY <= r.bottom) {
                itemUnderCursor = li;
                break;
              }
            }
            if (itemUnderCursor) {
              const liText = (itemUnderCursor.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
              if (liText.length === 0) {
                if (itemUnderCursor.childNodes.length === 0) {
                  itemUnderCursor.appendChild(document.createElement('br'));
                }
                e.preventDefault();
                setCaretInBlock(itemUnderCursor, false);
                return;
              }
            }
          }
          // For lists with text, let native browser placement work
          return;
        }

        // Ensure data-block-id is present on top-level blocks
        if (tag !== 'li' && !directHitBlock.hasAttribute('data-block-id')) {
          getBlockElements(page);
        }
        // Ensure empty blocks have a <br> child so the caret renders
        if (directHitBlock.childNodes.length === 0) {
          directHitBlock.appendChild(document.createElement('br'));
        }
        // If the block has no text (e.g. empty line below table or empty bullet point), explicitly set caret and focus
        const text = (directHitBlock.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
        if (text.length === 0) {
          e.preventDefault();
          setCaretInBlock(directHitBlock, false);
          return;
        }
        // For blocks with text, let native browser placement work
        return;
      }
    }

    // 3. Click landed in page background / empty area (not directly inside text)
    const pageBlocks = getBlockElements(content);
    
    // Scenario 1: Empty page (no valid blocks, e.g. empty page after page break)
    if (pageBlocks.length === 0) {
      e.preventDefault();
      const engine = documentEngineRef.current;
      const currentUserId = String(user?.id || currentUser?.id || '');
      let createdP = null;

      if (engine) {
        const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '<br>', { ownerId: currentUserId });
        const targetPg = engine.document?.pages?.[pageIndex];
        if (targetPg) {
          const pbIdx = targetPg.blocks.findIndex(b => b.type === BLOCK_TYPES.PAGE_BREAK);
          if (pbIdx !== -1) {
            targetPg.blocks.splice(pbIdx, 0, newBlock);
          } else {
            targetPg.blocks.push(newBlock);
          }
        } else {
          engine.addBlock(newBlock);
        }

        const p = document.createElement('p');
        p.setAttribute('data-block-id', newBlock.id);
        p.innerHTML = '<br>'; // inherits contenteditable and spellcheck from parent editing host

        const breakMarker = content.querySelector('.page-break-marker');
        if (breakMarker) {
          content.insertBefore(p, breakMarker);
        } else {
          content.appendChild(p);
        }
        createdP = p;

        if (contentChangeHandlerRef.current && root) {
          contentChangeHandlerRef.current.syncDOMToBlocks(root);
        }
        if (typeof syncAndNotify === 'function') {
          syncAndNotify(null, null, null, null, null, { skipPaginate: true });
        }
      }

      if (createdP) {
        setCaretInBlock(createdP, false);
      }
      return;
    }

    const firstBlock = pageBlocks[0];
    const lastBlock = pageBlocks[pageBlocks.length - 1];
    const firstRect = firstBlock.getBoundingClientRect();
    const lastRect = lastBlock.getBoundingClientRect();

    // Clicks above the first block on the page
    if (e.clientY <= firstRect.top) {
      e.preventDefault();
      if (isEmptyParagraphBlock(firstBlock)) {
        setCaretInBlock(firstBlock, false);
        return;
      }
      if (firstBlock.tagName.toLowerCase() === 'table') {
        let prevBlock = firstBlock.previousElementSibling;
        while (prevBlock && (prevBlock.classList.contains('page-break-marker') || prevBlock.getAttribute('data-page-break') === 'true')) {
          prevBlock = prevBlock.previousElementSibling;
        }
        if (prevBlock && prevBlock.tagName.toLowerCase() === 'p') {
          setCaretInBlock(prevBlock, false);
        } else {
          createParagraphAbove(firstBlock, content);
        }
      } else {
        setCaretInBlock(firstBlock, false);
      }
      return;
    }

    // Clicks below the last block on the page
    if (e.clientY >= lastRect.bottom) {
      e.preventDefault();
      // If the last block is ALREADY an empty paragraph, simply focus it!
      if (isEmptyParagraphBlock(lastBlock)) {
        setCaretInBlock(lastBlock, false);
        return;
      }

      // Check if there is an existing empty paragraph sibling below lastBlock
      let nextBlock = lastBlock.nextElementSibling;
      while (nextBlock && (nextBlock.classList.contains('page-break-marker') || nextBlock.getAttribute('data-page-break') === 'true')) {
        nextBlock = nextBlock.nextElementSibling;
      }
      if (nextBlock && isEmptyParagraphBlock(nextBlock)) {
        setCaretInBlock(nextBlock, false);
        return;
      }

      // Otherwise (last block is a Heading, non-empty paragraph, table, list, etc.):
      // Create an editable paragraph below it so the user can immediately type!
      createParagraphBelow(lastBlock, content);
      return;
    }

    // Clicks between blocks on the page: find closest block
    let closestBlock = null;
    let minDistance = Infinity;

    for (const blk of pageBlocks) {
      const bRect = blk.getBoundingClientRect();
      if (e.clientY >= bRect.top && e.clientY <= bRect.bottom) {
        closestBlock = blk;
        break;
      }
      const dist = Math.min(Math.abs(e.clientY - bRect.top), Math.abs(e.clientY - bRect.bottom));
      if (dist < minDistance) {
        minDistance = dist;
        closestBlock = blk;
      }
    }

    if (closestBlock) {
      const bRect = closestBlock.getBoundingClientRect();

      // If user clicked below closestBlock, check if next sibling is an empty line
      if (e.clientY >= bRect.bottom) {
        let nextBlock = closestBlock.nextElementSibling;
        while (nextBlock && (nextBlock.classList.contains('page-break-marker') || nextBlock.getAttribute('data-page-break') === 'true')) {
          nextBlock = nextBlock.nextElementSibling;
        }
        if (nextBlock && isEmptyParagraphBlock(nextBlock)) {
          e.preventDefault();
          setCaretInBlock(nextBlock, false);
          return;
        }
      }

      // If user clicked above closestBlock, check if prev sibling is an empty line
      if (e.clientY <= bRect.top) {
        let prevBlock = closestBlock.previousElementSibling;
        while (prevBlock && (prevBlock.classList.contains('page-break-marker') || prevBlock.getAttribute('data-page-break') === 'true')) {
          prevBlock = prevBlock.previousElementSibling;
        }
        if (prevBlock && isEmptyParagraphBlock(prevBlock)) {
          e.preventDefault();
          setCaretInBlock(prevBlock, false);
          return;
        }
      }

      if (closestBlock.tagName.toLowerCase() === 'table') {
        e.preventDefault();
        if (e.clientY >= bRect.bottom) {
          // Click is below this table: find or create paragraph below!
          let nextBlock = closestBlock.nextElementSibling;
          while (nextBlock && !['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(nextBlock.tagName.toLowerCase())) {
            if (nextBlock.tagName.toLowerCase() === 'table') break;
            nextBlock = nextBlock.nextElementSibling;
          }
          if (nextBlock && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(nextBlock.tagName.toLowerCase())) {
            setCaretInBlock(nextBlock, false);
          } else {
            createParagraphBelow(closestBlock, content);
          }
        } else {
          setCaretInBlock(closestBlock, false);
        }
      } else if (isEmptyParagraphBlock(closestBlock)) {
        e.preventDefault();
        setCaretInBlock(closestBlock, false);
      } else {
        // Do NOT preventDefault for non-empty text blocks when clicking near text
        // so browser native drag selection is preserved!
        const atEnd = e.clientX >= (bRect.left + bRect.width / 2) || e.clientY > (bRect.top + bRect.height / 2);
        setCaretInBlock(closestBlock, atEnd);
      }
    } else {
      e.preventDefault();
      if (isEmptyParagraphBlock(lastBlock)) {
        setCaretInBlock(lastBlock, false);
      } else {
        createParagraphBelow(lastBlock, content);
      }
    }
  }, [
    pagesContainerRef,
    setCurrentPage,
    endTypingSession,
    documentEngineRef,
    savedSelectionRef,
    readOnly,
    getBlockElements,
    setCaretInBlock,
    createParagraphBelow,
    createParagraphAbove,
    currentUser,
    user,
    contentChangeHandlerRef,
    syncAndNotify
  ]);

  // Cleanup timeout on unmount

  return {
    handlePageClick,
  };
};

export default usePageClick;
