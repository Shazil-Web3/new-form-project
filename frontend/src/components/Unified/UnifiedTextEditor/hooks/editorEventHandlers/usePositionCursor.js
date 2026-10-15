import { saveEditorScroll, restoreEditorScroll } from "../../utils/editorScrollUtils";

export const usePositionCursor = ({
  pagesContainerRef,
  setCurrentPage,
}) => {
  function positionCursorAtEndOfBlock(blockId) {
    const container = pagesContainerRef.current;
    if (!container) return;
    
    const blockElement = container.querySelector(`[data-block-id="${blockId}"]`);
    if (!blockElement) return;
    
    const owningPage = blockElement.closest('.page');
    if (owningPage) {
      const pages = Array.from(container.querySelectorAll('.page'));
      const pageIndex = pages.indexOf(owningPage);
      if (pageIndex >= 0) {
        setCurrentPage(pageIndex + 1);
      }
    }
    
    const savedScroll = saveEditorScroll(container);
    const range = document.createRange();
    const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT, null);
    
    let lastTextNode = null;
    let node = walker.nextNode();
    while (node) {
      lastTextNode = node;
      node = walker.nextNode();
    }
    
    if (lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.textContent.length);
    } else {
      range.setStart(blockElement, blockElement.childNodes.length);
    }
    
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    if (blockElement.contentEditable === 'true') {
      try {
        blockElement.focus({ preventScroll: true });
      } catch (_) {}
    }
    restoreEditorScroll(savedScroll);
  }


  return {
    positionCursorAtEndOfBlock,
  };
};

export default usePositionCursor;
