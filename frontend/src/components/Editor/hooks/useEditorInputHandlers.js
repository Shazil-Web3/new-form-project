import { useCallback } from 'react';
import { BLOCK_TYPES } from '../DocumentEngine';

/**
 * useEditorInputHandlers
 * Handles text change sync with document engine and socket,
 * paste operations (images, HTML, plain text),
 * Enter key block splitting, and beforeInput protection / normalization.
 */
export default function useEditorInputHandlers({
  docId,
  documentLoaded,
  pagesContainerRef,
  documentEngineRef,
  contentChangeHandlerRef,
  pasteHandlerRef,
  imagePasteHandlerRef,
  headerHTMLRef,
  footerHTMLRef,
  socket,
  updateTOC,
  setIsTyping,
  registerTypingAction,
  endTypingSession,
  pushToUndo,
  ignoreNextTypingActionRef,
  isProgrammaticChangeRef,
  checkEarlyBreak,
  schedulePaginate,
  debouncedPaginate,
  ensureOnePage,
  getActivePageContent,
  isInLockedText,
  findLockedElementBefore,
  findLockedElementAfter,
  skipLockedTextBackward,
  skipLockedTextForward,
}) {
  // Normalize unknown nodes (belt-and-suspenders) - works with all pages
  const normalizeUnknownNodes = useCallback(() => {
    const root = pagesContainerRef.current;
    if (!root) return;
    
    // STRICT: Only look inside .page-content to avoid capturing headers/footers
    const pcs = root.querySelectorAll('.page > .page-content');
    pcs.forEach(pc => {
      Array.from(pc.childNodes).forEach(n => {
        // Skip portaled UI elements, locked nodes, or nodes inside header/footer
        if (n.nodeType === 1) {
          if (n.closest('.page-header') || n.closest('.page-footer')) return;
          if (n.hasAttribute('data-block-id') || n.hasAttribute('data-portal-isolation')) return;
          
          // If it's a stray element, wrap it in a paragraph
          const text = n.textContent ?? '';
          const b = documentEngineRef.current.createBlock(BLOCK_TYPES.PARAGRAPH, text);
          n.replaceWith(...(new DOMParser().parseFromString(documentEngineRef.current.blockToHTML(b), 'text/html').body.childNodes));
        }
      });
    });
  }, [pagesContainerRef, documentEngineRef]);

  // Enhanced text change handler with document engine
  const handleTextChange = useCallback((event) => {
    if (isProgrammaticChangeRef.current) return;  // ignore our own renders

    // Record undo snapshot for user typing/editing actions
    registerTypingAction?.();
    
    // Ignore input events from header/footer elements
    if (event && event.target) {
      const isInHeader = event.target.closest?.('.page-header');
      const isInFooter = event.target.closest?.('.page-footer');
      if (isInHeader || isInFooter) {
        return; // Skip processing for header/footer input
      }
    }
    
    if (pagesContainerRef.current && documentLoaded) {
      setIsTyping(true);
      normalizeUnknownNodes();
      
      // Get ALL page content for proper synchronization - strictly target body content
      const allPages = pagesContainerRef.current?.querySelectorAll('.page > .page-content') || [];
      if (allPages.length === 0) return;
      
      // Sync content from all pages, not just the first one
      const syncAllPages = () => {
        // Collect all blocks from all pages in order
        const allBlocks = [];
        allPages.forEach((pageContent, pageIndex) => {
          const domEls = Array.from(pageContent?.querySelectorAll('[data-block-id]') || []).filter(el => {
            return !el.closest('.page-header') && !el.closest('.page-footer');
          });
          const pageBlocks = domEls.map(el => {
            const id = el.dataset.blockId;
            const tag = el.tagName.toLowerCase();
            const type = tag.startsWith('h') ? 'heading'
              : tag === 'blockquote' ? 'quote'
              : tag === 'pre' ? 'code'
              : tag === 'ol' || tag === 'ul' ? 'list'
              : tag === 'table' ? 'table'
              : 'paragraph';
            
            // Extract content based on type
            let content = '';
            if (type === 'list') {
              content = Array.from(el.children).map(li => li.innerHTML);
            } else if (type === 'table') {
              content = documentEngineRef.current.extractTableContent(el);
            } else {
              content = el.innerHTML;
            }
            
            return {
              id,
              type,
              content,
              metadata: {
                createdAt: new Date().toISOString(),
                pageIndex
              }
            };
          });
          allBlocks.push(...pageBlocks);
        });
        
        // Update document engine with all blocks from all pages
        documentEngineRef.current.document.pages = [{ id: 'page1', blocks: allBlocks }];
        
        // Get the structured content from document engine
        const blocks = documentEngineRef.current.getAllBlocks();
        const htmlContent = documentEngineRef.current.toHTML();
        
        socket.emit("textChange", { 
          docId, 
          content: htmlContent,
          blocks: blocks,
          headerHTML: headerHTMLRef.current,
          footerHTML: footerHTMLRef.current
        });
        
        try {
          localStorage.setItem(`doc_backup_${docId}`, JSON.stringify({
            content: htmlContent,
            blocks: blocks,
            headerHTML: headerHTMLRef.current,
            footerHTML: footerHTMLRef.current,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Failed to backup document to localStorage:', e);
        }
        
        if (updateTOC) updateTOC();
        
        const typingTimer = setTimeout(() => setIsTyping(false), 500);
        return () => clearTimeout(typingTimer);
      };
      
      // Use content change handler to sync DOM to blocks from ALL pages
      contentChangeHandlerRef.current.handleContentChange(
        pagesContainerRef.current,
        syncAllPages
      );
    }
  }, [
    docId,
    documentLoaded,
    updateTOC,
    normalizeUnknownNodes,
    registerTypingAction,
    isProgrammaticChangeRef,
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    headerHTMLRef,
    footerHTMLRef,
    socket,
    setIsTyping
  ]);

  // Enhanced paste handler
  const handlePaste = useCallback(async (event) => {
    // Ignore paste events from header/footer elements
    const isInHeader = event.target?.closest?.('.page-header');
    const isInFooter = event.target?.closest?.('.page-footer');
    if (isInHeader || isInFooter) {
      return;
    }

    // Record snapshot before pasting content
    endTypingSession?.();
    pushToUndo?.();
    if (ignoreNextTypingActionRef) {
      ignoreNextTypingActionRef.current = true;
    }
    
    // Stop the browser from doing a native paste
    event.preventDefault();

    // Get the current page content where the cursor is located
    const selection = window.getSelection();
    let targetContent = null;
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const startContainer = range.startContainer;
      const pageContent = startContainer.closest?.('.page-content');
      if (pageContent) {
        targetContent = pageContent;
      }
    }
    
    // Fallback to active page or first page
    if (!targetContent) {
      targetContent = getActivePageContent() || ensureOnePage()?.querySelector('.page-content');
    }
    
    if (!targetContent) return;

    // Try image pasting first
    if (imagePasteHandlerRef.current) {
      const imageHandled = await imagePasteHandlerRef.current.handleImagePaste(event, targetContent);
      if (imageHandled) {
        requestAnimationFrame(() => {
          handleTextChange();
          setTimeout(() => {
            schedulePaginate();
          }, 10);
        });
        return;
      }
    }

    // Fall back to regular paste handler
    if (!pasteHandlerRef.current) return;

    // Check for early break before pasting
    if (checkEarlyBreak(targetContent)) {
      console.log('Early break detected before paste, forcing pagination');
      schedulePaginate();
    }

    // Hand the event + target content area to paste handler
    await pasteHandlerRef.current.handlePaste(event, targetContent);

    requestAnimationFrame(() => {
      handleTextChange();
      setTimeout(() => {
        console.log('Paste operation: triggering pagination after content sync');
        schedulePaginate();
      }, 10);
    });
  }, [
    getActivePageContent,
    ensureOnePage,
    handleTextChange,
    checkEarlyBreak,
    schedulePaginate,
    endTypingSession,
    pushToUndo,
    ignoreNextTypingActionRef,
    imagePasteHandlerRef,
    pasteHandlerRef
  ]);

  // Enhanced Enter key handling that works across all pages
  const handleEnter = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // Find the current block element
    let el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const blockEl = el?.closest?.('[data-block-id]');
    if (!blockEl) return;

    const blockId = blockEl.dataset.blockId;
    
    // Find the block in the document engine
    const engine = documentEngineRef.current;
    const allBlocks = engine.getAllBlocks();
    const block = allBlocks.find(b => b.id === blockId);
    
    if (!block) return;

    // Only handle text blocks; let lists/tables use native behavior
    const textTypes = new Set([BLOCK_TYPES.PARAGRAPH, BLOCK_TYPES.HEADING, BLOCK_TYPES.QUOTE, BLOCK_TYPES.CODE]);
    if (!textTypes.has(block.type)) return;

    // Use DOM Range to split content while preserving HTML structure
    const splitRange = document.createRange();
    splitRange.selectNodeContents(blockEl);
    splitRange.setStart(range.startContainer, range.startOffset);
    
    // Extract the content after the cursor
    const fragment = splitRange.extractContents();
    
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const rightHtml = tempDiv.innerHTML;
    const leftHtml = blockEl.innerHTML;

    // Create new block for the right part
    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, rightHtml);
    engine.updateBlock(blockId, { content: leftHtml });
    
    const currentPage = engine.document.pages.find(page => 
      page.blocks.some(b => b.id === blockId)
    );
    
    if (currentPage) {
      const pageBlockIndex = currentPage.blocks.findIndex(b => b.id === blockId);
      if (pageBlockIndex !== -1) {
        currentPage.blocks.splice(pageBlockIndex + 1, 0, newBlock);
      }
    }

    // Insert the new element directly
    const newEl = document.createElement('p');
    newEl.setAttribute('data-block-id', newBlock.id);
    newEl.innerHTML = rightHtml;
    newEl.contentEditable = 'true';
    
    blockEl.parentElement.insertBefore(newEl, blockEl.nextSibling);
    
    // Position cursor at start of new block immediately
    const newRange = document.createRange();
    newRange.setStart(newEl, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setTimeout(() => {
      handleTextChange();
      schedulePaginate();
    }, 50);
  }, [documentEngineRef, handleTextChange, schedulePaginate]);

  // Handle beforeinput to catch any native paste attempts and Enter
  const handleBeforeInput = useCallback((e) => {
    const isInHeader = e.target?.closest?.('.page-header');
    const isInFooter = e.target?.closest?.('.page-footer');
    if (isInHeader || isInFooter) {
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      
      // Case 1: Insertion/Input inside or at boundary of locked text
      if (isInLockedText?.(range.startContainer) || isInLockedText?.(range.endContainer)) {
        e.preventDefault();
        return;
      }

      // Case 2: Deletion skip behavior
      if (e.inputType === 'deleteContentBackward') {
        const lockedBefore = findLockedElementBefore?.(range);
        if (lockedBefore) {
          skipLockedTextBackward?.(lockedBefore);
          return;
        }
      } else if (e.inputType === 'deleteContentForward') {
        const lockedAfter = findLockedElementAfter?.(range);
        if (lockedAfter) {
          skipLockedTextForward?.(lockedAfter);
          return;
        }
      }
    }
    
    const anchorEl = sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement;
    const blockEl = anchorEl?.closest?.('[data-block-id]');
    const blockId = blockEl?.dataset?.blockId;
    const block = blockId ? documentEngineRef.current.getBlock(blockId) : null;
    const inContent = anchorEl?.closest?.('.page-content');

    // For any text/paragraph input outside content, redirect caret and stop the event
    if (!inContent && (e.inputType === 'insertText' || e.inputType === 'insertParagraph')) {
      e.preventDefault();
      const first = pagesContainerRef.current?.querySelector('.page .page-content');
      if (first) {
        const r = document.createRange();
        r.setStart(first, 0);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
      return;
    }

    if (e.inputType === 'insertFromPaste') {
      e.preventDefault();
      handlePaste(e);
      return;
    }

    if (e.inputType === 'insertParagraph') {
      const currentBlockEl = anchorEl?.closest?.('[data-block-id]');
      const currentBlockId = currentBlockEl?.dataset?.blockId;
      const currentBlock = currentBlockId ? documentEngineRef.current.getBlock(currentBlockId) : null;
      const textTypes = new Set([BLOCK_TYPES.PARAGRAPH, BLOCK_TYPES.HEADING, BLOCK_TYPES.QUOTE, BLOCK_TYPES.CODE]);
      if (currentBlock && textTypes.has(currentBlock.type)) {
        e.preventDefault();
        handleEnter();
      } else {
        setTimeout(() => { handleTextChange(); schedulePaginate(); }, 0);
      }
      return;
    }

    if (e.inputType === 'insertLineBreak') {
      e.preventDefault();
      const s = window.getSelection();
      if (!s || !s.rangeCount) return;
      const r = s.getRangeAt(0);
      r.deleteContents();
      r.insertNode(document.createTextNode('\n'));
      r.collapse(false);
      s.removeAllRanges();
      s.addRange(r);
      debouncedPaginate();
    }
  }, [
    handlePaste,
    handleEnter,
    debouncedPaginate,
    handleTextChange,
    schedulePaginate,
    isInLockedText,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    documentEngineRef,
    pagesContainerRef
  ]);

  return {
    normalizeUnknownNodes,
    handleTextChange,
    handlePaste,
    handleEnter,
    handleBeforeInput,
  };
}
