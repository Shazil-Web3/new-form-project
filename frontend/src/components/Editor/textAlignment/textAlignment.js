import {
  TEXT_ALIGNMENTS,
  DEFAULT_TEXT_ALIGN,
  DATA_TEXT_ALIGN_ATTR,
  TEXT_ALIGN_BLOCK_TAGS,
  SKIP_ALIGN_WRAPPER_TAGS,
} from './constants';

export {
  TEXT_ALIGNMENTS,
  DEFAULT_TEXT_ALIGN,
  DATA_TEXT_ALIGN_ATTR,
  TEXT_ALIGN_BLOCK_TAGS,
  SKIP_ALIGN_WRAPPER_TAGS,
};

export function normalizeAlign(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'start') return 'left';
  if (v === 'end') return 'right';
  if (v === 'full' || v === 'justifyfull' || v === 'justify-full') return 'justify';
  if (TEXT_ALIGNMENTS.includes(v)) return v;
  return null;
}

export function readStoredAlign(el) {
  if (!el) return null;
  return (
    normalizeAlign(el.getAttribute?.(DATA_TEXT_ALIGN_ATTR)) ||
    normalizeAlign(el.getAttribute?.('align')) ||
    normalizeAlign(el.style?.textAlign) ||
    null
  );
}

export function getAlignFromElement(el) {
  const stored = readStoredAlign(el);
  if (stored) return stored;
  if (el && typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const computed = normalizeAlign(window.getComputedStyle(el).textAlign);
      if (computed) return computed;
    } catch (_) {
      /* ignore */
    }
  }
  return DEFAULT_TEXT_ALIGN;
}

export function writeAlignToElement(el, alignment) {
  const align = normalizeAlign(alignment);
  if (!el || !align) return null;
  if (el.getAttribute(DATA_TEXT_ALIGN_ATTR) !== align) {
    el.setAttribute(DATA_TEXT_ALIGN_ATTR, align);
  }
  if (el.style && el.style.textAlign !== align) {
    el.style.textAlign = align;
  }
  const tag = el.tagName?.toLowerCase();
  if ((tag === 'td' || tag === 'th') && el.getAttribute('align') !== align) {
    el.setAttribute('align', align);
  }
  return align;
}

export function buildAlignAttrs(align, extraStyleDecls = '') {
  const a = normalizeAlign(align);
  let attrs = '';
  if (a) attrs += ` ${DATA_TEXT_ALIGN_ATTR}="${a}"`;
  const styleParts = [];
  if (a) styleParts.push(`text-align:${a}`);
  const extra = String(extraStyleDecls || '').replace(/^style\s*=\s*["']?|["']$/g, '').replace(/;$/, '').trim();
  if (extra) styleParts.push(extra);
  if (styleParts.length) attrs += ` style="${styleParts.join(';')}"`;
  return attrs;
}

export function persistBlockAlign(metadata, el) {
  if (!metadata) return;
  const stored = readStoredAlign(el);
  if (stored) metadata.align = stored;
}

export function resolveInheritedAlign(el, metadata) {
  const stored = readStoredAlign(el) || normalizeAlign(metadata?.align);
  if (stored) return stored;
  if (!el || typeof window === 'undefined' || !window.getComputedStyle) return null;
  try {
    const computed = normalizeAlign(window.getComputedStyle(el).textAlign);
    if (computed && computed !== DEFAULT_TEXT_ALIGN) return computed;
  } catch (_) {
    /* ignore */
  }
  return null;
}

const SKIP_ALIGN_BLOCK_TYPES = new Set(['image', 'video', 'table', 'page-break', 'divider']);

export function applyAlignmentFromBlock(el, block) {
  if (!el || !block) return;
  if (SKIP_ALIGN_BLOCK_TYPES.has(block.type)) return;
  const align = normalizeAlign(block.metadata?.align) || readStoredAlign(el);
  if (align) writeAlignToElement(el, align);
  const isList = block.type === 'list' || el.tagName === 'UL' || el.tagName === 'OL';
  if (!isList) return;
  const itemAligns = Array.isArray(block.metadata?.itemAligns) ? block.metadata.itemAligns : [];
  Array.from(el.children || []).forEach((li, i) => {
    if (li.tagName?.toLowerCase() !== 'li') return;
    const itemAlign = normalizeAlign(itemAligns[i]) || readStoredAlign(li) || align;
    if (itemAlign) writeAlignToElement(li, itemAlign);
  });
}

function rangeIntersects(range, node) {
  if (!range || !node) return false;
  try {
    return range.intersectsNode(node);
  } catch (_) {
    return false;
  }
}

function isPageBreak(el) {
  return Boolean(
    el?.classList?.contains('page-break-marker') || el?.hasAttribute?.('data-page-break')
  );
}

function isSkippedWrapper(el) {
  if (!el) return true;
  const tag = el.tagName?.toLowerCase();
  if (isPageBreak(el) || SKIP_ALIGN_WRAPPER_TAGS.has(tag)) return true;
  if (el.classList?.contains('img-block') || el.classList?.contains('video-block')) return true;
  if (el.getAttribute?.('data-type') === 'image' || el.getAttribute?.('data-type') === 'video') return true;
  return false;
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((n) => {
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

function collectListItemTargets(listEl, range, startEl) {
  const lis = Array.from(listEl.querySelectorAll(':scope > li'));
  if (lis.length === 0) return [];
  if (!range || range.collapsed) {
    const li = startEl?.closest?.('li');
    if (li && listEl.contains(li)) return [li];
    return lis;
  }
  const hit = lis.filter((li) => rangeIntersects(range, li));
  return hit.length ? hit : lis;
}

export function getAlignmentTargets(range) {
  if (!range) return [];
  const startEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  if (!startEl) return [];

  const tableCell = startEl.closest?.('td, th');
  if (tableCell) {
    return [tableCell];
  }

  const startLi = startEl.closest?.('li');
  if (startLi && !startLi.closest('table')) {
    const list = startLi.closest('ul, ol');
    if (list) return collectListItemTargets(list, range, startEl);
    return [startLi];
  }

  const docContainer =
    startEl.closest?.('.document-renderer') ||
    startEl.closest?.('.editor-container') ||
    document;

  const allBlocks = Array.from(
    docContainer.querySelectorAll?.('.page-content [data-block-id]') || []
  ).filter((el) => {
    let parent = el.parentElement;
    while (parent && !parent.classList?.contains('page-content')) {
      if (parent.hasAttribute?.('data-block-id')) return false;
      parent = parent.parentElement;
    }
    return true;
  });

  let selected = [];
  if (range.collapsed) {
    const single = startEl.closest?.('[data-block-id]');
    if (single) selected = [single];
  } else {
    selected = allBlocks.filter((b) => rangeIntersects(range, b));
    if (selected.length === 0) {
      const fallback = startEl.closest?.('[data-block-id]');
      if (fallback) selected = [fallback];
    }
  }

  const targets = [];
  selected.forEach((el) => {
    if (isSkippedWrapper(el)) return;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      collectListItemTargets(el, range, startEl).forEach((li) => targets.push(li));
      return;
    }
    if (TEXT_ALIGN_BLOCK_TAGS.has(tag)) {
      targets.push(el);
    }
  });

  return uniqueNodes(targets);
}

export function applyTextAlignment(alignment, options = {}) {
  const { syncDOMToBlocksSync, schedulePaginate, onAfterAction } = options;
  const align = normalizeAlign(alignment);
  if (!align) return [];
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const targets = getAlignmentTargets(range);
  targets.forEach((el) => writeAlignToElement(el, align));
  syncDOMToBlocksSync?.();
  schedulePaginate?.();
  onAfterAction?.();
  return targets;
}

export function getCaretAlignElement() {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const targets = getAlignmentTargets(range);
  return targets[0] || null;
}
