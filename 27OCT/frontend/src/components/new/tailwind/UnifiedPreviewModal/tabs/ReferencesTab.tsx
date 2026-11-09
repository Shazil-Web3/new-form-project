/**
 * @file ReferencesTab.jsx
 * @description Read-only references list for Published stage previews.
 *   Parses item.comments → { references: [{ refNumber, refContent, refText }] }
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

function parseReferences(item) {
  if (!item.comments) return [];
  try {
    const parsed = typeof item.comments === 'string' ? JSON.parse(item.comments) : item.comments;
    if (parsed && Array.isArray(parsed.references)) return parsed.references;
    return [];
  } catch (_) {
    return [];
  }
}

function RefEntry({ ref: r }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-outline-variant/20 last:border-0">
      {r.refNumber != null && (
        <span className="shrink-0 w-7 h-7 rounded-full bg-blue-700/10 text-blue-700 text-xs font-extrabold flex items-center justify-center mt-0.5">
          {r.refNumber}
        </span>
      )}
      <p className="text-sm text-on-surface leading-relaxed flex-1">
        {r.refContent || r.refText || <span className="italic text-on-surface-variant/40">No content</span>}
      </p>
    </div>
  );
}

export default function ReferencesTab({ item }) {
  const refs = parseReferences(item);

  if (refs.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-12 select-none text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">menu_book</span>
        <span className="text-sm font-medium text-on-surface-variant/50">No references have been added.</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-0">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider mb-3">
        References ({refs.length})
      </p>
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 divide-y divide-outline-variant/20">
        {refs.map((r, i) => <RefEntry key={i} ref={r} />)}
      </div>
    </div>
  );
}

ReferencesTab.propTypes = {
  item: PropTypes.object.isRequired,
};
