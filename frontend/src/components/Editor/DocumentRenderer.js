// components/Editor/DocumentRenderer.js
import React, { useCallback, useRef, useState, useEffect } from 'react';
import Page from './Page';
import PageLayout from './PageLayout';
import HeaderFooterManager from './HeaderFooterManager';
import { BLOCK_TYPES } from './DocumentEngine';

const DocumentRenderer = ({ 
  documentStructure, 
  documentEngine, 
  paperSize, 
  onDocumentChange 
}) => {
  // Pagination state
  const pagesContainerRef = useRef(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination helper functions
  const createPage = (index) => {
    console.warn('createPage is deprecated. Use PageLayout component instead.');
    const page = document.createElement("div");
    page.className = `page ${paperSize.toLowerCase()}`;
    page.dataset.pageIndex = `Page ${index} of ${index}`;

    const header = document.createElement("div");
    header.className = "page-header";
    header.contentEditable = "false";
    header.innerHTML = "";

    const content = document.createElement("div");
    content.className = "page-content";
    // No contentEditable here - the container handles it
    content.setAttribute("data-page", index);

    const footer = document.createElement("div");
    footer.className = "page-footer";
    footer.contentEditable = "false";

    page.appendChild(header);
    page.appendChild(content);
    page.appendChild(footer);
    return page;
  };

  const getContentHeight = (page) => {
    const pageHeight = page.offsetHeight;
    const header = page.querySelector(".page-header");
    const footer = page.querySelector(".page-footer");
    const content = page.querySelector(".page-content");

    const cs = getComputedStyle(content);
    const contentVPadding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const headerH = header ? header.offsetHeight : 0;
    const footerH = footer ? footer.offsetHeight : 0;

    return pageHeight - headerH - footerH - contentVPadding;
  };

  const clearPages = () => {
    const container = pagesContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
  };

  const ensureOnePage = () => {
    const container = pagesContainerRef.current;
    if (!container) return null;
    if (!container.querySelector(".page")) {
      const p = createPage(1);
      container.appendChild(p);
    }
    return container.querySelector(".page");
  };

  const paginate = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const allBlocks = Array.from(
      container.querySelectorAll(".page-content [data-block-id]")
    );

    let firstPage = ensureOnePage();
    const firstContent = firstPage.querySelector(".page-content");

    allBlocks.forEach(node => firstContent.appendChild(node));

    let pages = [firstPage];
    let currentPage = firstPage;
    let currentContent = firstPage.querySelector(".page-content");

    const fits = () => currentContent.scrollHeight <= currentContent.clientHeight;

    const nodes = Array.from(currentContent.children);
    for (let i = 0; i < nodes.length; i++) {
      if (fits()) continue;

      const offender = nodes[i];
      currentContent.removeChild(offender);

      const newPage = createPage(pages.length + 1);
      container.appendChild(newPage);
      pages.push(newPage);

      currentPage = newPage;
      currentContent = newPage.querySelector(".page-content");

      currentContent.appendChild(offender);

      while (i + 1 < nodes.length) {
        const next = nodes[i + 1];
        currentContent.appendChild(next);
        i++;
        if (currentContent.scrollHeight > currentContent.clientHeight) {
          currentContent.removeChild(next);
          const newerPage = createPage(pages.length + 1);
          container.appendChild(newerPage);
          pages.push(newerPage);
          currentPage = newerPage;
          currentContent = newerPage.querySelector(".page-content");
          currentContent.appendChild(next);
        }
      }
    }

    pages.forEach((p, idx) => (p.dataset.pageIndex = `Page ${idx + 1} of ${pages.length}`));
    setPageCount(pages.length);

    const sel = document.getSelection();
    if (sel && sel.anchorNode) {
      const owningPage = sel.anchorNode.parentElement?.closest(".page");
      if (owningPage) {
        const idx = Array.from(container.querySelectorAll(".page")).indexOf(owningPage);
        setCurrentPage(Math.max(1, idx + 1));
      }
    }
  }, [paperSize]);

  // Select all across all pages
  const selectAllAcrossPages = useCallback(() => {
    const root = pagesContainerRef.current;
    if (!root) return;

    // Only select user content inside .page-content, skip header/footer
    const blocks = root.querySelectorAll('.page-content [data-block-id]');
    if (blocks.length === 0) return;

    const first = blocks[0];
    const last = blocks[blocks.length - 1];

    // get deepest text nodes for precise range
    const firstTextNode = (n) => {
      let node = n;
      while (node && node.firstChild) node = node.firstChild;
      return node;
    };
    const lastTextNode = (n) => {
      let node = n;
      while (node && node.lastChild) node = node.lastChild;
      return node;
    };

    const startNode = firstTextNode(first) || first;
    const endNode = lastTextNode(last) || last;

    const range = document.createRange();
    range.setStart(startNode, 0);
    const endOffset = endNode.nodeType === Node.TEXT_NODE
      ? endNode.textContent.length
      : (endNode.childNodes?.length || 0);
    range.setEnd(endNode, endOffset);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handleBlockChange = useCallback((blockId, newContent, pageIndex, blockIndex) => {
    // Update the block in the document engine
    documentEngine.updateBlock(blockId, { content: newContent });
    
    // Trigger document change callback
    if (onDocumentChange) {
      onDocumentChange();
    }

    // Paginate after changes
    setTimeout(() => {
      paginate();
    }, 0);
  }, [documentEngine, onDocumentChange, paginate]);

  // Handle keyboard events including Ctrl+A
  const handleKeyDown = useCallback((event) => {
    // Global Select All across all pages
    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      selectAllAcrossPages();
      return;
    }
  }, [selectAllAcrossPages]);

  const handleBlockKeyDown = useCallback((event, block, pageIndex, blockIndex) => {
    const { key, shiftKey, ctrlKey, metaKey } = event;
    
    // Enter key handling is now done in the main Editor component
    // This prevents conflicts and ensures consistent behavior
    if (key === 'Backspace') {
      // Handle block deletion when at beginning of empty block
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const element = range.startContainer.parentElement;
      
      if (range.startOffset === 0 && element.textContent.trim() === '') {
        // Only delete if it's not the only block
        const currentPage = documentStructure.pages[pageIndex];
        if (currentPage.blocks.length > 1) {
          event.preventDefault();
          
          // Remove the block
          documentEngine.removeBlock(block.id);
          
          // Focus previous block
          const prevBlockIndex = blockIndex - 1;
          if (prevBlockIndex >= 0) {
            const prevBlock = currentPage.blocks[prevBlockIndex];
            
            // Trigger document change
            if (onDocumentChange) {
              onDocumentChange();
            }
            
            setTimeout(() => {
              const prevElement = document.querySelector(`[data-block-id="${prevBlock.id}"]`);
              if (prevElement) {
                prevElement.focus();
                // Set cursor to end
                const newRange = document.createRange();
                newRange.setStart(prevElement, prevElement.textContent.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }, 0);
          }
        }
      }
    } else if (key === 'Tab') {
      // Handle tab indentation
      event.preventDefault();
      
      if (block.type === BLOCK_TYPES.LIST) {
        // Handle list indentation
        handleListIndentation(event, block, shiftKey);
      } else {
        // Insert tab space for other blocks
        document.execCommand('insertText', false, '    ');
      }
    }
  }, [documentEngine, document, onDocumentChange]);

  const handleListIndentation = (event, block, shiftKey) => {
    // This would handle list indentation logic
    // For now, we'll keep it simple
    if (!shiftKey) {
      document.execCommand('insertText', false, '    ');
    }
  };

  const handleBlockPaste = useCallback(async (event, block, pageIndex, blockIndex) => {
    // This would handle enhanced paste functionality
    // For now, we'll let the default paste behavior work
    // Future enhancement: Parse pasted content into blocks
  }, []);

  // Initialize pagination when document structure changes
  useEffect(() => {
    if (documentStructure && documentStructure.pages && documentStructure.pages.length > 0) {
      // Clear existing pages
      clearPages();
      
      // Create first page and populate with content
      const firstPage = ensureOnePage();
      const firstContent = firstPage.querySelector(".page-content");
      
      // Render all blocks from the first page of document structure
      const firstPageBlocks = documentStructure.pages[0]?.blocks || [];
      firstContent.innerHTML = documentEngine.toHTML();
      
      // Paginate after DOM is updated
      setTimeout(paginate, 0);
    }
  }, [documentStructure, documentEngine, paginate]);

  if (!documentStructure || !documentStructure.pages || documentStructure.pages.length === 0) {
    return <div>Loading document...</div>;
  }

  return (
    <div className="document-renderer">
      <div
        ref={pagesContainerRef}
        className="document-renderer"
        contentEditable
        onKeyDown={handleKeyDown}
        suppressContentEditableWarning={true}
      />
      {/* Header/Footer Manager */}
      <HeaderFooterManager
        containerRef={pagesContainerRef}
        docId={documentId || "default-doc"}
        options={{
          pageSelector: ".page",
          headerSelector: ".page-header",
          footerSelector: ".page-footer",
          footerEditSelector: ".page-footer .footer-left, .page-footer",
          pageNumSelector: ".page-footer [data-page-num]",
          injectStyles: true,
        }}
      />
      {/* Floating page counter like Docs */}
      <div className="page-counter-chip">
        Page {currentPage} of {pageCount}
      </div>
    </div>
  );
};

export default DocumentRenderer;