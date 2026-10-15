import React, { useRef, useEffect, useState, useCallback } from 'react';
import '../styles/FindReplace.css';

/**
 * FindReplaceModal
 * 
 * Floating Google Docs / Microsoft Word style Find & Replace component.
 * - Always shows both "Find" and "Replace" tabs.
 * - Stays fixed on screen so scrolling through document pages NEVER moves it.
 * - Supports dragging anywhere across the screen.
 * - Live match counter, previous/next navigation, match case, whole word.
 * - Single Replace and Replace All actions.
 */
const FindReplaceModal = ({
  isOpen,
  onClose,
  mode = 'find',
  setMode,
  findText,
  setFindText,
  replaceText,
  setReplaceText,
  matchCase,
  setMatchCase,
  wholeWord,
  setWholeWord,
  currentIndex,
  matchCount,
  goToNext,
  goToPrev,
  replaceCurrent,
  replaceAll,
  readOnly = false,
}) => {
  const findInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [feedback, setFeedback] = useState('');

  // Fixed position coordinates (defaults to docked under the toolbar)
  const [position, setPosition] = useState({ top: 105, right: 32 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startTop: 105, startRight: 32 });

  // Compute docked position right below the editor toolbar
  const dockUnderToolbar = useCallback(() => {
    const toolbarEl = document.querySelector('.editor-toolbar');
    if (toolbarEl) {
      const rect = toolbarEl.getBoundingClientRect();
      setPosition((prev) => ({
        ...prev,
        top: Math.max(16, Math.round(rect.bottom + 8)),
        right: 32,
      }));
    }
  }, []);

  // When opened, dock under toolbar and auto-focus the active input
  useEffect(() => {
    if (isOpen) {
      dockUnderToolbar();
      setTimeout(() => {
        if (mode === 'replace') {
          replaceInputRef.current?.focus();
        } else {
          findInputRef.current?.focus();
          findInputRef.current?.select();
        }
      }, 50);
    } else {
      setFeedback('');
    }
  }, [isOpen, dockUnderToolbar, mode]);

  // Window resize handler to maintain valid positioning
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        dockUnderToolbar();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, dockUnderToolbar]);

  // Dragging logic so user can move it anywhere
  const handleMouseDown = (e) => {
    // Only drag from the header tabs area, not when clicking buttons or inputs
    if (e.target.closest('button, input, a')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startTop: position.top,
      startRight: position.right,
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      setPosition({
        top: Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.startTop + dy)),
        right: Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.startRight - dx)),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Keyboard navigation inside find input
  const handleFindKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrev();
      } else {
        goToNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Keyboard handling inside replace input
  const handleReplaceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleReplaceClick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleReplaceClick = () => {
    if (matchCount === 0) return;
    const success = replaceCurrent();
    if (success) {
      setFeedback('Replaced');
      setTimeout(() => setFeedback(''), 1500);
    }
  };

  const handleReplaceAllClick = () => {
    if (matchCount === 0) return;
    const replaced = replaceAll();
    if (replaced > 0) {
      setFeedback(`Replaced ${replaced} matches`);
      setTimeout(() => setFeedback(''), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="find-replace-container"
      role="dialog"
      aria-label="Find and Replace"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      {/* Top Tab Bar: Draggable Header with Find & Replace Mode Switchers */}
      <div className="find-replace-tabs" onMouseDown={handleMouseDown}>
        <div className="find-replace-tab-group">
          <button
            type="button"
            className={`find-replace-tab-btn ${mode === 'find' ? 'active' : ''}`}
            onClick={() => {
              setMode('find');
              findInputRef.current?.focus();
            }}
          >
            <i className="bi bi-search" style={{ fontSize: '11px' }} />
            Find
          </button>
          <button
            type="button"
            className={`find-replace-tab-btn ${mode === 'replace' ? 'active' : ''}`}
            onClick={() => {
              setMode('replace');
              setTimeout(() => replaceInputRef.current?.focus(), 50);
            }}
          >
            <i className="bi bi-arrow-repeat" style={{ fontSize: '12px' }} />
            Replace
          </button>
        </div>
        <button
          type="button"
          className="find-replace-close-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {/* Main Body */}
      <div className="find-replace-body">
        {/* Find Input Row */}
        <div className="find-replace-row">
          <div className="find-replace-input-wrapper">
            <i className="bi bi-search find-replace-input-icon" />
            <input
              ref={findInputRef}
              type="text"
              className="find-replace-input"
              placeholder="Find in document..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={handleFindKeyDown}
              aria-label="Find text"
            />
          </div>

          {/* Match Counter Badge */}
          {findText && (
            <span
              className={`find-replace-counter ${
                matchCount > 0 ? 'has-matches' : 'no-matches'
              }`}
            >
              {matchCount > 0 ? `${currentIndex + 1} / ${matchCount}` : '0 of 0'}
            </span>
          )}

          {/* Previous & Next Navigation Buttons */}
          <button
            type="button"
            className="find-replace-nav-btn"
            onClick={goToPrev}
            disabled={matchCount === 0}
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
          >
            <i className="bi bi-chevron-up" />
          </button>
          <button
            type="button"
            className="find-replace-nav-btn"
            onClick={goToNext}
            disabled={matchCount === 0}
            title="Next match (Enter)"
            aria-label="Next match"
          >
            <i className="bi bi-chevron-down" />
          </button>

          {/* Quick Toggle to Replace Mode */}
          <button
            type="button"
            className={`find-replace-nav-btn ${mode === 'replace' ? 'active-mode' : ''}`}
            onClick={() => {
              const nextMode = mode === 'find' ? 'replace' : 'find';
              setMode(nextMode);
              if (nextMode === 'replace') {
                setTimeout(() => replaceInputRef.current?.focus(), 50);
              } else {
                setTimeout(() => findInputRef.current?.focus(), 50);
              }
            }}
            title={mode === 'find' ? "Expand to Replace (Ctrl+H)" : "Switch to Find"}
            aria-label="Toggle Replace Mode"
          >
            <i className="bi bi-arrow-repeat" />
          </button>
        </div>

        {/* Replace Input Row (Visible in Replace mode) */}
        {mode === 'replace' && (
          <div className="find-replace-row">
            <div className="find-replace-input-wrapper">
              <i className="bi bi-pencil find-replace-input-icon" />
              <input
                ref={replaceInputRef}
                type="text"
                className="find-replace-input"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={handleReplaceKeyDown}
                aria-label="Replace text"
              />
            </div>
          </div>
        )}

        {/* Shortcut Hint */}
        <div className="find-replace-options-row">
          <span className="find-replace-shortcut-hint">
            {mode === 'find' ? 'Press Enter to find next' : 'Press Enter to replace'}
          </span>
        </div>

        {/* Action Buttons for Replace Mode */}
        {mode === 'replace' && (
          <div className="find-replace-actions">
            {feedback && <span className="find-replace-feedback">{feedback}</span>}
            <button
              type="button"
              className="find-replace-action-btn find-replace-btn-secondary"
              onClick={handleReplaceClick}
              disabled={matchCount === 0 || readOnly}
              title="Replace current match"
            >
              Replace
            </button>
            <button
              type="button"
              className="find-replace-action-btn find-replace-btn-primary"
              onClick={handleReplaceAllClick}
              disabled={matchCount === 0 || readOnly}
              title="Replace all matches"
            >
              Replace all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindReplaceModal;
