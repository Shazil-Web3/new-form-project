import { useEffect } from "react";
import {
  beginColumnResize,
  ensureColgroupForResize,
  finalizeColumnResize,
  applyColumnResize,
  getCellGridColumnIndex,
} from "../../../../Editor/tableColumnResizeHelpers";
import { getEditorScrollContainer } from "../../utils/editorScrollUtils";

export const useTableResize = ({
  pagesContainerRef,
  schedulePaginateRef,
  user,
  readOnly,
  pushToUndo,
  paginationTimeoutRef,
  activeTableResizeRef,
  syncAndNotifyRefInternal,
  crossPageDragRef,
  selectionUpdateFrameRef,
  isValidDocumentCaret,
  getCaretFromPoint,
  scheduleCrossPageSelectionUpdate,
  handlePageClick,
}) => {

  useEffect(() => {
    return () => {
      if (paginationTimeoutRef.current) clearTimeout(paginationTimeoutRef.current);
    };
  }, []);

  // -------- Table boundary resize (Production-grade, Google-Docs-like) --------
  useEffect(() => {
    if (readOnly) return;

    // ── Constants ──
    const EDGE_PX = 6;          // Reduced from 10 to prevent accidental interception of clicks
    const MIN_COL_WIDTH = 36;    // minimum column width in px
    const MIN_ROW_HEIGHT = 20;   // minimum row height in px

    // ── Drag-time event blockers (prevent browser text selection / native drag) ──
    const blockSelect = (e) => { e.preventDefault(); };
    const blockDrag   = (e) => { e.preventDefault(); };

    // ── Helper: find the cell nearest to (clientX, clientY) within any table ──
    const findCellAt = (x, y, target) => {
      const root = pagesContainerRef.current;
      if (!root) return null;

      // 1. Super-fast direct element check (works 99% of the time without layout calculations)
      if (target) {
        const cell = (target.tagName === "TD" || target.tagName === "TH") ? target : target.closest?.("td, th");
        if (cell) {
          const table = cell.closest("table[data-block-id]");
          if (table && root.contains(table)) {
            return { cell, table, row: cell.parentElement };
          }
        }
      }

      // 2. Performance Safeguard: only perform elementsFromPoint if target is inside or near a table
      const isNearTable = target && (target.closest?.("table[data-block-id]") || target.querySelector?.("table[data-block-id]"));
      if (!isNearTable) {
        return null;
      }

      // 3. Fallback: Direct hit search
      const stack = document.elementsFromPoint(x, y);
      for (let i = 0; i < stack.length; i++) {
        const el = stack[i];
        const cell = (el.tagName === "TD" || el.tagName === "TH") ? el : el.closest?.("td, th");
        if (cell) {
          const table = cell.closest("table[data-block-id]");
          if (table && root.contains(table)) {
            return { cell, table, row: cell.parentElement };
          }
        }
      }

      // 4. Fallback: 10px Bounding Box Search (only for misses on 1px borders)
      const offsets = [
        [-2, 0], [2, 0], [0, -2], [0, 2],
        [-5, 0], [5, 0], [0, -5], [0, 5],
        [-8, 0], [8, 0], [0, -8], [0, 8],
        [-10, 0], [10, 0], [0, -10], [0, 10]
      ];
      for (const [dx, dy] of offsets) {
        const nearbyStack = document.elementsFromPoint(x + dx, y + dy);
        for (let i = 0; i < nearbyStack.length; i++) {
          const el = nearbyStack[i];
          const cell = (el.tagName === "TD" || el.tagName === "TH") ? el : el.closest?.("td, th");
          if (cell) {
            const table = cell.closest("table[data-block-id]");
            if (table && root.contains(table)) {
              return { cell, table, row: cell.parentElement };
            }
          }
        }
      }

      return null;
    };

    // ── Helper: detect which edge (if any) the pointer is near ──
    const detectEdge = (x, y, cellInfo) => {
      if (!cellInfo) return null;
      const { cell, row, table } = cellInfo;
      const rect = cell.getBoundingClientRect();
      const isLastCell = !cell.nextElementSibling || cell === row.lastElementChild;
      if (!isLastCell && Math.abs(x - rect.right) <= EDGE_PX) {
        return { type: "col", cell, table, row, side: "right" };
      }
      if (cell.previousElementSibling && Math.abs(x - rect.left) <= EDGE_PX) {
        return { type: "col", cell: cell.previousElementSibling, table, row, side: "right" };
      }
      if (Math.abs(y - rect.bottom) <= EDGE_PX) {
        return { type: "row", cell, table, row, side: "bottom" };
      }
      if (Math.abs(y - rect.top) <= EDGE_PX) {
        const prevRow = row.previousElementSibling;
        if (prevRow && prevRow.tagName === "TR") {
          return { type: "row", cell, table, row: prevRow, side: "bottom" };
        }
      }
      return null;
    };

    const onMouseMove = (e) => {
      if (activeTableResizeRef.current) return;
      const root = pagesContainerRef.current;
      if (!root) return;

      const cellInfo = findCellAt(e.clientX, e.clientY, e.target);
      const edge = detectEdge(e.clientX, e.clientY, cellInfo);
      root.style.cursor = edge ? (edge.type === "col" ? "col-resize" : "row-resize") : "";
    };

    const onMouseDown = (e) => {
      if (e.button !== 0 || activeTableResizeRef.current) return;
      if (e.target.closest?.(".cell-dropdown")) return;
      const cellInfo = findCellAt(e.clientX, e.clientY, e.target);
      const edge = detectEdge(e.clientX, e.clientY, cellInfo);
      if (!edge) return;

      pushToUndo?.();

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const { table, row } = edge;
      const cursorType = edge.type === "col" ? "col-resize" : "row-resize";

      if (edge.type === "col") {
        const colgroup = ensureColgroupForResize(table, MIN_COL_WIDTH);
        if (!colgroup) return;
        const cellIndex = getCellGridColumnIndex(edge.cell);
        if (cellIndex < 0) return;
        const cols = Array.from(colgroup.children);
        if (!cols[cellIndex] || !cols[cellIndex + 1]) return;
        const colState = beginColumnResize(table, colgroup, cellIndex, MIN_COL_WIDTH);
        activeTableResizeRef.current = {
          type: "col",
          table,
          colgroup,
          index: cellIndex,
          startX: e.clientX,
          ...colState,
        };
      } else {
        const startH = Math.max(MIN_ROW_HEIGHT, Math.round(row.getBoundingClientRect().height));
        activeTableResizeRef.current = { type: "row", table, row, startY: e.clientY, startH };
      }

      window.isResizingTable = true;
      document.body.style.cursor = cursorType;

      // EXTREME LOCKDOWN: Clear all browser selections and remove active focus
      try {
        window.getSelection()?.removeAllRanges();
        if (document.activeElement && typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
      } catch (_) {}

      // Inject dynamically a global stylesheet that forces pointer-events: none and user-select: none
      // on everything to bypass Chrome's native editing-host selection/drag-drop hijacking!
      const styleId = "table-resize-lockdown-styles";
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        styleTag.innerHTML = `
          .resizing-table-active * {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            pointer-events: none !important;
          }
          .resizing-table-active table[data-block-id] {
            pointer-events: auto !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
      document.body.classList.add("resizing-table-active");

      window.addEventListener("selectstart", blockSelect, { capture: true });
      window.addEventListener("dragstart", blockDrag, { capture: true });
      window.addEventListener("mousemove", onGlobalMouseMove, { capture: true });
      window.addEventListener("mouseup", onGlobalMouseUp, { capture: true });
    };

    const onGlobalMouseMove = (e) => {
      const state = activeTableResizeRef.current;
      if (!state) return;
      e.preventDefault();
      if (state.type === "col") {
        applyColumnResize(state, state.colgroup, state.index, e.clientX - state.startX);
      } else if (state.type === "row") {
        const dy = e.clientY - state.startY;
        const nextH = Math.max(MIN_ROW_HEIGHT, state.startH + dy);
        state.row.style.height = `${nextH}px`;
        state.row.style.minHeight = `${nextH}px`;
      }
    };

    const onGlobalMouseUp = (e) => {
      const state = activeTableResizeRef.current;
      if (!state) return;
      if (state.type === "col") {
        finalizeColumnResize(
          state.table,
          state.colgroup,
          state.index,
          state,
          e.clientX - state.startX
        );
      }
      activeTableResizeRef.current = null;
      window.isResizingTable = false;

      // Clean up lockdown styles
      document.body.classList.remove("resizing-table-active");
      const styleTag = document.getElementById("table-resize-lockdown-styles");
      if (styleTag) styleTag.remove();

      window.removeEventListener("mousemove", onGlobalMouseMove, { capture: true });
      window.removeEventListener("mouseup", onGlobalMouseUp, { capture: true });
      window.removeEventListener("selectstart", blockSelect, { capture: true });
      window.removeEventListener("dragstart", blockDrag, { capture: true });
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      const root = pagesContainerRef.current;
      if (root) root.style.cursor = "";

      requestAnimationFrame(() => {
        syncAndNotifyRefInternal.current?.();
        setTimeout(() => schedulePaginateRef.current?.(), 50);
      });
    };

    const handleDragMouseDown = (e) => {
      if (e.button !== 0 || window.isResizingTable || activeTableResizeRef.current) return;
      const target = e.target instanceof Element ? e.target : e.target?.parentElement;
      if (!target) return;

      const pageContent = target.closest('.page-content');
      if (!pageContent) return;

      const blocked = target.closest('[contenteditable="false"], .cell-dropdown, figure.video-block, iframe');
      if (blocked) return;

      const initialCaret = getCaretFromPoint(e.clientX, e.clientY);
      if (initialCaret && isValidDocumentCaret(initialCaret.node)) {
        crossPageDragRef.current = {
          active: true,
          anchorNode: initialCaret.node,
          anchorOffset: initialCaret.offset,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
      } else {
        crossPageDragRef.current.pointerX = e.clientX;
        crossPageDragRef.current.pointerY = e.clientY;
      }

      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!crossPageDragRef.current.anchorNode && sel && sel.anchorNode && pagesContainerRef.current?.contains(sel.anchorNode)) {
          crossPageDragRef.current.anchorNode = sel.anchorNode;
          crossPageDragRef.current.anchorOffset = sel.anchorOffset;
          crossPageDragRef.current.active = true;
        }
      });
    };

    const handleDragMouseMove = (e) => {
      if (!crossPageDragRef.current.active) return;
      if (e.buttons !== 1) {
        crossPageDragRef.current.active = false;
        return;
      }
      crossPageDragRef.current.pointerX = e.clientX;
      crossPageDragRef.current.pointerY = e.clientY;
      scheduleCrossPageSelectionUpdate();
    };

    const handleDragMouseUp = () => {
      if (crossPageDragRef.current.active) {
        crossPageDragRef.current.active = false;
      }
      if (selectionUpdateFrameRef.current) {
        cancelAnimationFrame(selectionUpdateFrameRef.current);
        selectionUpdateFrameRef.current = null;
      }
    };

    const handleContainerScroll = () => {
      if (crossPageDragRef.current.active) {
        scheduleCrossPageSelectionUpdate();
      }
    };

    const rootEl = pagesContainerRef.current;
    const scrollEl = rootEl ? (getEditorScrollContainer(rootEl) || rootEl.closest('.editor-container')) : null;

    if (rootEl) {
      rootEl.addEventListener("mousemove", onMouseMove);
      rootEl.addEventListener("mousedown", onMouseDown, { capture: true });
      rootEl.addEventListener("mousedown", handlePageClick, { capture: true });
      rootEl.addEventListener("mousedown", handleDragMouseDown, { capture: false });
    }
    window.addEventListener("mousemove", handleDragMouseMove, { capture: true });
    window.addEventListener("mouseup", handleDragMouseUp, { capture: true });
    if (scrollEl) {
      scrollEl.addEventListener("scroll", handleContainerScroll, { passive: true });
    }

    return () => {
      if (rootEl) {
        rootEl.removeEventListener("mousemove", onMouseMove);
        rootEl.removeEventListener("mousedown", onMouseDown, { capture: true });
        rootEl.removeEventListener("mousedown", handlePageClick, { capture: true });
        rootEl.removeEventListener("mousedown", handleDragMouseDown, { capture: false });
      }
      window.removeEventListener("mousemove", handleDragMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleDragMouseUp, { capture: true });
      if (scrollEl) {
        scrollEl.removeEventListener("scroll", handleContainerScroll);
      }
      window.removeEventListener("mousemove", onGlobalMouseMove, { capture: true });
      window.removeEventListener("mouseup", onGlobalMouseUp, { capture: true });
      window.removeEventListener("selectstart", blockSelect, { capture: true });
      window.removeEventListener("dragstart", blockDrag, { capture: true });

      // Clean up lockdown styles in case of unmount mid-drag
      document.body.classList.remove("resizing-table-active");
      const styleTag = document.getElementById("table-resize-lockdown-styles");
      if (styleTag) styleTag.remove();

      window.isResizingTable = false;
      if (activeTableResizeRef.current) {
        activeTableResizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
      }
      const root = pagesContainerRef.current;
      if (root) root.style.cursor = "";
    };
  }, [pagesContainerRef, schedulePaginateRef, handlePageClick, pushToUndo, scheduleCrossPageSelectionUpdate, readOnly]);

  // Recalculate helper here since it depends on ref
};

export default useTableResize;
