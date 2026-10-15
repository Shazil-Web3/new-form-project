/**
 * @file sanitizeHtml.js
 * @description Centralized DOMPurify sanitization utility for ProDoc HTML & document content.
 * Prevents Stored and DOM XSS vulnerabilities (SEC-FE-01).
 */

import DOMPurify from 'dompurify';

const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'code', 'dd', 'div', 'dl', 'dt', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li',
    'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'wbr'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height', 'class', 'style',
    'data-block-id', 'data-block-type', 'data-comment-id', 'data-suggestededit-id',
    'data-reference-id', 'data-locked', 'data-backspace-strike-id', 'data-user-email',
    'data-user-id', 'data-continued', 'target', 'rel',
    'data-doc-id', 'data-doc-title', 'data-type', 'contenteditable'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'textarea', 'select', 'meta', 'link', 'style', 'base', 'applet'
  ],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'formaction', 'onkeydown', 'onkeypress', 'onkeyup'
  ],
  ALLOW_DATA_ATTR: true,
};

// Hook to ensure links open safely with noopener noreferrer
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer');
    if (!node.getAttribute('target')) {
      node.setAttribute('target', '_blank');
    }
  }
});

/**
 * Sanitize untrusted HTML strings using strict DOMPurify configuration.
 * @param {string|any} dirty - Untrusted HTML string
 * @param {object} customConfig - Optional custom configuration
 * @returns {string} Sanitized safe HTML string
 */
export const sanitizeHtml = (dirty, customConfig = {}) => {
  if (dirty === null || dirty === undefined) return '';
  if (typeof dirty !== 'string') return String(dirty);
  return DOMPurify.sanitize(dirty, { ...DEFAULT_CONFIG, ...customConfig });
};

export default sanitizeHtml;
