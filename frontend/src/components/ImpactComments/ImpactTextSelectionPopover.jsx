import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useImpactComments } from './ImpactCommentContext';

/**
 * Extract selected text along with any filled blanks/fields within the selection range.
 */
function extractSelectionDetails(containerEl) {
  if (!containerEl) return null;

  // 1. Check if user selected text inside an active textarea or input
  const activeEl = document.activeElement;
  if (
    activeEl &&
    containerEl.contains(activeEl) &&
    (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
  ) {
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      const selectedVal = activeEl.value.substring(start, end).trim();
      if (selectedVal.length > 0) {
        const rect = activeEl.getBoundingClientRect();
        const fieldIdx = activeEl.getAttribute('data-field-index') ?? activeEl.getAttribute('aria-label') ?? '';
        const fieldIdxNum = parseInt(String(fieldIdx).replace(/\D/g, ''), 10);
        const fieldName =
          activeEl.getAttribute('data-field-name') ||
          (!isNaN(fieldIdxNum) ? `Field ${fieldIdxNum + 1}` : 'Field');

        return {
          text: selectedVal,
          selectedText: selectedVal,
          isField: true,
          fieldIndex: fieldIdx,
          fieldName,
          fieldValue: selectedVal,
          fullFieldValue: activeEl.value,
          fields: [
            {
              fieldIndex: fieldIdx,
              fieldName,
              fieldValue: selectedVal,
            },
          ],
          rect: {
            top: rect.top,
            left: rect.left + rect.width / 2,
          },
          context: `${fieldName}: "${activeEl.value}"`,
        };
      }
    }
  }

  // 2. Check standard DOM selection
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  // Verify range intersects the container
  const containsAnchor = containerEl.contains(selection.anchorNode);
  const containsFocus = containerEl.contains(selection.focusNode);
  let intersectsContainer = false;
  try {
    intersectsContainer =
      containsAnchor ||
      containsFocus ||
      (typeof range.intersectsNode === 'function' && range.intersectsNode(containerEl));
  } catch (e) {
    intersectsContainer = containsAnchor || containsFocus;
  }
  if (!intersectsContainer) return null;

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;

  // Check all field wrappers inside containerEl to see if any intersect range
  const allFieldWrappers = Array.from(
    containerEl.querySelectorAll('[data-field-wrapper="true"]')
  );
  const intersectingFieldWrappers = [];

  allFieldWrappers.forEach((fw) => {
    try {
      if (typeof range.intersectsNode === 'function' && range.intersectsNode(fw)) {
        intersectingFieldWrappers.push(fw);
      }
    } catch (e) {}
  });

  // If NO fields are intersected, return standard text selection
  if (intersectingFieldWrappers.length === 0) {
    const rawText = selection.toString().trim();
    if (!rawText) return null;
    return {
      text: rawText,
      selectedText: rawText,
      isField: false,
      fieldIndex: null,
      fieldName: null,
      fieldValue: null,
      fields: [],
      rect: {
        top: rect.top,
        left: rect.left + rect.width / 2,
      },
      context: selection.anchorNode?.parentElement?.innerText?.substring(0, 100) || '',
    };
  }

  // If fields ARE intersected, traverse containerEl in document order to assemble text + field values
  const parts = [];
  const capturedFields = [];

  const nodeIterator = document.createNodeIterator(
    containerEl,
    NodeFilter.SHOW_ALL,
    (node) => {
      // Reject hidden sizers
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList &&
        node.classList.contains('impact-blank-sizer')
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  );

  let currNode;
  while ((currNode = nodeIterator.nextNode())) {
    let doesIntersect = false;
    try {
      doesIntersect =
        typeof range.intersectsNode === 'function' ? range.intersectsNode(currNode) : false;
    } catch (e) {
      continue;
    }
    if (!doesIntersect) continue;

    // If it's a field wrapper:
    if (
      currNode.nodeType === Node.ELEMENT_NODE &&
      currNode.getAttribute('data-field-wrapper') === 'true'
    ) {
      const fIdx = currNode.getAttribute('data-field-index') || '';
      const fIdxNum = parseInt(String(fIdx).replace(/\D/g, ''), 10);
      const fName =
        currNode.getAttribute('data-field-name') ||
        (!isNaN(fIdxNum) ? `Field ${fIdxNum + 1}` : 'Field');

      const inputOrTextarea = currNode.querySelector('textarea, input, select');
      const fVal =
        (inputOrTextarea ? inputOrTextarea.value : currNode.getAttribute('data-field-value')) || '';

      const fieldObj = {
        fieldIndex: fIdx,
        fieldName: fName,
        fieldValue: fVal,
      };
      capturedFields.push(fieldObj);
      parts.push({
        type: 'field',
        ...fieldObj,
        text: `[${fName}: ${fVal || '(empty)'}]`,
      });
      continue;
    }

    // Skip children inside a field wrapper
    if (currNode.parentElement && currNode.parentElement.closest('[data-field-wrapper="true"]')) {
      continue;
    }

    // If it's a text node:
    if (currNode.nodeType === Node.TEXT_NODE) {
      const textVal = currNode.textContent;
      if (!textVal) continue;

      let start = 0;
      let end = textVal.length;

      if (currNode === range.startContainer) {
        start = range.startOffset;
      }
      if (currNode === range.endContainer) {
        end = range.endOffset;
      }

      if (start < end) {
        const sub = textVal.substring(start, end);
        if (sub) {
          parts.push({
            type: 'text',
            text: sub,
          });
        }
      }
    }
  }

  const compositeText = parts.map((p) => p.text).join('').trim();
  const rawSelectionText = selection.toString().trim();
  const displayText = compositeText || rawSelectionText;
  if (!displayText) return null;

  const isOnlyField = parts.length === 1 && parts[0].type === 'field';

  return {
    text: displayText,
    selectedText: displayText,
    isField: isOnlyField,
    fieldIndex: isOnlyField ? capturedFields[0]?.fieldIndex : (capturedFields[0]?.fieldIndex ?? null),
    fieldName: isOnlyField ? capturedFields[0]?.fieldName : (capturedFields[0]?.fieldName ?? null),
    fieldValue: isOnlyField ? capturedFields[0]?.fieldValue : null,
    fields: capturedFields,
    parts,
    rect: {
      top: rect.top,
      left: rect.left + rect.width / 2,
    },
    context: displayText.substring(0, 120),
  };
}

export default function ImpactTextSelectionPopover({ containerRef }) {
  const {
    isComposerOpen,
    setIsComposerOpen,
    setSelectionState,
  } = useImpactComments();

  const [popoverPos, setPopoverPos] = useState(null);
  const popoverRef = useRef(null);

  const checkSelection = useCallback(() => {
    if (isComposerOpen) return;

    if (!containerRef?.current) {
      setPopoverPos(null);
      return;
    }

    const details = extractSelectionDetails(containerRef.current);
    if (details && details.text) {
      setPopoverPos(details);
    } else {
      setPopoverPos(null);
    }
  }, [containerRef, isComposerOpen]);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(checkSelection, 30);
    };

    const handleKeyUp = (e) => {
      if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        setTimeout(checkSelection, 30);
      }
    };

    const handleMouseDown = (e) => {
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      if (!isComposerOpen) {
        setPopoverPos(null);
      }
    };

    const doc = document;
    doc.addEventListener('mouseup', handleMouseUp);
    doc.addEventListener('keyup', handleKeyUp);
    doc.addEventListener('mousedown', handleMouseDown);

    return () => {
      doc.removeEventListener('mouseup', handleMouseUp);
      doc.removeEventListener('keyup', handleKeyUp);
      doc.removeEventListener('mousedown', handleMouseDown);
    };
  }, [checkSelection, isComposerOpen]);

  const handleOpenComposer = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!popoverPos) return;

    setSelectionState({
      text: popoverPos.text,
      context: popoverPos.context,
      fieldIndex: popoverPos.fieldIndex,
      isField: popoverPos.isField,
      fieldName: popoverPos.fieldName,
      fieldValue: popoverPos.fieldValue,
      fields: popoverPos.fields || [],
      rect: {
        top: popoverPos.rect?.top || 100,
        left: popoverPos.rect?.left || 200,
      },
    });
    setIsComposerOpen(true);
    setPopoverPos(null);
  };

  if (!popoverPos || isComposerOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="impact-selection-pill"
      style={{
        top: `${Math.max(20, popoverPos.rect.top)}px`,
        left: `${Math.min(window.innerWidth - 60, Math.max(60, popoverPos.rect.left))}px`,
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={handleOpenComposer}
      role="button"
      tabIndex={0}
      title={popoverPos.isField ? `Comment on ${popoverPos.fieldName}` : 'Add comment on selected text'}
    >
      <span className="pill-icon">💬</span>
      <span>{popoverPos.isField ? `Comment on ${popoverPos.fieldName}` : 'Comment'}</span>
    </div>
  );
}
