import { useState, useEffect, useCallback } from 'react';
import {
  isSuperscriptActive,
  isSubscriptActive,
  toggleSuperscript,
  toggleSubscript,
  handleSuperscriptSubscriptKeyDown,
} from '../utils/superscriptSubscript';

/**
 * useSuperscriptSubscript
 *
 * Custom React hook for tracking and controlling Microsoft Word-style
 * superscript and subscript formatting.
 *
 * @param {Object} [options]
 * @param {Function} [options.onBeforeAction]
 * @param {Function} [options.onAfterAction]
 * @param {Function} [options.syncDOMToBlocksSync]
 * @param {Function} [options.schedulePaginate]
 * @param {boolean} [options.enableKeyboardShortcuts=false]
 * @param {boolean} [options.readOnly=false]
 */
export function useSuperscriptSubscript(options = {}) {
  const {
    onBeforeAction,
    onAfterAction,
    syncDOMToBlocksSync,
    schedulePaginate,
    enableKeyboardShortcuts = false,
    readOnly = false,
  } = options;

  const [state, setState] = useState({
    isSuperscript: false,
    isSubscript: false,
  });

  const checkState = useCallback(() => {
    const sel = window.getSelection();
    const isSuper = isSuperscriptActive(sel);
    const isSub = isSubscriptActive(sel);

    setState((prev) => {
      if (prev.isSuperscript === isSuper && prev.isSubscript === isSub) {
        return prev;
      }
      return { isSuperscript: isSuper, isSubscript: isSub };
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', checkState);
    window.addEventListener('keyup', checkState);
    window.addEventListener('mouseup', checkState);

    return () => {
      document.removeEventListener('selectionchange', checkState);
      window.removeEventListener('keyup', checkState);
      window.removeEventListener('mouseup', checkState);
    };
  }, [checkState]);

  // Optional keyboard shortcut listener
  useEffect(() => {
    if (!enableKeyboardShortcuts || readOnly) return;

    const onKeyDown = (e) => {
      const handled = handleSuperscriptSubscriptKeyDown(e, {
        onBeforeAction,
        onAfterAction,
        syncDOMToBlocksSync,
        schedulePaginate,
      });
      if (handled) {
        checkState();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [
    enableKeyboardShortcuts,
    readOnly,
    onBeforeAction,
    onAfterAction,
    syncDOMToBlocksSync,
    schedulePaginate,
    checkState,
  ]);

  const handleToggleSuperscript = useCallback(() => {
    if (readOnly) return;
    toggleSuperscript({
      onBeforeAction,
      onAfterAction,
      syncDOMToBlocksSync,
      schedulePaginate,
    });
    checkState();
  }, [readOnly, onBeforeAction, onAfterAction, syncDOMToBlocksSync, schedulePaginate, checkState]);

  const handleToggleSubscript = useCallback(() => {
    if (readOnly) return;
    toggleSubscript({
      onBeforeAction,
      onAfterAction,
      syncDOMToBlocksSync,
      schedulePaginate,
    });
    checkState();
  }, [readOnly, onBeforeAction, onAfterAction, syncDOMToBlocksSync, schedulePaginate, checkState]);

  return {
    isSuperscript: state.isSuperscript,
    isSubscript: state.isSubscript,
    toggleSuperscript: handleToggleSuperscript,
    toggleSubscript: handleToggleSubscript,
    refreshState: checkState,
  };
}

export default useSuperscriptSubscript;
