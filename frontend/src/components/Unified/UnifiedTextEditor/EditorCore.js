import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { Toolbar } from "./components/Toolbar";
import useTableOfContents from "./components/TOC";
import { v4 as uuidv4 } from "uuid";
import UnifiedCommentSystem from "../UnifiedCommentSystem";
import usePageManagement, { LOCKED_STYLE, mergeLogoForDisplay, applyDropdownCellGuards } from "./hooks/usePageManagement";
import useEditorEventHandlers from "./hooks/useEditorEventHandlers";
import useTableContextMenu from "./hooks/useTableContextMenu";
import useEditorPasteContextMenu from "./hooks/useEditorPasteContextMenu";
import useTableMerge from "./hooks/useTableMerge";
import './styles/EditorCore.css';
import './styles/VideoBlock.css';
import './styles/superscriptSubscript.css';
import { handleSuperscriptSubscriptKeyDown } from "./utils/superscriptSubscript";
import axios from 'axios';
import { message } from 'antd';
import MakeOptionModal from "./components/MakeOptionModal";
import SpecialCharactersModal from "./components/SpecialCharactersModal";
import InsertVideoModal from "./components/InsertVideoModal";
import OrientationModal from "./components/OrientationModal";
import DocumentMentionMenu from "./components/DocumentMentionMenu";
import { useFindReplace, FindReplaceModal } from "./FindReplace";
import { exportDocumentToPdf } from "./utils/pdfExport";
import VideoResizeHandler from "./utils/VideoResizeHandler";
import {
  getEditorScrollContainer,
  restoreEditorScrollAfterLayout,
  saveEditorScroll,
} from "./utils/editorScrollUtils";
import { createCaretVisibilityManager } from "./utils/caretVisibilityManager";
import { isSkeletonEditorContent } from "../../../utils/editorContentGuards";


import {
  DocumentEngine,
  ContentChangeHandler,
  BLOCK_TYPES,
} from "../../Editor/DocumentEngine";
import {
  PasteHandler,
  HTMLToBlocksParser,
} from "../../Editor/PasteHandler";
import ImagePasteHandler from "../../Editor/ImagePasteHandler";
import HeaderFooterManager from "../../Editor/HeaderFooterManager";

const TemplateEditor = ({
  user,
  initialContent,
  onContentChange,
  pagesContainerRef: externalRef,
  showTOC = true,
  currentUser,
  userRole,
  isPreviewMode = false,
  isApprovalState = false,
  readOnly = false,
  syncTitleToHeader = false,
  lockHeaderEditing = false,
  comments: propComments,
  suggestions: propSuggestions,
  references: propReferences,
  logo: propLogo,
  setLogo: propSetLogo,
  onTyping,
  headerHTML: propHeaderHTML,
  footerHTML: propFooterHTML,
  documentTitle,
  enableTypedUnderlines = true,
  disableStrikeOnDelete = false,
  isDocument = false,
  documentId,
  templateId,
  isDraft = false,
  onToggleLockReady,
  workflowApprovers: propWorkflowApprovers,
  approvers: propApprovers,
  ...props
}) => {
  // --- 1. STATE DECLARATIONS ---
  const isRevise = Boolean(
    props.isRevise ||
    props.revising ||
    props.isRevising ||
    props.document?.revision_parent_id ||
    props.template?.revision_parent_id
  );
  const effectiveIsDraft = isRevise ? false : Boolean(isDraft);
  const isReviewMode = Boolean(
    props.isReviewMode ||
    props.mode === 'review' ||
    props.isReview ||
    (props.userRole && ['reviewer', 'template_reviewer', 'approver', 'template_approver'].includes(String(props.userRole).toLowerCase()))
  );
  const shouldSpellCheck = !readOnly && !isPreviewMode && !isReviewMode;
  const [templateUpdateNotice, setTemplateUpdateNotice] = useState(null);
  const [documentUpdateNotice, setDocumentUpdateNotice] = useState(null);
  const [isMigratingTemplate, setIsMigratingTemplate] = useState(false);
  const [templateComments, setTemplateComments] = useState(() => propComments || []);
  const [templateSuggestions, setTemplateSuggestions] = useState(() => propSuggestions || []);
  const [templateReferences, setTemplateReferences] = useState(() => propReferences || []);

  useEffect(() => {
    if (propComments !== undefined) setTemplateComments(propComments || []);
  }, [propComments]);

  useEffect(() => {
    if (propSuggestions !== undefined) setTemplateSuggestions(propSuggestions || []);
  }, [propSuggestions]);

  useEffect(() => {
    if (propReferences !== undefined) setTemplateReferences(propReferences || []);
  }, [propReferences]);
  const [headerHTML, setHeaderHTML] = useState(() => {
    const docTitle = String(documentTitle || "").trim();
    if (initialContent && typeof initialContent === "object" && initialContent.headerHTML) {
      return initialContent.headerHTML;
    }
    if (propHeaderHTML) {
      return propHeaderHTML;
    }
    return docTitle;
  });
  const [footerHTML, setFooterHTML] = useState(() => {
    if (initialContent && typeof initialContent === "object" && initialContent.footerHTML !== undefined) {
      return initialContent.footerHTML || "";
    }
    return propFooterHTML || "";
  });
  const [paperSize, setPaperSize] = useState(() => {
    if (initialContent && typeof initialContent === "object" && initialContent.paperSize) {
      return initialContent.paperSize;
    }
    return "A4";
  });
  const [orientation, setOrientation] = useState(() => {
    if (initialContent && typeof initialContent === "object" && initialContent.orientation) {
      return initialContent.orientation;
    }
    return "portrait";
  });
  const [sidebarWidth, setSidebarWidth] = useState(65);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [dropdownModalVisible, setDropdownModalVisible] = useState(false);
  const [dropdownTargetCell, setDropdownTargetCell] = useState(null);
  const [specialCharactersModalVisible, setSpecialCharactersModalVisible] = useState(false);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);
  const [pendingOrientation, setPendingOrientation] = useState("portrait");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportStatus, setPdfExportStatus] = useState("");
  const savedVideoRangeRef = useRef(null);
  const savedVideoBlockIdRef = useRef(null);
  const [pagesState, setPagesState] = useState(() => {
    if (initialContent && typeof initialContent === "object" && Array.isArray(initialContent.pagesState) && initialContent.pagesState.length > 0) {
      return initialContent.pagesState;
    }
    return [
      {
        id: uuidv4(),
        header: { id: uuidv4(), type: "locked", content: String(documentTitle || "").trim(), logo: null },
        footer: { id: uuidv4(), type: "locked", content: "" },
        headerLogoFile: null,
      },
    ];
  });

  // --- Hyperlink System (@-mention) state ---
  const [mentionState, setMentionState] = useState({
    isOpen: false,
    position: null,
    triggerRange: null,
    query: ''
  });

  const pagesStateRef = useRef(pagesState);
  useEffect(() => {
    pagesStateRef.current = pagesState;
  }, [pagesState]);

  useEffect(() => {
    if (initialContent && typeof initialContent === 'object' && Array.isArray(initialContent.pagesState) && initialContent.pagesState.length > 0) {
      setPagesState(initialContent.pagesState);
      pagesStateRef.current = initialContent.pagesState;
    }
  }, [initialContent?.pagesState]);

  // --- 2. REF DECLARATIONS ---
  const internalPagesRef = useRef(null);
  const pagesContainerRef = externalRef || internalPagesRef;
  const documentEngineRef = useRef(new DocumentEngine());
  const pasteHandlerRef = useRef(null);
  const contentChangeHandlerRef = useRef(null);
  const imagePasteHandlerRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const paginationTimeoutRef = useRef(null);
  const lastLocalTypingTimeRef = useRef(0);
  const editorRef = useRef(null);
  const hasLoadedInitialContentRef = useRef(false);
  const currentEntityIdRef = useRef(documentId || templateId || null);
  const lastBroadcastHtmlRef = useRef("");
  const lastBroadcastBlocksJsonRef = useRef("");
  const hasLocalUserEditsRef = useRef(false);

  useEffect(() => {
    const nextId = documentId || templateId || null;
    if (nextId && nextId !== currentEntityIdRef.current) {
      currentEntityIdRef.current = nextId;
      hasLoadedInitialContentRef.current = false;
      hasLocalUserEditsRef.current = false;
      lastBroadcastHtmlRef.current = "";
      lastBroadcastBlocksJsonRef.current = "";
    }
  }, [documentId, templateId]);

  const syncAndNotifyRef = useRef(null);
  const schedulePaginateRef = useRef(null);
  const renderFreshFromEngineRef = useRef(null);
  const isProgrammaticChangeRef = useRef(null);
  const sizePageContentRef = useRef(null);
  const selectAllFiredRef = useRef(false);
  const prevDocumentTitleRef = useRef(null);
  const hasUserCustomizedHeaderRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const syncOptionsRef = useRef({});
  const dropdownScrollRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimerRef = useRef(null);
  const prevLayoutConfigRef = useRef({ orientation: null, paperSize: null, pageOrientations: "" });

  // Caret Visibility / Auto-Scroll Manager instance
  const caretManagerRef = useRef(null);
  if (!caretManagerRef.current) {
    caretManagerRef.current = createCaretVisibilityManager({
      getPagesContainer: () => pagesContainerRef.current,
      topMargin: 60,
      bottomMargin: 80,
      smoothThreshold: 150,
      onClearUserScrollLock: () => {
        isUserScrollingRef.current = false;
        if (typeof window !== "undefined") {
          window.isUserScrollingEditor = false;
        }
        if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
      },
    });
  }

  useEffect(() => {
    return () => {
      caretManagerRef.current?.destroy();
    };
  }, []);

  // --- 3. CUSTOM HOOKS ---
  const { updateTOC, TOCComponent } = useTableOfContents(
    editorRef,
    sidebarWidth,
    setSidebarWidth
  );

  const parentLogoRef = useRef(propLogo);
  parentLogoRef.current = propLogo;

  const handleLogoChange = useCallback((logoData) => {
    if (parentLogoRef) parentLogoRef.current = logoData;
    if (propSetLogo) {
      propSetLogo(logoData);
    }
    setTimeout(() => {
      if (syncAndNotifyRef.current) syncAndNotifyRef.current(null, null, null, null, null, false, null, null, logoData);
    }, 100);
  }, [propSetLogo]);

  const {
    schedulePaginate,
    renderFreshFromEngine,
    sizeAllPages,
    updateAllLogoImgs,
    getBlockAndOffset,
    ensureOnePage,
  } = usePageManagement({
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
    onLogoChange: handleLogoChange,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    isProgrammaticChangeRef,
    sizePageContentRef,
    parentLogoRef,
    isPreviewMode,
    isDocument,
    lockHeaderEditing: lockHeaderEditing || readOnly,
    readOnly,
    caretManagerRef,
    spellCheckEnabled: shouldSpellCheck,
  });

  // --- 3.5 UNDO / REDO HISTORY SYSTEM ---
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isUndoRedoActionRef = useRef(false);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const ignoreNextTypingActionRef = useRef(false);

  const latestStateRef = useRef({});
  useEffect(() => {
    latestStateRef.current = {
      headerHTML,
      footerHTML,
      templateComments,
      templateSuggestions,
      templateReferences,
      pagesState,
      propLogo,
    };
  }, [headerHTML, footerHTML, templateComments, templateSuggestions, templateReferences, pagesState, propLogo]);

  const takeUndoSnapshot = useCallback(() => {
    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }

    let caret = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const caretInfo = getBlockAndOffset(range.startContainer, range.startOffset);
      if (caretInfo) {
        caret = {
          blockId: caretInfo.blockId,
          offset: caretInfo.pos,
          tableCellInfo: caretInfo.tableCellInfo
        };
      }
    }

    const state = latestStateRef.current;
    const snapshot = {
      pages: JSON.parse(JSON.stringify(documentEngineRef.current.document.pages)),
      headerHTML: state.headerHTML,
      footerHTML: state.footerHTML,
      comments: JSON.parse(JSON.stringify(state.templateComments || [])),
      suggestions: JSON.parse(JSON.stringify(state.templateSuggestions || [])),
      references: JSON.parse(JSON.stringify(state.templateReferences || [])),
      pagesState: JSON.parse(JSON.stringify(state.pagesState || [])),
      logo: state.propLogo ? JSON.parse(JSON.stringify(state.propLogo)) : null,
      caret
    };
    return snapshot;
  }, [getBlockAndOffset, contentChangeHandlerRef, pagesContainerRef]);

  const pushToUndo = useCallback((force = false) => {
    if (isUndoRedoActionRef.current) return;
    const snapshot = takeUndoSnapshot();
    
    // Prevent consecutive duplicate snapshots unless forced for structural mutations
    if (!force) {
      const lastSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
      if (lastSnapshot) {
        const pagesEqual = JSON.stringify(lastSnapshot.pages) === JSON.stringify(snapshot.pages);
        const headerEqual = lastSnapshot.headerHTML === snapshot.headerHTML;
        const footerEqual = lastSnapshot.footerHTML === snapshot.footerHTML;
        const commentsEqual = JSON.stringify(lastSnapshot.comments) === JSON.stringify(snapshot.comments);
        const suggestionsEqual = JSON.stringify(lastSnapshot.suggestions) === JSON.stringify(snapshot.suggestions);
        const referencesEqual = JSON.stringify(lastSnapshot.references) === JSON.stringify(snapshot.references);
        const pagesStateEqual = JSON.stringify(lastSnapshot.pagesState) === JSON.stringify(snapshot.pagesState);
        const logoEqual = JSON.stringify(lastSnapshot.logo) === JSON.stringify(snapshot.logo);
        
        if (pagesEqual && headerEqual && footerEqual && commentsEqual && suggestionsEqual && referencesEqual && pagesStateEqual && logoEqual) {
          return; // Don't push duplicates
        }
      }
    }
    
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, [takeUndoSnapshot]);

  const restoreSnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      isUndoRedoActionRef.current = false;
      return;
    }
    
    window.isUndoRedoRestoring = true;
    
    // 1. Restore document engine blocks
    documentEngineRef.current.document.pages = JSON.parse(JSON.stringify(snapshot.pages));
    documentEngineRef.current.currentPageIndex = 0;
    
    // 2. Restore state variables
    setHeaderHTML(snapshot.headerHTML || "");
    setFooterHTML(snapshot.footerHTML || "");
    setTemplateComments(snapshot.comments || []);
    setTemplateSuggestions(snapshot.suggestions || []);
    setTemplateReferences(snapshot.references || []);
    setPagesState(snapshot.pagesState || []);
    
    if (propSetLogo) {
      propSetLogo(snapshot.logo);
    }
    
    // 3. Render fresh from engine with the custom caret restored
    if (renderFreshFromEngineRef.current) {
      renderFreshFromEngineRef.current(snapshot.caret);
    }
    
    // Sync and notify parent immediately (bypassing debounces and isProgrammaticChange checks)
    const html = documentEngineRef.current.toHTML();
    const activeComments = snapshot.comments || [];
    const activeSuggestions = snapshot.suggestions || [];
    const activeReferences = snapshot.references || [];
    const cleanHtml = html
      .replace(/(class="[^"]*)\s*editor-highlight-hovered\s*([^"]*")/g, '$1$2')
      .replace(/class="\s*"/g, '')
      .replace(/class=""/g, '');

    // Get logo
    const pageLogo = snapshot.pagesState?.[0]?.header?.logo || pagesState[0]?.header?.logo || null;
    const mergedLogo = mergeLogoForDisplay(pageLogo, propLogo);

    // logoText & logoTextRight
    const logoCenterEl = pagesContainerRef.current?.querySelector(".logo-center");
    const logoCenterLeftEl = logoCenterEl?.querySelector(".logo-center-left");
    const logoCenterRightEl = logoCenterEl?.querySelector(".logo-center-right");
    let currentLogoText = "";
    let currentLogoTextRight = "";
    if (logoCenterLeftEl) {
      currentLogoText = logoCenterLeftEl.textContent || "";
      currentLogoTextRight = logoCenterRightEl?.textContent || "";
    } else {
      currentLogoText = logoCenterEl?.textContent || "";
    }

    const logoPayload = mergedLogo ? {
      ...mergedLogo,
      text: currentLogoText || mergedLogo.text || snapshot.pagesState?.[0]?.header?.logoText || pagesState[0]?.header?.logoText || "",
      textRight: currentLogoTextRight || mergedLogo.textRight || snapshot.pagesState?.[0]?.header?.logoTextRight || pagesState[0]?.header?.logoTextRight || "",
    } : (currentLogoText || currentLogoTextRight ? {
      text: currentLogoText,
      textRight: currentLogoTextRight
    } : null);

    const normalizeElement = (el, fallbackType = 'comment') => ({
      id: el.id,
      user: el.user || el.author || 'Template Author',
      author: el.author || el.user || 'Template Author',
      userId: el.userId ?? null,
      userEmail: el.userEmail ?? el.email ?? null,
      email: el.email ?? el.userEmail ?? null,
      text: el.text ?? '',
      highlightedText: el.highlightedText ?? el.selectedText ?? '',
      selectedText: el.selectedText ?? el.highlightedText ?? '',
      type: el.type ?? fallbackType,
      status: el.status ?? (el.type === 'suggestededit' ? 'pending' : 'open'),
      replies: Array.isArray(el.replies) ? el.replies : [],
      fragmentId: el.fragmentId ?? `fragment-${el.id}`,
      timestamp: el.timestamp ?? new Date().toISOString(),
      avatar: el.avatar ?? null,
      position: el.position ?? null,
      createdInDraft: el.createdInDraft !== undefined ? el.createdInDraft : (effectiveIsDraft ? true : undefined),
      origin: el.origin || (effectiveIsDraft ? 'draft' : undefined),
      stage: el.stage || (effectiveIsDraft ? 'draft' : undefined),
    });

    const changeData = {
      content: cleanHtml,
      paperSize,
      orientation,
      pagesState: snapshot.pagesState || pagesState,
      lastModified: new Date().toISOString(),
      comments: activeComments.map((c) => normalizeElement(c, 'comment')),
      suggestions: activeSuggestions.map((s) => normalizeElement(s, 'suggestededit')),
      references: activeReferences.map((r) => ({
        ...r,
        id: r.id,
        type: 'reference',
        refNumber: typeof r.refNumber === 'number' ? r.refNumber : (r.isManual ? null : 0),
      })),
      headerHTML: snapshot.headerHTML || "",
      footerHTML: snapshot.footerHTML || "",
      logo: logoPayload,
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    onContentChange?.(changeData);
    updateTOC();
    
    // Trigger pagination
    if (schedulePaginateRef.current) {
      schedulePaginateRef.current();
    }
    
    // Reset action flag after a short delay
    setTimeout(() => {
      isUndoRedoActionRef.current = false;
      window.isUndoRedoRestoring = false;
    }, 800);
  }, [propSetLogo, onContentChange, updateTOC, paperSize, orientation, propLogo, pagesState]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    
    isUndoRedoActionRef.current = true;
    
    const currentSnapshot = takeUndoSnapshot();
    redoStackRef.current.push(currentSnapshot);
    if (redoStackRef.current.length > 100) {
      redoStackRef.current.shift();
    }
    
    const snapshot = undoStackRef.current.pop();
    restoreSnapshot(snapshot);
    caretManagerRef.current?.onEditingAction("undo", { behavior: "smooth" });
  }, [takeUndoSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    
    isUndoRedoActionRef.current = true;
    
    const currentSnapshot = takeUndoSnapshot();
    undoStackRef.current.push(currentSnapshot);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }
    
    const snapshot = redoStackRef.current.pop();
    restoreSnapshot(snapshot);
    caretManagerRef.current?.onEditingAction("redo", { behavior: "smooth" });
  }, [takeUndoSnapshot, restoreSnapshot]);

  const registerTypingAction = useCallback(() => {
    hasLoadedInitialContentRef.current = true;
    if (isUndoRedoActionRef.current) return;
    
    if (ignoreNextTypingActionRef.current) {
      ignoreNextTypingActionRef.current = false;
      isTypingRef.current = true;
      return;
    }
    
    if (!isTypingRef.current) {
      pushToUndo();
      isTypingRef.current = true;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      pushToUndo();
    }, 1500);
  }, [pushToUndo]);

  const endTypingSession = useCallback(() => {
    if (isTypingRef.current) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      pushToUndo();
      isTypingRef.current = false;
    }
  }, [pushToUndo]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // --- 4. EFFECTS ---

  useEffect(() => {
    if (propComments) setTemplateComments(propComments);
  }, [propComments]);

  useEffect(() => {
    if (propSuggestions) setTemplateSuggestions(propSuggestions);
  }, [propSuggestions]);

  useEffect(() => {
    if (propReferences) setTemplateReferences(propReferences);
  }, [propReferences]);

  useEffect(() => {
    editorRef.current = pagesContainerRef.current;
  }, [pagesContainerRef]);

  // --- Find & Replace System (Google Docs / Word style) ---
  const findReplace = useFindReplace({
    containerRef: pagesContainerRef,
    schedulePaginate,
    onContentChange: () => {
      pushToUndo?.();
      syncAndNotify?.();
    },
    readOnly: Boolean(readOnly),
  });

  useEffect(() => {
    const handleFindReplaceShortcut = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const key = (e.key || '').toLowerCase();
        if (key === 'f') {
          e.preventDefault();
          e.stopPropagation();
          findReplace.openFind('find');
        } else if (key === 'h') {
          e.preventDefault();
          e.stopPropagation();
          findReplace.openFind('replace');
        }
      }
    };

    window.addEventListener('keydown', handleFindReplaceShortcut, true);
    return () => {
      window.removeEventListener('keydown', handleFindReplaceShortcut, true);
    };
  }, [findReplace]);

  // Version notices checker effect
  useEffect(() => {
    const checkVersionNotices = async () => {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (isDocument) {
        if (documentId) {
          // 1. Check if the template used in the document has a newer version published
          try {
            const res = await axios.get(`/api/template-update-notice/${documentId}`, { headers });
            if (res.data && res.data.hasNewerVersion) {
              setTemplateUpdateNotice(res.data);
            }
          } catch (e) {
            console.error("Error fetching template update notice:", e);
          }

          // 2. Check if there is a newer revised version of the document itself published
          try {
            const res = await axios.get(`/api/document-update-notice/${documentId}`, { headers });
            if (res.data && res.data.hasNewerVersion) {
              setDocumentUpdateNotice(res.data);
            }
          } catch (e) {
            console.error("Error fetching document update notice:", e);
          }
        }
      } else {
        // We are working on a Template directly. Check if a newer version of the template itself is published
        if (templateId) {
          try {
            const res = await axios.get(`/api/template-version-notice/${templateId}`, { headers });
            if (res.data && res.data.hasNewerVersion) {
              setTemplateUpdateNotice(res.data);
            }
          } catch (e) {
            console.error("Error fetching template version notice:", e);
          }
        }
      }
    };

    checkVersionNotices();
  }, [isDocument, documentId, templateId]);

  const handleMigrateTemplate = async () => {
    if (!templateUpdateNotice || !templateUpdateNotice.newTemplate) return;
    setIsMigratingTemplate(true);
    const newTemplateId = templateUpdateNotice.newTemplate.id;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch latest template details
      const response = await axios.get(`/api/get_template/${newTemplateId}`, { headers });
      const newTemplateData = response.data;
      if (!newTemplateData) {
        throw new Error("Failed to fetch new template data");
      }

      // 2. Extract elements
      let newHeaderHTML = newTemplateData.headerHTML || "";
      let newFooterHTML = newTemplateData.footerHTML || "";
      let newLogo = newTemplateData.logo || null;

      // Update states locally
      setHeaderHTML(newHeaderHTML);
      setFooterHTML(newFooterHTML);
      if (propSetLogo) {
        propSetLogo(newLogo);
      }

      // 3. If in document mode, atomically update document's template reference in database
      if (isDocument && documentId) {
        await axios.put(
          `/api/documents/${documentId}/update-template-reference`,
          { templateId: newTemplateId },
          { headers }
        );
      }

      // Clear the notice
      setTemplateUpdateNotice(null);
      message.success("Successfully migrated to the latest template version!");

      // Trigger pagination/sync updates
      setTimeout(() => {
        if (syncAndNotifyRef.current) {
          syncAndNotifyRef.current(null, null, newHeaderHTML, newFooterHTML);
        }
        if (schedulePaginateRef.current) {
          schedulePaginateRef.current();
        }
      }, 100);

    } catch (err) {
      console.error("Failed to migrate template:", err);
      message.error("Failed to migrate template. Please try again.");
    } finally {
      setIsMigratingTemplate(false);
    }
  };

  const handleOpenLatestDocument = () => {
    if (documentUpdateNotice && documentUpdateNotice.newDocument) {
      const newDocId = documentUpdateNotice.newDocument.id;
      window.location.href = `/document/${newDocId}`;
    }
  };

  // --- 4.1 VISIBILITY & RESIZE HANDLING ---
  // Trigger re-pagination when the editor becomes visible (e.g., switching back from another tab).
  // This fixes the issue where the editor renders incorrectly when mounted while hidden.
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return undefined;

    const scrollEl = getEditorScrollContainer(container);
    const onScroll = () => {
      if (
        isProgrammaticChangeRef.current ||
        window.isProgrammaticScroll ||
        window.isPaginatingEditor ||
        caretManagerRef.current?.isProgrammaticScroll
      ) {
        return;
      }
      isUserScrollingRef.current = true;
      window.isUserScrollingEditor = true;
      if (caretManagerRef.current) {
        caretManagerRef.current.needsEnsureCaret = false;
      }
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
      userScrollTimerRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        window.isUserScrollingEditor = false;
      }, 300);
    };
    scrollEl?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("wheel", onScroll, { passive: true, capture: true });
    window.addEventListener("touchmove", onScroll, { passive: true, capture: true });

    let resizeTimer = null;
    let prevWidth = 0;
    let prevHeight = 0;
    const observer = new ResizeObserver((entries) => {
      if (isUserScrollingRef.current || window.isInteractingWithDropdown) return;

      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const wasHidden = prevWidth === 0 && width > 0;
          const widthChanged = prevWidth > 0 && Math.abs(width - prevWidth) >= 2;
          prevWidth = width;
          prevHeight = height;

          if (wasHidden || widthChanged) {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              schedulePaginateRef.current?.();
            }, 100);
          }
        }
      }
    });

    if (scrollEl) {
      observer.observe(scrollEl);
    } else {
      observer.observe(container);
    }
    return () => {
      scrollEl?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("wheel", onScroll, { capture: true });
      window.removeEventListener("touchmove", onScroll, { capture: true });
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [pagesContainerRef, schedulePaginateRef]);

  // Monkey patch removeChild to prevent React crashes from manual DOM manipulation
  // This is a safety net for when React tries to unmount components from pages we've already manually moved or removed
  useEffect(() => {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
      if (child && child.parentNode === this) {
        return originalRemoveChild.call(this, child);
      }
      // If the node is not a direct child, React would normally crash with NotFoundError.
      // We ignore it and pretend it was removed to keep the application stable.
      if (child && child.nodeType === 1) {
        console.warn("[EditorCore] Ignored removeChild error: node is not a direct child of this parent", {
          parent: this,
          child: child,
          actualParent: child.parentNode
        });
      }
      return child;
    };

    return () => {
      Node.prototype.removeChild = originalRemoveChild;
    };
  }, []);

  useEffect(() => {
    // Ensure at least one page exists so headers/footers are visible for auto-fill
    ensureOnePage();
  }, [ensureOnePage]);

  // When activeTab transitions to Content, instantly re-measure and paginate visible pages
  useEffect(() => {
    if (props?.isActive === false) return;

    const timer = setTimeout(() => {
      if (sizePageContentRef.current && pagesContainerRef.current) {
        const pages = pagesContainerRef.current.querySelectorAll(".page");
        pages.forEach((p) => sizePageContentRef.current(p));
      }
      if (schedulePaginateRef.current) {
        schedulePaginateRef.current();
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [props?.isActive, sizePageContentRef, schedulePaginateRef, pagesContainerRef]);

  // AUTO-FILL HEADER FROM DOCUMENT TITLE.
  // Requirement: Basic Info document title should sync to the header, 
  // but manual header edits should NOT be overwritten once made.
  useEffect(() => {
    const trimmedTitle = String(documentTitle || "").trim();
    const prevTitle = String(prevDocumentTitleRef.current || "").trim();
    const titleChanged = prevDocumentTitleRef.current === null || trimmedTitle !== prevTitle;

    prevDocumentTitleRef.current = documentTitle || "";

    if (!syncTitleToHeader && (isPreviewMode || isApprovalState)) return;

    if (!titleChanged && !syncTitleToHeader) {
      return;
    }

    const currentHeader = String(headerHTML || "").trim();
    const isHeaderEmptyOrDefault =
      currentHeader === "" ||
      currentHeader === "Add Header Text" ||
      currentHeader === "Click to add header/footer" ||
      currentHeader === prevTitle;

    if (syncTitleToHeader || isHeaderEmptyOrDefault || !hasUserCustomizedHeaderRef.current) {
      hasUserCustomizedHeaderRef.current = false;
      setHeaderHTML(trimmedTitle);

      setPagesState((prev) => {
        const firstPage = prev[0];
        if (!firstPage) return prev;
        if (String(firstPage.header?.content || "").trim() === trimmedTitle) return prev;

        const p = [...prev];
        p[0] = {
          ...p[0],
          header: {
            ...(p[0].header || {}),
            content: trimmedTitle
          }
        };
        return p;
      });
    }
  }, [documentTitle, isPreviewMode, isApprovalState, syncTitleToHeader, headerHTML]);

  // Listen for actions outside EditorCore (e.g. comments/suggestions mutations)
  // to push a snapshot to the undo stack before mutation occurs.
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleBeforeAction = () => {
      pushToUndo();
      ignoreNextTypingActionRef.current = true;
    };

    container.addEventListener("editor-before-action", handleBeforeAction);
    return () => {
      container.removeEventListener("editor-before-action", handleBeforeAction);
    };
  }, [pagesContainerRef, pushToUndo]);

  const prevMergedLogoRef = useRef(null);

  useEffect(() => {
    if (propLogo) {
      setPagesState((prev) => {
        const currentHeader = prev[0]?.header || {};
        const logoChanged = currentHeader.logo?.preview !== propLogo.preview;
        const textChanged = currentHeader.logoText !== propLogo.text;
        const textRightChanged = currentHeader.logoTextRight !== propLogo.textRight;
        if (!logoChanged && !textChanged && !textRightChanged) return prev;
        const p = [...prev];
        p[0] = {
          ...(p[0] || { id: uuidv4(), header: {}, footer: {} }),
          header: {
            ...(p[0]?.header || {}),
            logo: propLogo.preview ? {
              preview: propLogo.preview,
              width: propLogo.width || 100,
              height: propLogo.height || 40,
            } : p[0]?.header?.logo,
            logoText: propLogo.text !== undefined ? propLogo.text : p[0]?.header?.logoText,
            logoTextRight: propLogo.textRight !== undefined ? propLogo.textRight : p[0]?.header?.logoTextRight,
          },
        };
        return p;
      });
    }
  }, [propLogo]);

  useEffect(() => {
    const currentPagesState = pagesStateRef.current || pagesState || [];
    const currentParentLogo = parentLogoRef?.current !== undefined ? parentLogoRef.current : propLogo;
    const pageLogo = currentPagesState[0]?.header?.logo || null;
    const merged = mergeLogoForDisplay(pageLogo, currentParentLogo);
    
    const prev = prevMergedLogoRef.current;
    const hasChanged = (!prev && !!merged) || (!!prev && !merged) ||
      prev?.preview !== merged?.preview ||
      prev?.width !== merged?.width ||
      prev?.height !== merged?.height ||
      prev?.text !== merged?.text ||
      prev?.textRight !== merged?.textRight;

    if (hasChanged) {
      prevMergedLogoRef.current = merged;
      updateAllLogoImgs(merged);
    }
  }, [pagesState, propLogo, updateAllLogoImgs]);

  // --- INITIAL CONTENT LOADING ---
  useEffect(() => {
    let contentValue = "";
    if (initialContent) {
      if (typeof initialContent === "string") {
        contentValue = initialContent;
      } else if (typeof initialContent === "object" && initialContent !== null) {
        contentValue = initialContent.content !== undefined ? initialContent.content : initialContent;
      }
    }

    // Iteratively unwrap nested objects
    while (contentValue && typeof contentValue === "object" && !Array.isArray(contentValue) && contentValue.content !== undefined) {
      contentValue = contentValue.content;
    }

    // Iteratively parse JSON strings
    if (typeof contentValue === "string") {
      let trimmed = contentValue.trim();
      let parseRounds = 0;
      while ((trimmed.startsWith("[") || trimmed.startsWith("{") || (trimmed.startsWith('"') && trimmed.endsWith('"'))) && parseRounds < 5) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.content !== undefined) {
            contentValue = parsed.content;
          } else {
            contentValue = parsed;
          }
          if (typeof contentValue === "string") {
            trimmed = contentValue.trim();
          } else {
            break;
          }
          parseRounds++;
        } catch (_) {
          break;
        }
      }
    }

    // Once initial content has been loaded into engine, do not re-hydrate on parent state updates (such as logo uploads),
    // UNLESS the engine is currently empty (e.g. initial render occurred before asynchronous document/template data arrived)
    // Never re-hydrate after the user has edited/pasted in this session — a transient empty engine during
    // pagination must not reload stale/empty parent content and wipe the paste.
    const engineHtmlIsEmpty = () => {
      try {
        return isSkeletonEditorContent(documentEngineRef.current?.toHTML?.() || '');
      } catch (_) {
        return true;
      }
    };

    if (
      hasLocalUserEditsRef.current ||
      (typeof window !== "undefined" && (window.isPasteInProgress || window.isPaginatingEditor))
    ) {
      const incomingHasBody = typeof contentValue === "string"
        ? !isSkeletonEditorContent(contentValue)
        : (Array.isArray(contentValue) && contentValue.length > 0);
      if (!(engineHtmlIsEmpty() && incomingHasBody)) {
        return;
      }
    }
    if (hasLoadedInitialContentRef.current) {
      if (!engineHtmlIsEmpty()) {
        return;
      }
    }

    let contentLoaded = false;

    if (contentValue) {
      const engine = documentEngineRef.current;
      let isJsonArray = Array.isArray(contentValue);
      let parsedBlocks = null;

      if (isJsonArray) {
        const blocksList = parsedBlocks || contentValue;
        if (Array.isArray(blocksList) && blocksList.length > 0) {
          hasLoadedInitialContentRef.current = true;
          contentLoaded = true;
          const docOwnerId = initialContent?.userId || initialContent?.ownerId;
          if (docOwnerId) {
            blocksList.forEach(b => {
              if (b) {
                if (!b.metadata) b.metadata = {};
                if (!b.metadata.ownerId) b.metadata.ownerId = String(docOwnerId);
              }
            });
          }
          engine.document.pages = [{ id: uuidv4(), blocks: blocksList }];
        }
      } else if (typeof contentValue === "string" && contentValue.trim() !== "") {
        // CRITICAL FIX: Clean HTML BEFORE parsing to remove yellow CSS classes
        // This ensures no yellow colors ever reach the DOM from saved drafts
        let cleanedContent = contentValue
          // Remove temp highlight classes that cause yellow backgrounds
          .replace(/\s*temp-comment-highlight\s*/g, ' ')
          .replace(/\s*temp-suggestion-highlight\s*/g, ' ')
          .replace(/\s*temp-text-highlight\s*/g, ' ')
          .replace(/\s*comment-focus\s*/g, ' ')
          // Clean up empty class attributes
          .replace(/class="\s*"/g, '')
          .replace(/class=''/g, '');

        // Enforce correct background colors in saved HTML
        // Replace any incorrect yellow/orange backgrounds on comment spans
        cleanedContent = cleanedContent.replace(
          /(<span[^>]*data-comment-id[^>]*style="[^"]*)(background-color:\s*[^;"]+)(;?[^"]*")/gi,
          '$1background-color: lightgreen$3'
        );

        // Replace any incorrect backgrounds on suggestion spans
        cleanedContent = cleanedContent.replace(
          /(<span[^>]*data-suggestededit-id[^>]*style="[^"]*)(background-color:\s*[^;"]+)(;?[^"]*")/gi,
          '$1background-color: lightblue$3'
        );

        const parser = new HTMLToBlocksParser(engine);
        const blocks = parser.parseHTML(cleanedContent);

        if (blocks.length > 0) {
          hasLoadedInitialContentRef.current = true;
          contentLoaded = true;
          // Tag baseline blocks with document owner if available
          const docOwnerId = initialContent?.userId || initialContent?.ownerId;
          if (docOwnerId) {
            blocks.forEach(b => {
              if (!b.metadata) b.metadata = {};
              if (!b.metadata.ownerId) b.metadata.ownerId = String(docOwnerId);
            });
          }

          // Add blocks to engine
          engine.document.pages = [{ id: uuidv4(), blocks }];
        } else if (!isSkeletonEditorContent(cleanedContent)) {
          hasLoadedInitialContentRef.current = true;
          contentLoaded = true;
          engine.document.pages = [{
            id: uuidv4(),
            blocks: [engine.createBlock(BLOCK_TYPES.PARAGRAPH, cleanedContent)]
          }];
        }
      }
    }

    if (contentLoaded) {
      // Restore header/footer, orientation, paperSize, and pagesState from initialContent if present
      if (initialContent?.headerHTML) {
        setHeaderHTML(initialContent.headerHTML);
      }
      if (initialContent?.footerHTML) {
        setFooterHTML(initialContent.footerHTML);
      }
      const targetOrient = initialContent?.orientation || "portrait";
      const targetPaper = initialContent?.paperSize || "A4";
      const targetPagesState = (Array.isArray(initialContent?.pagesState) && initialContent.pagesState.length > 0)
        ? initialContent.pagesState
        : null;

      if (initialContent?.orientation) {
        setOrientation(initialContent.orientation);
      }
      if (initialContent?.paperSize) {
        setPaperSize(initialContent.paperSize);
      }
      if (targetPagesState) {
        setPagesState(targetPagesState);
      }

      // Immediately sync DOM element classes for orientation
      const root = pagesContainerRef.current;
      if (root) {
        root.classList.remove("portrait", "landscape");
        root.classList.add(targetOrient);
        const pages = root.querySelectorAll(".page");
        pages.forEach((p, idx) => {
          const pageOrient = targetPagesState?.[idx]?.orientation || targetOrient;
          p.classList.remove("portrait", "landscape");
          p.classList.add(pageOrient);
        });
      }

      // Use the proper render function - this will render blocks from engine AND paginate
      setTimeout(() => {
        renderFreshFromEngineRef.current();

        // CRITICAL FIX: Clean up duplicate yellow/orange CSS classes from saved HTML
        // These were incorrectly saved in previous sessions
        setTimeout(() => {
          const container = pagesContainerRef.current;
          if (!container) return;

          // Remove ALL instances of temp highlight classes
          const tempHighlights = container.querySelectorAll(
            '.temp-comment-highlight, .temp-suggestion-highlight, .temp-text-highlight'
          );
          tempHighlights.forEach(element => {
            element.classList.remove('temp-comment-highlight', 'temp-suggestion-highlight', 'temp-text-highlight');
          });

          // Enforce correct green background for comments
          const commentHighlights = container.querySelectorAll('[data-comment-id]');
          commentHighlights.forEach(element => {
            element.style.setProperty('background-color', 'lightgreen');
            element.classList.remove('temp-comment-highlight', 'temp-text-highlight');
          });

          // Enforce correct blue background for suggestions (non-pending only)
          const suggestionHighlights = container.querySelectorAll('[data-suggestededit-id]');
          suggestionHighlights.forEach(element => {
            const hasDel = element.querySelector('del');
            const hasIns = element.querySelector('ins');
            if (!hasDel && !hasIns) {
              element.style.setProperty('background-color', 'lightblue');
            }
            element.classList.remove('temp-suggestion-highlight', 'temp-text-highlight');
          });
        }, 300);
      }, 50);
    } else if (contentValue) {
      hasLoadedInitialContentRef.current = true;
    }
  }, [initialContent, renderFreshFromEngineRef, pagesContainerRef, documentEngineRef]);

  // --- LIVE SOURCE UPDATES & PROP SYNC ---
  useEffect(() => {
    if (window.isResizingTable) return;
    if (!initialContent || typeof initialContent !== "object") return;

    if (initialContent.orientation) {
      setOrientation(initialContent.orientation);
    }
    if (initialContent.paperSize) {
      setPaperSize(initialContent.paperSize);
    }
    if (Array.isArray(initialContent.pagesState) && initialContent.pagesState.length > 0) {
      setPagesState(initialContent.pagesState);
    }

    const root = pagesContainerRef.current;
    if (root) {
      const targetOrient = initialContent.orientation || orientation || "portrait";
      root.classList.remove("portrait", "landscape");
      root.classList.add(targetOrient);
      const pages = root.querySelectorAll(".page");
      pages.forEach((p, idx) => {
        const pageOrient = (Array.isArray(initialContent.pagesState) && initialContent.pagesState[idx]?.orientation) || targetOrient;
        p.classList.remove("portrait", "landscape");
        p.classList.add(pageOrient);
      });
    }

    const isReviseMode = Boolean(props.isRevise || props.isRevising);
    const allowLiveHydrate = Boolean(isPreviewMode || isDraft || isReviseMode || !hasLoadedInitialContentRef.current);
    if (!allowLiveHydrate) return;

    let nextHtml = "";
    let nextHeader = null;
    let nextFooter = null;

    nextHtml = typeof initialContent.content === "string" ? initialContent.content : "";
    if (initialContent.headerHTML !== undefined) nextHeader = initialContent.headerHTML || "";
    if (initialContent.footerHTML !== undefined) nextFooter = initialContent.footerHTML || "";

    // Keep header/footer synchronized when initial content is object-shaped.
    if (nextHeader !== null) {
      if (hasUserCustomizedHeaderRef.current || (documentTitle === undefined || documentTitle === null)) {
        setHeaderHTML(nextHeader);
      }
    }
    if (nextFooter !== null) setFooterHTML(nextFooter);

    // NORMALIZE helper for comparison to avoid "refreshing" on minor whitespace/attribute differences
    const normalize = (h) => {
      if (!h) return "";
      return h
        .replace(/<span[^>]*class="[^"]*video-resize-handle[^"]*"[^>]*><\/span>/gi, '') // Strip video resize handles
        .replace(/<span[^>]*data-resize="[^"]*"[^>]*><\/span>/gi, '')
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/class="[^"]*editor-highlight-hovered[^"]*"/g, '') // Strip hover classes
        .replace(/class="\s*"/g, '') // Strip empty classes
        .replace(/class=""/g, '')
        .replace(/ style="[^"]*"/g, '') // Strip style attributes (engine often slightly reformats them)
        .replace(/ data-block-id="[^"]*"/g, '') // Strip block IDs from comparison
        .replace(/<br\s*\/?>/gi, '') // Strip trailing breaks
        .replace(/&nbsp;/g, ' ') // Normalize non-breaking spaces
        .replace(/>\s+</g, '><') // Strip whitespace between tags
        .trim();
    };

    // CRITICAL FIX: If the local user has edited the document in this session, or if the incoming
    // content is simply an echo of what this editor instance itself broadcast to the parent,
    // NEVER destroy and re-parse the engine document state. The editor's in-memory
    // DocumentEngine is already the authoritative source of truth for the local user's edits.
    // This permanently prevents the editor from resetting nested lists (e.g. 1.1, 1.2) after
    // any period of inactivity or tab switching.
    // Also skip while paste/pagination is rebuilding pages — parent may still hold pre-paste HTML.
    if (typeof window !== "undefined" && (window.isPasteInProgress || window.isPaginatingEditor)) {
      return;
    }

    const engine = documentEngineRef.current;
    if (!engine) return;

    const currentHtml = engine.toHTML();

    const isEchoOfLocalBroadcast = 
      (lastBroadcastHtmlRef.current && (nextHtml === lastBroadcastHtmlRef.current || normalize(nextHtml) === normalize(lastBroadcastHtmlRef.current))) ||
      (lastBroadcastBlocksJsonRef.current && (nextHtml === lastBroadcastBlocksJsonRef.current || normalize(nextHtml) === normalize(lastBroadcastBlocksJsonRef.current)));

    if (isEchoOfLocalBroadcast || hasLocalUserEditsRef.current) {
      if (!(isSkeletonEditorContent(currentHtml) && !isSkeletonEditorContent(nextHtml))) {
        return;
      }
    }

    if (isSkeletonEditorContent(nextHtml) && !isSkeletonEditorContent(currentHtml)) {
      return;
    }

    const nextNormalized = normalize(nextHtml);
    const currentNormalized = normalize(currentHtml);

    if (!nextNormalized && (currentNormalized === "" || currentNormalized === "<p></p>")) {
      return;
    }

    if (nextNormalized !== currentNormalized) {
      // Clean HTML BEFORE parsing to remove yellow CSS classes and background artifacts
      let cleanedHtml = nextHtml
        .replace(/\s*temp-comment-highlight\s*/g, ' ')
        .replace(/\s*temp-suggestion-highlight\s*/g, ' ')
        .replace(/\s*temp-text-highlight\s*/g, ' ')
        .replace(/\s*comment-focus\s*/g, ' ')
        .replace(/class="\s*"/g, '')
        .replace(/class=''/g, '');

      cleanedHtml = cleanedHtml.replace(
        /(<span[^>]*data-comment-id[^>]*style="[^"]*)(background-color:\s*[^;"]+)(;?[^"]*")/gi,
        '$1background-color: lightgreen$3'
      );

      cleanedHtml = cleanedHtml.replace(
        /(<span[^>]*data-suggestededit-id[^>]*style="[^"]*)(background-color:\s*[^;"]+)(;?[^"]*")/gi,
        '$1background-color: lightblue$3'
      );

      const parser = new HTMLToBlocksParser(engine);
      const blocks = parser.parseHTML(cleanedHtml);

      if (blocks.length > 0) {
        // Update engine document
        engine.document.pages = [{ id: uuidv4(), blocks }];

        // Re-render from engine state
        if (renderFreshFromEngineRef.current) {
          renderFreshFromEngineRef.current();
          // Schedule pagination to ensure correct layout after remote update
          setTimeout(() => {
            if (schedulePaginateRef.current) schedulePaginateRef.current();
          }, 100);
        }
      }
    }
  }, [initialContent, isPreviewMode, isDraft, documentEngineRef, renderFreshFromEngineRef, schedulePaginateRef]);

  // -------- syncAndNotify (needs refs from hooks) --------
  const debouncedPaginate = useCallback(() => {
    if (paginationTimeoutRef.current) clearTimeout(paginationTimeoutRef.current);
    paginationTimeoutRef.current = setTimeout(
      () => schedulePaginateRef.current(),
      100
    );
  }, [schedulePaginateRef]);

  /* 
   * FIXED: Accept overrideComments/overrideSuggestions to handle race conditions
   * when called from handleCommentsChange (where state might not be updated yet in closure)
   */
  const notifyParentFromEngine = useCallback((
    overrideComments = null,
    overrideSuggestions = null,
    overrideReferences = null,
    overrideHeaderHTML = null,
    overrideFooterHTML = null,
    flush = false,
    overrideOrientation = null,
    overridePagesState = null
  ) => {
    const normalizeElement = (el, fallbackType = 'comment') => ({
      id: el.id,
      user: el.user || el.author || 'Template Author',
      author: el.author || el.user || 'Template Author',
      userId: el.userId ?? null,
      userEmail: el.userEmail ?? el.email ?? null,
      email: el.email ?? el.userEmail ?? null,
      text: el.text ?? '',
      highlightedText: el.highlightedText ?? el.selectedText ?? '',
      selectedText: el.selectedText ?? el.highlightedText ?? '',
      type: el.type ?? fallbackType,
      status: el.status ?? (el.type === 'suggestededit' ? 'pending' : 'open'),
      replies: Array.isArray(el.replies) ? el.replies : [],
      fragmentId: el.fragmentId ?? `fragment-${el.id}`,
      timestamp: el.timestamp ?? new Date().toISOString(),
      avatar: el.avatar ?? null,
      position: el.position ?? null,
      createdInDraft: el.createdInDraft !== undefined ? el.createdInDraft : (effectiveIsDraft ? true : undefined),
      origin: el.origin || (effectiveIsDraft ? 'draft' : undefined),
      stage: el.stage || (effectiveIsDraft ? 'draft' : undefined),
    });

    const html = documentEngineRef.current.toHTML();
    const activeComments = Array.isArray(overrideComments) ? overrideComments : (templateComments || []);
    const activeSuggestions = Array.isArray(overrideSuggestions) ? overrideSuggestions : (templateSuggestions || []);
    const activeReferences = Array.isArray(overrideReferences) ? overrideReferences : (templateReferences || []);
    let cleanHtml = html
      .replace(/(class="[^"]*)\s*editor-highlight-hovered\s*([^"]*")/g, '$1$2')
      .replace(/class="\s*"/g, '')
      .replace(/class=""/g, '');

    if (isSkeletonEditorContent(cleanHtml) && !isSkeletonEditorContent(lastBroadcastHtmlRef.current)) {
      cleanHtml = lastBroadcastHtmlRef.current;
    }

    const blocksArray = documentEngineRef.current.getAllBlocks();
    const blocksJson = JSON.stringify(blocksArray);

    lastBroadcastHtmlRef.current = cleanHtml;
    lastBroadcastBlocksJsonRef.current = blocksJson;

    const currentPagesState = overridePagesState || pagesStateRef.current || pagesState || [];
    const currentParentLogo = parentLogoRef?.current !== undefined ? parentLogoRef.current : propLogo;
    const pageLogo = currentPagesState[0]?.header?.logo || null;
    const mergedLogo = mergeLogoForDisplay(pageLogo, currentParentLogo);

    const changeData = {
      content: blocksJson,
      htmlContent: cleanHtml,
      paperSize,
      orientation: overrideOrientation || orientation,
      pagesState: currentPagesState,
      lastModified: new Date().toISOString(),
      comments: activeComments.map((c) => normalizeElement(c, 'comment')),
      suggestions: activeSuggestions.map((s) => normalizeElement(s, 'suggestededit')),
      references: activeReferences.map((r) => ({
        ...r,
        id: r.id,
        type: 'reference',
        refNumber: typeof r.refNumber === 'number' ? r.refNumber : (r.isManual ? null : 0),
      })),
      headerHTML: overrideHeaderHTML !== null ? overrideHeaderHTML : headerHTML,
      footerHTML: overrideFooterHTML !== null ? overrideFooterHTML : footerHTML,
      logo: mergedLogo,
      hasUserCustomizedHeader: hasUserCustomizedHeaderRef.current,
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (flush === true) {
      saveTimeoutRef.current = null;
      onContentChange?.(changeData);
      updateTOC();
    } else {
      saveTimeoutRef.current = setTimeout(() => {
        onContentChange?.(changeData);
        updateTOC();
      }, 1000);
    }
  }, [
    documentEngineRef, templateComments, templateSuggestions, templateReferences,
    paperSize, orientation, headerHTML, footerHTML, pagesState, onContentChange, updateTOC,
  ]);

  const syncAndNotify = useCallback((
    overrideComments = null,
    overrideSuggestions = null,
    overrideReferences = null,
    overrideHeaderHTML = null,
    overrideFooterHTML = null,
    flush = false,
    overrideOrientation = null,
    overridePagesState = null,
    overrideLogo = null,
    options = {}
  ) => {
    const { skipPaginate = options.skipPaginate ?? false, skipContentSync = options.skipContentSync ?? false } = syncOptionsRef.current;
    syncOptionsRef.current = {};

    // Track local typing time to suppress self-triggered DOM re-renders in LIVE SOURCE UPDATES
    lastLocalTypingTimeRef.current = Date.now();
    hasLocalUserEditsRef.current = true;
    // Alert parent that user is typing
    onTyping?.();

    if (!flush && isProgrammaticChangeRef.current) {
      return;
    }

    if (!contentChangeHandlerRef.current || !pagesContainerRef.current) return;

    if (flush) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
      documentEngineRef.current.repaginate(pagesContainerRef.current);
      notifyParentFromEngine(
        overrideComments,
        overrideSuggestions,
        overrideReferences,
        overrideHeaderHTML,
        overrideFooterHTML,
        true,
        overrideOrientation,
        overridePagesState
      );
      return;
    }

    if (skipContentSync) {
      notifyParentFromEngine(
        overrideComments,
        overrideSuggestions,
        overrideReferences,
        overrideHeaderHTML,
        overrideFooterHTML,
        flush
      );
      return;
    }

    // --- IMMEDIATE OVERFLOW CHECK ---
    if (!skipPaginate) {
      const sel = window.getSelection();
      const activeNode = sel?.anchorNode;
      const activePage = activeNode?.parentElement?.closest?.(".page");
      const activeContent = activeNode?.parentElement?.closest?.(".page-content");
      if (activePage && activeContent) {
        sizePageContentRef.current?.(activePage);
        void activeContent.offsetHeight;
        const isOverflowing = activeContent.scrollHeight > (activeContent.clientHeight - 2);
        if (isOverflowing) {
          contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
          schedulePaginateRef.current();
        }
      }
    }

    contentChangeHandlerRef.current.handleContentChange(
      pagesContainerRef.current,
      () => {
        // Guard inside the debounced callback to prevent race conditions during pagination
        if (isProgrammaticChangeRef.current) return;

        const html = documentEngineRef.current.toHTML();

        // Normalizer ensures comments and suggestions have identical, expected shape
        const normalizeElement = (el, fallbackType = 'comment') => ({
          id: el.id,
          user: el.user || el.author || 'Template Author',
          author: el.author || el.user || 'Template Author',
          userId: el.userId ?? null,
          userEmail: el.userEmail ?? el.email ?? null,
          email: el.email ?? el.userEmail ?? null,
          text: el.text ?? '',
          highlightedText: el.highlightedText ?? el.selectedText ?? '',
          selectedText: el.selectedText ?? el.highlightedText ?? '',
          type: el.type ?? fallbackType,
          status: el.status ?? (el.type === 'suggestededit' ? 'pending' : 'open'),
          replies: Array.isArray(el.replies) ? el.replies : [],
          fragmentId: el.fragmentId ?? `fragment-${el.id}`,
          timestamp: el.timestamp ?? new Date().toISOString(),
          avatar: el.avatar ?? null,
          position: el.position ?? null,
          createdInDraft: el.createdInDraft !== undefined ? el.createdInDraft : (effectiveIsDraft ? true : undefined),
          origin: el.origin || (effectiveIsDraft ? 'draft' : undefined),
          stage: el.stage || (effectiveIsDraft ? 'draft' : undefined),
        });

        // Use overrides if provided, otherwise fall back to state
        const activeComments = Array.isArray(overrideComments) ? overrideComments : (templateComments || []);
        const activeSuggestions = Array.isArray(overrideSuggestions) ? overrideSuggestions : (templateSuggestions || []);
        const activeReferences = Array.isArray(overrideReferences) ? overrideReferences : (templateReferences || []);

        // Filter out deleted elements
        const container = pagesContainerRef.current;
        const isDomReady = container && container.querySelector('[data-block-id]');

        const verifiedComments = isDomReady
          ? activeComments.filter(c => container?.querySelector(`[data-comment-id="${c.id}"]`))
          : activeComments;

        const verifiedSuggestions = isDomReady
          ? activeSuggestions.filter(s => container?.querySelector(`[data-suggestededit-id="${s.id}"]`))
          : activeSuggestions;

        // FIX: Only filter out references that HAVE an anchor but the anchor is missing from DOM.
        // Manual references (no refAnchor) should ALWAYS be preserved.
        const verifiedReferences = isDomReady
          ? activeReferences.filter(r => {
              if (!r.refAnchor) return true; // Keep manual references
              return container?.querySelector(`[data-reference-id="${r.refAnchor || r.id}"]`);
            })
          : activeReferences;

        const normalizedComments = verifiedComments.map(c => normalizeElement(c, 'comment'));
        const normalizedSuggestions = verifiedSuggestions.map(s => normalizeElement(s, 'suggestededit'));
        const normalizedReferences = verifiedReferences.map(r => ({
          ...r,
          id: r.id,
          type: 'reference',
          refNumber: typeof r.refNumber === 'number' ? r.refNumber : (r.isManual ? null : 0)
        }));

        const cleanHtml = html
          .replace(/(class="[^"]*)\s*editor-highlight-hovered\s*([^"]*")/g, '$1$2')
          .replace(/class="\s*"/g, '')
          .replace(/class=""/g, '');

        const nextHeaderHTML = overrideHeaderHTML !== null ? overrideHeaderHTML : headerHTML;
        const nextFooterHTML = overrideFooterHTML !== null ? overrideFooterHTML : footerHTML;

        const logoCenterEl = pagesContainerRef.current?.querySelector(".logo-center");
        const logoCenterLeftEl = logoCenterEl?.querySelector(".logo-center-left");
        const logoCenterRightEl = logoCenterEl?.querySelector(".logo-center-right");

        let currentLogoText = "";
        let currentLogoTextRight = "";

        if (logoCenterLeftEl) {
          currentLogoText = logoCenterLeftEl.textContent || "";
          currentLogoTextRight = logoCenterRightEl?.textContent || "";
        } else {
          currentLogoText = logoCenterEl?.textContent || "";
        }

        const currentPagesState = overridePagesState || pagesStateRef.current || pagesState || [];
        const currentParentLogo = overrideLogo !== null ? overrideLogo : (parentLogoRef?.current !== undefined ? parentLogoRef.current : propLogo);
        const pageLogo = currentPagesState[0]?.header?.logo || null;
        const mergedLogo = mergeLogoForDisplay(pageLogo, currentParentLogo);
        const logoPayload = mergedLogo ? {
          ...mergedLogo,
          text: currentLogoText || mergedLogo.text || currentPagesState[0]?.header?.logoText || "",
          textRight: currentLogoTextRight || mergedLogo.textRight || currentPagesState[0]?.header?.logoTextRight || "",
        } : (currentLogoText || currentLogoTextRight ? {
          text: currentLogoText,
          textRight: currentLogoTextRight
        } : null);

        const changeData = {
          content: cleanHtml,
          paperSize,
          orientation,
          lastModified: new Date().toISOString(),
          comments: normalizedComments,
          suggestions: normalizedSuggestions,
          references: normalizedReferences,
          headerHTML: nextHeaderHTML,
          footerHTML: nextFooterHTML,
          logo: logoPayload,
        };

        // DEBOUNCED SAVE to parent component
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (flush === true) {
          saveTimeoutRef.current = null;
          onContentChange?.(changeData);
          updateTOC();
        } else {
          saveTimeoutRef.current = setTimeout(() => {
            onContentChange?.(changeData);
            updateTOC();
          }, 1000);
        }

        // Apply locking styling to DOM elements
        if (pagesContainerRef.current) {
          pagesContainerRef.current.querySelectorAll(".page-content [data-block-id]").forEach((el) => {
            const id = el.getAttribute("data-block-id");
            const blk = documentEngineRef.current.getBlock(id);
            if (blk?.locked) {
              if (el.getAttribute("contenteditable") !== "false") {
                el.setAttribute("contenteditable", "false");
              }
              const expectedStyle = `${el.getAttribute("style") || ""};${LOCKED_STYLE}`;
              if (el.getAttribute("style") !== expectedStyle) {
                el.setAttribute("style", expectedStyle);
              }
            } else {
              if (el.hasAttribute("contenteditable")) {
                el.removeAttribute("contenteditable");
              }
              const currentStyle = el.getAttribute("style");
              if (currentStyle && (currentStyle.includes("background") || currentStyle.includes("border-left"))) {
                const style = currentStyle
                  .split(";")
                  .filter((s) => {
                    const trimmed = s.trim();
                    return trimmed && !trimmed.startsWith("background") && !trimmed.startsWith("border-left");
                  })
                  .join(";");
                const normalizedCurrent = currentStyle
                  .split(";")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join(";");
                if (style !== normalizedCurrent) {
                  if (style) {
                    el.setAttribute("style", style);
                  } else {
                    el.removeAttribute("style");
                  }
                }
              }
            }
          });
        }

        updateAllLogoImgs(logoPayload);
        applyDropdownCellGuards(pagesContainerRef.current);

        if (!skipPaginate) {
          const container = pagesContainerRef.current;
          const pages = container ? Array.from(container.querySelectorAll(".page")) : [];
          let needsPaginate = false;

          if (pages.length > 1) {
            // Multi-page document: content changes may pull up or push down blocks across pages
            needsPaginate = true;
          } else if (pages.length === 1) {
            const pageContent = pages[0].querySelector(".page-content");
            if (pageContent) {
              const isOverflowing = pageContent.scrollHeight > (pageContent.clientHeight - 2);
              const hasPageBreak = Boolean(pageContent.querySelector(".page-break-marker, [data-page-break='true']"));
              if (isOverflowing || hasPageBreak) {
                needsPaginate = true;
              }
            }
          }

          if (needsPaginate) {
            debouncedPaginate();
          }
        }
      }
    );
  }, [
    isProgrammaticChangeRef, pagesContainerRef, contentChangeHandlerRef, documentEngineRef,
    templateComments, templateSuggestions, templateReferences, paperSize, orientation, onContentChange, updateTOC,
    pagesState, propLogo, updateAllLogoImgs, debouncedPaginate, headerHTML, footerHTML, notifyParentFromEngine
  ]);

  // Sync ref so usePageManagement can call it without circular dependencies
  useEffect(() => {
    syncAndNotifyRef.current = syncAndNotify;
  }, [syncAndNotify]);

  // --- FLUSH ON UNMOUNT OR BLUR (FOCUSOUT) ---
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (syncAndNotifyRef.current) {
          syncAndNotifyRef.current(null, null, null, null, null, true);
        }
      }
    };
  }, []);

  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleFocusOut = (e) => {
      // Focus left the editor container entirely
      if (!e.relatedTarget || !container.contains(e.relatedTarget)) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          if (syncAndNotifyRef.current) {
            syncAndNotifyRef.current(null, null, null, null, null, true);
          }
        }
      }
    };

    container.addEventListener('focusout', handleFocusOut);
    return () => {
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [pagesContainerRef]);

  const syncDOMToBlocksSync = useCallback(() => {
    if (contentChangeHandlerRef.current && pagesContainerRef.current) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    }
  }, [contentChangeHandlerRef, pagesContainerRef]);

  // --- INITIALIZE HANDLERS ---
  useEffect(() => {
    const engine = documentEngineRef.current;
    pasteHandlerRef.current = new PasteHandler(
      engine,
      user?.id || currentUser?.id || "",
      user?.email || currentUser?.email || ""
    );
    contentChangeHandlerRef.current = new ContentChangeHandler(engine);
    imagePasteHandlerRef.current = new ImagePasteHandler(engine, pagesContainerRef);

    // Set callbacks for image handler
    imagePasteHandlerRef.current.setCallbacks({
      schedulePaginate: () => schedulePaginateRef.current(),
      syncAndNotify: () => syncAndNotify()
    });

    // Migrate any old HTML format image blocks to new JSON format
    imagePasteHandlerRef.current.migrateOldImageBlocks();
  }, [pagesContainerRef, schedulePaginateRef, syncAndNotify]);

  // --- IMAGE EVENT LISTENERS (selection, resize, delete) ---
  useEffect(() => {
    if (!imagePasteHandlerRef.current) return;
    const cleanup = imagePasteHandlerRef.current.setupImageEventListeners();
    return cleanup;
  }, [pagesContainerRef]);

  // --- VIDEO RESIZE & SELECTION HANDLER ---
  useEffect(() => {
    if (!pagesContainerRef.current) return;
    const videoHandler = new VideoResizeHandler(pagesContainerRef, {
      documentEngineRef,
      syncDOMToBlocksSync,
      schedulePaginate,
      syncAndNotify,
      pushToUndo: () => pushToUndo?.(true),
    });
    const cleanup = videoHandler.setupEventListeners();
    return cleanup;
  }, [pagesContainerRef, documentEngineRef, syncDOMToBlocksSync, schedulePaginate, syncAndNotify, pushToUndo]);

  // Microsoft Word-style Superscript (Ctrl+Shift+= / Ctrl++) & Subscript (Ctrl+=) shortcuts
  useEffect(() => {
    const handleScriptShortcuts = (e) => {
      if (readOnly) return;
      handleSuperscriptSubscriptKeyDown(e, {
        syncDOMToBlocksSync,
        schedulePaginate,
        onBeforeAction: pushToUndo,
        onAfterAction: syncAndNotify,
      });
    };

    window.addEventListener('keydown', handleScriptShortcuts, true);
    return () => {
      window.removeEventListener('keydown', handleScriptShortcuts, true);
    };
  }, [readOnly, syncDOMToBlocksSync, schedulePaginate, pushToUndo, syncAndNotify]);

  // --- SELECTION TRACKING ---
  useEffect(() => {
    const onSelectionChange = () => {
      const active = document.activeElement;
      if (
        active?.classList?.contains("cell-dropdown") ||
        active?.closest?.('td[data-type="dropdown"], th[data-type="dropdown"]')
      ) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const container =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      if (container?.closest?.('td[data-type="dropdown"], th[data-type="dropdown"]')) {
        return;
      }
      if (
        pagesContainerRef.current &&
        container &&
        pagesContainerRef.current.contains(container)
      ) {
        savedSelectionRef.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [pagesContainerRef]);

  // --- DROPDOWN CELL GUARDS (prevent text-cursor flicker in option cells) ---
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return undefined;

    const isDropdownTarget = (target) =>
      target?.closest?.(".cell-dropdown") ||
      target?.closest?.('td[data-type="dropdown"], th[data-type="dropdown"]');

    const markDropdownInteraction = () => {
      window.isInteractingWithDropdown = true;
      if (window.dropdownInteractionTimeout) clearTimeout(window.dropdownInteractionTimeout);
      window.dropdownInteractionTimeout = setTimeout(() => {
        window.isInteractingWithDropdown = false;
      }, 500);
    };

    const onMouseDown = (e) => {
      if (!isDropdownTarget(e.target)) return;
      e.stopPropagation();
      dropdownScrollRef.current = saveEditorScroll(container);
      markDropdownInteraction();
      requestAnimationFrame(() => {
        window.getSelection()?.removeAllRanges();
      });
    };

    const onFocusIn = (e) => {
      if (!e.target?.classList?.contains("cell-dropdown")) return;
      markDropdownInteraction();
      window.getSelection()?.removeAllRanges();
    };

    applyDropdownCellGuards(container);
    container.addEventListener("mousedown", onMouseDown, true);
    container.addEventListener("focusin", onFocusIn, true);
    return () => {
      container.removeEventListener("mousedown", onMouseDown, true);
      container.removeEventListener("focusin", onFocusIn, true);
      if (window.dropdownInteractionTimeout) clearTimeout(window.dropdownInteractionTimeout);
      window.isInteractingWithDropdown = false;
    };
  }, [pagesContainerRef]);

  // --- USE EDITOR EVENT HANDLERS HOOK ---
  const {
    handlePaste,
    handleBeforeInput,
    handleKeyDown,
    handleKeyUp,
    handleMakeEditable,
  } = useEditorEventHandlers({
    pagesContainerRef,
    documentEngineRef,
    pasteHandlerRef,
    imagePasteHandlerRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    currentUser,
    userRole, // Pass userRole
    user,
    savedSelectionRef,
    getBlockAndOffset,
    paperSize,
    updateTOC,
    setIsFullScreen,
    isFullScreen,
    ensureOnePage,
    setCurrentPage,
    onTyping, // Pass NEW prop
    isApprovalState,
    readOnly,
    enableTypedUnderlines,
    disableStrikeOnDelete,
    undo,
    redo,
    pushToUndo,
    isTypingRef,
    registerTypingAction,
    endTypingSession,
    ignoreNextTypingActionRef,
    caretManagerRef,
  });

  const { selectionInfo: tableMergeSelectionInfo, executeMerge: executeTableMerge } = useTableMerge({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    renderFreshFromEngineRef,
    schedulePaginateRef,
    pushToUndo,
    readOnly,
  });

  const tableContextMenu = useTableContextMenu({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    isProgrammaticChangeRef,
    renderFreshFromEngineRef,
    schedulePaginateRef,
    readOnly,
    pushToUndo,
    onMergeCells: () => {
      executeTableMerge();
    },
    onMakeOption: (ctx) => {
      const block = documentEngineRef.current.getBlock(ctx.blockId);
      const existingMeta = block?.content?.meta?.cell || [];
      const cellRowIdx = ctx.isHeader ? 0 : (ctx.hasHeader ? ctx.bodyRowIndex + 1 : ctx.bodyRowIndex);
      const cellMeta = existingMeta[cellRowIdx]?.[ctx.colIndex] || {};
      const initialOpts = cellMeta.type === 'dropdown' ? cellMeta.options : [];

      setDropdownTargetCell({ ...ctx, initialOptions: initialOpts });
      setDropdownModalVisible(true);
    }
  });

  const editorPasteContextMenu = useEditorPasteContextMenu({
    pagesContainerRef,
    readOnly,
    onPaste: handlePaste,
  });

  const handleCreateDropdown = (options, applyToVerticalBelow = false) => {
    if (!dropdownTargetCell) return;
    const { blockId, colIndex, bodyRowIndex, isHeader, hasHeader, absoluteRowIndex } = dropdownTargetCell;
    const engine = documentEngineRef.current;
    
    const block = engine.getBlock(blockId);
    if (!block) return;

    if (isProgrammaticChangeRef) {
      isProgrammaticChangeRef.current = true;
    }

    try {
      const content = block.content || {};
      const meta = content.meta || {};
      const cellMeta = Array.isArray(meta.cell) ? [...meta.cell] : [];

      const cellRowIdx = isHeader ? 0 : (hasHeader ? bodyRowIndex + 1 : bodyRowIndex);
      const colCount = content.headers?.length || content.rows?.[0]?.length || 1;
      const totalCellRows = (hasHeader ? 1 : 0) + (content.rows?.length || 0);

      const isDelete = !options || options.length === 0;

      const applyDropdownToCell = (rowIdx) => {
        while (cellMeta.length <= rowIdx) {
          cellMeta.push([]);
        }
        const rowMeta = [...(cellMeta[rowIdx] || [])];
        while (rowMeta.length < colCount) {
          rowMeta.push({});
        }

        if (isDelete) {
          if (rowMeta[colIndex]) {
            const { type, options: opts, ...rest } = rowMeta[colIndex];
            rowMeta[colIndex] = rest;
          }
        } else {
          rowMeta[colIndex] = {
            ...(rowMeta[colIndex] || {}),
            type: 'dropdown',
            options: options
          };
        }
        cellMeta[rowIdx] = rowMeta;

        if (!isDelete) {
          if (hasHeader && rowIdx === 0) {
            const currentVal = content.headers?.[colIndex] || '';
            if (!currentVal.trim() || currentVal === '\u200B') {
              content.headers[colIndex] = options[0];
            }
          } else {
            const targetBodyRowIdx = hasHeader ? rowIdx - 1 : rowIdx;
            const currentVal = content.rows?.[targetBodyRowIdx]?.[colIndex] || '';
            if (!currentVal.trim() || currentVal === '\u200B') {
              content.rows[targetBodyRowIdx][colIndex] = options[0];
            }
          }
        }
      };

      applyDropdownToCell(cellRowIdx);

      if (applyToVerticalBelow) {
        for (let rowIdx = cellRowIdx + 1; rowIdx < totalCellRows; rowIdx++) {
          applyDropdownToCell(rowIdx);
        }
      }

      engine.updateBlock(blockId, {
        content: {
          ...content,
          meta: {
            ...meta,
            cell: cellMeta
          }
        }
      });

      // Synchronize and notify immediately
      syncAndNotify();
      
      const savedScroll = saveEditorScroll(pagesContainerRef.current);

      // Re-render editor views
      if (renderFreshFromEngineRef.current) {
        renderFreshFromEngineRef.current();
      }

      // Place focus back into the cell without scrolling the page
      requestAnimationFrame(() => {
        const container = pagesContainerRef.current;
        if (!container) return;

        const tableEls = Array.from(container.querySelectorAll(`[data-block-id="${blockId}"]`));
        if (tableEls.length > 0) {
          const tableEl = tableEls[0];
          const trs = Array.from(tableEl.querySelectorAll('tr'));
          const targetTr = trs[absoluteRowIndex];
          const cellEl = targetTr?.children[colIndex];

          if (cellEl) {
            const selectEl = cellEl.querySelector('select.cell-dropdown');
            if (selectEl) {
              selectEl.focus({ preventScroll: true });
            }
          }
        }

        restoreEditorScrollAfterLayout(savedScroll);
      });
    } finally {
      if (isProgrammaticChangeRef) {
        setTimeout(() => {
          isProgrammaticChangeRef.current = false;
        }, 50);
      }
    }
  };

  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleDropdownChange = (e) => {
      const select = e.target;
      if (!select || !select.classList.contains('cell-dropdown')) return;

      const savedScroll = dropdownScrollRef.current || saveEditorScroll(container);

      const cellEl = select.closest('td, th');
      const tableEl = select.closest('table[data-block-id]');
      if (!cellEl || !tableEl) return;

      const blockId = tableEl.getAttribute('data-block-id');
      const tr = cellEl.parentElement;
      const colIndex = Array.from(tr.children).indexOf(cellEl);
      const isHeader = cellEl.tagName === 'TH' || !!tr.closest('thead');

      const engine = documentEngineRef.current;
      const block = engine.getBlock(blockId);
      if (!block) return;

      const allRows = [];
      const sections = tableEl.querySelectorAll('thead, tbody');
      sections.forEach(sec => {
        allRows.push(...Array.from(sec.children).filter(c => c.tagName.toLowerCase() === 'tr'));
      });
      if (allRows.length === 0) {
        allRows.push(...Array.from(tableEl.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr')));
      }

      const absoluteRowIndex = allRows.indexOf(tr);
      const hasHeader = !!tableEl.querySelector('thead tr') || Array.from(allRows[0]?.children || []).every(c => c.tagName.toLowerCase() === 'th');

      const content = block.content || {};
      if (isHeader) {
        if (content.headers) {
          content.headers[colIndex] = select.value;
        }
      } else {
        const bodyRowIndex = hasHeader ? absoluteRowIndex - 1 : absoluteRowIndex;
        if (content.rows && content.rows[bodyRowIndex]) {
          content.rows[bodyRowIndex][colIndex] = select.value;
        }
      }

      engine.updateBlock(blockId, { content });

      // Dropdown value changes don't affect layout — skip DOM sync/pagination to avoid flicker
      syncOptionsRef.current = { skipPaginate: true, skipContentSync: true };
      syncAndNotify();

      restoreEditorScrollAfterLayout(savedScroll);
    };

    container.addEventListener('change', handleDropdownChange);
    return () => {
      container.removeEventListener('change', handleDropdownChange);
    };
  }, [pagesContainerRef, documentEngineRef, syncAndNotify]);

  // Handle comments, suggestions, and references changes
  const handleCommentsChange = useCallback((changeData) => {
    if (!changeData) return;

    let updatedComments = templateComments;
    let updatedSuggestions = templateSuggestions;
    let updatedReferences = templateReferences;

    switch (changeData.action) {
      case 'add_element':
        if (changeData.elementType === 'comment') {
          const exists = templateComments.some(c => c.id === changeData.element.id);
          if (!exists) {
            updatedComments = [...templateComments, changeData.element];
            setTemplateComments(updatedComments);
          }
        } else if (changeData.elementType === 'suggestededit') {
          const exists = templateSuggestions.some(s => s.id === changeData.element.id);
          if (!exists) {
            updatedSuggestions = [...templateSuggestions, changeData.element];
            setTemplateSuggestions(updatedSuggestions);
          }
        } else if (changeData.elementType === 'reference') {
          const exists = templateReferences.some(r => r.id === changeData.element.id);
          if (!exists) {
            updatedReferences = [...templateReferences, changeData.element];
            setTemplateReferences(updatedReferences);
          }
        }
        break;

      case 'remove_element':
        if (changeData.elementType === 'comment') {
          updatedComments = templateComments.filter(c => c.id !== changeData.elementId);
          setTemplateComments(updatedComments);
        } else if (changeData.elementType === 'suggestededit') {
          updatedSuggestions = templateSuggestions.filter(s => s.id !== changeData.elementId);
          setTemplateSuggestions(updatedSuggestions);
        } else if (changeData.elementType === 'reference') {
          updatedReferences = templateReferences.filter(r => r.id !== changeData.elementId);
          setTemplateReferences(updatedReferences);
        }
        break;

      default:
        break;
    }

    // Trigger content change with updated comments/suggestions/references immediately
    setTimeout(() => {
      syncAndNotify(updatedComments, updatedSuggestions, updatedReferences);
    }, 50); // Reduced delay to prevent race conditions
  }, [syncAndNotify, templateComments, templateSuggestions, templateReferences]);

  const handleInsertTable = useCallback((rows, cols) => {
    endTypingSession();
    pushToUndo();
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

    // Issue 1 Fix: Always ensure a paragraph follows a table so users can type below it
    const pBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, "<br>");
    nextBlocks.splice(insertIndex + 1, 0, pBlock);

    engine.document.pages = [{ id: uuidv4(), blocks: nextBlocks }];
    engine.currentPageIndex = 0;

    if (renderFreshFromEngineRef.current) {
      renderFreshFromEngineRef.current();
    }

    setTimeout(() => {
      const insertedTable = pagesContainerRef.current?.querySelector(`[data-block-id="${tableBlock.id}"]`);
      const firstCell = insertedTable?.querySelector("td, th");
      if (!firstCell) return;
      const range = document.createRange();
      range.selectNodeContents(firstCell);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      syncAndNotify();
      if (schedulePaginateRef.current) {
        schedulePaginateRef.current();
      }
    }, 80);
  }, [pagesContainerRef, syncAndNotify]);

  // -------- layout reactions (Resize & Orientation) --------
  useEffect(() => {
    const onResize = () => {
      sizeAllPages();
      schedulePaginateRef.current();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sizeAllPages, schedulePaginateRef]);

  const handleOrientationRequest = useCallback((newOrientation) => {
    setPendingOrientation(newOrientation);
    setOrientationModalVisible(true);
  }, []);

  const handleConfirmThisPageOrientation = useCallback(() => {
    if (!pendingOrientation) return;
    const pageIdx = Math.max(0, currentPage - 1);
    const prev = pagesStateRef.current || pagesState || [];
    const next = [...prev];
    while (next.length <= pageIdx) {
      next.push({
        id: uuidv4(),
        header: { id: uuidv4(), type: "locked", content: "Add Header Text", logo: null },
        footer: { id: uuidv4(), type: "locked", content: "Footer Text" },
      });
    }
    next[pageIdx] = {
      ...next[pageIdx],
      orientation: pendingOrientation,
    };

    setPagesState(next);

    const root = pagesContainerRef.current;
    if (root) {
      const pages = Array.from(root.querySelectorAll(".page"));
      if (pages[pageIdx]) {
        const p = pages[pageIdx];
        p.classList.remove("portrait", "landscape");
        p.classList.add(pendingOrientation);
        p.style.removeProperty("width");
        p.style.removeProperty("min-height");
        p.style.removeProperty("max-height");
      }
    }

    setTimeout(() => {
      if (sizeAllPages) sizeAllPages();
      if (schedulePaginateRef.current) schedulePaginateRef.current();
      syncAndNotify(null, null, null, null, null, true, orientation, next);
    }, 0);
  }, [pendingOrientation, currentPage, pagesContainerRef, sizeAllPages, schedulePaginateRef, syncAndNotify, orientation, pagesState]);

  const handleConfirmWholeDocumentOrientation = useCallback(() => {
    if (!pendingOrientation) return;
    setOrientation(pendingOrientation);
    const prev = pagesStateRef.current || pagesState || [];
    const next = prev.map((page) => ({
      ...page,
      orientation: pendingOrientation,
    }));

    setPagesState(next);

    const root = pagesContainerRef.current;
    if (root) {
      const pages = root.querySelectorAll(".page");
      pages.forEach((p) => {
        p.classList.remove("portrait", "landscape");
        p.classList.add(pendingOrientation);
        p.style.removeProperty("width");
        p.style.removeProperty("min-height");
        p.style.removeProperty("max-height");
      });
    }

    setTimeout(() => {
      if (sizeAllPages) sizeAllPages();
      if (schedulePaginateRef.current) schedulePaginateRef.current();
      syncAndNotify(null, null, null, null, null, true, pendingOrientation, next);
    }, 0);
  }, [pendingOrientation, pagesContainerRef, sizeAllPages, schedulePaginateRef, syncAndNotify, pagesState]);

  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root) return;

    const handleContainerPointer = (e) => {
      const pageEl = e.target.closest(".page");
      if (pageEl && root.contains(pageEl)) {
        const allPages = Array.from(root.querySelectorAll(".page"));
        const idx = allPages.indexOf(pageEl);
        if (idx !== -1) {
          setCurrentPage(idx + 1);
        }
      }
    };

    root.addEventListener("mousedown", handleContainerPointer);
    root.addEventListener("focusin", handleContainerPointer);
    return () => {
      root.removeEventListener("mousedown", handleContainerPointer);
      root.removeEventListener("focusin", handleContainerPointer);
    };
  }, [pagesContainerRef]);

  useEffect(() => {
    const root = pagesContainerRef.current;
    if (!root) return;

    const pageOrientationsStr = (pagesState || []).map((p, idx) => p?.orientation || orientation).join(",");
    const hasConfigChanged =
      prevLayoutConfigRef.current.orientation !== orientation ||
      prevLayoutConfigRef.current.paperSize !== paperSize ||
      prevLayoutConfigRef.current.pageOrientations !== pageOrientationsStr;

    if (!hasConfigChanged) return;

    prevLayoutConfigRef.current = {
      orientation,
      paperSize,
      pageOrientations: pageOrientationsStr,
    };

    const pages = root.querySelectorAll(".page");
    pages.forEach((p, idx) => {
      const pageOrient = pagesState[idx]?.orientation || orientation;
      p.classList.remove("portrait", "landscape");
      p.classList.add(pageOrient);

      p.style.removeProperty("width");
      p.style.removeProperty("min-height");
      p.style.removeProperty("max-height");
    });

    sizeAllPages();
    schedulePaginateRef.current?.();
  }, [orientation, paperSize, pagesState, sizeAllPages, schedulePaginateRef, pagesContainerRef]);

  useEffect(() => {
    return () => {
      if (paginationTimeoutRef.current) clearTimeout(paginationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape" && isFullScreen) setIsFullScreen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isFullScreen]);

  // Expose handleMakeEditable to parent
  useEffect(() => {
    if (props.onToggleLockReady) {
      props.onToggleLockReady(handleMakeEditable);
    }
    if (onToggleLockReady) {
      onToggleLockReady(handleMakeEditable);
    }
  }, [handleMakeEditable, props, onToggleLockReady]);

  // CRITICAL: Locked text protection - ensures data-locked elements stay non-editable
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    // Helper to check if node is in locked text
    const isInLockedText = (node) => {
      let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (current && current !== container) {
        if (current.getAttribute?.('data-locked') === 'true' || current.classList?.contains('locked-text')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    // Prevent typing/editing in locked text
    const preventEdit = (e) => {
      if (e.target.closest?.('.cell-dropdown')) return; // Allow dropdown interaction

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      const lockedEl = isInLockedText(range.startContainer);

      // EXEMPTION: Never prevent edits in header/footer or logo center
      const isHeaderFooter = range.startContainer.parentElement?.closest?.('.page-header, .page-footer, .hf-master');
      const isLogoCenter = range.startContainer.parentElement?.closest?.('.logo-center');
      if (isHeaderFooter || isLogoCenter) return;

      const inputType = e.inputType || (e.nativeEvent && e.nativeEvent.inputType) || "";
      // Allow deletion operations to reach handleBeforeInput / handleKeyDown
      if (inputType.startsWith("delete")) {
        return;
      }

      if (lockedEl) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // Prevent backspace/delete inside locked text
    const preventDelete = (e) => {
      if (e.target.closest?.('.cell-dropdown')) return; // Allow dropdown interaction
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);

      // Check if cursor is inside locked text
      const isHeaderFooter = range.startContainer.parentElement?.closest?.('.page-header, .page-footer, .hf-master');
      const isLogoCenter = range.startContainer.parentElement?.closest?.('.logo-center');
      if (isHeaderFooter || isLogoCenter) return;

      // Allow multi-character selections and select-all to be handled by deleteSelectionPreservingLocked in handleKeyDown
      if (!sel.isCollapsed) {
        return;
      }

      // If cursor is collapsed inside locked text, prevent native deletion
      // but do NOT call stopImmediatePropagation so handleKeyDown can skip the cursor out!
      if (isInLockedText(range.startContainer)) {
        e.preventDefault();
      }
    };

    // Apply visual styling to locked elements
    const applyLockedStyling = () => {
      const selectors = [
        '[data-locked="true"]',
        '.locked-text.locked',
        '.locked-text'
      ];

      const allLockedElements = new Set();

      selectors.forEach(selector => {
        try {
          const elements = container.querySelectorAll(selector);
          elements.forEach(el => {
            const isHeaderFooter = el.closest('.page-header, .page-footer, .hf-master');
            const isLogoCenter = el.classList.contains('logo-center');

            if (!isHeaderFooter && !isLogoCenter) {
              allLockedElements.add(el);
            }
          });
        } catch (err) {
          console.error('[LOCKED PROTECTION] Error with selector:', selector, err);
        }
      });

      allLockedElements.forEach(el => {
        el.setAttribute('contenteditable', 'false');
        el.setAttribute('data-locked', 'true');
        if (!el.classList.contains('locked-text')) el.classList.add('locked-text');
        if (!el.classList.contains('locked')) el.classList.add('locked');
        el.style.cursor = isPreviewMode ? 'default' : 'text';
        el.style.userSelect = 'text';
      });
    };

    applyLockedStyling();

    // Re-apply on DOM changes — MUST disconnect before mutating to prevent infinite loop
    const observer = new MutationObserver(() => {
      observer.disconnect(); // Stop watching before we mutate
      applyLockedStyling();
      // Re-observe after mutations are done
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-locked']
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-locked']
    });

    // Add event listeners with capture=true to intercept before other handlers
    container.addEventListener('beforeinput', preventEdit, { capture: true, passive: false });
    container.addEventListener('keydown', preventDelete, { capture: true, passive: false });

    return () => {
      observer.disconnect();
      container.removeEventListener('beforeinput', preventEdit, { capture: true });
      container.removeEventListener('keydown', preventDelete, { capture: true });
    };
  }, [isPreviewMode, pagesContainerRef]);

  // CRITICAL: Prevent all editing in approval state and readOnly mode SAFELY (no infinite loops)
  useEffect(() => {
    if (!isApprovalState && !readOnly) return;

    const container = pagesContainerRef.current;
    if (!container) return;

    const applyReadOnlyToDOM = () => {
      const elements = container.querySelectorAll(
        '[contenteditable="true"], .page-content, [data-block-id], p, h1, h2, h3, h4, h5, h6, ul, ol, li, td, th, .page-header, .page-footer, .logo-center, .logo-center-left, .footer-left, .header-text, .footer-text'
      );
      elements.forEach(el => {
        if (!readOnly) {
          // In approval state only, keep exemption for header/footer master or logo center
          const isHeaderFooter = el.closest('.page-header, .page-footer, .hf-master');
          const isLogoCenter = el.classList.contains('logo-center');
          if (isHeaderFooter || isLogoCenter) return;
        }

        if (el.getAttribute('contenteditable') !== 'false') {
          el.setAttribute('contenteditable', 'false');
        }
        if (readOnly && el.hasAttribute('tabindex')) {
          el.removeAttribute('tabindex');
        }
      });

      if (readOnly) {
        if (container.getAttribute('contenteditable') !== 'false') {
          container.setAttribute('contenteditable', 'false');
        }
        container.querySelectorAll('select').forEach(sel => {
          sel.disabled = true;
          sel.setAttribute('disabled', 'true');
        });
      }
    };

    // We must disconnect -> edit -> reconnect to avoid infinite loops
    // since we are reacting to attributes and changing attributes!
    const observer = new MutationObserver(() => {
      observer.disconnect();
      applyReadOnlyToDOM();
      observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable'] });
    });

    // Initial safe application
    applyReadOnlyToDOM();

    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable'] });

    return () => observer.disconnect();
  }, [isApprovalState, readOnly, pagesContainerRef]);

  // Handle double click to only highlight word and not trailing spaces
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleDblClick = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const text = range.toString();

      // Check if the selected text ends with spaces or non-breaking spaces
      const match = text.match(/[\s\u00A0]+$/);
      if (match && text.trim().length > 0) {
        const trailingLength = match[0].length;

        // Try the simple and most common case: endContainer is a text node and can be trimmed directly
        if (range.endContainer.nodeType === Node.TEXT_NODE && range.endOffset >= trailingLength) {
          range.setEnd(range.endContainer, range.endOffset - trailingLength);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // General fallback: reconstruct the range from start by length of trimmed text
          const targetLength = text.length - trailingLength;
          
          // Find all text nodes under commonAncestorContainer
          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          const rangeTextNodes = [];
          let node = walker.nextNode();
          while (node) {
            if (range.intersectsNode(node)) {
              rangeTextNodes.push(node);
            }
            node = walker.nextNode();
          }

          let currentLength = 0;
          let found = false;

          for (const textNode of rangeTextNodes) {
            const startOffset = (textNode === range.startContainer) ? range.startOffset : 0;
            const endOffset = (textNode === range.endContainer) ? range.endOffset : textNode.textContent.length;
            const nodeTextLength = endOffset - startOffset;

            if (currentLength + nodeTextLength >= targetLength) {
              const neededOffset = startOffset + (targetLength - currentLength);
              range.setEnd(textNode, neededOffset);
              found = true;
              break;
            }
            currentLength += nodeTextLength;
          }

          if (found) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    };

    container.addEventListener('dblclick', handleDblClick);
    return () => {
      container.removeEventListener('dblclick', handleDblClick);
    };
  }, [pagesContainerRef]);

  const handleOpenSpecialCharacters = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && pagesContainerRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
    setSpecialCharactersModalVisible(true);
  }, [pagesContainerRef]);

  const handleInsertSpecialCharacter = useCallback((char) => {
    endTypingSession();
    pushToUndo();
    if (savedSelectionRef.current) {
      try {
        const range = savedSelectionRef.current;
        let containerNode = range.startContainer;
        if (containerNode.nodeType === Node.TEXT_NODE) {
          containerNode = containerNode.parentNode;
        }
        const editableContainer = containerNode?.closest?.('[contenteditable="true"]');
        if (editableContainer) {
          editableContainer.focus();
        }

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        console.error("Error restoring selection for special character insertion:", err);
      }
    }
    
    // Insert text via execCommand to preserve contenteditable undo/redo stack
    document.execCommand("insertText", false, char);
    
    // Sync editor states and trigger auto-save
    if (syncAndNotifyRef.current) {
      syncAndNotifyRef.current();
    }
    
    setSpecialCharactersModalVisible(false);
  }, []);

  const handleOpenInsertVideoModal = useCallback(() => {
    const sel = window.getSelection();
    let activeRange = null;
    if (sel && sel.rangeCount > 0 && pagesContainerRef.current?.contains(sel.anchorNode)) {
      activeRange = sel.getRangeAt(0);
    } else if (savedSelectionRef.current) {
      activeRange = savedSelectionRef.current;
    }

    if (activeRange) {
      savedVideoRangeRef.current = activeRange.cloneRange();
      const node = activeRange.startContainer.nodeType === Node.ELEMENT_NODE
        ? activeRange.startContainer
        : activeRange.startContainer.parentElement;
      const blockEl = node?.closest?.("[data-block-id]");
      if (blockEl) {
        savedVideoBlockIdRef.current = blockEl.getAttribute("data-block-id");
      } else {
        savedVideoBlockIdRef.current = null;
      }
    } else {
      savedVideoRangeRef.current = null;
      savedVideoBlockIdRef.current = null;
    }
    setVideoModalVisible(true);
  }, [pagesContainerRef]);

  const handleInsertVideo = useCallback(({ url, type, embedUrl }) => {
    if (!url) return;

    pushToUndo?.(true);

    const selection = window.getSelection();
    let range = savedVideoRangeRef.current || savedSelectionRef.current;

    if (!range && selection && selection.rangeCount > 0) {
      const activeRange = selection.getRangeAt(0);
      if (pagesContainerRef.current?.contains(activeRange.anchorNode)) {
        range = activeRange;
      }
    }

    const savedBlockId = savedVideoBlockIdRef.current;
    let liveBlock = null;

    if (savedBlockId && pagesContainerRef.current) {
      liveBlock = pagesContainerRef.current.querySelector(`[data-block-id="${savedBlockId}"]`);
    }

    if (!liveBlock && range) {
      const startNode = range.startContainer;
      const node = startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement;
      liveBlock = node?.closest?.("[data-block-id]");
    }

    let container = liveBlock?.closest?.(".page-content");
    if (!container && pagesContainerRef.current) {
      const allPages = pagesContainerRef.current.querySelectorAll(".page-content");
      const pageIdx = Math.max(0, Math.min(allPages.length - 1, (currentPage || 1) - 1));
      container = allPages[pageIdx] || allPages[0];
    }

    if (!container) {
      console.warn("Could not find active page container to insert video.");
      return;
    }

    const blockId = `video-${uuidv4()}`;

    const figureEl = document.createElement("figure");
    figureEl.className = "video-block";
    figureEl.setAttribute("data-block-id", blockId);
    figureEl.setAttribute("data-type", "video");
    figureEl.setAttribute("contenteditable", "false");
    figureEl.setAttribute("data-align", "center");
    figureEl.style.width = "560px";
    figureEl.style.height = "315px";

    const wrapperEl = document.createElement("div");
    wrapperEl.className = "video-wrapper";
    wrapperEl.setAttribute("contenteditable", "false");

    if (type === "youtube" && embedUrl) {
      const iframeEl = document.createElement("iframe");
      iframeEl.src = embedUrl;
      iframeEl.title = "Embedded Video Player";
      iframeEl.setAttribute("frameborder", "0");
      iframeEl.setAttribute("allowfullscreen", "true");
      iframeEl.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframeEl.setAttribute("contenteditable", "false");
      wrapperEl.appendChild(iframeEl);
    } else {
      const videoEl = document.createElement("video");
      videoEl.src = url;
      videoEl.controls = true;
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("preload", "metadata");
      videoEl.setAttribute("contenteditable", "false");
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      videoEl.style.objectFit = "contain";
      videoEl.style.borderRadius = "6px";
      videoEl.style.display = "block";

      const stopMediaEvents = (evt) => evt.stopPropagation();
      videoEl.addEventListener("mousedown", stopMediaEvents);
      videoEl.addEventListener("click", stopMediaEvents);
      videoEl.addEventListener("pointerdown", stopMediaEvents);

      wrapperEl.appendChild(videoEl);
    }

    figureEl.appendChild(wrapperEl);

    // Attach 8 resize handles using dedicated VideoResizeHandler
    VideoResizeHandler.attachResizeHandles(figureEl);

    // Split block at range if selection was inside text
    let beforeBlock = liveBlock;
    let afterBlock = null;

    if (liveBlock && range && liveBlock.contains(range.startContainer)) {
      try {
        const startNode = range.startContainer;
        const startOffset = range.startOffset;
        const tagName = liveBlock.tagName.toLowerCase();

        if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "div"].includes(tagName)) {
          const rangeBefore = document.createRange();
          rangeBefore.setStart(liveBlock, 0);
          rangeBefore.setEnd(startNode, startOffset);

          const rangeAfter = document.createRange();
          rangeAfter.setStart(startNode, startOffset);
          rangeAfter.setEnd(liveBlock, liveBlock.childNodes.length);

          const fragBefore = rangeBefore.cloneContents();
          const fragAfter = rangeAfter.cloneContents();

          liveBlock.innerHTML = "";
          liveBlock.appendChild(fragBefore);
          if (!liveBlock.innerHTML.trim() || liveBlock.innerHTML === "<br>") {
            liveBlock.innerHTML = "<br>";
          }

          const afterId = `p-${uuidv4()}`;
          const newAfter = document.createElement(tagName === "p" || tagName.startsWith("h") ? tagName : "p");
          newAfter.setAttribute("data-block-id", afterId);
          newAfter.contentEditable = "true";
          newAfter.appendChild(fragAfter);
          if (!newAfter.innerHTML.trim() || newAfter.innerHTML === "<br>") {
            newAfter.innerHTML = "<br>";
          }

          if (liveBlock.nextSibling) {
            liveBlock.parentElement.insertBefore(newAfter, liveBlock.nextSibling);
          } else {
            liveBlock.parentElement.appendChild(newAfter);
          }

          beforeBlock = liveBlock;
          afterBlock = newAfter;
        }
      } catch (e) {
        console.error("Error splitting block at range:", e);
      }
    }

    let inserted = false;
    if (beforeBlock && beforeBlock.parentElement) {
      if (beforeBlock.nextSibling) {
        beforeBlock.parentElement.insertBefore(figureEl, beforeBlock.nextSibling);
      } else {
        beforeBlock.parentElement.appendChild(figureEl);
      }
      inserted = true;
    } else if (container) {
      container.appendChild(figureEl);
      inserted = true;
    }

    if (!inserted && container) {
      container.appendChild(figureEl);
      inserted = true;
    }

    // Position afterBlock directly AFTER figureEl
    let targetCaretBlock = afterBlock;
    if (!targetCaretBlock) {
      const pId = `p-${uuidv4()}`;
      targetCaretBlock = document.createElement("p");
      targetCaretBlock.setAttribute("data-block-id", pId);
      targetCaretBlock.contentEditable = "true";
      targetCaretBlock.innerHTML = "<br>";
      if (figureEl.nextSibling) {
        figureEl.parentElement.insertBefore(targetCaretBlock, figureEl.nextSibling);
      } else {
        figureEl.parentElement.appendChild(targetCaretBlock);
      }
    } else if (figureEl.nextSibling !== targetCaretBlock) {
      figureEl.parentElement.insertBefore(targetCaretBlock, figureEl.nextSibling);
    }

    // Sync DOM order to DocumentEngine so block order matches DOM exactly
    if (contentChangeHandlerRef?.current?.syncDOMToBlocks) {
      contentChangeHandlerRef.current.syncDOMToBlocks(pagesContainerRef.current);
    } else {
      syncDOMToBlocksSync?.();
    }

    schedulePaginate?.();
    // flush=true forces an immediate onContentChange notification so the video
    // insertion is saved even if the user doesn't type anything afterward.
    syncAndNotify?.(null, null, null, null, null, true);

    setTimeout(() => {
      try {
        if (targetCaretBlock && pagesContainerRef.current?.contains(targetCaretBlock)) {
          const newRange = document.createRange();
          newRange.selectNodeContents(targetCaretBlock);
          newRange.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
          targetCaretBlock.focus();
        }
      } catch (err) {}
    }, 80);
  }, [pagesContainerRef, pushToUndo, syncDOMToBlocksSync, schedulePaginate, syncAndNotify, currentPage]);

  // Extract and resolve approvers from available props/state
  const resolvedApproversList = React.useMemo(() => {
    const raw = propWorkflowApprovers ||
      propApprovers ||
      props.workflowApprovers ||
      props.approvers ||
      props.templateApprovers ||
      props.template_approvers ||
      initialContent?.approvers ||
      initialContent?.template_approvers ||
      props.document?.approvers ||
      props.template?.template_approvers;

    let list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      const reviewers = Array.isArray(raw.reviewers) ? raw.reviewers : [];
      const approvers = Array.isArray(raw.approvers) ? raw.approvers : [];
      list = [...reviewers, ...approvers];
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && typeof parsed === 'object') {
          const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
          const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : [];
          list = [...reviewers, ...approvers];
        }
      } catch (_) {}
    }

    // Deduplicate so each individual configured person only appears ONCE
    // Exactly matching uniqueUsers in TemplateApproversTab: key = user.userId || user.email
    const unique = [];
    const seen = new Set();
    list.forEach(person => {
      if (!person) return;
      // Filter out pure department rules that aren't actual configured users
      const hasIdentity = Boolean(person.email || person.name || person.userName || person.first_name);
      if (!hasIdentity) return;

      const key = String(person.userId || person.id || person.email || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push({
          ...person,
          name: person.name || (person.first_name ? `${person.first_name} ${person.last_name || ''}`.trim() : person.email),
          email: person.email || '',
          department: person.department || person.selectedDepartment || 'Engineering',
          role: person.role || 'Reviewer',
          stage: person.stage || 1,
          status: person.status || 'Configured'
        });
      }
    });

    return unique;
  }, [
    propWorkflowApprovers,
    propApprovers,
    props.workflowApprovers,
    props.approvers,
    props.templateApprovers,
    props.template_approvers,
    initialContent?.approvers,
    initialContent?.template_approvers,
    props.document?.approvers,
    props.template?.template_approvers,
  ]);

  // --- DIRECT PDF EXPORT HANDLER ---
  // Iterates over every logical page, renders each isolated page to PDF matching its orientation/dimensions 1:1.
  const handlePrint = useCallback(async (options = {}) => {
    if (isExportingPdf) return;
    const includeApprovers = Boolean(options && options.includeApprovers);
    try {
      setIsExportingPdf(true);
      await exportDocumentToPdf({
        pagesContainerRef,
        paperSize,
        orientation,
        pagesState,
        documentTitle: documentTitle || initialContent?.title || props?.template?.name || "Document",
        includeApproversPage: includeApprovers,
        approvers: resolvedApproversList,
        onProgress: (current, total, statusText) => {
          setPdfExportStatus(statusText);
        },
      });
      message.success("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF Export error:", err);
      message.error(err.message || "Failed to generate PDF export.");
    } finally {
      setIsExportingPdf(false);
      setPdfExportStatus("");
    }
  }, [isExportingPdf, pagesContainerRef, paperSize, orientation, pagesState, documentTitle, initialContent, props?.template?.name, resolvedApproversList]);

  // --- Hyperlink System (@-mention) Event Handlers ---
  const checkMentionTrigger = useCallback(() => {
    if (isApprovalState) return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    // Check if the cursor is within an editable text area
    const parentEl = node.parentElement;
    if (parentEl && parentEl.closest('[data-locked="true"]') && !parentEl.closest('.page-header, .page-footer')) {
      return;
    }

    const text = node.textContent.slice(0, range.startOffset);
    const atIndex = text.lastIndexOf('@');

    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? text[atIndex - 1] : ' ';
      // Valid trigger if '@' is at start of text node or preceded by whitespace
      if (/\s/.test(charBefore) || atIndex === 0) {
        const query = text.slice(atIndex + 1);
        if (!/\s/.test(query) && query.length <= 40) {
          try {
            const rect = range.getBoundingClientRect();
            const parentRect = node.parentElement ? node.parentElement.getBoundingClientRect() : rect;
            const topPos = (rect.bottom > 0 ? rect.bottom : parentRect.bottom) + window.scrollY + 6;
            const leftPos = (rect.left > 0 ? rect.left : parentRect.left) + window.scrollX;

            const replaceRange = document.createRange();
            replaceRange.setStart(node, atIndex);
            replaceRange.setEnd(node, range.startOffset);

            setMentionState({
              isOpen: true,
              position: { top: topPos, left: leftPos },
              triggerRange: replaceRange,
              query: query
            });
            return;
          } catch (e) {
            console.error('Error calculating mention popup position:', e);
          }
        }
      }
    }

    setMentionState(prev => (prev.isOpen ? { isOpen: false, position: null, triggerRange: null, query: '' } : prev));
  }, [isApprovalState]);

  const handleEditorKeyUp = useCallback((e) => {
    handleKeyUp(e);
    checkMentionTrigger();
  }, [handleKeyUp, checkMentionTrigger]);

  const handleEditorInput = useCallback((e) => {
    caretManagerRef.current?.onEditingAction("input");
    syncAndNotify();
    checkMentionTrigger();
  }, [syncAndNotify, checkMentionTrigger]);

  const handleSelectMentionDocument = useCallback((doc) => {
    if (!doc) return;
    const sel = window.getSelection();
    let range = mentionState.triggerRange;

    if (range) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    }

    if (!range) return;

    // Delete '@query'
    range.deleteContents();

    // Create styled atomic badge hyperlink
    const badgeLink = document.createElement('a');
    badgeLink.href = `/document/${doc.document_id}?view=reference`;
    badgeLink.setAttribute('data-doc-id', String(doc.document_id));
    badgeLink.setAttribute('data-doc-title', doc.title || '');
    badgeLink.setAttribute('data-type', 'doc-hyperlink');
    badgeLink.className = 'doc-mention-link';
    badgeLink.contentEditable = 'false';
    badgeLink.title = `Ctrl + Click to view published document: ${doc.title || ''}`;
    badgeLink.innerHTML = `<span class="doc-mention-link-icon">📄</span> <span class="doc-mention-link-text">${doc.title || 'Document'}</span> <span class="doc-mention-link-version">v${doc.version || '1.0'}</span>`;

    range.insertNode(badgeLink);

    // Insert trailing non-breaking space
    const spaceNode = document.createTextNode('\u00A0');
    if (badgeLink.nextSibling) {
      badgeLink.parentNode.insertBefore(spaceNode, badgeLink.nextSibling);
    } else if (badgeLink.parentNode) {
      badgeLink.parentNode.appendChild(spaceNode);
    }

    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setMentionState({ isOpen: false, position: null, triggerRange: null, query: '' });

    if (syncAndNotify) {
      syncAndNotify();
    }
  }, [mentionState.triggerRange, syncAndNotify]);

  // Universal Capturing Click Listener: Handles hyperlink navigation at ALL lifecycle stages
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleGlobalHyperlinkClick = (e) => {
      const link = e.target.closest('.doc-mention-link, a[data-type="doc-hyperlink"], a[href*="/document/"]');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      const hrefMatch = href.match(/\/document\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/);
      const docId = link.getAttribute('data-doc-id') || (hrefMatch ? hrefMatch[1] : null);
      if (!docId) return;

      // In any mode: Ctrl+Click or Cmd+Click, OR if in preview/approval/read-only mode regular click
      if (e.ctrlKey || e.metaKey || isPreviewMode || isApprovalState || readOnly) {
        e.preventDefault();
        e.stopPropagation();
        window.open(`/document/${docId}?view=reference`, '_blank');
      }
    };

    container.addEventListener('click', handleGlobalHyperlinkClick, true);
    return () => {
      container.removeEventListener('click', handleGlobalHyperlinkClick, true);
    };
  }, [pagesContainerRef, isPreviewMode, isApprovalState, readOnly]);

  // Apply obsolete badge styling to referenced links that are obsolete
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container || !props.obsoleteDocIds || props.obsoleteDocIds.length === 0) return;

    const obsoleteSet = new Set(props.obsoleteDocIds.map((id) => String(id)));
    const links = container.querySelectorAll('.doc-mention-link, a[data-type="doc-hyperlink"], a[href*="/document/"]');
    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const hrefMatch = href.match(/\/document\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/);
      const docId = link.getAttribute('data-doc-id') || (hrefMatch ? hrefMatch[1] : null);
      if (docId && obsoleteSet.has(String(docId))) {
        link.classList.add('doc-mention-obsolete');
        if (!link.querySelector('.doc-mention-link-obsolete-tag')) {
          const tag = document.createElement('span');
          tag.className = 'doc-mention-link-obsolete-tag';
          tag.textContent = 'Obsolete';
          link.appendChild(tag);
        }
        link.title = 'Warning: This referenced document has become obsolete. You need to revise your document.';
      }
    });
  }, [pagesContainerRef, props.obsoleteDocIds]);

  const handleEditorContainerClick = useCallback((e) => {
    const link = e.target.closest('.doc-mention-link, a[data-type="doc-hyperlink"], a[href*="/document/"]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const hrefMatch = href.match(/\/document\/([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/);
      const docId = link.getAttribute('data-doc-id') || (hrefMatch ? hrefMatch[1] : null);
      if (e.ctrlKey || e.metaKey || isPreviewMode || isApprovalState || readOnly) {
        e.preventDefault();
        e.stopPropagation();
        if (docId) {
          window.open(`/document/${docId}?view=reference`, '_blank');
        }
      }
    }
  }, [isPreviewMode, isApprovalState, readOnly]);

  return (
    <div
      className={`template-container ${isFullScreen ? "full-screen-mode" : ""}`}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <Toolbar
        paperSize={paperSize}
        setPaperSize={setPaperSize}
        user={user}
        isFullScreen={isFullScreen}
        toggleFullScreen={() => setIsFullScreen((v) => !v)}
        orientation={pagesState[currentPage - 1]?.orientation || orientation}
        setOrientation={handleOrientationRequest}
        onInsertTable={handleInsertTable}
        onOpenSpecialCharacters={handleOpenSpecialCharacters}
        onOpenInsertVideoModal={handleOpenInsertVideoModal}
        onUndo={undo}
        onRedo={redo}
        onBeforeAction={pushToUndo}
        onAfterAction={syncAndNotify}
        syncDOMToBlocksSync={syncDOMToBlocksSync}
        schedulePaginate={schedulePaginate}
        onPrint={handlePrint}
        isExportingPdf={isExportingPdf}
        approversContent={props.approversContent}
        approversList={resolvedApproversList}
        onOpenFindReplace={() => findReplace.openFind('find')}
      />
      <div className="main-container">
        {showTOC && <TOCComponent isFullScreen={isFullScreen} />}
        <div className="content-container">
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, position: 'relative' }}>
            <FindReplaceModal
              isOpen={findReplace.isOpen}
              onClose={findReplace.closeFind}
              mode={findReplace.mode}
              setMode={findReplace.setMode}
              findText={findReplace.findText}
              setFindText={findReplace.setFindText}
              replaceText={findReplace.replaceText}
              setReplaceText={findReplace.setReplaceText}
              matchCase={findReplace.matchCase}
              setMatchCase={findReplace.setMatchCase}
              wholeWord={findReplace.wholeWord}
              setWholeWord={findReplace.setWholeWord}
              currentIndex={findReplace.currentIndex}
              matchCount={findReplace.matchCount}
              goToNext={findReplace.goToNext}
              goToPrev={findReplace.goToPrev}
              replaceCurrent={findReplace.replaceCurrent}
              replaceAll={findReplace.replaceAll}
              readOnly={Boolean(readOnly)}
            />
            {templateUpdateNotice && templateUpdateNotice.hasNewerVersion && (
              <div className="version-notice-bar notice-bar-template">
                <div className="notice-content">
                  <span className="notice-icon">⚠️</span>
                  <span className="notice-text">
                    <strong>Template/Document Update Available:</strong> A newer version (v{templateUpdateNotice.newTemplate.version}) of <em>"{templateUpdateNotice.newTemplate.name}"</em> is published.
                  </span>
                </div>
              </div>
            )}

            {documentUpdateNotice && documentUpdateNotice.hasNewerVersion && (
              <div className="version-notice-bar notice-bar-document">
                <div className="notice-content">
                  <span className="notice-icon">ℹ️</span>
                  <span className="notice-text">
                    <strong>New Document Version:</strong> A newer revised version of this document is published (v{documentUpdateNotice.newDocument.version}).
                  </span>
                </div>
                <button
                  className="notice-btn btn-document-view"
                  onClick={handleOpenLatestDocument}
                >
                  View Latest Version
                </button>
              </div>
            )}
            <div className="editor-container" onClick={handleEditorContainerClick}>
              <div
                ref={pagesContainerRef}
                className={`document-renderer ${orientation} ${paperSize.toLowerCase()} ${readOnly ? "editor-read-only" : ""}`}
                style={{ position: 'relative', outline: 'none' }}
                contentEditable={false}
                spellCheck={shouldSpellCheck}
                lang={shouldSpellCheck ? "en" : undefined}
                tabIndex={readOnly ? -1 : undefined}
                suppressContentEditableWarning={true}
                onBeforeInput={handleBeforeInput}
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                onKeyUp={handleEditorKeyUp}
                onPaste={handlePaste}
                onCompositionStart={() => { window.isImeComposing = true; }}
                onCompositionEnd={() => {
                  window.isImeComposing = false;
                  caretManagerRef.current?.onEditingAction("compositionend");
                }}
              />
              <HeaderFooterManager
                containerRef={pagesContainerRef}
                headerHTML={headerHTML}
                footerHTML={footerHTML}
                onChange={({ headerHTML: h, footerHTML: f }) => {
                  const normalizedHeader = (h || "").trim();
                  const normalizedTitle = (documentTitle || "").trim();
                  if (normalizedHeader.length > 0 && normalizedHeader !== normalizedTitle) {
                    hasUserCustomizedHeaderRef.current = true;
                  } else if (normalizedHeader === "" || normalizedHeader === normalizedTitle) {
                    hasUserCustomizedHeaderRef.current = false;
                  }
                  setHeaderHTML(h);
                  setFooterHTML(f);

                  // THROTTLED SYNC: Only sync and notify parent after a short pause in header typing
                  // This prevents the logo system from flickering on every single character
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    syncAndNotify(null, null, h || "", f || "");
                  }, 300);
                }}
                options={{
                  pageSelector: ".page",
                  headerSelector: ".page-header",
                  footerSelector: ".page-footer",
                  footerEditSelector: ".page-footer .footer-left, .page-footer",
                  pageNumSelector: ".page-footer [data-page-num]",
                  injectStyles: true,
                  lockHeaderEditing: lockHeaderEditing || readOnly,
                }}
              />
              <div className="page-counter-chip">
                Page {currentPage} of {pageCount}
              </div>
            </div>
          </div> {/* close the vertical flexbox wrapper */}
        </div>
      </div>

      {isFullScreen && (
        <button
          className="toc-toggle-button"
          onClick={() => setSidebarWidth(sidebarWidth === 0 ? 200 : 0)}
        >
          <i className={`bi bi-${sidebarWidth > 0 ? "x" : "list"}`}></i>
        </button>
      )}
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
      {editorPasteContextMenu}
      <MakeOptionModal
        visible={dropdownModalVisible}
        onClose={() => setDropdownModalVisible(false)}
        onCreate={handleCreateDropdown}
        initialOptions={dropdownTargetCell?.initialOptions || []}
      />
      <SpecialCharactersModal
        visible={specialCharactersModalVisible}
        onCancel={() => setSpecialCharactersModalVisible(false)}
        onInsert={handleInsertSpecialCharacter}
      />
      <InsertVideoModal
        show={videoModalVisible}
        onHide={() => setVideoModalVisible(false)}
        onInsertVideo={handleInsertVideo}
      />
      <OrientationModal
        show={orientationModalVisible}
        onHide={() => setOrientationModalVisible(false)}
        targetOrientation={pendingOrientation}
        currentPage={currentPage}
        onConfirmThisPage={handleConfirmThisPageOrientation}
        onConfirmWholeDocument={handleConfirmWholeDocumentOrientation}
      />
      {isExportingPdf && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              padding: "24px 36px",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div className="spinner-border text-primary" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
              <span className="visually-hidden">Exporting PDF...</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>Generating PDF Document</div>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>{pdfExportStatus || "Preparing pages..."}</div>
          </div>
        </div>
      )}
      {mentionState.isOpen && mentionState.position && (
        <DocumentMentionMenu
          position={mentionState.position}
          initialQuery={mentionState.query}
          onSelect={handleSelectMentionDocument}
          onClose={() => setMentionState({ isOpen: false, position: null, triggerRange: null, query: '' })}
        />
      )}
    </div>
  );
};

export default TemplateEditor;
