import { useCallback, useEffect } from 'react';

/**
 * useEditorPagination
 * Extracts all pagination, page sizing, page element generation, layout metrics,
 * and page-related cursor/selection helpers from Editor.js.
 */
export default function useEditorPagination({
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  isProgrammaticChangeRef,
  isPaginatingRef,
  paginateQueuedRef,
  paginationTimeoutRef,
  orientation,
  paperSize,
  hasVisibleLogo,
  logo,
  setPageCount,
  setCurrentPage,
}) {
  // Caret detection utility
  const getCaretClientRect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(false);
    const rects = r.getClientRects();
    return rects.length ? rects[rects.length - 1] : r.getBoundingClientRect();
  }, []);

  // Layout metrics utility function
  const getLayoutMetrics = useCallback(() => {
    // A4 page dimensions in mm and px (96 DPI)
    const baseWidthMm = 210;
    const baseHeightMm = 297;
    const isLandscape = orientation === 'landscape';
    const pageWidthMm = isLandscape ? baseHeightMm : baseWidthMm;
    const pageHeightMm = isLandscape ? baseWidthMm : baseHeightMm;
    const mmToPx = 3.7795275591; // 1mm = 3.7795275591px at 96 DPI
    
    const pageWidthPx = Math.ceil(pageWidthMm * mmToPx);
    const pageHeightPx = Math.ceil(pageHeightMm * mmToPx);
    
    // Header and footer heights from actual CSS values
    const logoStripMm = hasVisibleLogo ? 15 : 0; // Space only when logo image exists
    const headerMm = 15; // --doc-header: 15mm (from CSS variables)
    const footerMm = 12; // --doc-footer: 12mm (from CSS variables)
    const headerPx = Math.ceil(headerMm * mmToPx);
    const footerPx = Math.ceil(footerMm * mmToPx);
    const logoStripPx = Math.ceil(logoStripMm * mmToPx);
    
    // Content padding (2cm = 20mm each side = 40mm total vertical)
    const contentPaddingVerticalMm = 40; // 2cm top + 2cm bottom
    const contentPaddingPx = Math.ceil(contentPaddingVerticalMm * mmToPx);
    
    // Calculate content height
    const contentHeightPx = pageHeightPx - headerPx - footerPx - logoStripPx - contentPaddingPx;
    
    // Line height for body text (11pt font with 1.15 line-height)
    const fontSizePx = 11 * 1.333; // 11pt = 14.67px
    const lineHeightPx = Math.ceil(fontSizePx * 1.15);
    
    // Pre-break margin (1.5 lines minimum)
    const preBreakMarginPx = Math.max(lineHeightPx, Math.ceil(1.5 * lineHeightPx));
    
    return {
      pageWidthPx,
      pageHeightPx,
      headerPx,
      footerPx,
      logoStripPx,
      contentHeightPx,
      lineHeightPx,
      preBreakMarginPx
    };
  }, [orientation, hasVisibleLogo]);

  // Early break detection for text content
  const checkEarlyBreak = useCallback((contentEl) => {
    const metrics = getLayoutMetrics();
    const contentRect = contentEl.getBoundingClientRect();
    const contentBottom = contentRect.top + metrics.contentHeightPx;
    const preBreakMargin = metrics.preBreakMarginPx;
    
    // Check if caret is too close to bottom
    const caretRect = getCaretClientRect();
    if (caretRect) {
      const nextLineBottom = caretRect.bottom + metrics.lineHeightPx;
      if (nextLineBottom > contentBottom - preBreakMargin) {
        return true;
      }
    }
    
    // Check if any block is too close to bottom
    const blocks = contentEl.querySelectorAll('[data-block-id]');
    for (const block of blocks) {
      const blockRect = block.getBoundingClientRect();
      if (blockRect.bottom > contentBottom - preBreakMargin) {
        return true;
      }
    }
    
    return false;
  }, [getCaretClientRect, getLayoutMetrics]);

  // Table row fit check
  const fitsOnPage = useCallback((elem, contentBottom, preBreak) => {
    const { bottom } = elem.getBoundingClientRect();
    return bottom <= contentBottom - preBreak;
  }, []);

  // Selection preservation helpers
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    let el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const blockEl = el?.closest?.('[data-block-id]');
    if (!blockEl) return null;

    // compute char offset within the block
    const pre = document.createRange();
    pre.selectNodeContents(blockEl);
    pre.setEnd(range.startContainer, range.startOffset);
    const offset = pre.toString().length;

    return { blockId: blockEl.dataset.blockId, offset };
  }, []);

  const restoreSelection = useCallback((saved) => {
    if (!saved) return;
    const el = pagesContainerRef.current?.querySelector(`[data-block-id="${saved.blockId}"]`);
    if (!el) return;
    
    try {
      let remaining = saved.offset;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      
      // Find the correct text node and position
      while (node && remaining > node.textContent.length) {
        remaining -= node.textContent.length;
        node = walker.nextNode();
      }
      
      const r = document.createRange();
      if (node && remaining <= node.textContent.length) {
        const safeOffset = Math.min(remaining, node.textContent.length);
        r.setStart(node, safeOffset);
      } else {
        r.setStart(el, el.childNodes.length);
      }
      r.collapse(true);
      
      const s = window.getSelection();
      if (s) {
        s.removeAllRanges();
        s.addRange(r);
      }
    } catch (error) {
      console.warn('Selection restoration failed:', error);
      const r = document.createRange();
      r.setStart(el, el.childNodes.length);
      r.collapse(true);
      const s = window.getSelection();
      if (s) {
        s.removeAllRanges();
        s.addRange(r);
      }
    }
  }, [pagesContainerRef]);

  const getContentHeight = useCallback((page) => {
    const metrics = getLayoutMetrics();
    return metrics.contentHeightPx;
  }, [getLayoutMetrics]);

  // Size the page-content to a fixed usable height with strict limits
  const sizePageContent = useCallback((pageEl) => {
    if (!pageEl) return;
    const content = pageEl.querySelector('.page-content');
    if (!content) return;

    pageEl.getBoundingClientRect();

    const max = getContentHeight(pageEl);
    content.style.boxSizing = 'border-box';
    content.style.height = `${max}px`;
    content.style.maxHeight = `${max}px`;
    content.style.overflow = 'hidden';
    content.style.position = 'relative';
    content.classList.remove('content-overflow');
  }, [getContentHeight]);

  // Resize all pages
  const sizeAllPages = useCallback(() => {
    const pages = pagesContainerRef.current?.querySelectorAll?.('.page') || [];
    pages.forEach(sizePageContent);
  }, [pagesContainerRef, sizePageContent]);

  // Validate that all pages respect height limits
  const validatePageHeights = useCallback((schedulePaginateFn) => {
    const pages = pagesContainerRef.current?.querySelectorAll?.('.page') || [];
    let hasOverflow = false;
    
    pages.forEach((page, index) => {
      const content = page.querySelector('.page-content');
      if (content && content.scrollHeight > content.clientHeight) {
        console.warn(`Page ${index + 1} has content overflow: ${content.scrollHeight}px > ${content.clientHeight}px`);
        hasOverflow = true;
        content.classList.remove('content-overflow');
      } else if (content) {
        content.classList.remove('content-overflow');
        const utilization = (content.scrollHeight / content.clientHeight * 100).toFixed(1);
        console.log(`Page ${index + 1} space utilization: ${utilization}% (${content.scrollHeight}px / ${content.clientHeight}px)`);
      }
    });
    
    if (hasOverflow && !isPaginatingRef.current && schedulePaginateFn) {
      console.log('Overflow detected, triggering immediate repagination');
      setTimeout(() => schedulePaginateFn(), 0);
    }
    
    return !hasOverflow;
  }, [pagesContainerRef, isPaginatingRef]);

  const createPage = useCallback((index) => {
    const page = document.createElement("div");
    page.className = `page ${paperSize.toLowerCase()} ${orientation}`;
    page.dataset.pageIndex = `Page ${index} of ${index}`;

    const header = document.createElement("div");
    header.className = "page-header";
    header.contentEditable = "false";
    header.setAttribute("data-label", "Header");
    header.innerHTML = "";

    const content = document.createElement("div");
    content.className = "page-content";
    content.contentEditable = "true";
    content.spellcheck = true;
    content.setAttribute("spellcheck", "true");
    content.setAttribute("lang", "en");
    content.setAttribute("data-page", index);

    const footer = document.createElement("div");
    footer.className = "page-footer";
    footer.contentEditable = "false";
    footer.setAttribute("data-label", "Footer");

    const left = document.createElement("div");
    left.className = "footer-left";
    left.contentEditable = "false";
    footer.appendChild(left);

    const right = document.createElement("div");
    right.className = "footer-right";
    right.innerHTML = 'Page <span data-page-num></span>';
    footer.appendChild(right);

    const logoStrip = document.createElement("div");
    logoStrip.className = "page-logo-strip";
    logoStrip.style.minHeight = "64px";
    logoStrip.style.padding = "6px 8px";
    logoStrip.style.display = hasVisibleLogo ? "flex" : "none";
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
    
    if (logo && logo.preview) {
      logoImg.src = logo.preview;
      logoImg.style.display = "block";
      if (logo.width) logoImg.style.width = `${logo.width}px`;
      if (logo.height) logoImg.style.height = `${logo.height}px`;
    } else {
      logoImg.style.display = "none";
    }
    logoLeft.appendChild(logoImg);
    logoStrip.appendChild(logoLeft);

    page.appendChild(logoStrip);
    page.appendChild(header);
    page.appendChild(content);
    page.appendChild(footer);

    sizePageContent(page);
    return page;
  }, [paperSize, orientation, hasVisibleLogo, logo, sizePageContent]);

  const clearPages = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
  }, [pagesContainerRef]);

  const ensureOnePage = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return null;
    let p = container.querySelector(".page");
    if (!p) {
      p = createPage(1);
      container.appendChild(p);
    }
    p.classList.remove('portrait', 'landscape');
    p.classList.add(orientation);
    sizePageContent(p);
    return p;
  }, [pagesContainerRef, createPage, orientation, sizePageContent]);

  // Block-aware pagination system using DocumentEngine's splitting capabilities
  const schedulePaginate = useCallback(() => {
    if (window.isResizingTable) return;
    if (isPaginatingRef.current) { 
      paginateQueuedRef.current = true; 
      return; 
    }

    const savedSel = saveSelection();
    isPaginatingRef.current = true;

    requestAnimationFrame(() => {
      const container = pagesContainerRef.current;
      if (!container) { 
        isPaginatingRef.current = false; 
        return; 
      }

      const firstPage = ensureOnePage();
      const firstContent = firstPage.querySelector('.page-content');
      sizeAllPages();

      // 1) Sync DOM -> blocks (no debounce) from ALL pages
      if (contentChangeHandlerRef.current?.syncDOMToBlocks) {
        const allContents = Array.from(pagesContainerRef.current?.querySelectorAll('.page .page-content') || []);
        const tmp = document.createElement('div');
        allContents.forEach(pc => {
          Array.from(pc.querySelectorAll('[data-block-id]')).forEach(node => tmp.appendChild(node.cloneNode(true)));
        });
        contentChangeHandlerRef.current.syncDOMToBlocks(tmp);
      }

      // 2) Check for early break before pagination
      if (checkEarlyBreak(firstContent)) {
        console.log('Early break detected, forcing pagination');
      }

      // 3) Run the block-aware paginator
      const engine = documentEngineRef.current;
      engine.configureLayoutFromElement(firstContent);
      engine.repaginate(firstContent);

      // 3) Render the paginated blocks back into fixed-height pages
      clearPages();
      engine.document.pages.forEach((pg, i) => {
        const pageEl = createPage(i + 1);
        const pc = pageEl.querySelector('.page-content');
        pc.innerHTML = pg.blocks.map(b => engine.blockToHTML(b)).join('');
        sizePageContent(pageEl);
        
        if (pc.scrollHeight > pc.clientHeight) {
          console.warn(`Page ${i + 1} content exceeds available space. Height: ${pc.scrollHeight}px, Available: ${pc.clientHeight}px`);
        }
        
        pagesContainerRef.current.appendChild(pageEl);
      });

      // 4) Renumber + state
      const finalPages = Array.from(container.querySelectorAll('.page'));
      finalPages.forEach((p, i) => p.dataset.pageIndex = `Page ${i + 1} of ${finalPages.length}`);
      setPageCount(finalPages.length);

      // 5) Update current page indicator based on selection or scroll position
      const sel = document.getSelection();
      let currentPageIndex = 0;
      
      if (sel && sel.anchorNode) {
        const owning = sel.anchorNode.parentElement?.closest('.page');
        if (owning) {
          const idx = finalPages.indexOf(owning);
          currentPageIndex = Math.max(0, idx);
        }
      } else {
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.top + containerRect.height / 2;
        let bestPage = finalPages[0];
        let bestDistance = Infinity;
        
        finalPages.forEach((page, index) => {
          const pageRect = page.getBoundingClientRect();
          const pageCenter = pageRect.top + pageRect.height / 2;
          const distance = Math.abs(pageCenter - containerCenter);
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPage = page;
            currentPageIndex = index;
          }
        });
      }
      
      setCurrentPage(currentPageIndex + 1);

      // 6) Validate page heights
      validatePageHeights(schedulePaginate);

      // 7) Restore selection
      isPaginatingRef.current = false;
      restoreSelection(savedSel);

      if (paginateQueuedRef.current) { 
        paginateQueuedRef.current = false; 
        schedulePaginate(); 
      }
    });
  }, [
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    isPaginatingRef,
    paginateQueuedRef,
    saveSelection,
    restoreSelection,
    checkEarlyBreak,
    ensureOnePage,
    sizeAllPages,
    clearPages,
    createPage,
    sizePageContent,
    setPageCount,
    setCurrentPage,
    validatePageHeights,
  ]);

  const debouncedPaginate = useCallback(() => {
    if (paginationTimeoutRef.current) {
      clearTimeout(paginationTimeoutRef.current);
    }
    paginationTimeoutRef.current = setTimeout(() => {
      schedulePaginate();
    }, 100);
  }, [paginationTimeoutRef, schedulePaginate]);

  // Always reset to a single page before rendering from the engine
  const renderFreshFromEngine = useCallback((opts = {}) => {
    let customCaret = null;
    if (opts && (opts.blockId || opts.offset != null)) {
      customCaret = opts;
    }
    const {
      restoreSelection: shouldRestore = true,
      deferPaginate = false,
      savedSelection = null,
    } = customCaret ? { restoreSelection: true, savedSelection: customCaret } : opts;

    if (!pagesContainerRef.current) return;
    const saved = shouldRestore
      ? (savedSelection || saveSelection())
      : null;

    isProgrammaticChangeRef.current = true;
    clearPages();
    const firstPage = ensureOnePage();
    const firstContent = firstPage.querySelector('.page-content');
    firstContent.innerHTML = documentEngineRef.current.toHTML();
    sizePageContent(firstPage);
    if (!deferPaginate) {
      schedulePaginate();
    }
    requestAnimationFrame(() => { 
      isProgrammaticChangeRef.current = false;
      if (shouldRestore) restoreSelection(saved);
    });
  }, [
    pagesContainerRef,
    documentEngineRef,
    isProgrammaticChangeRef,
    saveSelection,
    restoreSelection,
    clearPages,
    ensureOnePage,
    sizePageContent,
    schedulePaginate,
  ]);

  // Select all across all pages
  const selectAllAcrossPages = useCallback(() => {
    const root = pagesContainerRef.current;
    if (!root) return;

    const blocks = root.querySelectorAll('.page-content [data-block-id]');
    if (blocks.length === 0) return;

    const first = blocks[0];
    const last = blocks[blocks.length - 1];

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
  }, [pagesContainerRef]);

  const placeCaretAtStart = useCallback((el) => {
    const r = document.createRange();
    r.setStart(el, 0);
    r.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, []);

  const getActivePageContent = useCallback(() => {
    const root = pagesContainerRef.current;
    if (!root) return null;

    const sel = window.getSelection();
    const node = sel && sel.rangeCount
      ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)
      : null;

    const inContent = node?.closest?.('.page-content');
    if (inContent) return inContent;

    const first = root.querySelector('.page .page-content');
    if (first) placeCaretAtStart(first);
    return first;
  }, [pagesContainerRef, placeCaretAtStart]);

  const getPages = useCallback(() => {
    const container = pagesContainerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll?.('.page') || []);
  }, [pagesContainerRef]);

  const renumberPages = useCallback(() => {
    const pages = getPages();
    pages.forEach((p, i) => (p.dataset.pageIndex = `Page ${i + 1} of ${pages.length}`));
    setPageCount(pages.length);
  }, [getPages, setPageCount]);

  const placeCaretAtEnd = useCallback((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, []);

  const isPageEmpty = useCallback((pageEl) => {
    const content = pageEl?.querySelector?.('.page-content');
    if (!content) return false;
    
    const blocks = Array.from(content.querySelectorAll?.('[data-block-id]') || []);
    if (blocks.length === 0) return (content.textContent || '').trim().length === 0;
    
    if (blocks.length === 1) {
      const only = blocks[0];
      return (only.textContent || '').trim().length === 0;
    }
    
    return false;
  }, []);

  const isCaretAtStartOf = useCallback((containerEl) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0).cloneRange();

    const before = document.createRange();
    before.selectNodeContents(containerEl);
    before.setEnd(range.startContainer, range.startOffset);

    return before.toString().trim().length === 0;
  }, []);

  // Update all logo images in existing pages
  const updateAllLogoImgs = useCallback((logoData) => {
    const root = pagesContainerRef.current;
    if (!root) return;
    const imgs = root.querySelectorAll(".page-logo-img");
    imgs.forEach((img) => {
      if (logoData && logoData.preview) {
        img.src = logoData.preview;
        img.style.display = "block";
        img.style.maxHeight = "60px";
        img.style.objectFit = "contain";
        if (logoData.width) img.style.width = `${logoData.width}px`;
        else img.style.removeProperty("width");
        if (logoData.height) img.style.height = `${logoData.height}px`;
        else img.style.removeProperty("height");
      } else {
        img.removeAttribute("src");
        img.style.display = "none";
      }
    });
  }, [pagesContainerRef]);

  // Keep logo images in sync
  useEffect(() => {
    if (logo) {
      updateAllLogoImgs(logo);
    }
  }, [logo, updateAllLogoImgs]);

  // Apply orientation change to DOM and reflow when state updates
  useEffect(() => {
    const pages = pagesContainerRef.current?.querySelectorAll?.('.page') || [];
    pages.forEach(p => {
      p.classList.remove('portrait', 'landscape');
      p.classList.add(orientation);
    });
    sizeAllPages();
    schedulePaginate();
  }, [orientation, pagesContainerRef, sizeAllPages, schedulePaginate]);

  // Re-run sizing on window resize
  useEffect(() => {
    const onResize = () => {
      sizeAllPages();
      schedulePaginate();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sizeAllPages, schedulePaginate]);

  // Update current page on scroll
  useEffect(() => {
    const updateCurrentPageOnScroll = () => {
      const container = pagesContainerRef.current;
      if (!container) return;
      
      const pages = Array.from(container.querySelectorAll('.page'));
      if (pages.length === 0) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      
      let bestPageIndex = 0;
      let bestDistance = Infinity;
      
      pages.forEach((page, index) => {
        const pageRect = page.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPageIndex = index;
        }
      });
      
      setCurrentPage(bestPageIndex + 1);
    };

    const container = pagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateCurrentPageOnScroll);
      return () => container.removeEventListener('scroll', updateCurrentPageOnScroll);
    }
  }, [pagesContainerRef, setCurrentPage]);

  // Re-run sizing when paper size changes
  useEffect(() => {
    sizeAllPages();
    schedulePaginate();
  }, [paperSize, sizeAllPages, schedulePaginate]);

  return {
    getLayoutMetrics,
    checkEarlyBreak,
    fitsOnPage,
    saveSelection,
    restoreSelection,
    getContentHeight,
    sizePageContent,
    sizeAllPages,
    validatePageHeights,
    createPage,
    clearPages,
    ensureOnePage,
    schedulePaginate,
    debouncedPaginate,
    renderFreshFromEngine,
    selectAllAcrossPages,
    placeCaretAtStart,
    getActivePageContent,
    getPages,
    renumberPages,
    placeCaretAtEnd,
    isPageEmpty,
    isCaretAtStartOf,
    updateAllLogoImgs,
  };
}
