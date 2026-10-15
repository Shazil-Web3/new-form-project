import { BLOCK_TYPES } from "../../../../Editor/DocumentEngine";
import { writeAlignToElement, resolveInheritedAlign } from "../../../../Editor/textAlignment/textAlignment";

export const useHandleEnter = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  currentUser,
  user,
  caretManagerRef,
}) => {
  function handleEnter() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    let el =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
    const blockEl = el?.closest?.("[data-block-id]");
    if (!blockEl) return false;

    const blockId = blockEl.getAttribute("data-block-id");
    const engine = documentEngineRef.current;
    const block = engine.getBlock(blockId);
    if (!block) return false;

    // Let the browser natively handle list items (adding new list item or exiting list)
    if (block.type === BLOCK_TYPES.LIST || blockEl.tagName.toLowerCase() === 'ol' || blockEl.tagName.toLowerCase() === 'ul' || el.closest('ol, ul, li')) {
      const li = el?.closest('li');
      if (li) {
        const liText = (li.textContent || "").replace(/\u200B/g, '').trim();
        if (!liText) {
          // This is an empty list item!
          
          // Check if this LI is nested inside another list item (sub-level)
          const parentList = li.parentNode;
          const grandparentLi = parentList?.closest('li');
          
          if (grandparentLi) {
            // YES! This is a nested (sub-level) list item!
            // Remove empty nested LI
            li.remove();
            if (parentList && !parentList.querySelector('li')) {
              parentList.remove();
            }
            
            const range = document.createRange();
            range.setStart(grandparentLi, grandparentLi.childNodes.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            
            caretManagerRef?.current?.onEditingAction('enter');
            contentChangeHandlerRef.current?.syncDOMToBlocks?.(pagesContainerRef.current);
            syncAndNotify();
            schedulePaginateRef.current();
            return true;
          }

          // Top-level list item is empty: exit list to a new paragraph block
          const lis = Array.from(blockEl.querySelectorAll(':scope > li'));
          const liIndex = lis.indexOf(li);
          const currentUserId = String(user?.id || currentUser?.id || '');

          if (lis.length === 1 && liIndex === 0) {
            // Only 1 item in the list and it is empty -> convert current block to a paragraph
            const inheritAlign = resolveInheritedAlign(li, block.metadata);
            const p = document.createElement("p");
            p.setAttribute("data-block-id", blockId);
            if (currentUserId) p.setAttribute("data-owner-id", currentUserId);
            p.innerHTML = "<br>";
            p.contentEditable = "true";
            if (inheritAlign) writeAlignToElement(p, inheritAlign);
            
            blockEl.replaceWith(p);
            
            engine.updateBlock(blockId, { type: BLOCK_TYPES.PARAGRAPH, content: '', metadata: { ...(block.metadata || {}), align: inheritAlign || undefined } });
            
            p.focus({ preventScroll: true });
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            caretManagerRef?.current?.onEditingAction('enter');
            contentChangeHandlerRef.current?.syncDOMToBlocks?.(pagesContainerRef.current);
            syncAndNotify();
            schedulePaginateRef.current();
            return true;
          } else if (liIndex === lis.length - 1) {
            // Last item in list is empty -> remove empty LI, insert new paragraph directly after blockEl
            const inheritAlign = resolveInheritedAlign(li, block.metadata);
            li.remove();

            const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId, ...(inheritAlign ? { align: inheritAlign } : {}) });
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
              targetPage.blocks.splice(currentIndex + 1, 0, newBlock);
            } else {
              const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
              if (lastPg) lastPg.blocks.push(newBlock);
            }

            const p = document.createElement("p");
            p.setAttribute("data-block-id", newBlock.id);
            if (currentUserId) p.setAttribute("data-owner-id", currentUserId);
            p.innerHTML = "<br>";
            p.contentEditable = "true";
            if (inheritAlign) writeAlignToElement(p, inheritAlign);

            blockEl.after(p);

            // Update remaining items of list block in engine
            const remainingLis = Array.from(blockEl.querySelectorAll(':scope > li'));
            engine.updateBlock(blockId, { content: remainingLis.map(l => l.innerHTML) });

            p.focus({ preventScroll: true });
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            caretManagerRef?.current?.onEditingAction('enter');
            contentChangeHandlerRef.current?.syncDOMToBlocks?.(pagesContainerRef.current);
            syncAndNotify();
            schedulePaginateRef.current();
            return true;
          } else {
            // Middle item in list is empty -> split list block with paragraph in between
            const remainingBeforeLis = lis.slice(0, liIndex);
            const remainingAfterLis = lis.slice(liIndex + 1);

            li.remove();

            // Create next list element for items after
            const nextListTag = blockEl.tagName.toLowerCase(); // 'ol' or 'ul'
            const nextListEl = document.createElement(nextListTag);
            nextListEl.className = blockEl.className;
            const nextListBlock = engine.createBlock(BLOCK_TYPES.LIST, remainingAfterLis.map(l => l.innerHTML), {
              listType: block.metadata?.listType || (nextListTag === 'ol' ? 'numbered' : 'bulleted'),
              ownerId: currentUserId
            });
            nextListEl.setAttribute("data-block-id", nextListBlock.id);
            if (currentUserId) nextListEl.setAttribute("data-owner-id", currentUserId);

            remainingAfterLis.forEach(l => nextListEl.appendChild(l));

            const inheritAlign = resolveInheritedAlign(li, block.metadata);
            const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId, ...(inheritAlign ? { align: inheritAlign } : {}) });
            const p = document.createElement("p");
            p.setAttribute("data-block-id", newBlock.id);
            if (currentUserId) p.setAttribute("data-owner-id", currentUserId);
            p.innerHTML = "<br>";
            p.contentEditable = "true";
            if (inheritAlign) writeAlignToElement(p, inheritAlign);

            blockEl.after(p);
            p.after(nextListEl);

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
              engine.updateBlock(blockId, { content: remainingBeforeLis.map(l => l.innerHTML) });
              targetPage.blocks.splice(currentIndex + 1, 0, newBlock, nextListBlock);
            } else {
              const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
              if (lastPg) lastPg.blocks.push(newBlock, nextListBlock);
            }

            p.focus({ preventScroll: true });
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            caretManagerRef?.current?.onEditingAction('enter');
            contentChangeHandlerRef.current?.syncDOMToBlocks?.(pagesContainerRef.current);
            syncAndNotify();
            schedulePaginateRef.current();
            return true;
          }
        }
      }
      return false;
    }

    // Define text-based block types that support our custom line breaking behavior
    const textTypes = new Set([
      BLOCK_TYPES.PARAGRAPH,
      BLOCK_TYPES.HEADING,
      BLOCK_TYPES.QUOTE,
      BLOCK_TYPES.CODE,
    ]);
    
    // For media blocks (video, image), pressing Enter creates a clean paragraph below instead of splitting DOM range
    if (block.type === BLOCK_TYPES.VIDEO || block.type === BLOCK_TYPES.IMAGE || blockEl.classList.contains('video-block') || blockEl.classList.contains('editor-image')) {
      const currentUserId = String(user?.id || currentUser?.id || '');
      const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '', { ownerId: currentUserId });
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
        targetPage.blocks.splice(currentIndex + 1, 0, newBlock);
      } else {
        const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
        if (lastPg) lastPg.blocks.push(newBlock);
      }

      const newEl = document.createElement("p");
      newEl.setAttribute("data-block-id", newBlock.id);
      if (currentUserId) newEl.setAttribute("data-owner-id", currentUserId);
      newEl.innerHTML = "<br>";
      newEl.contentEditable = "true";

      if (blockEl.nextSibling) {
        blockEl.parentElement.insertBefore(newEl, blockEl.nextSibling);
      } else {
        blockEl.parentElement.appendChild(newEl);
      }

      const newRange = document.createRange();
      newRange.setStart(newEl, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      caretManagerRef?.current?.onEditingAction('enter');
      setTimeout(() => {
        syncAndNotify();
        schedulePaginateRef.current();
      }, 50);

      return true;
    }

    // For complex formatted content like tables, allow native browser behavior
    if (!textTypes.has(block.type)) {
      // Check if we're inside a table cell or other complex structure
      const isInComplexStructure = el.closest('table, tr, td, th') || 
                                   blockEl.querySelector('table, tr, td, th');
      if (isInComplexStructure) {
        // For tables and complex structures, let the browser handle Enter naturally
        return false; // Allow native behavior
      }
      // For other non-text blocks, still try our custom handler
    }

    // Use DOM Range to split content while preserving HTML structure (highlights, etc.)
    const splitRange = document.createRange();
    splitRange.selectNodeContents(blockEl);
    splitRange.setStart(range.startContainer, range.startOffset);
    
    const fragment = splitRange.extractContents();
    
    // Serialize the extracted fragment to HTML
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const rightHtml = tempDiv.innerHTML;
    
    // The remaining content in blockEl is the left side
    const leftHtml = blockEl.innerHTML;
    const currentUserId = String(user?.id || currentUser?.id || '');

    const inheritAlign = resolveInheritedAlign(blockEl, block.metadata);
    if (inheritAlign) {
      writeAlignToElement(blockEl, inheritAlign);
      block.metadata.align = inheritAlign;
    }
    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, rightHtml, { ownerId: currentUserId, ...(inheritAlign ? { align: inheritAlign } : {}) });
    engine.updateBlock(blockId, { content: leftHtml });

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
      targetPage.blocks.splice(currentIndex + 1, 0, newBlock);
    } else {
      const lastPg = engine.document.pages?.[engine.document.pages.length - 1];
      if (lastPg) lastPg.blocks.push(newBlock);
    }

    const newEl = document.createElement("p");
    newEl.setAttribute("data-block-id", newBlock.id);
    if (currentUserId) {
      newEl.setAttribute("data-owner-id", currentUserId);
    }
    newEl.innerHTML = (rightHtml && rightHtml.trim() !== '') ? rightHtml : '<br>'; // Use innerHTML to preserve structure
    newEl.contentEditable = "true";
    if (inheritAlign) writeAlignToElement(newEl, inheritAlign);
    blockEl.parentElement.insertBefore(newEl, blockEl.nextSibling);
    
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
    setTimeout(() => {
      syncAndNotify();
      schedulePaginateRef.current();
    }, 50);
    
    return true; // Indicate we handled the event
  }


  return {
    handleEnter,
  };
};

export default useHandleEnter;
