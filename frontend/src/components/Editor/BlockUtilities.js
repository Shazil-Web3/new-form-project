// Block Operations and Formatters
// This file contains utility functions for block manipulation and formatting

import { BLOCK_TYPES, LIST_TYPES, HEADING_LEVELS } from './DocumentEngine';

// =======================
// BLOCK FORMATTERS
// =======================

export class BlockFormatter {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  // Format selected text as heading
  formatAsHeading(blockId, level) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      this.documentEngine.updateBlock(blockId, {
        type: BLOCK_TYPES.HEADING,
        metadata: { ...block.metadata, level }
      });
      return true;
    }
    return false;
  }

  // Format selected text as paragraph
  formatAsParagraph(blockId) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      this.documentEngine.updateBlock(blockId, {
        type: BLOCK_TYPES.PARAGRAPH,
        metadata: { ...block.metadata }
      });
      delete block.metadata.level;
      delete block.metadata.listType;
      return true;
    }
    return false;
  }

  // Format block as list
  formatAsList(blockId, listType = LIST_TYPES.BULLET) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      // Convert content to array if it's a string
      const items = typeof block.content === 'string' ? 
        [block.content] : 
        Array.isArray(block.content) ? block.content : [block.content];
      
      this.documentEngine.updateBlock(blockId, {
        type: BLOCK_TYPES.LIST,
        content: items,
        metadata: { ...block.metadata, listType }
      });
      return true;
    }
    return false;
  }

  // Format block as quote
  formatAsQuote(blockId) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      this.documentEngine.updateBlock(blockId, {
        type: BLOCK_TYPES.QUOTE,
        content: typeof block.content === 'string' ? block.content : 
                Array.isArray(block.content) ? block.content.join(' ') : block.content
      });
      return true;
    }
    return false;
  }

  // Format block as code
  formatAsCode(blockId) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      this.documentEngine.updateBlock(blockId, {
        type: BLOCK_TYPES.CODE,
        content: typeof block.content === 'string' ? block.content : 
                Array.isArray(block.content) ? block.content.join('\n') : block.content
      });
      return true;
    }
    return false;
  }

  // Insert divider after block
  insertDivider(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex !== -1) {
      const dividerBlock = this.documentEngine.createBlock(BLOCK_TYPES.DIVIDER);
      this.documentEngine.addBlock(dividerBlock, blockIndex + 1);
      return dividerBlock;
    }
    return null;
  }

  // Merge two blocks
  mergeBlocks(firstBlockId, secondBlockId) {
    const firstBlock = this.documentEngine.getBlock(firstBlockId);
    const secondBlock = this.documentEngine.getBlock(secondBlockId);
    
    if (firstBlock && secondBlock && firstBlock.type === secondBlock.type) {
      if (firstBlock.type === BLOCK_TYPES.PARAGRAPH) {
        // Merge paragraph content
        const mergedContent = firstBlock.content + ' ' + secondBlock.content;
        this.documentEngine.updateBlock(firstBlockId, { content: mergedContent });
        this.documentEngine.removeBlock(secondBlockId);
        return true;
      } else if (firstBlock.type === BLOCK_TYPES.LIST) {
        // Merge list items
        const mergedItems = [...firstBlock.content, ...secondBlock.content];
        this.documentEngine.updateBlock(firstBlockId, { content: mergedItems });
        this.documentEngine.removeBlock(secondBlockId);
        return true;
      }
    }
    return false;
  }

  // Split block at cursor position
  splitBlock(blockId, splitPosition) {
    const block = this.documentEngine.getBlock(blockId);
    if (!block || block.type !== BLOCK_TYPES.PARAGRAPH) {
      return false;
    }

    const content = block.content;
    const firstPart = content.substring(0, splitPosition);
    const secondPart = content.substring(splitPosition);

    // Update first block
    this.documentEngine.updateBlock(blockId, { content: firstPart });

    // Create second block
    const secondBlock = this.documentEngine.createBlock(
      BLOCK_TYPES.PARAGRAPH,
      secondPart
    );

    // Insert second block after first
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    this.documentEngine.addBlock(secondBlock, blockIndex + 1);

    return secondBlock;
  }
}

// =======================
// BLOCK OPERATIONS
// =======================

export class BlockOperations {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  // Move block up
  moveBlockUp(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex > 0) {
      const block = page.blocks[blockIndex];
      page.blocks.splice(blockIndex, 1);
      page.blocks.splice(blockIndex - 1, 0, block);
      return true;
    }
    return false;
  }

  // Move block down
  moveBlockDown(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex < page.blocks.length - 1) {
      const block = page.blocks[blockIndex];
      page.blocks.splice(blockIndex, 1);
      page.blocks.splice(blockIndex + 1, 0, block);
      return true;
    }
    return false;
  }

  // Duplicate block
  duplicateBlock(blockId) {
    const block = this.documentEngine.getBlock(blockId);
    if (block) {
      const duplicatedBlock = this.documentEngine.createBlock(
        block.type,
        Array.isArray(block.content) ? [...block.content] : block.content,
        { ...block.metadata }
      );
      
      const page = this.documentEngine.getCurrentPage();
      const blockIndex = page.blocks.findIndex(b => b.id === blockId);
      this.documentEngine.addBlock(duplicatedBlock, blockIndex + 1);
      
      return duplicatedBlock;
    }
    return null;
  }

  // Delete block
  deleteBlock(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex !== -1) {
      this.documentEngine.removeBlock(blockId);
      
      // If it was the last block, add an empty paragraph
      if (page.blocks.length === 0) {
        const emptyBlock = this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, '');
        this.documentEngine.addBlock(emptyBlock);
      }
      
      return true;
    }
    return false;
  }

  // Convert block type
  convertBlockType(blockId, newType, metadata = {}) {
    const block = this.documentEngine.getBlock(blockId);
    if (!block) return false;

    let newContent = block.content;

    // Handle content conversion based on types
    if (newType === BLOCK_TYPES.LIST && !Array.isArray(block.content)) {
      newContent = [block.content];
    } else if (newType !== BLOCK_TYPES.LIST && Array.isArray(block.content)) {
      newContent = block.content.join(' ');
    }

    this.documentEngine.updateBlock(blockId, {
      type: newType,
      content: newContent,
      metadata: { ...block.metadata, ...metadata }
    });

    return true;
  }

  // Get block position
  getBlockPosition(blockId) {
    const page = this.documentEngine.getCurrentPage();
    return page.blocks.findIndex(b => b.id === blockId);
  }

  // Get next block
  getNextBlock(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex !== -1 && blockIndex < page.blocks.length - 1) {
      return page.blocks[blockIndex + 1];
    }
    return null;
  }

  // Get previous block
  getPreviousBlock(blockId) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex > 0) {
      return page.blocks[blockIndex - 1];
    }
    return null;
  }

  // Insert block at specific position
  insertBlockAt(position, type, content = '', metadata = {}) {
    const block = this.documentEngine.createBlock(type, content, metadata);
    this.documentEngine.addBlock(block, position);
    return block;
  }

  // Get blocks by type
  getBlocksByType(type) {
    const page = this.documentEngine.getCurrentPage();
    return page.blocks.filter(block => block.type === type);
  }

  // Count blocks by type
  countBlocksByType() {
    const page = this.documentEngine.getCurrentPage();
    return page.blocks.reduce((counts, block) => {
      counts[block.type] = (counts[block.type] || 0) + 1;
      return counts;
    }, {});
  }
}

// =======================
// TABLE OPERATIONS
// =======================

function cloneTableMeta(meta = {}) {
  return {
    ...meta,
    rowHeights: Array.isArray(meta.rowHeights) ? [...meta.rowHeights] : [],
    columnWidths: Array.isArray(meta.columnWidths) ? [...meta.columnWidths] : [],
    cell: Array.isArray(meta.cell)
      ? meta.cell.map((row) => (Array.isArray(row) ? [...row] : []))
      : [],
  };
}

function parseWidthPercent(width) {
  const s = String(width || "");
  if (s.endsWith("%")) return parseFloat(s);
  return null;
}

function normalizeColumnWidths(widths) {
  if (!widths?.length) return widths;
  const pcts = widths.map((w) => {
    const p = parseWidthPercent(w);
    return p != null && Number.isFinite(p) ? p : 100 / widths.length;
  });
  const sum = pcts.reduce((a, b) => a + b, 0) || 100;
  return pcts.map((p) => `${((p / sum) * 100).toFixed(4)}%`);
}

/** Split a column at `position` (Google Docs–style) so total width stays 100%. */
function insertColumnWidth(widths, position) {
  if (!widths?.length) return widths;
  const pcts = widths.map((w) => {
    const p = parseWidthPercent(w);
    return p != null && Number.isFinite(p) ? p : 100 / widths.length;
  });
  const at = position < 0 ? pcts.length : Math.min(position, pcts.length);
  if (at >= pcts.length) {
    const half = pcts[pcts.length - 1] / 2;
    pcts[pcts.length - 1] = half;
    pcts.push(half);
  } else {
    const half = pcts[at] / 2;
    pcts[at] = half;
    pcts.splice(at, 0, half);
  }
  return normalizeColumnWidths(pcts.map((p) => `${p}%`));
}

function removeColumnWidth(widths, colIndex) {
  if (!widths?.length || colIndex < 0 || colIndex >= widths.length) return widths;
  if (widths.length <= 1) return widths;
  const pcts = widths.map((w) => {
    const p = parseWidthPercent(w);
    return p != null && Number.isFinite(p) ? p : 100 / widths.length;
  });
  const removed = pcts.splice(colIndex, 1)[0] || 0;
  const neighbor = colIndex < pcts.length ? colIndex : pcts.length - 1;
  if (neighbor >= 0 && pcts[neighbor] != null) {
    pcts[neighbor] += removed;
  }
  return normalizeColumnWidths(pcts.map((p) => `${p}%`));
}

function bodyRowToCellMetaIndex(bodyRowIndex, hasHeader) {
  return hasHeader ? bodyRowIndex + 1 : bodyRowIndex;
}

function emptyCellMetaRow(colCount) {
  return Array.from({ length: colCount }, () => ({}));
}

export class TableOperations {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  // Create table block
  createTable(rows = 3, cols = 3, hasHeaders = true) {
    const headers = hasHeaders ? 
      Array(cols).fill(0).map((_, i) => `Header ${i + 1}`) : [];
    
    const tableRows = Array(rows).fill(0).map(() => 
      Array(cols).fill(0).map(() => '')
    );

    return this.documentEngine.createBlock(
      BLOCK_TYPES.TABLE,
      { headers, rows: tableRows },
      { hasHeaders, rows, cols }
    );
  }

  // Add row to table (preserves column widths, row heights, and cell meta)
  addRowToTable(blockId, position = -1, options = {}) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.TABLE) {
      const content = block.content || {};
      const headers = content.headers || [];
      const rows = content.rows || [];
      const hasHeader = headers.length > 0;
      const meta = cloneTableMeta(content.meta);
      const colCount = headers.length || rows[0]?.length || 1;
      const newRow = Array(colCount).fill("");

      const insertAt = position === -1 ? rows.length : position;
      rows.splice(insertAt, 0, newRow);

      const copyFrom =
        options.copyRowHeightFrom != null
          ? options.copyRowHeightFrom
          : Math.min(insertAt, meta.rowHeights.length - 1);
      const copiedHeight =
        copyFrom >= 0 && copyFrom < meta.rowHeights.length
          ? meta.rowHeights[copyFrom]
          : meta.rowHeights[insertAt] ?? null;
      meta.rowHeights.splice(insertAt, 0, copiedHeight);

      if (meta.cell.length) {
        const cellRowIdx = bodyRowToCellMetaIndex(insertAt, hasHeader);
        meta.cell.splice(cellRowIdx, 0, emptyCellMetaRow(colCount));
      }

      this.documentEngine.updateBlock(blockId, {
        content: { headers, rows, meta },
        metadata: { ...block.metadata, rows: rows.length },
      });

      return true;
    }
    return false;
  }

  // Add column to table (preserves and redistributes column widths)
  addColumnToTable(blockId, position = -1) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.TABLE) {
      const content = block.content || {};
      const headers = content.headers || [];
      const rows = content.rows || [];
      const meta = cloneTableMeta(content.meta);
      const insertAt = position === -1 ? (headers.length || rows[0]?.length || 0) : position;

      if (headers.length > 0) {
        headers.splice(insertAt, 0, `Header ${insertAt + 1}`);
      }

      rows.forEach((row) => {
        row.splice(insertAt, 0, "");
      });

      if (meta.columnWidths.length) {
        meta.columnWidths = insertColumnWidth(meta.columnWidths, insertAt);
      }

      if (meta.cell.length) {
        meta.cell.forEach((row) => {
          if (Array.isArray(row)) row.splice(insertAt, 0, {});
        });
      }

      this.documentEngine.updateBlock(blockId, {
        content: { headers, rows, meta },
        metadata: {
          ...block.metadata,
          cols: headers.length || rows[0]?.length || 1,
        },
      });

      return true;
    }
    return false;
  }

  // Remove row from table
  removeRowFromTable(blockId, rowIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.TABLE) {
      const content = block.content || {};
      const headers = content.headers || [];
      const rows = content.rows || [];
      const hasHeader = headers.length > 0;
      const meta = cloneTableMeta(content.meta);

      if (rowIndex >= 0 && rowIndex < rows.length) {
        rows.splice(rowIndex, 1);
        if (rowIndex < meta.rowHeights.length) {
          meta.rowHeights.splice(rowIndex, 1);
        }
        if (meta.cell.length) {
          const cellRowIdx = bodyRowToCellMetaIndex(rowIndex, hasHeader);
          if (cellRowIdx < meta.cell.length) {
            meta.cell.splice(cellRowIdx, 1);
          }
        }

        this.documentEngine.updateBlock(blockId, {
          content: { headers, rows, meta },
          metadata: { ...block.metadata, rows: rows.length },
        });

        return true;
      }
    }
    return false;
  }

  // Remove column from table
  removeColumnFromTable(blockId, colIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.TABLE) {
      const content = block.content || {};
      const headers = content.headers || [];
      const rows = content.rows || [];
      const meta = cloneTableMeta(content.meta);
      const colCount = headers.length || rows[0]?.length || 0;

      if (colIndex >= 0 && colIndex < colCount) {
        if (headers.length > 0) {
          headers.splice(colIndex, 1);
        }

        rows.forEach((row) => {
          row.splice(colIndex, 1);
        });

        if (meta.columnWidths.length) {
          meta.columnWidths = removeColumnWidth(meta.columnWidths, colIndex);
        }

        if (meta.cell.length) {
          meta.cell.forEach((row) => {
            if (Array.isArray(row)) row.splice(colIndex, 1);
          });
        }

        this.documentEngine.updateBlock(blockId, {
          content: { headers, rows, meta },
          metadata: {
            ...block.metadata,
            cols: headers.length || rows[0]?.length || 1,
          },
        });

        return true;
      }
    }
    return false;
  }

  // Remove table and any paginated continuation fragments
  deleteTable(blockId) {
    const rootId = (() => {
      let root = blockId;
      while (/_p\d+$/.test(root)) root = root.replace(/_p\d+$/, "");
      return root;
    })();

    const toRemove = this.documentEngine
      .getAllBlocks()
      .filter(
        (b) =>
          b?.type === BLOCK_TYPES.TABLE &&
          (() => {
            let id = b.id;
            while (/_p\d+$/.test(id)) id = id.replace(/_p\d+$/, "");
            return id === rootId;
          })()
      );

    toRemove.forEach((b) => this.documentEngine.removeBlock(b.id));
    return toRemove.length > 0;
  }

  // Update table cell
  updateTableCell(blockId, rowIndex, colIndex, value) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.TABLE) {
      const { headers, rows } = block.content;
      
      if (rowIndex === -1 && colIndex >= 0 && colIndex < headers.length) {
        // Update header
        headers[colIndex] = value;
      } else if (rowIndex >= 0 && rowIndex < rows.length && 
                 colIndex >= 0 && colIndex < rows[rowIndex].length) {
        // Update cell
        rows[rowIndex][colIndex] = value;
      } else {
        return false;
      }
      
      this.documentEngine.updateBlock(blockId, {
        content: { headers, rows }
      });
      
      return true;
    }
    return false;
  }
}

// =======================
// LIST OPERATIONS (CONTINUED)
// =======================

export class ListOperations {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  // Add item to list
  addItemToList(blockId, item, position = -1) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (position === -1) {
        items.push(item);
      } else {
        items.splice(position, 0, item);
      }
      
      this.documentEngine.updateBlock(blockId, { content: items });
      return true;
    }
    return false;
  }

  // Remove item from list
  removeItemFromList(blockId, itemIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (itemIndex >= 0 && itemIndex < items.length) {
        items.splice(itemIndex, 1);
        
        // If list becomes empty, convert to paragraph
        if (items.length === 0) {
          this.documentEngine.updateBlock(blockId, {
            type: BLOCK_TYPES.PARAGRAPH,
            content: '',
            metadata: { ...block.metadata }
          });
          delete block.metadata.listType;
        } else {
          this.documentEngine.updateBlock(blockId, { content: items });
        }
        
        return true;
      }
    }
    return false;
  }

  // Update list item
  updateListItem(blockId, itemIndex, newContent) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (itemIndex >= 0 && itemIndex < items.length) {
        items[itemIndex] = newContent;
        this.documentEngine.updateBlock(blockId, { content: items });
        return true;
      }
    }
    return false;
  }

  // Move list item up
  moveListItemUp(blockId, itemIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (itemIndex > 0 && itemIndex < items.length) {
        const item = items[itemIndex];
        items.splice(itemIndex, 1);
        items.splice(itemIndex - 1, 0, item);
        
        this.documentEngine.updateBlock(blockId, { content: items });
        return true;
      }
    }
    return false;
  }

  // Move list item down
  moveListItemDown(blockId, itemIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (itemIndex >= 0 && itemIndex < items.length - 1) {
        const item = items[itemIndex];
        items.splice(itemIndex, 1);
        items.splice(itemIndex + 1, 0, item);
        
        this.documentEngine.updateBlock(blockId, { content: items });
        return true;
      }
    }
    return false;
  }

  // Convert list type
  convertListType(blockId, newListType) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      this.documentEngine.updateBlock(blockId, {
        metadata: { ...block.metadata, listType: newListType }
      });
      return true;
    }
    return false;
  }

  // Split list at item
  splitListAtItem(blockId, itemIndex) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const items = [...block.content];
      
      if (itemIndex >= 0 && itemIndex < items.length) {
        const firstPart = items.slice(0, itemIndex);
        const secondPart = items.slice(itemIndex);
        
        // Update first list
        this.documentEngine.updateBlock(blockId, { content: firstPart });
        
        // Create second list
        const secondList = this.documentEngine.createBlock(
          BLOCK_TYPES.LIST,
          secondPart,
          { listType: block.metadata.listType }
        );
        
        // Insert second list after first
        const page = this.documentEngine.getCurrentPage();
        const blockIndex = page.blocks.findIndex(b => b.id === blockId);
        this.documentEngine.addBlock(secondList, blockIndex + 1);
        
        return secondList;
      }
    }
    return null;
  }

  // Merge with next list
  mergeWithNextList(blockId) {
    const block = this.documentEngine.getBlock(blockId);
    if (block && block.type === BLOCK_TYPES.LIST) {
      const page = this.documentEngine.getCurrentPage();
      const blockIndex = page.blocks.findIndex(b => b.id === blockId);
      
      if (blockIndex < page.blocks.length - 1) {
        const nextBlock = page.blocks[blockIndex + 1];
        
        if (nextBlock.type === BLOCK_TYPES.LIST && 
            nextBlock.metadata.listType === block.metadata.listType) {
          
          // Merge items
          const mergedItems = [...block.content, ...nextBlock.content];
          this.documentEngine.updateBlock(blockId, { content: mergedItems });
          
          // Remove next block
          this.documentEngine.removeBlock(nextBlock.id);
          
          return true;
        }
      }
    }
    return false;
  }
}

// =======================
// COLLABORATIVE FEATURES
// =======================

export class CollaborativeFeatures {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
    this.changeHistory = [];
    this.maxHistoryLength = 100;
  }

  // Record change for history
  recordChange(change) {
    this.changeHistory.push({
      ...change,
      timestamp: new Date().toISOString()
    });
    
    // Limit history size
    if (this.changeHistory.length > this.maxHistoryLength) {
      this.changeHistory.shift();
    }
  }

  // Get change history
  getChangeHistory() {
    return [...this.changeHistory];
  }

  // Create operation for collaboration
  createOperation(type, blockId, data) {
    return {
      id: this.generateOperationId(),
      type,
      blockId,
      data,
      timestamp: new Date().toISOString(),
      userId: null // Will be set by the application
    };
  }

  // Generate operation ID
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Apply operation
  applyOperation(operation) {
    switch (operation.type) {
      case 'insert':
        return this.documentEngine.addBlock(operation.data, operation.position);
      
      case 'update':
        return this.documentEngine.updateBlock(operation.blockId, operation.data);
      
      case 'delete':
        return this.documentEngine.removeBlock(operation.blockId);
      
      case 'move':
        return this.moveBlock(operation.blockId, operation.data.newPosition);
      
      default:
        return false;
    }
  }

  // Move block to new position
  moveBlock(blockId, newPosition) {
    const page = this.documentEngine.getCurrentPage();
    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    
    if (blockIndex !== -1) {
      const block = page.blocks[blockIndex];
      page.blocks.splice(blockIndex, 1);
      page.blocks.splice(newPosition, 0, block);
      return true;
    }
    return false;
  }

  // Get document version
  getDocumentVersion() {
    return {
      version: this.changeHistory.length,
      checksum: this.calculateChecksum()
    };
  }

  // Calculate simple checksum
  calculateChecksum() {
    const content = JSON.stringify(this.documentEngine.getAllBlocks());
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

// =======================
// DOCUMENT SERIALIZATION
// =======================

export class DocumentSerializer {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  // Serialize document to JSON
  toJSON() {
    return JSON.stringify(this.documentEngine.document, null, 2);
  }

  // Deserialize document from JSON
  fromJSON(jsonString) {
    try {
      const documentData = JSON.parse(jsonString);
      this.documentEngine.document = documentData;
      return true;
    } catch (error) {
      console.error('Failed to deserialize document:', error);
      return false;
    }
  }

  // Export to markdown
  toMarkdown() {
    const blocks = this.documentEngine.getAllBlocks();
    
    return blocks.map(block => {
      switch (block.type) {
        case BLOCK_TYPES.HEADING:
          const level = block.metadata.level || 1;
          return '#'.repeat(level) + ' ' + block.content;
        
        case BLOCK_TYPES.PARAGRAPH:
          return block.content;
        
        case BLOCK_TYPES.LIST:
          const listType = block.metadata.listType || LIST_TYPES.BULLET;
          const marker = listType === LIST_TYPES.NUMBERED ? '1.' : '-';
          return block.content.map(item => `${marker} ${item}`).join('\n');
        
        case BLOCK_TYPES.QUOTE:
          return `> ${block.content}`;
        
        case BLOCK_TYPES.CODE:
          return `\`\`\`\n${block.content}\n\`\`\``;
        
        case BLOCK_TYPES.DIVIDER:
          return '---';
        
        case BLOCK_TYPES.IMAGE:
          return `![${block.metadata.alt || ''}](${block.content})`;
        
        case BLOCK_TYPES.TABLE:
          return this.tableToMarkdown(block);
        
        default:
          return block.content;
      }
    }).join('\n\n');
  }

  // Convert table to markdown
  tableToMarkdown(block) {
    const { headers, rows } = block.content;
    let markdown = '';
    
    if (headers && headers.length > 0) {
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '|' + headers.map(() => '---').join('|') + '|\n';
    }
    
    rows.forEach(row => {
      markdown += '| ' + row.join(' | ') + ' |\n';
    });
    
    return markdown;
  }

  // Import from markdown
  fromMarkdown(markdownString) {
    const lines = markdownString.split('\n');
    const blocks = [];
    let currentBlock = null;
    let inCodeBlock = false;
    let codeContent = [];
    
    for (let line of lines) {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          blocks.push(this.documentEngine.createBlock(
            BLOCK_TYPES.CODE,
            codeContent.join('\n')
          ));
          codeContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          inCodeBlock = true;
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }
      
      // Handle other block types
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)[0].length;
        const content = line.substring(level).trim();
        blocks.push(this.documentEngine.createBlock(
          BLOCK_TYPES.HEADING,
          content,
          { level: Math.min(6, level) }
        ));
      } else if (line.startsWith('> ')) {
        blocks.push(this.documentEngine.createBlock(
          BLOCK_TYPES.QUOTE,
          line.substring(2)
        ));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const item = line.substring(2);
        if (currentBlock && currentBlock.type === BLOCK_TYPES.LIST) {
          currentBlock.content.push(item);
        } else {
          currentBlock = this.documentEngine.createBlock(
            BLOCK_TYPES.LIST,
            [item],
            { listType: LIST_TYPES.BULLET }
          );
          blocks.push(currentBlock);
        }
      } else if (line.match(/^\d+\.\s/)) {
        const item = line.replace(/^\d+\.\s/, '');
        if (currentBlock && currentBlock.type === BLOCK_TYPES.LIST) {
          currentBlock.content.push(item);
        } else {
          currentBlock = this.documentEngine.createBlock(
            BLOCK_TYPES.LIST,
            [item],
            { listType: LIST_TYPES.NUMBERED }
          );
          blocks.push(currentBlock);
        }
      } else if (line === '---') {
        blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.DIVIDER));
        currentBlock = null;
      } else if (line.trim() === '') {
        currentBlock = null;
      } else {
        blocks.push(this.documentEngine.createBlock(
          BLOCK_TYPES.PARAGRAPH,
          line
        ));
        currentBlock = null;
      }
    }
    
    // Replace current document blocks
    this.documentEngine.getCurrentPage().blocks = blocks;
    return true;
  }
}