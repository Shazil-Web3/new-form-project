import { useState, useEffect, useCallback } from "react";
import { getEditorScrollContainer } from "../utils/editorScrollUtils";

/**
 * Build a 2D virtual grid map for a table that accounts for colspan and rowspan.
 *
 * Returns:
 *   grid[r][c]  → the DOM <td>/<th> element that visually occupies grid cell (r, c)
 *   cellInfos   → Map( DOMcell → { rStart, cStart, rEnd, cEnd } )
 *   allRows     → flat ordered array of all <tr> elements in the table
 */
function buildTableGrid(table) {
  const allRows = Array.from(table.querySelectorAll("tr"));
  const numRows = allRows.length;

  // Use plain objects as sparse arrays for each row
  const grid = Array.from({ length: numRows }, () => ({}));
  const cellInfos = new Map();

  for (let r = 0; r < numRows; r++) {
    const row = allRows[r];
    const domCells = Array.from(row.children);
    let domIdx = 0;
    let c = 0;

    while (domIdx < domCells.length) {
      // Skip columns already occupied by a rowspan from a cell above
      while (grid[r][c] !== undefined) c++;

      const cell = domCells[domIdx];
      const colspan = Math.max(1, parseInt(cell.getAttribute("colspan") || "1", 10));
      const rowspan = Math.max(1, parseInt(cell.getAttribute("rowspan") || "1", 10));

      const rStart = r;
      const cStart = c;
      const rEnd = Math.min(r + rowspan - 1, numRows - 1);
      const cEnd = c + colspan - 1;

      cellInfos.set(cell, { rStart, cStart, rEnd, cEnd });

      // Stamp every visual cell this DOM element spans
      for (let rr = rStart; rr <= rEnd; rr++) {
        for (let cc = cStart; cc <= cEnd; cc++) {
          grid[rr][cc] = cell;
        }
      }

      c += colspan;
      domIdx++;
    }
  }

  return { grid, cellInfos, allRows };
}

export function useTableMerge({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  renderFreshFromEngineRef,
  schedulePaginateRef,
  pushToUndo,
  readOnly = false,
}) {
  const [selectionInfo, setSelectionInfo] = useState(null);

  const checkSelection = useCallback(() => {
    if (readOnly) {
      setSelectionInfo(null);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelectionInfo(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = pagesContainerRef.current;
    if (!container) {
      setSelectionInfo(null);
      return;
    }

    const getCell = (node) => {
      if (!node) return null;
      const el = node.nodeType === 1 ? node : node.parentElement;
      return el?.closest?.("td, th");
    };

    const startCell = getCell(range.startContainer);
    const endCell = getCell(range.endContainer);

    if (!startCell || !endCell) {
      setSelectionInfo(null);
      return;
    }

    const table =
      startCell.closest("table[data-block-id]") || startCell.closest("table");
    const endTable =
      endCell.closest("table[data-block-id]") || endCell.closest("table");

    if (!table || table !== endTable || !container.contains(table)) {
      setSelectionInfo(null);
      return;
    }

    if (startCell === endCell) {
      setSelectionInfo(null);
      return;
    }

    // Build a grid-aware map so colspan/rowspan are correctly accounted for
    const { grid, cellInfos } = buildTableGrid(table);

    const startInfo = cellInfos.get(startCell);
    const endInfo = cellInfos.get(endCell);

    if (!startInfo || !endInfo) {
      setSelectionInfo(null);
      return;
    }

    // Visual bounding box that encompasses both anchor cells (including their spans)
    const rMin = Math.min(startInfo.rStart, endInfo.rStart);
    const rMax = Math.max(startInfo.rEnd, endInfo.rEnd);
    const cMin = Math.min(startInfo.cStart, endInfo.cStart);
    const cMax = Math.max(startInfo.cEnd, endInfo.cEnd);

    // Collect every unique DOM cell inside that rectangle
    const cellSet = new Set();
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const cell = grid[r]?.[c];
        if (cell) cellSet.add(cell);
      }
    }

    const selectedCells = Array.from(cellSet);

    if (selectedCells.length <= 1) {
      setSelectionInfo(null);
      return;
    }

    // Button position — prefer above the selection, fall back to below,
    // always clamped inside the visible viewport.
    const rect = range.getBoundingClientRect();
    const BTN_W = 130;
    const BTN_H = 36;
    const MARGIN = 10;

    let top = rect.top - BTN_H - 8;
    let left = rect.left + rect.width / 2 - BTN_W / 2;

    if (top < MARGIN) top = rect.bottom + 8;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (top + BTN_H > vh - MARGIN) top = vh - BTN_H - MARGIN;
    if (top < MARGIN) top = MARGIN;
    if (left + BTN_W > vw - MARGIN) left = vw - BTN_W - MARGIN;
    if (left < MARGIN) left = MARGIN;

    setSelectionInfo({
      top,
      left,
      table,
      startCell,
      endCell,
      selectedCells,
      rMin,
      rMax,
      cMin,
      cMax,
    });
  }, [pagesContainerRef, readOnly]);

  useEffect(() => {
    const handleSelectionChange = () => {
      setTimeout(checkSelection, 10);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleSelectionChange);

    const scrollEl = getEditorScrollContainer(pagesContainerRef.current);
    scrollEl?.addEventListener("scroll", handleSelectionChange, { passive: true });

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleSelectionChange);
      scrollEl?.removeEventListener("scroll", handleSelectionChange);
    };
  }, [checkSelection, pagesContainerRef]);

  const executeMerge = useCallback(
    (overrideInfo) => {
      const info = overrideInfo || selectionInfo;
      if (!info || !info.table || info.selectedCells.length <= 1) return;

      const { table, selectedCells, rMin, rMax, cMin, cMax } = info;
      const container = pagesContainerRef.current;
      if (!container) return;

      if (pushToUndo) pushToUndo(true);

      // Rebuild grid fresh at merge time (state may differ from when checkSelection ran)
      const { grid, cellInfos, allRows } = buildTableGrid(table);

      // Primary cell = top-left visual position of the selection
      const primaryCell = grid[rMin]?.[cMin];
      if (!primaryCell) return;

      // Expand the merge region to cover any existing spans that reach beyond
      // the original selection box (e.g. a colspan=2 cell whose right edge is > cMax)
      let actualRMax = rMax;
      let actualCMax = cMax;
      for (const cell of selectedCells) {
        const ci = cellInfos.get(cell);
        if (ci) {
          if (ci.rEnd > actualRMax) actualRMax = ci.rEnd;
          if (ci.cEnd > actualCMax) actualCMax = ci.cEnd;
        }
      }

      const newColSpan = actualCMax - cMin + 1;
      const newRowSpan = actualRMax - rMin + 1;

      // Gather ALL DOM cells inside the final merged region to remove them
      const toRemove = new Set();
      for (let r = rMin; r <= actualRMax; r++) {
        for (let c = cMin; c <= actualCMax; c++) {
          const cell = grid[r]?.[c];
          if (cell && cell !== primaryCell) toRemove.add(cell);
        }
      }

      // Merge text: primary first, then others (deduped)
      const contents = [];
      const primaryText = primaryCell.innerText.trim();
      if (primaryText) contents.push(primaryText);
      for (const cell of toRemove) {
        const text = cell.innerText.trim();
        if (text && !contents.includes(text)) contents.push(text);
      }
      primaryCell.innerText = contents.join(" ");

      // Apply the correct spans
      if (newColSpan > 1) {
        primaryCell.setAttribute("colspan", newColSpan);
      } else {
        primaryCell.removeAttribute("colspan");
      }
      if (newRowSpan > 1) {
        primaryCell.setAttribute("rowspan", newRowSpan);
      } else {
        primaryCell.removeAttribute("rowspan");
      }

      // Remove all non-primary cells that were part of the merged region
      for (const cell of toRemove) {
        cell.parentElement?.removeChild(cell);
      }

      // Clean up any rows that became completely empty after cell removal
      allRows.forEach((row) => {
        if (row.isConnected && row.children.length === 0) {
          row.parentElement?.removeChild(row);
        }
      });

      window.getSelection()?.removeAllRanges();
      setSelectionInfo(null);

      // Synchronize DOM with engine blocks
      try {
        if (contentChangeHandlerRef.current?.syncDOMToBlocks) {
          contentChangeHandlerRef.current.syncDOMToBlocks(container);
        }
      } catch (e) {
        console.warn("syncDOMToBlocks during merge error:", e);
      }

      renderFreshFromEngineRef.current?.();
      schedulePaginateRef.current?.();

      setTimeout(() => {
        const sel = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(primaryCell);
        r.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(r);
      }, 50);
    },
    [
      pagesContainerRef,
      contentChangeHandlerRef,
      renderFreshFromEngineRef,
      schedulePaginateRef,
      pushToUndo,
      selectionInfo,
    ]
  );

  return {
    selectionInfo,
    executeMerge,
  };
}

export default useTableMerge;
