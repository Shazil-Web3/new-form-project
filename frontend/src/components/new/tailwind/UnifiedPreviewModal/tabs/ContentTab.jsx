/**
 * @file ContentTab.jsx
 * @description Read-only HTML rich text content viewer for the preview modal.
 *   Parses content from JSON envelope if needed (same logic as UnifiedPreviewModal).
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeHtml } from '../../../../../utils/sanitizeHtml';

function extractHtml(item) {
  let raw = '';

  // Try extracting from comments envelope first
  if (item.comments) {
    try {
      const parsedComments = typeof item.comments === 'string' ? JSON.parse(item.comments) : item.comments;
      if (parsedComments && typeof parsedComments === 'object') {
        if (parsedComments.html) raw = parsedComments.html;
        else if (parsedComments.content) raw = parsedComments.content;
      }
    } catch (_) {}
  }

  // Fallback to item.content if comments envelope didn't yield anything
  if (!raw) {
    raw = item.content || '';
  }

  // Now inspect raw (which could be a pre-parsed object or string)
  if (raw && typeof raw === 'object') {
    if (raw.html !== undefined) return raw.html;
    if (raw.content !== undefined) return raw.content;
    return JSON.stringify(raw);
  }

  // Try parsing JSON envelope from content itself if it is a string representation of JSON
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.html !== undefined) return parsed.html;
        if (parsed.content !== undefined) return parsed.content;
      }
    } catch (_) {}
  }

  return raw;
}

export default function ContentTab({ item, dimmed }) {
  const html = extractHtml(item);

  return (
    <div className="animate-fade-in flex flex-col h-full min-h-[300px]">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider mb-3">
        Document Content
      </p>
      <div className={`flex-1 overflow-y-auto border border-outline-variant rounded-xl bg-white shadow-inner p-6 ${dimmed ? 'opacity-60' : ''}`}>
        {html ? (
          <div
            className="prose max-w-none text-sm font-sans leading-relaxed text-on-surface"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center select-none">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">subject</span>
            <span className="text-sm font-medium text-on-surface-variant/50">No content has been drafted yet.</span>
          </div>
        )}
      </div>
      {dimmed && (
        <p className="text-xs text-on-surface-variant/50 italic mt-2 text-center">
          Content is read-only for archived items.
        </p>
      )}
    </div>
  );
}

ContentTab.propTypes = {
  item: PropTypes.object.isRequired,
  dimmed: PropTypes.bool,
};
