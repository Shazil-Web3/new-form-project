/**
 * Keeps table width stable (100% of container) while resizing columns.
 * Uses percentage widths so the outer table boundary does not grow.
 */

export function lockTableWidth(table) {
  table.style.width = "100%";
  table.style.maxWidth = "100%";
  table.style.tableLayout = "fixed";
  table.style.boxSizing = "border-box";
}

export function parseColWidthPx(col, tableWidth) {
  const styleW = col.style?.width || col.getAttribute("width") || "";
  if (styleW.endsWith("%")) {
    return (parseFloat(styleW) / 100) * tableWidth;
  }
  if (styleW.endsWith("px")) {
    return parseFloat(styleW);
  }
  return col.getBoundingClientRect().width;
}

export function getColPercentages(colgroup, tableWidth) {
  const cols = Array.from(colgroup.children);
  if (!cols.length || !tableWidth) return [];

  const pcts = cols.map((col) => {
    const styleW = col.style?.width || col.getAttribute("width") || "";
    if (styleW.endsWith("%")) return parseFloat(styleW);
    const px = parseColWidthPx(col, tableWidth);
    return (px / tableWidth) * 100;
  });

  const sum = pcts.reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 100) > 0.5) {
    return pcts.map((p) => (p / sum) * 100);
  }
  if (sum === 0) {
    const even = 100 / cols.length;
    return cols.map(() => even);
  }
  return pcts;
}

export function setColPercentages(colgroup, percentages) {
  const cols = Array.from(colgroup.children);
  cols.forEach((col, i) => {
    const pct = percentages[i];
    if (pct == null || !Number.isFinite(pct)) return;
    const value = `${pct}%`;
    col.style.width = value;
    col.setAttribute("width", value);
  });
}

export function getTableTotalColumnCount(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  let maxCols = 0;
  rows.forEach((row) => {
    let rowCols = 0;
    Array.from(row.children).forEach((cell) => {
      const span = parseInt(cell.getAttribute("colspan") || "1", 10);
      rowCols += span;
    });
    if (rowCols > maxCols) maxCols = rowCols;
  });
  return Math.max(1, maxCols);
}

export function getCellGridColumnIndex(cell) {
  const row = cell.parentElement;
  if (!row) return 0;
  let gridColIndex = 0;
  for (let i = 0; i < row.children.length; i++) {
    const child = row.children[i];
    const span = parseInt(child.getAttribute("colspan") || "1", 10);
    if (child === cell) {
      return gridColIndex + span - 1;
    }
    gridColIndex += span;
  }
  return gridColIndex;
}

export function ensureColgroupForResize(table, minColWidthPx = 36) {
  const firstRow = table.querySelector("tr");
  if (!firstRow || !firstRow.children.length) return null;

  lockTableWidth(table);
  const tableWidth = table.getBoundingClientRect().width;
  if (!tableWidth) return null;

  const totalCols = getTableTotalColumnCount(table);
  let colgroup = table.querySelector(":scope > colgroup");

  if (colgroup && colgroup.children.length !== totalCols) {
    table.removeChild(colgroup);
    colgroup = null;
  }

  if (!colgroup) {
    colgroup = document.createElement("colgroup");

    const colWidths = new Array(totalCols).fill(0);
    const colCounts = new Array(totalCols).fill(0);

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((row) => {
      let colIdx = 0;
      Array.from(row.children).forEach((cell) => {
        const span = parseInt(cell.getAttribute("colspan") || "1", 10);
        const w = cell.getBoundingClientRect().width;
        const perColW = w / span;
        for (let s = 0; s < span; s++) {
          if (colIdx + s < totalCols) {
            colWidths[colIdx + s] += perColW;
            colCounts[colIdx + s]++;
          }
        }
        colIdx += span;
      });
    });

    const rawWidths = colWidths.map((sum, i) => {
      const count = colCounts[i] || 1;
      const avg = sum / count;
      return Math.max(minColWidthPx, avg || (tableWidth / totalCols));
    });

    const totalRaw = rawWidths.reduce((a, b) => a + b, 0) || tableWidth;
    rawWidths.forEach((w) => {
      const col = document.createElement("col");
      const pct = (w / totalRaw) * 100;
      const value = `${pct}%`;
      col.style.width = value;
      col.setAttribute("width", value);
      colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.firstChild);
  } else {
    setColPercentages(colgroup, getColPercentages(colgroup, tableWidth));
  }

  return colgroup;
}

export function beginColumnResize(table, colgroup, colIndex, minColWidthPx = 36) {
  const tableWidth = table.getBoundingClientRect().width;
  const pcts = getColPercentages(colgroup, tableWidth);
  return {
    tableWidth,
    minColPct: (minColWidthPx / tableWidth) * 100,
    leftPct: pcts[colIndex] ?? 0,
    rightPct: pcts[colIndex + 1] ?? 0,
  };
}

export function applyColumnResize(state, colgroup, colIndex, dxPx) {
  if (!state?.tableWidth) return;

  const dxPct = (dxPx / state.tableWidth) * 100;
  let nextLeft = state.leftPct + dxPct;
  let nextRight = state.rightPct - dxPct;

  const minPct = state.minColPct;
  if (nextLeft < minPct) {
    nextRight -= minPct - nextLeft;
    nextLeft = minPct;
  }
  if (nextRight < minPct) {
    nextLeft -= minPct - nextRight;
    nextRight = minPct;
  }

  const cols = colgroup.children;
  if (cols[colIndex] && cols[colIndex + 1]) {
    cols[colIndex].style.width = `${nextLeft}%`;
    cols[colIndex + 1].style.width = `${nextRight}%`;
  }
}

export function finalizeColumnResize(table, colgroup, colIndex, state, dxPx) {
  applyColumnResize(state, colgroup, colIndex, dxPx);
  const tableWidth = table.getBoundingClientRect().width;
  setColPercentages(colgroup, getColPercentages(colgroup, tableWidth));
}
