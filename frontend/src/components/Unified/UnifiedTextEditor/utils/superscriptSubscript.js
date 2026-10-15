/**
 * superscriptSubscript.js
 * Comprehensive Microsoft Word-style Superscript and Subscript formatting logic.
 *
 * Implements:
 * 1. Mutual exclusivity (Superscript and Subscript cannot be active simultaneously).
 * 2. Proper toggle behavior (clicking active style reverts to normal baseline text).
 * 3. Collapsed caret handling (typing continuation vs. stepping out of <sup>/<sub>).
 * 4. Full selection range wrapping & unwrapping.
 * 5. Active state inspection across DOM tree and queryCommandState.
 * 6. Standard Microsoft Word keyboard shortcuts:
 *    - Superscript: Ctrl + Shift + = (or Ctrl + +)
 *    - Subscript: Ctrl + =
 */

/**
 * Checks if the selection or active caret is inside a superscript element or style.
 * @param {Selection} [sel]
 * @returns {boolean}
 */
export function isSuperscriptActive(sel = window.getSelection()) {
  try {
    if (document.queryCommandState && document.queryCommandState('superscript')) {
      return true;
    }
  } catch (e) {
    // Ignore queryCommandState error if not focused
  }

  if (!sel || sel.rangeCount === 0) return false;

  try {
    let node = sel.anchorNode;
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('page-content')) {
      const tag = node.tagName?.toLowerCase();
      if (tag === 'sup') return true;
      const va = (node.style?.verticalAlign || '').toLowerCase();
      if (va === 'super' || va === 'superscript') return true;
      if (node.getAttribute?.('data-script') === 'super') return true;
      node = node.parentElement;
    }
  } catch (e) {
    // Return false on error
  }

  return false;
}

/**
 * Checks if the selection or active caret is inside a subscript element or style.
 * @param {Selection} [sel]
 * @returns {boolean}
 */
export function isSubscriptActive(sel = window.getSelection()) {
  try {
    if (document.queryCommandState && document.queryCommandState('subscript')) {
      return true;
    }
  } catch (e) {
    // Ignore queryCommandState error if not focused
  }

  if (!sel || sel.rangeCount === 0) return false;

  try {
    let node = sel.anchorNode;
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('page-content')) {
      const tag = node.tagName?.toLowerCase();
      if (tag === 'sub') return true;
      const va = (node.style?.verticalAlign || '').toLowerCase();
      if (va === 'sub' || va === 'subscript') return true;
      if (node.getAttribute?.('data-script') === 'sub') return true;
      node = node.parentElement;
    }
  } catch (e) {
    // Return false on error
  }

  return false;
}

/**
 * Returns current script formatting state for active selection.
 * @returns {{ isSuperscript: boolean, isSubscript: boolean }}
 */
export function getScriptFormattingState() {
  const sel = window.getSelection();
  return {
    isSuperscript: isSuperscriptActive(sel),
    isSubscript: isSubscriptActive(sel),
  };
}

/**
 * Finds the closest enclosing <sup> or <sub> ancestor for a given node.
 * @param {Node} node
 * @param {'sup' | 'sub'} [tagName]
 * @returns {HTMLElement | null}
 */
function findClosestScriptAncestor(node, tagName) {
  let curr = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (curr && curr.nodeType === Node.ELEMENT_NODE && !curr.classList?.contains('page-content')) {
    const t = curr.tagName?.toLowerCase();
    if (tagName) {
      if (t === tagName) return curr;
    } else {
      if (t === 'sup' || t === 'sub') return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Replaces an element with its child nodes, preserving children and document order.
 * @param {HTMLElement} el
 */
function unwrapElement(el) {
  if (!el || !el.parentNode) return;
  const parent = el.parentNode;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

/**
 * When caret is collapsed inside an inline element (like <sup> or <sub>)
 * and the user turns that formatting OFF (like in Word), step the caret
 * cleanly outside the element so subsequent typing is normal baseline text.
 * @param {HTMLElement} scriptEl
 * @param {Range} range
 */
function stepCaretOutOfScriptElement(scriptEl, range) {
  if (!scriptEl || !range) return;

  const parent = scriptEl.parentNode;
  if (!parent) return;

  // Create or reuse an unformatted text node right after scriptEl
  let targetTextNode;
  const next = scriptEl.nextSibling;

  if (next && next.nodeType === Node.TEXT_NODE) {
    targetTextNode = next;
  } else {
    // Insert a zero-width space so the browser can place a stable caret outside
    targetTextNode = document.createTextNode('\u200B');
    parent.insertBefore(targetTextNode, next);
  }

  const newRange = document.createRange();
  newRange.setStart(targetTextNode, targetTextNode.textContent === '\u200B' ? 1 : 0);
  newRange.collapse(true);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Toggles Superscript formatting with Word-like mutual exclusivity.
 *
 * Word Behavior:
 * - If Subscript is currently active: turn off Subscript, turn on Superscript.
 * - If Superscript is currently active: turn off Superscript (revert to normal baseline).
 * - If neither is active: turn on Superscript.
 *
 * @param {Object} [options]
 * @param {Function} [options.onBeforeAction]
 * @param {Function} [options.onAfterAction]
 * @param {Function} [options.syncDOMToBlocksSync]
 * @param {Function} [options.schedulePaginate]
 */
export function toggleSuperscript({
  onBeforeAction,
  onAfterAction,
  syncDOMToBlocksSync,
  schedulePaginate,
} = {}) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  onBeforeAction?.();

  const isSuper = isSuperscriptActive(sel);
  const isSub = isSubscriptActive(sel);
  const range = sel.getRangeAt(0);
  const isCollapsed = range.collapsed;

  try {
    if (isSub) {
      // 1. Mutual exclusivity: turn off subscript first
      document.execCommand('subscript', false, null);

      // Clean up any remaining <sub> tag wrapping the selection or caret
      const subEl = findClosestScriptAncestor(range.startContainer, 'sub');
      if (subEl && !isCollapsed) {
        unwrapElement(subEl);
      }

      // Then activate superscript
      document.execCommand('superscript', false, null);
    } else if (isSuper) {
      // 2. Turning OFF active superscript
      document.execCommand('superscript', false, null);

      if (isCollapsed) {
        const supEl = findClosestScriptAncestor(range.startContainer, 'sup');
        if (supEl) {
          stepCaretOutOfScriptElement(supEl, range);
        }
      } else {
        const supEl = findClosestScriptAncestor(range.startContainer, 'sup');
        if (supEl) {
          unwrapElement(supEl);
        }
      }
    } else {
      // 3. Activating superscript
      document.execCommand('superscript', false, null);
    }
  } catch (err) {
    console.error('Error toggling superscript:', err);
  }

  syncDOMToBlocksSync?.();
  schedulePaginate?.();
  onAfterAction?.();
}

/**
 * Toggles Subscript formatting with Word-like mutual exclusivity.
 *
 * Word Behavior:
 * - If Superscript is currently active: turn off Superscript, turn on Subscript.
 * - If Subscript is currently active: turn off Subscript (revert to normal baseline).
 * - If neither is active: turn on Subscript.
 *
 * @param {Object} [options]
 * @param {Function} [options.onBeforeAction]
 * @param {Function} [options.onAfterAction]
 * @param {Function} [options.syncDOMToBlocksSync]
 * @param {Function} [options.schedulePaginate]
 */
export function toggleSubscript({
  onBeforeAction,
  onAfterAction,
  syncDOMToBlocksSync,
  schedulePaginate,
} = {}) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  onBeforeAction?.();

  const isSuper = isSuperscriptActive(sel);
  const isSub = isSubscriptActive(sel);
  const range = sel.getRangeAt(0);
  const isCollapsed = range.collapsed;

  try {
    if (isSuper) {
      // 1. Mutual exclusivity: turn off superscript first
      document.execCommand('superscript', false, null);

      // Clean up any remaining <sup> tag wrapping the selection or caret
      const supEl = findClosestScriptAncestor(range.startContainer, 'sup');
      if (supEl && !isCollapsed) {
        unwrapElement(supEl);
      }

      // Then activate subscript
      document.execCommand('subscript', false, null);
    } else if (isSub) {
      // 2. Turning OFF active subscript
      document.execCommand('subscript', false, null);

      if (isCollapsed) {
        const subEl = findClosestScriptAncestor(range.startContainer, 'sub');
        if (subEl) {
          stepCaretOutOfScriptElement(subEl, range);
        }
      } else {
        const subEl = findClosestScriptAncestor(range.startContainer, 'sub');
        if (subEl) {
          unwrapElement(subEl);
        }
      }
    } else {
      // 3. Activating subscript
      document.execCommand('subscript', false, null);
    }
  } catch (err) {
    console.error('Error toggling subscript:', err);
  }

  syncDOMToBlocksSync?.();
  schedulePaginate?.();
  onAfterAction?.();
}

/**
 * Checks if a keyboard event matches Microsoft Word's Superscript or Subscript shortcuts:
 * - Subscript: Ctrl + = (or Cmd + =)
 * - Superscript: Ctrl + Shift + = (or Ctrl + + / Cmd + Shift + =)
 *
 * @param {KeyboardEvent} e
 * @returns {'superscript' | 'subscript' | null}
 */
export function getScriptShortcutType(e) {
  if (!e) return null;
  const isMod = e.ctrlKey || e.metaKey;
  if (!isMod || e.altKey) return null;

  // Subscript: Ctrl + = (without shift)
  if (!e.shiftKey && (e.key === '=' || e.code === 'Equal')) {
    return 'subscript';
  }

  // Superscript: Ctrl + Shift + =  OR  Ctrl + + (with shift, key is '+' or '=')
  if (
    e.shiftKey &&
    (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')
  ) {
    return 'superscript';
  }

  // Also catch Ctrl + '+' on keypad or European layouts
  if (e.key === '+' || e.code === 'NumpadAdd') {
    return 'superscript';
  }

  return null;
}

/**
 * Handles keyboard shortcuts for Superscript and Subscript.
 *
 * @param {KeyboardEvent} e
 * @param {Object} [options]
 * @returns {boolean} true if a shortcut was handled and prevented, false otherwise.
 */
export function handleSuperscriptSubscriptKeyDown(e, options = {}) {
  const type = getScriptShortcutType(e);
  if (!type) return false;

  // Ensure activeElement or selection is inside an editable area
  const sel = window.getSelection();
  const activeEl = document.activeElement;
  const isInsideEditable =
    activeEl?.isContentEditable ||
    activeEl?.closest?.('[contenteditable="true"]') ||
    sel?.anchorNode?.parentElement?.closest?.('[contenteditable="true"]');

  if (!isInsideEditable) return false;

  e.preventDefault();
  e.stopPropagation();

  if (type === 'superscript') {
    toggleSuperscript(options);
  } else if (type === 'subscript') {
    toggleSubscript(options);
  }

  return true;
}
