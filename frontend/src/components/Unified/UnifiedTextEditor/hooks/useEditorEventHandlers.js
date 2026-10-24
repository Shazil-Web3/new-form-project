import { useRef, useEffect } from "react";
import { useCrossPageSelection } from "./editorEventHandlers/useCrossPageSelection";
import { useDeletionStrike } from "./editorEventHandlers/useDeletionStrike";
import { useCaretBlockHelpers } from "./editorEventHandlers/useCaretBlockHelpers";
import { usePageClick } from "./editorEventHandlers/usePageClick";
import { useTableResize } from "./editorEventHandlers/useTableResize";
import { usePageContentLocal } from "./editorEventHandlers/usePageContentLocal";
import { useLockedTextNavigation } from "./editorEventHandlers/useLockedTextNavigation";
import { useMakeEditable } from "./editorEventHandlers/useMakeEditable";
import { useBlockBackspace } from "./editorEventHandlers/useBlockBackspace";
import { useHandleEnter } from "./editorEventHandlers/useHandleEnter";
import { useHandlePageBreak } from "./editorEventHandlers/useHandlePageBreak";
import { usePositionCursor } from "./editorEventHandlers/usePositionCursor";
import { useHandlePaste } from "./editorEventHandlers/useHandlePaste";
import { useHandleBeforeInput } from "./editorEventHandlers/useHandleBeforeInput";
import { useTableCellNavigation } from "./editorEventHandlers/useTableCellNavigation";
import { useHandleKeyDown } from "./editorEventHandlers/useHandleKeyDown";
import { useHandleKeyUp } from "./editorEventHandlers/useHandleKeyUp";

export const useEditorEventHandlers = ({
  pagesContainerRef,
  documentEngineRef,
  pasteHandlerRef,
  imagePasteHandlerRef,
  contentChangeHandlerRef,
  syncAndNotify,
  schedulePaginateRef,
  renderFreshFromEngineRef,
  currentUser,
  user,
  userRole,
  savedSelectionRef,
  getBlockAndOffset,
  paperSize,
  updateTOC,
  setIsFullScreen,
  isFullScreen,
  getActivePageContent,
  setCurrentPage,
  ensureOnePage,
  onTyping,
  isApprovalState = false,
  readOnly = false,
  enableTypedUnderlines = true,
  disableStrikeOnDelete = false,
  undo,
  redo,
  pushToUndo,
  isTypingRef,
  registerTypingAction,
  endTypingSession,
  ignoreNextTypingActionRef,
  caretManagerRef,
  isDeletionInFlightRef,
}) => {
  const paginationTimeoutRef = useRef(null);
  const selectAllActiveRef = useRef(false);
  const activeTableResizeRef = useRef(null);
  const syncAndNotifyRefInternal = useRef(syncAndNotify);
  const shiftPressedCellRef = useRef(null);
  const shiftHadOtherKeysRef = useRef(false);

  // Cross-page text drag selection tracking ref & RAF handle
  const crossPageDragRef = useRef({
    active: false,
    anchorNode: null,
    anchorOffset: 0,
    pointerX: 0,
    pointerY: 0,
  });
  const selectionUpdateFrameRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (paginationTimeoutRef.current) clearTimeout(paginationTimeoutRef.current);
    };
  }, []);

  // 1. Cross page selection handling
  const {
    isValidDocumentCaret,
    getCaretFromPoint,
    updateCrossPageSelection,
    scheduleCrossPageSelectionUpdate,
  } = useCrossPageSelection({
    pagesContainerRef,
    syncAndNotify,
    syncAndNotifyRefInternal,
    crossPageDragRef,
    selectionUpdateFrameRef,
  });

  // 2. Tracked changes deletion strike & color helpers
  const {
    debouncedPaginateInput,
    getTrackedUnderlineColor,
    hexToRgba,
    isNodeOwnedByCurrentUser,
    getTextPositionFromOffset,
    getSingleCharRange,
    applyBackspaceStrike,
    convertDeletionToStrike,
  } = useDeletionStrike({
    schedulePaginateRef,
    currentUser,
    user,
    userRole,
    undo,
    paginationTimeoutRef,
  });

  // 3. Caret placement & paragraph creation helpers
  const {
    setCaretInBlock,
    getBlockElements,
    createParagraphBelow,
    createParagraphAbove,
  } = useCaretBlockHelpers({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    currentUser,
    user,
    savedSelectionRef,
  });

  // 4. Page focus & background click management
  const { handlePageClick } = usePageClick({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    currentUser,
    user,
    savedSelectionRef,
    setCurrentPage,
    readOnly,
    endTypingSession,
    activeTableResizeRef,
    setCaretInBlock,
    getBlockElements,
    createParagraphBelow,
    createParagraphAbove,
  });

  // 5. Table boundary resize listener
  useTableResize({
    pagesContainerRef,
    schedulePaginateRef,
    user,
    readOnly,
    pushToUndo,
    paginationTimeoutRef,
    activeTableResizeRef,
    syncAndNotifyRefInternal,
    crossPageDragRef,
    selectionUpdateFrameRef,
    isValidDocumentCaret,
    getCaretFromPoint,
    scheduleCrossPageSelectionUpdate,
    handlePageClick,
  });

  // 6. Active page content resolver
  const { getActivePageContentLocal } = usePageContentLocal({
    pagesContainerRef,
  });

  // 7. Locked text boundary navigation & deletion
  const {
    containsLockedText,
    isLockedElement,
    findLockedElementBefore,
    skipLockedTextBackward,
    deleteSelectionPreservingLocked,
  } = useLockedTextNavigation({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    savedSelectionRef,
    pushToUndo,
    selectAllActiveRef,
  });

  // 8. Lock/Unlock selection toggle
  const { handleMakeEditable, toggleBlockLock } = useMakeEditable({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    currentUser,
    user,
    userRole,
    savedSelectionRef,
    updateTOC,
    pushToUndo,
    getTrackedUnderlineColor,
    isNodeOwnedByCurrentUser,
  });

  // 9. Block backspace & across-host deletions
  const { deleteAcrossHosts, handleBlockBackspace } = useBlockBackspace({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    getBlockAndOffset,
    disableStrikeOnDelete,
    caretManagerRef,
  });

  // 10. Enter key handler
  const { handleEnter } = useHandleEnter({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    currentUser,
    user,
    caretManagerRef,
  });

  // 11. Page break handler
  const { handlePageBreak } = useHandlePageBreak({
    pagesContainerRef,
    documentEngineRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    currentUser,
    user,
    readOnly,
    pushToUndo,
    endTypingSession,
    caretManagerRef,
  });

  // 12. Position cursor helper
  const { positionCursorAtEndOfBlock } = usePositionCursor({
    pagesContainerRef,
    setCurrentPage,
  });

  // 13. Paste handler
  const { handlePaste } = useHandlePaste({
    pasteHandlerRef,
    imagePasteHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    ensureOnePage,
    onTyping,
    isApprovalState,
    readOnly,
    pushToUndo,
    endTypingSession,
    ignoreNextTypingActionRef,
    caretManagerRef,
    getActivePageContentLocal,
    positionCursorAtEndOfBlock,
    // Reviewer-underline props (Bug 2 fix)
    enableTypedUnderlines,
    currentUser,
    user,
    userRole,
    getTrackedUnderlineColor,
  });

  // 14. BeforeInput handler
  const { handleBeforeInput } = useHandleBeforeInput({
    pagesContainerRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    currentUser,
    user,
    userRole,
    onTyping,
    readOnly,
    enableTypedUnderlines,
    disableStrikeOnDelete,
    registerTypingAction,
    caretManagerRef,
    debouncedPaginateInput,
    getTrackedUnderlineColor,
    convertDeletionToStrike,
    containsLockedText,
    findLockedElementBefore,
    skipLockedTextBackward,
    deleteSelectionPreservingLocked,
    handleBlockBackspace,
    handleEnter,
    handlePaste,
  });

  // 15. Table cell navigation (Tab/Shift-Tab)
  const { handleTableCellNavigation } = useTableCellNavigation({
    pagesContainerRef,
  });

  // 16. KeyDown handler
  const { handleKeyDown } = useHandleKeyDown({
    pagesContainerRef,
    documentEngineRef,
    imagePasteHandlerRef,
    contentChangeHandlerRef,
    syncAndNotify,
    schedulePaginateRef,
    renderFreshFromEngineRef,
    setIsFullScreen,
    isFullScreen,
    onTyping,
    readOnly,
    disableStrikeOnDelete,
    undo,
    redo,
    pushToUndo,
    endTypingSession,
    ignoreNextTypingActionRef,
    caretManagerRef,
    selectAllActiveRef,
    shiftPressedCellRef,
    shiftHadOtherKeysRef,
    convertDeletionToStrike,
    setCaretInBlock,
    createParagraphBelow,
    containsLockedText,
    findLockedElementBefore,
    skipLockedTextBackward,
    deleteSelectionPreservingLocked,
    deleteAcrossHosts,
    handleBlockBackspace,
    handleEnter,
    handlePageBreak,
    handleTableCellNavigation,
    isDeletionInFlightRef,
  });

  // 17. KeyUp handler
  const { handleKeyUp } = useHandleKeyUp({
    readOnly,
    shiftPressedCellRef,
    shiftHadOtherKeysRef,
    handleTableCellNavigation,
  });

  // Return the event handlers and the check function (in case parent needs it)
  return {
    handlePaste,
    handleBeforeInput,
    handleKeyDown,
    handleKeyUp,
    handleMakeEditable,
    toggleBlockLock,
    containsLockedText,
    handleEnter,
    handlePageBreak,
    getActivePageContentLocal,
  };
};

export default useEditorEventHandlers;