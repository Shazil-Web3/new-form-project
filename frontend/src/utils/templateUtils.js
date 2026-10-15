/**
 * Utility functions for template management
 */

/**
 * Empty-canvas / skeleton HTML guards. Implementations and the change-caution
 * disclaimer live in ./editorContentGuards.js — do not copy this logic inline.
 */
export {
  unwrapStoredEditorContent,
  editorContentPlainText,
  isSkeletonEditorContent,
  preferNonSkeletonEditorContent
} from './editorContentGuards';

/**
 * Strips comment and suggestion highlight markers from HTML content.
 * Cleans up both classes and data attributes, and removes the wrapping spans while preserving inner text.
 * 
 * @param {string} html - The HTML content to clean
 * @returns {string} The cleaned HTML content
 */
export const stripCommentHighlights = (html) => {
  if (!html || typeof html !== 'string') return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 1. Process all elements that have comment/suggestion markers or highlight classes
    // 1. Process all elements that have comment/suggestion markers or highlight classes
    // Expanded selector to include all comment/suggestion classes and attributes
    const highlights = doc.querySelectorAll(
      '[data-comment-id], [data-suggestededit-id], [data-suggestion-id], [data-active-comment-id], [data-comment-resolved], [data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"], .highlighted-text, .temp-comment-highlight, .temp-suggestion-highlight, .temp-text-highlight, .comment-highlight, .suggestion-highlight, .admin-edit, .reviewer-edit, [data-backspace-strike-id], .backspace-strike-text, mark'
    );
    
    highlights.forEach(el => {
      // Check if it's a locked element using a comprehensive check
      const isLocked = el.getAttribute('data-locked') === 'true' || 
                       el.getAttribute('data-locked') === 'partial' ||
                       el.classList.contains('locked-text') || 
                       el.classList.contains('locked') ||
                       el.getAttribute('contenteditable') === 'false';
      
      if (isLocked) {
        // RETAIN the element tag, but REMOVE comment/suggestion markers and highlight classes
        el.removeAttribute('data-comment-id');
        el.removeAttribute('data-suggestededit-id');
        el.removeAttribute('data-suggestion-id');
        el.removeAttribute('data-active-comment-id');
        el.removeAttribute('data-comment-resolved');
        el.removeAttribute('data-backspace-strike-id');
        el.removeAttribute('data-strike-created-by-id');
        el.removeAttribute('data-strike-created-by-email');
        el.removeAttribute('data-user-email');
        el.removeAttribute('data-edited-by');
        el.removeAttribute('data-edited-by-email');
        if (el.getAttribute('title')?.startsWith('Edited by')) {
          el.removeAttribute('title');
        }
        el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'temp-text-highlight', 'comment-highlight', 'suggestion-highlight', 'admin-edit', 'reviewer-edit', 'backspace-strike-text');
        const style = el.getAttribute('style') || '';
        if (style) {
          const cleanedStyle = style
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => {
              const lower = s.toLowerCase();
              return !lower.startsWith('text-decoration') &&
                     !lower.startsWith('-webkit-text-decoration-color') &&
                     !lower.startsWith('background');
            })
            .join('; ');
          if (cleanedStyle) el.setAttribute('style', cleanedStyle);
          else el.removeAttribute('style');
        }
        
        // Handle suggestions (del/ins) if they exist inside the locked element
        // Usually we want to keep the original content (del) and remove the suggestion (ins)
        const del = el.querySelector('del');
        const ins = el.querySelector('ins');
        if (del && ins) {
          const delParent = del.parentNode;
          if (delParent) {
            while (del.firstChild) {
              delParent.insertBefore(del.firstChild, del);
            }
            delParent.removeChild(del);
          }
          if (ins.parentNode) ins.parentNode.removeChild(ins);
        }
      } else {
        // NOT locked - Unwrap the element if it's a span or dedicated highlight wrapper
        
        // First handle suggestions if they are inside this element
        const del = el.querySelector('del');
        const ins = el.querySelector('ins');
        if (del && ins) {
          const parent = el.parentNode;
          if (parent) {
            // Move children of <del> (original content) to the parent, before 'el'
            while (del.firstChild) {
              parent.insertBefore(del.firstChild, el);
            }
            parent.removeChild(el); // remove the highlight wrapper entirely
          }
        } else if (el.hasAttribute('data-backspace-strike-id') || el.classList.contains('backspace-strike-text')) {
          // Strike-through deletion markers are reviewer artifacts; remove from published output.
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } else if (el.tagName.toLowerCase() === 'span' || el.tagName.toLowerCase() === 'mark') {
          // Normal highlight/edited-by wrapper - Unwrap the span and keep children
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        } else {
          // If it's a block element (like <p>), just strip the attributes
          el.removeAttribute('data-comment-id');
          el.removeAttribute('data-suggestededit-id');
          el.removeAttribute('data-suggestion-id');
          el.removeAttribute('data-active-comment-id');
          el.removeAttribute('data-comment-resolved');
          el.removeAttribute('data-user-email');
          el.removeAttribute('data-edited-by');
          el.removeAttribute('data-edited-by-email');
          el.removeAttribute('title');
          el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'temp-text-highlight', 'comment-highlight', 'suggestion-highlight', 'admin-edit', 'reviewer-edit');
        }
      }
    });

    // 2. Cleanup any remaining highlight classes on any elements
    const remainingHighlights = doc.querySelectorAll(
      '.highlighted-text, .temp-comment-highlight, .temp-suggestion-highlight, .temp-text-highlight, .comment-highlight, .suggestion-highlight, .admin-edit, .reviewer-edit, .backspace-strike-text, [data-backspace-strike-id], [data-comment-id], [data-suggestededit-id], [data-suggestion-id], [data-active-comment-id], [data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"]'
    );
    remainingHighlights.forEach(el => {
      el.classList.remove('highlighted-text', 'temp-comment-highlight', 'temp-suggestion-highlight', 'temp-text-highlight', 'comment-highlight', 'suggestion-highlight', 'admin-edit', 'reviewer-edit', 'backspace-strike-text');
      if (el.classList.length === 0) el.removeAttribute('class');
      if (el.hasAttribute('title')) {
         el.removeAttribute('title');
      }
      el.removeAttribute('data-comment-id');
      el.removeAttribute('data-suggestededit-id');
      el.removeAttribute('data-suggestion-id');
      el.removeAttribute('data-active-comment-id');
      el.removeAttribute('data-comment-resolved');
      el.removeAttribute('data-user-email');
      el.removeAttribute('data-edited-by');
      el.removeAttribute('data-edited-by-email');
      el.removeAttribute('data-backspace-strike-id');
      el.removeAttribute('data-strike-created-by-id');
      el.removeAttribute('data-strike-created-by-email');
      const style = el.getAttribute('style') || '';
      if (style) {
        const cleanedStyle = style
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => {
            const lower = s.toLowerCase();
            return !lower.startsWith('text-decoration') &&
                   !lower.startsWith('-webkit-text-decoration-color') &&
                   !lower.startsWith('background');
          })
          .join('; ');
        if (cleanedStyle) el.setAttribute('style', cleanedStyle);
        else el.removeAttribute('style');
      }
    });

    // 3. Remove edited-by metadata attributes/tooltips from any remaining nodes.
    const editedByAttrs = doc.querySelectorAll(
      '[data-user-email], [data-edited-by], [data-edited-by-email], [title^="Edited by"]'
    );
    editedByAttrs.forEach(el => {
      el.removeAttribute('data-user-email');
      el.removeAttribute('data-edited-by');
      el.removeAttribute('data-edited-by-email');
      if ((el.getAttribute('title') || '').startsWith('Edited by')) {
        el.removeAttribute('title');
      }
      const style = el.getAttribute('style') || '';
      if (style) {
        const cleanedStyle = style
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => {
            const lower = s.toLowerCase();
            return !lower.startsWith('text-decoration') &&
                   !lower.startsWith('-webkit-text-decoration-color');
          })
          .join('; ');
        if (cleanedStyle) el.setAttribute('style', cleanedStyle);
        else el.removeAttribute('style');
      }
    });

    // 4. Final safety pass: NEVER remove an element with data-locked="true"
    // This is a redundancy check to ensure no previous step accidentally queued it for removal
    
    // 5. Cleanup empty spans (if any were created/left by mistake)
    const allSpans = doc.querySelectorAll('span');
    allSpans.forEach(span => {
      const isLocked = span.getAttribute('data-locked') === 'true' || 
                       span.classList.contains('locked-text') || 
                       span.classList.contains('locked');
      
      // Only unwrap spans that are NOT locked and have no attributes
      if (!isLocked && !span.hasAttributes()) {
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          parent.removeChild(span);
        }
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.error('Error stripping highlights:', e);
    // Fallback regex (SAFER: avoids stripping spans that might be locked)
    let cleaned = html.replace(/<span\s+data-(?:comment|suggestededit)-id="[^"]*"\s*>([\s\S]*?)<\/span>/gi, '$1');
    cleaned = cleaned.replace(/<span\s+class="(?:admin-edit|reviewer-edit)"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    cleaned = cleaned.replace(/<span[^>]*(?:data-backspace-strike-id|class="[^"]*backspace-strike-text[^"]*")[^>]*>[\s\S]*?<\/span>/gi, '');
    cleaned = cleaned.replace(/\sdata-user-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-edited-by="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-edited-by-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\stitle="Edited by:[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-strike-created-by-id="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sdata-strike-created-by-email="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\stitle="[^"]*"/gi, '');
    return cleaned;
  }
};

/**
 * Counts the total number of blank fields (3 or more underscores) in an HTML string.
 * It only counts underscores within text nodes to avoid matching attributes or tags.
 * 
 * @param {string} html - The HTML content to search
 * @returns {number} The count of blank fields
 */
export const countBlanksInHtml = (html) => {
  if (!html || typeof html !== 'string') return 0;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const BLANK_REGEX = /_{3,}/g;
    let count = 0;

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          const matches = text.match(BLANK_REGEX);
          if (matches) count += matches.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip unwanted tags
        const tagName = node.tagName.toLowerCase();
        if (!['script', 'style', 'meta', 'link'].includes(tagName)) {
          Array.from(node.childNodes).forEach(walk);
        }
      }
    };

    walk(doc.body);
    return count;
  } catch (e) {
    console.error('Error counting blanks:', e);
    return 0;
  }
};

/**
 * Counts table dropdown option fields in an HTML string.
 *
 * @param {string} html - The HTML content to search
 * @returns {number} The count of dropdown fields
 */
export const countDropdownsInHtml = (html) => {
  if (!html || typeof html !== 'string') return 0;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let count = 0;

    doc.querySelectorAll('select.cell-dropdown').forEach(() => {
      count += 1;
    });

    return count;
  } catch (e) {
    console.error('Error counting dropdowns:', e);
    return 0;
  }
};

/**
 * Prepares template data for publication by stripping comments and highlights.
 * 
 * @param {object} template - The template object containing content and comments
 * @returns {object} The cleaned template data
 */
export const prepareTemplateForPublication = (template) => {
  if (!template) return template;

  let rawHtml = '';

  // 1) Primary source: comments column (editor saves latest edits here during review/revise)
  if (template.comments) {
    try {
      const parsed = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) rawHtml = parsed.content;
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        rawHtml = parsed;
      }
    } catch (e) {
      if (typeof template.comments === 'string' && template.comments.includes('<')) {
        rawHtml = template.comments;
      }
    }
  }

  // 2) Fallback: content column
  if (!rawHtml && template.content) {
    try {
      const parsed = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) {
          rawHtml = parsed.content;
        } else if (parsed.sections && Array.isArray(parsed.sections)) {
          // Join sections without commas
          rawHtml = parsed.sections.map(s => `<h3>${s.title || ''}</h3><div>${s.content || ''}</div>`).join('');
        } else if (typeof parsed === 'string' && parsed.includes('<')) {
          rawHtml = parsed;
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        rawHtml = parsed;
      }
    } catch (parseError) {
      if (typeof template.content === 'string') {
        rawHtml = template.content;
      }
    }
  }

  // Fallback if completely empty
  if (!rawHtml) {
    rawHtml = template.content || '';
  }

  // Ensure rawHtml is a string to prevent comma injection from arrays
  if (Array.isArray(rawHtml)) {
    rawHtml = rawHtml.join('');
  }

  // Clean the main content
  const cleanedContent = stripCommentHighlights(rawHtml);

  // Clean the content inside the comments object if it exists
  // PRESERVE metadata like headerHTML, footerHTML, logo, logoText
  let originalCommentsData = {};
  if (template.comments) {
    try {
      originalCommentsData = typeof template.comments === 'string' 
        ? JSON.parse(template.comments) 
        : template.comments;
    } catch (e) {
      console.warn("Could not parse original comments for metadata preservation", e);
    }
  }

  let cleanedComments = {
    ...originalCommentsData, // Preserve all metadata
    content: cleanedContent,
    comments: [], // Clear all comments
    suggestions: [], // Clear all suggestions
    lastPublished: new Date().toISOString()
  };

  return {
    ...template,
    content: cleanedContent,
    comments: cleanedComments
  };
};

/**
 * Prepares a document row for publication (strip highlights; clear comments/suggestions in elements).
 * @param {object} doc - Row from GET /api/get_document (normalized) or raw documents row
 * @returns {{ content: string, elements: string }}
 */
export const prepareDocumentForPublication = (doc) => {
  if (!doc) return { content: '{}', elements: '{}' };

  let html = '';
  try {
    const commentsMeta = doc.comments
      ? typeof doc.comments === 'string'
        ? JSON.parse(doc.comments)
        : doc.comments
      : null;
    if (commentsMeta?.content) html = commentsMeta.content;
  } catch (e) {
    /* ignore */
  }

  if (!html && doc.content) {
    try {
      const c = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      if (c && typeof c === 'object' && c.content) html = c.content;
      else if (typeof doc.content === 'string' && doc.content.trim().startsWith('<')) html = doc.content;
    } catch (e) {
      if (typeof doc.content === 'string') html = doc.content;
    }
  }

  const cleanedHtml = stripCommentHighlights(html || '');

  let contentObj = {};
  try {
    contentObj =
      typeof doc.content === 'string' ? JSON.parse(doc.content || '{}') : doc.content || {};
  } catch (e) {
    contentObj = { content: cleanedHtml };
  }
  contentObj.content = cleanedHtml;

  let elements = {};
  try {
    elements =
      typeof doc.elements === 'string' ? JSON.parse(doc.elements || '{}') : doc.elements || {};
  } catch (e) {
    elements = {};
  }

  const newElements = {
    ...elements,
    comments: [],
    suggestedEdits: []
  };

  return {
    content: JSON.stringify(contentObj),
    elements: JSON.stringify(newElements)
  };
};

/**
 * Resolves document creator identity for review underlines (not the logged-in reviewer).
 */
export const getDocumentAuthorOwnershipInfo = (documentRow, currentUser) => {
  const creatorId = String(documentRow?.created_by ?? documentRow?.author_id ?? '').trim();
  const currentId = String(currentUser?.id || currentUser?.user_id || currentUser?.userId || '').trim();
  const isCurrentUserAuthor = Boolean(creatorId && currentId && creatorId === currentId);
  const authorId = creatorId || currentId;
  const authorEmail = String(
    (isCurrentUserAuthor && (currentUser?.email || currentUser?.userEmail)) ||
    documentRow?.author_email ||
    documentRow?.created_by_email ||
    documentRow?.created_by_user?.email ||
    ''
  ).trim();
  return { id: authorId, email: authorEmail, role: 'author' };
};

/**
 * Assigns author ownership and underline metadata to existing content entering Review mode.
 * Matches the exact styling and attributes applied when an author types in Review mode.
 * Also reconciles and repairs existing edit spans to guarantee accurate 'Edited by' titles.
 *
 * @param {string} html - Raw HTML content
 * @param {object} authorInfo - { id, email, role }
 * @returns {string} HTML with author ownership and underline formatting applied
 */
export const assignAuthorOwnershipToHtml = (html, authorInfo) => {
  if (!html || typeof html !== 'string' || !html.trim()) return html;
  if (!authorInfo || (!authorInfo.id && !authorInfo.email)) return html;

  const authorId = String(authorInfo.id || '').trim();
  const authorEmail = String(authorInfo.email || '').trim();
  const rawRole = String(authorInfo.role || '').trim().toLowerCase();
  const isAdminRole = rawRole === 'admin' || rawRole === '1' || rawRole === 'author';
  const targetClass = isAdminRole ? 'admin-edit' : 'reviewer-edit';
  const creatorRole = isAdminRole ? 'admin' : 'reviewer';

  // Palette & hash algorithm identical to useDeletionStrike.js / useHandleBeforeInput.js
  const palette = [
    "#ff6b6b", // red
    "#4dabf7", // blue
    "#51cf66", // green
    "#f59f00", // amber
    "#845ef7", // purple
    "#20c997", // teal
    "#e64980", // pink
    "#228be6", // deep blue
  ];
  const identityKey = (authorEmail || authorId).toLowerCase();
  let hash = 0;
  for (let i = 0; i < identityKey.length; i += 1) {
    hash = ((hash << 5) - hash + identityKey.charCodeAt(i)) | 0;
  }
  const underlineColor = palette[Math.abs(hash) % palette.length];

  const getTrackedColor = (identity) => {
    const key = String(identity || "").trim().toLowerCase();
    if (!key) return "#4dabf7";
    let h = 0;
    for (let i = 0; i < key.length; i += 1) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Pass 0: Unnest any nested edit/attribution spans so children are siblings of parent
    const nestedSpans = doc.querySelectorAll('.admin-edit .reviewer-edit, .reviewer-edit .admin-edit, .admin-edit .admin-edit, .reviewer-edit .reviewer-edit');
    nestedSpans.forEach((child) => {
      const parent = child.closest('.admin-edit, .reviewer-edit');
      if (parent && parent.parentNode && parent !== child) {
        const parentClone = parent.cloneNode(false);
        let next = child.nextSibling;
        while (next) {
          const toMove = next;
          next = next.nextSibling;
          parentClone.appendChild(toMove);
        }
        parent.parentNode.insertBefore(child, parent.nextSibling);
        if (parentClone.childNodes.length > 0) {
          parent.parentNode.insertBefore(parentClone, child.nextSibling);
        }
        if (parent.childNodes.length === 0) {
          parent.remove();
        }
      }
    });

    // Pass 1: Reconcile and heal existing edit spans to ensure titles and colors always match actual editors
    const existingEditSpans = doc.querySelectorAll('.admin-edit, .reviewer-edit, [data-edit-id]');
    existingEditSpans.forEach((span) => {
      const spanEmail = (span.getAttribute('data-user-email') || '').trim();
      const spanOwnerId = (span.getAttribute('data-owner-id') || '').trim();

      if (spanEmail && spanEmail.toLowerCase() !== 'unknown') {
        // Guarantee title always accurately reflects the span's user email
        span.title = `Edited by: ${spanEmail}`;
        const color = getTrackedColor(spanEmail || spanOwnerId);
        span.style.setProperty('text-decoration-color', color, 'important');
        span.style.setProperty('-webkit-text-decoration-color', color, 'important');
      } else if (authorEmail && (!spanOwnerId || spanOwnerId === authorId || span.classList.contains('admin-edit'))) {
        // Heal author span that was missing email attribute
        span.setAttribute('data-user-email', authorEmail);
        span.title = `Edited by: ${authorEmail}`;
        const color = getTrackedColor(authorEmail || authorId);
        span.style.setProperty('text-decoration-color', color, 'important');
        span.style.setProperty('-webkit-text-decoration-color', color, 'important');
      }
    });
    // Pass 2: Select all editable content blocks and containers for unowned text
    const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th');

    blocks.forEach((block) => {
      // If block itself is locked, do not tag it
      const isBlockLocked = block.getAttribute('data-locked') === 'true' ||
                            block.classList.contains('locked-text') ||
                            block.classList.contains('locked') ||
                            block.getAttribute('contenteditable') === 'false';
      if (isBlockLocked) return;

      // Collect text nodes inside this block
      const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let currentNode = walker.nextNode();

      while (currentNode) {
        // Skip empty or purely whitespace nodes
        const rawText = currentNode.textContent;
        const normalized = rawText ? rawText.replace(/[\u200B\u200C\u200D\uFEFF\u00A0]/g, '').trim() : '';

        if (normalized.length > 0) {
          const parent = currentNode.parentElement;
          if (parent) {
            // Only check INLINE ownership spans — not block-level ancestors.
            const isOwned = parent.closest('.admin-edit, .reviewer-edit, [data-backspace-strike-id], .backspace-strike-text');
            const isLocked = parent.closest('[data-locked="true"], .locked-text, .locked, [contenteditable="false"]');
            const isControl = parent.closest('select, button, script, style');

            if (!isOwned && !isLocked && !isControl) {
              textNodes.push(currentNode);
            }
          }
        }
        currentNode = walker.nextNode();
      }

      // Wrap eligible unowned text nodes in author attribution spans
      textNodes.forEach((node) => {
        const span = doc.createElement('span');
        span.className = targetClass;
        if (authorEmail) span.setAttribute('data-user-email', authorEmail);
        if (authorId) span.setAttribute('data-owner-id', authorId);
        span.setAttribute('data-edit-id', `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        span.setAttribute('data-creator-role', creatorRole);
        if (authorEmail) span.title = `Edited by: ${authorEmail}`;

        span.style.setProperty('text-decoration-line', 'underline');
        span.style.setProperty('text-decoration-thickness', '2px');
        span.style.setProperty('text-decoration-color', underlineColor, 'important');
        span.style.setProperty('-webkit-text-decoration-color', underlineColor, 'important');

        span.textContent = node.textContent;
        if (node.parentNode) {
          node.parentNode.replaceChild(span, node);
        }
      });
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.error('Error in assignAuthorOwnershipToHtml:', e);
    return html;
  }
};
