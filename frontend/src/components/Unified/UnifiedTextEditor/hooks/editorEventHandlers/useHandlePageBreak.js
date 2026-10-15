import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";

export const useHandlePageBreak = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  renderFreshFromEngineRef,
  currentUser,
  user,
  readOnly,
  pushToUndo,
  endTypingSession,
  caretManagerRef,
}) => {
  function handlePageBreak() {
    if (readOnly) return false;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;

    endTypingSession?.();
    pushToUndo?.(true);

    const range = sel.getRangeAt(0);

    // If there's an active text selection, delete it first
    if (!sel.isCollapsed) {
      range.deleteContents();
    }

    const engine = documentEngineRef.current;
    if (!engine) return false;

    let el =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;

    let blockEl = el?.closest?.("[data-block-id]");
    const currentUserId = String(user?.id || currentUser?.id || '');

    // If not inside any block (e.g. at document root or empty), find or create target
    if (!blockEl) {
      const allBlocks = engine.getAllBlocks();
      if (allBlocks.length === 0) {
        const firstP = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId });
        const breakB = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
        const nextP = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId });
        engine.document.pages = [
          { id: 'page1', blocks: [firstP, breakB] },
          { id: 'page2', blocks: [nextP] }
        ];
        renderFreshFromEngineRef?.current?.();
        syncAndNotify();
        schedulePaginateRef.current?.();

        setTimeout(() => {
          const newEl = pagesContainerRef.current?.querySelector(`[data-block-id="${nextP.id}"]`);
          if (newEl) {
            newEl.focus();
            const r = document.createRange();
            r.setStart(newEl, 0);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
        return true;
      }
      blockEl = pagesContainerRef.current?.querySelector(`[data-block-id="${allBlocks[allBlocks.length - 1].id}"]`);
    }

    if (!blockEl) return false;

    const blockId = blockEl.getAttribute("data-block-id");
    const block = engine.getBlock(blockId);
    if (!block) return false;

    // Handle table: if cursor is inside table, insert page break AFTER table
    const tableEl = blockEl.closest('table') || (blockEl.tagName.toLowerCase() === 'table' ? blockEl : null);
    if (tableEl) {
      const actualBlockEl = tableEl.closest('[data-block-id]') || tableEl;
      const actualBlockId = actualBlockEl.getAttribute('data-block-id');
      const breakBlock = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
      const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId });

      let targetPage = null;
      let currentIndex = -1;
      if (engine?.document?.pages) {
        for (const pg of engine.document.pages) {
          const idx = pg.blocks.findIndex((b) => b.id === actualBlockId);
          if (idx !== -1) {
            targetPage = pg;
            currentIndex = idx;
            break;
          }
        }
      }
      if (targetPage && currentIndex !== -1) {
        targetPage.blocks.splice(currentIndex + 1, 0, breakBlock, newBlock);
      } else {
        const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
        if (lastPg) lastPg.blocks.push(breakBlock, newBlock);
      }

      const breakEl = document.createElement("div");
      breakEl.setAttribute("data-block-id", breakBlock.id);
      breakEl.setAttribute("data-page-break", "true");
      breakEl.className = "page-break-marker";
      breakEl.contentEditable = "false";
      breakEl.style.cssText = "height:0px;margin:0;padding:0;line-height:0;overflow:hidden;";

      const newEl = document.createElement("p");
      newEl.setAttribute("data-block-id", newBlock.id);
      if (currentUserId) newEl.setAttribute("data-owner-id", currentUserId);
      newEl.innerHTML = "<br>";
      newEl.contentEditable = "true";

      actualBlockEl.after(breakEl);
      breakEl.after(newEl);

      newEl.focus({ preventScroll: true });
      const newRange = document.createRange();
      newRange.setStart(newEl, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      caretManagerRef?.current?.onEditingAction('enter');
      if (contentChangeHandlerRef.current && pagesContainerRef.current) {
        contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
      }
      syncAndNotify();
      schedulePaginateRef.current?.();

      setTimeout(() => {
        const target = pagesContainerRef.current?.querySelector(`[data-block-id="${newBlock.id}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);

      return true;
    }

    // Split text-based block at cursor
    const splitRange = document.createRange();
    splitRange.selectNodeContents(blockEl);
    splitRange.setStart(range.startContainer, range.startOffset);

    const fragment = splitRange.extractContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const rightHtml = tempDiv.innerHTML;
    const leftHtml = blockEl.innerHTML;

    const pageBreakBlock = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, rightHtml, { ownerId: currentUserId });

    engine.updateBlock(blockId, { content: (leftHtml && leftHtml.trim() !== '') ? leftHtml : '<br>' });
    if (!blockEl.innerHTML || blockEl.innerHTML.trim() === '') {
      blockEl.innerHTML = '<br>';
    }

    let targetPage = null;
    let currentIndex = -1;
    if (engine?.document?.pages) {
      for (const pg of engine.document.pages) {
        const idx = pg.blocks.findIndex((b) => b.id === blockId);
        if (idx !== -1) {
          targetPage = pg;
          currentIndex = idx;
          break;
        }
      }
    }
    if (targetPage && currentIndex !== -1) {
      targetPage.blocks.splice(currentIndex + 1, 0, pageBreakBlock, newBlock);
    } else {
      const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
      if (lastPg) lastPg.blocks.push(pageBreakBlock, newBlock);
    }

    const breakEl = document.createElement("div");
    breakEl.setAttribute("data-block-id", pageBreakBlock.id);
    breakEl.setAttribute("data-page-break", "true");
    breakEl.className = "page-break-marker";
    breakEl.contentEditable = "false";
    breakEl.style.cssText = "height:0px;margin:0;padding:0;line-height:0;overflow:hidden;";

    const newEl = document.createElement("p");
    newEl.setAttribute("data-block-id", newBlock.id);
    if (currentUserId) newEl.setAttribute("data-owner-id", currentUserId);
    newEl.innerHTML = (rightHtml && rightHtml.trim() !== '') ? rightHtml : '<br>';
    newEl.contentEditable = "true";

    blockEl.parentElement.insertBefore(breakEl, blockEl.nextSibling);
    breakEl.parentElement.insertBefore(newEl, breakEl.nextSibling);

    newEl.focus({ preventScroll: true });
    const newRange = document.createRange();
    if (newEl.firstChild && newEl.firstChild.nodeType === Node.TEXT_NODE) {
      newRange.setStart(newEl.firstChild, 0);
    } else {
      newRange.setStart(newEl, 0);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    caretManagerRef?.current?.onEditingAction('enter');
    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }
    syncAndNotify();
    schedulePaginateRef.current?.();

    setTimeout(() => {
      const target = pagesContainerRef.current?.querySelector(`[data-block-id="${newBlock.id}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    return true;
  }



  return {
    handlePageBreak,
  };
};

export default useHandlePageBreak;
