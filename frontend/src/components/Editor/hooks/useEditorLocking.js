import { useCallback, useEffect } from 'react';

export function useEditorLocking({
  pagesContainerRef,
  savedSelectionRef,
  contentChangeHandlerRef,
  documentEngineRef,
  handleTextChange,
}) {
  const handleMakeEditable = useCallback(() => {
    if (!pagesContainerRef.current) return;

    let sel = window.getSelection();
    let range =
      sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;

    if (!range && savedSelectionRef.current) {
      range = savedSelectionRef.current.cloneRange();
    }

    if (!range) return;

    // Sync DOM to blocks first to ensure we're working with current state
    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }

    // Find the owning block
    let containerNode = range.commonAncestorContainer;
    if (containerNode.nodeType === Node.TEXT_NODE)
      containerNode = containerNode.parentNode;
    const blockElement = containerNode.closest?.("[data-block-id]");
    if (!blockElement) return;

    const blockId = blockElement.getAttribute("data-block-id");
    const engine = documentEngineRef.current;

    // Check if selection overlaps existing locked spans (data-locked; class "locked"
    // may be stripped by sanitizer while data-locked is preserved)
    const lockedSpans = Array.from(
      blockElement.querySelectorAll('[data-locked="true"]')
    ).filter((span) => {
      const spanRange = document.createRange();
      spanRange.selectNodeContents(span);
      return (
        range.compareBoundaryPoints(Range.END_TO_START, spanRange) > 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, spanRange) < 0
      );
    });

    const depthInBlock = (el) => {
      let d = 0;
      let n = el;
      while (n && n !== blockElement) {
        d += 1;
        n = n.parentElement;
      }
      return d;
    };
    lockedSpans.sort((a, b) => depthInBlock(b) - depthInBlock(a));

    if (lockedSpans.length > 0) {
      // UNLOCK: If we overlap existing locks, remove them (deepest first)
      lockedSpans.forEach((span) => {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      });
      blockElement.normalize();
      engine.updateBlock(blockId, { content: blockElement.innerHTML });
      handleTextChange();
      return;
    }

    // LOCK: Wrap selection in a locked span
    // For simplicity, we process text nodes within the range
    const textNodes = [];
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      if (!range.intersectsNode(node)) continue;
      if (node.parentElement?.closest?.('[data-locked="true"]')) continue;
      textNodes.push(node);
    }

    textNodes.forEach((node) => {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);

      let start = 0;
      let end = node.textContent.length;

      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;

      if (start >= end) return;

      const localRange = document.createRange();
      localRange.setStart(node, start);
      localRange.setEnd(node, end);

      const span = document.createElement("span");
      span.className = "locked-text locked";
      span.setAttribute("contenteditable", "false");
      span.setAttribute("data-locked", "true");

      try {
        localRange.surroundContents(span);
      } catch (e) {
        console.warn("Could not surround node with locked span", e);
      }
    });

    blockElement.normalize();
    engine.updateBlock(blockId, { content: blockElement.innerHTML });
    handleTextChange();
  }, [handleTextChange, pagesContainerRef, savedSelectionRef, contentChangeHandlerRef, documentEngineRef]);

  // Protection logic for locked text
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const enforceLocking = () => {
      const lockedElements = container.querySelectorAll('[data-locked="true"]');
      lockedElements.forEach(el => {
        if (el.getAttribute('contenteditable') !== 'false') {
          el.setAttribute('contenteditable', 'false');
        }
        // Ensure visual feedback
        if (!el.classList.contains('locked')) {
          el.classList.add('locked');
        }
        if (!el.classList.contains('locked-text')) {
          el.classList.add('locked-text');
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldEnforce = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldEnforce = true;
          break;
        }
      }
      if (shouldEnforce) enforceLocking();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'data-locked', 'class']
    });

    enforceLocking();

    return () => observer.disconnect();
  }, [pagesContainerRef]);

  return { handleMakeEditable };
}

export default useEditorLocking;
