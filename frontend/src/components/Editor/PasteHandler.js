// components/Editor/PasteHandler.js
import { BLOCK_TYPES } from './DocumentEngine';
import { v4 as uuidv4 } from 'uuid';
import { readStoredAlign } from './textAlignment/textAlignment';

/**
 * Notes:
 * - We keep structure like Google Docs: block elements become blocks; inline is preserved as sanitized HTML.
 * - Unknown tags are stripped; allowed inline styles are whitelisted.
 */

const INLINE_ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'span', 'sub', 'sup',
  'code', 'kbd', 'mark', 'a', 'br', 'wbr', 'ol', 'ul', 'li', 'small', 'big', 'font',
  'abbr', 'cite', 'dfn', 'time', 'var', 'samp', 'bdi', 'bdo', 'ruby', 'rt', 'rp',
  'nobr', 'tt', 'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext',
  'msub', 'msup', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mstyle', 'mspace',
  'annotation'
]);

const INLINE_ALLOWED_STYLES = new Set([
  'color', 'background-color', 'font-weight', 'font-style', 'text-decoration',
  'text-decoration-line', 'text-decoration-style', 'text-decoration-color',
  'font-size', 'font-family', 'letter-spacing', 'word-spacing',
  'vertical-align', 'font-variant-position'
]);

/**
 * Tags that are inline/phrasing in HTML. Clipboard HTML from Wikipedia/Word
 * often wraps formulas like H<sub>2</sub>O in a span with no <p>/<h*> wrapper.
 * Those must stay one paragraph — not one block per text node.
 */
const PHRASING_TAGS = new Set([
  'span', 'sub', 'sup', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins',
  'a', 'mark', 'kbd', 'small', 'big', 'font', 'abbr', 'cite', 'dfn', 'time', 'var',
  'samp', 'wbr', 'br', 'bdi', 'bdo', 'ruby', 'rt', 'rp', 'nobr', 'tt', 'acronym',
  'label', 'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext', 'msub',
  'msup', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mstyle', 'mspace', 'annotation'
]);

const URL_ATTRS = new Set(['href', 'src']);

function sanitizeUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    const bad = ['javascript:', 'data:vbscript', 'vbscript:', 'file:'];
    if (bad.some(prefix => u.protocol.toLowerCase().startsWith(prefix))) return '#';
    return u.toString();
  } catch {
    return '#';
  }
}

function keepAttrs(el, allowedExtra = []) {
  const out = {};
  const allow = new Set([
    'class', 'title', 'data-doc-id', 'data-doc-title', 'data-type', 'contenteditable',
    ...allowedExtra
  ]);
  for (const attr of Array.from(el.attributes || [])) {
    const name = attr.name.toLowerCase();
    if (URL_ATTRS.has(name)) {
      out[name] = sanitizeUrl(attr.value);
    } else if (allow.has(name)) {
      out[name] = attr.value;
    } else if (name === 'style') {
      const style = el.style;
      const kept = [];
      INLINE_ALLOWED_STYLES.forEach(p => {
        const v = style.getPropertyValue(p);
        if (v) kept.push(`${p}: ${v}`);
      });
      if (kept.length) out.style = kept.join('; ');
    }
  }
  return out;
}

function attrsToString(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');
}

function escapeText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Turn CSS-only sub/super (common in Word/web copy) into semantic <sub>/<sup>. */
function promoteCssSubSuperTag(tag, node, attrs) {
  if (tag !== 'span' || !node?.style) return tag;
  const va = (node.style.getPropertyValue('vertical-align') || node.style.verticalAlign || '').toLowerCase();
  const fvp = (node.style.getPropertyValue('font-variant-position') || '').toLowerCase();
  const isSuper = va === 'super' || va === 'superscript' || fvp === 'super';
  const isSub = va === 'sub' || va === 'subscript' || fvp === 'sub';
  if (!isSuper && !isSub) return tag;
  if (attrs.style) {
    attrs.style = attrs.style
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const prop = s.split(':')[0]?.trim().toLowerCase();
        return prop && prop !== 'vertical-align' && prop !== 'font-variant-position';
      })
      .join('; ');
    if (!attrs.style) delete attrs.style;
  }
  return isSuper ? 'sup' : 'sub';
}

/** Serialize a node to *sanitized* inline HTML we can store in paragraph/list/table cells */
function serializeInline(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeText(node.nodeValue || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();

  // line breaks are okay
  if (tag === 'br' || tag === 'wbr') return `<${tag}>`;

  // links allowed
  if (tag === 'a') {
    const attrs = keepAttrs(node, [
      'href', 'rel', 'target', 'class', 'title',
      'data-doc-id', 'data-doc-title', 'data-type', 'contenteditable'
    ]);
    if (!attrs.rel) attrs.rel = 'noopener noreferrer';
    if (!attrs.target) attrs.target = '_blank';
    const inner = Array.from(node.childNodes).map(serializeInline).join('');
    return `<a ${attrsToString(attrs)}>${inner}</a>`;
  }

  // allow classic inline tags + span with limited styles
  if (INLINE_ALLOWED_TAGS.has(tag)) {
    const attrs = keepAttrs(node, [
      'style',
      'data-comment-id',
      'data-suggestededit-id',
      'data-reference-id',
      'data-locked',
      'data-locked-by',
      'data-locked-by-email',
      'data-creator-role',
      'data-edit-id',
      'data-backspace-strike-id',
      'data-user-email',
      'data-owner-id', // Preserving owner ID
      'data-strike-created-by-id',
      'data-strike-created-by-email',
      'data-doc-id',
      'data-doc-title',
      'data-type',
      'contenteditable',
      'class',
      'title',
      'start'
    ]);
    const inner = Array.from(node.childNodes).map(serializeInline).join('');
    const outTag = promoteCssSubSuperTag(tag, node, attrs);
    return `<${outTag}${Object.keys(attrs).length ? ' ' + attrsToString(attrs) : ''}>${inner}</${outTag}>`;
  }

  // If someone pasted block content inside a span, just serialize children
  return Array.from(node.childNodes).map(serializeInline).join('');
}

/** Removes MS Office / Google Docs noise but keeps user-visible HTML */
function stripOfficeCruft(container) {
  // 1) Remove HTML comments
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const comments = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) comments.push(n);
  comments.forEach(n => n.parentNode && n.parentNode.removeChild(n));

  // 2) Remove obvious non-content tags inside the pasted fragment
  container.querySelectorAll('style, script, noscript, meta, link').forEach(n => n.remove());

  // 3) Clean MS Office / Google Docs extras without invalid selectors
  const toRemove = [];
  container.querySelectorAll('*').forEach(el => {
    const tag = (el.tagName || '').toLowerCase();

    // MSO/Word puts namespaced tags like 'o:p', 'v:shape', 'w:sdt', etc.
    if (tag.includes(':')) {
      if (tag === 'o:p') {
        // Preserve spacing where <o:p> was used
        el.replaceWith(document.createTextNode('\u00A0'));
      } else {
        toRemove.push(el); // drop other namespaced elements
      }
      return;
    }

    // Remove mso-* inline styles
    if (el.style) {
      if (typeof el.style[Symbol.iterator] === 'function') {
        [...el.style].forEach(p => {
          if (p && p.toLowerCase().startsWith('mso-')) el.style.removeProperty(p);
        });
      } else if (typeof el.style.length === 'number') {
        for (let i = el.style.length - 1; i >= 0; i--) {
          const p = el.style[i];
          if (p && p.toLowerCase().startsWith('mso-')) el.style.removeProperty(p);
        }
      }
    }

    // Remove noisy attributes
    [...el.attributes].forEach(a => {
      const name = a.name.toLowerCase();
      if ((name.startsWith('data-') && 
           name !== 'data-page-break' &&
           name !== 'data-block-id' &&
           name !== 'data-locked' && 
           name !== 'data-comment-id' && 
           name !== 'data-suggestededit-id' && 
           name !== 'data-reference-id' &&
           name !== 'data-doc-id' &&
           name !== 'data-doc-title' &&
           name !== 'data-align' && 
           name !== 'data-language' && 
           name !== 'data-type' &&
           name !== 'data-options' &&
           name !== 'data-backspace-strike-id' &&
           name !== 'data-user-email' &&
           name !== 'data-owner-id' &&
           name !== 'data-strike-created-by-id' &&
           name !== 'data-strike-created-by-email') || name.startsWith('xmlns:')) {
        el.removeAttribute(a.name);
      }
    });
  });
  toRemove.forEach(el => el.remove());
}

/** Normalizes whitespace in PRE while keeping newlines/tabs */
function getPreText(node) {
  let text = '';
  node.childNodes.forEach(ch => {
    if (ch.nodeType === Node.TEXT_NODE) text += ch.nodeValue || '';
    else if (ch.nodeType === Node.ELEMENT_NODE && ch.tagName.toLowerCase() === 'br') text += '\n';
    else text += getPreText(ch);
  });
  return text.replace(/\r\n/g, '\n');
}

export class HTMLToBlocksParser {
  constructor(documentEngine) {
    this.documentEngine = documentEngine;
  }

  parseHTML(htmlContent) {
    if (typeof htmlContent === 'string') {
      const trimmed = htmlContent.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          let parsed = JSON.parse(trimmed);
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (_) {}
          }
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.content) {
            let inner = parsed.content;
            if (typeof inner === 'string') {
              try { inner = JSON.parse(inner); } catch (_) {}
            }
            if (Array.isArray(inner)) parsed = inner;
          }
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
            return parsed.map(b => ({
              id: b.id || uuidv4(),
              type: b.type || BLOCK_TYPES.PARAGRAPH,
              content: typeof b.content === 'object' ? b.content : String(b.content || ''),
              metadata: b.metadata || {}
            }));
          }
        } catch (e) {}
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Sanitize/normalize the doc body before walking
    stripOfficeCruft(doc.body);

    const out = [];
    this.extractBlocksFromChildren(doc.body.childNodes, out);
    return out;
  }

  isPhrasingNode(node) {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) return true;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = node.tagName.toLowerCase();
    if (!PHRASING_TAGS.has(tag)) return false;
    return !Array.from(node.children || []).some(ch => this.isBlockTag(ch.tagName.toLowerCase()));
  }

  flushInlineBuffer(buffer, out) {
    if (!buffer.length) return;
    while (buffer.length && buffer[0].nodeType === Node.TEXT_NODE && !(buffer[0].nodeValue || '').trim()) {
      buffer.shift();
    }
    while (buffer.length && buffer[buffer.length - 1].nodeType === Node.TEXT_NODE && !(buffer[buffer.length - 1].nodeValue || '').trim()) {
      buffer.pop();
    }
    if (!buffer.length) return;
    const hasVisibleText = buffer.some(n => {
      if (n.nodeType === Node.TEXT_NODE) return !!(n.nodeValue || '').replace(/[\s\u200B\u200C\u200D\uFEFF]/g, '');
      if (n.nodeType === Node.ELEMENT_NODE && (n.tagName.toLowerCase() === 'br' || n.tagName.toLowerCase() === 'wbr')) {
        return false;
      }
      const text = (n.textContent || '').replace(/[\s\u200B\u200C\u200D\uFEFF]/g, '');
      return text.length > 0 || /<(img|table|video|iframe|canvas|svg|hr)\b/i.test(serializeInline(n));
    });
    if (hasVisibleText) {
      const html = buffer.map(serializeInline).join('');
      out.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, html));
    }
    buffer.length = 0;
  }

  /**
   * Walk siblings as a stream: consecutive text + inline tags become one paragraph.
   * This is what makes H<sub>2</sub>O paste as one line instead of H / 2 / O.
   */
  extractBlocksFromChildren(childNodes, out = []) {
    const inlineBuffer = [];
    Array.from(childNodes || []).forEach(ch => {
      if (this.isPhrasingNode(ch)) {
        inlineBuffer.push(ch);
        return;
      }
      this.flushInlineBuffer(inlineBuffer, out);
      this.extractBlocksFromNode(ch, out);
    });
    this.flushInlineBuffer(inlineBuffer, out);
    return out;
  }

  extractBlocksFromNode(node, out = []) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.nodeValue || '').trim();
      if (t) out.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, escapeText(t)));
      return out;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return out;

    const tag = node.tagName.toLowerCase();

    // Block types: Page Break
    const isPageBreak = (
      node.classList?.contains('page-break-marker') ||
      node.hasAttribute('data-page-break') ||
      (tag === 'div' && node.getAttribute('data-page-break') === 'true')
    );
    if (isPageBreak) {
      const block = this.documentEngine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
      const blockId = node.getAttribute('data-block-id');
      if (blockId) block.id = blockId;
      out.push(block);
      return out;
    }

    // Block types (explicit)
    if (/^h[1-6]$/.test(tag)) {
      const meta = { level: parseInt(tag[1], 10) };
      const align = readStoredAlign(node);
      if (align) meta.align = align;
      const b = this.documentEngine.createBlock(
        BLOCK_TYPES.HEADING,
        serializeInline(node),
        meta
      );
      const blockId = node.getAttribute('data-block-id');
      if (blockId) b.id = blockId;
      out.push(b);
      return out;
    }

    if (tag === 'p') {
      const content = serializeInline(node);
      const align = readStoredAlign(node);
      const meta = {};
      if (align) meta.align = align;
      // Preserve empty paragraphs as empty blocks (important for line spacing and empty pages)
      const b = this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, content || '', meta);
      const blockId = node.getAttribute('data-block-id');
      if (blockId) b.id = blockId;
      out.push(b);
      return out;
    }

    if (tag === 'div' || tag === 'section' || tag === 'article') {
      // Wrapper: if only inline children, treat as paragraph; else recurse
      const hasBlockChild = Array.from(node.children).some(ch => this.isBlockTag(ch.tagName.toLowerCase()));
      if (!hasBlockChild) {
        const content = serializeInline(node);
        const hasMedia = /<(img|table|video|iframe|canvas|svg|hr)\b/i.test(content);
        const text = content.replace(/<[^>]*>/g, '').replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0&nbsp;]/g, '');
        // Only create paragraph if there is actual text or media content
        if (text || hasMedia) {
          out.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, content || ''));
        }
      } else {
        this.extractBlocksFromChildren(node.childNodes, out);
      }
      return out;
    }

    if (tag === 'blockquote' || tag === 'q') {
      const content = serializeInline(node);
      const meta = {};
      const align = readStoredAlign(node);
      if (align) meta.align = align;
      out.push(this.documentEngine.createBlock(BLOCK_TYPES.QUOTE, content, meta));
      return out;
    }

    if (tag === 'pre' || tag === 'code') {
      const text = tag === 'pre' ? getPreText(node) : node.textContent || '';
      // language hints (e.g. <pre class="language-js">)
      const cls = (node.getAttribute('class') || '').toLowerCase();
      const lang =
        (node.getAttribute('data-language') || '').toLowerCase() ||
        (cls.match(/language-([a-z0-9+#-]+)/) || [])[1] ||
        (cls.match(/lang-([a-z0-9+#-]+)/) || [])[1] ||
        null;
      out.push(this.documentEngine.createBlock(BLOCK_TYPES.CODE, text, { language: lang || undefined }));
      return out;
    }

    if (tag === 'hr') {
      out.push(this.documentEngine.createBlock(BLOCK_TYPES.DIVIDER));
      return out;
    }

    if (tag === 'video' || tag === 'iframe' || (tag === 'figure' && (node.classList?.contains('video-block') || node.getAttribute('data-type') === 'video' || node.querySelector('video, iframe')))) {
      const block = this.processVideo(node);
      if (block) out.push(block);
      return out;
    }

    if (tag === 'img' || tag === 'figure') {
      const block = this.processImage(node);
      if (block) out.push(block);
      return out;
    }

    if (tag === 'ul' || tag === 'ol') {
      out.push(this.listToBlock(node));
      return out;
    }

    if (tag === 'table') {
      out.push(this.tableToBlock(node));
      return out;
    }

    if (tag === 'br') {
      // Improved BR handling: instead of always creating a new paragraph block,
      // check if we can append it to the last block if it's a paragraph.
      const lastBlock = out[out.length - 1];
      if (lastBlock && lastBlock.type === BLOCK_TYPES.PARAGRAPH) {
        // If it's a lone BR following a paragraph, it's effectively a line break inside.
        if (lastBlock.content === '') {
          lastBlock.content = '<br>';
        } else {
          lastBlock.content += '<br>';
        }
      } else {
        // Lonely BR at the start or after a non-paragraph: create a paragraph
        out.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, ''));
      }
      return out;
    }

    // Inline/phrasing wrappers (Wikipedia chemf span, <sub>, Word CSS subscripts)
    if (PHRASING_TAGS.has(tag)) {
      const hasBlockChild = Array.from(node.children).some(ch => this.isBlockTag(ch.tagName.toLowerCase()));
      if (!hasBlockChild) {
        const content = serializeInline(node);
        const hasMedia = /<(img|table|video|iframe|canvas|svg|hr)\b/i.test(content);
        const text = content.replace(/<[^>]*>/g, '').replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0&nbsp;]/g, '');
        if (text || hasMedia) {
          out.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, content || ''));
        }
        return out;
      }
    }

    // Fallback: recurse, but keep adjacent inline nodes in one paragraph
    this.extractBlocksFromChildren(node.childNodes, out);
    return out;
  }

  isBlockTag(tag) {
    return (
      /^h[1-6]$/.test(tag) ||
      ['p','div','section','article','blockquote','pre','code','ul','ol','table','hr','figure'].includes(tag)
    );
  }

  processVideo(element) {
    const videoEl = element.querySelector?.('video') || (element.tagName?.toLowerCase() === 'video' ? element : null);
    const iframeEl = element.querySelector?.('iframe') || (element.tagName?.toLowerCase() === 'iframe' ? element : null);

    let url = '';
    let type = 'direct';
    let embedUrl = '';

    if (iframeEl) {
      type = 'youtube';
      embedUrl = iframeEl.getAttribute('src') || iframeEl.src || '';
      url = embedUrl;
    } else if (videoEl) {
      type = 'direct';
      url = videoEl.getAttribute('src') || videoEl.src || '';
      embedUrl = url;
    }

    if (!url && !embedUrl) return null;

    const width = parseInt(element.style?.width, 10) || parseInt(element.getAttribute?.('width'), 10) || null;
    const height = parseInt(element.style?.height, 10) || parseInt(element.getAttribute?.('height'), 10) || null;
    const align = element.getAttribute?.('data-align') || 'center';

    const videoData = {
      url,
      type,
      embedUrl,
      width,
      height,
      align
    };

    return this.documentEngine.createBlock(BLOCK_TYPES.VIDEO, JSON.stringify(videoData), {
      align,
      videoType: type,
      embedUrl,
      width,
      height
    });
  }

  processImage(element) {
    if (element.tagName.toLowerCase() === 'figure') {
      if (element.classList?.contains('video-block') || element.getAttribute('data-type') === 'video' || element.querySelector('video, iframe')) {
        return null;
      }
      const img = element.querySelector('img');
      if (!img) return null;
      const caption = element.querySelector('figcaption')?.textContent?.trim() || null;
      const align = element.getAttribute('data-align') || null;
      const base = this.imageBlockFromImg(img);
      if (caption) base.metadata.caption = caption;
      // Store alignment inside the JSON content so it survives round-trips
      if (align) {
        try {
          const data = JSON.parse(base.content || '{}');
          data.align = align;
          base.content = JSON.stringify(data);
        } catch (e) {
          // content is raw src string — convert to JSON format
          base.content = JSON.stringify({
            src: base.content,
            width: base.metadata?.width || 0,
            height: base.metadata?.height || 0,
            alt: base.metadata?.alt || '',
            align
          });
        }
      }
      return base;
    }
    return this.imageBlockFromImg(element);
  }

  imageBlockFromImg(img) {
    const src = img.getAttribute('src') || '';
    if (!src) return null;
    const alt = img.getAttribute('alt') || '';
    const width = parseInt(img.getAttribute('width'), 10) || parseInt(img.style.width, 10) || (img.width > 0 ? img.width : null);
    const height = parseInt(img.getAttribute('height'), 10) || parseInt(img.style.height, 10) || (img.height > 0 ? img.height : null);
    const align = img.getAttribute('data-align') || img.dataset?.align || img.style?.float || 'left';
    
    const isDataUrl = /^data:/i.test(src);
    const meta = {
      type: isDataUrl ? 'data' : 'external',
      alt, width, height,
      align
    };

    const imageData = { src, width, height, alt, align };
    return this.documentEngine.createBlock(BLOCK_TYPES.IMAGE, JSON.stringify(imageData), meta);
  }

  listToBlock(listEl) {
    const isOrdered = listEl.tagName.toLowerCase() === 'ol';
    const items = [];
    Array.from(listEl.children).forEach(ch => {
      const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      if (tag === 'ol' || tag === 'ul') {
        const serialized = serializeInline(ch);
        if (items.length > 0) {
          items[items.length - 1] += serialized;
        } else {
          items.push(serialized);
        }
      } else {
        const itemHtml = Array.from(ch.childNodes).map(serializeInline).join('');
        items.push(itemHtml);
      }
    });

    const metadata = { listType: isOrdered ? 'numbered' : 'bulleted' };
    if (listEl.hasAttribute('start')) {
      metadata.start = parseInt(listEl.getAttribute('start'), 10) || 1;
    }
    const listAlign = readStoredAlign(listEl);
    if (listAlign) metadata.align = listAlign;
    const itemAligns = Array.from(listEl.children).map((ch) => {
      const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      if (tag === 'li') return readStoredAlign(ch) || null;
      return null;
    });
    if (itemAligns.some(Boolean)) metadata.itemAligns = itemAligns;

    return this.documentEngine.createBlock(
      BLOCK_TYPES.LIST,
      items,
      metadata
    );
  }

  tableToBlock(table) {
    const headers = [];
    const rows = [];
    const meta = { cell: [] };

    const caption = table.querySelector(':scope > caption')?.textContent?.trim();
    if (caption) meta.caption = caption;

    // Collect header cells either from THEAD or first TR of TBODY/TRs composed of THs
    const theadRow =
      table.querySelector(':scope > thead > tr') ||
      (() => {
        const first = table.querySelector(':scope > tbody > tr') || table.querySelector(':scope > tr');
        if (!first) return null;
        const allTh = Array.from(first.children).every(c => c.tagName.toLowerCase() === 'th');
        return allTh ? first : null;
      })();

    const cellContent = (cellEl) => {
      const select = cellEl.querySelector('select.cell-dropdown');
      if (select) {
        return select.value;
      }
      return serializeInline(cellEl);
    };

    if (theadRow) {
      const ths = Array.from(theadRow.children);
      headers.push(...ths.map(th => cellContent(th)));
      meta.cell.push(ths.map(th => this.cellMeta(th)));
    }

    // Gather body rows
    const bodyRows = [];
    const bodies = table.querySelectorAll(':scope > tbody');
    if (bodies.length) bodies.forEach(b => bodyRows.push(...b.querySelectorAll(':scope > tr')));
    else bodyRows.push(...table.querySelectorAll(':scope > tr'));

    const rowHeights = [];
    bodyRows.forEach(tr => {
      // Skip the THEAD row we already copied (if it sits in TBODY)
      if (tr === theadRow) return;
      const cells = Array.from(tr.children);
      rows.push(cells.map(td => cellContent(td)));
      meta.cell.push(cells.map(td => this.cellMeta(td)));
      
      const h = tr.style?.height || tr.style?.minHeight || tr.getAttribute('height') || null;
      rowHeights.push(h);
    });
    meta.rowHeights = rowHeights;

    // Column widths (if present)
    const colEls = table.querySelectorAll(':scope > colgroup > col');
    if (colEls.length) {
      meta.columnWidths = Array.from(colEls).map(c => c.style?.width || c.getAttribute('width') || null);
    }

    return this.documentEngine.createBlock(
      BLOCK_TYPES.TABLE,
      { headers, rows, meta }
    );
  }

  cellMeta(cellEl) {
    const tag = cellEl.tagName.toLowerCase();
    const align = readStoredAlign(cellEl);
    const valign = cellEl.getAttribute('valign') || cellEl.style?.verticalAlign || null;
    const colspan = parseInt(cellEl.getAttribute('colspan') || '1', 10);
    const rowspan = parseInt(cellEl.getAttribute('rowspan') || '1', 10);
    const styles = keepAttrs(cellEl, ['style']).style || null;
    
    const type = cellEl.getAttribute('data-type') || null;
    let options = null;
    if (type === 'dropdown') {
      try {
        options = JSON.parse(cellEl.getAttribute('data-options'));
      } catch (e) {
        console.error('Error parsing data-options in HTMLToBlocksParser.cellMeta:', e);
      }
    }

    return {
      th: tag === 'th',
      align,
      valign,
      colspan,
      rowspan,
      style: styles,
      ...(type ? { type } : {}),
      ...(options ? { options } : {})
    };
  }
}

/**
 * Wraps text content inside an HTML fragment with reviewer attribution spans
 * so that pasted content receives the current reviewer's underline in documentEngine.
 */
export function wrapHtmlWithReviewerUnderline(html, reviewerInfo) {
  if (!html || typeof html !== 'string' || !html.trim()) return html;
  if (!reviewerInfo) return html;

  const {
    email = 'Unknown',
    userId = '',
    targetClass = 'reviewer-edit',
    creatorRole = 'reviewer',
    underlineColor = '#4dabf7'
  } = reviewerInfo;

  const palette = [
    "#ff6b6b", "#4dabf7", "#51cf66", "#f59f00",
    "#845ef7", "#20c997", "#e64980", "#228be6"
  ];
  let calculatedColor = '#4dabf7';
  const key = String(email || userId || '').trim().toLowerCase();
  if (key && key !== 'unknown') {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    calculatedColor = palette[Math.abs(hash) % palette.length];
  }
  const color = underlineColor || calculatedColor;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

    // Update any existing review/admin spans to current reviewer
    const existingSpans = doc.querySelectorAll('.admin-edit, .reviewer-edit');
    existingSpans.forEach(span => {
      span.className = targetClass;
      if (email && email !== 'Unknown') {
        span.setAttribute('data-user-email', email);
        span.title = `Edited by: ${email}`;
      }
      if (userId) span.setAttribute('data-owner-id', String(userId));
      span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
      span.setAttribute('data-creator-role', creatorRole);
      span.style.setProperty('text-decoration-line', 'underline');
      span.style.setProperty('text-decoration-thickness', '2px');
      span.style.setProperty('text-decoration-color', color, 'important');
      span.style.setProperty('-webkit-text-decoration-color', color, 'important');
    });

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node = walker.nextNode();
    while (node) {
      const raw = node.textContent || '';
      const normalized = raw.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim();
      if (normalized.length > 0) {
        const parent = node.parentElement;
        if (parent) {
          const isOwned = parent.closest('.admin-edit, .reviewer-edit, [data-backspace-strike-id], .backspace-strike-text');
          const isLocked = parent.closest('[data-locked="true"], .locked-text, .locked, [contenteditable="false"]');
          const isControl = parent.closest('select, button, script, style');
          if (!isOwned && !isLocked && !isControl) {
            textNodes.push(node);
          }
        }
      }
      node = walker.nextNode();
    }

    textNodes.forEach((tn) => {
      const span = doc.createElement('span');
      span.className = targetClass;
      if (email && email !== 'Unknown') span.setAttribute('data-user-email', email);
      if (userId) span.setAttribute('data-owner-id', String(userId));
      span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
      span.setAttribute('data-creator-role', creatorRole);
      if (email && email !== 'Unknown') span.title = `Edited by: ${email}`;

      span.style.setProperty('text-decoration-line', 'underline');
      span.style.setProperty('text-decoration-thickness', '2px');
      span.style.setProperty('text-decoration-color', color, 'important');
      span.style.setProperty('-webkit-text-decoration-color', color, 'important');

      span.textContent = tn.textContent;
      if (tn.parentNode) {
        tn.parentNode.replaceChild(span, tn);
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.error('Error wrapping pasted HTML with reviewer underline:', e);
    return html;
  }
}

/**
 * Paste Handler
 */
export class PasteHandler {
  constructor(documentEngine, userId = '', userEmail = '', reviewerInfo = null) {
    this.documentEngine = documentEngine;
    this.userId = userId;
    this.userEmail = userEmail;
    this.reviewerInfo = reviewerInfo;
    this.parser = new HTMLToBlocksParser(documentEngine);
  }

  setReviewerInfo(reviewerInfo) {
    this.reviewerInfo = reviewerInfo;
  }

  applyReviewerUnderlineToBlocks(blocks, reviewerInfo) {
    if (!blocks || !reviewerInfo) return;
    blocks.forEach(b => {
      if (!b) return;
      if (b.type === BLOCK_TYPES.PARAGRAPH || b.type === BLOCK_TYPES.HEADING || b.type === BLOCK_TYPES.QUOTE) {
        b.content = wrapHtmlWithReviewerUnderline(b.content, reviewerInfo);
      } else if (b.type === BLOCK_TYPES.LIST && Array.isArray(b.content)) {
        b.content = b.content.map(item => wrapHtmlWithReviewerUnderline(item, reviewerInfo));
      } else if (b.type === BLOCK_TYPES.TABLE && b.content) {
        if (Array.isArray(b.content.headers)) {
          b.content.headers = b.content.headers.map(h => wrapHtmlWithReviewerUnderline(h, reviewerInfo));
        }
        if (Array.isArray(b.content.rows)) {
          b.content.rows = b.content.rows.map(row => 
            Array.isArray(row) ? row.map(cell => wrapHtmlWithReviewerUnderline(cell, reviewerInfo)) : row
          );
        }
      }
    });
  }

  async handlePaste(event, editorElement, options = {}) {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    const reviewerInfo = options.reviewerInfo || this.reviewerInfo || null;

    const cb = event?.clipboardData || window.clipboardData;
    let htmlData = options.htmlData !== undefined ? options.htmlData : (cb?.getData?.('text/html') || '');
    let textData = options.textData !== undefined ? options.textData : (cb?.getData?.('text/plain') || '');

    if (options.plainTextOnly) {
      // Force plain text: strip all HTML markup, headings, tables, etc.
      htmlData = '';
      if (!textData && options.text) {
        textData = options.text;
      }
    }

    if (!htmlData?.trim() && !textData?.trim()) return false;

    // Check if selection is currently inside a table cell (td or th)
    const selection = window.getSelection();
    let targetCell = null;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      targetCell = node?.closest?.('td, th');
    }

    if (targetCell) {
      this.pasteIntoCell(targetCell, htmlData, textData, selection, reviewerInfo);
      return true;
    }

    let blocks = [];

    if (options.plainTextOnly) {
      return this.insertPlainTextAtSelection(textData, editorElement, reviewerInfo);
    }

    if (htmlData && htmlData.trim()) {
      blocks = await this.parseHTMLContent(htmlData);
    } else if (textData && textData.trim()) {
      blocks = this.parseTextToBlocks(textData);
    }

    if (blocks.length === 0) return false;

    if (reviewerInfo) {
      this.applyReviewerUnderlineToBlocks(blocks, reviewerInfo);
    }

    const single = blocks[0];
    const canInsertInline =
      blocks.length === 1 &&
      single?.type === BLOCK_TYPES.PARAGRAPH &&
      !/<(table|ul|ol|img|video|iframe|hr)\b/i.test(String(single.content || ''));

    if (canInsertInline && this.insertInlineHtmlAtSelection(single.content, editorElement, reviewerInfo)) {
      return true;
    }

    this.insertBlocks(blocks, editorElement, reviewerInfo);
    return true;
  }

  /**
   * Insert pure unformatted plain text right at current selection/caret.
   * Completely strips any HTML tags, styles, headings, tables, or markdown.
   */
  insertPlainTextAtSelection(text, editorElement, reviewerInfo = null) {
    if (!text && text !== '') return false;

    // Thoroughly strip any HTML markup that might have been copied as text
    let raw = String(text);
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');
      raw = doc.body.textContent || '';
    }

    // Strip markdown syntax so ** bold **, * italic *, __ __, _ _, and # headings
    // are not rendered as literal characters in "paste without formatting" mode.
    raw = raw
      // Bold+italic: ***text*** or ___text___
      .replace(/\*{3}([^*]*)\*{3}/g, '$1')
      .replace(/_{3}([^_]*)_{3}/g, '$1')
      // Bold: **text** or __text__
      .replace(/\*{2}([^*]*)\*{2}/g, '$1')
      .replace(/_{2}([^_]*)_{2}/g, '$1')
      // Italic: *text* or _text_
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/_([^_\n]+)_/g, '$1')
      // ATX headings: # Heading through ###### Heading (strip the leading #s)
      .replace(/^#{1,6}\s+/gm, '')
      // Inline code: `code`
      .replace(/`([^`\n]+)`/g, '$1')
      // Strikethrough: ~~text~~
      .replace(/~~([^~]*)~~/g, '$1');

    const cleanText = raw.replace(/\r\n/g, '\n');

    // 1. If single line (no newlines) and selection is inside a block, insert text directly via Selection/Range
    const selection = window.getSelection();
    if (!cleanText.includes('\n') && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let insertedNode;

      if (reviewerInfo) {
        const span = document.createElement('span');
        span.className = reviewerInfo.targetClass || 'reviewer-edit';
        if (reviewerInfo.email && reviewerInfo.email !== 'Unknown') span.setAttribute('data-user-email', reviewerInfo.email);
        if (reviewerInfo.userId) span.setAttribute('data-owner-id', String(reviewerInfo.userId));
        span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        span.setAttribute('data-creator-role', reviewerInfo.creatorRole || 'reviewer');
        if (reviewerInfo.email && reviewerInfo.email !== 'Unknown') span.title = `Edited by: ${reviewerInfo.email}`;

        span.style.setProperty('text-decoration-line', 'underline');
        span.style.setProperty('text-decoration-thickness', '2px');
        span.style.setProperty('text-decoration-color', reviewerInfo.underlineColor || '#4dabf7', 'important');
        span.style.setProperty('-webkit-text-decoration-color', reviewerInfo.underlineColor || '#4dabf7', 'important');
        span.textContent = cleanText;
        insertedNode = span;
      } else {
        insertedNode = document.createTextNode(cleanText);
      }

      range.deleteContents();
      const containerEl = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
      const anyAttributionSpan = containerEl?.closest?.('span.admin-edit, span.reviewer-edit, span.author-attribution, span[data-user-email], span[data-owner-id]');
      
      const existingId = anyAttributionSpan?.getAttribute('data-owner-id');
      const existingEmail = anyAttributionSpan?.getAttribute('data-user-email');
      const isSameOwner = anyAttributionSpan && reviewerInfo && (
        (reviewerInfo.userId && existingId === String(reviewerInfo.userId)) ||
        (reviewerInfo.email !== 'Unknown' && existingEmail === reviewerInfo.email)
      );

      if (anyAttributionSpan && !isSameOwner && anyAttributionSpan.parentNode) {
        // Split parent attribution span around insertedNode to prevent nesting
        const parentNode = anyAttributionSpan.parentNode;
        const splitRange = document.createRange();
        splitRange.setStart(range.startContainer, range.startOffset);
        splitRange.setEndAfter(anyAttributionSpan.lastChild || anyAttributionSpan);
        const rightContent = splitRange.extractContents();

        let rightSpan = null;
        if (rightContent.textContent && rightContent.textContent.length > 0) {
          rightSpan = anyAttributionSpan.cloneNode(false);
          rightSpan.appendChild(rightContent);
        }

        const nextSibling = anyAttributionSpan.nextSibling;
        parentNode.insertBefore(insertedNode, nextSibling);
        if (rightSpan) {
          parentNode.insertBefore(rightSpan, insertedNode.nextSibling);
        }

        if (!anyAttributionSpan.textContent || anyAttributionSpan.textContent.length === 0) {
          anyAttributionSpan.remove();
        }
      } else {
        range.insertNode(insertedNode);
      }
      range.setStartAfter(insertedNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Find the enclosing block and sync with DocumentEngine
      let el = insertedNode.parentElement;
      while (el && !el.dataset?.blockId && el !== editorElement) {
        el = el.parentElement;
      }
      if (el?.dataset?.blockId) {
        const blk = this.documentEngine.getBlock(el.dataset.blockId);
        if (blk && blk.type === BLOCK_TYPES.PARAGRAPH) {
          blk.content = el.innerHTML || el.textContent || '';
        }
        this._lastInsertedBlockId = el.dataset.blockId;
      }
      return true;
    }

    // 2. Multi-line plain text: create completely pure paragraph blocks
    const lines = cleanText.split('\n');
    const blocks = lines.map(l => 
      this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, escapeText(l) || '')
    );
    const sanitized = this.sanitizePastedBlocks(blocks);
    if (sanitized.length === 0) return false;

    if (reviewerInfo) {
      this.applyReviewerUnderlineToBlocks(sanitized, reviewerInfo);
    }

    this.insertBlocks(sanitized, editorElement, reviewerInfo);
    return true;
  }

  /**
   * Insert a single inline HTML run (e.g. H<sub>2</sub>O) at the caret so it
   * stays in the current line instead of becoming extra paragraph blocks.
   */
  insertInlineHtmlAtSelection(html, editorElement, reviewerInfo = null) {
    if (html == null || String(html).trim() === '') return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    let startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    if (!startEl) return false;
    if (editorElement && !editorElement.contains(startEl)) return false;

    let el = startEl;
    while (el && !el.dataset?.blockId && el !== editorElement) {
      el = el.parentElement;
    }
    if (!el?.dataset?.blockId) return false;

    const blk = this.documentEngine.getBlock(el.dataset.blockId);
    if (!blk || (
      blk.type !== BLOCK_TYPES.PARAGRAPH &&
      blk.type !== BLOCK_TYPES.HEADING &&
      blk.type !== BLOCK_TYPES.QUOTE
    )) {
      return false;
    }

    const temp = document.createElement('span');
    temp.innerHTML = html;
    if (!temp.childNodes.length) return false;

    const fragment = document.createDocumentFragment();
    let lastNode = null;
    while (temp.firstChild) {
      lastNode = fragment.appendChild(temp.firstChild);
    }

    range.deleteContents();
    range.insertNode(fragment);

    if (lastNode) {
      const after = document.createRange();
      after.setStartAfter(lastNode);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }

    blk.content = el.innerHTML || el.textContent || '';
    if (reviewerInfo) {
      if (!blk.metadata) blk.metadata = {};
      if (reviewerInfo.userId) blk.metadata.ownerId = reviewerInfo.userId;
      if (reviewerInfo.email) blk.metadata.userEmail = reviewerInfo.email;
    }
    this._lastInsertedBlockId = el.dataset.blockId;
    return true;
  }

  /**
   * Pure plain-text → paragraph blocks without tables, headings, or markdown conversions.
   * Completely strips any formatting.
   */
  parsePlainTextToParagraphBlocks(text) {
    const rawLines = text.replace(/\r\n/g, '\n').split('\n');
    const blocks = rawLines.map(line => 
      this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, escapeText(line) || '')
    );
    return this.sanitizePastedBlocks(blocks);
  }

  pasteIntoCell(targetCell, htmlData, textData, selection, reviewerInfo = null) {
    // 1) Reset lastInsertedBlockId so cursor positioning doesn't pull selection out of the cell
    this._lastInsertedBlockId = null;

    // 2) Handle dropdown cells
    const select = targetCell.querySelector('select.cell-dropdown');
    if (select || targetCell.getAttribute('data-type') === 'dropdown') {
      const val = (textData || '').trim();
      if (select && val) {
        const matchingOption = Array.from(select.options).find(opt => opt.value.toLowerCase() === val.toLowerCase());
        if (matchingOption) {
          select.value = matchingOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      this.syncTableBlockFromCell(targetCell);
      return;
    }

    // 3) Construct cell HTML
    let cellHtml = '';
    if (htmlData && htmlData.trim()) {
      cellHtml = this.parseHTMLForCell(htmlData);
    }
    
    if (!cellHtml && textData) {
      cellHtml = escapeText(textData.trim()).replace(/\r\n|\n/g, '<br>');
    }

    if (!cellHtml) return;

    if (reviewerInfo) {
      cellHtml = wrapHtmlWithReviewerUnderline(cellHtml, reviewerInfo);
    }

    // 4) Insert content into DOM range inside targetCell
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range) {
      if (!targetCell.contains(range.startContainer)) {
        range.selectNodeContents(targetCell);
        range.collapse(false);
      }

      range.deleteContents();

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cellHtml;

      const fragment = document.createDocumentFragment();
      let node;
      let lastNode = null;
      while ((node = tempDiv.firstChild)) {
        lastNode = fragment.appendChild(node);
      }

      if (lastNode) {
        range.insertNode(fragment);

        const newRange = document.createRange();
        if (lastNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(lastNode, lastNode.textContent.length);
        } else {
          newRange.setStartAfter(lastNode);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      targetCell.innerHTML += cellHtml;
    }

    // 5) Sync updated table content back to DocumentEngine block state
    this.syncTableBlockFromCell(targetCell);
  }

  parseHTMLForCell(htmlData) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlData, 'text/html');
    stripOfficeCruft(doc.body);

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return escapeText(node.nodeValue || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      if (tag === 'br' || tag === 'wbr') return `<${tag}>`;

      if (tag === 'table' || tag === 'tbody' || tag === 'thead') {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length) {
          return rows.map(tr => {
            return Array.from(tr.children).map(td => Array.from(td.childNodes).map(processNode).join('')).join(' &nbsp; ');
          }).filter(r => r.trim()).join('<br>');
        }
      }

      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'blockquote' || /^h[1-6]$/.test(tag) || tag === 'li') {
        const inner = Array.from(node.childNodes).map(processNode).join('');
        return inner;
      }

      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.children).map(li => processNode(li)).filter(it => it.trim());
        return items.join('<br>');
      }

      return serializeInline(node);
    };

    const parts = [];
    let inlineRun = '';
    const flushInlineRun = () => {
      if (inlineRun) {
        parts.push(inlineRun);
        inlineRun = '';
      }
    };

    Array.from(doc.body.childNodes).forEach(node => {
      // Ignore top-level whitespace text nodes (e.g. newlines surrounding block tags in HTML)
      if (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()) {
        return;
      }
      const p = processNode(node);
      if (!p || !String(p).trim()) return;

      if (this.parser?.isPhrasingNode?.(node) || node.nodeType === Node.TEXT_NODE) {
        inlineRun += p;
        return;
      }
      flushInlineRun();
      parts.push(p);
    });
    flushInlineRun();

    let result = parts.join('<br>');
    // Clean up any leading/trailing <br> tags or whitespace
    return result.replace(/^(<br\s*\/?>|\s)+/gi, '').replace(/(<br\s*\/?>|\s)+$/gi, '');
  }

  syncTableBlockFromCell(targetCell) {
    const tableEl = targetCell.closest('table');
    if (tableEl && this.documentEngine) {
      const blockId = tableEl.getAttribute('data-block-id');
      if (blockId) {
        const block = this.documentEngine.getBlock(blockId);
        if (block) {
          const updatedContent = BlockContentExtractor.extractTableContent(tableEl);
          block.content = updatedContent;
          if (!block.metadata) block.metadata = {};
          block.metadata.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  async parseHTMLContent(htmlData) {
    const blocks = this.parser.parseHTML(htmlData);
    const processed = [];

    for (const block of blocks) {
      if (!block) continue;
      if (block.type === BLOCK_TYPES.IMAGE) {
        processed.push(await this.processImageBlock(block));
      } else {
        processed.push(block);
      }
    }
    
    // Sanitize the resulting blocks to remove noise and artificial gaps
    return this.sanitizePastedBlocks(processed);
  }

  /**
   * Cleans up pasted blocks:
   * 1. Removes leading and trailing empty paragraphs
   * 2. Collapses consecutive empty paragraphs into a single one
   * 3. Normalizes whitespace-only paragraphs
   */
  sanitizePastedBlocks(blocks) {
    if (!blocks || blocks.length === 0) return [];
    
    const isBlockEmpty = (b) => {
      if (!b) return true;
      if (b.type === BLOCK_TYPES.PARAGRAPH) {
        const raw = String(b.content || '');
        if (/<(img|table|video|iframe|canvas|svg|hr)\b/i.test(raw)) return false;
        const text = raw.replace(/<[^>]*>/g, '').replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0&nbsp;]/g, '');
        return text.length === 0;
      }
      if (b.type === BLOCK_TYPES.LIST) {
        if (!Array.isArray(b.content) || b.content.length === 0) return true;
        return b.content.every(item => {
          const raw = String(item || '');
          if (/<(img|table|video|iframe|canvas|svg)\b/i.test(raw)) return false;
          const text = raw.replace(/<[^>]*>/g, '').replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0&nbsp;]/g, '');
          return text.length === 0;
        });
      }
      return false;
    };

    let processed = [...blocks];
    
    // 1. Remove leading empty paragraphs/blocks
    while (processed.length > 0 && isBlockEmpty(processed[0])) {
      processed.shift();
    }
    
    // 2. Remove trailing empty paragraphs/blocks
    while (processed.length > 0 && isBlockEmpty(processed[processed.length - 1])) {
      processed.pop();
    }
    
    // 3. Collapse consecutive empty paragraphs
    const collapsed = [];
    for (let i = 0; i < processed.length; i++) {
      const current = processed[i];
      const next = processed[i + 1];
      if (isBlockEmpty(current) && next && isBlockEmpty(next)) {
        // Skip this one, it's a duplicate gap
        continue;
      }
      collapsed.push(current);
    }
    return collapsed;
  }

  async processImageBlock(imageBlock) {
    const { content, metadata } = imageBlock;
    if (metadata?.type === 'external') {
      // Mark as loading; your async image loader can later swap in data URLs
      imageBlock.metadata.loading = true;
      imageBlock.metadata.error = null;
      // (Optionally) kick off a background fetch in your app code.
    }
    return imageBlock;
  }

  /** Plain-text → blocks, with TSV + ASCII grid detection */
  parseTextToBlocks(text) {
    // Try TSV (tabs in multiple lines with the same column count)
    // Keep all lines including empty ones to preserve document structure
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const looksLikeTSV = lines.length > 1 && lines.filter(l => l.length).every(l => /\t/.test(l));
    if (looksLikeTSV) {
      const rows = lines.map(l => l.split('\t').map(c => escapeText(c)));
      const headers = rows.shift();
      return [this.documentEngine.createBlock(BLOCK_TYPES.TABLE, { headers, rows, meta: { source: 'tsv' } })];
    }

    // Try ASCII grid tables (e.g., +---+---+ / | a | b |)
    if (this.isAsciiGrid(text)) {
      const { headers, rows } = this.parseAsciiGrid(text);
      return [this.documentEngine.createBlock(BLOCK_TYPES.TABLE, { headers, rows, meta: { source: 'ascii' } })];
    }

    // Markdown-ish headings and blockquotes and code fences
    const blocks = [];
    let inFence = false;
    let fenceLang = null;
    let fenceBuffer = [];

    for (let raw of lines) {
      const line = raw;

      const fence = line.match(/^```(\w+)?\s*$/);
      if (fence) {
        if (!inFence) {
          inFence = true;
          fenceLang = (fence[1] || '').toLowerCase() || null;
          fenceBuffer = [];
        } else {
          blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.CODE, fenceBuffer.join('\n'), { language: fenceLang || undefined }));
          inFence = false; fenceLang = null; fenceBuffer = [];
        }
        continue;
      }
      if (inFence) { fenceBuffer.push(line); continue; }

      if (/^#{1,6}\s+/.test(line)) {
        const level = Math.min(6, line.match(/^#+/)[0].length);
        const content = escapeText(line.replace(/^#{1,6}\s+/, ''));
        blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.HEADING, content, { level }));
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const content = escapeText(line.replace(/^\s*>\s?/, ''));
        blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.QUOTE, content));
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        // simple bullets; we gather consecutive list lines
        const list = [];
        let i = lines.indexOf(raw);
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          list.push(escapeText(lines[i].replace(/^\s*[-*]\s+/, '')));
          i++;
        }
        blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.LIST, list, { listType: 'bulleted' }));
        // skip consumed
        lines.splice(lines.indexOf(raw), list.length - 1);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const list = [];
        let i = lines.indexOf(raw);
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          list.push(escapeText(lines[i].replace(/^\s*\d+\.\s+/, '')));
          i++;
        }
        blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.LIST, list, { listType: 'numbered' }));
        lines.splice(lines.indexOf(raw), list.length - 1);
        continue;
      }

      // All other lines including empty ones become paragraphs (preserves empty lines)
      blocks.push(this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, escapeText(line) || ''));
    }

    // Sanitize plain text blocks too
    return this.sanitizePastedBlocks(blocks);
  }

  isAsciiGrid(text) {
    const lines = text.split('\n').map(l => l.trim());
    const hasBorders = lines.some(l => /^\+[-+]+$/.test(l));
    const hasCells = lines.some(l => /^\|.+\|$/.test(l));
    return hasBorders && hasCells;
  }

  parseAsciiGrid(text) {
    const rows = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^\|.+\|$/.test(line)) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map(c => escapeText(c.trim()));
        rows.push(cells);
      }
    }
    const headers = rows.length ? rows[0] : [];
    return { headers, rows: rows.slice(1) };
  }

  insertBlocks(blocks, editorElement, reviewerInfo = null) {
    const selection = window.getSelection();
    let inserted = false;
    let lastInsertedBlockId = null;

    if (blocks.length > 0 && blocks[blocks.length - 1].type === BLOCK_TYPES.TABLE) {
      const p = this.documentEngine.createBlock(BLOCK_TYPES.PARAGRAPH, "");
      blocks.push(p);
      // If we are appending a paragraph after a table, the cursor should go into the paragraph
      lastInsertedBlockId = p.id;
    }

    let node = null;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      node = range.startContainer;
      while (node && !(node instanceof Element)) node = node.parentElement;
      while (node && !node.dataset?.blockId) node = node.parentElement;

      if (node?.dataset?.blockId) {
        const currentId = node.dataset.blockId;
        const allBlocks = this.documentEngine.getAllBlocks();
        const idx = allBlocks.findIndex(b => b.id === currentId);
        const linear = [...allBlocks];
        blocks.forEach((b, i) => linear.splice(idx + 1 + i, 0, b));
        
        if (!lastInsertedBlockId && blocks.length > 0) {
          lastInsertedBlockId = blocks[blocks.length - 1].id;
        }
        
        this.documentEngine.document.pages = [{ id: 'page1', blocks: linear }];
        inserted = true;
      }
    }

    // Tag all blocks with owner info if provided
    const ownerId = reviewerInfo?.userId || this.userId;
    const userEmail = reviewerInfo?.email || this.userEmail;
    if (ownerId || userEmail) {
      blocks.forEach(b => {
        if (!b.metadata) b.metadata = {};
        if (ownerId) b.metadata.ownerId = ownerId;
        if (userEmail) b.metadata.userEmail = userEmail;
      });
    }

    if (!inserted) {
      const all = this.documentEngine.getAllBlocks();
      this.documentEngine.document.pages = [{ id: 'page1', blocks: [...blocks, ...all] }];
      if (!lastInsertedBlockId && blocks.length > 0) {
        lastInsertedBlockId = blocks[blocks.length - 1].id;
      }
    }

    // Surgical DOM insertion: Create elements for pasted blocks and insert directly into DOM
    // without wiping the entire document innerHTML (which destroys native spell-check squiggles).
    const fragment = document.createDocumentFragment();
    blocks.forEach(b => {
      const html = this.documentEngine.blockToHTML(b);
      const temp = document.createElement('div');
      temp.innerHTML = html;
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
    });

    if (inserted && node && node.parentElement) {
      const nodeText = (node.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF\u00A0\s]/g, '');
      const isNodeEmpty = nodeText.length === 0 && !node.querySelector('img, video, iframe, table');
      if (node.nextSibling) {
        node.parentElement.insertBefore(fragment, node.nextSibling);
      } else {
        node.parentElement.appendChild(fragment);
      }
      if (isNodeEmpty && blocks.length > 0) {
        const emptyBlockId = node.dataset?.blockId;
        node.remove();
        if (emptyBlockId) {
          const allBlocks = this.documentEngine.getAllBlocks().filter(b => b.id !== emptyBlockId);
          this.documentEngine.document.pages = [{ id: 'page1', blocks: allBlocks }];
        }
      }
    } else if (editorElement) {
      editorElement.appendChild(fragment);
    }
    
    // Store the last inserted block ID for cursor positioning after pagination
    this._lastInsertedBlockId = lastInsertedBlockId;
    
    // Don't paginate here - let the Editor handle pagination
    // The Editor will call schedulePaginate after the paste operation
  }

  renderDocument(editorElement) {
    // Paste dumps the full engine HTML into the active page-content. Clear sibling
    // pages first so leftover block IDs don't confuse syncDOMToBlocks / pagination.
    const root =
      editorElement?.closest?.('.document-renderer') ||
      editorElement?.closest?.('.pages-container') ||
      editorElement?.parentElement?.parentElement;
    if (root && editorElement) {
      root.querySelectorAll('.page-content').forEach((pc) => {
        if (pc !== editorElement) {
          pc.innerHTML = '';
        }
      });
    }
    editorElement.innerHTML = this.documentEngine.toHTML();
  }

  getLastInsertedBlockId() {
    return this._lastInsertedBlockId;
  }

  clearLastInsertedBlockId() {
    this._lastInsertedBlockId = null;
  }
}

export class BlockContentExtractor {
  static extractContentFromElement(element, blockType) {
    switch (blockType) {
      case BLOCK_TYPES.LIST:
        return Array.from(element.children).map(li => li.innerHTML);
      case BLOCK_TYPES.TABLE:
        return this.extractTableContent(element);
      default:
        return element.innerHTML;
    }
  }

  static extractTableContent(tableElement) {
    const headers = [];
    const rows = [];
    const meta = { cell: [] };
    const rowHeights = [];

    const _extractCellContent = (cellEl) => {
      const select = cellEl.querySelector('select.cell-dropdown');
      if (select) {
        return select.value;
      }
      return cellEl.innerHTML;
    };

    const thead = tableElement.querySelector('thead');
    if (thead) {
      const tr = thead.querySelector('tr');
      if (tr) {
        const ths = Array.from(tr.children);
        headers.push(...ths.map(th => _extractCellContent(th)));
        meta.cell.push(ths.map(th => {
          const type = th.getAttribute('data-type') || null;
          let options = null;
          if (type === 'dropdown') {
            try { options = JSON.parse(th.getAttribute('data-options')); } catch (e) {}
          }
          return {
            th: true,
            align: th.getAttribute('data-text-align') || th.getAttribute('align') || th.style?.textAlign || null,
            valign: th.getAttribute('valign') || th.style?.verticalAlign || null,
            colspan: parseInt(th.getAttribute('colspan') || '1', 10),
            rowspan: parseInt(th.getAttribute('rowspan') || '1', 10),
            style: th.getAttribute('style') || null,
            ...(type ? { type } : {}),
            ...(options ? { options } : {})
          };
        }));
      }
    }

    const tbody = tableElement.querySelector('tbody') || tableElement;
    tbody.querySelectorAll('tr').forEach(tr => {
      // Skip the THEAD row if it was already processed
      const isHeaderRow = thead && thead.contains(tr);
      if (isHeaderRow) return;

      const cells = Array.from(tr.children);
      rows.push(cells.map(td => _extractCellContent(td)));
      rowHeights.push(tr.style?.height || null);
      meta.cell.push(cells.map(td => {
        const type = td.getAttribute('data-type') || null;
        let options = null;
        if (type === 'dropdown') {
          try { options = JSON.parse(td.getAttribute('data-options')); } catch (e) {}
        }
        return {
          th: td.tagName.toLowerCase() === 'th',
          align: td.getAttribute('data-text-align') || td.getAttribute('align') || td.style?.textAlign || null,
          valign: td.getAttribute('valign') || td.style?.verticalAlign || null,
          colspan: parseInt(td.getAttribute('colspan') || '1', 10),
          rowspan: parseInt(td.getAttribute('rowspan') || '1', 10),
          style: td.getAttribute('style') || null,
          ...(type ? { type } : {}),
          ...(options ? { options } : {})
        };
      }));
    });

    const caption = tableElement.querySelector('caption')?.textContent?.trim();
    const colEls = tableElement.querySelectorAll(':scope > colgroup > col');
    const columnWidths = colEls.length
      ? Array.from(colEls).map((c) => c.getAttribute('width') || c.style?.width || null)
      : [];
    return { headers, rows, meta: { ...meta, caption, rowHeights, columnWidths } };
  }
}

export default PasteHandler;
