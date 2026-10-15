import React from "react";

const FloatingToolbarComponent = ({ system }) => {
  const { pillPos, handleAddComment, handleAddSuggestEdit, handleAddReference, handleMakeEditable, isDraft, isRevise, hideLockInFloatingToolbar, hideSuggestInFloatingToolbar, user, userRole } = system;
  const effectiveIsDraft = isRevise ? false : Boolean(isDraft);

  if (!pillPos.show) return null;

  const rawRole = userRole ?? user?.role ?? '';
  const normalizedRole = String(rawRole).trim().toLowerCase();
  const isAdminRole = normalizedRole === 'admin' || normalizedRole === '1';

  // Check if active selection or anchor is currently inside/intersecting locked text
  const isSelectionCurrentlyLocked = () => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);

      const anchor = sel.anchorNode;
      const anchorEl = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
      if (anchorEl?.closest?.('[data-locked="true"], .locked-text')) return true;

      const focus = sel.focusNode;
      const focusEl = focus?.nodeType === Node.ELEMENT_NODE ? focus : focus?.parentElement;
      if (focusEl?.closest?.('[data-locked="true"], .locked-text')) return true;

      const common = range.commonAncestorContainer;
      const commonEl = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
      if (commonEl?.closest?.('[data-locked="true"], .locked-text')) return true;

      if (commonEl) {
        const lockedDescendants = commonEl.querySelectorAll('[data-locked="true"], .locked-text');
        for (const locked of lockedDescendants) {
          try {
            if (range.intersectsNode(locked)) return true;
          } catch {}
        }
      }
    } catch {}
    return false;
  };

  // Check if locked text in selection is owned by the current user
  const isLockedByMe = () => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      const currentUserId = String(user?.id || user?._id || system?.currentUser?.id || system?.currentUser?._id || '').trim();
      const currentEmail = (user?.email || system?.currentUser?.email || '').trim().toLowerCase();

      const anchor = sel.anchorNode;
      const anchorEl = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
      const focus = sel.focusNode;
      const focusEl = focus?.nodeType === Node.ELEMENT_NODE ? focus : focus?.parentElement;
      const common = range.commonAncestorContainer;
      const commonEl = common?.nodeType === Node.ELEMENT_NODE ? common : common?.parentElement;

      const candidateLockedSpans = [];

      const enclosingLocked = anchorEl?.closest?.('[data-locked="true"], .locked-text')
        || focusEl?.closest?.('[data-locked="true"], .locked-text')
        || commonEl?.closest?.('[data-locked="true"], .locked-text');
      if (enclosingLocked) candidateLockedSpans.push(enclosingLocked);

      if (commonEl) {
        const lockedDescendants = commonEl.querySelectorAll('[data-locked="true"], .locked-text');
        for (const locked of lockedDescendants) {
          try {
            if (range.intersectsNode(locked)) {
              candidateLockedSpans.push(locked);
            }
          } catch {}
        }
      }

      if (candidateLockedSpans.length === 0) return false;

      return candidateLockedSpans.some(span => {
        const lockedBy = (span.getAttribute('data-locked-by') || '').trim();
        const lockedByEmail = (span.getAttribute('data-locked-by-email') || '').trim().toLowerCase();
        const ownerId = (span.getAttribute('data-owner-id') || '').trim();
        const ownerEmail = (span.getAttribute('data-user-email') || '').trim().toLowerCase();

        const isLockedByMatch = (currentUserId && lockedBy && currentUserId !== 'undefined' && lockedBy === currentUserId) ||
                                (currentEmail && lockedByEmail && currentEmail !== 'unknown' && lockedByEmail === currentEmail);
        if (isLockedByMatch) return true;

        const isOwnerMatch = (currentUserId && ownerId && currentUserId !== 'undefined' && ownerId === currentUserId) ||
                             (currentEmail && ownerEmail && currentEmail !== 'unknown' && ownerEmail === currentEmail);
        return isOwnerMatch;
      });
    } catch {}
    return false;
  };

  const isLocked = isSelectionCurrentlyLocked();
  const isMine = isLockedByMe();

  let lockTitle = isLocked ? "Unlock text" : "Lock text";
  let lockDisabled = false;

  if (!isAdminRole) {
    if (isLocked) {
      if (!isMine) {
        lockTitle = "Locked by another user (cannot unlock)";
        lockDisabled = true;
      } else {
        lockTitle = "Unlock your text";
      }
    } else {
      lockTitle = "Lock your text";
    }
  }

  return (
    <div
      className="selection-pill"
      data-ui-element="true"
      contentEditable="false"
      style={{
        top: pillPos.top,
        left: pillPos.left,
        flexDirection: 'column',
        padding: '6px 4px',
        borderRadius: '20px',
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        type="button"
        title="Comment"
        style={{ padding: '8px', marginBottom: '2px', borderRadius: '50%' }}
        onClick={(e) => {
          e.stopPropagation();
          handleAddComment();
        }}
      >
        <i className="bi bi-chat-left-text" style={{ fontSize: '16px' }}></i>
      </button>
      {!effectiveIsDraft && !hideSuggestInFloatingToolbar && (
        <button
          type="button"
          title="Suggest edit"
          style={{ padding: '8px', marginBottom: '2px', borderRadius: '50%' }}
          onClick={(e) => {
            e.stopPropagation();
            handleAddSuggestEdit();
          }}
        >
          <i className="bi bi-pencil-square" style={{ fontSize: '16px' }}></i>
        </button>
      )}
      <button
        type="button"
        title="Add Reference"
        style={{ padding: '8px', marginBottom: '2px', borderRadius: '50%' }}
        onClick={(e) => {
          e.stopPropagation();
          handleAddReference();
        }}
      >
        <i className="bi bi-book" style={{ fontSize: '16px' }}></i>
      </button>
      {handleMakeEditable && !hideLockInFloatingToolbar && (
        <button
          type="button"
          title={lockTitle}
          style={{ 
            padding: '8px', 
            borderRadius: '50%',
            backgroundColor: isLocked ? (lockDisabled ? '#f1f3f4' : '#e8f0fe') : 'transparent',
            color: isLocked ? (lockDisabled ? '#9aa0a6' : '#1a73e8') : 'inherit',
            cursor: lockDisabled ? 'not-allowed' : 'pointer'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (lockDisabled) return;
            const sel = window.getSelection();
            const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
            handleMakeEditable(range);
          }}
        >
          <i className={isLocked ? (lockDisabled ? "bi bi-lock-fill" : "bi bi-unlock-fill") : "bi bi-lock"} style={{ fontSize: '16px' }}></i>
        </button>
      )}
    </div>
  );
};


export default FloatingToolbarComponent;
export { FloatingToolbarComponent };
