import { BLOCK_TYPES } from "../../../Editor/DocumentEngine";

export function getContinuationRootId(blockId = "") {
  let root = blockId;
  while (/_p\d+$/.test(root)) root = root.replace(/_p\d+$/, "");
  return root;
}

function mergeTablePair(a, b) {
  const aContent = a.content || {};
  const bContent = b.content || {};
  const aMeta = aContent.meta || {};
  const bMeta = bContent.meta || {};
  const aCells = Array.isArray(aMeta.cell) ? aMeta.cell : [];
  const bCells = Array.isArray(bMeta.cell) ? bMeta.cell : [];
  const aRowHeights = Array.isArray(aMeta.rowHeights) ? aMeta.rowHeights : [];
  const bRowHeights = Array.isArray(bMeta.rowHeights) ? bMeta.rowHeights : [];

  const hasHeader = Array.isArray(aContent.headers) && aContent.headers.length > 0;
  const bBodyCells = hasHeader ? bCells.slice(1) : bCells;

  const nextMetadata = { ...(a.metadata || {}) };
  delete nextMetadata.continuedTo;
  delete nextMetadata.continuedFrom;
  if (b?.metadata?.continuedTo) {
    nextMetadata.continuedTo = b.metadata.continuedTo;
  }

  return {
    ...a,
    content: {
      headers: aContent.headers || [],
      rows: [...(aContent.rows || []), ...(bContent.rows || [])],
      meta: {
        ...aMeta,
        ...bMeta,
        columnWidths: (aMeta.columnWidths?.length ? aMeta.columnWidths : bMeta.columnWidths) || [],
        cell: [...aCells, ...bBodyCells],
        rowHeights: [...aRowHeights, ...bRowHeights],
      },
    },
    metadata: nextMetadata,
  };
}

/** Merge paginated table fragments into a single block before structural edits. */
export function mergeTableFragments(documentEngine, rootId) {
  const fragments = documentEngine
    .getAllBlocks()
    .filter(
      (b) =>
        b?.type === BLOCK_TYPES.TABLE &&
        getContinuationRootId(b.id) === rootId
    );

  if (fragments.length <= 1) {
    return fragments[0]?.id || rootId;
  }

  let merged = {
    ...fragments[0],
    content: {
      headers: [...(fragments[0].content?.headers || [])],
      rows: (fragments[0].content?.rows || []).map((r) => [...r]),
      meta: { ...(fragments[0].content?.meta || {}) },
    },
    metadata: { ...(fragments[0].metadata || {}) },
  };

  for (let i = 1; i < fragments.length; i++) {
    merged = mergeTablePair(merged, fragments[i]);
  }

  const primaryId = fragments[0].id;
  documentEngine.updateBlock(primaryId, {
    content: merged.content,
    metadata: merged.metadata,
  });

  for (let i = 1; i < fragments.length; i++) {
    documentEngine.removeBlock(fragments[i].id);
  }

  return primaryId;
}

export function findTableCellAt(x, y, target, pagesContainer) {
  if (!pagesContainer) return null;

  if (target) {
    const cell =
      target.tagName === "TD" || target.tagName === "TH"
        ? target
        : target.closest?.("td, th");
    if (cell) {
      const table = cell.closest("table[data-block-id]");
      if (table && pagesContainer.contains(table)) {
        return { cell, table, row: cell.parentElement };
      }
    }
  }

  const stack = document.elementsFromPoint(x, y);
  for (let i = 0; i < stack.length; i++) {
    const el = stack[i];
    const cell =
      el.tagName === "TD" || el.tagName === "TH"
        ? el
        : el.closest?.("td, th");
    if (cell) {
      const table = cell.closest("table[data-block-id]");
      if (table && pagesContainer.contains(table)) {
        return { cell, table, row: cell.parentElement };
      }
    }
  }

  return null;
}

export function resolveTableCellContext(cell, table, pagesContainer) {
  const blockId = table.getAttribute("data-block-id");
  const rootId = getContinuationRootId(blockId);
  const tr = cell.parentElement;
  const colIndex = Math.max(0, Array.from(tr.children).indexOf(cell));
  const isHeader = cell.tagName === "TH" || !!tr.closest("thead");
  const hasHeader = !!table.querySelector("thead tr");

  const tbody = table.querySelector("tbody") || table;
  const bodyRows = Array.from(tbody.querySelectorAll(":scope > tr"));
  const bodyRowIndex = isHeader ? -1 : Math.max(0, bodyRows.indexOf(tr));

  let absoluteRowIndex = 0;
  if (pagesContainer) {
    const possibleBlocks = Array.from(
      pagesContainer.querySelectorAll(`[data-block-id^="${rootId}"]`)
    ).filter((el) => {
      const id = el.getAttribute("data-block-id");
      return id === rootId || id.startsWith(`${rootId}_p`);
    });

    const allRows = [];
    possibleBlocks.forEach((part) => {
      if (part.tagName.toLowerCase() === "table") {
        part.querySelectorAll("thead, tbody").forEach((sec) => {
          allRows.push(
            ...Array.from(sec.children).filter(
              (c) => c.tagName.toLowerCase() === "tr"
            )
          );
        });
      }
    });
    const idx = allRows.indexOf(tr);
    absoluteRowIndex = idx >= 0 ? idx : 0;
  }

  return {
    blockId,
    rootId,
    colIndex,
    bodyRowIndex,
    isHeader,
    hasHeader,
    absoluteRowIndex,
  };
}

export function focusTableCell(pagesContainer, rootId, absoluteRowIndex, colIndex) {
  if (!pagesContainer) return false;

  const possibleBlocks = Array.from(
    pagesContainer.querySelectorAll(`[data-block-id^="${rootId}"]`)
  ).filter((el) => {
    const id = el.getAttribute("data-block-id");
    return id === rootId || id.startsWith(`${rootId}_p`);
  });

  const allRows = [];
  possibleBlocks.forEach((blockEl) => {
    if (blockEl.tagName.toLowerCase() === "table") {
      blockEl.querySelectorAll("thead, tbody").forEach((sec) => {
        allRows.push(
          ...Array.from(sec.children).filter(
            (c) => c.tagName.toLowerCase() === "tr"
          )
        );
      });
    }
  });

  const row = allRows[absoluteRowIndex];
  const cell = row?.children[colIndex];
  if (!cell) return false;

  const range = document.createRange();
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
  const firstText = walker.nextNode();
  if (firstText) {
    range.setStart(firstText, 0);
  } else {
    range.selectNodeContents(cell);
  }
  range.collapse(true);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
