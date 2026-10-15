import { useCallback, useEffect } from "react";
import { socket } from "../../../../utils/SocketProvider";

export const useStrikeManager = ({
  pagesContainerRef,
  canActOnStrike,
  triggerBeforeAction,
  setStrikePopupState,
  docId
}) => {
  // Strike Popup Selection Logic
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        setStrikePopupState(prev => ({ ...prev, show: false }));
        return;
      }

      // Ensure all edit spans have a unique data-edit-id
      container.querySelectorAll('.admin-edit, .reviewer-edit').forEach(el => {
        if (!el.getAttribute('data-edit-id')) {
          el.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        }
      });

      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        setStrikePopupState(prev => ({ ...prev, show: false }));
        return;
      }

      // Handle range selection
      const allStrikes = container.querySelectorAll('[data-backspace-strike-id], [data-edit-id]');
      const intersectedStrikes = Array.from(allStrikes).filter(el => range.intersectsNode(el));

      if (intersectedStrikes.length > 0) {
        const rect = range.getBoundingClientRect();
        showPopupForStrikes(intersectedStrikes, rect);
      } else {
        setStrikePopupState(prev => ({ ...prev, show: false }));
      }
    };

    const showPopupForStrikes = (strikeEls, boundsRect) => {
      const actionableStrikes = strikeEls.filter(canActOnStrike);
      if (!actionableStrikes.length) {
        setStrikePopupState(prev => ({ ...prev, show: false, strikeIds: [] }));
        return;
      }

      const parent = container.parentElement || container;
      const parentRect = parent.getBoundingClientRect();
      const strikeIds = actionableStrikes.map(el => el.getAttribute('data-backspace-strike-id') || el.getAttribute('data-edit-id'));

      // Use the first element's email as representative
      const email = actionableStrikes[0].getAttribute('data-user-email') || actionableStrikes[0].closest('[data-user-email]')?.getAttribute('data-user-email');

      const popupWidth = 160; // Slightly wider for bulk
      const popupHeight = email ? 52 : 32;

      // Position above the selection/element bounds
      const left = Math.max(8, Math.min(parent.clientWidth - popupWidth - 8, boundsRect.left - parentRect.left + parent.scrollLeft + (boundsRect.width / 2) - (popupWidth / 2)));
      const top = Math.max(8, boundsRect.top - parentRect.top + parent.scrollTop - popupHeight - 8);

      setStrikePopupState({
        show: true,
        strikeIds,
        top,
        left,
        email: email || 'Reviewer'
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [canActOnStrike, pagesContainerRef, setStrikePopupState]);

  const acceptBackspaceStrike = useCallback((strikeIds) => {
    if (!strikeIds || !strikeIds.length) return;
    triggerBeforeAction();
    const container = pagesContainerRef.current;

    const allowedStrikeIds = strikeIds.filter(id => {
      const strikeEl = container?.querySelector(`[data-backspace-strike-id="${id}"], [data-edit-id="${id}"]`);
      return canActOnStrike(strikeEl);
    });

    allowedStrikeIds.forEach(id => {
      const strikeEl = container?.querySelector(`[data-backspace-strike-id="${id}"], [data-edit-id="${id}"]`);
      if (strikeEl) {
        if (strikeEl.hasAttribute('data-backspace-strike-id')) {
          strikeEl.remove();
        } else {
          // It's an insertion: accept means unwrap (keep the text, remove span wrapper)
          const textNode = document.createTextNode(strikeEl.textContent || '');
          strikeEl.parentNode.replaceChild(textNode, strikeEl);
        }
      }
    });

    setStrikePopupState(prev => ({ ...prev, show: false, strikeIds: [] }));

    if (container) {
      socket.emit("textChange", { docId: docId, content: container.innerHTML });
    }
  }, [canActOnStrike, pagesContainerRef, triggerBeforeAction, setStrikePopupState, docId]);

  const rejectBackspaceStrike = useCallback((strikeIds) => {
    if (!strikeIds || !strikeIds.length) return;
    triggerBeforeAction();
    const container = pagesContainerRef.current;

    const allowedStrikeIds = strikeIds.filter(id => {
      const strikeEl = container?.querySelector(`[data-backspace-strike-id="${id}"], [data-edit-id="${id}"]`);
      return canActOnStrike(strikeEl);
    });

    const sel = window.getSelection();
    const hasActiveRange = sel && sel.rangeCount && !sel.isCollapsed;
    const range = hasActiveRange ? sel.getRangeAt(0) : null;

    // Find all intersected deletion strikes
    const intersectedStrikes = allowedStrikeIds.map(id => 
      container?.querySelector(`[data-backspace-strike-id="${id}"]`)
    ).filter(Boolean);

    // Find all intersected insertion edits
    const intersectedEdits = allowedStrikeIds.map(id =>
      container?.querySelector(`[data-edit-id="${id}"]`)
    ).filter(Boolean);

    // For deletions, reject means restore the text (unwrap)
    intersectedStrikes.forEach(strikeEl => {
      if (strikeEl.parentNode) {
        const textNode = document.createTextNode(strikeEl.textContent || '');
        strikeEl.parentNode.replaceChild(textNode, strikeEl);
      }
    });

    // For insertions, reject means delete the inserted text.
    // If the selection range intersects the insertion, we delete the selected contents.
    if (intersectedEdits.length > 0) {
      if (range) {
        range.deleteContents();
      } else {
        // Fallback: if no active range selection, remove the entire spans
        intersectedEdits.forEach(editEl => editEl.remove());
      }
      // Clean up any empty edit spans
      intersectedEdits.forEach(editEl => {
        if (editEl.parentNode && editEl.textContent.trim() === '') {
          editEl.remove();
        }
      });
    }

    setStrikePopupState(prev => ({ ...prev, show: false, strikeIds: [] }));

    if (container) {
      // Dispatch input event to notify the editor's synchronization and autosave lifecycle
      container.dispatchEvent(new Event('input', { bubbles: true }));
      socket.emit("textChange", { docId: docId, content: container.innerHTML });
    }
  }, [canActOnStrike, pagesContainerRef, triggerBeforeAction, setStrikePopupState, docId]);

  const hideBackspaceStrikePopup = useCallback(() => {
    setStrikePopupState(prev => ({ ...prev, show: false, strikeId: null }));
  }, [setStrikePopupState]);

  return {
    acceptBackspaceStrike,
    rejectBackspaceStrike,
    hideBackspaceStrikePopup
  };
};
