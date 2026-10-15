import { useRef, useEffect, useCallback } from 'react';
import useEditorBlockOffset from '../helpers/useEditorBlockOffset';

export function useEditorHistory({
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
}) {
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
      comments,
      suggestedEdits,
      logo,
    };
  }, [headerHTML, footerHTML, comments, suggestedEdits, logo]);

  const { getBlockAndOffset } = useEditorBlockOffset(pagesContainerRef);

  const takeUndoSnapshot = useCallback(() => {
    if (contentChangeHandlerRef?.current && pagesContainerRef?.current) {
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
    return {
      pages: JSON.parse(JSON.stringify(documentEngineRef.current.document.pages)),
      headerHTML: state.headerHTML,
      footerHTML: state.footerHTML,
      comments: JSON.parse(JSON.stringify(state.comments || [])),
      suggestions: JSON.parse(JSON.stringify(state.suggestedEdits || [])),
      logo: state.logo ? JSON.parse(JSON.stringify(state.logo)) : null,
      caret
    };
  }, [getBlockAndOffset, pagesContainerRef, contentChangeHandlerRef, documentEngineRef]);

  const pushToUndo = useCallback((force = false) => {
    if (isUndoRedoActionRef.current) return;
    const snapshot = takeUndoSnapshot();
    if (!force) {
      const lastSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
      if (lastSnapshot) {
        const pagesEqual = JSON.stringify(lastSnapshot.pages) === JSON.stringify(snapshot.pages);
        const headerEqual = lastSnapshot.headerHTML === snapshot.headerHTML;
        const footerEqual = lastSnapshot.footerHTML === snapshot.footerHTML;
        const commentsEqual = JSON.stringify(lastSnapshot.comments) === JSON.stringify(snapshot.comments);
        const suggestionsEqual = JSON.stringify(lastSnapshot.suggestions) === JSON.stringify(snapshot.suggestions);
        const logoEqual = JSON.stringify(lastSnapshot.logo) === JSON.stringify(snapshot.logo);
        if (pagesEqual && headerEqual && footerEqual && commentsEqual && suggestionsEqual && logoEqual) return;
      }
    }
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, [takeUndoSnapshot]);

  const restoreSnapshot = useCallback((snapshot) => {
    if (!snapshot) {
      isUndoRedoActionRef.current = false;
      return;
    }
    window.isUndoRedoRestoring = true;
    documentEngineRef.current.document.pages = JSON.parse(JSON.stringify(snapshot.pages));
    documentEngineRef.current.currentPageIndex = 0;
    setHeaderHTML(snapshot.headerHTML || "");
    setFooterHTML(snapshot.footerHTML || "");
    setComments(snapshot.comments || []);
    setSuggestedEdits(snapshot.suggestions || []);
    if (snapshot.logo !== undefined) setLogo(snapshot.logo);

    if (renderFreshFromEngineRef?.current) {
      renderFreshFromEngineRef.current(snapshot.caret);
    }
    
    // Save restored state and notify collaborators
    const blocks = documentEngineRef.current.getAllBlocks();
    const htmlContent = documentEngineRef.current.toHTML();
    
    if (socket) {
      socket.emit("textChange", { 
        docId, 
        content: htmlContent,
        blocks: blocks,
        headerHTML: snapshot.headerHTML,
        footerHTML: snapshot.footerHTML
      });
    }
    
    try {
      localStorage.setItem(`doc_backup_${docId}`, JSON.stringify({
        content: htmlContent,
        blocks: blocks,
        headerHTML: snapshot.headerHTML,
        footerHTML: snapshot.footerHTML,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Failed to backup document to localStorage:', e);
    }

    if (updateTOC) updateTOC();

    setTimeout(() => {
      isUndoRedoActionRef.current = false;
      window.isUndoRedoRestoring = false;
    }, 800);
  }, [docId, updateTOC, documentEngineRef, setHeaderHTML, setFooterHTML, setComments, setSuggestedEdits, setLogo, renderFreshFromEngineRef, socket]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    isUndoRedoActionRef.current = true;
    const currentSnapshot = takeUndoSnapshot();
    redoStackRef.current.push(currentSnapshot);
    if (redoStackRef.current.length > 100) redoStackRef.current.shift();
    const snapshot = undoStackRef.current.pop();
    restoreSnapshot(snapshot);
  }, [takeUndoSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    isUndoRedoActionRef.current = true;
    const currentSnapshot = takeUndoSnapshot();
    undoStackRef.current.push(currentSnapshot);
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    const snapshot = redoStackRef.current.pop();
    restoreSnapshot(snapshot);
  }, [takeUndoSnapshot, restoreSnapshot]);

  const registerTypingAction = useCallback(() => {
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
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      pushToUndo();
    }, 1500);
  }, [pushToUndo]);

  const endTypingSession = useCallback(() => {
    if (isTypingRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      pushToUndo();
      isTypingRef.current = false;
    }
  }, [pushToUndo]);

  // Listen for actions outside Editor (e.g. comments/suggestions mutations)
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

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return {
    undo,
    redo,
    pushToUndo,
    registerTypingAction,
    endTypingSession,
    takeUndoSnapshot,
    ignoreNextTypingActionRef,
    getBlockAndOffset,
  };
}

export default useEditorHistory;
