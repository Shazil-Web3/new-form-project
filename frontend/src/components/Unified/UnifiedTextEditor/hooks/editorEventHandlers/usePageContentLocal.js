import { useCallback } from "react";

export const usePageContentLocal = ({
  pagesContainerRef,
}) => {
  const getActivePageContentLocal = useCallback(() => {
    const root = pagesContainerRef.current;
    if (!root) return null;
    const sel = window.getSelection();
    const node =
      sel && sel.rangeCount
        ? sel.anchorNode.nodeType === 1
          ? sel.anchorNode
          : sel.anchorNode.parentElement
        : null;
    const inContent = node?.closest?.(".page-content");
    if (inContent) return inContent;
    const first = root.querySelector(".page .page-content");
    if (first) {
      const r = document.createRange();
      r.setStart(first, 0);
      r.collapse(true);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    return first;
  }, [pagesContainerRef]);

  // -------- Locked text protection --------

  return {
    getActivePageContentLocal,
  };
};

export default usePageContentLocal;
