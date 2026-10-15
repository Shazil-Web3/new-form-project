import { getEditorScrollContainer } from "../../UnifiedTextEditor/utils/editorScrollUtils";
import { recreateRangeFromBlockOffsets } from "./RangeBlockHelpers";

/**
 * Apply highlights to the document DOM.
 */
export const applyHighlight = ({
  range,
  id,
  type,
  text,
  status,
  origin,
  stage,
  createdInDraft,
  pagesContainerRef
}) => {
  if (!range || !id) return;

  // CRITICAL FIX: Check for existing highlight WITHIN the editor container
  // If highlight already exists, DO NOT recreate - just return
  const editor = pagesContainerRef?.current;
  const dataAttr = type === "comment" ? "data-comment-id" :
    type === "suggestededit" ? "data-suggestededit-id" : "data-reference-id";
  const existingHighlight = editor?.querySelector(`[${dataAttr}="${id}"]`);

  if (existingHighlight) {
    return; // DO NOT recreate - this prevents duplicates on save/update
  }

  if (status === "deleted") {
    range.deleteContents();
    return;
  }

  // ---- Scroll-lock: save scroll position before any DOM mutation ----
  const scrollContainer = getEditorScrollContainer(editor);
  const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  const restoreScroll = () => {
    if (scrollContainer) scrollContainer.scrollTop = savedScrollTop;
  };
  // ------------------------------------------------------------------

  const wrapSelectionSafely = (targetRange, makeWrapper) => {
    const common =
      targetRange.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? targetRange.commonAncestorContainer.parentNode
        : targetRange.commonAncestorContainer;
    const textNodes = [];
    const walker = document.createTreeWalker(
      common,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node || !node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip nodes that are inside UI elements (like selection-pill)
          if (node.parentElement?.closest('[data-ui-element="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }

          try {
            return targetRange.intersectsNode(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      }
    );
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }
    if (!textNodes.length) return false;

    for (let i = textNodes.length - 1; i >= 0; i--) {
      const textNode = textNodes[i];
      const localRange = document.createRange();

      let startOffset = 0;
      let endOffset = textNode.textContent.length;
      if (textNode === targetRange.startContainer) startOffset = targetRange.startOffset;
      if (textNode === targetRange.endContainer) endOffset = targetRange.endOffset;
      if (startOffset >= endOffset) continue;

      localRange.setStart(textNode, startOffset);
      localRange.setEnd(textNode, endOffset);

      const wrapper = makeWrapper();
      try {
        localRange.surroundContents(wrapper);
      } catch {
        // Skip invalid segment and continue; avoids breaking table structure.
      }
    }
    return true;
  };

  // ========== COMMENTS: Always use simple lightgreen highlight ==========
  if (type === "comment") {
    try {
      wrapSelectionSafely(range, () => {
        const span = document.createElement("span");
        span.style.setProperty('background-color', 'lightgreen');
        span.className = "highlighted-text";
        span.setAttribute("data-comment-id", id);
        if (origin === 'draft' || stage === 'draft' || createdInDraft === true) {
          span.setAttribute("data-comment-origin", "draft");
          span.setAttribute("data-comment-stage", "draft");
          span.setAttribute("data-created-in-draft", "true");
        }
        return span;
      });
    } catch (error) {
      console.warn('Error applying comment highlight:', error);
    }

    restoreScroll();
    return;
  }

  // ========== SUGGESTIONS: Use <del> and <ins> tags for pending status ==========
  if (type === "suggestededit") {
    const wrapper = document.createElement("span");
    wrapper.className = "highlighted-text";
    wrapper.style.setProperty('background-color', 'lightblue');
    wrapper.setAttribute("data-suggestededit-id", id);

    if (status === "pending") {
      const delTag = document.createElement("del");
      delTag.appendChild(range.cloneContents());

      const insTag = document.createElement("ins");
      insTag.textContent = text;

      wrapper.appendChild(delTag);
      wrapper.appendChild(insTag);

      const frag = document.createDocumentFragment();
      frag.appendChild(wrapper);

      range.deleteContents();
      range.insertNode(frag);
      restoreScroll();
      return;
    }

    if (status === "approved") {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      restoreScroll();
      return;
    }

    try {
      wrapSelectionSafely(range, () => {
        const span = document.createElement("span");
        span.style.setProperty('background-color', 'lightblue');
        span.className = "highlighted-text";
        span.setAttribute("data-suggestededit-id", id);
        return span;
      });
    } catch (error) {
      console.warn('Error applying suggestion highlight:', error);
    }

    restoreScroll();
  }

  // ========== REFERENCES: Subtle highlight + superscript number ==========
  if (type === "reference") {
    try {
      wrapSelectionSafely(range, () => {
        const span = document.createElement("span");
        span.style.setProperty('background-color', 'rgba(255, 247, 230, 0.8)');
        span.style.setProperty('border-bottom', '1px dashed #ffa940');
        span.className = "reference-citation-wrapper";
        span.setAttribute("data-reference-id", id);
        return span;
      });
    } catch (error) {
      console.warn('Error applying reference highlight:', error);
    }

    restoreScroll();
  }
};

/**
 * Reconstruct highlights on client when loaded from props or sockets.
 */
export const reconstructHighlight = ({
  element,
  type,
  pagesContainerRef,
  applyHighlightFn
}) => {
  if (!element || !element.selectedText || !element.selectedText.trim()) return;
  const editor = pagesContainerRef?.current;
  if (!editor) return;

  const dataAttr = type === "comment" ? "data-comment-id" : "data-suggestededit-id";
  const existingHighlight = editor.querySelector(`[${dataAttr}="${element.id}"]`);

  if (existingHighlight) {
    console.log('[CommentCore] Highlight already exists in DOM for', element.id, '- skipping reconstruction');
    return;
  }

  // 1. Try precise multi-block offset reconstruction if offsets exist
  if (element.position?.offsets) {
    const recreated = recreateRangeFromBlockOffsets(editor, element.position.offsets);
    if (recreated) {
      applyHighlightFn(recreated, element.id, type, element.text, element.status, {
        origin: element.origin,
        stage: element.stage,
        createdInDraft: element.createdInDraft
      });
      return;
    }
  }

  const exactText = element.selectedText.trim();
  const textNodes = [];

  function findTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node);
    } else {
      for (let child of node.childNodes) {
        findTextNodes(child);
      }
    }
  }

  const blockId = element.position?.startBlockId || element.position?.blockId;
  let targetContainer = editor;
  if (blockId && !element.position?.endBlockId) {
    const blockEl = editor.querySelector(`[data-block-id="${blockId}"]`);
    if (blockEl) {
      targetContainer = blockEl;
    }
  }
  if (targetContainer === editor && element.position) {
    const pages = Array.from(editor.querySelectorAll('.page'));
    const targetPage = (typeof element.position.pageIndex === 'number' && pages[element.position.pageIndex])
      ? pages[element.position.pageIndex]
      : editor;
    targetContainer = targetPage;
  }

  findTextNodes(targetContainer);

  // 2. Single text node exact match
  for (const node of textNodes) {
    const nodeText = node.textContent;
    const matchIndex = nodeText.indexOf(exactText);
    if (matchIndex !== -1) {
      let current = node;
      let isAlreadyHighlighted = false;
      while (current && current !== editor) {
        if (current.nodeType === 1 && (
          current.classList.contains('highlighted-text') ||
          current.getAttribute('data-comment-id') ||
          current.getAttribute('data-suggestededit-id')
        )) {
          isAlreadyHighlighted = true;
          const bg = current.style.backgroundColor;
          if (type === 'comment' && !current.getAttribute('data-comment-id') &&
            (bg === 'lightgreen' || bg.includes('144, 238, 144'))) {
            console.log('[CommentCore] Claiming orphaned highlight for', element.id);
            current.setAttribute('data-comment-id', element.id);
            return;
          }
          if (current.getAttribute(`data-${type === 'comment' ? 'comment-id' : 'suggestededit-id'}`) === element.id) {
            return;
          }
          break;
        }
        current = current.parentNode;
      }

      if (isAlreadyHighlighted) {
        continue;
      }

      const range = document.createRange();
      range.setStart(node, matchIndex);
      range.setEnd(node, matchIndex + exactText.length);
      applyHighlightFn(range, element.id, type, element.text, element.status, {
        origin: element.origin,
        stage: element.stage,
        createdInDraft: element.createdInDraft
      });
      return;
    }
  }

  // 3. Multi-line fallback match across consecutive text nodes
  const firstChunk = exactText.slice(0, Math.min(25, exactText.length)).trim();
  const lastChunk = exactText.slice(Math.max(0, exactText.length - 25)).trim();
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const txt = node.textContent;
    if (!startNode && firstChunk && txt.includes(firstChunk)) {
      startNode = node;
      startOffset = txt.indexOf(firstChunk);
    }
    if (startNode && lastChunk && txt.includes(lastChunk)) {
      endNode = node;
      endOffset = txt.indexOf(lastChunk) + lastChunk.length;
      break;
    }
  }

  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      applyHighlightFn(range, element.id, type, element.text, element.status, {
        origin: element.origin,
        stage: element.stage,
        createdInDraft: element.createdInDraft
      });
    } catch (e) {
      console.warn('[CommentCore] Fallback multi-line range match failed:', e);
    }
  }
};
