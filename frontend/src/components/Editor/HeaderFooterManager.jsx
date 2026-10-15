import React, { useEffect, useRef, useState } from "react";

/**
 * HeaderFooterManager
 * Google Docs–style shared header & footer, managed from one place.
 *
 * Props:
 * - containerRef: ref to the element that contains all .page nodes
 * - docId: string key for persistence (localStorage fallback)
 * - options?: {
 *     pageSelector?: string;           // default ".page"
 *     headerSelector?: string;         // default ".page-header"
 *     footerSelector?: string;         // default ".page-footer"
 *     footerEditSelector?: string;     // default ".page-footer .footer-left, .page-footer"
 *     pageNumSelector?: string;        // default ".page-footer [data-page-num]"
 *     injectStyles?: boolean;          // default true (injects editing highlight CSS)
 *   }
 */
export default function HeaderFooterManager({
  containerRef,
  headerHTML: initialHeaderHTML = "",
  footerHTML: initialFooterHTML = "",
  onChange,
  options = {},
}) {
  const {
    pageSelector = ".page",
    headerSelector = ".page-header",
    footerSelector = ".page-footer",
    footerEditSelector = ".page-footer .footer-left, .page-footer", // prefer left area if present
    pageNumSelector = ".page-footer [data-page-num]",
    injectStyles = true,
    lockHeaderEditing = false,
  } = options;

  const [headerHTML, setHeaderHTML] = useState(initialHeaderHTML);
  const [footerHTML, setFooterHTML] = useState(initialFooterHTML);
  const [mode, setMode] = useState(null); // "header" | "footer" | null
  const modeRef = useRef(null); // Keep mode in ref for event handlers
  const masterElRef = useRef(null);
  const styleTagRef = useRef(null);
  const moRef = useRef(null); // MutationObserver
  const autoSyncTimerRef = useRef(null); // <-- NEW
  const lockHeaderEditingRef = useRef(lockHeaderEditing);
  lockHeaderEditingRef.current = lockHeaderEditing;

  // keep instant mirrors while typing (no 1-keystroke lag)
  const headerHTMLRef = useRef(initialHeaderHTML);
  const footerHTMLRef = useRef(initialFooterHTML);

  // Sync state and refs when props change
  useEffect(() => {
    if (initialHeaderHTML !== undefined && initialHeaderHTML !== headerHTMLRef.current) {
      setHeaderHTML(initialHeaderHTML);
      headerHTMLRef.current = initialHeaderHTML;
    }
  }, [initialHeaderHTML]);

  useEffect(() => {
    if (initialFooterHTML !== undefined && initialFooterHTML !== footerHTMLRef.current) {
      setFooterHTML(initialFooterHTML);
      footerHTMLRef.current = initialFooterHTML;
    }
  }, [initialFooterHTML]);

  useEffect(() => { headerHTMLRef.current = headerHTML; }, [headerHTML]);
  useEffect(() => { footerHTMLRef.current = footerHTML; }, [footerHTML]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ---------- style injection (so you don't have to touch Editor.css right now)
  useEffect(() => {
    if (!injectStyles) return;
    const css = `
      /* Google Docs-style header/footer guidelines */
      .page-header::after {
        content: "";
        position: absolute;
        left: 2cm;
        right: 2cm;
        height: 1px;
        background: #ccc;
        opacity: 0.8;
        bottom: 0;
      }
      .page-footer::before {
        content: "";
        position: absolute;
        left: 2cm;
        right: 2cm;
        height: 2px;
        background: #a0a0a0;
        opacity: 1.0;
        top: 0;
      }

      /* Show "Header" and "Footer" labels when editing */
      .hf-mode--header .page-header::before,
      .hf-mode--footer .page-footer::after {
        content: attr(data-label);
        position: absolute;
        left: 2cm;
        top: -18px;
        font-size: 10px;
        font-style: italic;
        color: #666;
        background: #fff;
        padding: 0 4px;
      }

      .hf-mode--footer .page-footer::after {
        top: auto;
        bottom: -18px;
      }

      .hf-master { outline: none !important; }
      .hf-mirror { caret-color: transparent; }
      .page-header, .page-footer { 
        position: relative; 
        line-height: 1.2; 
        white-space: pre-wrap; 
        word-wrap: break-word; 
        overflow-wrap: anywhere;
        word-break: break-word;
        overflow: hidden; 
        max-width: 100%;
        box-sizing: border-box;
      }
      /* Footer strictly single-line */
      .hf-mode--footer .page-footer.hf-master,
      .hf-mode--footer .footer-left.hf-master {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
      }
      /* Header max 2 lines */
      .hf-mode--header .page-header.hf-master {
        max-height: 2.4em; /* 1.2 line-height * 2 */
      }
      .page-header:empty::before, .page-footer:has(.footer-left:empty)::before,
      .page-footer:empty::before {
        content:"Click to add header/footer"; opacity:.35; font-style:italic;
      }
    `;
    const tag = document.createElement("style");
    tag.setAttribute("data-hf", "true");
    tag.textContent = css;
    document.head.appendChild(tag);
    styleTagRef.current = tag;
    return () => {
      tag.remove();
      styleTagRef.current = null;
    };
  }, [injectStyles]);

  // ---------- persistence
  const persistHF = () => {
    if (onChange) {
      onChange({
        headerHTML: headerHTMLRef.current,
        footerHTML: footerHTMLRef.current,
      });
    }
  };
  const restoreHF = () => {
    // No-op: restored from props
  };

  // ---------- utilities
  const root = () => containerRef?.current || document;
  const pages = () => {
    const container = root();
    const pageList = container ? Array.from(container.querySelectorAll(pageSelector)) : [];
    return pageList;
  };
  const placeCaretAtEnd = (el) => {
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  };

  const updatePageNumbers = () => {
    const pageList = pages();
    if (!pageList || pageList.length === 0) return;
    pageList.forEach((p, i) => {
      const numEl = p.querySelector(pageNumSelector);
      if (numEl) numEl.textContent = String(i + 1);
    });
  };

  // --- signature helpers for robust detection of newly created pages (NEW)
  const lastSigRef = useRef("");
  const computePageSignature = () => {
    const list = pages();
    // length + each page element reference id (fallback to outerHTML length)
    const ids = list.map((el) => el.dataset.pageIndex || el.id || el.outerHTML.length).join("|");
    return `${list.length}#${ids}`;
  };
  const ensureAutoSyncRunning = () => {
    if (autoSyncTimerRef.current) return;
    lastSigRef.current = computePageSignature();
    autoSyncTimerRef.current = setInterval(() => {
      const sig = computePageSignature();
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        attachDblclick();
        syncMirrors();
      }
    }, 300);
  };
  const stopAutoSync = () => {
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
  };

  // Mirror helper (can use "live" content while typing)
  const syncMirrors = (liveHeaderHTML, liveFooterHTML) => {
    const pageList = pages();
    const currentMode = modeRef.current;

    if (!pageList || pageList.length === 0) return;

    const hHTML = (liveHeaderHTML ?? headerHTMLRef.current ?? "").replace(/data-block-id="[^"]*"/g, "");
    const fHTML = (liveFooterHTML ?? footerHTMLRef.current ?? "").replace(/data-block-id="[^"]*"/g, "");

    pageList.forEach((p, index) => {
      const h = p.querySelector(headerSelector);
      const fEdit = p.querySelector(footerEditSelector);

      if (h && h !== masterElRef.current) {
        if (h.innerHTML !== hHTML) {
          h.innerHTML = hHTML;
        }
        if (currentMode === "header" && h.classList) {
          h.contentEditable = "false";
          h.classList.add("hf-mirror");
        }
      }
      if (fEdit && fEdit !== masterElRef.current) {
        if (fEdit.innerHTML !== fHTML) {
          fEdit.innerHTML = fHTML;
        }
        if (currentMode === "footer" && fEdit.classList) {
          fEdit.contentEditable = "false";
          fEdit.classList.add("hf-mirror");
        }
      }
    });

    updatePageNumbers();

    // keep the master editable if we're in edit mode
    if (masterElRef.current && currentMode) {
      masterElRef.current.contentEditable = "true";
    }
  };

  // ---------- enter / exit edit mode
  const enterMode = (kind, masterEl) => {
    console.log('enterMode called:', { kind, masterEl });
    const container = root();
    setMode(kind);
    masterElRef.current = masterEl;

    if (container && container.classList) {
      container.classList.toggle("hf-mode--header", kind === "header");
      container.classList.toggle("hf-mode--footer", kind === "footer");
    }

    // ensure only the master is editable and lock content areas
    pages().forEach((p) => {
      const h = p.querySelector(headerSelector);
      const fEdit = p.querySelector(footerEditSelector);
      const content = p.querySelector(".page-content");

      if (h && h.classList) {
        h.classList.remove("hf-master", "hf-mirror");
        h.contentEditable = "false";
      }
      if (fEdit && fEdit.classList) {
        fEdit.classList.remove("hf-master", "hf-mirror");
        fEdit.contentEditable = "false";
      }
      if (content) {
        // while editing header/footer, content must not receive focus/keystrokes
        content.setAttribute(
          "data-prev-editable",
          content.getAttribute("contenteditable") || ""
        );
        content.contentEditable = "false";
      }
    });

    if (masterEl && masterEl.classList) {
      masterEl.classList.add("hf-master");
    }
    masterEl.contentEditable = "true";

    // Ensure focus stays in the header/footer
    setTimeout(() => {
      masterEl.focus();
      placeCaretAtEnd(masterEl);
    }, 0);

    // live input wiring
    masterEl.addEventListener("input", onMasterInput, { passive: true });
    masterEl.addEventListener("beforeinput", onMasterBeforeInput, { passive: false });
    masterEl.addEventListener("blur", (e) => {
      // Prevent blur if we're still in edit mode
      if (mode) {
        e.preventDefault();
        setTimeout(() => masterEl.focus(), 0);
      }
    });
    window.addEventListener("mousedown", onOutsideClick, true);
    window.addEventListener("keydown", onKeydown, true);

    // start robust syncing while in edit mode (NEW)
    ensureAutoSyncRunning();

    syncMirrors();
  };

  const exitMode = () => {
    const container = root();
    const master = masterElRef.current;

    if (container && container.classList) {
      container.classList.remove("hf-mode--header", "hf-mode--footer");
    }

    pages().forEach((p) => {
      const h = p.querySelector(headerSelector);
      const fEdit = p.querySelector(footerEditSelector);
      const content = p.querySelector(".page-content");

      if (h && h.classList) {
        h.classList.remove("hf-master", "hf-mirror");
        h.contentEditable = "false";
      }
      if (fEdit && fEdit.classList) {
        fEdit.classList.remove("hf-master", "hf-mirror");
        fEdit.contentEditable = "false";
      }
      if (content) {
        const prev = content.getAttribute("data-prev-editable");
        content.contentEditable = (prev === "" || prev === null) ? "true" : prev; // default to true
        content.removeAttribute("data-prev-editable");
      }
    });

    if (master) {
      master.removeEventListener("input", onMasterInput);
      master.removeEventListener("beforeinput", onMasterBeforeInput);
    }
    window.removeEventListener("mousedown", onOutsideClick, true);
    window.removeEventListener("keydown", onKeydown, true);

    masterElRef.current = null;
    setMode(null);
    syncMirrors();
    persistHF();

    // stop robust syncing once we leave edit mode (NEW)
    stopAutoSync();
  };

  // ---------- handlers
  const onMasterBeforeInput = (e) => {
    const master = masterElRef.current;
    if (!master) return;

    const currentMode = modeRef.current;

    // Always allow deletions
    if (e.inputType?.startsWith('delete')) return;

    if (currentMode === "footer") {
      // Prevent any line breaks in footer
      if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
        e.preventDefault();
        return;
      }

      // Check for horizontal overflow
      // If scrollWidth > clientWidth, we are already at the limit
      if (master.scrollWidth > master.clientWidth) {
        e.preventDefault();
        return;
      }
    } else if (currentMode === "header") {
      const style = window.getComputedStyle(master);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const maxHeight = lineHeight * 2;

      // If we are already at or near 2 lines height
      if (master.scrollHeight > maxHeight - 2) {
        // Prevent another line break
        if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
          e.preventDefault();
          return;
        }

        // If we are already overflowing the 2nd line
        if (master.scrollHeight > maxHeight + 2) {
          e.preventDefault();
          return;
        }
      }
    }
  };

  const onMasterInput = (e) => {
    if (!masterElRef.current) return;

    // Prevent the event from bubbling up to the Editor's input handler
    e.stopPropagation();
    e.stopImmediatePropagation();

    const currentMode = modeRef.current;

    if (currentMode === "header") {
      const next = e.currentTarget.innerHTML;
      setHeaderHTML(next);
      headerHTMLRef.current = next;
      // Immediate sync for instant feedback
      requestAnimationFrame(() => {
        syncMirrors(next, undefined);
      });
      // Persist on every keystroke for better autosave/sync
      persistHF();
    } else if (currentMode === "footer") {
      const next = e.currentTarget.innerHTML;
      setFooterHTML(next);
      footerHTMLRef.current = next;
      // Immediate sync for instant feedback
      requestAnimationFrame(() => {
        syncMirrors(undefined, next);
      });
      // Persist on every keystroke for better autosave/sync
      persistHF();
    }
  };

  const onOutsideClick = (e) => {
    const currentMode = modeRef.current;
    if (!currentMode) return;
    const inHeader = e.target.closest?.(headerSelector);
    const inFooter = e.target.closest?.(footerEditSelector);
    if ((currentMode === "header" && !inHeader) || (currentMode === "footer" && !inFooter)) {
      exitMode();
    }
  };

  const onKeydown = (e) => {
    const currentMode = modeRef.current;
    if (currentMode) {
      // Prevent the Editor's keydown handler from interfering
      e.stopPropagation();

      if (e.key === "Escape") {
        e.preventDefault();
        exitMode();
      } else if (e.key === "Enter") {
        if (currentMode === "header") {
          const master = masterElRef.current;
          const style = window.getComputedStyle(master);
          const lineHeight = parseFloat(style.lineHeight) || 20;
          const maxHeight = lineHeight * 2;

          // If we already have 2 lines or more, prevent another Enter
          if (master.scrollHeight > maxHeight - 5) {
            e.preventDefault();
          }
        } else {
          // Footer strictly single-line
          e.preventDefault();
        }
      }
    }
  };

  const attachDblclick = () => {
    pages().forEach((p) => {
      // clean up accidental text nodes directly under .page
      Array.from(p.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
          n.textContent = ""; // or move into header/content as you prefer
        }
      });

      const header = p.querySelector(headerSelector);
      const footerEdit = p.querySelector(footerEditSelector);

      if (header && !header.dataset.hfBound) {
        header.dataset.hfBound = "1";
        header.addEventListener("dblclick", (ev) => {
          if (lockHeaderEditingRef.current) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
          }
          console.log('Header double-clicked');
          ev.preventDefault();
          ev.stopPropagation();
          enterMode("header", header);
        });
        // Prevent single click from bubbling up
        header.addEventListener("click", (ev) => {
          ev.stopPropagation();
        });
      }
      if (footerEdit && !footerEdit.dataset.hfBound) {
        footerEdit.dataset.hfBound = "1";
        footerEdit.addEventListener("dblclick", (ev) => {
          console.log('Footer double-clicked');
          ev.preventDefault();
          ev.stopPropagation();
          enterMode("footer", footerEdit);
        });
        // Prevent single click from bubbling up
        footerEdit.addEventListener("click", (ev) => {
          ev.stopPropagation();
        });
      }
    });
  };

  // ---------- observe page list (new pages added by pagination)
  useEffect(() => {
    restoreHF();
    // initial paint
    const t = setTimeout(() => {
      attachDblclick();
      syncMirrors();
    }, 0);

    // mutation observer for dynamic page changes
    const container = root();
    if ("MutationObserver" in window && container) {
      const mo = new MutationObserver(() => {
        attachDblclick();
        syncMirrors();
      });
      mo.observe(container, { childList: true, subtree: true });
      moRef.current = mo;
    }

    // start the periodic watcher as an additional safety net (NEW)
    ensureAutoSyncRunning();

    return () => {
      clearTimeout(t);
      moRef.current?.disconnect();
      exitMode();
      stopAutoSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, pageSelector, headerSelector, footerSelector, footerEditSelector, pageNumSelector, lockHeaderEditing]);

  // whenever shared HTML changes externally, mirror it
  useEffect(() => {
    syncMirrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerHTML, footerHTML, mode]);

  return null; // headless manager
}
