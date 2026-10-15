/**
 * Editor Scroll Utilities
 * Supports both nested container scrolling (.editor-container, .main-container)
 * and window-level scrolling dynamically.
 */

/** Determines the actual scroll target (container element or window). */
export function getScrollTarget(pagesContainer) {
  if (!pagesContainer || typeof window === "undefined") {
    return { element: typeof window !== "undefined" ? window : null, isWindow: true };
  }

  // 1. Check .editor-container if it currently has scrollable overflow
  const editorContainer =
    pagesContainer.closest?.(".editor-container") ||
    (pagesContainer.parentElement?.classList?.contains("editor-container")
      ? pagesContainer.parentElement
      : null);

  if (editorContainer && editorContainer.scrollHeight > editorContainer.clientHeight + 2) {
    return { element: editorContainer, isWindow: false };
  }

  // 2. Check ancestors with overflow that currently have scrollable content
  let curr = pagesContainer.parentElement;
  let nearestOverflowAncestor = null;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    try {
      const style = window.getComputedStyle(curr);
      const overflowY = style.overflowY || style.overflow;
      if (overflowY === "auto" || overflowY === "scroll") {
        if (!nearestOverflowAncestor) {
          nearestOverflowAncestor = curr;
        }
        if (curr.scrollHeight > curr.clientHeight + 2) {
          return { element: curr, isWindow: false };
        }
      }
    } catch (_) {}
    curr = curr.parentElement;
  }

  // 3. If window has scrollable content, target window
  if (typeof document !== "undefined" && document.documentElement.scrollHeight > window.innerHeight + 2) {
    return { element: window, isWindow: true };
  }

  // 4. Fallback when not overflowing yet: prefer nearest overflow ancestor, then editorContainer, then window
  if (nearestOverflowAncestor) {
    return { element: nearestOverflowAncestor, isWindow: false };
  }
  if (editorContainer) {
    return { element: editorContainer, isWindow: false };
  }

  return { element: window, isWindow: true };
}

/** Legacy helper: returns .editor-container or parent for backward compatibility. */
export function getEditorScrollContainer(pagesContainer) {
  if (!pagesContainer) return null;
  const fromClosest = pagesContainer.closest?.(".editor-container");
  if (fromClosest) return fromClosest;
  const parent = pagesContainer.parentElement;
  if (parent?.classList?.contains("editor-container")) return parent;
  return parent || null;
}

export function saveEditorScroll(pagesContainer) {
  const target = getScrollTarget(pagesContainer);
  if (target.isWindow || !target.element) {
    return {
      container: null,
      isWindow: true,
      scrollLeft: typeof window !== "undefined" ? (window.scrollX || window.pageXOffset || 0) : 0,
      scrollTop: typeof window !== "undefined" ? (window.scrollY || window.pageYOffset || 0) : 0,
    };
  }
  return {
    container: target.element,
    isWindow: false,
    scrollLeft: target.element.scrollLeft,
    scrollTop: target.element.scrollTop,
  };
}

export function restoreEditorScroll(saved, force = false) {
  if (!saved) return;
  // If the user is actively scrolling manually, NEVER override or snap back their scroll position!
  if (typeof window !== "undefined" && window.isUserScrollingEditor) return;
  if (!force && typeof window !== "undefined" && window.isProgrammaticScroll) return;
  const { container, isWindow, scrollLeft, scrollTop } = saved;
  if (container && !isWindow) {
    if (container.scrollLeft !== scrollLeft) container.scrollLeft = scrollLeft;
    if (container.scrollTop !== scrollTop) container.scrollTop = scrollTop;
    return;
  }
  if (typeof window !== "undefined") {
    const curX = window.scrollX || window.pageXOffset || 0;
    const curY = window.scrollY || window.pageYOffset || 0;
    if (curX !== scrollLeft || curY !== scrollTop) {
      window.scrollTo(scrollLeft, scrollTop);
    }
  }
}

/** Restore after the browser finishes any focus/layout-induced scroll adjustments. */
export function restoreEditorScrollAfterLayout(saved, onComplete = null) {
  if (!saved) {
    onComplete?.();
    return;
  }
  if (typeof window !== "undefined" && window.isUserScrollingEditor) {
    onComplete?.();
    return;
  }
  restoreEditorScroll(saved, true);
  requestAnimationFrame(() => {
    if (typeof window !== "undefined" && (window.isUserScrollingEditor || window.isProgrammaticScroll)) {
      onComplete?.();
      return;
    }
    restoreEditorScroll(saved, true);
    requestAnimationFrame(() => {
      if (typeof window !== "undefined" && (window.isUserScrollingEditor || window.isProgrammaticScroll)) {
        onComplete?.();
        return;
      }
      restoreEditorScroll(saved, true);
      onComplete?.();
    });
  });
}
