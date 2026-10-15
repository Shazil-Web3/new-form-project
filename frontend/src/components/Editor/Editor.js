import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from 'axios';
import { socket } from "../../utils/SocketProvider";
import { Form, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import './../../styles/Editor/Editor.css';
import { useAuth } from '../../utils/authService';
import { Toolbar } from "./collaboration/Toolbar";
import useTableOfContents from "./collaboration/TOC";
import DocumentSubmit from "./collaboration/DocumentSubmit";
import HeaderFooterManager from "./HeaderFooterManager";

// Import the document engine
import { 
  DocumentEngine, 
  ContentChangeHandler,
  DocumentUtils,
  BLOCK_TYPES 
} from './DocumentEngine';
import { PasteHandler, HTMLToBlocksParser } from './PasteHandler';
import ImagePasteHandler from './ImagePasteHandler';
import UnifiedCommentSystem from "../Unified/UnifiedCommentSystem";
import useTableContextMenu from "../Unified/UnifiedTextEditor/hooks/useTableContextMenu";
import useTableMerge from "../Unified/UnifiedTextEditor/hooks/useTableMerge";
import useTableResize from "./hooks/useTableResize";
import useLockedText from "./hooks/useLockedText";
import { TemplateUpdateNotice, DocumentUpdateNotice } from "./components/EditorUpdateNotices";
import useEditorLocking from "./hooks/useEditorLocking";
import useEditorKeyboard from "./hooks/useEditorKeyboard";
import useEditorHistory from "./hooks/useEditorHistory";
import useEditorSocketSync from "./hooks/useEditorSocketSync";
import useEditorPagination from "./hooks/useEditorPagination";
import useEditorInputHandlers from "./hooks/useEditorInputHandlers";
// tableColumnResizeHelpers encapsulated in useTableResize hook

const Editor = () => {
  const { docId } = useParams();
  const editorRef = useRef(null);
  const [paperSize, setPaperSize] = useState("A4");
  const [isTyping, setIsTyping] = useState(false);
  const [orientation, setOrientation] = useState('portrait');
  const [users, setUsers] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [documentData, setDocumentData] = useState(null);
  const { user } = useAuth();
  const userName = user?.email || "Anonymous";
  const [cursors, setCursors] = useState({});
  const [submitDocumentModalVisible, setSubmitDocumentModalVisible] = useState(false);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(65);
  const [templateUpdateNotice, setTemplateUpdateNotice] = useState(null); // { newTemplate, oldTemplate }
  const [documentUpdateNotice, setDocumentUpdateNotice] = useState(null); // { newDocument, oldDocument }
  const { updateTOC, TOCComponent } = useTableOfContents(editorRef, sidebarWidth, setSidebarWidth);
  const [logo, setLogo] = useState(null);
  const [comments, setComments] = useState([]);
  const [suggestedEdits, setSuggestedEdits] = useState([]);
  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");
  const headerHTMLRef = useRef("");
  const footerHTMLRef = useRef("");

  // Sync refs with state
  useEffect(() => { headerHTMLRef.current = headerHTML; }, [headerHTML]);
  useEffect(() => { footerHTMLRef.current = footerHTML; }, [footerHTML]);

  // Pagination state
  const pagesContainerRef = useRef(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const paginationTimeoutRef = useRef(null);

  // Re-entrancy guards for pagination
  const isPaginatingRef = useRef(false);
  const paginateQueuedRef = useRef(false);
  
  // Guard programmatic re-renders from firing change handler
  const isProgrammaticChangeRef = useRef(false);
  const isInitialLoadRef = useRef(true); // NEW: Track first load

  // Document Engine instances
  const documentEngineRef = useRef(new DocumentEngine());
  const pasteHandlerRef = useRef(null);
  const contentChangeHandlerRef = useRef(null);
  const imagePasteHandlerRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const renderFreshFromEngineRef = useRef(null);
  const schedulePaginateRef = useRef(null);

  // --- UNDO / REDO HISTORY SYSTEM FOR COMMENTS & HIGHLIGHTS ---
  const {
    undo,
    redo,
    pushToUndo,
    registerTypingAction,
    endTypingSession,
    takeUndoSnapshot,
    ignoreNextTypingActionRef,
    getBlockAndOffset,
  } = useEditorHistory({
    pagesContainerRef,
    contentChangeHandlerRef,
    documentEngineRef,
    headerHTML,
    footerHTML,
    setHeaderHTML,
    setFooterHTML,
    comments,
    setComments,
    suggestedEdits,
    setSuggestedEdits,
    logo,
    setLogo,
    renderFreshFromEngineRef,
    docId,
    socket,
    updateTOC,
  });



  // Initialize document engine handlers
  useEffect(() => {
    const documentEngine = documentEngineRef.current;
    pasteHandlerRef.current = new PasteHandler(documentEngine);
    contentChangeHandlerRef.current = new ContentChangeHandler(documentEngine);
  }, []);

  // Initialize image paste handler after pagesContainerRef is available
  useEffect(() => {
    if (pagesContainerRef.current) {
      const documentEngine = documentEngineRef.current;
      imagePasteHandlerRef.current = new ImagePasteHandler(documentEngine, pagesContainerRef);
      
      // Set callbacks for image handler
      imagePasteHandlerRef.current.setCallbacks({
        schedulePaginate: () => schedulePaginate(),
        syncAndNotify: () => handleTextChange()
      });
      
      // Migrate any old HTML format image blocks to new JSON format
      imagePasteHandlerRef.current.migrateOldImageBlocks();
    }
  }, [pagesContainerRef.current]);

  // Monkey patch removeChild to prevent React crashes from manual DOM manipulation
  // This is a safety net for when React tries to unmount components from pages we've already manually removed
  useEffect(() => {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
      if (child && child.parentNode === this) {
        return originalRemoveChild.call(this, child);
      } else {
        // If the node is not a direct child, React would normally crash with NotFoundError.
        // We ignore it and pretend it was removed to keep the application stable.
        if (child && child.nodeType === 1 && (child.classList?.contains('floating-toolbar') || child.closest?.('.floating-toolbar'))) {
           console.warn("[Editor] Ignored removeChild error for floating toolbar: node not found or not a direct child", child);
        }
        return child; // Pretend we removed it
      }
    };

    return () => {
      Node.prototype.removeChild = originalRemoveChild;
    };
  }, []);

  // Only show logo strip space when an actual logo image exists.
  const hasVisibleLogo = !!(logo && logo.preview);

  // -------- Locked text protection & navigation helpers --------
  const {
    isLockedElement,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    isInLockedText,
  } = useLockedText(pagesContainerRef);

  // Pagination hook handling metrics, page sizing, creation, selection restoration, and debounced pagination
  const {
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
  } = useEditorPagination({
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
  });

  // Input handlers hook (text change sync, socket sync, paste, enter key block splitting, beforeInput)
  const {
    normalizeUnknownNodes,
    handleTextChange,
    handlePaste,
    handleEnter,
    handleBeforeInput,
  } = useEditorInputHandlers({
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
  });

  // -------- Table boundary resize (Production-grade, Google-Docs-like) --------
  useTableResize(pagesContainerRef, schedulePaginate, handleTextChange);

  useEffect(() => {
    renderFreshFromEngineRef.current = renderFreshFromEngine;
  }, [renderFreshFromEngine]);

  useEffect(() => {
    schedulePaginateRef.current = schedulePaginate;
  }, [schedulePaginate]);

  const { selectionInfo: tableMergeSelectionInfo, executeMerge: executeTableMerge } = useTableMerge({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    renderFreshFromEngineRef,
    schedulePaginateRef,
    pushToUndo,
    readOnly: false,
  });

  const tableContextMenu = useTableContextMenu({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    isProgrammaticChangeRef,
    renderFreshFromEngineRef,
    schedulePaginateRef,
    readOnly: false,
    pushToUndo,
    onMergeCells: () => {
      executeTableMerge();
    },
  });

  // Initialize document
  useEffect(() => {
    if (docId) {
      documentEngineRef.current.initializeDocument(docId);
    }
  }, [docId]);

  // Set editorRef to point to pagesContainerRef for compatibility
  useEffect(() => {
    editorRef.current = pagesContainerRef.current;
  }, []);

  // Cleanup pagination timeout on unmount
  useEffect(() => {
    return () => {
      if (paginationTimeoutRef.current) {
        clearTimeout(paginationTimeoutRef.current);
      }
    };
  }, []);

  // Force caret into content area on clicks and update current page
  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root) return;

    const handlePageClick = (e) => {
      const page = e.target.closest?.('.page');
      if (!page) return;

      const pages = Array.from(root.querySelectorAll('.page'));
      const pageIndex = pages.indexOf(page);
      if (pageIndex !== -1) {
        setCurrentPage(pageIndex + 1);
      }

      const isInContent = e.target.closest?.('.page-content');
      const isInHeader = e.target.closest?.('.page-header');
      const isInFooter = e.target.closest?.('.page-footer');
      
      if (isInContent || isInHeader || isInFooter) return;

      const content = page.querySelector('.page-content');
      if (!content) return;

      const rect = content.getBoundingClientRect();
      const atEnd = e.clientY > (rect.top + rect.height / 2);
      const range = document.createRange();
      range.setStart(content, atEnd ? content.childNodes.length : 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };

    root.addEventListener('mouseup', handlePageClick);
    return () => root.removeEventListener('mouseup', handlePageClick);
  }, [setCurrentPage]);

  // Load document and manage real-time synchronization with useEditorSocketSync
  useEditorSocketSync({
    docId,
    user,
    userName,
    socket,
    pagesContainerRef,
    documentEngineRef,
    setDocumentData,
    setUsers,
    setDepartments,
    setComments,
    setSuggestedEdits,
    setHeaderHTML,
    setFooterHTML,
    setTemplateUpdateNotice,
    setDocumentUpdateNotice,
    setLogo,
    setDocumentLoaded,
    documentLoaded,
    isPaginatingRef,
    clearPages,
    ensureOnePage,
    createPage,
    schedulePaginate,
    updateTOC,
    renderFreshFromEngine,
  });

  // -------- image event listeners --------
  useEffect(() => {
    if (!imagePasteHandlerRef.current) return;
    
    const cleanup = imagePasteHandlerRef.current.setupImageEventListeners();
    return cleanup;
  }, []);

  // Enhanced keyboard handler with block-aware operations
  const { handleKeyDown } = useEditorKeyboard({
    documentEngineRef,
    pagesContainerRef,
    imagePasteHandlerRef,
    ignoreNextTypingActionRef,
    selectAllAcrossPages,
    schedulePaginate,
    checkEarlyBreak,
    handleEnter,
    handleTextChange,
    renderFreshFromEngine,
    getPages,
    isPageEmpty,
    isCaretAtStartOf,
    placeCaretAtEnd,
    renumberPages,
    setCurrentPage,
    isInLockedText,
    findLockedElementBefore,
    findLockedElementAfter,
    skipLockedTextBackward,
    skipLockedTextForward,
    undo,
    redo,
    endTypingSession,
    pushToUndo,
  });

  // Add method to get document statistics
  const getDocumentStats = useCallback(() => {
    const blocks = documentEngineRef.current.getAllBlocks();
    return {
      wordCount: DocumentUtils.getWordCount(blocks),
      blockCount: blocks.length,
      blockTypes: blocks.reduce((counts, block) => {
        counts[block.type] = (counts[block.type] || 0) + 1;
        return counts;
      }, {})
    };
  }, []);

  // Method to export document as plain text
  const exportAsText = useCallback(() => {
    const blocks = documentEngineRef.current.getAllBlocks();
    return DocumentUtils.blocksToText(blocks);
  }, []);

  // Method to search within document
  const searchDocument = useCallback((query) => {
    const blocks = documentEngineRef.current.getAllBlocks();
    return DocumentUtils.searchBlocks(blocks, query);
  }, []);

  // Add these methods to window for debugging (optional)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.editorDebug = {
        getDocumentEngine: () => documentEngineRef.current,
        getBlocks: () => documentEngineRef.current.getAllBlocks(),
        getStats: getDocumentStats,
        exportText: exportAsText,
        search: searchDocument,
        getLayoutMetrics: getLayoutMetrics,
        checkEarlyBreak: checkEarlyBreak
      };
    }
  }, [getDocumentStats, exportAsText, searchDocument, getLayoutMetrics, checkEarlyBreak]);

  const handleCommentSystemChange = useCallback((data) => {
    let newComments = comments;
    let newSuggestions = suggestedEdits;

    if (data.allElements) {
      newComments = data.allElements.filter(el => el.type === 'comment');
      newSuggestions = data.allElements.filter(el => el.type === 'suggestededit');
      setComments(newComments);
      setSuggestedEdits(newSuggestions);
    }
    // Save updated HTML content layout to the database
    handleTextChange();
  }, [comments, suggestedEdits, handleTextChange]);

  const handleCommentAdd = useCallback((comment) => {
    setComments(prev => {
      if (prev.some(c => c.id === comment.id)) return prev;
      return [...prev, comment];
    });
  }, []);

  const handleSuggestionAdd = useCallback((suggestion) => {
    setSuggestedEdits(prev => {
      if (prev.some(s => s.id === suggestion.id)) return prev;
      return [...prev, suggestion];
    });
  }, []);

  const handleCommentUpdate = useCallback((comment) => {
    setComments(prev => prev.map(c => c.id === comment.id ? comment : c));
  }, []);

  const handleCommentRemove = useCallback((commentId) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
  }, []);

  const handleSuggestionRemove = useCallback((suggestionId) => {
    setSuggestedEdits(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  const handleInsertTable = useCallback((rows, cols) => {
    const safeRows = Math.max(1, Number(rows) || 1);
    const safeCols = Math.max(1, Number(cols) || 1);
    const engine = documentEngineRef.current;
    const tableBlock = engine.createBlock(BLOCK_TYPES.TABLE, {
      headers: [],
      rows: Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => ""))
    });

    const allBlocks = engine.getAllBlocks();
    const selection = window.getSelection();
    const anchorElement = selection?.anchorNode?.nodeType === 1
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const anchorBlock = anchorElement?.closest?.("[data-block-id]");
    const anchorBlockId = anchorBlock?.dataset?.blockId;
    const insertIndex = anchorBlockId
      ? Math.max(0, allBlocks.findIndex((block) => block.id === anchorBlockId) + 1)
      : allBlocks.length;

    const nextBlocks = [...allBlocks];
    nextBlocks.splice(insertIndex, 0, tableBlock);
    engine.document.pages = [{ id: "page1", blocks: nextBlocks }];

    renderFreshFromEngine({ restoreSelection: false });

    requestAnimationFrame(() => {
      const insertedTable = pagesContainerRef.current?.querySelector(`[data-block-id="${tableBlock.id}"]`);
      const firstCell = insertedTable?.querySelector("td, th");
      if (!firstCell) return;
      const range = document.createRange();
      range.selectNodeContents(firstCell);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }, [renderFreshFromEngine]);

  const { handleMakeEditable } = useEditorLocking({
    pagesContainerRef,
    savedSelectionRef,
    contentChangeHandlerRef,
    documentEngineRef,
    handleTextChange,
  });

  return (
    <div className="container-fluid">
      <Toolbar
        paperSize={paperSize}
        setPaperSize={setPaperSize}
        docId={docId}
        user={user}
        userName={userName}
        setSubmitDocumentModalVisible={setSubmitDocumentModalVisible}
        orientation={orientation}
        setOrientation={setOrientation}
        // Pass additional props for document stats
        documentStats={getDocumentStats()}
        exportAsText={exportAsText}
        searchDocument={searchDocument}
        onInsertTable={handleInsertTable}
      />

      {/* Template & Document Revision Update Notices */}
      <TemplateUpdateNotice notice={templateUpdateNotice} />
      <DocumentUpdateNotice notice={documentUpdateNotice} />

      <div className="main-container">
        <TOCComponent />
        <div className="content-container">
          {useMemo(() => (
            <div className="editor-container">
              <div
                ref={pagesContainerRef}
                className="document-renderer"
                onBeforeInput={handleBeforeInput}
                onInput={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
              />
            </div>
          ), [orientation, paperSize, docId, handleBeforeInput, handleTextChange, handleKeyDown, handlePaste])}

          {/* Header/Footer Manager - outside memo to allow state reactivity without blink */}
          <HeaderFooterManager
            containerRef={pagesContainerRef}
            headerHTML={headerHTML}
            footerHTML={footerHTML}
            onChange={({ headerHTML: h, footerHTML: f }) => {
              setHeaderHTML(h);
              setFooterHTML(f);
              // Trigger handleTextChange to save
              handleTextChange();
            }}
            options={{
              pageSelector: ".page",
              headerSelector: ".page-header",
              footerSelector: ".page-footer",
              footerEditSelector: ".page-footer .footer-left, .page-footer",
              pageNumSelector: ".page-footer [data-page-num]",
              injectStyles: true,
            }}
          />
          
          {/* Floating page counter like Docs - stays outside memo to update on every page change */}
          <div className="page-counter-chip">
            Page {currentPage} of {pageCount}
          </div>
        </div>
        <UnifiedCommentSystem
          mode="review"
          user={user}
          docId={docId}
          templateId={docId}
          pagesContainerRef={pagesContainerRef}
          comments={comments}
          suggestions={suggestedEdits}
          showFloatingToolbar={!isTyping}
          onCommentAdd={handleCommentAdd}
          onSuggestionAdd={handleSuggestionAdd}
          onCommentUpdate={handleCommentUpdate}
          onCommentRemove={handleCommentRemove}
          onSuggestionRemove={handleSuggestionRemove}
          onContentChange={handleCommentSystemChange}
          showApprovalActions={true}
          handleMakeEditable={handleMakeEditable}
        />
      </div>
      <DocumentSubmit
        visible={submitDocumentModalVisible}
        onCancel={() => setSubmitDocumentModalVisible(false)}
        document={documentData}
        departments={departments}
        users={users}
        user={user}
      />
      {tableMergeSelectionInfo && (
        <button
          type="button"
          className="floating-merge-cells-btn"
          style={{ top: tableMergeSelectionInfo.top, left: tableMergeSelectionInfo.left }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            executeTableMerge();
          }}
        >
          <i className="bi bi-grid-fill" /> Merge Cells
        </button>
      )}
      {tableContextMenu}
    </div>
  );
};

export default Editor;