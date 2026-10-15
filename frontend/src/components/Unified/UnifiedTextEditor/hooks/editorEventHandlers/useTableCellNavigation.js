import { useCallback } from "react";

export const useTableCellNavigation = ({
  pagesContainerRef,
}) => {
  const handleTableCellNavigation = useCallback((cellNode, moveForward) => {
    if (!cellNode) return false;
    const table = cellNode.closest("table");
    if (!table) return false;

    const blockId = table.getAttribute("data-block-id") || "";
    const rootId = blockId.split("_p")[0];

    let allCells = [];
    const container = pagesContainerRef.current || document;
    if (rootId) {
      const tableFragments = Array.from(
        container.querySelectorAll(`table[data-block-id^="${rootId}"]`)
      );
      tableFragments.forEach((tbl) => {
        const cells = Array.from(tbl.querySelectorAll("th, td"));
        allCells.push(...cells);
      });
    }
    if (allCells.length === 0) {
      allCells = Array.from(table.querySelectorAll("th, td"));
    }

    const currentIndex = allCells.indexOf(cellNode);
    if (currentIndex === -1 || allCells.length === 0) return false;

    let targetIndex;
    if (moveForward) {
      // Move rightward to next cell; if at end of horizontal row, move to first cell of line below it
      targetIndex = (currentIndex + 1) % allCells.length;
    } else {
      // Move leftward to previous cell; if at start of horizontal row, move to last cell of line above it
      targetIndex = (currentIndex - 1 + allCells.length) % allCells.length;
    }

    const targetCell = allCells[targetIndex];
    if (!targetCell) return false;

    const selectEl = targetCell.querySelector("select.cell-dropdown");
    if (selectEl) {
      selectEl.focus();
    } else {
      targetCell.focus();
      const range = document.createRange();
      const walker = document.createTreeWalker(targetCell, NodeFilter.SHOW_TEXT, null);
      const firstText = walker.nextNode();
      if (firstText) {
        range.setStart(firstText, 0);
      } else {
        range.selectNodeContents(targetCell);
      }
      range.collapse(true);

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return true;
  }, [pagesContainerRef]);


  return {
    handleTableCellNavigation,
  };
};

export default useTableCellNavigation;
