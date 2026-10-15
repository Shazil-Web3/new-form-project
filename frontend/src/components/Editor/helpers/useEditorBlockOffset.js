import { useCallback } from 'react';

export function useEditorBlockOffset(pagesContainerRef) {
  const getBlockAndOffset = useCallback((containerNode, offset) => {
    let node = containerNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    const blockEl = node.closest("[data-block-id]");
    if (!blockEl) return null;
    const rootId = blockEl.getAttribute("data-block-id").replace(/(_p\d+)+$/, '');

    let absolutePos = 0;
    const container = pagesContainerRef.current;
    if (container) {
      const allFragments = Array.from(container.querySelectorAll(`[data-block-id]`))
        .filter(el => {
          const id = el.getAttribute('data-block-id');
          return id === rootId || id.startsWith(rootId + '_p');
        });

      const currentIndex = allFragments.indexOf(blockEl);
      if (currentIndex > 0) {
        for (let i = 0; i < currentIndex; i++) {
          absolutePos += allFragments[i].textContent.length;
        }
      }
    }

    let tableCellInfo = null;
    if (blockEl.tagName.toLowerCase() === 'table') {
      let cell = null;
      if (containerNode.nodeType === Node.ELEMENT_NODE) {
        if (
          containerNode.tagName?.toLowerCase() === 'select' &&
          containerNode.classList?.contains('cell-dropdown')
        ) {
          cell = containerNode.closest('td, th');
        }
        if (!cell) {
          cell = containerNode.closest('td, th');
        }
        if (!cell) {
          if (containerNode.tagName.toLowerCase() === 'tr') {
            cell = containerNode.children[offset] || containerNode.children[offset - 1];
          } else if (containerNode.tagName.toLowerCase() === 'tbody' || containerNode.tagName.toLowerCase() === 'thead') {
            const tr = containerNode.children[offset] || containerNode.children[offset - 1];
            if (tr) cell = tr.children[0];
          } else if (containerNode.tagName.toLowerCase() === 'table') {
            const tbody = containerNode.querySelector('tbody') || containerNode;
            const tr = tbody.children[0];
            if (tr) cell = tr.children[0];
          }
        }
      } else if (containerNode.nodeType === Node.TEXT_NODE) {
        cell = containerNode.parentElement?.closest('td, th');
      }

      if (cell) {
        const tr = cell.parentElement;
        const rootIdForTable = blockEl.getAttribute("data-block-id").replace(/(_p\d+)+$/, '');

        const containerForTable = pagesContainerRef.current;
        let allRows = [];
        if (containerForTable) {
          const possibleBlocks = Array.from(containerForTable.querySelectorAll(`[data-block-id^="${rootIdForTable}"]`))
            .filter(el => {
              const id = el.getAttribute('data-block-id');
              return id === rootIdForTable || id.startsWith(rootIdForTable + '_p');
            });

          possibleBlocks.forEach(part => {
            if (part.tagName.toLowerCase() === 'table') {
              const sections = part.querySelectorAll('thead, tbody');
              sections.forEach(sec => {
                allRows.push(...Array.from(sec.children).filter(c => c.tagName.toLowerCase() === 'tr'));
              });
            }
          });
        }

        const absoluteRowIndex = allRows.length > 0 ? allRows.indexOf(tr) : 0;
        const colIndex = Array.from(tr.children).indexOf(cell);

        tableCellInfo = {
          rowIndex: absoluteRowIndex >= 0 ? absoluteRowIndex : 0,
          colIndex: colIndex >= 0 ? colIndex : 0
        };
      }
    }

    const pre = document.createRange();
    let rangeBasis = blockEl;
    if (tableCellInfo && containerNode.nodeType !== Node.DOCUMENT_NODE) {
      let cell = null;
      if (containerNode.nodeType === Node.ELEMENT_NODE) {
        cell = containerNode.closest('td, th');
        if (!cell && containerNode.tagName.toLowerCase() === 'tr') {
          cell = containerNode.children[offset] || containerNode.children[offset - 1];
        }
      } else {
        cell = containerNode.parentElement?.closest('td, th');
      }
      if (cell) rangeBasis = cell;
    }

    pre.selectNodeContents(rangeBasis || blockEl);
    try { pre.setEnd(containerNode, offset); } catch (e) { pre.collapse(false); }
    return {
      blockEl,
      blockId: blockEl.getAttribute("data-block-id"),
      pos: absolutePos + pre.toString().length,
      text: blockEl.textContent || "",
      tableCellInfo
    };
  }, [pagesContainerRef]);

  return { getBlockAndOffset };
}

export default useEditorBlockOffset;
