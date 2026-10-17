import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown, Button, Modal } from "react-bootstrap";
import { applyTextAlignment, getAlignFromElement, getCaretAlignElement, DEFAULT_TEXT_ALIGN } from "../../../Editor/textAlignment/textAlignment";
import { 
  toggleSuperscript, 
  toggleSubscript, 
  getScriptFormattingState 
} from "../utils/superscriptSubscript";
import { SuperscriptIcon, SubscriptIcon } from "./SuperscriptSubscriptIcons";
import "../styles/superscriptSubscript.css";

const getScrollPositions = () => {
  const scrollables = Array.from(
    document.querySelectorAll('.editor-container, .main-container, .template-container, .content-container, .editor-scroll-container, .document-scroll-container')
  );
  const list = scrollables.map(el => ({ el, top: el.scrollTop, left: el.scrollLeft }));
  list.push({ el: window, top: window.scrollY, left: window.scrollX });
  return list;
};

const restoreScrollPositions = (positions) => {
  if (!positions || !Array.isArray(positions)) return;
  positions.forEach(({ el, top, left }) => {
    if (el === window) {
      window.scrollTo(left, top);
    } else if (el && typeof el.scrollTop !== "undefined") {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  });
};

const getSelectedBlocks = (range) => {
  if (!range) return [];
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  if (!startEl) return [];

  // Check if selection is inside a table cell
  const tableCell = startEl.closest("td, th");
  if (tableCell) {
    const cellBlocks = Array.from(tableCell.querySelectorAll("p, div, li, ol, ul")).filter(el => {
      let p = el.parentElement;
      while (p && p !== tableCell) {
        if (["p", "div", "li", "ol", "ul"].includes(p.tagName.toLowerCase())) return false;
        p = p.parentElement;
      }
      return true;
    });

    if (cellBlocks.length > 0) {
      if (range.collapsed) {
        const single = startEl.closest("p, div, li, ol, ul");
        return single && tableCell.contains(single) ? [single] : [cellBlocks[0]];
      }
      const selectedInCell = cellBlocks.filter(b => {
        try { return range.intersectsNode(b); } catch { return false; }
      });
      return selectedInCell.length > 0 ? selectedInCell : [cellBlocks[0]];
    }
    return [tableCell];
  }

  const docContainer = startEl.closest(".document-renderer") || startEl.closest(".editor-container") || document;
  
  const allBlocks = Array.from(
    docContainer.querySelectorAll(".page-content [data-block-id]")
  ).filter(el => {
    let p = el.parentElement;
    while (p && !p.classList.contains("page-content")) {
      if (p.hasAttribute("data-block-id")) return false;
      p = p.parentElement;
    }
    return true;
  });

  if (range.collapsed) {
    const single = startEl.closest("[data-block-id]");
    return single ? [single] : [];
  }

  const selected = allBlocks.filter(b => {
    try {
      if (!range.intersectsNode(b)) return false;
    } catch {
      return false;
    }
    // Exclude block if range end is at offset 0 of this block and it is not startContainer
    if (range.endContainer === b && range.endOffset === 0 && !b.contains(range.startContainer)) {
      return false;
    }
    if (b.contains(range.endContainer) && range.endOffset === 0) {
      let isAtStart = true;
      let curr = range.endContainer;
      while (curr && curr !== b) {
        if (curr.previousSibling) { isAtStart = false; break; }
        curr = curr.parentNode;
      }
      if (isAtStart && !b.contains(range.startContainer) && b !== range.startContainer) {
        return false;
      }
    }
    return true;
  });

  if (selected.length === 0) {
    const fallback = startEl.closest("[data-block-id]");
    return fallback ? [fallback] : [];
  }

  return selected;
};

const getBlockLineGroups = (block, range) => {
  const childNodes = Array.from(block.childNodes);
  if (childNodes.length === 0) {
    return [{ html: "<br>", isSelected: true }];
  }

  const groups = [];
  let currentNodes = [];

  childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "br") {
      groups.push(currentNodes);
      currentNodes = [];
    } else {
      currentNodes.push(child);
    }
  });
  if (currentNodes.length > 0 || groups.length === 0) {
    groups.push(currentNodes);
  }

  if (groups.length > 1 && groups[groups.length - 1].length === 0) {
    groups.pop();
  }

  return groups.map(nodes => {
    const tempDiv = document.createElement("div");
    nodes.forEach(n => tempDiv.appendChild(n.cloneNode(true)));
    const html = tempDiv.innerHTML.trim() || "<br>";

    let isSelected = false;
    if (!range || range.collapsed) {
      isSelected = true;
    } else {
      isSelected = nodes.some(n => {
        try {
          return range.intersectsNode(n);
        } catch {
          return false;
        }
      });
      if (!isSelected && nodes.length > 0) {
        if (nodes.includes(range.startContainer) || nodes.includes(range.endContainer)) {
          isSelected = true;
        }
      }
    }

    return { html, isSelected };
  });
};

const finalizeListChanges = (targetEl, savedPositions, { syncDOMToBlocksSync, schedulePaginate, onAfterAction } = {}) => {
  const container = targetEl?.closest(".document-renderer") || document;
  container.dispatchEvent(new Event("input", { bubbles: true }));

  syncDOMToBlocksSync?.();
  schedulePaginate?.();
  onAfterAction?.();

  if (savedPositions) {
    restoreScrollPositions(savedPositions);
    requestAnimationFrame(() => {
      restoreScrollPositions(savedPositions);
    });
    setTimeout(() => {
      restoreScrollPositions(savedPositions);
    }, 50);
    setTimeout(() => {
      restoreScrollPositions(savedPositions);
    }, 150);
  }
};

const applyListTransformation = ({
  type = "ordered",
  blocks = [],
  range = null,
  shouldContinue = false,
  startVal = 1,
  savedPositions = null,
  onBeforeAction,
  onAfterAction,
  syncDOMToBlocksSync,
  schedulePaginate,
}) => {
  if (!blocks || blocks.length === 0) return;

  onBeforeAction?.();

  const isOrdered = type === "ordered";
  const targetTag = isOrdered ? "ol" : "ul";
  const firstSelected = blocks[0];

  // Case 1: Toggle Off
  const isSameTypeList = blocks.length === 1 &&
    firstSelected.tagName.toLowerCase() === targetTag &&
    (!isOrdered || firstSelected.classList.contains("custom-numbered-list"));

  if (isSameTypeList) {
    const lis = Array.from(firstSelected.querySelectorAll(":scope > li"));
    const paragraphs = (lis.length > 0 ? lis : [{ innerHTML: firstSelected.innerHTML }]).map((li, idx) => {
      const p = document.createElement("p");
      const baseId = firstSelected.getAttribute("data-block-id") || `block-p-${Date.now()}`;
      p.setAttribute("data-block-id", idx === 0 ? baseId : `block-p-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`);
      p.setAttribute("contenteditable", "true");
      p.innerHTML = (li.innerHTML || "").trim() || "<br>";
      return p;
    });

    if (paragraphs.length > 0) {
      firstSelected.replaceWith(...paragraphs);
      const targetP = paragraphs[0];
      const r = document.createRange();
      r.selectNodeContents(targetP);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      targetP.focus?.({ preventScroll: true });
    }

    finalizeListChanges(paragraphs[0] || firstSelected, savedPositions, {
      syncDOMToBlocksSync,
      schedulePaginate,
      onAfterAction,
    });
    return;
  }

  // Case 2: Convert between OL and UL
  const isOtherTypeList = blocks.length === 1 &&
    (firstSelected.tagName.toLowerCase() === "ol" || firstSelected.tagName.toLowerCase() === "ul");

  if (isOtherTypeList) {
    const newList = document.createElement(targetTag);
    if (isOrdered) {
      newList.className = "custom-numbered-list";
      if (shouldContinue && startVal > 1) {
        newList.setAttribute("start", startVal);
        newList.style.counterReset = `list-counter ${startVal - 1}`;
      }
    }
    newList.setAttribute("data-block-id", firstSelected.getAttribute("data-block-id") || `block-list-${Date.now()}`);
    newList.setAttribute("contenteditable", "true");

    const existingLis = Array.from(firstSelected.querySelectorAll(":scope > li"));
    if (existingLis.length > 0) {
      existingLis.forEach(li => newList.appendChild(li));
    } else {
      const li = document.createElement("li");
      li.innerHTML = firstSelected.innerHTML || "<br>";
      newList.appendChild(li);
    }

    firstSelected.replaceWith(newList);

    const firstLi = newList.querySelector("li");
    if (firstLi) {
      const r = document.createRange();
      r.selectNodeContents(firstLi);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      firstLi.focus?.({ preventScroll: true });
    }

    finalizeListChanges(newList, savedPositions, {
      syncDOMToBlocksSync,
      schedulePaginate,
      onAfterAction,
    });
    return;
  }

  // Case 3: Convert single block with <br> lines (handling partial line selection if present)
  if (blocks.length === 1 && range && !range.collapsed && /<br\s*\/?>/i.test(blocks[0].innerHTML || "")) {
    const lineGroups = getBlockLineGroups(blocks[0], range);
    const hasUnselected = lineGroups.some(g => !g.isSelected);

    if (hasUnselected) {
      const preLines = [];
      const listLines = [];
      const postLines = [];
      let phase = "pre";

      lineGroups.forEach(g => {
        if (g.isSelected) {
          phase = "list";
          listLines.push(g.html);
        } else {
          if (phase === "pre") {
            preLines.push(g.html);
          } else {
            postLines.push(g.html);
          }
        }
      });

      const listEl = document.createElement(targetTag);
      if (isOrdered) {
        listEl.className = "custom-numbered-list";
        if (shouldContinue && startVal > 1) {
          listEl.setAttribute("start", startVal);
          listEl.style.counterReset = `list-counter ${startVal - 1}`;
        }
      }
      listEl.setAttribute("data-block-id", `block-list-${Date.now()}`);
      listEl.setAttribute("contenteditable", "true");

      listLines.forEach(h => {
        const li = document.createElement("li");
        li.innerHTML = h;
        listEl.appendChild(li);
      });

      const parent = firstSelected.parentNode;
      preLines.forEach(h => {
        const p = document.createElement("p");
        p.setAttribute("data-block-id", `block-p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);
        p.setAttribute("contenteditable", "true");
        p.innerHTML = h;
        parent.insertBefore(p, firstSelected);
      });

      parent.insertBefore(listEl, firstSelected);

      postLines.forEach(h => {
        const p = document.createElement("p");
        p.setAttribute("data-block-id", `block-p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);
        p.setAttribute("contenteditable", "true");
        p.innerHTML = h;
        parent.insertBefore(p, firstSelected);
      });

      firstSelected.remove();

      const firstLi = listEl.querySelector("li");
      if (firstLi) {
        const r = document.createRange();
        r.selectNodeContents(firstLi);
        r.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        firstLi.focus?.({ preventScroll: true });
      }

      finalizeListChanges(listEl, savedPositions, {
        syncDOMToBlocksSync,
        schedulePaginate,
        onAfterAction,
      });
      return;
    }
  }

  // Case 4: Standard multi-block or full-block conversion
  const items = [];
  blocks.forEach(b => {
    const tag = b.tagName.toLowerCase();
    if (tag === "ol" || tag === "ul") {
      const lis = Array.from(b.querySelectorAll(":scope > li"));
      if (lis.length > 0) {
        lis.forEach(li => items.push(li.innerHTML));
      } else {
        items.push(b.innerHTML);
      }
    } else {
      const html = b.innerHTML || "";
      if (/<br\s*\/?>/i.test(html)) {
        const parts = html.split(/<br\s*\/?>/gi);
        parts.forEach((part, idx) => {
          if (idx === parts.length - 1 && !part.trim() && parts.length > 1) {
            return;
          }
          items.push(part.trim() || "<br>");
        });
      } else {
        items.push(html.trim() || "<br>");
      }
    }
  });

  if (items.length === 0) {
    items.push("<br>");
  }

  const listEl = document.createElement(targetTag);
  if (isOrdered) {
    listEl.className = "custom-numbered-list";
    if (shouldContinue && startVal > 1) {
      listEl.setAttribute("start", startVal);
      listEl.style.counterReset = `list-counter ${startVal - 1}`;
    }
  }
  const baseId = firstSelected.getAttribute("data-block-id") || `block-list-${Date.now()}`;
  listEl.setAttribute("data-block-id", baseId);
  listEl.setAttribute("contenteditable", "true");

  items.forEach(itemHtml => {
    const li = document.createElement("li");
    li.innerHTML = itemHtml;
    listEl.appendChild(li);
  });

  firstSelected.replaceWith(listEl);
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i] && blocks[i].parentNode) {
      blocks[i].remove();
    }
  }

  const firstLi = listEl.querySelector("li");
  if (firstLi) {
    const r = document.createRange();
    r.selectNodeContents(firstLi);
    r.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    firstLi.focus?.({ preventScroll: true });
  }

  finalizeListChanges(listEl, savedPositions, {
    syncDOMToBlocksSync,
    schedulePaginate,
    onAfterAction,
  });
};

const toolbarFunctions = {
  applyStyle: (style) => {
    document.execCommand(style, false, null);
  },

  setAlignment: (alignment, options) => {
    applyTextAlignment(alignment, options);
  },

  insertList: (type) => {
    const positions = getScrollPositions();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const blocks = getSelectedBlocks(range);
    if (!blocks || blocks.length === 0) return;
    applyListTransformation({
      type,
      blocks,
      range,
      shouldContinue: false,
      startVal: 1,
      savedPositions: positions,
    });
  },

  insertMultilevelNumberedList: () => {
    toolbarFunctions.insertList("ordered");
  },

  undo: () => {
    document.execCommand("undo", false, null);
  },

  redo: () => {
    document.execCommand("redo", false, null);
  },

  changePaperSize: (setPaperSize, size) => {
    setPaperSize(size);
  },

  changeHeading: (heading) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    if (!selectedText.trim() && range.collapsed) {
      // Standard behavior for empty selection: transform the entire block
      document.execCommand("formatBlock", false, heading);
      return;
    }

    // Identify the containing block
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentNode;
    const blockEl = container.closest('[data-block-id]');
    
    if (!blockEl) {
      document.execCommand("formatBlock", false, heading);
      return;
    }

    const blockId = blockEl.getAttribute('data-block-id');
    const isFullSelection = selectedText.trim() === blockEl.textContent.trim();

    if (isFullSelection) {
      // Standard behavior: transform the entire block
      document.execCommand("formatBlock", false, heading);
      // Restore ID in case execCommand stripped it
      setTimeout(() => {
        const newNode = window.getSelection().anchorNode;
        if (newNode) {
          const newBlock = (newNode.nodeType === 3 ? newNode.parentNode : newNode).closest(heading);
          if (newBlock && !newBlock.hasAttribute('data-block-id')) {
            newBlock.setAttribute('data-block-id', blockId);
            newBlock.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }, 0);
    } else {
      // PARTIAL SELECTION: Split the block into 3 parts
      try {
        const headingTag = heading.toLowerCase();
        
        // 1. Capture the selected content
        const selectedContent = range.extractContents();
        
        // 2. Create the heading block
        const headingEl = document.createElement(headingTag);
        headingEl.appendChild(selectedContent);
        headingEl.setAttribute('data-block-id', `block-h-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);

        // 3. Split the original block at the insertion point
        // Create a range for everything before the selection
        const beforeRange = document.createRange();
        beforeRange.setStartBefore(blockEl.firstChild || blockEl);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const beforeContent = beforeRange.extractContents();

        const parent = blockEl.parentNode;
        
        // 4. Create the 'before' block if there was content
        if (beforeContent.textContent.trim()) {
          const beforeBlock = document.createElement('p');
          beforeBlock.appendChild(beforeContent);
          beforeBlock.setAttribute('data-block-id', `block-p-${Date.now()}-pre`);
          parent.insertBefore(beforeBlock, blockEl);
        }

        // 5. Insert the heading block
        parent.insertBefore(headingEl, blockEl);

        // 6. The original blockEl now contains only the 'after' content
        if (!blockEl.textContent.trim() && !blockEl.querySelector('img, table, figure')) {
          parent.removeChild(blockEl);
        } else {
          // Update the ID of the remaining part to ensure uniqueness
          blockEl.setAttribute('data-block-id', `block-p-${Date.now()}-post`);
        }

        // 7. Trigger synchronization
        const event = new Event('input', { bubbles: true });
        headingEl.dispatchEvent(event);
        
        // 8. Restore selection to the new heading
        const newRange = document.createRange();
        newRange.selectNodeContents(headingEl);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
      } catch (err) {
        console.error("Error splitting block for heading:", err);
        // Fallback to standard behavior if complex DOM structures break the split logic
        document.execCommand("formatBlock", false, heading);
      }
    }
  }
};

const handleKeyDown = (event) => {
  let selection = window.getSelection();
  
  // Ensure there's a valid selection range
  if (selection.rangeCount === 0) return;
  
  let range = selection.getRangeAt(0);
  let listItem = range.startContainer;

  // Find the nearest <li> element
  while (listItem && listItem.nodeName !== "LI") {
    listItem = listItem.parentNode;
    if (!listItem) break;
  }

  // Only handle tabbing inside a `.custom-numbered-list`
  if (listItem && listItem.closest(".custom-numbered-list")) {
    if (event.key === "Tab") {
      event.preventDefault(); // Prevent default tab behavior

      if (event.shiftKey) {
        // Shift + Tab: Outdent
        let parentList = listItem.parentNode;
        if (parentList.nodeName === "OL" && parentList.classList.contains("custom-numbered-list")) {
          const grandparentLi = parentList.parentNode;
          if (grandparentLi && grandparentLi.nodeName === "LI") {
            // Nested item: promote it to a sibling of the grandparent <li>
            grandparentLi.parentNode.insertBefore(listItem, grandparentLi.nextSibling);
          } else {
            // Already at root level: move out of the list
            parentList.parentNode.insertBefore(listItem, parentList.nextSibling);
          }
          if (!parentList.hasChildNodes()) {
            parentList.remove();
          }
        }
      } else {
        // Tab: Indent — nest under the nearest preceding <li> sibling
        // Walk backwards past any non-LI elements (e.g. nested <ol>/<ul> blocks)
        let prevItem = listItem.previousElementSibling;
        while (prevItem && prevItem.nodeName !== "LI") {
          prevItem = prevItem.previousElementSibling;
        }
        if (prevItem) {
          // Find an existing direct-child sublist of prevItem only
          let sublist = null;
          for (const child of prevItem.children) {
            if (child.nodeName === "OL" || child.nodeName === "UL") {
              sublist = child;
              break;
            }
          }
          if (!sublist) {
            sublist = document.createElement("ol");
            sublist.classList.add("custom-numbered-list");
            prevItem.appendChild(sublist);
          }
          sublist.appendChild(listItem);
        } else {
          // Tab on first item in sub-level: outdents it back to the parent level
          let parentList = listItem.parentNode;
          let grandparentLi = parentList?.parentNode;
          if (grandparentLi && grandparentLi.nodeName === "LI") {
            grandparentLi.parentNode.insertBefore(listItem, grandparentLi.nextSibling);
            if (!parentList.hasChildNodes()) {
              parentList.remove();
            }
          }
        }
      }
    }
  } else {
    // If not in a numbered list, ensure normal typing behavior
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, "    "); // Insert 4 spaces
    }
  }
};

const TABLE_PICKER_MAX = 10;

const ALIGNMENT_OPTIONS = [
  { id: "left", icon: "bi bi-text-left", title: "Left align (Ctrl+Shift+L)" },
  { id: "center", icon: "bi bi-text-center", title: "Center align (Ctrl+Shift+E)" },
  { id: "right", icon: "bi bi-text-right", title: "Right align (Ctrl+Shift+R)" },
  { id: "justify", icon: "bi bi-justify", title: "Justify (Ctrl+Shift+J)" },
];

const NumberedListIcon = ({ size = 16, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path d="M4.5 4h1.5v6H4.5V5.5H3V4.2L4.5 4z" />
    <path d="M3 13.8c0-1.4 1-2.3 2.5-2.3 1.4 0 2.5.9 2.5 2.2 0 .9-.5 1.6-1.3 2.3l-1.4 1.3H8V19H3v-1.2l2.6-2.4c.5-.5.8-.9.8-1.5 0-.7-.5-1.1-1.2-1.1-.7 0-1.2.4-1.2 1.1H3z" />
    <rect x="10.5" y="5" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="11" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="17" width="10.5" height="2" rx="1" />
  </svg>
);

const BulletedListIcon = ({ size = 16, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="5" cy="6" r="2.5" />
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="5" cy="18" r="2.5" />
    <rect x="10.5" y="5" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="11" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="17" width="10.5" height="2" rx="1" />
  </svg>
);

const LIST_OPTIONS = [
  { id: "ordered", title: "Numbered list", renderIcon: (size) => <NumberedListIcon size={size} /> },
  { id: "unordered", title: "Bulleted list", renderIcon: (size) => <BulletedListIcon size={size} /> },
];

const Toolbar = ({
  paperSize,
  setPaperSize,
  user,
  isFullScreen,
  toggleFullScreen,
  orientation,
  setOrientation,
  onInsertTable,
  onOpenSpecialCharacters,
  onOpenInsertVideoModal,
  onUndo,
  onRedo,
  onBeforeAction,
  onAfterAction,
  syncDOMToBlocksSync,
  schedulePaginate,
  onPrint,
  isExportingPdf,
  approversContent,
  approversList = [],
  onOpenFindReplace,
}) => {
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const tablePickerRef = useRef(null);

  const [isAlignPickerOpen, setIsAlignPickerOpen] = useState(false);
  const [currentAlign, setCurrentAlign] = useState(DEFAULT_TEXT_ALIGN);
  const alignPickerRef = useRef(null);
  const alignHoverTimeoutRef = useRef(null);

  const [isListPickerOpen, setIsListPickerOpen] = useState(false);
  const [currentListType, setCurrentListType] = useState(null);
  const listPickerRef = useRef(null);
  const listHoverTimeoutRef = useRef(null);

  const [isFormatPickerOpen, setIsFormatPickerOpen] = useState(false);
  const formatPickerRef = useRef(null);

  const [scriptState, setScriptState] = useState({ isSuperscript: false, isSubscript: false });

  const handleListMouseEnter = () => {
    if (listHoverTimeoutRef.current) clearTimeout(listHoverTimeoutRef.current);
    setIsListPickerOpen(true);
  };

  const handleListMouseLeave = () => {
    listHoverTimeoutRef.current = setTimeout(() => {
      setIsListPickerOpen(false);
    }, 200);
  };

  const handleAlignMouseEnter = () => {
    if (alignHoverTimeoutRef.current) clearTimeout(alignHoverTimeoutRef.current);
    setIsAlignPickerOpen(true);
  };

  const handleAlignMouseLeave = () => {
    alignHoverTimeoutRef.current = setTimeout(() => {
      setIsAlignPickerOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(event.target)) {
        setIsTablePickerOpen(false);
      }
      if (alignPickerRef.current && !alignPickerRef.current.contains(event.target)) {
        setIsAlignPickerOpen(false);
      }
      if (listPickerRef.current && !listPickerRef.current.contains(event.target)) {
        setIsListPickerOpen(false);
      }
      if (formatPickerRef.current && !formatPickerRef.current.contains(event.target)) {
        setIsFormatPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const updateActiveAlignment = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const anchorNode = sel.anchorNode;
        const el = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
        if (el) {
          const inOl = el.closest("ol");
          const inUl = el.closest("ul");
          if (inOl) {
            setCurrentListType("ordered");
          } else if (inUl) {
            setCurrentListType("unordered");
          } else {
            setCurrentListType(null);
          }
        }
      }

      const alignEl = getCaretAlignElement();
      if (alignEl) {
        setCurrentAlign(getAlignFromElement(alignEl));
      } else {
        setCurrentAlign(DEFAULT_TEXT_ALIGN);
      }

      // Update Word-style superscript/subscript state
      setScriptState(getScriptFormattingState());
    };

    document.addEventListener("selectionchange", updateActiveAlignment);
    window.addEventListener("keyup", updateActiveAlignment);
    window.addEventListener("mouseup", updateActiveAlignment);
    return () => {
      document.removeEventListener("selectionchange", updateActiveAlignment);
      window.removeEventListener("keyup", updateActiveAlignment);
      window.removeEventListener("mouseup", updateActiveAlignment);
    };
  }, []);

  const activeAlignOption = ALIGNMENT_OPTIONS.find((opt) => opt.id === currentAlign) || ALIGNMENT_OPTIONS[0];

  const gridCells = useMemo(() => {
    return Array.from({ length: TABLE_PICKER_MAX * TABLE_PICKER_MAX }, (_, index) => {
      const row = Math.floor(index / TABLE_PICKER_MAX) + 1;
      const col = (index % TABLE_PICKER_MAX) + 1;
      return { row, col };
    });
  }, []);

  const insertSelectedTable = (rows, cols) => {
    if (!rows || !cols || typeof onInsertTable !== "function") return;
    onInsertTable(rows, cols);
    setIsTablePickerOpen(false);
  };

  const [showListPrompt, setShowListPrompt] = useState(false);
  const [suggestedStartVal, setSuggestedStartVal] = useState(1);
  const savedRangeRef = useRef(null);
  const savedBlocksRef = useRef(null);
  const savedPositionsRef = useRef(null);

  const handleOrderedListClick = () => {
    const positions = getScrollPositions();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedBlocks = getSelectedBlocks(range);
    if (selectedBlocks.length === 0) return;

    // If toggling off existing ordered list, do it immediately without modal prompt
    const isAlreadyOrderedList = selectedBlocks.length === 1 &&
      selectedBlocks[0].tagName.toLowerCase() === "ol" &&
      selectedBlocks[0].classList.contains("custom-numbered-list");

    if (isAlreadyOrderedList) {
      applyListTransformation({
        type: "ordered",
        blocks: selectedBlocks,
        range,
        shouldContinue: false,
        startVal: 1,
        savedPositions: positions,
        onBeforeAction,
        onAfterAction,
        syncDOMToBlocksSync,
        schedulePaginate,
      });
      return;
    }

    // Check for a previous OL in the document before the first selected block
    const firstBlock = selectedBlocks[0];
    const docContainer = firstBlock.closest(".document-renderer") || firstBlock.closest(".editor-container") || document;
    const ols = Array.from(docContainer.querySelectorAll("ol.custom-numbered-list, ol")).filter(ol => {
      return !ol.parentElement?.closest("li") && ol !== firstBlock && !firstBlock.contains(ol);
    });

    const previousOls = ols.filter(ol => {
      return ol.compareDocumentPosition(firstBlock) & Node.DOCUMENT_POSITION_FOLLOWING;
    });

    const previousOl = previousOls.length > 0 ? previousOls[previousOls.length - 1] : null;

    if (previousOl) {
      const prevStart = parseInt(previousOl.getAttribute("start"), 10) || 1;
      const directLis = Array.from(previousOl.querySelectorAll(":scope > li"));
      const startVal = prevStart + directLis.length;
      setSuggestedStartVal(startVal);
      savedRangeRef.current = range.cloneRange();
      savedBlocksRef.current = selectedBlocks;
      savedPositionsRef.current = positions;
      setShowListPrompt(true);
    } else {
      applyListTransformation({
        type: "ordered",
        blocks: selectedBlocks,
        range,
        shouldContinue: false,
        startVal: 1,
        savedPositions: positions,
        onBeforeAction,
        onAfterAction,
        syncDOMToBlocksSync,
        schedulePaginate,
      });
    }
  };

  const handleUnorderedListClick = () => {
    const positions = getScrollPositions();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedBlocks = getSelectedBlocks(range);
    if (selectedBlocks.length === 0) return;

    applyListTransformation({
      type: "unordered",
      blocks: selectedBlocks,
      range,
      shouldContinue: false,
      startVal: 1,
      savedPositions: positions,
      onBeforeAction,
      onAfterAction,
      syncDOMToBlocksSync,
      schedulePaginate,
    });
  };

  const executeInsertList = (shouldContinue, startVal = 1) => {
    let blocks = savedBlocksRef.current;
    if (!blocks || blocks.length === 0 || !blocks[0]?.isConnected) {
      blocks = getSelectedBlocks(savedRangeRef.current);
    }
    applyListTransformation({
      type: "ordered",
      blocks,
      range: savedRangeRef.current,
      shouldContinue,
      startVal,
      savedPositions: savedPositionsRef.current,
      onBeforeAction,
      onAfterAction,
      syncDOMToBlocksSync,
      schedulePaginate,
    });
    setShowListPrompt(false);
    savedRangeRef.current = null;
    savedBlocksRef.current = null;
    savedPositionsRef.current = null;
  };

  return (
    <div className="editor-toolbar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', padding: '4px 12px 4px 12px' }}>
      {/* Orientation buttons */}
      <Button
        onClick={() => {
          onBeforeAction?.();
          setOrientation && setOrientation("portrait");
        }}
        variant={orientation === "portrait" ? "primary" : "outline-dark"}
        size="sm"
      >
        Portrait
      </Button>
      <Button
        onClick={() => {
          onBeforeAction?.();
          setOrientation && setOrientation("landscape");
        }}
        variant={orientation === "landscape" ? "primary" : "outline-dark"}
        size="sm"
      >
        Landscape
      </Button>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Heading dropdown */}
      <Dropdown onSelect={(key) => {
        onBeforeAction?.();
        toolbarFunctions.changeHeading(key);
        onAfterAction?.();
      }}>
        <Dropdown.Toggle variant="light" size="sm">
          Heading
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item eventKey="p">Paragraph</Dropdown.Item>
          <Dropdown.Item eventKey="h1">Heading 1</Dropdown.Item>
          <Dropdown.Item eventKey="h2">Heading 2</Dropdown.Item>
          <Dropdown.Item eventKey="h3">Heading 3</Dropdown.Item>
          <Dropdown.Item eventKey="h4">Heading 4</Dropdown.Item>
          <Dropdown.Item eventKey="h5">Heading 5</Dropdown.Item>
          <Dropdown.Item eventKey="h6">Heading 6</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Text formatting dropdown (Bold, Italic, Underline, Superscript, Subscript) */}
      <div 
        className="position-relative" 
        ref={formatPickerRef} 
        style={{ display: "inline-block" }}
      >
        <Button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsFormatPickerOpen((prev) => !prev)}
          variant="light" 
          size="sm"
          title="More formatting"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isFormatPickerOpen ? "#e8eaed" : undefined,
            padding: "4px 8px",
            minWidth: "32px",
            height: "30px",
          }}
        >
          <i className="bi bi-three-dots" style={{ fontSize: "16px" }}></i>
        </Button>

        {isFormatPickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 1200,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              padding: "4px",
              backgroundColor: "#ffffff",
              border: "1px solid #dadce0",
              borderRadius: "6px",
              boxShadow: "0 2px 6px 2px rgba(60,64,67,0.15)",
              minWidth: "175px",
            }}
          >
            {[
              {
                id: "bold",
                label: "Bold",
                icon: "bi bi-type-bold",
                shortcut: "Ctrl+B",
                onClick: () => {
                  onBeforeAction?.();
                  toolbarFunctions.applyStyle("bold");
                  onAfterAction?.();
                },
              },
              {
                id: "italic",
                label: "Italic",
                icon: "bi bi-type-italic",
                shortcut: "Ctrl+I",
                onClick: () => {
                  onBeforeAction?.();
                  toolbarFunctions.applyStyle("italic");
                  onAfterAction?.();
                },
              },
              {
                id: "superscript",
                label: "Superscript",
                shortcut: "Ctrl+1",
                renderIcon: (size) => <SuperscriptIcon size={size} />,
                onClick: () => {
                  toggleSuperscript({
                    syncDOMToBlocksSync,
                    schedulePaginate,
                    onBeforeAction,
                    onAfterAction,
                  });
                  setScriptState(getScriptFormattingState());
                },
              },
              {
                id: "subscript",
                label: "Subscript",
                shortcut: "Ctrl+2",
                renderIcon: (size) => <SubscriptIcon size={size} />,
                onClick: () => {
                  toggleSubscript({
                    syncDOMToBlocksSync,
                    schedulePaginate,
                    onBeforeAction,
                    onAfterAction,
                  });
                  setScriptState(getScriptFormattingState());
                },
              },
            ].map((option) => {
              let isActive = false;
              try {
                if (option.id === "bold" || option.id === "italic") {
                  isActive = document.queryCommandState(option.id);
                } else if (option.id === "superscript") {
                  isActive = scriptState.isSuperscript;
                } else if (option.id === "subscript") {
                  isActive = scriptState.isSubscript;
                }
              } catch {
                isActive = false;
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.shortcut ? `${option.label} (${option.shortcut})` : option.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    option.onClick?.();
                    setIsFormatPickerOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "6px 10px",
                    width: "100%",
                    border: "none",
                    borderRadius: "4px",
                    backgroundColor: isActive ? "#e8f0fe" : "transparent",
                    color: isActive ? "#1967d2" : "#3c4043",
                    fontSize: "13px",
                    fontWeight: isActive ? "600" : "400",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "#f1f3f4";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {option.renderIcon ? (
                      <span style={{ width: "18px", display: "inline-flex", justifyContent: "center" }}>
                        {option.renderIcon(15)}
                      </span>
                    ) : (
                      <i className={option.icon} style={{ fontSize: "15px", width: "18px", textAlign: "center" }}></i>
                    )}
                    <span>{option.label}</span>
                  </span>
                  {option.shortcut && (
                    <span style={{ fontSize: "11px", color: isActive ? "#1967d2" : "#80868b", marginLeft: "6px" }}>
                      {option.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Alignment Dropdown (Google Docs style) */}
      <div 
        className="position-relative" 
        ref={alignPickerRef} 
        style={{ display: "inline-block" }}
        onMouseEnter={handleAlignMouseEnter}
        onMouseLeave={handleAlignMouseLeave}
      >
        <Button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsAlignPickerOpen((prev) => !prev)}
          variant="light" 
          size="sm"
          title="Align"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            backgroundColor: isAlignPickerOpen ? "#e8eaed" : undefined,
            padding: "4px 6px"
          }}
        >
          <i className={activeAlignOption.icon} style={{ fontSize: "15px" }}></i>
          <i className="bi bi-caret-down-fill" style={{ fontSize: "8px", opacity: 0.7 }}></i>
        </Button>

        {isAlignPickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              gap: "2px",
              padding: "3px 4px",
              backgroundColor: "#ffffff",
              border: "1px solid #dadce0",
              borderRadius: "6px",
              boxShadow: "0 2px 6px 2px rgba(60,64,67,0.15)",
              whiteSpace: "nowrap"
            }}
          >
            {ALIGNMENT_OPTIONS.map((option) => {
              const isActive = currentAlign === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onBeforeAction?.();
                    toolbarFunctions.setAlignment(option.id, {
                      syncDOMToBlocksSync,
                      schedulePaginate,
                      onAfterAction,
                    });
                    setCurrentAlign(option.id);
                    setIsAlignPickerOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "30px",
                    border: "none",
                    borderRadius: "4px",
                    backgroundColor: isActive ? "#e8f0fe" : "transparent",
                    color: isActive ? "#1967d2" : "#444746",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "#f1f3f4";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <i className={option.icon} style={{ fontSize: "16px" }}></i>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* List Dropdown (Numbering & Bullet points) */}
      <div 
        className="position-relative" 
        ref={listPickerRef} 
        style={{ display: "inline-block" }}
        onMouseEnter={handleListMouseEnter}
        onMouseLeave={handleListMouseLeave}
      >
        <Button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsListPickerOpen((prev) => !prev)}
          variant="light" 
          size="sm"
          title="Lists"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            backgroundColor: (isListPickerOpen || currentListType) ? "#e8eaed" : undefined,
            padding: "4px 6px"
          }}
        >
          {currentListType === "unordered" ? (
            <BulletedListIcon size={16} />
          ) : (
            <NumberedListIcon size={16} />
          )}
          <i className="bi bi-caret-down-fill" style={{ fontSize: "8px", opacity: 0.7 }}></i>
        </Button>

        {isListPickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              gap: "2px",
              padding: "3px 4px",
              backgroundColor: "#ffffff",
              border: "1px solid #dadce0",
              borderRadius: "6px",
              boxShadow: "0 2px 6px 2px rgba(60,64,67,0.15)",
              whiteSpace: "nowrap"
            }}
          >
            {LIST_OPTIONS.map((option) => {
              const isActive = currentListType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (option.id === "ordered") {
                      handleOrderedListClick();
                    } else {
                      handleUnorderedListClick();
                    }
                    setIsListPickerOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "30px",
                    border: "none",
                    borderRadius: "4px",
                    backgroundColor: isActive ? "#e8f0fe" : "transparent",
                    color: isActive ? "#1967d2" : "#444746",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "#f1f3f4";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {option.renderIcon(16)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="position-relative" ref={tablePickerRef}>
        <Button
          onClick={() => setIsTablePickerOpen((prev) => !prev)}
          variant="light"
          size="sm"
          title="Insert table"
        >
          <i className="bi bi-table"></i>
        </Button>
        {isTablePickerOpen && (
          <div
            className="bg-white border rounded shadow-sm p-2"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 1200,
              minWidth: "220px"
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${TABLE_PICKER_MAX}, 18px)`,
                gap: "3px"
              }}
            >
              {gridCells.map((cell) => {
                const isSelected = cell.row <= tableHover.rows && cell.col <= tableHover.cols;
                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    onMouseEnter={() => setTableHover({ rows: cell.row, cols: cell.col })}
                    onClick={() => insertSelectedTable(cell.row, cell.col)}
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "1px solid #c8ccd0",
                      padding: 0,
                      background: isSelected ? "#0d6efd" : "#ffffff",
                      borderRadius: "2px"
                    }}
                    aria-label={`Insert ${cell.row} by ${cell.col} table`}
                  />
                );
              })}
            </div>
            <div className="mt-2 small text-muted">
              {tableHover.rows > 0 && tableHover.cols > 0
                ? `${tableHover.rows} x ${tableHover.cols}`
                : "Select table size"}
            </div>
          </div>
        )}
      </div>
      
      <Button
        onClick={onOpenSpecialCharacters}
        variant="light"
        size="sm"
        title="Insert special character"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'serif', lineHeight: '1' }}>Ω</span>
      </Button>
      
      <Button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onBeforeAction?.();
          onOpenInsertVideoModal?.();
        }}
        variant="light"
        size="sm"
        title="Insert Video"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
      >
        <i className="bi bi-camera-reels"></i>
        <span style={{ fontSize: "12px", fontWeight: "500" }}>Video</span>
      </Button>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Undo/Redo buttons */}
      <Button 
        onMouseDown={(e) => e.preventDefault()}
        onClick={onUndo || toolbarFunctions.undo} 
        variant="light" 
        size="sm"
      >
        <i className="bi bi-arrow-counterclockwise"></i>
      </Button>
      <Button 
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRedo || toolbarFunctions.redo} 
        variant="light" 
        size="sm"
      >
        <i className="bi bi-arrow-clockwise"></i>
      </Button>
      
      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Download PDF button or dropdown */}
      {approversList && approversList.length > 0 ? (
        <Dropdown size="sm">
          <Dropdown.Toggle
            variant="light"
            size="sm"
            disabled={isExportingPdf}
            title="Download PDF Options"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <i className={`bi ${isExportingPdf ? 'bi-arrow-repeat spin' : 'bi-file-earmark-pdf'}`}></i>
            <span style={{ fontSize: "12px", fontWeight: "500" }}>
              {isExportingPdf ? "Exporting PDF..." : "Download PDF"}
            </span>
          </Dropdown.Toggle>

          <Dropdown.Menu style={{ minWidth: '220px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '8px' }}>
            <Dropdown.Item
              onClick={() => onPrint && onPrint({ includeApprovers: false })}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 14px' }}
            >
              <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: '15px' }}></i>
              <span>Download without Approvers</span>
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => onPrint && onPrint({ includeApprovers: true })}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 14px' }}
            >
              <i className="bi bi-people-fill text-primary" style={{ fontSize: '15px' }}></i>
              <span>Download with Approvers</span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <Button
          onClick={() => onPrint && onPrint({ includeApprovers: false })}
          disabled={isExportingPdf}
          variant="light"
          size="sm"
          title="Download PDF"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <i className={`bi ${isExportingPdf ? 'bi-arrow-repeat spin' : 'bi-file-earmark-pdf'}`}></i>
          <span style={{ fontSize: "12px", fontWeight: "500" }}>
            {isExportingPdf ? "Exporting PDF..." : "Download PDF"}
          </span>
        </Button>
      )}

      <div style={{ width: '1px', height: '20px', backgroundColor: '#dee2e6', margin: '0 6px' }}></div>
      
      {/* Fullscreen toggle button */}
      <Button 
        onClick={toggleFullScreen}
        variant="light"
        size="sm"
        title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
      >
        <i className={`bi ${isFullScreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
      </Button>

      {/* Find & Replace button */}
      {onOpenFindReplace && (
        <Button 
          onClick={onOpenFindReplace}
          variant="light"
          size="sm"
          title="Find and replace (Ctrl+F)"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <i className="bi bi-search" style={{ fontSize: '12px' }}></i>
        </Button>
      )}

      {/* Reviewers / Approvers List on the right side of formatting toolbar */}
      {approversContent && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {approversContent}
        </div>
      )}

      {/* Premium Continue / Restart List Modal */}
      <Modal 
        show={showListPrompt} 
        onHide={() => setShowListPrompt(false)} 
        centered
        className="list-prompt-modal"
      >
        <Modal.Header closeButton style={{ borderBottom: 'none', background: '#f8f9fa' }}>
          <Modal.Title style={{ fontSize: '1.15rem', fontWeight: '600', color: '#1a1f36' }}>
            List Numbering Options
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '20px 24px', color: '#4f566b', fontSize: '0.95rem' }}>
          We detected a previous numbered list in this page. Would you like to continue numbering from that list or start a new list?
        </Modal.Body>
        <Modal.Footer style={{ borderTop: 'none', padding: '12px 24px 20px', display: 'flex', gap: '8px' }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => {
              setShowListPrompt(false);
              savedRangeRef.current = null;
              savedBlocksRef.current = null;
              savedPositionsRef.current = null;
            }}
            style={{ borderRadius: '6px', fontSize: '0.9rem', padding: '6px 16px' }}
          >
            Cancel
          </Button>
          <Button 
            variant="outline-primary" 
            onClick={() => executeInsertList(false)}
            style={{ borderRadius: '6px', fontSize: '0.9rem', padding: '6px 16px', fontWeight: '500' }}
          >
            Restart at 1
          </Button>
          <Button 
            variant="primary" 
            onClick={() => executeInsertList(true, suggestedStartVal)}
            style={{ borderRadius: '6px', fontSize: '0.9rem', padding: '6px 16px', fontWeight: '500', backgroundColor: '#4f46e5', borderColor: '#4f46e5' }}
          >
            Continue from {suggestedStartVal}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export { Toolbar, handleKeyDown };