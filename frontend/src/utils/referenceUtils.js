/**
 * Reference System Utilities
 * 
 * Contains helpers for chronologically scanning the editor DOM,
 * updating superscript citation numbers, and synchronizing references.
 */

/**
 * Scans the editor DOM container, finds all reference citations in order of appearance,
 * updates their superscript labels in the DOM, and returns a synchronized references list.
 * 
 * @param {HTMLElement} container - The editor scroll/pages container
 * @param {Array} currentReferences - Current list of references in state
 * @param {Function} onSyncReferences - Callback to synchronize updated references state
 * @returns {Array} The updated references list
 */
export const recomputeReferenceNumbers = (container, currentReferences = [], onSyncReferences) => {
  if (!container) return [];

  // Guard: if the DOM has not yet loaded the editor blocks (e.g., during mount or tab switch),
  // do not recompute or sync references yet to prevent state destruction.
  if (!container.querySelector('[data-block-id]')) {
    return currentReferences;
  }

  // Find all citation wrappers in order of appearance in DOM across all pages
  const allPages = Array.from(container.querySelectorAll('.page'));
  const citationSpans = [];
  
  allPages.forEach(page => {
    const pageContent = page.querySelector('.page-content');
    if (pageContent) {
      citationSpans.push(...Array.from(pageContent.querySelectorAll('span.reference-citation-wrapper')));
    }
  });

  // 1. Group spans by reference ID and identify order of appearance in DOM
  const linkedRefIdsInDOMOrder = [];
  const spanGroups = new Map(); // Map<refId, HTMLElement[]>

  citationSpans.forEach(span => {
    const refId = span.getAttribute('data-reference-id');
    if (!refId) return;

    if (!spanGroups.has(refId)) {
      spanGroups.set(refId, []);
      linkedRefIdsInDOMOrder.push(refId);
    }
    spanGroups.get(refId).push(span);
  });

  // 2. Build final synchronized list based on DOM order first, then manual ones
  const finalReferences = [];
  const processedIds = new Set();
  let counter = 0;

  // A. Linked references in order of appearance in the document
  linkedRefIdsInDOMOrder.forEach((refId) => {
    const existing = currentReferences.find(r => r.id === refId || r.refAnchor === refId);
    counter++;

    let refData;
    if (existing) {
      refData = { ...existing };
    } else {
      // Fallback: extract the text from the first DOM element for this ID
      const spans = spanGroups.get(refId);
      const extractedText = spans && spans.length > 0 
        ? spans[0].textContent.replace(/\[\d+\]$/, '').trim() 
        : 'Linked Reference';

      refData = {
        id: refId,
        refAnchor: refId,
        refText: extractedText,
        refContent: '',
        timestamp: new Date().toISOString(),
        type: 'reference'
      };
    }

    refData.refNumber = counter;
    finalReferences.push(refData);
    processedIds.add(refId);
  });

  // B. Manual references (those NOT linked in DOM)
  currentReferences.forEach(ref => {
    if (ref && ref.id && !processedIds.has(ref.id)) {
      if (ref.isManual) {
        // Explicitly manual references from the tab button - NO numbering
        finalReferences.push({
          ...ref,
          refNumber: null
        });
      } else {
        // Other non-linked references (maybe once linked but removed from text)
        counter++;
        finalReferences.push({
          ...ref,
          refNumber: counter
        });
      }
      processedIds.add(ref.id);
    }
  });

  // 3. Check for meaningful changes (deep content check)
  const hasChanged = finalReferences.length !== currentReferences.length ||
    finalReferences.some((ref, idx) => {
      const curr = currentReferences[idx];
      return !curr ||
        curr.id !== ref.id ||
        curr.refNumber !== ref.refNumber ||
        curr.refText !== ref.refText ||
        curr.refContent !== ref.refContent ||
        curr.isManual !== ref.isManual;
    });

  // 4. Update DOM superscripts to match the new strictly sequential numbers
  spanGroups.forEach((spans, refId) => {
    const ref = finalReferences.find(r => r.id === refId);
    if (!ref) return;

    spans.forEach(span => {
      const oldSup = span.querySelector('sup.reference-number');
      const expectedText = `[${ref.refNumber}]`;

      if (oldSup) {
        if (oldSup.textContent === expectedText && oldSup.getAttribute('contenteditable') === 'false') return; // Skip if already correct and read-only
        span.removeChild(oldSup);
      }

      const sup = document.createElement('sup');
      sup.className = 'reference-number';
      sup.textContent = expectedText;
      sup.style.fontSize = '0.75em';
      sup.style.marginLeft = '2px';
      sup.style.color = '#1890ff';
      sup.style.fontWeight = 'bold';
      sup.style.cursor = 'pointer';
      sup.style.userSelect = 'none';
      sup.setAttribute('data-reference-id', refId);
      sup.setAttribute('contenteditable', 'false');
      span.appendChild(sup);
    });
  });

  if (hasChanged && onSyncReferences) {
    // Crucial: Use a snapshot of finalReferences to avoid mutations
    const result = JSON.parse(JSON.stringify(finalReferences));
    setTimeout(() => onSyncReferences(result), 0);
  }

  return finalReferences;
};
