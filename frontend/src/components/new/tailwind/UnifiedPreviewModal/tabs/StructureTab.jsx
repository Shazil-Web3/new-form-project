/**
 * @file StructureTab.jsx
 * @description Read-only locked-elements checklist for Published template previews.
 *   Parses item.template_structure → { locked_elements: { content, toc, fontSize, fontStyle } }
 * @dependencies react, prop-types
 * @author Codegen
 */

import React from 'react';
import PropTypes from 'prop-types';

const LOCK_DEFS = [
  { key: 'content', label: 'Lock Core Content & Clauses', desc: 'Prevents authors from overriding predefined section texts' },
  { key: 'toc', label: 'Lock Table of Contents Indexing', desc: 'Disables modification of index heading structures' },
  { key: 'fontSize', label: 'Lock Formatting Font Sizes', desc: 'Restricts font-size updates in document edits' },
  { key: 'fontStyle', label: 'Lock Font Typographic Styles', desc: 'Restricts font-family overrides to maintain design standard' },
];

function parseLockedElements(item) {
  if (!item.template_structure) return {};
  try {
    const parsed = typeof item.template_structure === 'string'
      ? JSON.parse(item.template_structure)
      : item.template_structure;
    return parsed.locked_elements || {};
  } catch (_) {
    return {};
  }
}

export default function StructureTab({ item }) {
  const locked = parseLockedElements(item);
  const activeLocks = LOCK_DEFS.filter(d => !!locked[d.key]);
  const inactiveLocks = LOCK_DEFS.filter(d => !locked[d.key]);

  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-xs text-on-surface-variant/60 font-semibold uppercase tracking-wider">
        Template Layout Constraints
      </p>

      {activeLocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">🔒 Active Locks</p>
          {activeLocks.map(lock => (
            <div key={lock.key} className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="material-symbols-outlined text-[18px] text-emerald-700 mt-0.5 shrink-0">lock</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{lock.label}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{lock.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {inactiveLocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-wide">🔓 Unlocked</p>
          {inactiveLocks.map(lock => (
            <div key={lock.key} className="flex items-start gap-3 p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-xl opacity-60">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant/40 mt-0.5 shrink-0">lock_open</span>
              <div>
                <p className="text-sm font-medium text-on-surface-variant">{lock.label}</p>
                <p className="text-xs text-on-surface-variant/60 leading-relaxed">{lock.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeLocks.length === 0 && inactiveLocks.length === 0 && (
        <p className="text-sm text-on-surface-variant/50 italic text-center py-8">No structure constraints defined.</p>
      )}
    </div>
  );
}

StructureTab.propTypes = {
  item: PropTypes.object.isRequired,
};
