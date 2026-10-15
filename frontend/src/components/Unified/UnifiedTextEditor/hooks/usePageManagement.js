import { useRef, useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ReactDOM from "react-dom/client";
import HeaderLogoUpload from "../components/HeaderLogoUpload";
import { BLOCK_TYPES } from "../../../Editor/DocumentEngine";
import { applyAlignmentFromBlock } from "../../../Editor/textAlignment/textAlignment";
import VideoResizeHandler from "../utils/VideoResizeHandler";
import {
  restoreEditorScroll,
  restoreEditorScrollAfterLayout,
  saveEditorScroll,
} from "../utils/editorScrollUtils";

// Locked visuals (allow selection; no "not-allowed" cursor, no user-select: none)
export const LOCKED_STYLE = "";

const pageReactRoots = new WeakMap();
const LOGO_TEXT_MAX_LINES = 4;
const LOGO_TEXT_LINE_HEIGHT_PX = 14;
const LOGO_TEXT_VERTICAL_PADDING_PX = 6; // 3px top + 3px bottom
const LOGO_TEXT_FIXED_HEIGHT_PX =
  (LOGO_TEXT_MAX_LINES * LOGO_TEXT_LINE_HEIGHT_PX) + LOGO_TEXT_VERTICAL_PADDING_PX;

function mountReact(Node, element, props) {
  if (!element || !document.contains(element)) return;
  let root = pageReactRoots.get(element);
  if (!root) {
    root = ReactDOM.createRoot(element);
    pageReactRoots.set(element, root);
  }
  try {
    root.render(<Node {...props} />);
  } catch (e) {
    console.warn("Failed to render React root, possibly unmounted:", e);
    pageReactRoots.delete(element);
  }
}

function unmountRoot(element) {
  const root = pageReactRoots.get(element);
  if (root) {
    pageReactRoots.delete(element);
    setTimeout(() => {
      try {
        root.unmount();
      } catch (e) {
        // Silently ignore already unmounted roots
      }
    }, 0);
  }
}

/** Dropdown cells are form controls — keep them out of the contenteditable text selection system. */
export function applyDropdownCellGuards(container, readOnly = false) {
  if (!container) return;
  container
    .querySelectorAll(
      'table[data-block-id] td[data-type="dropdown"], table[data-block-id] th[data-type="dropdown"]'
    )
    .forEach((cell) => {
      cell.setAttribute("contenteditable", "false");
    });
  container.querySelectorAll("table[data-block-id] select.cell-dropdown").forEach((select) => {
    select.setAttribute("contenteditable", "false");
    if (readOnly) {
      select.disabled = true;
      select.setAttribute("disabled", "true");
    }
    if (!select.hasAttribute("tabindex")) {
      select.setAttribute("tabindex", "0");
    }
  });
}

/** Merge page snapshot logo with parent form logo so pagination/sync never drops preview. */
export function mergeLogoForDisplay(pageLogo, parentLogo) {
  if (!pageLogo && !parentLogo) return null;
  const merged = { ...(pageLogo || {}), ...(parentLogo || {}) };
  if (!merged.preview && pageLogo?.preview) {
    merged.preview = pageLogo.preview;
    if (merged.width == null && pageLogo.width != null) merged.width = pageLogo.width;
    if (merged.height == null && pageLogo.height != null) merged.height = pageLogo.height;
  }
  if (!merged.preview && parentLogo?.preview) {
    merged.preview = parentLogo.preview;
    if (merged.width == null && parentLogo.width != null) merged.width = parentLogo.width;
    if (merged.height == null && parentLogo.height != null) merged.height = parentLogo.height;
  }
  if (!merged.preview && !merged.text && !merged.textRight) return null;
  return merged;
}

export const usePageManagement = ({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  pagesState,
  setPagesState,
  paperSize,
  orientation,
  updateTOC,
  setPageCount,
  setCurrentPage,
  onLogoChange,
  // NEW: Allow passing external refs to be populated by this hook
  schedulePaginateRef: externalSchedulePaginateRef,
  renderFreshFromEngineRef: externalRenderFreshFromEngineRef,
  isProgrammaticChangeRef: externalIsProgrammaticChangeRef,
  sizePageContentRef: externalSizePageContentRef,
  /** Latest parent `logo` prop; used after pagination (pagesState can lag or omit preview). */
  parentLogoRef,
  isPreviewMode,
  isDocument = false,
  lockHeaderEditing = false,
  readOnly = false,
  caretManagerRef,
  spellCheckEnabled,
}) => {
  const isSpellCheckActive = spellCheckEnabled !== undefined
    ? Boolean(spellCheckEnabled)
    : (!readOnly && !isPreviewMode);

  const syncEditableAttributes = useCallback((el) => {
    if (!el) return;
    const shouldBeEditable = !readOnly;
    const expectedContentEditable = shouldBeEditable ? "true" : "false";
    const expectedSpellcheck = isSpellCheckActive ? "true" : "false";

    if (el.getAttribute("contenteditable") !== expectedContentEditable) {
      el.setAttribute("contenteditable", expectedContentEditable);
    }
    if (el.getAttribute("spellcheck") !== expectedSpellcheck) {
      el.setAttribute("spellcheck", expectedSpellcheck);
    }
    if (el.spellcheck !== isSpellCheckActive) {
      el.spellcheck = isSpellCheckActive;
    }
    if (isSpellCheckActive) {
      if (el.getAttribute("lang") !== "en") {
        el.setAttribute("lang", "en");
      }
      if (el.getAttribute("autocorrect") !== "on") {
        el.setAttribute("autocorrect", "on");
      }
    } else {
      if (el.hasAttribute("lang")) {
        el.removeAttribute("lang");
      }
      if (el.hasAttribute("autocorrect")) {
        el.removeAttribute("autocorrect");
      }
    }
  }, [readOnly, isSpellCheckActive]);

  const pagesStateRef = useRef(pagesState);
  useEffect(() => {
    pagesStateRef.current = pagesState;
  }, [pagesState]);

  const isPaginatingRef = useRef(false);
  const paginateQueuedRef = useRef(false);
  const lastPaginateTimeRef = useRef(0);

  // Always declare internal refs to comply with Rules of Hooks
  const internalSchedulePaginateRef = useRef(() => { });
  const internalRenderFreshFromEngineRef = useRef(() => { });
  const internalIsProgrammaticChangeRef = useRef(false);
  const internalSizePageContentRef = useRef(() => { });

  // Use external refs if provided, otherwise use internal ones
  const schedulePaginateRef = externalSchedulePaginateRef || internalSchedulePaginateRef;
  const renderFreshFromEngineRef = externalRenderFreshFromEngineRef || internalRenderFreshFromEngineRef;
  const isProgrammaticChangeRef = externalIsProgrammaticChangeRef || internalIsProgrammaticChangeRef;
  const sizePageContentRef = externalSizePageContentRef || internalSizePageContentRef;

  const getContentHeightRef = useRef(() => 0);

  // -------- helpers to size content area ----------
  const PAGINATION_BUFFER_PX = 20;

  const getContentHeight = useCallback((page) => {
    if (!page) return 0;
    const pageRect = page.getBoundingClientRect();

    let pageHeight = pageRect.height;
    if (!pageHeight || pageHeight <= 0) {
      if ((paperSize || "").toLowerCase() === "letter") {
        pageHeight = 1056;
      } else if ((paperSize || "").toLowerCase() === "legal") {
        pageHeight = 1344;
      } else {
        pageHeight = 1123;
      }
    }

    const logoStrip = page.querySelector(".page-logo-strip");
    const logoH = logoStrip ? logoStrip.getBoundingClientRect().height : 0;

    const header = page.querySelector(".page-header");
    const headerH = header ? header.getBoundingClientRect().height : 0;

    const footer = page.querySelector(".page-footer");
    const footerH = footer ? footer.getBoundingClientRect().height : 0;

    const content = page.querySelector(".page-content");
    const cs = content ? getComputedStyle(content) : null;
    const vpad = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;

    const budget = Math.floor(pageHeight - logoH - headerH - footerH - vpad - 4);
    if (budget <= 0) {
      const fallbackTotal = 1123;
      return Math.floor(fallbackTotal - logoH - headerH - footerH - vpad - 4);
    }
    return budget;
  }, [paperSize]);

  useEffect(() => {
    getContentHeightRef.current = getContentHeight;
  }, [getContentHeight]);

  const sizePageContent = useCallback((pageEl, measuring = false) => {
    if (!pageEl) return;
    const content = pageEl.querySelector(".page-content");
    if (!content) return;
    pageEl.getBoundingClientRect();
    const max = getContentHeightRef.current(pageEl);
    if (max <= 0) return; // Guard against setting invalid heights when hidden

    content.style.boxSizing = "border-box";
    content.style.height = `${max}px`;
    content.style.maxHeight = `${max}px`;
    content.style.overflow = measuring ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    sizePageContentRef.current = sizePageContent;
  }, [sizePageContent, sizePageContentRef]);

  const sizeAllPages = useCallback(() => {
    (pagesContainerRef.current?.querySelectorAll(".page") || []).forEach((p) =>
      sizePageContent(p)
    );
  }, [sizePageContent, pagesContainerRef]);

  // -------- logo sync across all pages --------
  const updateAllLogoImgs = useCallback((logo) => {
    const root = pagesContainerRef.current;
    if (!root) {
      return;
    }
    const imgs = root.querySelectorAll(".page-logo-img");

    imgs.forEach((img) => {
      if (logo && logo.preview) {
        if (img.src !== logo.preview) {
          img.src = logo.preview;
        }
        // SURGICAL: Only touch style if different to prevent layout thrashing
        if (img.style.display !== "block") img.style.display = "block";
        if (img.style.maxHeight !== "60px") img.style.maxHeight = "60px";
        if (img.style.objectFit !== "contain") img.style.objectFit = "contain";

        const targetW = logo.width ? `${logo.width}px` : "";
        if (img.style.width !== targetW) {
          if (targetW) img.style.width = targetW;
          else img.style.removeProperty("width");
        }

        const targetH = logo.height ? `${logo.height}px` : "";
        if (img.style.height !== targetH) {
          if (targetH) img.style.height = targetH;
          else img.style.removeProperty("height");
        }
      } else {
        if (img.src !== "") img.src = "";
        if (img.style.display !== "none") img.style.display = "none";
      }
    });

    const centersLeft = root.querySelectorAll(".logo-center-left");
    centersLeft.forEach((centerLeft) => {
      if (centerLeft.contentEditable !== "true" && document.activeElement !== centerLeft) {
        const textToSet = (logo && logo.text !== undefined)
          ? logo.text
          : (pagesState[0]?.header?.logoText || "");

        if (centerLeft.textContent !== textToSet) {
          centerLeft.textContent = textToSet;
        }
      }
    });

    const centersRight = root.querySelectorAll(".logo-center-right");
    centersRight.forEach((centerRight) => {
      if (centerRight.contentEditable !== "true" && document.activeElement !== centerRight) {
        const textToSet = (logo && logo.textRight !== undefined)
          ? logo.textRight
          : (pagesState[0]?.header?.logoTextRight || "");

        if (centerRight.textContent !== textToSet) {
          centerRight.textContent = textToSet;
        }
      }
    });

    const centers = root.querySelectorAll(".logo-center");
    centers.forEach((center) => {
      if (center.querySelector(".logo-center-left")) return;
      if (center.contentEditable !== "true" && document.activeElement !== center) {
        const textToSet = (logo && logo.text !== undefined)
          ? logo.text
          : (pagesState[0]?.header?.logoText || "");

        if (center.textContent !== textToSet) {
          center.textContent = textToSet;
        }
      }
    });

    const ps = pagesStateRef.current || pagesState || [];
    const currentParentLogo = parentLogoRef?.current;

    const mounts = root.querySelectorAll(".logo-mount");
    mounts.forEach((mount) => {
      const page = mount.closest(".page");
      const idxStr = page?.dataset.pageIndex || "Page 1";
      const idx = parseInt(idxStr.split(" ")[1]) || 1;
      const snapshot = ps[idx - 1] || ps[0] || {};
      const currentLogo = (logo !== undefined && logo !== null)
        ? logo
        : (snapshot.header?.logo || currentParentLogo || null);

      mountReact(HeaderLogoUpload, mount, {
        pageId: snapshot.id || `page-${idx}`,
        header: {
          ...(snapshot.header || {}),
          logo: currentLogo
        },
        logo: currentLogo,
        onLogoUpload: (logoData) => {
          const { file, preview, width, height } = logoData;
          setPagesState((prev) => {
            const p = [...prev];
            const pIdx = Math.max(0, idx - 1);
            const updated = {
              ...(p[pIdx] || { id: uuidv4() }),
              headerLogoFile: file,
              header: {
                ...(p[pIdx]?.header || {}),
                logo: { preview, width, height }
              }
            };
            p[pIdx] = updated;
            if (pIdx !== 0 && p[0]) {
              p[0] = { ...p[0], header: { ...(p[0].header || {}), logo: { preview, width, height } }, headerLogoFile: file };
            }
            return p;
          });
          if (parentLogoRef) {
            parentLogoRef.current = { preview, width, height };
          }
          const currentLogoText = pagesContainerRef.current?.querySelector(".logo-center-left")?.textContent || parentLogoRef?.current?.text || pagesStateRef.current?.[0]?.header?.logoText || "";
          const currentLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent || parentLogoRef?.current?.textRight || pagesStateRef.current?.[0]?.header?.logoTextRight || "";
          updateAllLogoImgs({ preview, width, height, text: currentLogoText, textRight: currentLogoTextRight });
          if (onLogoChange) onLogoChange({ preview, width, height, text: currentLogoText, textRight: currentLogoTextRight });
          setTimeout(() => schedulePaginateRef.current(), 0);
        },
        onLogoRemove: () => {
          if (parentLogoRef) parentLogoRef.current = null;
          setPagesState((prev) => {
            const p = [...prev];
            const pIdx = Math.max(0, idx - 1);
            if (p[pIdx]) p[pIdx] = { ...p[pIdx], header: { ...(p[pIdx].header || {}), logo: null }, headerLogoFile: null };
            if (p[0]) p[0] = { ...p[0], header: { ...(p[0].header || {}), logo: null }, headerLogoFile: null };
            return p;
          });
          updateAllLogoImgs(null);
          const currentLogoText = pagesContainerRef.current?.querySelector(".logo-center-left")?.textContent || parentLogoRef?.current?.text || pagesStateRef.current?.[0]?.header?.logoText || "";
          const currentLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent || parentLogoRef?.current?.textRight || pagesStateRef.current?.[0]?.header?.logoTextRight || "";
          const logoPayload = (currentLogoText || currentLogoTextRight) ? { preview: null, width: null, height: null, text: currentLogoText, textRight: currentLogoTextRight } : null;
          if (onLogoChange) onLogoChange(logoPayload);
          setTimeout(() => schedulePaginateRef.current(), 0);
        },
        onLogoChange: (data) => {
          if (onLogoChange) onLogoChange(data);
        }
      });
    });
  }, [pagesContainerRef, setPagesState, onLogoChange, parentLogoRef]);

  // -------- mount HeaderLogoUpload immediately AFTER page is appended to DOM ----------
  const mountLogoForPage = useCallback(
    (pageEl, index, snapshot, explicitLogo = null) => {
      if (readOnly || lockHeaderEditing || !pageEl) return;
      const logoMount = pageEl.querySelector(".logo-mount");
      if (!logoMount || !document.contains(logoMount)) return;

      const ps = pagesStateRef.current || pagesState || [];
      const currentParentLogo = parentLogoRef?.current;
      const snapLogo = explicitLogo !== null 
        ? explicitLogo 
        : (snapshot?.header?.logo || ps[index - 1]?.header?.logo || ps[0]?.header?.logo || currentParentLogo || null);
      const pageId = snapshot?.id || `page-${index}`;

      mountReact(HeaderLogoUpload, logoMount, {
        pageId,
        header: {
          ...(snapshot?.header || {}),
          logo: snapLogo,
        },
        logo: snapLogo,
        onLogoUpload: (logoData) => {
          const { file, preview, width, height } = logoData;
          setPagesState((prev) => {
            const p = [...prev];
            const idx = Math.max(0, index - 1);
            const updated = {
              ...(p[idx] || { id: uuidv4(), header: {}, footer: {} }),
              header: { ...(p[idx]?.header || {}), logo: { preview, width, height } },
              headerLogoFile: file,
            };
            p[idx] = updated;
            if (idx !== 0 && p[0]) {
              p[0] = { ...p[0], header: { ...(p[0].header || {}), logo: { preview, width, height } }, headerLogoFile: file };
            }
            return p;
          });
          if (parentLogoRef) {
            parentLogoRef.current = { preview, width, height };
          }
          const currentLogoText = pagesContainerRef.current?.querySelector(".logo-center-left")?.textContent || parentLogoRef?.current?.text || pagesStateRef.current?.[0]?.header?.logoText || "";
          const currentLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent || parentLogoRef?.current?.textRight || pagesStateRef.current?.[0]?.header?.logoTextRight || "";
          updateAllLogoImgs({ preview, width, height, text: currentLogoText, textRight: currentLogoTextRight });
          if (onLogoChange) onLogoChange({ preview, width, height, text: currentLogoText, textRight: currentLogoTextRight });
          setTimeout(() => schedulePaginateRef.current(), 0);
        },
        onLogoRemove: () => {
          if (parentLogoRef) parentLogoRef.current = null;
          setPagesState((prev) => {
            const p = [...prev];
            const pIdx = Math.max(0, index - 1);
            if (p[pIdx]) p[pIdx] = { ...p[pIdx], header: { ...(p[pIdx].header || {}), logo: null }, headerLogoFile: null };
            if (p[0]) p[0] = { ...p[0], header: { ...(p[0].header || {}), logo: null }, headerLogoFile: null };
            return p;
          });
          updateAllLogoImgs(null);
          const currentLogoText = pagesContainerRef.current?.querySelector(".logo-center-left")?.textContent || parentLogoRef?.current?.text || pagesStateRef.current?.[0]?.header?.logoText || "";
          const currentLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent || parentLogoRef?.current?.textRight || pagesStateRef.current?.[0]?.header?.logoTextRight || "";
          const logoPayload = (currentLogoText || currentLogoTextRight) ? { preview: null, width: null, height: null, text: currentLogoText, textRight: currentLogoTextRight } : null;
          if (onLogoChange) onLogoChange(logoPayload);
          setTimeout(() => schedulePaginateRef.current(), 0);
        },
        onLogoChange: (data) => {
          if (onLogoChange) onLogoChange(data);
        }
      });
    },
    [readOnly, lockHeaderEditing, parentLogoRef, pagesContainerRef, updateAllLogoImgs, onLogoChange, setPagesState]
  );

  // -------- create a page (DOM only) ----------
  const createPage = useCallback(
    (index, snapshot) => {
      const page = document.createElement("div");
      const pageOrientation = snapshot?.orientation || pagesState[index - 1]?.orientation || orientation;
      page.className = `page ${paperSize.toLowerCase()} ${pageOrientation}`;
      page.dataset.pageIndex = `Page ${index} of ${index}`;

      const logoStrip = document.createElement("div");
      logoStrip.className = "page-logo-strip";
      logoStrip.style.minHeight = "64px";
      logoStrip.style.padding = "6px 8px";
      logoStrip.style.display = "flex";
      logoStrip.style.alignItems = "center";
      logoStrip.style.justifyContent = "space-between";
      logoStrip.style.gap = "8px";

      const logoLeft = document.createElement("div");
      logoLeft.className = "logo-left";
      logoLeft.style.display = "flex";
      logoLeft.style.alignItems = "center";
      const logoImg = document.createElement("img");
      logoImg.className = "page-logo-img";
      logoImg.alt = "Logo";
      logoImg.style.maxHeight = "60px";
      logoImg.style.objectFit = "contain";
      logoImg.style.display = "none";
      const ps = pagesStateRef.current || pagesState || [];
      const currentParentLogo = parentLogoRef?.current;
      const snapLogo = snapshot?.header?.logo || ps[index - 1]?.header?.logo || ps[0]?.header?.logo || currentParentLogo || null;
      if (snapLogo && snapLogo.preview) {
        logoImg.src = snapLogo.preview;
        logoImg.style.display = "block";
        if (snapLogo.width) logoImg.style.width = `${snapLogo.width}px`;
        if (snapLogo.height) logoImg.style.height = `${snapLogo.height}px`;
      }
      logoLeft.appendChild(logoImg);

      const logoCenter = document.createElement("div");
      logoCenter.className = "logo-center";
      logoCenter.style.flex = "1";
      logoCenter.style.margin = "0 15px";
      logoCenter.style.height = `${LOGO_TEXT_FIXED_HEIGHT_PX}px`;
      logoCenter.style.minHeight = `${LOGO_TEXT_FIXED_HEIGHT_PX}px`;
      logoCenter.style.maxHeight = `${LOGO_TEXT_FIXED_HEIGHT_PX}px`;
      logoCenter.style.display = "flex";
      logoCenter.style.gap = "12px";
      logoCenter.style.alignItems = "center";
      logoCenter.style.justifyContent = "space-between";

      // 1. LEFT EDITOR (Editable manually, binds to logoText)
      const logoCenterLeft = document.createElement("div");
      logoCenterLeft.className = "logo-center-left";
      logoCenterLeft.style.flex = "1";
      logoCenterLeft.style.height = "100%";
      logoCenterLeft.style.padding = "3px 8px";
      logoCenterLeft.style.border = "1px dashed #d9d9d9";
      logoCenterLeft.style.borderRadius = "4px";
      logoCenterLeft.style.boxSizing = "border-box";
      logoCenterLeft.style.whiteSpace = "pre-wrap";
      logoCenterLeft.style.wordBreak = "break-word";
      logoCenterLeft.style.overflowY = "auto";
      logoCenterLeft.style.overflowX = "hidden";
      logoCenterLeft.style.lineHeight = `${LOGO_TEXT_LINE_HEIGHT_PX}px`;
      logoCenterLeft.style.color = "#333";
      logoCenterLeft.style.cursor = "text";
      logoCenterLeft.style.background = "#fff";
      logoCenterLeft.style.display = "block";

      const liveLogoText = pagesContainerRef.current?.querySelector(".logo-center-left")?.textContent;
      const initialLogoText = (liveLogoText || snapshot?.header?.logoText || pagesState[0]?.header?.logoText || "")
        .replace(/\r/g, "")
        .split("\n")
        .slice(0, LOGO_TEXT_MAX_LINES)
        .join("\n")
        .trim();
      logoCenterLeft.textContent = initialLogoText;

      logoCenter.appendChild(logoCenterLeft);

      if (isDocument) {
        // 2. RIGHT EDITOR (Read-only, populated dynamically from dropdown selection)
        const logoCenterRight = document.createElement("div");
        logoCenterRight.className = "logo-center-right";
        logoCenterRight.style.flex = "1";
        logoCenterRight.style.height = "100%";
        logoCenterRight.style.padding = "3px 8px";
        logoCenterRight.style.border = "1px solid #f0f0f0";
        logoCenterRight.style.borderRadius = "4px";
        logoCenterRight.style.boxSizing = "border-box";
        logoCenterRight.style.whiteSpace = "pre-wrap";
        logoCenterRight.style.wordBreak = "break-word";
        logoCenterRight.style.overflowY = "auto";
        logoCenterRight.style.overflowX = "hidden";
        logoCenterRight.style.fontSize = "16px";
        logoCenterRight.style.fontWeight = "bold";
        logoCenterRight.style.lineHeight = "20px";
        logoCenterRight.style.color = "#111827";
        logoCenterRight.style.background = "#fafafa";
        logoCenterRight.style.cursor = "not-allowed";
        logoCenterRight.style.display = "flex";
        logoCenterRight.style.alignItems = "center";
        logoCenterRight.style.justifyContent = "center";
        logoCenterRight.style.textAlign = "center";

        const liveLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent;
        const initialLogoTextRight = (liveLogoTextRight || snapshot?.header?.logoTextRight || pagesState[0]?.header?.logoTextRight || "")
          .trim();
        logoCenterRight.textContent = initialLogoTextRight;

        logoCenter.appendChild(logoCenterRight);
      }

      const moveCaretToLogoTextEnd = () => {
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        range.selectNodeContents(logoCenterLeft);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      };

      const enforceLogoTextMaxLines = () => {
        const text = (logoCenterLeft.textContent || "").replace(/\r/g, "");
        const lines = text.split("\n");
        if (lines.length <= LOGO_TEXT_MAX_LINES) return;
        logoCenterLeft.textContent = lines.slice(0, LOGO_TEXT_MAX_LINES).join("\n");
        moveCaretToLogoTextEnd();
      };

      logoCenterLeft.addEventListener("dblclick", (e) => {
        if (readOnly || lockHeaderEditing) return;
        e.preventDefault();
        e.stopPropagation();
        logoCenterLeft.contentEditable = "true";
        logoCenterLeft.style.border = "1px dashed #1890ff";
        logoCenterLeft.focus();
      });

      logoCenterLeft.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const sel = window.getSelection();
        const hasSelection = !!(sel && sel.rangeCount && !sel.getRangeAt(0).collapsed);
        const lineCount = ((logoCenterLeft.textContent || "").replace(/\r/g, "").split("\n")).length;
        if (lineCount >= LOGO_TEXT_MAX_LINES && !hasSelection) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        document.execCommand("insertLineBreak");
        enforceLogoTextMaxLines();
      });

      logoCenterLeft.addEventListener("input", (e) => {
        e.stopPropagation();
        enforceLogoTextMaxLines();
      });

      logoCenterLeft.addEventListener("blur", () => {
        logoCenterLeft.contentEditable = "false";
        logoCenterLeft.style.border = "1px dashed #d9d9d9";
        const newText = (logoCenterLeft.textContent || "").trim();
        logoCenterLeft.textContent = newText;
        setPagesState((prev) => {
          const p = [...prev];
          const idx = Math.max(0, index - 1);
          if (p[idx])
            p[idx] = { ...p[idx], header: { ...(p[idx].header || {}), logoText: newText } };
          return p;
        });
        const currentLogo = parentLogoRef?.current || pagesState[0]?.header?.logo || null;
        const currentLogoTextRight = pagesContainerRef.current?.querySelector(".logo-center-right")?.textContent || parentLogoRef?.current?.textRight || pagesState[0]?.header?.logoTextRight || "";
        if (onLogoChange) {
          onLogoChange({
            preview: currentLogo?.preview || null,
            width: currentLogo?.width || null,
            height: currentLogo?.height || null,
            text: newText,
            textRight: currentLogoTextRight
          });
        }
        setTimeout(() => schedulePaginateRef.current(), 0);
      });

      const logoRight = document.createElement("div");
      logoRight.className = "logo-right";
      const logoMount = document.createElement("div");
      logoMount.className = "logo-mount";
      logoRight.appendChild(logoMount);

      logoStrip.appendChild(logoLeft);
      logoStrip.appendChild(logoCenter);
      logoStrip.appendChild(logoRight);

      const header = document.createElement("div");
      header.className = "page-header";
      header.contentEditable = "false";
      const headerInner = document.createElement("div");
      headerInner.className = "header-inner";
      headerInner.style.padding = "0 24px";
      const headerText = document.createElement("div");
      headerText.className = "header-text";
      headerText.contentEditable = "false";
      headerText.style.minHeight = "28px";
      headerText.style.padding = "8px 0";
      headerText.style.whiteSpace = "pre-wrap";
      headerText.style.wordBreak = "break-word";
      headerText.textContent = snapshot?.header?.content || "";
      headerInner.appendChild(headerText);
      header.appendChild(headerInner);

      const content = document.createElement("div");
      content.className = "page-content";
      content.setAttribute("data-page", index);
      if (readOnly) {
        content.tabIndex = -1;
      } else {
        content.tabIndex = 0;
      }
      syncEditableAttributes(content);
      content.style.textAlign = "left";

      const footer = document.createElement("div");
      footer.className = "page-footer";
      footer.contentEditable = "false";
      const footerInner = document.createElement("div");
      footerInner.className = "footer-inner";
      footerInner.style.padding = "0 24px";
      const footerText = document.createElement("div");
      footerText.className = "footer-text";
      footerText.contentEditable = "false";
      footerText.style.padding = "6px 0";
      footerText.style.whiteSpace = "pre-wrap";
      footerText.style.wordBreak = "break-word";
      footerText.textContent = snapshot?.footer?.content || "";
      footerInner.appendChild(footerText);
      footer.appendChild(footerInner);

      headerText.addEventListener("dblclick", (e) => {
        if (readOnly || lockHeaderEditing) return;
        e.preventDefault();
        e.stopPropagation();
        headerText.contentEditable = "true";
        headerText.focus();
        const r = document.createRange();
        r.selectNodeContents(headerText);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      });
      headerText.addEventListener("blur", () => {
        headerText.contentEditable = "false";
        const newText = headerText.textContent || "";
        setPagesState((prev) => {
          const p = [...prev];
          const idx = Math.max(0, index - 1);
          if (p[idx])
            p[idx] = { ...p[idx], header: { ...p[idx].header, content: newText } };
          return p;
        });
        setTimeout(() => schedulePaginateRef.current(), 0);
      });

      footerText.addEventListener("dblclick", (e) => {
        if (readOnly || lockHeaderEditing) return;
        e.preventDefault();
        e.stopPropagation();
        footerText.contentEditable = "true";
        footerText.focus();
        const r = document.createRange();
        r.selectNodeContents(footerText);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      });
      footerText.addEventListener("blur", () => {
        footerText.contentEditable = "false";
        const newText = footerText.textContent || "";
        setPagesState((prev) => {
          const p = [...prev];
          const idx = Math.max(0, index - 1);
          if (p[idx])
            p[idx] = { ...p[idx], footer: { ...p[idx].footer, content: newText } };
          return p;
        });
        setTimeout(() => schedulePaginateRef.current(), 0);
      });

      page.appendChild(logoStrip);
      page.appendChild(header);
      page.appendChild(content);
      page.appendChild(footer);
      sizePageContent(page);

      const ensureFirstBlock = () => {
        if (readOnly) return;
        if (content.querySelector("[data-block-id]")) return;
        const engine = documentEngineRef.current;
        const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, "");
        engine.addBlock(newBlock);
        const p = document.createElement("p");
        p.setAttribute("data-block-id", newBlock.id);
        content.appendChild(p);
        const r = document.createRange();
        r.setStart(p, 0);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      };
      content.addEventListener("focus", ensureFirstBlock);
      content.addEventListener("mousedown", ensureFirstBlock);

      return page;
    },
    [orientation, paperSize, sizePageContent, pagesState, readOnly, syncEditableAttributes]
  );

  const clearPages = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    const pages = container.querySelectorAll(".page");
    pages.forEach(page => {
      const logoMount = page.querySelector(".logo-mount");
      if (logoMount) unmountRoot(logoMount);
    });
    container.innerHTML = "";
  }, [pagesContainerRef]);

  const ensureOnePage = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return null;
    let page = container.querySelector(".page");
    const ps = pagesStateRef.current || pagesState || [];
    const currentParentLogo = parentLogoRef?.current;
    const snapshot = ps[0] || {};
    const pageOrient = snapshot?.orientation || ps[0]?.orientation || orientation || "portrait";
    if (!page) {
      const snapLogo = snapshot?.header?.logo || currentParentLogo || null;
      const snapWithLogo = { 
        ...snapshot, 
        header: { 
          ...(snapshot.header || {}), 
          logo: snapLogo 
        } 
      };
      page = createPage(1, snapWithLogo);
      container.appendChild(page);
      mountLogoForPage(page, 1, snapWithLogo);
    } else {
      page.classList.remove("portrait", "landscape");
      page.classList.add(pageOrient);
      if (paperSize) {
        page.classList.remove("a4", "letter", "legal");
        page.classList.add(paperSize.toLowerCase());
      }
      const pc = page.querySelector(".page-content");
      if (pc) {
        syncEditableAttributes(pc);
      }
    }
    return page;
  }, [pagesContainerRef, pagesState, createPage, orientation, paperSize, mountLogoForPage, parentLogoRef, syncEditableAttributes]);

  const normalizePageContentStructure = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    const contents = Array.from(container.querySelectorAll(".page .page-content"));
    contents.forEach((pc) => {
      syncEditableAttributes(pc);
      const hasAnyBlock = pc.querySelector("[data-block-id]");
      if (!hasAnyBlock) {
        const newBlock = documentEngineRef.current.createBlock(BLOCK_TYPES.PARAGRAPH, "");
        documentEngineRef.current.addBlock(newBlock);
        const p = document.createElement("p");
        p.setAttribute("data-block-id", newBlock.id);
        p.innerHTML = "<br>";
        pc.appendChild(p);
        return;
      }
      const childNodes = Array.from(pc.childNodes);
      childNodes.forEach((n) => {
        const isElement = n.nodeType === 1;
        const isText = n.nodeType === 3;

        if (isElement) {
          // Skip blocks, headers, footers, logo strips, or portaled elements
          if (n.hasAttribute("data-block-id") ||
            n.hasAttribute("data-portal-isolation") ||
            n.closest(".page-header") ||
            n.closest(".page-footer") ||
            n.closest(".page-logo-strip")) {
            return;
          }

          // Ignore empty or whitespace-only elements that don't contain media/structure
          const text = (n.textContent || "").trim();
          if (!text && !n.querySelector("img, table, ol, ul, iframe")) {
            n.remove();
            return;
          }

          // If it's a stray element with content, wrap it in a paragraph block
          const b = documentEngineRef.current.createBlock(BLOCK_TYPES.PARAGRAPH, n.innerHTML || text);
          documentEngineRef.current.addBlock(b);

          const html = documentEngineRef.current.blockToHTML(b);
          const frag = new DOMParser().parseFromString(html, "text/html").body.childNodes;
          n.replaceWith(...Array.from(frag));

        } else if (isText) {
          // Wrap stray text nodes that aren't just whitespace
          const text = (n.nodeValue || "").trim();
          if (text) {
            const b = documentEngineRef.current.createBlock(BLOCK_TYPES.PARAGRAPH, text);
            documentEngineRef.current.addBlock(b);

            const html = documentEngineRef.current.blockToHTML(b);
            const frag = new DOMParser().parseFromString(html, "text/html").body.childNodes;
            n.replaceWith(...Array.from(frag));
          } else {
            // Remove stray whitespace text nodes (including stray \n) between blocks
            n.remove();
          }
        }
      });
    });
  }, [pagesContainerRef, documentEngineRef]);

  const getBlockAndOffset = useCallback((containerNode, offset) => {
    let node = containerNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    const blockEl = node.closest("[data-block-id]");
    if (!blockEl) return null;
    const rootId = blockEl.getAttribute("data-block-id").replace(/(_p\d+)+$/, '');

    // NEW: Calculate absolute position across all fragments of the same logical block
    // to prevent cursor "jumps" to previous pages after re-pagination.
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

    // Table tracking: Save which cell the cursor is in to ensure precision during re-renders
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

        // Find all block fragments that share this root ID to calculate absolute rowIndex
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
    // Use the cell as the range basis if we're in a table to ensure 'pos' is cell-relative
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

    let listInfo = null;
    if (blockEl.tagName.toLowerCase() === 'ul' || blockEl.tagName.toLowerCase() === 'ol') {
      const li = containerNode.nodeType === Node.ELEMENT_NODE ? containerNode.closest('li') : containerNode.parentElement?.closest('li');
      if (li) {
        const lis = Array.from(blockEl.querySelectorAll('li'));
        const itemIndex = lis.indexOf(li);
        
        const preLI = document.createRange();
        preLI.selectNodeContents(li);
        try { preLI.setEnd(containerNode, offset); } catch (e) { preLI.collapse(false); }
        const offsetInItem = preLI.toString().length;
        
        listInfo = {
          itemIndex,
          offsetInItem
        };
      }
    }

    return {
      blockEl,
      blockId: blockEl.getAttribute("data-block-id"),
      pos: absolutePos + pre.toString().length,
      text: blockEl.textContent || "",
      tableCellInfo,
      listInfo
    };
  }, [pagesContainerRef]);

  const createOverflowPage = useCallback((pages, container, pagesState) => {
    const newIndex = pages.length + 1;
    const ps = pagesStateRef.current || pagesState || [];
    const base0 = ps[0] || {};
    const inherit = { id: uuidv4(), header: { content: base0.header?.content || "", logo: base0.header?.logo || parentLogoRef?.current || null, logoText: base0.header?.logoText || "" }, footer: { content: base0.footer?.content || "" } };
    const snapshot = ps[newIndex - 1] || inherit;
    const newPage = createPage(newIndex, snapshot);
    container.appendChild(newPage);
    mountLogoForPage(newPage, newIndex, snapshot);
    sizePageContent(newPage, true);
    const newContent = newPage.querySelector(".page-content");
    newContent.innerHTML = "";
    syncEditableAttributes(newContent);
    return { newPage, newContent };
  }, [createPage, sizePageContent, mountLogoForPage, parentLogoRef, syncEditableAttributes]);

  const ensureEditableNodeForCaret = useCallback((targetNode, offset) => {
    if (!targetNode) return { node: null, offset: 0 };
    const locked = (targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentElement)?.closest?.('[data-locked="true"], .locked-text');
    if (!locked) return { node: targetNode, offset };

    const parent = locked.parentNode;
    if (!parent) return { node: targetNode, offset };

    const nodeLen = targetNode.textContent ? targetNode.textContent.length : 0;
    const placeAfter = offset >= (nodeLen / 2);

    if (placeAfter) {
      let next = locked.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE) {
        return { node: next, offset: 0 };
      }
      const emptyText = document.createTextNode('');
      if (next) {
        parent.insertBefore(emptyText, next);
      } else {
        parent.appendChild(emptyText);
      }
      return { node: emptyText, offset: 0 };
    } else {
      let prev = locked.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        return { node: prev, offset: prev.textContent.length };
      }
      const emptyText = document.createTextNode('');
      parent.insertBefore(emptyText, locked);
      return { node: emptyText, offset: 0 };
    }
  }, []);

  const schedulePaginate = useCallback(() => {
    // Large pastes must always paginate; do not defer behind scroll/selection locks.
    const forcePastePaginate = typeof window !== "undefined" && window.isPasteInProgress;

    if (
      !forcePastePaginate &&
      (window.isResizingTable ||
      window.isInteractingWithEditor ||
      window.isInteractingWithDropdown ||
      window.isUserScrollingEditor)
    ) {
      if (
        window.isInteractingWithEditor ||
        window.isInteractingWithDropdown ||
        window.isUserScrollingEditor
      ) {
        // Queue it for after the interaction is done
        if (!paginateQueuedRef.current) {
          paginateQueuedRef.current = true;
          setTimeout(() => schedulePaginate(), 300);
        }
      }
      return;
    }
    if (isPaginatingRef.current) {
      paginateQueuedRef.current = true;
      return;
    }

    // 1. Selection Guard: Do not paginate while the user is actively selecting text.
    // Paginating replaces the DOM which destroys the browser's native selection range.
    // Skip this guard during paste — selection is often non-collapsed or stale after insert.
    const selection = window.getSelection();
    if (!forcePastePaginate && selection && !selection.isCollapsed) {
      // Check if there is an active image resize in progress
      const isResizingImage = !!document.querySelector("figure.img-block.resizing");
      if (isResizingImage) {
        paginateQueuedRef.current = true;
        return;
      }

      // If the selection is inside the pages container, delay pagination
      if (pagesContainerRef.current?.contains(selection.anchorNode)) {
        // Check if the selection is an image block selection (but not active resizing)
        let isImageSelection = false;
        try {
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
            if (element && (element.closest?.('figure.img-block') || element.querySelector?.('figure.img-block'))) {
              isImageSelection = true;
            }
            if (!isImageSelection && range.startContainer === range.endContainer) {
              const child = range.startContainer.childNodes[range.startOffset];
              if (child && child.nodeType === 1 && child.closest?.('figure.img-block')) {
                isImageSelection = true;
              }
            }
          }
        } catch (e) {
          console.error("Error checking image selection:", e);
        }

        if (!isImageSelection) {
          paginateQueuedRef.current = true;
          return;
        }
      }
    }

    // 2. Throttle immediate calls to 100ms during rapid events (like paste)
    const now = Date.now();
    if (now - lastPaginateTimeRef.current < 100) {
      if (!paginateQueuedRef.current) {
        paginateQueuedRef.current = true;
        setTimeout(() => schedulePaginate(), 100);
      }
      return;
    }
    lastPaginateTimeRef.current = now;

    normalizePageContentStructure();
    const savedScroll = saveEditorScroll(pagesContainerRef.current);
    let savedCaret = null;
    let savedImageBlockId = null;
    let savedDropdownFocus = null;
    const activeEl = document.activeElement;
    if (activeEl?.classList?.contains('cell-dropdown')) {
      const cellEl = activeEl.closest('td, th');
      const tableEl = activeEl.closest('table[data-block-id]');
      if (cellEl && tableEl) {
        const tr = cellEl.parentElement;
        const sections = tableEl.querySelectorAll('thead, tbody');
        const allRows = [];
        sections.forEach((sec) => {
          allRows.push(
            ...Array.from(sec.children).filter((c) => c.tagName.toLowerCase() === 'tr')
          );
        });
        savedDropdownFocus = {
          blockId: tableEl.getAttribute('data-block-id'),
          rowIndex: allRows.indexOf(tr),
          colIndex: Array.from(tr.children).indexOf(cellEl),
          value: activeEl.value,
        };
      }
    }
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        // Detect image selection
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        const fig = element?.closest?.('figure.img-block');
        if (fig) {
          savedImageBlockId = fig.getAttribute('data-block-id');
        } else if (range.startContainer === range.endContainer) {
          const child = range.startContainer.childNodes[range.startOffset];
          if (child && child.nodeType === 1 && child.closest?.('figure.img-block')) {
            savedImageBlockId = child.closest('figure.img-block').getAttribute('data-block-id');
          }
        }

        if (!savedImageBlockId) {
          savedCaret = getBlockAndOffset(range.startContainer, range.startOffset);
        }
      }
    } catch (_) { }

    const container = pagesContainerRef.current;
    if (!container) return;

    // GUARD: If container is hidden (0 dimensions), skip pagination.
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      return;
    }

    // LOCK CONTAINER MIN-HEIGHT during reflow to prevent scrollHeight collapse & browser scroll clamping
    const currentContainerHeight = container.getBoundingClientRect().height;
    if (currentContainerHeight > 0) {
      container.style.minHeight = `${currentContainerHeight}px`;
    }

    isPaginatingRef.current = true;
    isProgrammaticChangeRef.current = true;
    window.isProgrammaticScroll = true;
    window.isPaginatingEditor = true;

    try {
      const firstPage = ensureOnePage();
      if (!firstPage) {
        if (container) container.style.minHeight = "";
        isPaginatingRef.current = false;
        isProgrammaticChangeRef.current = false;
        window.isProgrammaticScroll = false;
        window.isPaginatingEditor = false;
        return;
      }
      const firstContent = firstPage.querySelector(".page-content");
      if (!firstContent) {
        if (container) container.style.minHeight = "";
        isPaginatingRef.current = false;
        isProgrammaticChangeRef.current = false;
        window.isProgrammaticScroll = false;
        window.isPaginatingEditor = false;
        return;
      }
      container.querySelectorAll(".page-content > *").forEach(el => {
        if (!el.hasAttribute("data-block-id")) {
          el.setAttribute("data-block-id", uuidv4());
        }
      });
      // Deduplicate blocks with duplicate IDs in DOM without detaching/reparenting into firstContent
      const nodes = Array.from(container.querySelectorAll(".page-content [data-block-id]"));
      const seen = new Set();
      for (const n of nodes) {
        const id = n.getAttribute("data-block-id");
        if (id && !seen.has(id)) {
          seen.add(id);
        } else {
          n.remove();
        }
      }

      const existingPages = Array.from(container.querySelectorAll(".page"));

      const engine = documentEngineRef.current;
      if (engine && engine.repaginate) {
        sizePageContent(firstPage, true);
        firstPage.getBoundingClientRect();
        if (contentChangeHandlerRef && contentChangeHandlerRef.current) {
          contentChangeHandlerRef.current.syncDOMToBlocks(container);
        }
        engine.repaginate(firstContent, { isCreateMode: !isPreviewMode });
        const enginePages = engine.document.pages;
        if (enginePages.length > 0) {
          // Collect all existing block DOM elements across all pages once so they can be reused in-place
          const allExistingBlockNodes = new Map();
          container.querySelectorAll(".page-content > [data-block-id]").forEach(node => {
            const id = node.getAttribute("data-block-id");
            if (id && !allExistingBlockNodes.has(id)) {
              allExistingBlockNodes.set(id, node);
            }
          });

          const updatePageDOM = (targetContentEl, pageBlocks) => {
            const newChildren = [];
            pageBlocks.forEach(b => {
              const existing = allExistingBlockNodes.get(b.id);
              if (existing) {
                allExistingBlockNodes.delete(b.id);
                if (b.type === BLOCK_TYPES.VIDEO || b.type === BLOCK_TYPES.IMAGE || existing.classList.contains("video-block") || existing.classList.contains("editor-image")) {
                  let data = {};
                  try {
                    data = typeof b.content === "object" ? b.content : JSON.parse(b.content || "{}");
                  } catch (e) {}
                  if (data.align && existing.getAttribute("data-align") !== data.align) existing.setAttribute("data-align", data.align);
                  if (data.width && existing.style.width !== `${data.width}px`) existing.style.width = `${data.width}px`;
                  if (data.height && existing.style.height !== `${data.height}px`) existing.style.height = `${data.height}px`;
                  if (b.type === BLOCK_TYPES.VIDEO || existing.classList.contains("video-block")) {
                    VideoResizeHandler.attachResizeHandles(existing);
                  }
                  newChildren.push(existing);
                } else {
                  const sel = window.getSelection();
                  const isFocused = sel && sel.anchorNode && existing.contains(sel.anchorNode);
                  const html = engine.blockToHTML(b);
                  const temp = document.createElement("div");
                  temp.innerHTML = html;
                  const updatedNode = temp.firstElementChild;
                  if (updatedNode && !isFocused) {
                    const text1 = (existing.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF\u00A0\s]/g, '');
                    const text2 = (updatedNode.textContent || '').replace(/[\u200B\u200C\u200D\uFEFF\u00A0\s]/g, '');
                    const hasComplexChildren = existing.querySelector('img, table, figure, video, iframe, [data-comment-id], [data-suggestededit-id], [data-reference-id]') !== null ||
                      updatedNode.querySelector('img, table, figure, video, iframe, [data-comment-id], [data-suggestededit-id], [data-reference-id]') !== null;

                    if (text1 !== text2 || hasComplexChildren) {
                      if (existing.innerHTML !== updatedNode.innerHTML) {
                        existing.innerHTML = updatedNode.innerHTML;
                      }
                    }
                  }
                  applyAlignmentFromBlock(existing, b);
                  newChildren.push(existing);
                }
              } else {
                const html = engine.blockToHTML(b);
                const temp = document.createElement("div");
                temp.innerHTML = html;
                if (temp.firstElementChild) {
                  const newChild = temp.firstElementChild;
                  applyAlignmentFromBlock(newChild, b);
                  if (b.type === BLOCK_TYPES.VIDEO || newChild.classList.contains("video-block")) {
                    VideoResizeHandler.attachResizeHandles(newChild);
                  }
                  newChildren.push(newChild);
                }
              }
            });

            newChildren.forEach((child, idx) => {
              const isMedia = child.classList.contains("video-block") || child.classList.contains("editor-image") || child.querySelector("iframe, video");

              if (child.parentElement !== targetContentEl) {
                const refNode = targetContentEl.children[idx] || null;
                targetContentEl.insertBefore(child, refNode);
              } else {
                const currentChildren = Array.from(targetContentEl.children);
                const currentIdx = currentChildren.indexOf(child);
                if (currentIdx !== idx && currentIdx !== -1) {
                  if (!isMedia) {
                    const refNode = targetContentEl.children[idx] || null;
                    if (refNode && refNode !== child) {
                      targetContentEl.insertBefore(child, refNode);
                    }
                  }
                }
              }
            });
          };

          for (let i = 0; i < enginePages.length; i++) {
            let page = existingPages[i];
            if (!page) {
              const ps = pagesStateRef.current || pagesState || [];
              const base0 = ps[0] || {};
              const inherit = { id: uuidv4(), header: { content: base0.header?.content || "", logo: base0.header?.logo || parentLogoRef?.current || null, logoText: base0.header?.logoText || "" }, footer: { content: base0.footer?.content || "" } };
              const snapshot = ps[i] || inherit;
              page = createPage(i + 1, snapshot);
              container.appendChild(page);
              mountLogoForPage(page, i + 1, snapshot);
            }
            const content = page.querySelector(".page-content");
            if (content) {
              updatePageDOM(content, enginePages[i].blocks);
              sizePageContent(page, false);
            }
          }

          // Remove any orphaned block DOM nodes that are no longer in any page
          allExistingBlockNodes.forEach(oldNode => oldNode.remove());

          for (let i = enginePages.length; i < existingPages.length; i++) {
            const pg = existingPages[i];
            const logoMount = pg.querySelector(".logo-mount");
            if (logoMount) unmountRoot(logoMount);
            pg.remove();
          }
        }
      } else {
        sizePageContent(firstPage, true);
        firstPage.getBoundingClientRect();
        const items = Array.from(firstContent.querySelectorAll(":scope > [data-block-id]"));
        firstContent.innerHTML = "";
        let pages = [firstPage];
        let currentContent = firstContent;
        for (const el of items) {
          currentContent.appendChild(el);
          currentContent.getBoundingClientRect();
          if (currentContent.scrollHeight > currentContent.clientHeight + 1) {
            currentContent.removeChild(el);
            const newIndex = pages.length + 1;
            let newPage = existingPages[newIndex - 1];
            let newContent;
            if (!newPage) {
              const res = createOverflowPage(pages, container, pagesState);
              newPage = res.newPage; newContent = res.newContent;
            } else {
              newContent = newPage.querySelector(".page-content"); newContent.innerHTML = "";
            }
            pages.push(newPage); currentContent = newContent; currentContent.appendChild(el); currentContent.getBoundingClientRect();
          }
        }
        for (let i = pages.length; i < existingPages.length; i++) {
          const pg = existingPages[i];
          const logoMount = pg.querySelector(".logo-mount");
          if (logoMount) unmountRoot(logoMount);
          pg.remove();
        }
        Array.from(container.querySelectorAll(".page")).forEach(page => sizePageContent(page, false));
      }

      const allPages = Array.from(container.querySelectorAll(".page"));
      for (let i = allPages.length - 1; i >= 1; i--) {
        const pg = allPages[i];
        if (!pg.querySelector(".page-content [data-block-id]") && !(pg.querySelector(".page-content")?.textContent || "").trim()) {
          const logoMount = pg.querySelector(".logo-mount");
          if (logoMount) unmountRoot(logoMount);
          pg.remove();
        }
      }

      const finalPagesForSizing = Array.from(container.querySelectorAll(".page"));
      finalPagesForSizing.forEach((page, idx) => {
        const ps = pagesStateRef.current || pagesState || [];
        const pageOrient = ps[idx]?.orientation || orientation || "portrait";
        page.classList.remove("portrait", "landscape");
        page.classList.add(pageOrient);
        if (paperSize) {
          page.classList.remove("a4", "letter", "legal");
          page.classList.add(paperSize.toLowerCase());
        }
        sizePageContent(page, false);
        const pc = page.querySelector(".page-content");
        if (pc) {
          syncEditableAttributes(pc);
          const fb = pc.querySelector("[data-block-id]:first-child");
          if (fb) { fb.style.marginTop = "0"; fb.style.paddingTop = "0"; }
        }
      });

      const finalPages = Array.from(container.querySelectorAll(".page"));
      finalPages.forEach((p, idx) => p.dataset.pageIndex = `Page ${idx + 1} of ${finalPages.length}`);
      setPageCount(finalPages.length);

      const updateCurrentPageFromSelection = () => {
        const sel = document.getSelection();
        if (sel && sel.anchorNode) {
          const anchorNode = sel.anchorNode;
          const el = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement;
          const owning = el?.closest?.(".page");
          if (owning) {
            const idx = finalPages.indexOf(owning);
            if (idx >= 0) setCurrentPage(idx + 1);
          }
        }
      };

      container.querySelectorAll(".page-content").forEach((pageContentEl) => {
        syncEditableAttributes(pageContentEl);
      });

      container.querySelectorAll(".page-content [data-block-id]").forEach(el => {
        const id = el.getAttribute("data-block-id");
        const blk = documentEngineRef.current.getBlock(id);
        if (el.classList.contains('page-break-marker') || el.getAttribute('data-page-break') === 'true' || blk?.type === BLOCK_TYPES.PAGE_BREAK) {
          if (el.getAttribute("contenteditable") !== "false") {
            el.setAttribute("contenteditable", "false");
          }
          return;
        }
        if (readOnly || blk?.locked) {
          if (el.getAttribute("contenteditable") !== "false") {
            el.setAttribute("contenteditable", "false");
          }
          if (blk?.locked) {
            const expectedStyle = `${el.getAttribute("style") || ""};${LOCKED_STYLE}`;
            if (el.getAttribute("style") !== expectedStyle) {
              el.setAttribute("style", expectedStyle);
            }
          }
        } else {
          if (el.hasAttribute("contenteditable")) {
            el.removeAttribute("contenteditable");
          }
          const currentStyle = el.getAttribute("style");
          if (currentStyle && (currentStyle.includes("background") || currentStyle.includes("border-left"))) {
            const newStyle = currentStyle
              .split(";")
              .filter(s => {
                const trimmed = s.trim();
                return trimmed && !trimmed.startsWith("background") && !trimmed.startsWith("border-left");
              })
              .join(";");
            const normalizedCurrent = currentStyle
              .split(";")
              .map(s => s.trim())
              .filter(Boolean)
              .join(";");
            if (newStyle !== normalizedCurrent) {
              if (newStyle) {
                el.setAttribute("style", newStyle);
              } else {
                el.removeAttribute("style");
              }
            }
          }
        }
      });
      container.querySelectorAll(".locked-text.locked").forEach(el => el.setAttribute("contenteditable", "false"));
      applyDropdownCellGuards(container, readOnly);
      const ps = pagesStateRef.current || pagesState || [];
      const pageLogo = ps[0]?.header?.logo || null;
      const parentLogo = parentLogoRef?.current;
      const logoAfterPaginate = parentLogoRef
        ? mergeLogoForDisplay(pageLogo, parentLogo)
        : pageLogo;
      updateAllLogoImgs(logoAfterPaginate);

      if (savedImageBlockId) {
        const figEl = container.querySelector(`figure.img-block[data-block-id="${savedImageBlockId}"]`);
        if (figEl) {
          figEl.classList.add("selected");
          const r = document.createRange();
          r.selectNode(figEl);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          restoreEditorScroll(savedScroll, true);
          updateCurrentPageFromSelection();
        }
      } else if (savedCaret && savedCaret.blockId != null) {
        // Strip any _pX suffixes to get the root ID
        const rootId = savedCaret.blockId.replace(/(_p\d+)+$/, '');

        // Find all blocks that share this root ID (they are continuations)
        const possibleBlocks = Array.from(container.querySelectorAll(`[data-block-id]`))
          .filter(el => {
            const id = el.getAttribute('data-block-id');
            return id === rootId || id.startsWith(rootId + '_p');
          });

        if (possibleBlocks.length > 0) {
          let restored = false;

          // If it's a table with cell info, use absolute table cell resolution
          if (savedCaret.tableCellInfo && possibleBlocks[0].tagName.toLowerCase() === 'table') {
            const { rowIndex, colIndex } = savedCaret.tableCellInfo;
            let allRows = [];
            possibleBlocks.forEach(blockEl => {
              if (blockEl.tagName.toLowerCase() === 'table') {
                const sections = blockEl.querySelectorAll('thead, tbody');
                sections.forEach(sec => {
                  allRows.push(...Array.from(sec.children).filter(c => c.tagName.toLowerCase() === 'tr'));
                });
              }
            });
            const row = allRows[rowIndex];
            const cell = row?.children[colIndex];
            if (cell) {
              const selectEl = cell.querySelector('select.cell-dropdown');
              if (selectEl) {
                selectEl.focus({ preventScroll: true });
                restored = true;
              } else {
                let remaining = savedCaret.pos != null ? savedCaret.pos : 0;
                let foundNode = null;
                let lastNode = null;

                const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
                let node = walker.nextNode();
                while (node) {
                  lastNode = node;
                  if (remaining <= node.textContent.length) {
                    foundNode = node;
                    break;
                  }
                  remaining -= node.textContent.length;
                  node = walker.nextNode();
                }

                const range = document.createRange();
                let targetNode = foundNode;
                let targetOffset = Math.max(0, remaining);
                if (!targetNode && lastNode) {
                  targetNode = lastNode;
                  targetOffset = lastNode.textContent.length;
                }
                if (targetNode) {
                  const safeCaret = ensureEditableNodeForCaret(targetNode, targetOffset);
                  range.setStart(safeCaret.node, safeCaret.offset);
                } else {
                  range.setStart(cell, cell.childNodes.length);
                }
                range.collapse(true);
                const targetPc = (cell?.nodeType === 1 ? cell : cell?.parentElement)?.closest?.(".page-content");
                if (targetPc && document.activeElement !== targetPc) {
                  try { targetPc.focus({ preventScroll: true }); } catch (_) {}
                }
                const s = window.getSelection();
                const curRange = s && s.rangeCount > 0 ? s.getRangeAt(0) : null;
                const isSame = curRange &&
                  curRange.startContainer === range.startContainer &&
                  curRange.startOffset === range.startOffset &&
                  curRange.collapsed;
                if (!isSame) {
                  s.removeAllRanges();
                  s.addRange(range);
                }
                restoreEditorScroll(savedScroll, true);
                updateCurrentPageFromSelection();
                restored = true;
              }
            }
          }

          if (!restored && savedCaret.listInfo && (possibleBlocks[0].tagName.toLowerCase() === 'ul' || possibleBlocks[0].tagName.toLowerCase() === 'ol')) {
            const { itemIndex, offsetInItem } = savedCaret.listInfo;
            const allLIs = [];
            possibleBlocks.forEach(blockEl => {
              if (blockEl.tagName.toLowerCase() === 'ul' || blockEl.tagName.toLowerCase() === 'ol') {
                allLIs.push(...Array.from(blockEl.querySelectorAll('li')));
              }
            });
            const li = allLIs[itemIndex];
            if (li) {
              let remaining = offsetInItem;
              let foundNode = null;
              let lastNode = null;

              const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, null);
              let node = walker.nextNode();
              while (node) {
                lastNode = node;
                if (remaining <= node.textContent.length) {
                  foundNode = node;
                  break;
                }
                remaining -= node.textContent.length;
                node = walker.nextNode();
              }

              const range = document.createRange();
              let targetNode = foundNode;
              let targetOffset = Math.max(0, remaining);
              if (!targetNode && lastNode) {
                targetNode = lastNode;
                targetOffset = lastNode.textContent.length;
              }
              if (targetNode) {
                const safeCaret = ensureEditableNodeForCaret(targetNode, targetOffset);
                range.setStart(safeCaret.node, safeCaret.offset);
              } else {
                range.setStart(li, 0);
              }
              range.collapse(true);
              const targetPc = (targetNode?.nodeType === 1 ? targetNode : targetNode?.parentElement)?.closest?.(".page-content") || li?.closest?.(".page-content");
              if (targetPc && document.activeElement !== targetPc) {
                try { targetPc.focus({ preventScroll: true }); } catch (_) {}
              }
              const s = window.getSelection();
              const curRange = s && s.rangeCount > 0 ? s.getRangeAt(0) : null;
              const isSame = curRange &&
                curRange.startContainer === range.startContainer &&
                curRange.startOffset === range.startOffset &&
                curRange.collapsed;
              if (!isSame) {
                s.removeAllRanges();
                s.addRange(range);
              }
              restoreEditorScroll(savedScroll, true);
              updateCurrentPageFromSelection();
              restored = true;
            }
          }

          if (!restored) {
            let remaining = savedCaret.pos != null ? savedCaret.pos : 0;
            let foundNode = null;
            let lastNode = null;

            for (const blockEl of possibleBlocks) {
              const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
              let node = walker.nextNode();
              while (node) {
                lastNode = node;
                if (remaining <= node.textContent.length) {
                  foundNode = node;
                  break;
                }
                remaining -= node.textContent.length;
                node = walker.nextNode();
              }
              if (foundNode) break;
            }

            const range = document.createRange();
            let targetNode = foundNode;
            let targetOffset = Math.max(0, remaining);
            if (!targetNode && lastNode) {
              targetNode = lastNode;
              targetOffset = lastNode.textContent.length;
            }
            if (targetNode) {
              const safeCaret = ensureEditableNodeForCaret(targetNode, targetOffset);
              range.setStart(safeCaret.node, safeCaret.offset);
            } else {
              const lastBlock = possibleBlocks[possibleBlocks.length - 1];
              range.setStart(lastBlock, lastBlock.childNodes.length);
            }
            range.collapse(true);
            const targetPc = (targetNode?.nodeType === 1 ? targetNode : targetNode?.parentElement)?.closest?.(".page-content");
            if (targetPc && document.activeElement !== targetPc) {
              try { targetPc.focus({ preventScroll: true }); } catch (_) {}
            }
            const s = window.getSelection();
            const curRange = s && s.rangeCount > 0 ? s.getRangeAt(0) : null;
            const isSame = curRange &&
              curRange.startContainer === range.startContainer &&
              curRange.startOffset === range.startOffset &&
              curRange.collapsed;
            if (!isSame) {
              s.removeAllRanges();
              s.addRange(range);
            }
            restoreEditorScroll(savedScroll, true);
            updateCurrentPageFromSelection();
          }
        }
      }

      if (savedDropdownFocus) {
        const rootId = savedDropdownFocus.blockId.replace(/(_p\d+)+$/, '');
        const possibleBlocks = Array.from(container.querySelectorAll('[data-block-id]'))
          .filter((el) => {
            const id = el.getAttribute('data-block-id');
            return id === rootId || id.startsWith(`${rootId}_p`);
          });

        let allRows = [];
        possibleBlocks.forEach((blockEl) => {
          if (blockEl.tagName.toLowerCase() === 'table') {
            blockEl.querySelectorAll('thead, tbody').forEach((sec) => {
              allRows.push(
                ...Array.from(sec.children).filter((c) => c.tagName.toLowerCase() === 'tr')
              );
            });
          }
        });

        const row = allRows[savedDropdownFocus.rowIndex];
        const cell = row?.children[savedDropdownFocus.colIndex];
        const selectEl = cell?.querySelector('select.cell-dropdown');
        if (selectEl) {
          if (savedDropdownFocus.value != null) {
            selectEl.value = savedDropdownFocus.value;
          }
          selectEl.focus({ preventScroll: true });
          restoreEditorScroll(savedScroll, true);
          updateCurrentPageFromSelection();
        }
      }

      // Release temporary min-height lock
      if (container) {
        container.style.minHeight = "";
      }

      const sel = window.getSelection();
      const hasEditorSelection = sel && sel.rangeCount > 0 && (
        container?.contains(sel.anchorNode) ||
        container?.contains(sel.focusNode) ||
        document.activeElement === container ||
        container?.contains(document.activeElement)
      );
      const shouldEnsureCaret = !window.isUserScrollingEditor && hasEditorSelection && Boolean(caretManagerRef?.current?.needsEnsureCaret);

      restoreEditorScroll(savedScroll, false);
      restoreEditorScrollAfterLayout(savedScroll, () => {
        if (shouldEnsureCaret && caretManagerRef?.current) {
          caretManagerRef.current.ensureCaretVisible({ isEditingAction: true });
        }
      });

      isPaginatingRef.current = false;
      setTimeout(() => {
        isProgrammaticChangeRef.current = false;
        window.isProgrammaticScroll = false;
        window.isPaginatingEditor = false;
        if (paginateQueuedRef.current) { paginateQueuedRef.current = false; schedulePaginateRef.current(); }
      }, 50);
    } catch (err) {
      console.error("[Pagination] Error:", err);
      if (container) {
        container.style.minHeight = "";
      }
      isPaginatingRef.current = false;
      window.isProgrammaticScroll = false;
      window.isPaginatingEditor = false;
      setTimeout(() => isProgrammaticChangeRef.current = false, 50);
    }
  }, [createPage, createOverflowPage, normalizePageContentStructure, pagesState, sizePageContent, sizeAllPages, updateAllLogoImgs, getBlockAndOffset, pagesContainerRef, documentEngineRef, setPageCount, setCurrentPage, ensureOnePage, mountLogoForPage, caretManagerRef, readOnly, syncEditableAttributes]);

  const renderFreshFromEngine = useCallback((customCaret = null) => {
    if (window.isResizingTable) return;
    const container = pagesContainerRef.current;
    if (!container) return;
    const savedScroll = saveEditorScroll(container);
    const currentContainerHeight = container.getBoundingClientRect().height;
    if (currentContainerHeight > 0) {
      container.style.minHeight = `${currentContainerHeight}px`;
    }
    isProgrammaticChangeRef.current = true;
    window.isProgrammaticScroll = true;
    window.isPaginatingEditor = true;

    const sel = window.getSelection();
    let saved = null;
    if (customCaret) {
      saved = customCaret;
    } else if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const caret = getBlockAndOffset(range.startContainer, range.startOffset);
      if (caret) {
        saved = {
          blockId: caret.blockId,
          offset: caret.pos,
          tableCellInfo: caret.tableCellInfo
        };
      }
    }
    clearPages();
    const firstPage = ensureOnePage();
    if (!firstPage) {
      if (container) container.style.minHeight = "";
      isProgrammaticChangeRef.current = false;
      window.isProgrammaticScroll = false;
      window.isPaginatingEditor = false;
      return;
    }
    const firstContent = firstPage.querySelector(".page-content");
    if (!firstContent) {
      if (container) container.style.minHeight = "";
      isProgrammaticChangeRef.current = false;
      window.isProgrammaticScroll = false;
      window.isPaginatingEditor = false;
      return;
    }
    firstContent.innerHTML = documentEngineRef.current.toHTML();
    syncEditableAttributes(firstContent);
    firstContent.querySelectorAll("[data-block-id]").forEach((el) => {
      const id = el.getAttribute("data-block-id");
      const blk = documentEngineRef.current.getBlock(id);
      if (el.classList.contains('page-break-marker') || el.getAttribute('data-page-break') === 'true' || blk?.type === BLOCK_TYPES.PAGE_BREAK) {
        el.setAttribute("contenteditable", "false");
        return;
      }
      if (readOnly || blk?.locked) {
        el.setAttribute("contenteditable", "false");
        if (blk?.locked) {
          el.setAttribute("style", `${el.getAttribute("style") || ""};${LOCKED_STYLE}`);
        }
      } else {
        el.removeAttribute("contenteditable");
      }
    });
    firstContent.querySelectorAll(".locked-text.locked").forEach((el) => el.setAttribute("contenteditable", "false"));
    applyDropdownCellGuards(firstContent, readOnly);
    sizePageContent(firstPage);
    updateAllLogoImgs(parentLogoRef?.current || pagesStateRef.current?.[0]?.header?.logo || null);
    schedulePaginateRef.current();
    requestAnimationFrame(() => {
      if (saved) {
        const anchorEl = container?.querySelector(`[data-block-id="${saved.blockId}"]`);
        if (anchorEl) {
          const rootId = saved.blockId.replace(/(_p\d+)+$/, '');
          const possibleBlocks = Array.from(container.querySelectorAll(`[data-block-id]`))
            .filter(el => {
              const id = el.getAttribute('data-block-id');
              return id === rootId || id.startsWith(rootId + '_p');
            });

          if (possibleBlocks.length > 0) {
            let restored = false;

            if (saved.tableCellInfo && possibleBlocks[0].tagName.toLowerCase() === 'table') {
              const { rowIndex, colIndex } = saved.tableCellInfo;
              let allRows = [];
              possibleBlocks.forEach(blockEl => {
                if (blockEl.tagName.toLowerCase() === 'table') {
                  const sections = blockEl.querySelectorAll('thead, tbody');
                  sections.forEach(sec => {
                    allRows.push(...Array.from(sec.children).filter(c => c.tagName.toLowerCase() === 'tr'));
                  });
                }
              });
              const row = allRows[rowIndex];
              const cell = row?.children[colIndex];
              if (cell) {
                const selectEl = cell.querySelector('select.cell-dropdown');
                if (selectEl) {
                  selectEl.focus({ preventScroll: true });
                  restoreEditorScroll(savedScroll, true);
                  restored = true;
                } else {
                  let remaining = saved.offset != null ? saved.offset : 0;
                  let foundNode = null;
                  let lastNode = null;

                  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
                  let node = walker.nextNode();
                  while (node) {
                    lastNode = node;
                    if (remaining <= node.textContent.length) {
                      foundNode = node;
                      break;
                    }
                    remaining -= node.textContent.length;
                    node = walker.nextNode();
                  }

                  const range = document.createRange();
                  if (foundNode) {
                    range.setStart(foundNode, Math.max(0, remaining));
                  } else if (lastNode) {
                    range.setStart(lastNode, lastNode.textContent.length);
                  } else {
                    range.setStart(cell, cell.childNodes.length);
                  }
                  range.collapse(true);
                  if (container && container.focus) {
                    try { container.focus({ preventScroll: true }); } catch (_) {}
                  }
                  const s = window.getSelection();
                  s.removeAllRanges();
                  s.addRange(range);
                  restoreEditorScroll(savedScroll, true);
                  restored = true;
                }
              }
            }

            if (!restored) {
              let remaining = saved.offset;
              let foundNode = null;
              let lastNode = null;

              for (const blockEl of possibleBlocks) {
                const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
                let node = walker.nextNode();
                while (node) {
                  lastNode = node;
                  if (remaining <= node.textContent.length) {
                    foundNode = node;
                    break;
                  }
                  remaining -= node.textContent.length;
                  node = walker.nextNode();
                }
                if (foundNode) break;
              }

              const r = document.createRange();
              if (foundNode) {
                r.setStart(foundNode, Math.max(0, Math.min(remaining, foundNode.textContent.length)));
              } else if (lastNode) {
                r.setStart(lastNode, lastNode.textContent.length);
              } else {
                const lastBlock = possibleBlocks[possibleBlocks.length - 1];
                r.setStart(lastBlock, lastBlock.childNodes.length);
              }
              r.collapse(true);
              if (container && container.focus) {
                try { container.focus({ preventScroll: true }); } catch (_) {}
              }
              const s = window.getSelection();
              s.removeAllRanges();
              s.addRange(r);
              restoreEditorScroll(savedScroll, true);
            }
          }
        }
      }
      if (container) {
        container.style.minHeight = "";
      }
      const sel = window.getSelection();
      const hasEditorSelection = sel && sel.rangeCount > 0 && (
        container?.contains(sel.anchorNode) ||
        container?.contains(sel.focusNode) ||
        document.activeElement === container ||
        container?.contains(document.activeElement)
      );
      const shouldEnsureCaret = !window.isUserScrollingEditor && hasEditorSelection && Boolean(caretManagerRef?.current?.needsEnsureCaret);

      restoreEditorScroll(savedScroll, false);
      restoreEditorScrollAfterLayout(savedScroll, () => {
        if (shouldEnsureCaret && caretManagerRef?.current) {
          caretManagerRef.current.ensureCaretVisible({ isEditingAction: true });
        }
      });
      isProgrammaticChangeRef.current = false;
      window.isProgrammaticScroll = false;
      window.isPaginatingEditor = false;
    });
  }, [sizePageContent, clearPages, ensureOnePage, pagesContainerRef, documentEngineRef, getBlockAndOffset, caretManagerRef, readOnly, syncEditableAttributes]);

  useEffect(() => {
    schedulePaginateRef.current = schedulePaginate;
  }, [schedulePaginate, schedulePaginateRef]);

  useEffect(() => {
    renderFreshFromEngineRef.current = renderFreshFromEngine;
  }, [renderFreshFromEngine, renderFreshFromEngineRef]);

  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root) return;
    const headers = root.querySelectorAll(".header-text");
    headers.forEach((h) => {
      if (h.contentEditable !== "true" && document.activeElement !== h) {
        const textToSet = pagesState[0]?.header?.content || "";
        if (h.textContent !== textToSet) h.textContent = textToSet;
      }
    });
    const footers = root.querySelectorAll(".footer-text");
    footers.forEach((f) => {
      if (f.contentEditable !== "true" && document.activeElement !== f) {
        const textToSet = pagesState[0]?.footer?.content || "";
        if (f.textContent !== textToSet) f.textContent = textToSet;
      }
    });
  }, [pagesState, pagesContainerRef]);

  return {
    schedulePaginate,
    renderFreshFromEngine,
    createPage,
    sizeAllPages,
    updateAllLogoImgs,
    getBlockAndOffset,
    ensureOnePage,
    normalizePageContentStructure,
    isPaginatingRef,
    paginateQueuedRef,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    isProgrammaticChangeRef,
    sizePageContent,
    sizePageContentRef,
    cleanupPage: useCallback((pageEl) => {
      const logoMount = pageEl?.querySelector(".logo-mount");
      if (logoMount) unmountRoot(logoMount);
    }, [])
  };
};

export default usePageManagement;


