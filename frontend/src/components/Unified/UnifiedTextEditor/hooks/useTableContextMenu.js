import { useCallback, useEffect, useState } from "react";
import { TableOperations } from "../../../Editor/BlockUtilities";
import TableContextMenu from "../components/TableContextMenu";
import {
  findTableCellAt,
  focusTableCell,
  mergeTableFragments,
  resolveTableCellContext,
} from "../utils/tableContextMenuUtils";
import { getEditorScrollContainer } from "../utils/editorScrollUtils";

export function useTableContextMenu({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  isProgrammaticChangeRef,
  renderFreshFromEngineRef,
  schedulePaginateRef,
  readOnly = false,
  onMakeOption,
  onMergeCells,
  pushToUndo,
}) {
  const [menu, setMenu] = useState(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return undefined;

    const onMouseDown = (e) => {
      if (e.target.closest?.(".table-context-menu")) return;
      closeMenu();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    const onScroll = () => closeMenu();
    const scrollEl = getEditorScrollContainer(pagesContainerRef.current);

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    scrollEl?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      scrollEl?.removeEventListener("scroll", onScroll);
    };
  }, [menu, closeMenu, pagesContainerRef]);

  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root || readOnly) return undefined;

    const onContextMenu = (e) => {
      if (window.isResizingTable) return;

      const cellInfo = findTableCellAt(e.clientX, e.clientY, e.target, root);
      if (!cellInfo) return;

      e.preventDefault();
      e.stopPropagation();

      const context = resolveTableCellContext(
        cellInfo.cell,
        cellInfo.table,
        root
      );
      setMenu({ x: e.clientX, y: e.clientY, context });
    };

    root.addEventListener("contextmenu", onContextMenu);
    return () => root.removeEventListener("contextmenu", onContextMenu);
  }, [pagesContainerRef, readOnly]);

  const executeAction = useCallback(
    (action, ctx) => {
      const engine = documentEngineRef.current;
      const container = pagesContainerRef.current;
      const handler = contentChangeHandlerRef.current;
      if (!engine || !container || !ctx) return;

      if (pushToUndo) {
        pushToUndo(true);
      }

      if (isProgrammaticChangeRef) {
        isProgrammaticChangeRef.current = true;
      }

      try {
        if (handler?.syncDOMToBlocks) {
          handler.syncDOMToBlocks(container);
        }

        const blockId = mergeTableFragments(engine, ctx.rootId);
        const block = engine.getBlock(blockId);
        if (!block) return;

        const tableOps = new TableOperations(engine);
        const { headers = [], rows = [] } = block.content || {};
        const colCount = headers.length || rows[0]?.length || 0;

        let targetAbsoluteRow = ctx.absoluteRowIndex;
        let targetCol = ctx.colIndex;

        switch (action) {
          case "insertRowAbove": {
            const position = ctx.isHeader ? 0 : ctx.bodyRowIndex;
            tableOps.addRowToTable(blockId, position, {
              copyRowHeightFrom: ctx.isHeader ? 0 : ctx.bodyRowIndex,
            });
            if (ctx.isHeader) {
              targetAbsoluteRow = ctx.hasHeader ? 1 : 0;
            } else {
              targetAbsoluteRow = ctx.absoluteRowIndex;
            }
            break;
          }
          case "insertRowBelow": {
            const position = ctx.isHeader ? 0 : ctx.bodyRowIndex + 1;
            tableOps.addRowToTable(blockId, position, {
              copyRowHeightFrom: ctx.isHeader ? 0 : ctx.bodyRowIndex,
            });
            if (ctx.isHeader) {
              targetAbsoluteRow = ctx.hasHeader ? 1 : 0;
            } else {
              targetAbsoluteRow = ctx.absoluteRowIndex + 1;
            }
            break;
          }
          case "insertColumnLeft":
            tableOps.addColumnToTable(blockId, ctx.colIndex);
            targetCol = ctx.colIndex;
            break;
          case "insertColumnRight":
            tableOps.addColumnToTable(blockId, ctx.colIndex + 1);
            targetCol = ctx.colIndex + 1;
            break;
          case "deleteRow": {
            if (ctx.isHeader) {
              if (!headers.length) return;
              engine.updateBlock(blockId, {
                content: {
                  ...block.content,
                  headers: [],
                  meta: block.content?.meta,
                },
              });
              targetAbsoluteRow = 0;
            } else if (rows.length > 1) {
              tableOps.removeRowFromTable(blockId, ctx.bodyRowIndex);
              targetAbsoluteRow = Math.max(
                ctx.hasHeader ? 1 : 0,
                ctx.absoluteRowIndex - 1
              );
            } else if (headers.length > 0) {
              tableOps.removeRowFromTable(blockId, 0);
              targetAbsoluteRow = 0;
            } else {
              return;
            }
            break;
          }
          case "deleteColumn": {
            if (colCount <= 1) return;
            tableOps.removeColumnFromTable(blockId, ctx.colIndex);
            targetCol = Math.max(0, ctx.colIndex - 1);
            break;
          }
          case "deleteTable":
            tableOps.deleteTable(blockId);
            renderFreshFromEngineRef.current?.();
            schedulePaginateRef.current?.();
            return;
          case "mergeCells": {
            if (onMergeCells) {
              onMergeCells(ctx);
            }
            return;
          }
          case "makeOption": {
            if (onMakeOption) {
              onMakeOption({
                blockId: ctx.blockId,
                rootId: ctx.rootId,
                colIndex: ctx.colIndex,
                bodyRowIndex: ctx.bodyRowIndex,
                isHeader: ctx.isHeader,
                absoluteRowIndex: ctx.absoluteRowIndex,
                hasHeader: ctx.hasHeader,
              });
            }
            return;
          }
          default:
            return;
        }

        focusTableCell(container, ctx.rootId, targetAbsoluteRow, targetCol);
        renderFreshFromEngineRef.current?.();
        schedulePaginateRef.current?.();
      } finally {
        if (isProgrammaticChangeRef) {
          setTimeout(() => {
            isProgrammaticChangeRef.current = false;
          }, 50);
        }
      }
    },
    [
      documentEngineRef,
      pagesContainerRef,
      contentChangeHandlerRef,
      isProgrammaticChangeRef,
      renderFreshFromEngineRef,
      schedulePaginateRef,
      onMakeOption,
      pushToUndo,
    ]
  );

  const handleMenuAction = useCallback(
    (actionId) => {
      if (!menu?.context) return;
      executeAction(actionId, menu.context);
    },
    [menu, executeAction]
  );

  const tableContextMenu =
    menu && !readOnly ? (
      <TableContextMenu
        x={menu.x}
        y={menu.y}
        onAction={handleMenuAction}
        onClose={closeMenu}
      />
    ) : null;

  return tableContextMenu;
}

export default useTableContextMenu;
