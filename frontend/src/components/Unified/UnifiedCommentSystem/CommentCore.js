import React, { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from "react";
import { Form, Button } from "react-bootstrap";
import { socket } from '../../../utils/SocketProvider';
import logger from '../../../utils/editorLogger';
import { getEditorScrollContainer } from '../UnifiedTextEditor/utils/editorScrollUtils';
import { recomputeReferenceNumbers } from '../../../utils/referenceUtils';
import {
  getOffsetInBlock,
  getNodeFromOffsetInBlock,
  getRangeBlockOffsets,
  recreateRangeFromBlockOffsets
} from "./commentCore/RangeBlockHelpers";
import { ReferencePreviewComponent } from "./commentCore/ReferencePreviewComponent";
import { FloatingToolbarComponent } from "./commentCore/FloatingToolbarComponent";
import { RailComposerComponent } from "./commentCore/RailComposerComponent";
import { StrikePopupComponent } from "./commentCore/StrikePopupComponent";
import { RightRailComponent } from "./commentCore/RightRailComponent";
import { RailCardComponent } from "./commentCore/RailCardComponent";
import { useStrikeManager } from "./commentCore/useStrikeManager";
import { useCommentOrphanObserver } from "./commentCore/useCommentOrphanObserver";
import { useCommentSocketListeners } from "./commentCore/useCommentSocketListeners";
import { useRailLayout } from "./commentCore/useRailLayout";
import { useHighlightInteractions } from "./commentCore/useHighlightInteractions";
import { useReplyActions } from "./commentCore/useReplyActions";
import { useElementCreation } from "./commentCore/useElementCreation";
import { useCommentPermissions } from "./commentCore/useCommentPermissions";
import {
  applyHighlight as applyHighlightUtil,
  reconstructHighlight as reconstructHighlightUtil
} from "./commentCore/highlightDomUtils";

export const useCommentCore = ({
  user,
  pagesContainerRef,
  onContentChange,
  showFloatingElements = true,
  handleMakeEditable,
  onCommentFocus,
  comments = [],
  suggestions = [],
  references = [],
  onCommentsChange,
  onSuggestionsChange,
  onReferencesChange,
  enableReplies = true,
  docId = "template-editor",
  userRole,
  disableAcceptReject = false,
  isDraft = false,
  isRevise = false,
  hideLockInFloatingToolbar = false,
  hideSuggestInFloatingToolbar = false,
  ...props
}) => {
  const effectiveIsDraft = isRevise ? false : Boolean(isDraft);

  // Comment and Edit functionality state
  const [floatingElements, setFloatingElements] = useState([]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isSuggestingEdit, setIsSuggestingEdit] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [suggestEditText, setSuggestEditText] = useState("");
  const [commentPosition, setCommentPosition] = useState(null);
  const [suggestEditPosition, setSuggestEditPosition] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [floatingButtonPosition, setFloatingButtonPosition] = useState({ top: 0, left: 0 });
  const [activeRailTab, setActiveRailTab] = useState('comments');
  const activeRailTabRef = useRef(activeRailTab);
  const [flashingTab, setFlashingTab] = useState(null);
  const [manualSwitchTab, setManualSwitchTab] = useState(null);
  const flashingTimeoutRef = useRef(null);
  const manualSwitchTimeoutRef = useRef(null);

  useEffect(() => {
    activeRailTabRef.current = activeRailTab;
  }, [activeRailTab]);

  const triggerTabFlash = useCallback((tabName) => {
    if (flashingTimeoutRef.current) {
      clearTimeout(flashingTimeoutRef.current);
    }
    setFlashingTab(tabName);
    flashingTimeoutRef.current = setTimeout(() => {
      setFlashingTab(null);
    }, 1500);
  }, []);

  useEffect(() => {
    if (effectiveIsDraft && activeRailTab !== 'comments') {
      setActiveRailTab('comments');
    }
  }, [effectiveIsDraft, activeRailTab]);

  const handleManualTabSwitch = useCallback((tabName) => {
    if (effectiveIsDraft && tabName !== 'comments') return;
    setActiveRailTab(tabName);
    if (manualSwitchTimeoutRef.current) clearTimeout(manualSwitchTimeoutRef.current);
    setManualSwitchTab(tabName);
    manualSwitchTimeoutRef.current = setTimeout(() => {
      setManualSwitchTab(null);
    }, 600);

    if (flashingTimeoutRef.current) {
      clearTimeout(flashingTimeoutRef.current);
      setFlashingTab(null);
    }
  }, [setActiveRailTab, effectiveIsDraft]);

  // New state for Google Docs-like UI
  // Persist rail width across sessions and re-renders
  const [railWidth, setRailWidth] = useState(() => {
    const saved = localStorage.getItem(`rail-width-${docId}`);
    return saved ? parseInt(saved, 10) : 330;
  });
  const railWidthRef = useRef(railWidth);
  const [isRailResizing, setIsRailResizing] = useState(false);
  const resizeStateRef = useRef(null);
  const [railMetrics, setRailMetrics] = useState({
    right: 0,
    width: railWidth, // Initialize width from saved state
    top: 0,
  });

  const [pillPos, setPillPos] = useState({ top: 0, left: 0, show: false });
  const [referencePreview, setReferencePreview] = useState({ show: false, top: 0, left: 0, ref: null });
  const [strikePopupState, setStrikePopupState] = useState({
    show: false,
    strikeIds: [],
    top: 0,
    left: 0,
    email: null
  });
  const strikePopupRef = useRef(null);
  const selectionTimerRef = useRef(null);
  const strikeSelectionTimerRef = useRef(null);
  const recomputeRailTimerRef = useRef(null); // NEW: Debounce timer for rail recompute
  const anchorPositionCacheRef = useRef(new Map()); // NEW: Single-pass anchor coordinate cache
  const pageMetricsCacheRef = useRef([]); // NEW: Cached page measurements
  const currentUserId = user?.id != null ? String(user.id) : null;
  const currentUserEmail = (user?.email || '').toLowerCase();
  const sessionCreatedIds = useRef(new Set());


  const { canActOnStrike, canApproveOrRejectItem } = useCommentPermissions({
    user,
    userRole,
    disableAcceptReject,
    currentUserId,
    currentUserEmail,
    sessionCreatedIds
  });

  // Hover state for bi-directional highlighting
  // Removed state to prevent remounting components on hover
  // which was causing scroll position to reset. Using imperative DOM updates instead.


  // Comment and Edit functionality refs
  const floatingElementsRef = useRef(floatingElements);
  const selectedRangeRef = useRef(null);
  const selectedRangeOffsetsRef = useRef(null);
  const freshlyResolvedIdsRef = useRef(new Set());

  // Normalize restored payloads so they attach to the live anchoring engine.
  // Different API/DB paths may return `_id`, `commentId`, `suggestionId`, or `elementId` instead of `id`.
  const normalizeElement = useCallback((raw, fallbackType) => {
    if (!raw || typeof raw !== 'object') return null;
    const id =
      raw.id ??
      raw.elementId ??
      raw.commentId ??
      raw.suggestionId ??
      raw._id ??
      null;
    if (id == null) return null;

    const inferredType = raw.type ?? raw.elementType ?? fallbackType ?? 'comment';
    const type = inferredType === 'suggestededit' ? 'suggestededit' :
      inferredType === 'reference' ? 'reference' : 'comment';

    const selectedText =
      raw.selectedText ??
      raw.highlightedText ??
      raw.selectionText ??
      raw.anchorText ??
      '';

    return {
      ...raw,
      id: String(id),
      type,
      elementType: type,
      selectedText,
      highlightedText: raw.highlightedText ?? selectedText,
      createdInDraft: raw.createdInDraft !== undefined ? raw.createdInDraft : (effectiveIsDraft ? true : undefined),
      origin: raw.origin || (effectiveIsDraft ? 'draft' : undefined),
      stage: raw.stage || (effectiveIsDraft ? 'draft' : undefined),
    };
  }, []);

  // If the highlight already exists in the DOM but the restored element `id` doesn't match it,
  // relink the element to the DOM highlight id (this is what makes the rail anchor work again).
  const relinkElementIdFromDOM = useCallback((el) => {
    const root = pagesContainerRef.current;
    if (!root || !el?.id) return el;

    const type = el.type === 'suggestededit' ? 'suggestededit' :
      el.type === 'reference' ? 'reference' : 'comment';
    const attrName = type === 'comment' ? 'data-comment-id' :
      type === 'suggestededit' ? 'data-suggestededit-id' : 'data-reference-id';

    // If an anchor exists for this element id, it's already linked.
    if (root.querySelector(`[${attrName}="${el.id}"]`)) return el;

    // Otherwise, try to match by selectedText against existing highlight spans.
    const needle = (el.selectedText || el.highlightedText || '').trim();
    if (!needle) return el;

    const candidates = Array.from(root.querySelectorAll(`[${attrName}]`));
    for (const node of candidates) {
      const nodeText = (node.textContent || '').trim();
      if (nodeText && nodeText === needle) {
        const domId = node.getAttribute(attrName);
        if (domId) return { ...el, id: String(domId) };
      }
    }
    return el;
  }, [pagesContainerRef]);

  const triggerBeforeAction = useCallback(() => {
    const container = pagesContainerRef.current;
    if (container) {
      container.dispatchEvent(new CustomEvent("editor-before-action", { bubbles: true }));
    }
  }, [pagesContainerRef]);

  // Resolve comment (marks as resolved, retains in state, document DOM highlight, and side rail history)
  const resolveComment = useCallback((elementId) => {
    triggerBeforeAction();
    freshlyResolvedIdsRef.current.add(elementId);
    setFloatingElements(prevElements => {
      if (!prevElements || prevElements.length === 0) return prevElements;
      const updatedElements = prevElements.map(el => {
        if (el.id === elementId) {
          return { ...el, status: 'resolved' };
        }
        return el;
      });

      setTimeout(() => {
        if (onContentChange && typeof onContentChange === 'function') {
          onContentChange({
            action: 'update_element_status',
            elementType: 'comment',
            elementId: elementId,
            status: 'resolved',
            allElements: updatedElements
          });
        }

        if (onCommentsChange) {
          const updatedComments = updatedElements.filter(el => el.type === 'comment');
          onCommentsChange(updatedComments);
        }
      }, 0);

      return updatedElements;
    });

    // Mark DOM highlight with data-comment-status="resolved" and class comment-resolved
    const root = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
    const highlights = root?.querySelectorAll(`[data-comment-id="${elementId}"]`);
    highlights?.forEach(highlight => {
      highlight.setAttribute('data-comment-status', 'resolved');
      highlight.classList.add('comment-resolved');
    });

    socket.emit("updateCommentStatus", { templateId: docId, commentId: elementId, status: 'resolved' });
  }, [triggerBeforeAction, onContentChange, onCommentsChange, pagesContainerRef, docId]);

  // Delete floating element
  const deleteFloatingElement = useCallback((elementId, elementType) => {
    triggerBeforeAction();
    deletedElementIdsRef.current.add(elementId);
    if (elementType === 'suggestededit') {
      const wrapper = document.querySelector(`[data-suggestededit-id="${elementId}"]`);
      const suggestedEdit = floatingElementsRef.current.find(edit => edit.id === elementId);

      if (wrapper && suggestedEdit) {
        const restoreText = suggestedEdit.status === 'pending'
          ? (suggestedEdit.selectedText || wrapper.textContent)
          : wrapper.textContent;

        const del = wrapper.querySelector('del');
        if (suggestedEdit.status === 'pending' && del) {
          while (del.firstChild) {
            wrapper.parentNode.insertBefore(del.firstChild, wrapper);
          }
          wrapper.parentNode.removeChild(wrapper);
        } else {
          const parent = wrapper.parentNode;
          if (parent) {
            while (wrapper.firstChild) {
              parent.insertBefore(wrapper.firstChild, wrapper);
            }
            parent.removeChild(wrapper);
          }
        }

      }
    }

    // Use functional update to avoid stale closure issues
    setFloatingElements(prevElements => {
      // Safety check - ensure we're not filtering an empty array
      if (!prevElements || prevElements.length === 0) {
        return prevElements;
      }

      // Check if the element actually exists before filtering
      const elementExists = prevElements.some(el => el.id === elementId);
      if (!elementExists) {
        return prevElements;
      }

      const updatedElements = prevElements.filter(el => el.id !== elementId);

      // Deferred parent callback to avoid race conditions
      setTimeout(() => {
        if (onContentChange && typeof onContentChange === 'function') {
          onContentChange({
            action: 'remove_element',
            elementType: elementType,
            elementId: elementId,
            allElements: updatedElements
          });
        }

        // NEW: Trigger instant save callback
        if (elementType === 'comment' && onCommentsChange) {
          const updatedComments = updatedElements.filter(el => el.type === 'comment');
          onCommentsChange(updatedComments);
        } else if (elementType === 'suggestededit' && onSuggestionsChange) {
          const updatedSuggestions = updatedElements.filter(el => el.type === 'suggestededit');
          onSuggestionsChange(updatedSuggestions);
        } else if (elementType === 'reference' && onReferencesChange) {
          const updatedReferences = updatedElements.filter(el => el.type === 'reference');
          onReferencesChange(updatedReferences);
        }
      }, 0);

      return updatedElements;
    });

    const selector = elementType === 'comment'
      ? `[data-comment-id="${elementId}"]`
      : elementType === 'suggestededit'
        ? `[data-suggestededit-id="${elementId}"]`
        : `[data-reference-id="${elementId}"]`;

    const container = pagesContainerRef.current;
    const highlights = container
      ? container.querySelectorAll(selector)
      : document.querySelectorAll(selector);

    highlights?.forEach(highlight => {
      // For references, remove the superscript citation first
      if (elementType === 'reference') {
        const sups = highlight.querySelectorAll('sup.reference-number');
        sups.forEach(sup => sup.remove());
      }

      const parent = highlight.parentNode;
      if (parent) {
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
        try {
          parent.normalize();
        } catch {}
      }
    });

    if (elementType === 'comment') {
      socket.emit("removeTemplateComment", { templateId: docId, commentId: elementId });
    } else if (elementType === 'suggestededit') {
      socket.emit("removeTemplateSuggestion", { templateId: docId, suggestionId: elementId });
    } else if (elementType === 'reference') {
      // Emit reference removal to keep collaboration in sync
      socket.emit("removeTemplateReference", { templateId: docId, referenceId: elementId });
    }

    if (pagesContainerRef.current) {
      const updatedContent = pagesContainerRef.current.innerHTML;
      socket.emit("textChange", { docId: docId, content: updatedContent });
    }
  }, [pagesContainerRef, onContentChange, onCommentsChange, onSuggestionsChange, onReferencesChange, docId]);

  // Track which elements have been processed from props
  // This MUST be declared BEFORE the mount effect to prevent duplication
  // when loading drafts that already have highlighted HTML content
  const processedPropsElementIdsRef = useRef(new Set());

  // Track IDs of elements that were DELETED via backspace/orphan cleanup.
  // These must NEVER be re-added from props or reconstructed.
  const deletedElementIdsRef = useRef(new Set());

  // Update ref when state changes
  useEffect(() => {
    floatingElementsRef.current = floatingElements;
  }, [floatingElements]);
  useEffect(() => {
    railWidthRef.current = railWidth;
  }, [railWidth]);

  // Initialize floatingElements with comments and suggestions from props
  // FIX: Also update when props change (e.g., when draft loads after mount)
  // This enables hover functionality by ensuring floatingElements is populated
  useEffect(() => {
    // Clear deleted/processed flags if an element is restored/present via props (e.g. undo)
    const incomingIds = new Set([
      ...comments.map(c => String(c.id || c._id || '')),
      ...suggestions.map(s => String(s.id || s._id || '')),
      ...references.map(r => String(r.id || r._id || ''))
    ].filter(Boolean));

    for (const id of deletedElementIdsRef.current) {
      if (incomingIds.has(id)) {
        deletedElementIdsRef.current.delete(id);
        processedPropsElementIdsRef.current.delete(id);
      }
    }

    const propsElements = [
      ...comments.map(c => normalizeElement(c, 'comment')),
      ...suggestions.map(s => normalizeElement(s, 'suggestededit')),
      ...references.map(r => normalizeElement(r, 'reference'))
    ]
      .filter(Boolean)
      .map(relinkElementIdFromDOM)
      .filter(el => !deletedElementIdsRef.current.has(el.id));

    // Get serialized structures to compare
    const currentSerialized = JSON.stringify(floatingElementsRef.current.map(el => ({
      id: el.id,
      status: el.status,
      refNumber: el.refNumber,
      repliesCount: el.replies?.length,
      text: el.text
    })));
    
    const propsSerialized = JSON.stringify(propsElements.map(el => ({
      id: el.id,
      status: el.status,
      refNumber: el.refNumber,
      repliesCount: el.replies?.length,
      text: el.text
    })));

    if (currentSerialized !== propsSerialized) {
      setFloatingElements(propsElements);
    }

    // Ensure DOM attribute status sync for existing resolved comments/suggestions without touching styling
    const domRoot = pagesContainerRef.current || (typeof document !== 'undefined' ? document : null);
    if (domRoot) {
      propsElements.forEach(el => {
        if (el.type === 'comment' && (el.status === 'resolved' || el.status === 'done')) {
          const spans = domRoot.querySelectorAll(`[data-comment-id="${el.id}"]`);
          spans.forEach(span => {
            span.setAttribute('data-comment-status', 'resolved');
            span.classList.add('comment-resolved');
          });
        } else if (el.type === 'suggestededit' && (el.status === 'approved' || el.status === 'declined' || el.status === 'accepted' || el.status === 'rejected' || el.status === 'resolved')) {
          const spans = domRoot.querySelectorAll(`[data-suggestededit-id="${el.id}"], [data-suggestion-id="${el.id}"]`);
          spans.forEach(span => {
            span.setAttribute('data-suggestion-status', el.status);
            span.classList.add('suggestion-resolved');
          });
        }
      });
    }
  }, [comments, suggestions, references, normalizeElement, relinkElementIdFromDOM, isDraft]);

  // manage reference numbers on mount and reference change
  useEffect(() => {
    if (pagesContainerRef.current) {
      recomputeReferenceNumbers(pagesContainerRef.current, references, onReferencesChange);
    }
  }, [pagesContainerRef, references, onReferencesChange]);

  // Manage comments-active and toc-collapsed classes for optimal space usage
  useEffect(() => {
    const updateClasses = () => {
      const contentContainer = document.querySelector('.content-container');
      const documentRenderer = document.querySelector('.document-renderer');
      const isCommentsVisible = floatingElements.length > 0 || isCommenting || isSuggestingEdit;
      const isTOCCollapsed = documentRenderer && documentRenderer.classList.contains('toc-collapsed');

      if (contentContainer) {
        if (isCommentsVisible) {
          contentContainer.classList.add('comments-active');
        } else {
          contentContainer.classList.remove('comments-active');
        }

        if (isTOCCollapsed) {
          contentContainer.classList.add('toc-collapsed');
        } else {
          contentContainer.classList.remove('toc-collapsed');
        }
      }
    };

    updateClasses();

    // Also update when TOC classes change (with a small delay for DOM updates)
    const timer = setTimeout(updateClasses, 100);
    return () => clearTimeout(timer);
  }, [floatingElements.length, isCommenting, isSuggestingEdit]);

  // Helper function to create proper user display name from user data
  const getUserDisplayName = useCallback((userData) => {
    if (!userData) return "Anonymous";
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (userData.firstName) return userData.firstName;
    if (userData.lastName) return userData.lastName;
    if (userData.email) return userData.email;
    return "Anonymous";
  }, []);

  // Helper functions for Google Docs-like UI
  const getPageFromSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let n = sel.getRangeAt(0).commonAncestorContainer;
    if (n.nodeType === Node.TEXT_NODE) n = n.parentNode;
    return n?.closest?.('.page') || null;
  };

  const recomputeRail = useCallback((rangeRectOverride = null, immediate = false) => {
    if (window.isResizingTable) return;
    // 1. Debounce/Throttle: Use snappy timing (16ms ~ 1 frame) for real-time feel
    if (recomputeRailTimerRef.current) {
      clearTimeout(recomputeRailTimerRef.current);
    }

    const runUpdate = () => {
      // Do nothing while typing/clicking inside the rail
      const ae = document.activeElement;
      if (ae && (ae.closest?.('.doc-rail') || ae.closest?.('.selection-pill'))) {
        return;
      }

      const root = pagesContainerRef.current;
      if (!root) return;

      const pageEl = getPageFromSelection() || root.querySelector('.page');
      if (!pageEl) return;

      const rootRect = root.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();

      if (pageRect.width === 0) return;

      // 2. Cache All Anchor Positions in one pass (O(N) vs O(N^2))
      // IMPORTANT: Do NOT wipe the cache if anchors are temporarily missing during reflow.
      const newAnchorCache = new Map(anchorPositionCacheRef.current);

      // OPTIMIZATION: Use a single query selector for all highlights instead of looping
      const anchors = root.querySelectorAll('[data-comment-id], [data-suggestededit-id]');
      anchors.forEach(anchor => {
        const id = anchor.getAttribute('data-comment-id') || anchor.getAttribute('data-suggestededit-id');
        if (id) {
          const rect = anchor.getBoundingClientRect();
          newAnchorCache.set(id, rect.top - rootRect.top + root.scrollTop);
        }
      });
      anchorPositionCacheRef.current = newAnchorCache;

      // 3. Cache Page Metrics in one pass
      const pages = Array.from(root.querySelectorAll('.page'));
      pageMetricsCacheRef.current = pages.map((p, idx) => {
        const r = p.getBoundingClientRect();
        return {
          index: idx,
          top: r.top - rootRect.top + root.scrollTop,
          height: r.height
        };
      });

      const rightOffset = 15;
      const maxAllowedWidth = Math.max(330, Math.min(600, Math.floor(rootRect.width * 0.5)));
      const minAllowedWidth = 150;

      const finalWidth = Math.min(
        maxAllowedWidth,
        Math.max(minAllowedWidth, railWidthRef.current || 330)
      );

      const rootParent = root.closest('.review-editor-wrapper') || root.closest('.template-container') || root.closest('.preview-editor-wrapper') || root.closest('.create-editor-wrapper') || root.parentElement;
      const topOffsetInParent = rootParent ? (root.getBoundingClientRect().top - rootParent.getBoundingClientRect().top) : 0;

      const newMetrics = {
        right: rightOffset,
        width: finalWidth,
        top: topOffsetInParent
      };

      setRailMetrics(prev => {
        if (
          Math.abs((prev.right || 0) - newMetrics.right) < 1 &&
          Math.abs(prev.width - newMetrics.width) < 1 &&
          Math.abs(prev.top - newMetrics.top) < 1
        ) {
          return prev;
        }
        return newMetrics;
      });

      setRailUpdateKey(k => k + 1);

      // Pill positioning
      const sel = window.getSelection();
      const anchor = sel?.anchorNode;
      const anchorEl = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
      const focus = sel?.focusNode;
      const focusEl = focus?.nodeType === Node.ELEMENT_NODE ? focus : focus?.parentElement;
      const isLockedElement = anchorEl?.closest?.('[data-locked="true"], .locked-text')
        || focusEl?.closest?.('[data-locked="true"], .locked-text');
      if (!sel || sel.rangeCount === 0 || (sel.isCollapsed && !isLockedElement)) {
        setPillPos(p => ({ ...p, show: false }));
        return;
      }

      let r = rangeRectOverride || sel.getRangeAt(0).getBoundingClientRect();
      if ((!r || (r.width === 0 && r.height === 0)) && isLockedElement) {
        r = isLockedElement.getBoundingClientRect();
      }
      if (!r || (r.width === 0 && r.height === 0)) {
        setPillPos(p => ({ ...p, show: false }));
        return;
      }

      const parent = root.parentElement || root;
      const parentRect = parent.getBoundingClientRect();

      setPillPos({
        top: (r.top + r.height / 2) - parentRect.top + parent.scrollTop - 20,
        left: pageRect.right - parentRect.left + parent.scrollLeft - 20,
        show: true
      });
    };

    if (immediate) {
      runUpdate();
    } else {
      // Use a short delay to batch multiple rapid changes (typing)
      recomputeRailTimerRef.current = setTimeout(runUpdate, 16);
    }
  }, [pagesContainerRef, floatingElements, isCommenting, isSuggestingEdit, commentPosition, suggestEditPosition, commentText, suggestEditText]);

  const handleRailResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = {
      startX: e.clientX,
      startWidth: railWidthRef.current
    };
    setIsRailResizing(true);
  }, []);

  useEffect(() => {
    if (!isRailResizing) return undefined;

    const handlePointerMove = (e) => {
      const resizeState = resizeStateRef.current;
      const root = pagesContainerRef.current;
      if (!resizeState || !root) return;

      const deltaX = resizeState.startX - e.clientX;
      const rootRect = root.getBoundingClientRect();

      // Use consistent boundaries with recomputeRail
      const maxAllowedWidth = Math.max(330, Math.min(600, Math.floor(rootRect.width * 0.5)));
      const nextWidth = Math.max(150, Math.min(maxAllowedWidth, resizeState.startWidth + deltaX));

      setRailWidth(nextWidth);
      setRailMetrics((prev) => ({ ...prev, width: nextWidth }));
      setRailUpdateKey((k) => k + 1);
    };

    const handlePointerUp = () => {
      setIsRailResizing(false);
      // Persist the final width to localStorage
      if (railWidthRef.current) {
        localStorage.setItem(`rail-width-${docId}`, railWidthRef.current.toString());
      }
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isRailResizing, pagesContainerRef]);

  // Store the selected range when making a comment or suggestion
  const storeSelectedRange = useCallback(() => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      // Validate the range and selected text
      if (!selectedText || selectedText.length === 0) {
        return false;
      }

      // Check if the range is within editable content
      const pageContent = range.commonAncestorContainer.closest ?
        range.commonAncestorContainer.closest('.page-content') :
        range.commonAncestorContainer.parentNode?.closest?.('.page-content');

      if (!pageContent) {
        return false;
      }

      selectedRangeRef.current = range.cloneRange();
      selectedRangeOffsetsRef.current = getRangeBlockOffsets(range);
      return true;
    }
    return false;
  }, []);

  // Apply highlights to the document
  const applyHighlight = useCallback((range, id, type, text, status, meta = {}) => {
    applyHighlightUtil({ range, id, type, text, status, ...meta, pagesContainerRef });
  }, [pagesContainerRef]);

  // Element creation and actions delegated to useElementCreation hook
  const {
    addFloatingElement,
    handleAddComment,
    handleAddSuggestEdit,
    handleAddReference,
    handleSubmitComment,
    handleSubmitSuggestEdit,
    cancelFloatingElement,
    approveSuggestedEdit,
    declineSuggestedEdit
  } = useElementCreation({
    user,
    userRole,
    docId,
    effectiveIsDraft,
    pagesContainerRef,
    triggerBeforeAction,
    processedPropsElementIdsRef,
    sessionCreatedIds,
    freshlyResolvedIdsRef,
    selectedRangeRef,
    selectedRangeOffsetsRef,
    floatingElementsRef,
    setFloatingElements,
    onContentChange,
    onCommentsChange,
    onSuggestionsChange,
    onReferencesChange,
    references,
    getUserDisplayName,
    applyHighlight,
    storeSelectedRange,
    getPageFromSelection,
    getRangeBlockOffsets,
    setCommentPosition,
    setIsCommenting,
    setShowFloatingButton,
    setActiveRailTab,
    setCommentText,
    setSuggestEditPosition,
    setIsSuggestingEdit,
    setSuggestEditText,
    commentText,
    commentPosition,
    suggestEditText,
    suggestEditPosition,
    deleteFloatingElement
  });

  // Reply actions delegated to useReplyActions hook
  const { replyComment, replySuggestedEdit, deleteReply } = useReplyActions({
    triggerBeforeAction,
    replyText,
    setReplyText,
    setActiveReplyId,
    getUserDisplayName,
    docId,
    setFloatingElements,
    floatingElementsRef,
    onCommentsChange,
    onSuggestionsChange
  });


  // Handle floating element click
  const handleFloatingElementClick = useCallback((elementId, elementType) => {
    setActiveItemId(elementId);
  }, []);

  // Toggle reply input field for a specific comment or suggestion
  const toggleReply = useCallback((elementId) => {
    if (activeReplyId === elementId) {
      // Close if already open
      setActiveReplyId(null);
      setReplyText("");
    } else {
      // Open for this element
      setActiveReplyId(elementId);
      setReplyText("");
    }
  }, [activeReplyId]);


  // Handle mouse enter (hover) on rail card - highlights corresponding editor text
  const handleFloatingElementEnter = useCallback((elementId, elementType, e) => {
    // Add emphasis class to corresponding highlighted text in editor
    const attribute = elementType === 'comment' ? 'data-comment-id' : 'data-suggestededit-id';
    const highlightedElements = pagesContainerRef.current?.querySelectorAll(`[${attribute}="${elementId}"]`);

    highlightedElements?.forEach(element => {
      element.classList.add('editor-highlight-hovered');
    });

    // No longer call onCommentFocus to avoid scroll jumps
  }, [pagesContainerRef]);

  // Handle mouse leave from rail card - removes editor text emphasis
  const handleFloatingElementLeave = useCallback((e) => {
    // Remove emphasis class from all highlighted text
    const allHighlightedElements = pagesContainerRef.current?.querySelectorAll('.editor-highlight-hovered');
    allHighlightedElements?.forEach(element => {
      element.classList.remove('editor-highlight-hovered');
    });

    // No longer call onCommentFocus to avoid scroll jumps
  }, [pagesContainerRef]);

  // Reconstruct highlights on other clients
  const reconstructHighlight = useCallback((element, type) => {
    reconstructHighlightUtil({
      element,
      type,
      pagesContainerRef,
      applyHighlightFn: applyHighlight
    });
  }, [applyHighlight, pagesContainerRef]);

  // Debounced selection change for floating toolbar
  const handleSelectionChange = useCallback(() => {
    // If focus is inside the rail, ignore selection changes
    const ae = document.activeElement;
    if (ae && (ae.closest?.('.doc-rail') || ae.closest?.('.selection-pill'))) {
      return;
    }
    const root = pagesContainerRef.current;
    const selection = window.getSelection();
    if (!root || !selection) {
      setShowFloatingButton(false);
      return;
    }

    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }

    // Debounce to wait until user finishes selecting (mouseup)
    selectionTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setShowFloatingButton(false);
        return;
      }

      const range = sel.getRangeAt(0);
      let containerNode = range.commonAncestorContainer;
      if (containerNode.nodeType === Node.TEXT_NODE) containerNode = containerNode.parentNode;

      // Only show if selection is within a page content (exclude header/footer)
      const inPageContent = containerNode?.closest?.('.page-content');
      const inHeader = containerNode?.closest?.('.page-header');
      const inFooter = containerNode?.closest?.('.page-footer');
      if (!inPageContent || inHeader || inFooter) {
        setShowFloatingButton(false);
        return;
      }

      const rect = range.getBoundingClientRect();
      const editorRect = root.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        setShowFloatingButton(false);
        return;
      }

      const parent = root.parentElement || root;
      const parentRect = parent.getBoundingClientRect();
      setFloatingButtonPosition({
        top: rect.bottom - parentRect.top + parent.scrollTop + 6,
        left: rect.left - parentRect.left + parent.scrollLeft,
      });
      setShowFloatingButton(true);
    }, 120);
  }, [pagesContainerRef]);

  // Handle selection change events with new Google Docs-like UI
  useEffect(() => {
    const onSel = () => { recomputeRail(); handleSelectionChange(); };
    const onScroll = () => { recomputeRail(); };
    const onResize = () => { recomputeRail(); };

    const scrollEl = getEditorScrollContainer(pagesContainerRef.current);

    document.addEventListener('selectionchange', onSel);
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // Add ResizeObserver to detect page size changes
    let resizeObserver = null;
    if (window.ResizeObserver && pagesContainerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded" error
        window.requestAnimationFrame(() => {
          recomputeRail(null, true);
        });
      });
      resizeObserver.observe(pagesContainerRef.current);
    }

    // initial
    recomputeRail(null, true);
    // Additional checks to ensure rail is positioned after layout settles
    setTimeout(() => recomputeRail(null, true), 100);
    setTimeout(() => recomputeRail(null, true), 300);
    setTimeout(() => recomputeRail(null, true), 1000);

    return () => {
      document.removeEventListener('selectionchange', onSel);
      scrollEl?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [handleSelectionChange, pagesContainerRef]);

  // Use a ref to track which elements have been processed from props
  // This persists across re-renders and prevents duplicate reconstruction
  // NOTE: processedPropsElementIdsRef is now declared earlier to prevent duplication

  // Load comments and suggestions from props and reconstruct highlights
  useEffect(() => {

    if (!pagesContainerRef.current) {
      return;
    }

    // Merge props into state if not already loaded (normalize + relink to existing DOM highlights)
    const allPropsElements = [
      ...comments.map(c => normalizeElement(c, 'comment')),
      ...suggestions.map(s => normalizeElement(s, 'suggestededit'))
    ]
      .filter(Boolean)
      .map(relinkElementIdFromDOM);

    if (allPropsElements.length > 0) {
      // Filter to only NEW elements that haven't been processed before AND not deleted
      const unprocessedElements = allPropsElements.filter(el =>
        !processedPropsElementIdsRef.current.has(el.id) &&
        !deletedElementIdsRef.current.has(el.id)
      );

      if (unprocessedElements.length === 0) {
        return;
      }

      // Suppress orphan check immediately during highlight reconstruction
      suppressOrphanCheckRef.current = true;

      // Mark all as processed BEFORE doing anything to prevent race conditions
      unprocessedElements.forEach(el => processedPropsElementIdsRef.current.add(el.id));

      setFloatingElements(prev => {
        // Only add elements that don't already exist in state
        const existingIds = new Set(prev.map(el => el.id));
        const newElements = unprocessedElements.filter(el => !existingIds.has(el.id));

        if (newElements.length === 0) {
          return prev;
        }

        return [...prev, ...newElements];
      });

      // Reconstruct highlights for ONLY the unprocessed elements
      // Delay to ensure DOM is fully ready
      setTimeout(() => {

        unprocessedElements.forEach(element => {
          const type = element.type === 'suggestededit' ? 'suggestededit' : 'comment';
          const dataAttr = type === 'comment' ? 'data-comment-id' : 'data-suggestededit-id';

          // Skip highlight reconstruction for resolved suggestions.
          // Their DOM span was intentionally removed when accepted/rejected;
          // trying to re-create it would corrupt the document text.
          if (type === 'suggestededit' && (element.status === 'approved' || element.status === 'declined')) {
            return;
          }

          // Final safety check: Skip if highlight already exists in DOM
          const existingInDOM = pagesContainerRef.current?.querySelector(`[${dataAttr}="${element.id}"]`);
          if (existingInDOM) {
            return;
          }

          reconstructHighlight(element, type);
        });

        // Recompute rail after highlights are added to ensure correct positioning
        recomputeRail();

        // Mark initial load complete and allow orphan checks
        suppressOrphanCheckRef.current = false;
      }, 500);
    }
  }, [comments, suggestions, pagesContainerRef, reconstructHighlight, recomputeRail, normalizeElement, relinkElementIdFromDOM]);

  // Socket event handlers for real-time collaboration hook
  useCommentSocketListeners({
    user,
    getUserDisplayName,
    processedPropsElementIdsRef,
    deletedElementIdsRef,
    pagesContainerRef,
    setFloatingElements,
    reconstructHighlight
  });

  // Auto-remove orphaned comments/suggestions observer hook
  const { suppressOrphanCheckRef, checkForOrphanedElements } = useCommentOrphanObserver({
    pagesContainerRef,
    setFloatingElements,
    deletedElementIdsRef,
    onContentChange,
    onCommentsChange,
    onSuggestionsChange,
    onReferencesChange,
    docId
  });

  // Keep rail positions in sync with editor DOM mutations (Enter, pagination reflow, edits).
  // The old working system effectively did this continuously (measure highlight rects and reposition).
  // Without this, highlights can move while the rail cache stays stale until a scroll/selection event.
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
      if (window.isResizingTable) return;
      // Ignore while programmatic DOM changes are in flight (pagination/render).
      if (suppressOrphanCheckRef.current) return;

      const relevant = mutations.some((m) =>
        m.type === 'childList' ||
        m.type === 'characterData' ||
        (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class'))
      );
      if (!relevant) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        recomputeRail();
      }, 32);
    });

    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pagesContainerRef, recomputeRail]);

  // Optimized Event Delegation for Highlights (mouseenter/mouseleave/click/dblclick) hook
  useHighlightInteractions({
    pagesContainerRef,
    references,
    triggerTabFlash,
    setReferencePreview,
    activeRailTabRef
  });

  // Strike Popup and action management hook
  const {
    acceptBackspaceStrike,
    rejectBackspaceStrike,
    hideBackspaceStrikePopup
  } = useStrikeManager({
    pagesContainerRef,
    canActOnStrike,
    triggerBeforeAction,
    setStrikePopupState,
    docId
  });

  // Handle dynamic rail re-calculation when document layout shifts (e.g. typing/pasting)
  const [railUpdateKey, setRailUpdateKey] = useState(0);

  useEffect(() => {
    if (!pagesContainerRef.current) return;

    // Observer to detect when document content shifts (pagination, entering text, etc.)
    const observer = new ResizeObserver(() => {
      recomputeRail(null, true);
    });

    observer.observe(pagesContainerRef.current);

    // Also observe the individual pages if they exist
    const pages = pagesContainerRef.current?.querySelectorAll('.page') || [];
    pages.forEach(p => observer.observe(p));

    return () => observer.disconnect();
  }, [pagesContainerRef, recomputeRail]);


  // Handle clicks to hide floating button when clicking elsewhere
  const handleEditorClick = useCallback((e) => {
    // Don't hide if clicking on the rail or pill
    if (e.target.closest(".doc-rail") || e.target.closest(".selection-pill")) {
      return;
    }

    // Don't hide if clicking on the toolbar itself
    if (!e.target.closest(".quick-access-toolbar")) {
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) {
        setShowFloatingButton(false);
        setPillPos(prev => ({ ...prev, show: false }));
      }
    }
  }, []);
  const documentRenderer = document.querySelector('.document-renderer');
  const isTOCCollapsed = documentRenderer && documentRenderer.classList.contains('toc-collapsed');
  const itemRefs = useRef(new Map());
  const railRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const spacerRef = useRef(null);

  // Rail items calculation and page-relative collision avoidance hook
  const { items, pageGroups } = useRailLayout({
    pagesContainerRef,
    railRef,
    effectiveIsDraft,
    activeRailTab,
    floatingElements,
    isCommenting,
    isSuggestingEdit,
    commentPosition,
    suggestEditPosition,
    commentText,
    suggestEditText,
    pageMetricsCacheRef,
    anchorPositionCacheRef,
    railUpdateKey,
    railMetrics,
    itemRefs,
    composerTextareaRef
  });

  const system = {
    // State
    isDraft: effectiveIsDraft,
    isRevise,
    floatingElements,
    isCommenting,
    isSuggestingEdit,
    commentText,
    suggestEditText,
    commentPosition,
    suggestEditPosition,
    activeItemId,
    activeReplyId,
    replyText,
    showFloatingButton,
    floatingButtonPosition,
    showFloatingElements,
    pillPos,
    railMetrics,
    railUpdateKey,
    isRailResizing,
    activeRailTab,
    flashingTab,
    manualSwitchTab,

    // Setters
    setCommentText,
    setSuggestEditText,
    setActiveReplyId,
    setReplyText,
    setActiveItemId,
    setActiveRailTab,
    handleManualTabSwitch,
    triggerTabFlash,
    toggleReply: (id) => setActiveReplyId(prev => prev === id ? null : id),

    // Handlers
    handleAddComment,
    handleAddSuggestEdit,
    handleAddReference,
    handleSubmitComment,
    handleSubmitSuggestEdit,
    cancelFloatingElement,
    approveSuggestedEdit,
    declineSuggestedEdit,
    replyComment,
    replySuggestedEdit,
    deleteReply,
    deleteFloatingElement,
    resolveComment,
    freshlyResolvedIdsRef,
    canApproveOrRejectItem,
    handleFloatingElementClick,
    handleFloatingElementEnter,
    handleFloatingElementLeave,
    handleEditorClick,
    handleSelectionChange,
    recomputeRail,
    handleRailResizeStart,
    strikePopupState,
    strikePopupRef,
    acceptBackspaceStrike,
    rejectBackspaceStrike,
    hideBackspaceStrikePopup,

    // Refs/Props
    pagesContainerRef,
    user,
    userRole,
    enableReplies,
    handleMakeEditable,
    hideLockInFloatingToolbar,
    hideSuggestInFloatingToolbar,
    commentContext: {
      template_approvers: props.templateApprovers || props.template_approvers || props.approvers,
      reviewers: props.reviewers || props.templateApprovers?.reviewers || props.template_approvers?.reviewers
    }
  };
  return {
    ...system,
    railRef,
    isTOCCollapsed,
    railMetrics,
    pageGroups,
    itemRefs,
    items,
    composerTextareaRef,
    FloatingToolbar: FloatingToolbarComponent,
    ReferencePreview: ReferencePreviewComponent,
    StrikePopup: StrikePopupComponent,
    RailComposer: RailComposerComponent,
    RightRail: RightRailComponent
  };
};


export const CommentCoreComponent = (props) => {
  const system = useCommentCore(props);
  const { RightRail } = system;

  return <RightRail system={system} />;
};

export default CommentCoreComponent;
