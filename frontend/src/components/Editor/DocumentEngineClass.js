import React from 'react';
import { BLOCK_TYPES, LIST_TYPES, HEADING_LEVELS } from './DocumentEngineConstants';
import { buildAlignAttrs, normalizeAlign, writeAlignToElement } from './textAlignment/textAlignment';

// =======================
// DOCUMENT STRUCTURE
// =======================

export class DocumentEngine {
  constructor() {
    this.document = {
      id: null,
      pages: [{ id: 'page1', blocks: [] }]
    };
    this.currentPageIndex = 0;

    // --- NEW: pagination env ---
    this._layout = {
      usableHeightPx: 0,
      sandbox: null,
      baseStyle: null,
      heightCache: new Map(), // NEW: Memoization cache for block heights
      lastConfigWidth: 0
    };
  }

  // Initialize document with ID
  initializeDocument(docId) {
    this.document.id = docId;
    if (this.document.pages[0].blocks.length === 0) {
      this.addBlock(this.createBlock(BLOCK_TYPES.PARAGRAPH, ''));
    }
  }

  // NEW: configure paginator from a real content area (your .page-content element)
  configureLayoutFromElement(contentEl, options = {}) {
    if (!contentEl) return;
    const rendererEl = contentEl.closest('.document-renderer') || contentEl;
    let paperSize = options.paperSize;
    let orientation = options.orientation;

    if (!paperSize) {
      if (rendererEl.classList.contains('letter')) paperSize = 'letter';
      else if (rendererEl.classList.contains('legal')) paperSize = 'legal';
      else paperSize = 'a4';
    }
    if (!orientation) {
      if (rendererEl.classList.contains('landscape')) orientation = 'landscape';
      else orientation = 'portrait';
    }
    this._layout.paperSize = paperSize;
    this._layout.orientation = orientation;

    // Compute robust usable height based on paper size minus header, footer, logo strip, padding
    let totalPaperHeight = 1123;
    if (paperSize === 'letter') totalPaperHeight = 1056;
    else if (paperSize === 'legal') totalPaperHeight = 1344;

    const pageEl = contentEl.closest('.page');
    let logoH = 64;
    let headerH = 35;
    let footerH = 50;
    if (pageEl) {
      const logoStrip = pageEl.querySelector('.page-logo-strip');
      if (logoStrip) logoH = logoStrip.getBoundingClientRect().height || 64;
      const header = pageEl.querySelector('.page-header');
      if (header) headerH = header.getBoundingClientRect().height || 35;
      const footer = pageEl.querySelector('.page-footer');
      if (footer) footerH = footer.getBoundingClientRect().height || 50;
    }
    const rect = contentEl.getBoundingClientRect();
    const cs = typeof window !== 'undefined' ? getComputedStyle(contentEl) : { paddingTop: '24px', paddingBottom: '12px', font: '14px Inter', lineHeight: '1.5', width: '700px', padding: '24px', boxSizing: 'border-box' };
    const vpad = (parseFloat(cs.paddingTop) || 24) + (parseFloat(cs.paddingBottom) || 12);
    
    this._layout.baseStyle = {
      font: cs.font,
      lineHeight: cs.lineHeight,
      width: cs.width,
      padding: cs.padding,
      boxSizing: cs.boxSizing
    };

    const computedUsable = Math.floor(totalPaperHeight - logoH - headerH - footerH - vpad - 4);
    this._layout.usableHeightPx = computedUsable > 0 ? computedUsable : Math.ceil(rect.height - vpad);
    this._layout.isCreateMode = !!options.isCreateMode;

    // Use a completely stable, fixed pre-break margin (0px) across all modes
    // to guarantee 1:1 pagination parity, prevent fluctuating calculations (increment issue),
    // and keep a beautiful, narrow gap above the footer.
    this._layout.preBreakMarginPx = 0;

    // If width or font changed, clear height cache
    const currentWidth = parseFloat(cs.width);
    if (this._layout.lastConfigWidth !== currentWidth) {
      this._layout.heightCache.clear();
      this._layout.lastConfigWidth = currentWidth;
    }

    if (!this._layout.sandbox) {
      const s = document.createElement('div');
      s.style.position = 'absolute';
      s.style.left = '-99999px';
      s.style.top = '0';
      s.style.visibility = 'hidden';
      s.style.contain = 'layout paint';
      document.body.appendChild(s);
      this._layout.sandbox = s;
    }

    // keep sandbox synced with content area width & typography
    const s = this._layout.sandbox;
    s.style.width = this._layout.baseStyle.width || '800px';
    s.style.font = this._layout.baseStyle.font || 'Arial, sans-serif';
    s.style.lineHeight = this._layout.baseStyle.lineHeight || '1.15';
    s.style.whiteSpace = 'normal';
    s.style.boxSizing = this._layout.baseStyle.boxSizing || 'border-box';
    s.style.padding = this._layout.baseStyle.padding || '0';
  }

  // Get current page
  getCurrentPage() {
    return this.document.pages[this.currentPageIndex];
  }

  // Create a new block
  createBlock(type, content = '', metadata = {}) {
    return {
      id: this.generateBlockId(),
      type,
      content,
      metadata: {
        createdAt: new Date().toISOString(),
        ownerId: metadata.ownerId || '',
        userEmail: metadata.userEmail || '',
        ...metadata
      }
    };
  }

  // Create an image block with proper structure
  createImageBlock(src, width, height, alt = '') {
    const imageData = { src, width, height, alt };
    return {
      id: this.generateBlockId(),
      type: BLOCK_TYPES.IMAGE,
      content: JSON.stringify(imageData),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }

  // Generate unique block ID
  generateBlockId() {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add block to current page
  addBlock(block, position = -1) {
    const page = this.getCurrentPage();
    if (position === -1) {
      page.blocks.push(block);
    } else {
      page.blocks.splice(position, 0, block);
    }
    return block;
  }

  // Remove block (searches all pages)
  removeBlock(blockId) {
    for (const page of this.document.pages) {
      const blockIndex = page.blocks.findIndex(block => block.id === blockId);
      if (blockIndex !== -1) {
        page.blocks.splice(blockIndex, 1);
        return;
      }
    }
  }

  // Update block content (searches all pages)
  updateBlock(blockId, updates) {
    for (const page of this.document.pages) {
      const block = page.blocks.find(block => block.id === blockId);
      if (block) {
        Object.assign(block, updates);
        block.metadata.updatedAt = new Date().toISOString();
        return;
      }
    }
  }

  // Get block by ID (searches all pages)
  getBlock(blockId) {
    for (const page of this.document.pages) {
      const block = page.blocks.find(b => b.id === blockId);
      if (block) return block;
    }
    return undefined;
  }

  // Get all blocks
  getAllBlocks() {
    // flatten all pages to one list (order preserved)
    return this.document.pages.flatMap(p => p.blocks);
  }

  // Convert document to HTML for rendering
  toHTML() {
    return this.getAllBlocks().map(block => this.blockToHTML(block)).join('');
  }

  // Convert single block to HTML
  blockToHTML(block) {
    const metaAttrs = this._getMetadataAttrs(block);
    switch (block.type) {
      case BLOCK_TYPES.PARAGRAPH: {
        const hasContent = block.content && block.content.replace(/<br\s*\/?>/gi, '').trim().length > 0;
        return `<p data-block-id="${block.id}"${metaAttrs}>${hasContent ? block.content : '<br>'}</p>`;
      }
      
      case BLOCK_TYPES.HEADING:
        const level = block.metadata.level || 1;
        return `<h${level} data-block-id="${block.id}"${metaAttrs}>${block.content}</h${level}>`;
      
      case BLOCK_TYPES.LIST: {
        const listType = block.metadata.listType || LIST_TYPES.BULLET;
        const tag = listType === LIST_TYPES.NUMBERED ? 'ol' : 'ul';
        const className = listType === LIST_TYPES.NUMBERED ? 'custom-numbered-list' : '';
        
        let startVal = block.metadata.start ? parseInt(block.metadata.start, 10) : 1;
        
        // If this is a continuation block from a page break/split, dynamically calculate the correct start offset
        if (listType === LIST_TYPES.NUMBERED && block.metadata.continuedFrom) {
          let prevBlockId = block.metadata.continuedFrom;
          let prevBlock = this.getBlock(prevBlockId);
          if (prevBlock) {
            let prevStart = prevBlock.metadata.start ? parseInt(prevBlock.metadata.start, 10) : 1;
            let count = Array.isArray(prevBlock.content) ? prevBlock.content.length : 0;
            
            // Recursively traverse backward to aggregate item counts if multiple page splits occurred
            let currentPrev = prevBlock;
            while (currentPrev && currentPrev.metadata.continuedFrom) {
              const ancestralPrev = this.getBlock(currentPrev.metadata.continuedFrom);
              if (ancestralPrev) {
                prevStart = ancestralPrev.metadata.start ? parseInt(ancestralPrev.metadata.start, 10) : 1;
                count += Array.isArray(ancestralPrev.content) ? ancestralPrev.content.length : 0;
                currentPrev = ancestralPrev;
              } else {
                break;
              }
            }
            startVal = prevStart + count;
          }
        }
        
        const startAttr = startVal > 1 ? ` start="${startVal}"` : '';
        const counterReset = (listType === LIST_TYPES.NUMBERED && startVal > 1)
          ? `counter-reset: list-counter ${startVal - 1}`
          : '';
        const items = (Array.isArray(block.content) ? block.content : []).map((item, i) => {
          const itemAlign = normalizeAlign(block.metadata?.itemAligns?.[i]) || normalizeAlign(block.metadata?.align);
          const liAttrs = itemAlign ? buildAlignAttrs(itemAlign) : '';
          return `<li${liAttrs}>${item || '<br>'}</li>`;
        }).join('');
        const listMetaAttrs = this._getMetadataAttrs(block, counterReset);
        return `<${tag} class="${className}" data-block-id="${block.id}"${startAttr}${listMetaAttrs}>${items}</${tag}>`;
      }
      
      case BLOCK_TYPES.QUOTE:
        return `<blockquote data-block-id="${block.id}"${metaAttrs}>${block.content}</blockquote>`;
      
      case BLOCK_TYPES.CODE:
        return `<pre data-block-id="${block.id}"${metaAttrs}><code>${block.content}</code></pre>`;
      
      case BLOCK_TYPES.DIVIDER:
        return `<hr data-block-id="${block.id}"${metaAttrs}>`;
      
      case BLOCK_TYPES.IMAGE:
        return this.imageToHTML(block);

      case BLOCK_TYPES.VIDEO:
        return this.videoToHTML(block);

      case BLOCK_TYPES.TABLE:
        return this.tableToHTML(block);

      case BLOCK_TYPES.PAGE_BREAK:
        return `<div data-block-id="${block.id}" data-page-break="true" class="page-break-marker" contenteditable="false" style="height:0px;margin:0;padding:0;line-height:0;overflow:hidden;"></div>`;

      default:
        return `<p data-block-id="${block.id}"${metaAttrs}>${block.content}</p>`;
    }
  }

  // Enhanced video to HTML conversion
  videoToHTML(block) {
    let videoData;
    try {
      videoData = typeof block.content === 'object' ? block.content : JSON.parse(block.content || '{}');
    } catch (e) {
      videoData = {};
    }

    let { url = '', type = 'direct', embedUrl = '', align = 'center', width = 560, height = 315 } = videoData;

    // Safety cleanup if url or embedUrl are corrupted HTML strings
    if (typeof embedUrl === 'string' && embedUrl.includes('<')) {
      const match = embedUrl.match(/src=["']([^"']+)["']/);
      if (match && match[1]) embedUrl = match[1];
    }
    if (typeof url === 'string' && url.includes('<')) {
      const match = url.match(/src=["']([^"']+)["']/);
      if (match && match[1]) url = match[1];
    }

    const isYoutube = type === 'youtube' || (url && (url.includes('youtube') || url.includes('youtu.be'))) || (embedUrl && embedUrl.includes('youtube'));
    let src = embedUrl || url;
    if (isYoutube && src) {
      if (src.includes('watch?v=')) {
        const vId = (src.match(/v=([^&]+)/) || [])[1];
        if (vId) src = `https://www.youtube.com/embed/${vId}`;
      } else if (src.includes('youtu.be/')) {
        const vId = src.split('youtu.be/')[1]?.split('?')[0];
        if (vId) src = `https://www.youtube.com/embed/${vId}`;
      }
    }

    let mediaEmbed = '';
    if (isYoutube && src) {
      mediaEmbed = `<iframe src="${src}" title="Embedded Video Player" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" contenteditable="false"></iframe>`;
    } else {
      mediaEmbed = `<video src="${src}" controls playsinline preload="metadata" contenteditable="false" style="width:100%;height:100%;object-fit:contain;border-radius:6px;"></video>`;
    }

    let styleStr = '';
    if (width) styleStr += `width:${width}px;`;
    if (height) styleStr += `height:${height}px;`;
    const styleAttr = styleStr ? `style="${styleStr}"` : '';

    return `<figure data-block-id="${block.id}" data-type="video" data-align="${align}" contenteditable="false" class="video-block" ${styleAttr}>
      <div class="video-wrapper" contenteditable="false">${mediaEmbed}</div>
      <span class="video-resize-handle" data-resize="nw"></span>
      <span class="video-resize-handle" data-resize="n"></span>
      <span class="video-resize-handle" data-resize="ne"></span>
      <span class="video-resize-handle" data-resize="e"></span>
      <span class="video-resize-handle" data-resize="se"></span>
      <span class="video-resize-handle" data-resize="s"></span>
      <span class="video-resize-handle" data-resize="sw"></span>
      <span class="video-resize-handle" data-resize="w"></span>
    </figure>`;
  }

  _getMetadataAttrs(block, extraStyleDecls = '') {
    let attrs = '';
    if (block.metadata?.ownerId) attrs += ` data-owner-id="${block.metadata.ownerId}"`;
    if (block.metadata?.userEmail) attrs += ` data-user-email="${block.metadata.userEmail}"`;
    const skipAlign = [
      BLOCK_TYPES.IMAGE,
      BLOCK_TYPES.VIDEO,
      BLOCK_TYPES.TABLE,
      BLOCK_TYPES.PAGE_BREAK,
      BLOCK_TYPES.DIVIDER,
    ].includes(block.type);
    const align = skipAlign ? null : normalizeAlign(block.metadata?.align);
    attrs += buildAlignAttrs(align, extraStyleDecls);
    return attrs;
  }

  // Enhanced image to HTML conversion
  imageToHTML(block) {
    let imageData;
    try {
      imageData = JSON.parse(block.content || '{}');
    } catch (e) {
      // Fallback for old format - check if it's HTML
      if (block.content && block.content.startsWith('<img')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.content;
        const imgEl = tempDiv.querySelector('img');
        imageData = {
          src: imgEl?.src || '',
          width: imgEl?.width || imgEl?.getAttribute('width') || 0,
          height: imgEl?.height || imgEl?.getAttribute('height') || 0,
          alt: imgEl?.alt || '',
          align: imgEl?.getAttribute('data-align') || imgEl?.dataset?.align || block.metadata?.align || 'left'
        };
      } else {
        // Fallback for raw src string
        imageData = { 
          src: block.content, 
          alt: block.metadata?.alt || '',
          width: block.metadata?.width || 0,
          height: block.metadata?.height || 0,
          align: block.metadata?.align || 'left'
        };
      }
    }
    
    const { src, width, height, alt } = imageData;
    const title = block.metadata?.title || '';
    const widthAttr = width ? `width="${width}"` : '';
    const heightAttr = height ? `height="${height}"` : '';
    
    let className = 'editor-image';
    if (block.metadata?.loading) className += ' loading';
    if (block.metadata?.error) className += ' error';
    
    if (block.metadata?.error) {
      return `<div class="image-error" data-block-id="${block.id}">
        <span>Image failed to load: ${block.metadata.error}</span>
      </div>`;
    }
    
    const align = imageData.align || 'left';
    
    return `<figure data-block-id="${block.id}" data-type="image" data-align="${align}" contenteditable="false" class="img-block">
      <img src="${src}" 
           alt="${alt || ''}" 
           title="${title}" 
           class="${className}"
           ${widthAttr} ${heightAttr}
           data-align="${align}"
           draggable="false"/>

      <span class="img-resize-handle" data-resize="nw"></span>
      <span class="img-resize-handle" data-resize="n"></span>
      <span class="img-resize-handle" data-resize="ne"></span>
      <span class="img-resize-handle" data-resize="e"></span>
      <span class="img-resize-handle" data-resize="se"></span>
      <span class="img-resize-handle" data-resize="s"></span>
      <span class="img-resize-handle" data-resize="sw"></span>
      <span class="img-resize-handle" data-resize="w"></span>
    </figure>`;
  }

  // Convert table block to HTML
  tableToHTML(block) {
    const { rows = [], headers = [], meta = {} } = block.content || { rows: [], headers: [], meta: {} };
    const cellMeta = Array.isArray(meta.cell) ? meta.cell : [];
    const rowHeights = Array.isArray(meta.rowHeights) ? meta.rowHeights : [];
    let html = `<table data-block-id="${block.id}">`;

    if (Array.isArray(meta.columnWidths) && meta.columnWidths.length) {
      let columnWidths = meta.columnWidths;
      const pxValues = columnWidths.map((w) => {
        const s = String(w || "");
        if (s.endsWith("px")) return parseFloat(s) || 0;
        return null;
      });
      if (pxValues.every((v) => v != null && v > 0)) {
        const sum = pxValues.reduce((a, b) => a + b, 0) || 1;
        columnWidths = pxValues.map((v) => `${((v / sum) * 100).toFixed(4)}%`);
      }
      html += "<colgroup>";
      columnWidths.forEach((width) => {
        html += width ? `<col width="${width}">` : "<col>";
      });
      html += "</colgroup>";
    }
    
    if (headers.length) {
      html += "<thead><tr>";
      headers.forEach((h, colIdx) => {
        const m = cellMeta[0]?.[colIdx] || {};
        const attrs = [];
        if (m.colspan && m.colspan > 1) attrs.push(`colspan="${m.colspan}"`);
        if (m.rowspan && m.rowspan > 1) attrs.push(`rowspan="${m.rowspan}"`);
        const cellAlign = normalizeAlign(m.align);
        if (cellAlign) {
          attrs.push(`align="${cellAlign}"`);
          attrs.push(`data-text-align="${cellAlign}"`);
        }
        if (m.valign) attrs.push(`valign="${m.valign}"`);
        const styleParts = [];
        if (cellAlign) styleParts.push(`text-align:${cellAlign}`);
        if (m.style) styleParts.push(String(m.style).replace(/;$/, ''));
        if (styleParts.length) attrs.push(`style="${styleParts.join(';')}"`);
        
        if (m.type === 'dropdown') {
          attrs.push(`data-type="dropdown"`);
          attrs.push(`contenteditable="false"`);
          attrs.push(`data-options="${JSON.stringify(m.options || []).replace(/"/g, '&quot;')}"`);
        }

        let cellHtml = h;
        if (m.type === 'dropdown') {
          const options = m.options || [];
          const selectVal = h || options[0] || '';
          const optionsHtml = options.map(opt => {
            const isSelected = opt === selectVal ? ' selected' : '';
            return `<option value="${opt}"${isSelected}>${opt}</option>`;
          }).join('');
          cellHtml = `<select class="cell-dropdown" style="width: 100%; border: none; outline: none; background: transparent; padding: 0px; margin: 0px; font-family: inherit; font-size: inherit; color: inherit; cursor: pointer; height: 100%; box-sizing: border-box;">${optionsHtml}</select>`;
        }

        html += `<th${attrs.length ? ` ${attrs.join(" ")}` : ""}>${cellHtml}</th>`;
      });
      html += "</tr></thead>";
    }
    html += "<tbody>";
    rows.forEach((row, rowIdx) => {
      const metaRow = cellMeta[headers.length ? rowIdx + 1 : rowIdx] || [];
      const rowHeight = rowHeights[rowIdx];
      html += `<tr${rowHeight ? ` style="height:${rowHeight}"` : ""}>`;
      row.forEach((cell, colIdx) => {
        const m = metaRow[colIdx] || {};
        const attrs = [];
        if (m.colspan && m.colspan > 1) attrs.push(`colspan="${m.colspan}"`);
        if (m.rowspan && m.rowspan > 1) attrs.push(`rowspan="${m.rowspan}"`);
        const cellAlign = normalizeAlign(m.align);
        if (cellAlign) {
          attrs.push(`align="${cellAlign}"`);
          attrs.push(`data-text-align="${cellAlign}"`);
        }
        if (m.valign) attrs.push(`valign="${m.valign}"`);
        const styleParts = [];
        if (cellAlign) styleParts.push(`text-align:${cellAlign}`);
        if (m.style) styleParts.push(String(m.style).replace(/;$/, ''));
        if (styleParts.length) attrs.push(`style="${styleParts.join(';')}"`);
        
        if (m.type === 'dropdown') {
          attrs.push(`data-type="dropdown"`);
          attrs.push(`contenteditable="false"`);
          attrs.push(`data-options="${JSON.stringify(m.options || []).replace(/"/g, '&quot;')}"`);
        }

        let cellHtml = cell;
        if (m.type === 'dropdown') {
          const options = m.options || [];
          const selectVal = cell || options[0] || '';
          const optionsHtml = options.map(opt => {
            const isSelected = opt === selectVal ? ' selected' : '';
            return `<option value="${opt}"${isSelected}>${opt}</option>`;
          }).join('');
          cellHtml = `<select class="cell-dropdown" style="width: 100%; border: none; outline: none; background: transparent; padding: 0px; margin: 0px; font-family: inherit; font-size: inherit; color: inherit; cursor: pointer; height: 100%; box-sizing: border-box;">${optionsHtml}</select>`;
        }

        html += `<td${attrs.length ? ` ${attrs.join(" ")}` : ""}>${cellHtml}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    
    return html;
  }

  // =======================
  // GOOGLE-DOCS-LIKE PAGINATION (NEW)
  // =======================

  // public: call this after any edit/paste;  // Main dynamic pagination algorithm
  repaginate(editorContentEl, options = {}) {
    if (!editorContentEl) return;
    this.configureLayoutFromElement(editorContentEl, options);
    if (this._layout.heightCache) {
      this._layout.heightCache.clear();
    }

    const all = this._mergeAdjacentTableContinuations(this.getAllBlocks());
    const pages = this._layoutBlocksIntoPages(all);

    this.document.pages = pages.map((p, i) => ({
      id: `page-${i + 1}`,
      blocks: p.blocks
    }));
    this.currentPageIndex = 0;
  }

  _getContinuationRootId(blockId = '') {
    let root = blockId;
    // Support repeated split chains like "..._p2_p1".
    while (/_p\d+$/.test(root)) root = root.replace(/_p\d+$/, '');
    return root;
  }

  _mergeAdjacentTableContinuations(blocks) {
    if (!Array.isArray(blocks) || blocks.length <= 1) return blocks || [];

    const merged = [];
    const isTable = (b) => b?.type === BLOCK_TYPES.TABLE && b?.content;

    const mergeTablePair = (a, b) => {
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
            // Keep the header meta only once, then append body row meta.
            cell: [...aCells, ...bBodyCells],
            rowHeights: [...aRowHeights, ...bRowHeights]
          }
        },
        metadata: nextMetadata
      };
    };

    for (let i = 0; i < blocks.length; i++) {
      const current = blocks[i];
      const next = blocks[i + 1];

      if (!isTable(current) || !isTable(next)) {
        merged.push(current);
        continue;
      }

      const currRoot = this._getContinuationRootId(current.id);
      const nextRoot = this._getContinuationRootId(next.id);
      const headerMatch =
        JSON.stringify(current.content?.headers || []) ===
        JSON.stringify(next.content?.headers || []);
      const linkedByMeta =
        current?.metadata?.continuedTo === next?.id ||
        next?.metadata?.continuedFrom === current?.id;
      const sameContinuationFamily = currRoot === nextRoot;

      if (headerMatch && (linkedByMeta || sameContinuationFamily)) {
        let acc = mergeTablePair(current, next);
        i += 1;

        while (i + 1 < blocks.length) {
          const candidate = blocks[i + 1];
          if (!isTable(candidate)) break;

          const accRoot = this._getContinuationRootId(acc.id);
          const candRoot = this._getContinuationRootId(candidate.id);
          const accHeaderMatch =
            JSON.stringify(acc.content?.headers || []) ===
            JSON.stringify(candidate.content?.headers || []);
          const accLinkedByMeta =
            acc?.metadata?.continuedTo === candidate?.id ||
            candidate?.metadata?.continuedFrom === acc?.id;

          if (!accHeaderMatch || !(accLinkedByMeta || accRoot === candRoot)) break;
          acc = mergeTablePair(acc, candidate);
          i += 1;
        }

        merged.push(acc);
        continue;
      }

      merged.push(current);
    }

    return merged;
  }

  getUsableHeightForPage(pageIndex = 1) {
    if (typeof document !== 'undefined') {
      const pages = document.querySelectorAll('.page');
      const pageEl = pages[pageIndex - 1];
      if (pageEl) {
        const paperSize = (this._layout.paperSize || 'a4').toLowerCase();
        let totalPaperHeight = 1123;
        if (paperSize === 'letter') totalPaperHeight = 1056;
        else if (paperSize === 'legal') totalPaperHeight = 1344;

        const logoStrip = pageEl.querySelector('.page-logo-strip');
        const logoH = logoStrip ? (logoStrip.getBoundingClientRect().height || 64) : 64;

        const header = pageEl.querySelector('.page-header');
        const headerH = header ? (header.getBoundingClientRect().height || 35) : 35;

        const footer = pageEl.querySelector('.page-footer');
        const footerH = footer ? (footer.getBoundingClientRect().height || 50) : 50;

        const content = pageEl.querySelector('.page-content');
        const cs = content ? getComputedStyle(content) : null;
        const vpad = cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 36;

        const budget = Math.floor(totalPaperHeight - logoH - headerH - footerH - vpad - 4);
        if (budget > 0) return budget;
      }
    }
    return this._layout.usableHeightPx || 934;
  }

  getPageOrientationForPage(pageIndex = 1) {
    if (typeof document !== 'undefined') {
      const pages = document.querySelectorAll('.page');
      const page = pages[pageIndex - 1];
      if (page) {
        if (page.classList.contains('landscape')) return 'landscape';
        if (page.classList.contains('portrait')) return 'portrait';
      }
    }
    return this._layout.orientation || 'portrait';
  }

  // --- core layout: split/fill page then continue with strict height enforcement ---
  _layoutBlocksIntoPages(blocks) {
    const pages = [];
    let cur = { blocks: [] };
    let currentPageIndex = 1;
    let currentCapacity = this.getUsableHeightForPage(currentPageIndex);
    let remaining = currentCapacity;
    const pre = this._layout.preBreakMarginPx || 0;
    let prevBottomMargin = 0;

    const newPage = () => {
      pages.push(cur);
      cur = { blocks: [] };
      currentPageIndex++;
      currentCapacity = this.getUsableHeightForPage(currentPageIndex);
      remaining = currentCapacity;
      prevBottomMargin = 0;
    };

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === BLOCK_TYPES.PAGE_BREAK) {
        if (cur.blocks.length === 0) {
          cur.blocks.push(this.createBlock(BLOCK_TYPES.PARAGRAPH, ''));
        }
        cur.blocks.push(b);
        newPage();
        continue;
      }
      const pageOrient = this.getPageOrientationForPage(currentPageIndex);
      const m = this._measureWithMargins(b, pageOrient);

      const isFirstOnPage = remaining === currentCapacity;
      const headCost = isFirstOnPage ? 0 : (prevBottomMargin + m.mt);
      const need = m.box + headCost;
      
      if (need > remaining && m.total > currentCapacity) {
        if (this._isSplittable(b)) {
          // Will be handled by splitting logic below
        } else {
          if (remaining < currentCapacity) {
            newPage();
            i--;
            continue;
          } else {
            cur.blocks.push(b);
            remaining = 0;
            prevBottomMargin = m.mb;
            continue;
          }
        }
      }

      const keepWithNext = b.type === BLOCK_TYPES.HEADING;
      const SAFETY = 1;
      const cutline = Math.max(0, remaining - pre - SAFETY);
      const canPlaceWhole = need <= cutline;
      
      if (canPlaceWhole) {
        cur.blocks.push(b);
        remaining -= need;
        prevBottomMargin = m.mb;
        continue;
      }

      if (this._isSplittable(b)) {
        const spaceForBox = Math.max(0, cutline - headCost);
        const parts = this._splitToFit(b, spaceForBox);

        if (parts.first) {
          if (keepWithNext) {
            if (remaining < currentCapacity) {
              newPage();
              i--;
              continue;
            } else {
              cur.blocks.push(b);
              remaining -= need;
              prevBottomMargin = m.mb;
              continue;
            }
          }
          cur.blocks.push(parts.first);
          newPage();
          let rest = parts.rest;
          while (rest) {
            const nextOrient = this.getPageOrientationForPage(currentPageIndex);
            const rr = this._measureWithMargins(rest, nextOrient);
            const isFirstInRest = remaining === currentCapacity;
            const rrHeadCost = isFirstInRest ? 0 : (prevBottomMargin + rr.mt);
            const rrNeed = rr.box + rrHeadCost;
            if (rrNeed <= remaining) {
              cur.blocks.push(rest);
              remaining -= rrNeed;
              prevBottomMargin = rr.mb;
              rest = null;
            } else {
              const boxBudget = Math.max(0, remaining - rrHeadCost);
              const more = this._splitToFit(rest, boxBudget);
              
              if (!more.first) { 
                if (remaining < currentCapacity) {
                  newPage(); 
                  rest = more.rest; 
                  continue; 
                } else {
                  cur.blocks.push(rest);
                  remaining = 0;
                  prevBottomMargin = rr.mb;
                  rest = null;
                  continue;
                }
              }
              
              cur.blocks.push(more.first);
              newPage();
              rest = more.rest;
            }
          }
          continue;
        }

        if (remaining < currentCapacity) {
          newPage();
          i--;
          continue;
        } else {
          cur.blocks.push(b);
          remaining = 0;
          prevBottomMargin = m.mb;
          continue;
        }
      }

      if (remaining < currentCapacity) {
        newPage();
        i--;
      } else {
        cur.blocks.push(b);
        remaining = 0;
        prevBottomMargin = m.mb;
      }
    }

    if (cur.blocks.length === 0 && pages.length > 0) {
      const emptyParagraph = this.createBlock(BLOCK_TYPES.PARAGRAPH, '');
      cur.blocks.push(emptyParagraph);
    }

    pages.push(cur);
    return pages;
  }

  _isSplittable(block) {
    return (
      block.type === BLOCK_TYPES.PARAGRAPH ||
      block.type === BLOCK_TYPES.QUOTE ||
      block.type === BLOCK_TYPES.LIST ||
      block.type === BLOCK_TYPES.CODE ||
      block.type === BLOCK_TYPES.TABLE
    );
  }

  // --- measurement (offscreen sandbox) ---
  _measure(block) {
    const s = this._layout.sandbox;
    if (!s) return 0;
    s.innerHTML = '';
    const el = this._renderBlockForMeasure(block);
    el.setAttribute('contenteditable', 'true');
    s.appendChild(el);
    return Math.ceil(el.getBoundingClientRect().height);
  }

  // include margins in measurement and return collapse-aware pieces with strict height enforcement
  _measureWithMargins(block, targetOrientation = null) {
    const s = this._layout.sandbox;
    if (!s) return { box: 0, mt: 0, mb: 0, total: 0 };
    if (block.type === BLOCK_TYPES.PAGE_BREAK) {
      return { box: 0, mt: 0, mb: 0, total: 0 };
    }

    const pageOrientation = (targetOrientation || this._layout.orientation || 'portrait').toLowerCase();
    const paperSizeClass = (this._layout.paperSize || 'a4').toLowerCase();

    // 1. Check height cache first (O(1) lookup instead of DOM reflow)
    const contentHash = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    const metaHash = block.metadata ? JSON.stringify(block.metadata) : '';
    const cacheKey = `v5-${pageOrientation}-${block.type}-${contentHash}-${metaHash}`;
    const cached = this._layout.heightCache.get(cacheKey);
    if (cached) return cached;

    s.innerHTML = '';
    let el;
    
    const rendererMirror = document.createElement('div');
    rendererMirror.className = `document-renderer ${pageOrientation} ${paperSizeClass}`;

    const pageMirror = document.createElement('div');
    pageMirror.className = `page ${paperSizeClass} ${pageOrientation}`;

    const contentMirror = document.createElement('div');
    contentMirror.className = 'page-content';
    contentMirror.contentEditable = 'true';

    el = this._renderBlockForMeasure(block);
    el.setAttribute('data-block-id', 'measurement-mirror');
    el.setAttribute('contenteditable', 'true');

    contentMirror.appendChild(el);
    pageMirror.appendChild(contentMirror);
    rendererMirror.appendChild(pageMirror);
    s.appendChild(rendererMirror);

    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;

    const boxHeight = Math.ceil(rect.height);
    const totalHeight = boxHeight + mt + mb;

    s.innerHTML = '';

    const res = {
      box: boxHeight,
      mt: Math.ceil(mt),
      mb: Math.ceil(mb),
      total: Math.ceil(totalHeight)
    };

    this._layout.heightCache.set(cacheKey, res);
    return res;
  }

  _renderBlockForMeasure(block) {
    switch (block.type) {
      case BLOCK_TYPES.HEADING: {
        const level = block.metadata.level || 1;
        const el = document.createElement(`h${level}`);
        const hasContent = block.content && block.content.replace(/<br\s*\/?>/gi, '').trim().length > 0;
        el.innerHTML = hasContent ? block.content : '<br>';
        if (block.metadata?.align) writeAlignToElement(el, block.metadata.align);
        return el;
      }
      case BLOCK_TYPES.LIST: {
        const el = document.createElement(
          block.metadata.listType === LIST_TYPES.NUMBERED ? 'ol' : 'ul'
        );
        if (block.metadata.listType === LIST_TYPES.NUMBERED) el.className = 'custom-numbered-list';
        if (block.metadata?.align) writeAlignToElement(el, block.metadata.align);
        const items = block.content || [];
        const itemAligns = Array.isArray(block.metadata?.itemAligns) ? block.metadata.itemAligns : [];
        if (items.length === 0) {
          const li = document.createElement('li');
          li.innerHTML = '<br>';
          el.appendChild(li);
        } else {
          items.forEach((item, i) => {
            const li = document.createElement('li');
            const hasContent = item && item.replace(/<br\s*\/?>/gi, '').trim().length > 0;
            li.innerHTML = hasContent ? item : '<br>';
            const itemAlign = itemAligns[i] || block.metadata?.align;
            if (itemAlign) writeAlignToElement(li, itemAlign);
            el.appendChild(li);
          });
        }
        return el;
      }
      case BLOCK_TYPES.QUOTE: {
        const el = document.createElement('blockquote');
        const hasContent = block.content && block.content.replace(/<br\s*\/?>/gi, '').trim().length > 0;
        el.innerHTML = hasContent ? block.content : '<br>';
        if (block.metadata?.align) writeAlignToElement(el, block.metadata.align);
        return el;
      }
      case BLOCK_TYPES.CODE: {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        const hasContent = block.content && block.content.replace(/<br\s*\/?>/gi, '').trim().length > 0;
        code.innerHTML = hasContent ? block.content : '<br>';
        pre.appendChild(code);
        return pre;
      }
      case BLOCK_TYPES.DIVIDER:
        return document.createElement('hr');
      case BLOCK_TYPES.PAGE_BREAK: {
        const d = document.createElement('div');
        d.className = 'page-break-marker';
        d.setAttribute('data-page-break', 'true');
        d.style.height = '0px';
        return d;
      }
      case BLOCK_TYPES.IMAGE: {
        let imageData;
        try {
          imageData = JSON.parse(block.content || '{}');
        } catch {
          // Fallback for old format - check if it's HTML
          if (block.content && block.content.startsWith('<img')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.content;
            const imgEl = tempDiv.querySelector('img');
            imageData = {
              src: imgEl?.src || '',
              width: imgEl?.width || imgEl?.getAttribute('width') || 0,
              height: imgEl?.height || imgEl?.getAttribute('height') || 0,
              alt: imgEl?.alt || ''
            };
          } else {
            // Fallback for very old format
            imageData = { src: block.content, alt: block.metadata?.alt || '' };
          }
        }
        
        const { src, width, height, alt } = imageData;
        
        const fig = document.createElement('figure');
        fig.className = 'img-block';
        fig.setAttribute('data-block-id', block.id);
        fig.setAttribute('data-type', 'image');
        fig.setAttribute('data-align', imageData.align || 'left');
        fig.setAttribute('contenteditable', 'false');
        
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || '';
        img.title = block.metadata?.title || '';
        img.draggable = false;
        if (width) img.width = width;
        if (height) img.height = height;
        
        fig.appendChild(img);
        
        const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        directions.forEach(dir => {
          const handle = document.createElement('span');
          handle.className = 'img-resize-handle';
          handle.setAttribute('data-resize', dir);
          fig.appendChild(handle);
        });
        
        return fig;
      }
      case BLOCK_TYPES.VIDEO: {
        let videoData = {};
        try {
          videoData = typeof block.content === 'object' ? block.content : JSON.parse(block.content || '{}');
        } catch (e) {
          if (block.content && typeof block.content === 'string') {
            videoData = { src: block.content };
          }
        }

        const width = videoData.width || 480;
        const height = videoData.height || 270;
        const align = videoData.align || 'center';

        const fig = document.createElement('figure');
        fig.className = 'video-block';
        fig.setAttribute('data-block-id', block.id);
        fig.setAttribute('data-type', 'video');
        fig.setAttribute('data-align', align);
        fig.setAttribute('contenteditable', 'false');
        fig.style.width = `${width}px`;
        fig.style.height = `${height}px`;

        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        fig.appendChild(wrapper);

        const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        directions.forEach(dir => {
          const handle = document.createElement('span');
          handle.className = 'video-resize-handle';
          handle.setAttribute('data-resize', dir);
          fig.appendChild(handle);
        });

        return fig;
      }
      case BLOCK_TYPES.TABLE: {
        const el = document.createElement('table');

        // Mirror page CSS for accurate measurement
        el.style.width = '100%';
        el.style.borderCollapse = 'collapse';
        el.style.tableLayout = 'fixed';
        el.style.margin = '0.5em 0';
        el.style.fontSize = '0.95em';
        el.style.background = 'white';
        el.style.borderRadius = '6px';
        el.style.overflow = 'hidden';

        const styleCell = (cell, isHeader = false, meta = null, content = '') => {
          cell.style.padding = '0.8em';
          cell.style.borderBottom = '1px solid #dee2e6';
          cell.style.verticalAlign = 'top';
          cell.style.textAlign = 'left';
          if (isHeader) {
            cell.style.backgroundColor = '#007bff';
            cell.style.color = 'white';
            cell.style.fontWeight = '600';
          }
          if (meta) {
            if (meta.colspan && meta.colspan > 1) cell.colSpan = meta.colspan;
            if (meta.rowspan && meta.rowspan > 1) cell.rowSpan = meta.rowspan;
            if (meta.align) {
              cell.style.textAlign = meta.align;
              cell.setAttribute('data-text-align', meta.align);
              cell.setAttribute('align', meta.align);
            }
            if (meta.valign) cell.style.verticalAlign = meta.valign;
            if (meta.style) cell.setAttribute('style', `${cell.getAttribute('style') || ''};${meta.style}`);
            
            if (meta.type === 'dropdown') {
              cell.setAttribute('data-type', 'dropdown');
              cell.setAttribute('contenteditable', 'false');
              cell.setAttribute('data-options', JSON.stringify(meta.options || []));
              
              const select = document.createElement('select');
              select.className = 'cell-dropdown';
              select.setAttribute('contenteditable', 'false');
              select.style.width = '100%';
              select.style.border = 'none';
              select.style.outline = 'none';
              select.style.background = 'transparent';
              select.style.padding = '0px';
              select.style.margin = '0px';
              select.style.fontFamily = 'inherit';
              select.style.fontSize = 'inherit';
              select.style.color = 'inherit';
              select.style.cursor = 'pointer';
              select.style.height = '100%';
              select.style.boxSizing = 'border-box';
              
              const options = meta.options || [];
              const selectVal = content || options[0] || '';
              
              options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === selectVal) {
                  option.selected = true;
                }
                select.appendChild(option);
              });
              cell.appendChild(select);
              return;
            }
          }
          cell.innerHTML = content;
        };

        const { headers = [], rows = [], meta = {} } = block.content || { headers: [], rows: [], meta: {} };
        const cellMeta = Array.isArray(meta.cell) ? meta.cell : [];
        const rowHeights = Array.isArray(meta.rowHeights) ? meta.rowHeights : [];

        if (Array.isArray(meta.columnWidths) && meta.columnWidths.length) {
          const colgroup = document.createElement('colgroup');
          meta.columnWidths.forEach((width) => {
            const col = document.createElement('col');
            if (width) col.setAttribute('width', width);
            colgroup.appendChild(col);
          });
          el.appendChild(colgroup);
        }

        if (headers.length) {
          const thead = document.createElement('thead');
          const tr = document.createElement('tr');
          headers.forEach(h => { 
            const th = document.createElement('th'); 
            styleCell(th, true, cellMeta[0]?.[tr.children.length] || null, h);
            tr.appendChild(th); 
          });
          thead.appendChild(tr);
          el.appendChild(thead);
        }
        const tbody = document.createElement('tbody');
        rows.forEach((r, rowIdx) => {
          const tr = document.createElement('tr');
          if (rowHeights[rowIdx]) {
            tr.style.height = rowHeights[rowIdx];
          }
          const metaRow = cellMeta[headers.length ? rowIdx + 1 : rowIdx] || [];
          r.forEach((c, colIdx) => { 
            const td = document.createElement('td'); 
            styleCell(td, false, metaRow[colIdx] || null, c);
            tr.appendChild(td); 
          });
          tbody.appendChild(tr);
        });
        el.appendChild(tbody);
        return el;
      }
      case BLOCK_TYPES.PARAGRAPH:
      default: {
        const p = document.createElement('p');
        const hasContent = block.content && block.content.replace(/<br\s*\/?>/gi, '').trim().length > 0;
        p.innerHTML = hasContent ? block.content : '<br>';
        if (block.metadata?.align) writeAlignToElement(p, block.metadata.align);
        return p;
      }
    }
  }

  // --- sandbox mirror helper ---
  // Creates the correct .document-renderer > .page > .page-content wrapper
  // so CSS selectors match identically to the live DOM during split calculations.
  _createSandboxMirror() {
    const s = this._layout.sandbox;
    s.innerHTML = '';
    const paperSizeClass = (this._layout.paperSize || 'a4').toLowerCase();
    const orientationClass = (this._layout.orientation || 'portrait').toLowerCase();

    const rendererMirror = document.createElement('div');
    rendererMirror.className = `document-renderer ${orientationClass} ${paperSizeClass}`;

    const pageMirror = document.createElement('div');
    pageMirror.className = `page ${paperSizeClass} ${orientationClass}`;

    const contentMirror = document.createElement('div');
    contentMirror.className = 'page-content';
    contentMirror.contentEditable = 'true'; // Perfect editing style parity

    pageMirror.appendChild(contentMirror);
    rendererMirror.appendChild(pageMirror);
    s.appendChild(rendererMirror);
    return contentMirror;
  }

  // --- splitters ---
  _splitToFit(block, boxBudget /* pixels available for the element's box only */) {
    switch (block.type) {
      case BLOCK_TYPES.PARAGRAPH:
      case BLOCK_TYPES.QUOTE:
        return this._splitParagraph(block, boxBudget);
      case BLOCK_TYPES.CODE:
        return this._splitCode(block, boxBudget);
      case BLOCK_TYPES.LIST:
        return this._splitList(block, boxBudget);
      case BLOCK_TYPES.TABLE:
        return this._splitTable(block, boxBudget);
      default:
        return { first: null, rest: block };
    }
  }

  _approxLineHeight(el) {
    const cs = getComputedStyle(el);
    const px = v => (v === 'normal' ? NaN : parseFloat(v));
    const lh = px(cs.lineHeight);
    return !isNaN(lh) ? lh : Math.max(12, 1.2 * parseFloat(cs.fontSize || '12'));
  }

  _splitParagraph(block, boxBudget) {
    const contentMirror = this._createSandboxMirror();
    const full = this._renderBlockForMeasure(block);
    full.setAttribute('data-block-id', 'split-mirror');
    const first = full.cloneNode(true);
    const rest = full.cloneNode(true);
    rest.innerHTML = '';
    contentMirror.appendChild(first);

    const fits = () => first.getBoundingClientRect().height <= boxBudget;
    if (fits()) return { first: block, rest: null };
    if (boxBudget <= 0) return { first: null, rest: block };

    // Binary search for exact split point (much faster than O(N) word-by-word removal)
    const moveRunBinarySearch = (node, toRest) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (!text.trim()) {
           toRest.insertBefore(node, toRest.firstChild);
           return false;
        }
        const tokens = text.match(/[^.!?]+[.!?]|\S+\s*|./g) || [text];
        
        let low = 0;
        let high = tokens.length;
        let bestSplit = 0;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          node.textContent = tokens.slice(0, mid).join('');
          if (fits()) {
            bestSplit = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        node.textContent = tokens.slice(0, bestSplit).join('');
        const remainderText = tokens.slice(bestSplit).join('');
        if (remainderText) {
           toRest.insertBefore(document.createTextNode(remainderText), toRest.firstChild);
        }
        return bestSplit < tokens.length;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        for (let i = node.childNodes.length - 1; i >= 0 && !fits(); i--) {
          const child = node.childNodes[i];
          
          if (child.nodeType === Node.ELEMENT_NODE && child.childNodes.length === 0 && !child.textContent) {
            // Physically move void tags (like <br>, <img>) to rest so they don't hold up height in `first`
            toRest.insertBefore(child, toRest.firstChild);
          } else {
            let childMirror;
            if (child.nodeType === Node.ELEMENT_NODE) {
              // Create a mirror of the child element (not the parent)
              childMirror = toRest.firstChild && toRest.firstChild.nodeName === child.nodeName
                ? toRest.firstChild
                : toRest.insertBefore(child.cloneNode(false), toRest.firstChild);
            } else {
              childMirror = toRest; // Text nodes are inserted directly into the parent mirror
            }
            
            moveRunBinarySearch(child, childMirror);
            
            // If this element was completely emptied to rest, clean it up from first
            if (!fits() && child.nodeType === Node.ELEMENT_NODE && !child.textContent.trim() && !child.querySelector?.('img, iframe, table, br')) {
              node.removeChild(child);
            }
          }
        }
        return true;
      }
      return false;
    };

    moveRunBinarySearch(first, rest);

    // If the budget was so small that not even a single word fit, 
    // we must move the entire block to the next page to avoid overlap.
    if (!first.textContent.trim()) {
      return { first: null, rest: block };
    }

    // (Removed unsafe widow/orphan logic that forcefully appended text to `first` 
    // and caused overflow/overlap by ignoring boxBudget)

    const firstBlock = { ...block, id: block.id + '_p1', content: first.innerHTML, metadata: { ...block.metadata, continuedTo: block.id + '_p2' } };
    const restBlock  = rest.textContent
      ? { ...block, id: block.id + '_p2', content: rest.innerHTML, metadata: { ...block.metadata, continuedFrom: block.id + '_p1' } }
      : null;

    return { first: firstBlock, rest: restBlock };
  }

  _splitCode(block, boxBudget) {
    const html = block.content || '';
    const lines = html.split(/<br\s*\/?>|\n/);
    const contentMirror = this._createSandboxMirror();
    const probe = this._renderBlockForMeasure({ ...block, content: '' });
    probe.setAttribute('data-block-id', 'split-mirror');
    contentMirror.appendChild(probe);
    const code = probe.tagName.toLowerCase() === 'pre' ? probe.querySelector('code') : probe;

    const taken = [];
    for (let i = 0; i < lines.length; i++) {
      code.innerHTML = [...taken, lines[i]].join('<br>');
      if (probe.getBoundingClientRect().height <= boxBudget) taken.push(lines[i]);
      else break;
    }
    if (!taken.length) return { first: null, rest: block };

    const firstBlock = { ...block, id: block.id + '_p1', content: taken.join('<br>'), metadata: { ...block.metadata, continuedTo: block.id + '_p2' } };
    const rest = lines.slice(taken.length).join('<br>');
    const restBlock = rest
      ? { ...block, id: block.id + '_p2', content: rest, metadata: { ...block.metadata, continuedFrom: block.id + '_p1' } }
      : null;

    return { first: firstBlock, rest: restBlock };
  }

  _splitList(block, boxBudget) {
    const items = Array.isArray(block.content) ? block.content : [];
    if (!items.length) return { first: null, rest: null };

    const contentMirror = this._createSandboxMirror();
    const probe = this._renderBlockForMeasure({ ...block, content: [] });
    probe.setAttribute('data-block-id', 'split-mirror');
    contentMirror.appendChild(probe);

    const taken = [];
    for (let i = 0; i < items.length; i++) {
      const li = document.createElement('li');
      li.innerHTML = items[i];
      probe.appendChild(li);
      if (probe.getBoundingClientRect().height <= boxBudget) taken.push(items[i]);
      else { probe.removeChild(li); break; }
    }
    if (!taken.length) return { first: null, rest: block };

    const itemAligns = Array.isArray(block.metadata?.itemAligns) ? block.metadata.itemAligns : [];
    const firstBlock = {
      ...block,
      id: block.id + '_p1',
      content: taken,
      metadata: {
        ...block.metadata,
        continuedTo: block.id + '_p2',
        itemAligns: itemAligns.slice(0, taken.length),
      },
    };
    const restItems = items.slice(taken.length);
    const restBlock = restItems.length
      ? {
          ...block,
          id: block.id + '_p2',
          content: restItems,
          metadata: {
            ...block.metadata,
            continuedFrom: block.id + '_p1',
            itemAligns: itemAligns.slice(taken.length),
          },
        }
      : null;

    return { first: firstBlock, rest: restBlock };
  }

  _splitTable(block, boxBudget) {
    const { headers = [], rows = [], meta = {} } = block.content || { headers: [], rows: [], meta: {} };
    const cellMeta = Array.isArray(meta.cell) ? meta.cell : [];
    const rowHeights = Array.isArray(meta.rowHeights) ? meta.rowHeights : [];
    
    const contentMirror = this._createSandboxMirror();
    const probe = this._renderBlockForMeasure({ ...block, content: { headers, rows: [] } });
    probe.setAttribute('data-block-id', 'split-mirror');
    contentMirror.appendChild(probe);
    const tbody = probe.querySelector('tbody') || probe;

    const buildStyledRow = (cells, rowMeta = [], rowIndex = -1) => {
      const tr = document.createElement('tr');
      if (rowIndex >= 0 && rowHeights[rowIndex]) {
        tr.style.height = rowHeights[rowIndex];
      }
      cells.forEach((c, colIdx) => {
        const td = document.createElement('td');
        td.innerHTML = c;
        td.style.padding = '0.8em';
        td.style.borderBottom = '1px solid #dee2e6';
        td.style.verticalAlign = 'top';
        td.style.textAlign = 'left';
        const m = rowMeta[colIdx] || {};
        if (m.colspan && m.colspan > 1) td.colSpan = m.colspan;
        if (m.rowspan && m.rowspan > 1) td.rowSpan = m.rowspan;
        if (m.align) {
          td.style.textAlign = m.align;
          td.setAttribute('data-text-align', m.align);
          td.setAttribute('align', m.align);
        }
        if (m.valign) td.style.verticalAlign = m.valign;
        if (m.style) td.setAttribute('style', `${td.getAttribute('style') || ''};${m.style}`);
        tr.appendChild(td);
      });
      return tr;
    };

    // Add safety buffer (aligned at 2px to prevent table boundary overlap)
    const safety = 2;
    const budget = Math.max(0, boxBudget - safety);

    const taken = [];
    let lastFittingRow = -1;
    
    // Try to fit as many complete rows as possible
    for (let i = 0; i < rows.length; i++) {
      const tr = buildStyledRow(
        rows[i],
        cellMeta[headers.length ? i + 1 : i] || [],
        i
      );
      tbody.appendChild(tr);
      
      const currentHeight = probe.getBoundingClientRect().height;
      if (currentHeight <= budget) {
        taken.push(rows[i]);
        lastFittingRow = i;
      } else {
        tbody.removeChild(tr);
        // If even the first row doesn't fit, we return null to signal a page shift
        break;
      }
    }

    const hasActiveRowSpanOverlap = (metaCells, hasHeaders, cutRowIndex) => {
      for (let r = 0; r <= cutRowIndex; r++) {
        const metaRowIdx = hasHeaders ? r + 1 : r;
        const rowMeta = metaCells[metaRowIdx] || [];
        for (let c = 0; c < rowMeta.length; c++) {
          const m = rowMeta[c] || {};
          const span = m.rowspan || 1;
          if (span > 1 && (r + span - 1) > cutRowIndex) {
            return true;
          }
        }
      }
      return false;
    };

    const hasHeaders = headers.length > 0;
    while (lastFittingRow >= 0 && hasActiveRowSpanOverlap(cellMeta, hasHeaders, lastFittingRow)) {
      if (tbody.lastChild) {
        tbody.removeChild(tbody.lastChild);
      }
      taken.pop();
      lastFittingRow--;
    }

    if (!taken.length) return { first: null, rest: block };

    const firstBlock = {
      ...block,
      id: block.id + '_p1',
      content: {
        headers,
        rows: taken,
        meta: {
          ...meta,
          cell: [
            ...(headers.length ? [cellMeta[0] || []] : []),
            ...cellMeta.slice(headers.length ? 1 : 0, (headers.length ? 1 : 0) + taken.length)
          ],
          rowHeights: rowHeights.slice(0, taken.length)
        }
      },
      metadata: { ...block.metadata, continuedTo: block.id + '_p2' }
    };
    const restRows = rows.slice(taken.length);
    const restCellMeta = cellMeta.slice((headers.length ? 1 : 0) + taken.length);
    const restBlock = restRows.length
      ? {
          ...block,
          id: block.id + '_p2',
          content: {
            headers,
            rows: restRows,
            meta: {
              ...meta,
              cell: [
                ...(headers.length ? [cellMeta[0] || []] : []),
                ...restCellMeta
            ],
            rowHeights: rowHeights.slice(taken.length)
            }
          },
          metadata: { ...block.metadata, continuedFrom: block.id + '_p1' }
        }
      : null;

    return { first: firstBlock, rest: restBlock };
  }
}

// Paste handling has been moved to PasteHandler.js component

// =======================
// CONTENT CHANGE HANDLER
// =======================

