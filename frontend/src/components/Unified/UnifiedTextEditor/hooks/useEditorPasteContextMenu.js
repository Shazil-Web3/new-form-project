import React, { useState, useEffect, useCallback, useRef } from "react";
import EditorPasteContextMenu from "../components/EditorPasteContextMenu";
import { getEditorScrollContainer } from "../utils/editorScrollUtils";
import { message } from "antd";

export function useEditorPasteContextMenu({
  pagesContainerRef,
  readOnly = false,
  onPaste,
}) {
  const [pasteMenu, setPasteMenu] = useState(null);
  const savedSelectionRef = useRef(null);

  const closeMenu = useCallback(() => {
    setPasteMenu(null);
  }, []);

  // Close context menu on outside click, Escape key, or scrolling
  useEffect(() => {
    if (!pasteMenu) return undefined;

    const onMouseDown = (e) => {
      if (e.target.closest?.(".editor-paste-context-menu")) return;
      closeMenu();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    const onScroll = () => closeMenu();
    const scrollEl = getEditorScrollContainer(pagesContainerRef.current);

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    scrollEl?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      scrollEl?.removeEventListener("scroll", onScroll);
    };
  }, [pasteMenu, closeMenu, pagesContainerRef]);

  // Context menu listener on pages container
  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root || readOnly) return undefined;

    const onContextMenu = (e) => {
      if (window.isResizingTable) return;

      // If right-clicked on or inside a table, table context menu handles it
      if (e.target.closest?.("table[data-block-id], .table-context-menu")) {
        return;
      }

      // Check if clicked inside a page or page content area
      const pageEl = e.target.closest?.(".page");
      const pageContent = e.target.closest?.(".page-content") || pageEl?.querySelector?.(".page-content");
      if (!pageContent) return;

      // Position caret at right-click point if possible
      try {
        let range = null;
        if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
          if (pos && pos.offsetNode) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
          }
        } else if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(e.clientX, e.clientY);
        }

        if (range && pageContent.contains(range.startContainer)) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          // If right-clicked on empty margin inside page-content or page
          const lastChild = pageContent.lastElementChild || pageContent;
          const fallbackRange = document.createRange();
          fallbackRange.selectNodeContents(lastChild);
          fallbackRange.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(fallbackRange);
        }
      } catch (_) {}

      // Save current selection range
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }

      e.preventDefault();
      e.stopPropagation();

      setPasteMenu({
        x: e.clientX,
        y: e.clientY,
      });
    };

    root.addEventListener("contextmenu", onContextMenu);
    return () => root.removeEventListener("contextmenu", onContextMenu);
  }, [pagesContainerRef, readOnly]);

  const restoreSelection = useCallback(() => {
    if (savedSelectionRef.current) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      } catch (_) {}
    }
  }, []);

  const handlePasteWithFormatting = useCallback(async () => {
    restoreSelection();
    try {
      let htmlData = '';
      let textData = '';
      if (navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('text/html')) {
              const blob = await item.getType('text/html');
              htmlData = await blob.text();
            }
            if (item.types.includes('text/plain')) {
              const blob = await item.getType('text/plain');
              textData = await blob.text();
            }
          }
        } catch (_) {}
      }

      if (!htmlData && !textData && navigator.clipboard?.readText) {
        textData = await navigator.clipboard.readText();
      }

      if (onPaste) {
        const syntheticEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clipboardData: {
            getData: (format) => {
              if (format === 'text/html') return htmlData;
              if (format === 'text/plain') return textData;
              return '';
            }
          }
        };
        onPaste(syntheticEvent, { htmlData, textData, plainTextOnly: false });
      }
    } catch (err) {
      console.warn("Clipboard read error:", err);
      message.info("Please use Ctrl+V / Cmd+V to paste.");
    }
  }, [restoreSelection, onPaste]);

  const handlePasteWithoutFormatting = useCallback(async () => {
    restoreSelection();
    try {
      let textData = '';
      if (navigator.clipboard?.readText) {
        textData = await navigator.clipboard.readText();
      } else if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            textData = await blob.text();
            break;
          }
        }
      }

      if (onPaste) {
        const syntheticEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clipboardData: {
            getData: (format) => (format === 'text/plain' ? textData : '')
          }
        };
        onPaste(syntheticEvent, {
          htmlData: '',
          textData,
          text: textData,
          plainTextOnly: true
        });
      }
    } catch (err) {
      console.warn("Clipboard readText error:", err);
      message.info("Please use Ctrl+Shift+V to paste without formatting.");
    }
  }, [restoreSelection, onPaste]);

  const menuComponent = pasteMenu ? (
    <EditorPasteContextMenu
      x={pasteMenu.x}
      y={pasteMenu.y}
      onPasteWithFormatting={handlePasteWithFormatting}
      onPasteWithoutFormatting={handlePasteWithoutFormatting}
      onClose={closeMenu}
    />
  ) : null;

  return menuComponent;
}

export default useEditorPasteContextMenu;
