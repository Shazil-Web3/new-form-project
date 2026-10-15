import { BLOCK_TYPES } from './DocumentEngineConstants';
import { persistBlockAlign, readStoredAlign, applyAlignmentFromBlock } from './textAlignment/textAlignment';

export class ContentChangeHandler {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
    this.debounceTimer = null;
  }

  // Handle content changes
  handleContentChange(editorElement, callback) {
    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the update. Do NOT call engine.repaginate here — EditorCore's
    // schedulePaginate owns DOM redistribution. A second repaginate (often with
    // the pages container instead of .page-content) races large pastes and can
    // thrash/clear the editor.
    this.debounceTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && (window.isPaginatingEditor || window.isPasteInProgress)) {
        // Re-queue once pagination/paste settles so we don't sync a transitional DOM.
        this.debounceTimer = setTimeout(() => {
          this.handleContentChange(editorElement, callback);
        }, 120);
        return;
      }
      this.syncDOMToBlocks(editorElement);
      if (callback) callback();
    }, 200);
  }

  // Sync DOM changes back to blocks
  syncDOMToBlocks(editorElement) {
    // Find ALL page contents when a container is passed
    const root = editorElement?.closest?.('.document-renderer') || document;
    const contents = Array.from(
      (root.querySelectorAll?.('.page > .page-content')) || [editorElement]
    );

    // CRITICAL: Ensure every block (including tables and lists) has a data-block-id and clean up nested block IDs
    contents.forEach(pc => {
      // 1. Process all tables and lists first (ensuring they have IDs and cleaning up nested elements)
      const complexElements = pc.querySelectorAll('ul, ol, table');
      complexElements.forEach(el => {
        // Skip if el is nested inside another complex element (list or table)
        let parent = el.parentElement;
        let isNested = false;
        while (parent && parent !== pc) {
          const parentTag = parent.tagName.toLowerCase();
          if (parentTag === 'ul' || parentTag === 'ol' || parentTag === 'table') {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }

        if (isNested) {
          el.removeAttribute('data-block-id');
          return;
        }

        if (!el.hasAttribute('data-block-id')) {
          el.setAttribute('data-block-id', this.documentEngine.generateBlockId());
        }
        // Remove data-block-id attributes from any elements inside the list or table
        // to prevent them from being synced as separate independent blocks
        el.querySelectorAll('[data-block-id]').forEach(desc => {
          desc.removeAttribute('data-block-id');
        });
      });

      // 2. Process all other direct child elements of page-content
      Array.from(pc.children).forEach(el => {
        const tag = el.tagName.toLowerCase();
        const isPageBreak = el.classList.contains('page-break-marker') || el.hasAttribute('data-page-break');
        const otherBlockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'figure', 'hr'];
        if ((otherBlockTags.includes(tag) || isPageBreak) && !el.hasAttribute('data-block-id')) {
          el.setAttribute('data-block-id', this.documentEngine.generateBlockId());
        }
      });
    });

    const domEls = contents.flatMap(pc => {
      const allBlocks = Array.from(pc.querySelectorAll('[data-block-id]'));
      const filtered = allBlocks.filter(el => {
        let parent = el.parentElement;
        while (parent && parent !== pc) {
          if (parent.hasAttribute('data-block-id')) return false;
          parent = parent.parentElement;
        }
        return true;
      });
      return filtered;
    });
    const domIds = domEls.map(el => el.dataset.blockId);

    // flatten to a single page while syncing
    const page = { blocks: this.documentEngine.getAllBlocks() };
    let blocks = page.blocks;

    // create engine blocks for unknown DOM ids
    domEls.forEach(el => {
      const id = el.dataset.blockId;
      if (!blocks.find(b => b.id === id)) {
        const tag = el.tagName.toLowerCase();
        const isPageBreak = el.classList.contains('page-break-marker') || el.hasAttribute('data-page-break');
        const type = isPageBreak ? BLOCK_TYPES.PAGE_BREAK
          : tag.startsWith('h') ? 'heading'
          : tag === 'blockquote' ? 'quote'
          : tag === 'pre' ? 'code'
          : tag === 'ol' || tag === 'ul' ? 'list'
          : tag === 'table' ? 'table'
          : tag === 'figure' ? (el.classList.contains('video-block') || el.getAttribute('data-type') === 'video' ? BLOCK_TYPES.VIDEO : BLOCK_TYPES.IMAGE)
          : 'paragraph';
        const newB = this.documentEngine.createBlock(type, '');
        newB.id = id;
        blocks.push(newB);
      }
    });

    if (domIds.length === 0) {
      // ONLY reset the engine if we clearly have pages but NO blocks within them.
      // If we have NO pages at all, it's likely a transitional state during rendering/pagination,
      // so we should NOT wipe the engine's blocks.
      // Also skip wipe during paste/pagination — DOM is often briefly empty while pages rebuild.
      if (
        typeof window !== 'undefined' &&
        (window.isPaginatingEditor || window.isPasteInProgress || window.isProgrammaticScroll)
      ) {
        return;
      }
      const existingBlocks = this.documentEngine.getAllBlocks?.() || [];
      const hasSubstantialEngineContent = existingBlocks.some((b) => {
        if (!b) return false;
        if (b.type === BLOCK_TYPES.TABLE || b.type === BLOCK_TYPES.IMAGE || b.type === BLOCK_TYPES.VIDEO) return true;
        const raw = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
        return raw.replace(/<[^>]*>/g, '').replace(/[\s\u200B\uFEFF\u00A0&nbsp;]/g, '').length > 0;
      });
      if (hasSubstantialEngineContent) {
        return;
      }
      const hasPages = contents.some(pc => pc.closest('.page') !== null);
      if (hasPages) {
        this.documentEngine.document.pages = [{ id: 'page1', blocks: [this.documentEngine.createBlock('paragraph', '')] }];
      }
      return;
    }

    // remove blocks that no longer exist
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (!domIds.includes(blocks[i].id)) blocks.splice(i, 1);
    }

    // reorder
    blocks = domIds.map(id => blocks.find(b => b.id === id)).filter(Boolean);

    // update contents
    domEls.forEach(el => {
      const id = el.dataset.blockId;
      const block = blocks.find(b => b.id === id);
      if (!block) return;

      const tag = el.tagName.toLowerCase();
      const isPageBreak = el.classList.contains('page-break-marker') || el.hasAttribute('data-page-break');

      // Sync block type and metadata if tag changed (e.g. formatBlock h1)
      if (isPageBreak) {
        block.type = BLOCK_TYPES.PAGE_BREAK;
        block.content = '';
      } else if (tag.startsWith('h') && tag.length <= 2) {
        block.type = BLOCK_TYPES.HEADING;
        block.metadata.level = parseInt(tag.substring(1)) || 1;
      } else if (tag === 'p') {
        block.type = BLOCK_TYPES.PARAGRAPH;
      } else if (tag === 'blockquote') {
        block.type = BLOCK_TYPES.QUOTE;
      } else if (tag === 'pre') {
        block.type = BLOCK_TYPES.CODE;
      } else if (tag === 'figure') {
        const isVideo = el.classList.contains('video-block') || el.getAttribute('data-type') === 'video';
        if (isVideo) {
          const hasMedia = el.querySelector('iframe, video');
          if (!hasMedia) {
            el.remove();
            return;
          }
          block.type = BLOCK_TYPES.VIDEO;
        } else {
          const hasImg = el.querySelector('img');
          if (!hasImg) {
            el.remove();
            return;
          }
          block.type = BLOCK_TYPES.IMAGE;
        }
      } else if (tag === 'ol' || tag === 'ul') {
        block.type = BLOCK_TYPES.LIST;
        block.metadata.listType = tag === 'ol' ? 'numbered' : 'bullet';
        if (el.hasAttribute('start')) {
          block.metadata.start = parseInt(el.getAttribute('start'), 10) || 1;
        } else {
          delete block.metadata.start;
        }
      }

      // Sync ownership info from DOM if present
      if (el.hasAttribute('data-owner-id')) {
        block.metadata.ownerId = el.getAttribute('data-owner-id');
      }
      if (el.hasAttribute('data-user-email')) {
        block.metadata.userEmail = el.getAttribute('data-user-email');
      }

      const skipBlockAlign = [
        BLOCK_TYPES.IMAGE,
        BLOCK_TYPES.VIDEO,
        BLOCK_TYPES.TABLE,
        BLOCK_TYPES.PAGE_BREAK,
        BLOCK_TYPES.DIVIDER,
      ].includes(block.type);
      if (!skipBlockAlign) {
        persistBlockAlign(block.metadata, el);
      }
      if (block.type === BLOCK_TYPES.LIST) {
        const previousItemAligns = Array.isArray(block.metadata.itemAligns) ? block.metadata.itemAligns : [];
        block.metadata.itemAligns = Array.from(el.children).map(
          (li, i) => readStoredAlign(li) || previousItemAligns[i] || null
        );
      }
      if (!skipBlockAlign) {
        applyAlignmentFromBlock(el, block);
      }

      const next = this.extractContentFromElement(el, block.type, block);
      const currentContentStr = typeof block.content === 'string' ? block.content : JSON.stringify(block.content || '');
      const nextContentStr = typeof next === 'string' ? next : JSON.stringify(next || '');

      if (nextContentStr !== currentContentStr) {
        block.content = next;
        block.metadata.updatedAt = new Date().toISOString();
      }
    });

    // Issue 1: Always ensure there is a paragraph after a table at the end of the document
    if (blocks.length > 0 && blocks[blocks.length - 1].type === BLOCK_TYPES.TABLE) {
      blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, ""));
    }

    this.documentEngine.document.pages = [{ id: 'page1', blocks }];
  }

  // Extract content from DOM element based on block type
  extractContentFromElement(element, blockType, block = null) {
    switch (blockType) {
      case BLOCK_TYPES.PAGE_BREAK:
        return '';

      case BLOCK_TYPES.LIST:
        const items = Array.from(element.children).map(li => this.preserveInlineFormatting(li, true));
        return items;
      
      case BLOCK_TYPES.TABLE:
        // Table content extraction would be more complex
        return this.extractTableContent(element);
      
      case BLOCK_TYPES.IMAGE:
        // Extract image data from figure element
        const img = element.querySelector('img');
        if (img) {
          const imageData = {
            src: img.getAttribute('src') || img.src || '',
            width: parseInt(img.getAttribute('width'), 10) || parseInt(img.style.width, 10) || img.width || 0,
            height: parseInt(img.getAttribute('height'), 10) || parseInt(img.style.height, 10) || img.height || 0,
            caption: element.querySelector('figcaption')?.textContent || '',
          };
          
          // Preserve custom sizing if present
          const widthAttr = img.getAttribute('width');
          const heightAttr = img.getAttribute('height');
          if (widthAttr) imageData.width = parseInt(widthAttr, 10);
          if (heightAttr) imageData.height = parseInt(heightAttr, 10);
          
          return JSON.stringify(imageData);
        }
        return '{}';

      case BLOCK_TYPES.VIDEO:
        // Extract video data from figure element
        const iframeEl = element.querySelector('iframe');
        const videoEl = element.querySelector('video');
        let rawSrc = iframeEl?.getAttribute('src') || iframeEl?.src || videoEl?.getAttribute('src') || videoEl?.src || '';
        
        if (typeof rawSrc === 'string' && rawSrc.includes('<')) {
          const match = rawSrc.match(/src=["']([^"']+)["']/);
          if (match && match[1]) rawSrc = match[1];
        }

        const isYoutube = iframeEl !== null || (rawSrc && (rawSrc.includes('youtube') || rawSrc.includes('youtu.be')));
        const videoType = isYoutube ? 'youtube' : 'direct';
        
        const videoWidth = parseInt(element.style.width, 10) || parseInt(element.getAttribute('width'), 10) || 560;
        const videoHeight = parseInt(element.style.height, 10) || parseInt(element.getAttribute('height'), 10) || 315;
        const videoAlign = element.getAttribute('data-align') || 'center';

        let existingData = {};
        if (block && block.content) {
          try {
            existingData = typeof block.content === 'object' ? block.content : JSON.parse(block.content);
          } catch (e) {}
        }

        const videoData = {
          url: existingData.url || rawSrc,
          type: videoType,
          embedUrl: rawSrc,
          align: videoAlign,
          width: videoWidth,
          height: videoHeight
        };
        return JSON.stringify(videoData);
      
      default:
        return this.preserveInlineFormatting(element); // preserve formatting
    }
  }

  // Preserve inline formatting (bold, italic, etc.) from HTML elements
  preserveInlineFormatting(element, isList = false) {
    if (!element) return "";
    const html = element.innerHTML;
    if (!html) return element.textContent || "";
    
    // FAST PATH: If it's just plain text (no HTML tags), return textContent immediately.
    // This avoids creating temporary DOM nodes and recursive sanitization for simple text.
    if (html.indexOf('<') === -1) return element.textContent || "";

    // Use a temporary div for sanitization
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const INLINE_ALLOWED_TAGS = new Set([
      "b", "strong", "i", "em", "u", "s", "del", "ins", "span", "sub", "sup",
      "code", "kbd", "mark", "a", "br", "wbr", "figure", "div", "iframe", "video"
    ]);
    if (isList) {
      INLINE_ALLOWED_TAGS.add("ol");
      INLINE_ALLOWED_TAGS.add("ul");
      INLINE_ALLOWED_TAGS.add("li");
    }

    const INLINE_ALLOWED_ATTRS = new Set([
      "style",
      "data-comment-id",
      "data-suggestededit-id",
      "data-reference-id",
      "data-locked",
      "data-locked-by",
      "data-locked-by-email",
      "contenteditable",
      "data-backspace-strike-id",
      "data-edit-id",
      "data-creator-role",
      "data-user-email",
      "data-owner-id",
      "data-strike-created-by-id",
      "data-strike-created-by-email",
      "data-block-id",
      "data-type",
      "data-align",
      "data-resize",
      "src",
      "frameborder",
      "allowfullscreen",
      "allow",
      "href",
      "target",
      "rel",
      "title",
      "class"
    ]);
    if (isList) {
      INLINE_ALLOWED_ATTRS.add("start");
    }

    const sanitize = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const tag = node.tagName.toLowerCase();
      
      // If tag is allowed, keep it and sanitize children
      if (INLINE_ALLOWED_TAGS.has(tag)) {
        const sanitizedNode = document.createElement(tag);
        
        // Only keep allowed attributes
        Array.from(node.attributes).forEach(attr => {
          const attrName = attr.name.toLowerCase();
          if (INLINE_ALLOWED_ATTRS.has(attrName)) {
            if (attrName === "class") {
              // Only keep our functional editor classes, strip UI/Bootstrap icons
              const allowedClasses = ["highlighted-text", "locked-text", "locked", "backspace-strike-text", "editor-image", "img-block", "video-block", "video-wrapper", "video-resize-handle", "reference-citation-wrapper", "reference-number", "admin-edit", "reviewer-edit"];
              if (isList) {
                allowedClasses.push("custom-numbered-list");
              }
              const filteredClasses = attr.value
                .split(/\s+/)
                .filter(cls => allowedClasses.includes(cls))
                .join(" ");
              if (filteredClasses) {
                sanitizedNode.setAttribute("class", filteredClasses);
              }
            } else {
              sanitizedNode.setAttribute(attr.name, attr.value);
            }
          }
        });

        // Recursively sanitize children
        Array.from(node.childNodes).forEach(child => {
          const result = sanitize(child);
          if (typeof result === "string") {
            sanitizedNode.appendChild(document.createTextNode(result));
          } else if (result) {
            sanitizedNode.appendChild(result);
          }
        });

        return sanitizedNode;
      }

      // If tag is NOT allowed, skip it but process its children (inline preservation)
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => {
        const result = sanitize(child);
        if (typeof result === "string") {
          fragment.appendChild(document.createTextNode(result));
        } else if (result) {
          fragment.appendChild(result);
        }
      });
      
      return fragment;
    };

    // Clear and re-populate with sanitized content
    const finalFragment = document.createDocumentFragment();
    Array.from(tempDiv.childNodes).forEach(child => {
      const result = sanitize(child);
      if (typeof result === "string") {
        finalFragment.appendChild(document.createTextNode(result));
      } else if (result) {
        finalFragment.appendChild(result);
      }
    });

    const finalContainer = document.createElement("div");
    finalContainer.appendChild(finalFragment);
    const output = finalContainer.innerHTML;
    return output;
  }

  // Extract table content from DOM
  extractTableContent(tableElement) {
    const headers = [];
    const rows = [];
    const rowHeights = [];
    const metaCell = [];

    const blockId = tableElement.getAttribute('data-block-id');
    const existingBlock = blockId ? this.documentEngine.getBlock(blockId) : null;
    const existingMeta = existingBlock?.content?.meta || {};
    const existingCellMeta = existingMeta.cell || [];

    const _extractCellContent = (cellEl) => {
      const select = cellEl.querySelector('select.cell-dropdown');
      if (select) {
        return select.value;
      }
      return this.preserveInlineFormatting(cellEl);
    };

    const thead = tableElement.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        const headerMeta = [];
        const ths = Array.from(headerRow.children);
        ths.forEach((th, colIdx) => {
          const m = existingCellMeta[0]?.[colIdx] || {};
          const typeAttr = th.getAttribute('data-type');
          const optionsAttr = th.getAttribute('data-options');
          let optionsVal = m.options;
          if (typeAttr === 'dropdown' && optionsAttr) {
            try { optionsVal = JSON.parse(optionsAttr); } catch (e) {}
          }

          headers.push(_extractCellContent(th));
          
          headerMeta.push({
            th: true,
            align: th.getAttribute('data-text-align') || th.getAttribute('align') || th.style?.textAlign || null,
            valign: th.getAttribute('valign') || th.style?.verticalAlign || null,
            colspan: parseInt(th.getAttribute('colspan') || '1', 10),
            rowspan: parseInt(th.getAttribute('rowspan') || '1', 10),
            style: th.getAttribute('style') || null,
            ...((m.type === 'dropdown' || typeAttr === 'dropdown') ? { type: 'dropdown', options: optionsVal } : {})
          });
        });
        metaCell.push(headerMeta);
      }
    } else {
      // headerless table but first row is th => treat as headers
      const firstRow = tableElement.querySelector('tr');
      if (firstRow && Array.from(firstRow.children).every(c => c.tagName.toLowerCase() === 'th')) {
        const headerMeta = [];
        const ths = Array.from(firstRow.children);
        ths.forEach((th, colIdx) => {
          const m = existingCellMeta[0]?.[colIdx] || {};
          const typeAttr = th.getAttribute('data-type');
          const optionsAttr = th.getAttribute('data-options');
          let optionsVal = m.options;
          if (typeAttr === 'dropdown' && optionsAttr) {
            try { optionsVal = JSON.parse(optionsAttr); } catch (e) {}
          }

          headers.push(_extractCellContent(th));
          
          headerMeta.push({
            th: true,
            align: th.getAttribute('data-text-align') || th.getAttribute('align') || th.style?.textAlign || null,
            valign: th.getAttribute('valign') || th.style?.verticalAlign || null,
            colspan: parseInt(th.getAttribute('colspan') || '1', 10),
            rowspan: parseInt(th.getAttribute('rowspan') || '1', 10),
            style: th.getAttribute('style') || null,
            ...((m.type === 'dropdown' || typeAttr === 'dropdown') ? { type: 'dropdown', options: optionsVal } : {})
          });
        });
        metaCell.push(headerMeta);
      }
    }

    const tbody = tableElement.querySelector('tbody') || tableElement;
    const rowElements = tbody.querySelectorAll('tr');
    let processedBodyRowIndex = 0;

    rowElements.forEach(row => {
      // Skip the THEAD row if it was already processed
      const isHeaderRow = thead && thead.contains(row);
      if (isHeaderRow) return;

      const cells = [];
      const rowMeta = [];
      const tds = Array.from(row.children);
      
      const cellRowIdx = headers.length ? processedBodyRowIndex + 1 : processedBodyRowIndex;
      const existingRowMeta = existingCellMeta[cellRowIdx] || [];

      tds.forEach((td, colIdx) => {
        const m = existingRowMeta[colIdx] || {};
        const typeAttr = td.getAttribute('data-type');
        const optionsAttr = td.getAttribute('data-options');
        let optionsVal = m.options;
        if (typeAttr === 'dropdown' && optionsAttr) {
          try { optionsVal = JSON.parse(optionsAttr); } catch (e) {}
        }

        cells.push(_extractCellContent(td));

        rowMeta.push({
          th: td.tagName.toLowerCase() === 'th',
          align: td.getAttribute('data-text-align') || td.getAttribute('align') || td.style?.textAlign || null,
          valign: td.getAttribute('valign') || td.style?.verticalAlign || null,
          colspan: parseInt(td.getAttribute('colspan') || '1', 10),
          rowspan: parseInt(td.getAttribute('rowspan') || '1', 10),
          style: td.getAttribute('style') || null,
          ...((m.type === 'dropdown' || typeAttr === 'dropdown') ? { type: 'dropdown', options: optionsVal } : {})
        });
      });

      if (cells.length) {
        rows.push(cells);
        metaCell.push(rowMeta);
        processedBodyRowIndex++;
      }

      // Capture row height — prefer explicit height, then minHeight (set by resize)
      const h = row.style?.height || row.style?.minHeight || null;
      rowHeights.push(h);
    });

    const colEls = tableElement.querySelectorAll(':scope > colgroup > col');
    const columnWidths = colEls.length
      ? Array.from(colEls).map((c) => c.style?.width || c.getAttribute('width') || null)
      : [];

    return { headers, rows, meta: { rowHeights, columnWidths, cell: metaCell } };
  }
}

// =======================
// UTILITY FUNCTIONS
// =======================

