/**
 * Caret Visibility / Auto-Scroll Manager
 *
 * Implements professional Google Docs-style cursor auto-scrolling:
 * 1. Gives the user complete manual scrolling freedom without fighting or rubberbanding.
 * 2. Distinguishes user-initiated scrolling from programmatic scrolling.
 * 3. Enforces the minimum scroll principle: scrolls only enough to reveal the caret within
 *    configurable top/bottom safety margins, never forcibly centering the cursor.
 * 4. Works seamlessly across arbitrary visual page boundaries and continuous typing.
 * 5. Intelligently brings the caret back into view if an editing action occurs while the
 *    viewport is scrolled away on another page.
 * 6. Dynamically handles both container element (.editor-container) and window-level scrolling.
 */

import { getScrollTarget, getEditorScrollContainer } from "./editorScrollUtils.js";

const DEFAULT_OPTIONS = {
  topMargin: 60,
  bottomMargin: 80,
  smoothThreshold: 150, // Px distance above which smooth scrolling is used instead of instant
  autoScrollEnabled: true,
};

/**
 * Accurately measures the active caret coordinates in client/viewport space.
 * Handles collapsed ranges, text nodes, <br> line endings, and empty blocks.
 */
export function measureCaretRect(pagesContainer) {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;

  const range = sel.getRangeAt(0);
  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;

  // Verify the selection is inside the editor
  if (pagesContainer) {
    const inPages = pagesContainer.contains(anchorNode) || pagesContainer.contains(focusNode);
    const inDoc = document.contains(anchorNode) || document.contains(focusNode);
    if (!inPages && !inDoc) return null;
  }

  // Work with active focus/caret endpoint of selection
  let caretRange = typeof range.cloneRange === "function" ? range.cloneRange() : range;
  if (!range.collapsed) {
    try {
      if (focusNode && typeof caretRange.setStart === "function") {
        caretRange.setStart(focusNode, sel.focusOffset);
        caretRange.collapse(true);
      } else if (typeof caretRange.collapse === "function") {
        caretRange.collapse(false);
      }
    } catch (_) {
      if (typeof caretRange.collapse === "function") {
        caretRange.collapse(false);
      }
    }
  }

  // 1. Primary: range.getBoundingClientRect()
  try {
    const rect = caretRange.getBoundingClientRect();
    if (rect && (rect.height > 0 || rect.width > 0) && (rect.top !== 0 || rect.bottom !== 0)) {
      return rect;
    }
  } catch (_) {}

  // 2. Secondary: range.getClientRects()
  try {
    const clientRects = caretRange.getClientRects();
    if (clientRects && clientRects.length > 0) {
      const lastRect = clientRects[clientRects.length - 1];
      if (lastRect && (lastRect.height > 0 || lastRect.width > 0) && (lastRect.top !== 0 || lastRect.bottom !== 0)) {
        return lastRect;
      }
    }
  } catch (_) {}

  // 3. Probe span for collapsed empty lines or boundary positions
  try {
    let startNode = caretRange.startContainer;
    if (startNode?.nodeName === "BR" && startNode.parentElement) {
      startNode = startNode.parentElement;
    }
    const isVoid = startNode && /^(BR|IMG|INPUT|HR|AREA|WBR)$/i.test(startNode.nodeName);
    if (startNode && !isVoid && (!pagesContainer || pagesContainer.contains(startNode))) {
      const probe = document.createElement("span");
      probe.textContent = "\uFEFF"; // Zero-width non-breaking space
      probe.style.display = "inline-block";
      probe.style.width = "0";
      probe.style.height = "1em";
      probe.style.lineHeight = "inherit";
      probe.style.padding = "0";
      probe.style.margin = "0";
      probe.style.border = "0";

      const probeRange = typeof caretRange.cloneRange === "function" ? caretRange.cloneRange() : caretRange;
      if (typeof probeRange.insertNode === "function") {
        probeRange.insertNode(probe);
        const probeRect = probe.getBoundingClientRect();
        probe.parentNode?.removeChild(probe);

        if (probeRect && probeRect.height > 0 && (probeRect.top !== 0 || probeRect.bottom !== 0)) {
          return probeRect;
        }
      }
    }
  } catch (_) {}

  // 4. Element & Block fallback (e.g. block element containing caret)
  try {
    let node = caretRange.startContainer;
    if (node?.nodeName === "BR" && node.parentElement) {
      node = node.parentElement;
    }
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (el) {
      const blockEl = el.closest?.("[data-block-id]") || el;
      const br = blockEl.querySelector?.("br");
      if (br) {
        const brRect = br.getBoundingClientRect();
        if (brRect && brRect.height > 0 && (brRect.top !== 0 || brRect.bottom !== 0)) {
          return brRect;
        }
      }
      const elRect = el.getBoundingClientRect();
      if (elRect && elRect.height > 0 && (elRect.top !== 0 || elRect.bottom !== 0)) {
        return elRect;
      }
      const blockRect = blockEl.getBoundingClientRect();
      if (blockRect && blockRect.height > 0 && (blockRect.top !== 0 || blockRect.bottom !== 0)) {
        return {
          top: blockRect.top,
          bottom: blockRect.top + Math.min(blockRect.height, 24),
          left: blockRect.left,
          right: blockRect.right,
          height: Math.min(blockRect.height, 24),
          width: 0,
        };
      }
    }
  } catch (_) {}

  return null;
}

export class CaretVisibilityManager {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.getPagesContainer = typeof options.getPagesContainer === "function"
      ? options.getPagesContainer
      : () => options.pagesContainer || null;

    this.isProgrammaticScroll = false;
    this.programmaticScrollEndTimer = null;
    this.pendingRAF = null;
    this.pendingOptions = null;
    this.needsEnsureCaret = false;
    this.userScrollResetTimer = null;

    this.bindInterruptionHandlers();
  }

  updateOptions(newOptions = {}) {
    this.options = { ...this.options, ...newOptions };
  }

  /** Get the active scroll target (container element or window) */
  getScrollTarget() {
    const pagesContainer = this.getPagesContainer();
    return getScrollTarget(pagesContainer);
  }

  /** Interruption handlers allow user wheel/touch events to immediately cancel programmatic scroll */
  bindInterruptionHandlers() {
    if (typeof window === "undefined") return;

    this.handleUserInteraction = () => {
      // User manual interaction takes precedence: cancel pending caret reveal and programmatic scroll
      this.needsEnsureCaret = false;
      if (this.pendingRAF) {
        cancelAnimationFrame(this.pendingRAF);
        this.pendingRAF = null;
      }
      if (this.isProgrammaticScroll) {
        this.clearProgrammaticScroll();
      }
      if (typeof window !== "undefined") {
        window.isUserScrollingEditor = true;
        if (this.userScrollResetTimer) {
          clearTimeout(this.userScrollResetTimer);
        }
        this.userScrollResetTimer = setTimeout(() => {
          if (typeof window !== "undefined") {
            window.isUserScrollingEditor = false;
          }
        }, 300);
      }
    };

    window.addEventListener("wheel", this.handleUserInteraction, { passive: true, capture: true });
    window.addEventListener("touchstart", this.handleUserInteraction, { passive: true, capture: true });
    window.addEventListener("pointerdown", this.handleUserInteraction, { passive: true, capture: true });
  }

  markProgrammaticScroll(active) {
    this.isProgrammaticScroll = active;
    if (typeof window !== "undefined") {
      window.isProgrammaticScroll = active;
    }
  }

  clearProgrammaticScroll() {
    if (this.programmaticScrollEndTimer) {
      clearTimeout(this.programmaticScrollEndTimer);
      this.programmaticScrollEndTimer = null;
    }
    this.markProgrammaticScroll(false);
  }

  /**
   * Called when the user initiates an explicit editing operation
   * (e.g. key typing, Enter, Backspace, Delete, Paste, Cut).
   * This resets any lingering manual scroll lock and requests caret visibility.
   */
  onEditingAction(source = "unknown", customOptions = {}) {
    if (this.userScrollResetTimer) {
      clearTimeout(this.userScrollResetTimer);
      this.userScrollResetTimer = null;
    }
    if (typeof window !== "undefined") {
      // Clear manual scroll lock since the user is now actively editing
      window.isUserScrollingEditor = false;
    }
    this.options.onClearUserScrollLock?.();
    this.needsEnsureCaret = true;
    this.requestEnsureCaretVisible({ source, isEditingAction: true, ...customOptions });
  }

  /**
   * Batches caret visibility checks using requestAnimationFrame so layout and DOM
   * updates have finished before measuring geometry.
   */
  requestEnsureCaretVisible(customOptions = {}) {
    this.needsEnsureCaret = true;
    this.pendingOptions = { ...(this.pendingOptions || {}), ...customOptions };

    if (this.pendingRAF) {
      cancelAnimationFrame(this.pendingRAF);
    }

    this.pendingRAF = requestAnimationFrame(() => {
      this.pendingRAF = null;
      const opts = this.pendingOptions;
      this.pendingOptions = null;
      this.ensureCaretVisible(opts);
    });
  }

  /**
   * Main calculation and scroll adjustment function.
   * Enforces the minimum scroll principle with safety margins.
   */
  ensureCaretVisible(customOptions = {}) {
    if (!this.options.autoScrollEnabled) return false;

    // Never auto-scroll if the user is actively scrolling manually (unless explicit editing override)
    if (typeof window !== "undefined" && window.isUserScrollingEditor && !customOptions?.isEditingAction) {
      return false;
    }

    const pagesContainer = this.getPagesContainer();
    if (!pagesContainer) return false;

    const target = this.getScrollTarget();
    if (!target) return false;

    // Measure caret rect
    const caretRect = measureCaretRect(pagesContainer);
    if (!caretRect) return false;

    const topMargin = customOptions?.topMargin ?? this.options.topMargin;
    const bottomMargin = customOptions?.bottomMargin ?? this.options.bottomMargin;
    const smoothThreshold = customOptions?.smoothThreshold ?? this.options.smoothThreshold;

    let currentScrollTop = 0;
    let maxScrollTop = 0;
    let viewportTop = 0;
    let viewportBottom = 0;
    let viewportHeight = 0;
    let activeTarget = target;

    if (activeTarget.isWindow) {
      viewportTop = 0;
      viewportBottom = typeof window !== "undefined" ? window.innerHeight : 0;
      viewportHeight = viewportBottom;
      currentScrollTop = typeof window !== "undefined" ? (window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0) : 0;
      maxScrollTop = typeof document !== "undefined" ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight) : 0;
    } else {
      const scrollEl = activeTarget.element;
      if (!scrollEl) return false;
      const rect = scrollEl.getBoundingClientRect();
      const winH = typeof window !== "undefined" ? window.innerHeight : 0;
      // Clip to visible window viewport
      viewportTop = Math.max(0, rect.top);
      viewportBottom = winH > 0 ? Math.min(winH, rect.bottom) : rect.bottom;
      viewportHeight = Math.max(0, viewportBottom - viewportTop);
      currentScrollTop = scrollEl.scrollTop;
      maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

      // Fallback: if container element has 0 scroll capacity but window does, scroll window instead
      if (maxScrollTop <= 0 && typeof window !== "undefined" && typeof document !== "undefined" && document.documentElement.scrollHeight > window.innerHeight + 2) {
        viewportTop = 0;
        viewportBottom = window.innerHeight;
        viewportHeight = window.innerHeight;
        currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
        maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        activeTarget = { element: window, isWindow: true };
      }
    }

    if (viewportHeight <= 0) return false;

    // Clamp margins for small viewports so they don't overlap
    const effectiveTopMargin = Math.min(topMargin, Math.floor(viewportHeight * 0.25));
    const effectiveBottomMargin = Math.min(bottomMargin, Math.floor(viewportHeight * 0.35));

    const allowedTop = viewportTop + effectiveTopMargin;
    const allowedBottom = viewportBottom - effectiveBottomMargin;

    const caretTop = caretRect.top;
    const caretBottom = caretRect.bottom;

    let scrollDelta = 0;

    if (caretBottom > allowedBottom) {
      // Caret is below visible boundary: scroll DOWN by minimum required delta
      scrollDelta = caretBottom - allowedBottom;
    } else if (caretTop < allowedTop) {
      // Caret is above visible boundary: scroll UP by minimum required delta
      scrollDelta = caretTop - allowedTop; // Negative value
    }

    // Caret is comfortably visible within margins
    if (Math.abs(scrollDelta) < 2) {
      this.needsEnsureCaret = false;
      return false;
    }

    const targetScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + scrollDelta));

    if (Math.abs(targetScrollTop - currentScrollTop) < 2) {
      this.needsEnsureCaret = false;
      return false;
    }

    const distance = Math.abs(targetScrollTop - currentScrollTop);

    // Determine scroll behavior:
    // Small corrections (<= smoothThreshold, e.g. typing or Enter) are instant for crisp responsiveness.
    // Large jumps (> smoothThreshold, e.g. scrolled away across pages) use smooth animation.
    let behavior = customOptions?.behavior;
    if (!behavior) {
      behavior = distance > smoothThreshold ? "smooth" : "auto";
    }

    this.markProgrammaticScroll(true);

    if (activeTarget.isWindow) {
      window.scrollTo({
        top: targetScrollTop,
        behavior: behavior === "smooth" ? "smooth" : "auto",
      });

      if (behavior === "smooth") {
        if (this.programmaticScrollEndTimer) clearTimeout(this.programmaticScrollEndTimer);
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          window.removeEventListener("scrollend", onEnd);
          this.clearProgrammaticScroll();
        };
        window.addEventListener("scrollend", onEnd, { once: true, passive: true });
        const fallback = Math.min(600, Math.max(200, Math.round(distance * 0.6)));
        this.programmaticScrollEndTimer = setTimeout(onEnd, fallback);
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.clearProgrammaticScroll();
          });
        });
      }
    } else {
      const scrollEl = activeTarget.element;
      if (behavior === "smooth" && typeof scrollEl.scrollTo === "function") {
        scrollEl.scrollTo({
          top: targetScrollTop,
          behavior: "smooth",
        });

        if (this.programmaticScrollEndTimer) clearTimeout(this.programmaticScrollEndTimer);
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          scrollEl.removeEventListener("scrollend", onEnd);
          this.clearProgrammaticScroll();
        };
        scrollEl.addEventListener("scrollend", onEnd, { once: true, passive: true });
        const fallback = Math.min(600, Math.max(200, Math.round(distance * 0.6)));
        this.programmaticScrollEndTimer = setTimeout(onEnd, fallback);
      } else {
        scrollEl.scrollTop = targetScrollTop;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.clearProgrammaticScroll();
          });
        });
      }
    }

    this.needsEnsureCaret = false;
    return true;
  }

  destroy() {
    if (this.pendingRAF) {
      cancelAnimationFrame(this.pendingRAF);
      this.pendingRAF = null;
    }
    if (this.userScrollResetTimer) {
      clearTimeout(this.userScrollResetTimer);
      this.userScrollResetTimer = null;
    }
    this.clearProgrammaticScroll();

    if (typeof window !== "undefined") {
      window.removeEventListener("wheel", this.handleUserInteraction, { capture: true });
      window.removeEventListener("touchstart", this.handleUserInteraction, { capture: true });
      window.removeEventListener("pointerdown", this.handleUserInteraction, { capture: true });
    }
  }
}

export function createCaretVisibilityManager(options) {
  return new CaretVisibilityManager(options);
}
