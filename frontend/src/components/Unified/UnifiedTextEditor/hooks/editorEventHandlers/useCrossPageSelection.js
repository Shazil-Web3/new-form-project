import { useCallback, useEffect } from "react";

export const useCrossPageSelection = ({
  pagesContainerRef,
  syncAndNotify,
  syncAndNotifyRefInternal,
  crossPageDragRef,
  selectionUpdateFrameRef,
}) => {
  const isValidDocumentCaret = useCallback((node) => {
    if (!node) return false;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return false;

    const root = pagesContainerRef.current;
    if (root && !root.contains(element)) return false;

    const pageContent = element.closest('.page-content');
    if (!pageContent) return false;

    const blocked = element.closest('[contenteditable="false"]');
    if (blocked) return false;

    return true;
  }, [pagesContainerRef]);

  const getCaretFromPoint = useCallback((x, y) => {
    let result = null;
    if (typeof document.caretRangeFromPoint === "function") {
      const range = document.caretRangeFromPoint(x, y);
      if (range) {
        result = { node: range.startContainer, offset: range.startOffset };
      }
    } else if (typeof document.caretPositionFromPoint === "function") {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        result = { node: pos.offsetNode, offset: pos.offset };
      }
    }

    if (!result) return null;

    // If caret node is the page-content container itself or a block element container
    // rather than text or an inline position, drill down to the nearest block child under cursor
    if (result.node && result.node.nodeType === Node.ELEMENT_NODE) {
      const el = result.node;
      if (el.classList.contains("page-content") || el.classList.contains("page")) {
        const pageContent = el.classList.contains("page-content") ? el : el.querySelector(".page-content");
        if (pageContent) {
          const blocks = Array.from(pageContent.querySelectorAll('[data-block-id], p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre'));
          if (blocks.length > 0) {
            // Find which block the y coordinate matches closest
            let targetBlock = blocks[0];
            for (const blk of blocks) {
              const rect = blk.getBoundingClientRect();
              if (y >= rect.top) {
                targetBlock = blk;
              }
            }
            if (targetBlock) {
              const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT, null);
              let lastTextNode = null;
              let firstTextNode = null;
              let n = walker.nextNode();
              while (n) {
                if (!firstTextNode) firstTextNode = n;
                lastTextNode = n;
                n = walker.nextNode();
              }
              const rect = targetBlock.getBoundingClientRect();
              if (y <= (rect.top + rect.bottom) / 2 && firstTextNode) {
                return { node: firstTextNode, offset: 0 };
              } else if (lastTextNode) {
                return { node: lastTextNode, offset: lastTextNode.textContent.length };
              } else {
                return { node: targetBlock, offset: targetBlock.childNodes.length };
              }
            }
          }
        }
      }
    }

    return result;
  }, []);

  const updateCrossPageSelection = useCallback(() => {
    const state = crossPageDragRef.current;
    if (!state.active || !state.anchorNode) return;
    if (!document.contains(state.anchorNode)) return;

    const caret = getCaretFromPoint(state.pointerX, state.pointerY);
    if (!caret || !isValidDocumentCaret(caret.node)) {
      // Pointer is over page gap, header, footer, or uneditable element.
      // Keep drag active! Do not cancel or collapse native selection.
      return;
    }

    // Single-page drag selection is handled 100% natively and reliably by the browser
    // in both directions (left-to-right and right-to-left).
    // Intervening and programmatically modifying the selection on every mousemove destroys
    // Chromium's native mouse-drag text selection gesture.
    // Only intervene when the drag has actually crossed between different pages!
    const anchorPage = state.anchorNode.nodeType === Node.ELEMENT_NODE
      ? state.anchorNode.closest('.page')
      : state.anchorNode.parentElement?.closest('.page');
    const caretPage = caret.node.nodeType === Node.ELEMENT_NODE
      ? caret.node.closest('.page')
      : caret.node.parentElement?.closest('.page');

    if (anchorPage && caretPage && anchorPage === caretPage) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;

    let applied = false;
    try {
      selection.setBaseAndExtent(
        state.anchorNode,
        state.anchorOffset,
        caret.node,
        caret.offset
      );
      applied = true;
    } catch (_) {
      applied = false;
    }

    if (!applied) {
      try {
        const range = document.createRange();
        const pos = state.anchorNode.compareDocumentPosition(caret.node);
        const isFollowing = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ||
          (state.anchorNode === caret.node && state.anchorOffset <= caret.offset);
        if (isFollowing) {
          range.setStart(state.anchorNode, state.anchorOffset);
          range.setEnd(caret.node, caret.offset);
        } else {
          range.setStart(caret.node, caret.offset);
          range.setEnd(state.anchorNode, state.anchorOffset);
        }
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (_) {}
    }
  }, [getCaretFromPoint, isValidDocumentCaret, crossPageDragRef]);

  const scheduleCrossPageSelectionUpdate = useCallback(() => {
    if (selectionUpdateFrameRef.current) return;
    selectionUpdateFrameRef.current = requestAnimationFrame(() => {
      selectionUpdateFrameRef.current = null;
      updateCrossPageSelection();
    });
  }, [updateCrossPageSelection, selectionUpdateFrameRef]);

  // Keep syncAndNotifyRefInternal up to date
  useEffect(() => {
    syncAndNotifyRefInternal.current = syncAndNotify;
  }, [syncAndNotify, syncAndNotifyRefInternal]);


  return {
    isValidDocumentCaret,
    getCaretFromPoint,
    updateCrossPageSelection,
    scheduleCrossPageSelectionUpdate,
  };
};

export default useCrossPageSelection;
