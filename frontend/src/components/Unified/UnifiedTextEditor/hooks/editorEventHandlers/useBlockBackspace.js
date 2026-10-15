import { useCallback } from "react";
import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";

export const useBlockBackspace = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  renderFreshFromEngineRef,
  getBlockAndOffset,
  disableStrikeOnDelete,
  caretManagerRef,
}) => {
  const deleteAcrossHosts = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return false;

    const range = sel.getRangeAt(0);
    const startHost = (range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement
    )?.closest(".page-content");
    const endHost = (range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer
      : range.endContainer.parentElement
    )?.closest(".page-content");

    if (!startHost || !endHost || startHost === endHost) {
      return false;
    }

    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }

    const startCtx = getBlockAndOffset(range.startContainer, range.startOffset);
    const endCtx = getBlockAndOffset(range.endContainer, range.endOffset);
    if (!startCtx || !endCtx) return false;

    const engine = documentEngineRef.current;
    // Use getAllBlocks() to search across ALL engine pages
    const allBlocks = engine.getAllBlocks();

    const startIdx = allBlocks.findIndex((b) => b.id === startCtx.blockId);
    const endIdx = allBlocks.findIndex((b) => b.id === endCtx.blockId);
    if (startIdx === -1 || endIdx === -1) return false;

    let sIdx = startIdx;
    let eIdx = endIdx;
    let sPos = startCtx.pos;
    let ePos = endCtx.pos;
    let sText = startCtx.text;
    let eText = endCtx.text;

    if (sIdx > eIdx || (sIdx === eIdx && sPos > ePos)) {
      [sIdx, eIdx] = [eIdx, sIdx];
      [sPos, ePos] = [ePos, sPos];
      [sText, eText] = [eText, sText];
    }

    const before = sText.slice(0, sPos);
    const after = eText.slice(ePos);

    // Merge remaining text into the surviving block
    const survivingBlock = allBlocks[sIdx];
    engine.updateBlock(survivingBlock.id, { content: before + after });

    // Remove all blocks between start+1 and end (inclusive)
    const deleteCount = eIdx - sIdx;
    if (deleteCount > 0) {
      const blocksToRemove = allBlocks.slice(sIdx + 1, eIdx + 1);
      blocksToRemove.forEach(b => engine.removeBlock(b.id));
    }

    // Consolidate remaining blocks into a single engine page;
    // repagination will redistribute them across DOM pages as needed
    const remainingBlocks = engine.getAllBlocks();
    engine.document.pages = [{ id: 'page1', blocks: remainingBlocks }];
    engine.currentPageIndex = 0;

    renderFreshFromEngineRef?.current?.();

    requestAnimationFrame(() => {
      const anchorEl = pagesContainerRef.current?.querySelector(
        `[data-block-id="${survivingBlock.id}"]`
      );
      if (anchorEl) {
        let remaining = before.length;
        const walker = document.createTreeWalker(anchorEl, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node && remaining > (node.textContent?.length || 0)) {
          remaining -= node.textContent.length;
          node = walker.nextNode();
        }
        const r = document.createRange();
        if (node) r.setStart(node, remaining);
        else r.setStart(anchorEl, anchorEl.childNodes.length);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    });

    syncAndNotify();
    schedulePaginateRef.current();

    return true;
  }, [getBlockAndOffset, contentChangeHandlerRef, pagesContainerRef, documentEngineRef, renderFreshFromEngineRef, syncAndNotify, schedulePaginateRef]);

  const handleBlockBackspace = useCallback((range) => {
    if (!range || !range.collapsed) return false;
    
    let el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    if (el?.closest('td, th, table')) {
      // Defer to specialized table cell handlers
      return false;
    }

    const blockEl = el?.closest?.("[data-block-id]");
    if (!blockEl) return false;

    const pageContent = blockEl.closest('.page-content');
    if (!pageContent) return false;

    // Check if cursor is at the very beginning of the block
    const pre = document.createRange();
    pre.selectNodeContents(blockEl);
    pre.setEnd(range.startContainer, range.startOffset);
    if (pre.toString().length > 0) return false;

    const engine = documentEngineRef.current;
    if (!engine) return false;

    const allBlocks = engine.getAllBlocks();
    const blockId = blockEl.getAttribute("data-block-id");
    const blockIdx = allBlocks.findIndex(b => b.id === blockId);

    // If this is the very first block of the entire document:
    if (blockIdx <= 0) {
      const tag = blockEl.tagName.toLowerCase();
      if (tag === 'ol' || tag === 'ul') {
        const text = (blockEl.textContent || '').trim();
        if (!text) {
          engine.updateBlock(blockId, { type: BLOCK_TYPES.PARAGRAPH, content: '' });
          const p = document.createElement("p");
          p.setAttribute("data-block-id", blockId);
          p.innerHTML = "<br>";
          p.contentEditable = "true";
          blockEl.replaceWith(p);

          const r = document.createRange();
          r.setStart(p, 0);
          r.collapse(true);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(r);

          syncAndNotify();
          schedulePaginateRef.current();
          return true;
        }
      }
      return false;
    }

    const currentBlock = allBlocks[blockIdx];
    const prevBlock = allBlocks[blockIdx - 1];
    if (!currentBlock || !prevBlock) return false;

    const prevBlockEl = pagesContainerRef.current?.querySelector(`[data-block-id="${prevBlock.id}"]`);

    const moveCursorToEnd = (element) => {
      if (!element) return;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
      let lastNode = null;
      let node = walker.nextNode();
      while (node) {
        lastNode = node;
        node = walker.nextNode();
      }
      const r = document.createRange();
      if (lastNode) {
        r.setStart(lastNode, lastNode.textContent.length);
      } else {
        r.setStart(element, element.childNodes.length);
      }
      r.collapse(true);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      caretManagerRef?.current?.onEditingAction('delete', { behavior: 'smooth' });
    };

    // Protect locked blocks: do not merge or delete, just move caret if possible
    if (prevBlock.locked || currentBlock.locked) {
      if (prevBlockEl) moveCursorToEnd(prevBlockEl);
      return true;
    }

    // ═══ PAGE BREAK REMOVAL ON BACKSPACE ═══
    if (prevBlock.type === BLOCK_TYPES.PAGE_BREAK) {
      const blockBeforeBreak = blockIdx >= 2 ? allBlocks[blockIdx - 2] : null;
      const blockBeforeBreakEl = blockBeforeBreak ? pagesContainerRef.current?.querySelector(`[data-block-id="${blockBeforeBreak.id}"]`) : null;

      const currentBlockHtml = blockEl.innerHTML;
      const tempDivCurrent = document.createElement('div');
      tempDivCurrent.innerHTML = currentBlockHtml;
      const isCurrentEmpty = tempDivCurrent.textContent.trim() === '' && !tempDivCurrent.querySelector('img, table, iframe');

      // 1. Remove the page break block from engine and DOM
      engine.removeBlock(prevBlock.id);
      if (prevBlockEl) prevBlockEl.remove();

      // 2. If current block is empty and we have a preceding block, remove current block too and move cursor to end of preceding block
      if (isCurrentEmpty && blockBeforeBreak) {
        engine.removeBlock(currentBlock.id);
        blockEl.remove();
        if (blockBeforeBreakEl) {
          moveCursorToEnd(blockBeforeBreakEl);
        }
      } else if (blockBeforeBreak && blockBeforeBreakEl) {
        const textTypes = new Set(['paragraph', 'heading', 'quote', 'code']);
        const isBeforeBreakText = textTypes.has(blockBeforeBreak.type) || !blockBeforeBreak.type;
        const isCurrentText = textTypes.has(currentBlock.type) || !currentBlock.type;
        const isSameType = blockBeforeBreak.type === currentBlock.type;

        if (isBeforeBreakText && isCurrentText && isSameType) {
          const beforeHtml = blockBeforeBreakEl.innerHTML;
          const cleanedBeforeHtml = beforeHtml.replace(/<br\s*\/?>$/i, '');
          const mergedHtml = cleanedBeforeHtml + currentBlockHtml;

          engine.updateBlock(blockBeforeBreak.id, { content: mergedHtml });
          engine.removeBlock(currentBlock.id);
          blockBeforeBreakEl.innerHTML = mergedHtml;
          blockEl.remove();

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = beforeHtml;
          let remaining = tempDiv.textContent.length;
          const walker = document.createTreeWalker(blockBeforeBreakEl, NodeFilter.SHOW_TEXT, null);
          let node = walker.nextNode();
          while (node && remaining > (node.textContent?.length || 0)) {
            remaining -= node.textContent.length;
            node = walker.nextNode();
          }
          const r = document.createRange();
          if (node) r.setStart(node, remaining);
          else r.setStart(blockBeforeBreakEl, blockBeforeBreakEl.childNodes.length);
          r.collapse(true);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(r);
        } else {
          const r = document.createRange();
          r.setStart(blockEl, 0);
          r.collapse(true);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(r);
        }
      } else {
        const r = document.createRange();
        r.setStart(blockEl, 0);
        r.collapse(true);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }

      if (contentChangeHandlerRef.current && pagesContainerRef.current) {
        contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
      }
      syncAndNotify();
      schedulePaginateRef.current?.();
      return true;
    }

    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }

    // Check block types for safe merging
    const textTypes = new Set(['paragraph', 'heading', 'quote', 'code']);
    const isPrevText = textTypes.has(prevBlock.type) || !prevBlock.type;
    const isCurrentText = textTypes.has(currentBlock.type) || !currentBlock.type;
    const isSameType = prevBlock.type === currentBlock.type;

    const prevBlockHtml = prevBlockEl ? prevBlockEl.innerHTML : (prevBlock.content || '');
    const currentBlockHtml = blockEl.innerHTML;

    const tempDivCurrent = document.createElement('div');
    tempDivCurrent.innerHTML = currentBlockHtml;
    const isCurrentEmpty = tempDivCurrent.textContent.trim() === '' && !tempDivCurrent.querySelector('img, table, iframe');

    const tempDivPrev = document.createElement('div');
    tempDivPrev.innerHTML = prevBlockHtml;
    const isPrevEmpty = tempDivPrev.textContent.trim() === '' && !tempDivPrev.querySelector('img, table, iframe');
    const prevTextLen = tempDivPrev.textContent.length;

    // Review Mode: Do not permanently delete or merge blocks.
    // Just move the cursor across the boundary so normal strike logic takes over.
    if (!disableStrikeOnDelete) {
      if (prevBlockEl) moveCursorToEnd(prevBlockEl);
      return true;
    }

    if (isCurrentEmpty) {
      // 1. Current block is empty -> Delete current, move to end of previous
      engine.removeBlock(currentBlock.id);
      blockEl.remove();
      if (prevBlockEl) moveCursorToEnd(prevBlockEl);
    } else if (isPrevEmpty) {
      // 2. Previous block is empty -> Delete previous, keep cursor at start of current
      engine.removeBlock(prevBlock.id);
      if (prevBlockEl) prevBlockEl.remove();
      
      const r = document.createRange();
      r.setStart(blockEl, 0);
      r.collapse(true);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      caretManagerRef?.current?.onEditingAction('delete', { behavior: 'smooth' });
    } else if (isPrevText && isCurrentText && isSameType) {
      // 3. Both are text of the EXACT SAME type -> Safe to merge
      const cleanedPrevHtml = prevBlockHtml.replace(/<br\s*\/?>$/i, '');
      const mergedHtml = cleanedPrevHtml + currentBlockHtml;

      engine.updateBlock(prevBlock.id, { content: mergedHtml });
      engine.removeBlock(currentBlock.id);
      
      if (prevBlockEl) {
        prevBlockEl.innerHTML = mergedHtml;
      }
      blockEl.remove();

      if (prevBlockEl) {
        let remaining = prevTextLen;
        const walker = document.createTreeWalker(prevBlockEl, NodeFilter.SHOW_TEXT, null);
        let node = walker.nextNode();
        while (node && remaining > (node.textContent?.length || 0)) {
          remaining -= node.textContent.length;
          node = walker.nextNode();
        }
        const r = document.createRange();
        if (node) r.setStart(node, remaining);
        else r.setStart(prevBlockEl, prevBlockEl.childNodes.length);
        r.collapse(true);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        caretManagerRef?.current?.onEditingAction('delete', { behavior: 'smooth' });
      }
    } else {
      // 4. Different types or non-mergeable -> Just jump to end of previous block
      if (prevBlockEl) moveCursorToEnd(prevBlockEl);
    }

    syncAndNotify();
    schedulePaginateRef.current();

    return true;
  }, [documentEngineRef, contentChangeHandlerRef, pagesContainerRef, syncAndNotify, schedulePaginateRef, disableStrikeOnDelete]);



  return {
    deleteAcrossHosts,
    handleBlockBackspace,
  };
};

export default useBlockBackspace;
