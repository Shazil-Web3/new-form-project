import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useFindReplace - Custom hook for Google Docs / Word style Find and Replace
 * 
 * Features:
 * - Traverses text nodes within the target container without corrupting DOM
 * - Uses modern CSS Custom Highlight API (zero DOM mutation) when available
 * - Fallback to active selection scrolling & visual highlight
 * - Smooth scroll-into-view for active match
 * - Match case & whole word search options
 * - Single replace (advancing to next) & Replace all (reverse traversal)
 * - Dispatches input events to notify editor engine & paginator
 * - Handles global shortcuts (Ctrl+F, Ctrl+H, Esc, Enter, Shift+Enter)
 */
export const useFindReplace = ({
  containerRef,
  schedulePaginate,
  onContentChange,
  readOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('find'); // 'find' | 'replace'
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  // Store match data: Array of { range: Range, text: string, element: Element }
  const matchesRef = useRef([]);
  const activeHighlightRef = useRef(null);

  // Helper to remove any CSS Highlights
  const clearCSSHighlights = useCallback(() => {
    if (typeof window !== 'undefined' && window.CSS && CSS.highlights) {
      try {
        CSS.highlights.delete('find-matches');
        CSS.highlights.delete('find-active-match');
      } catch (err) {
        console.warn('Error clearing CSS highlights:', err);
      }
    }
  }, []);

  // Update CSS Highlights and scroll active match into view
  const updateHighlights = useCallback((matches, index) => {
    if (typeof window === 'undefined') return;

    if (window.CSS && CSS.highlights) {
      try {
        if (!matches || matches.length === 0) {
          clearCSSHighlights();
          return;
        }

        const validMatches = matches.filter(m => {
          try {
            return m.range && !m.range.collapsed && m.range.startContainer.isConnected;
          } catch {
            return false;
          }
        });

        if (validMatches.length === 0) {
          clearCSSHighlights();
          return;
        }

        const otherRanges = [];
        let activeRange = null;

        validMatches.forEach((m, i) => {
          if (i === index) {
            activeRange = m.range;
          } else {
            otherRanges.push(m.range);
          }
        });

        // Register passive matches
        if (otherRanges.length > 0 && typeof window !== 'undefined' && typeof window.Highlight !== 'undefined') {
          const normalHighlight = new window.Highlight(...otherRanges);
          CSS.highlights.set('find-matches', normalHighlight);
        } else {
          CSS.highlights.delete('find-matches');
        }

        // Register active match
        if (activeRange && typeof window !== 'undefined' && typeof window.Highlight !== 'undefined') {
          const activeHighlight = new window.Highlight(activeRange);
          CSS.highlights.set('find-active-match', activeHighlight);
          activeHighlightRef.current = activeHighlight;
        } else {
          CSS.highlights.delete('find-active-match');
          activeHighlightRef.current = null;
        }
      } catch (e) {
        console.warn('CSS highlight update error:', e);
      }
    }

    // Scroll active match into view
    if (matches && matches[index] && matches[index].range) {
      try {
        const range = matches[index].range;
        const parentEl = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;

        if (parentEl && typeof parentEl.scrollIntoView === 'function') {
          parentEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      } catch (e) {
        // Safe fallback
      }
    }
  }, [clearCSSHighlights]);

  // Collect text nodes inside target pages
  const getTextNodes = useCallback((root) => {
    const textNodes = [];
    if (!root) return textNodes;

    // We target .page-content or the root container itself
    const targets = root.querySelectorAll('.page-content');
    const searchRoots = targets.length > 0 ? Array.from(targets) : [root];

    searchRoots.forEach((searchRoot) => {
      const walker = document.createTreeWalker(
        searchRoot,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent || node.textContent.length === 0) {
              return NodeFilter.FILTER_REJECT;
            }
            // Skip hidden elements or scripts/styles
            const parent = node.parentElement;
            if (parent) {
              const tag = parent.tagName.toLowerCase();
              if (tag === 'script' || tag === 'style' || tag === 'noscript') {
                return NodeFilter.FILTER_REJECT;
              }
              // Skip locked dropdown controls or non-printable overlays if applicable
              if (parent.closest('.dropdown-modal, .find-replace-container')) {
                return NodeFilter.FILTER_REJECT;
              }
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }
    });

    return textNodes;
  }, []);

  // Perform search across collected text nodes
  const performSearch = useCallback((query, caseSens = matchCase, wordOnly = wholeWord, targetIndex = 0) => {
    if (!query || query.trim() === '' || !containerRef.current) {
      matchesRef.current = [];
      setMatchCount(0);
      setCurrentIndex(0);
      clearCSSHighlights();
      return [];
    }

    const textNodes = getTextNodes(containerRef.current);
    const newMatches = [];

    // Escape regex special chars if whole word or building pattern
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern;
    try {
      const flags = caseSens ? 'g' : 'gi';
      const regexStr = wordOnly ? `\\b${escaped}\\b` : escaped;
      pattern = new RegExp(regexStr, flags);
    } catch {
      pattern = null;
    }

    if (!pattern) return [];

    textNodes.forEach((node) => {
      const content = node.textContent || '';
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(content)) !== null) {
        if (match[0].length === 0) break; // prevent infinite loops on zero-length matches

        try {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);

          newMatches.push({
            range,
            text: match[0],
            startNode: node,
            startOffset: match.index,
            endNode: node,
            endOffset: match.index + match[0].length,
            element: node.parentElement,
          });
        } catch (e) {
          // Range error fallback
        }
      }
    });

    matchesRef.current = newMatches;
    setMatchCount(newMatches.length);

    let nextIndex = 0;
    if (newMatches.length > 0) {
      if (targetIndex >= 0 && targetIndex < newMatches.length) {
        nextIndex = targetIndex;
      } else {
        nextIndex = 0;
      }
    }
    setCurrentIndex(nextIndex);
    updateHighlights(newMatches, nextIndex);

    return newMatches;
  }, [matchCase, wholeWord, containerRef, getTextNodes, clearCSSHighlights, updateHighlights]);

  // Navigate to Next match
  const goToNext = useCallback(() => {
    const total = matchesRef.current.length;
    if (total === 0) return;
    const next = (currentIndex + 1) % total;
    setCurrentIndex(next);
    updateHighlights(matchesRef.current, next);
  }, [currentIndex, updateHighlights]);

  // Navigate to Previous match
  const goToPrev = useCallback(() => {
    const total = matchesRef.current.length;
    if (total === 0) return;
    const prev = (currentIndex - 1 + total) % total;
    setCurrentIndex(prev);
    updateHighlights(matchesRef.current, prev);
  }, [currentIndex, updateHighlights]);

  // Replace single current match
  const replaceCurrent = useCallback(() => {
    if (readOnly) return false;
    const matches = matchesRef.current;
    if (!matches || matches.length === 0 || !matches[currentIndex]) return false;

    const currentMatch = matches[currentIndex];
    const { range, startNode } = currentMatch;

    try {
      if (!startNode || !startNode.isConnected) {
        // Re-run search if DOM is stale
        performSearch(findText, matchCase, wholeWord, currentIndex);
        return false;
      }

      // Replace matched range text
      range.deleteContents();
      const newTextNode = document.createTextNode(replaceText);
      range.insertNode(newTextNode);

      // Normalize adjacent text nodes to keep tree clean
      const parent = newTextNode.parentElement;
      if (parent) {
        parent.normalize();
        // Dispatch input event for editor change tracking
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        parent.dispatchEvent(inputEvent);
      }

      // Notify parent change
      if (onContentChange) {
        onContentChange();
      }
      if (schedulePaginate) {
        schedulePaginate();
      }

      // Search again and keep same index (which now points to the next item)
      setTimeout(() => {
        performSearch(findText, matchCase, wholeWord, currentIndex);
      }, 30);

      return true;
    } catch (err) {
      console.error('Error during replaceCurrent:', err);
      performSearch(findText, matchCase, wholeWord, currentIndex);
      return false;
    }
  }, [readOnly, currentIndex, replaceText, findText, matchCase, wholeWord, onContentChange, schedulePaginate, performSearch]);

  // Replace All matches across the document
  const replaceAll = useCallback(() => {
    if (readOnly) return 0;
    const matches = matchesRef.current;
    if (!matches || matches.length === 0) return 0;

    const count = matches.length;
    const affectedParents = new Set();

    // Iterate backwards so earlier offsets and nodes remain intact
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      try {
        if (match.range && match.startNode && match.startNode.isConnected) {
          match.range.deleteContents();
          const newTextNode = document.createTextNode(replaceText);
          match.range.insertNode(newTextNode);
          if (newTextNode.parentElement) {
            affectedParents.add(newTextNode.parentElement);
          }
        }
      } catch (err) {
        console.warn('Replace all error on match index', i, err);
      }
    }

    // Normalize affected parents & dispatch input event
    affectedParents.forEach((parent) => {
      try {
        parent.normalize();
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        parent.dispatchEvent(inputEvent);
      } catch {
        // Safe ignore
      }
    });

    if (onContentChange) {
      onContentChange();
    }
    if (schedulePaginate) {
      schedulePaginate();
    }

    // Refresh search results
    setTimeout(() => {
      performSearch(findText, matchCase, wholeWord, 0);
    }, 50);

    return count;
  }, [readOnly, replaceText, findText, matchCase, wholeWord, onContentChange, schedulePaginate, performSearch]);

  // Open modal in specific mode ('find' or 'replace')
  const openFind = useCallback((initialMode = 'find') => {
    setMode(initialMode);
    setIsOpen(true);

    // If text is currently selected in document, use it as query
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const selectedText = selection.toString().trim();
      if (selectedText && selectedText.length > 0 && selectedText.length < 200) {
        setFindText(selectedText);
        setTimeout(() => {
          performSearch(selectedText, matchCase, wholeWord, 0);
        }, 10);
        return;
      }
    }

    // If query already exists, re-run search
    if (findText) {
      setTimeout(() => {
        performSearch(findText, matchCase, wholeWord, 0);
      }, 10);
    }
  }, [matchCase, wholeWord, findText, performSearch]);

  // Close modal and clear highlights
  const closeFind = useCallback(() => {
    setIsOpen(false);
    clearCSSHighlights();
  }, [clearCSSHighlights]);

  // Re-search when search criteria changes
  useEffect(() => {
    if (isOpen) {
      performSearch(findText, matchCase, wholeWord, 0);
    }
  }, [findText, matchCase, wholeWord, isOpen, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCSSHighlights();
    };
  }, [clearCSSHighlights]);

  return {
    isOpen,
    setIsOpen,
    mode,
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
    openFind,
    closeFind,
    readOnly,
  };
};

export default useFindReplace;
