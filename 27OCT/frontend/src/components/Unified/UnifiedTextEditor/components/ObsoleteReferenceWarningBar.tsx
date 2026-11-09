/**
 * @file ObsoleteReferenceWarningBar.jsx
 * @description Floating, non-intrusive warning toast/bar when a referenced document has become obsolete (archived).
 * Guaranteed not to displace text editor pagination, toolbar, or cursor positioning.
 */

import React, { useState } from 'react';

export default function ObsoleteReferenceWarningBar({
  obsoleteDocs = [],
  itemType = 'document', // 'document' | 'template'
  onRevise = null,
  canRevise = false,
  className = ''
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!obsoleteDocs || obsoleteDocs.length === 0 || isDismissed) {
    return null;
  }

  const docNames = obsoleteDocs.map((d) => `"${d.title || 'Referenced Document'}" (v${d.version || '1.0'})`).join(', ');

  // Collapsed compact indicator pill
  if (isCollapsed) {
    return (
      <aside
        aria-label="Obsolete reference warning indicator"
        className={`fixed top-3 right-5 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 select-none ${className}`}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-bold text-xs shadow-xl border border-amber-300 transition-all hover:scale-105 cursor-pointer"
          title="Click to expand obsolete reference warning"
        >
          <span className="material-symbols-outlined text-[16px]">warning</span>
          <span>{obsoleteDocs.length} Obsolete Reference{obsoleteDocs.length > 1 ? 's' : ''}</span>
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Obsolete reference warning banner"
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94vw] max-w-2xl animate-in fade-in slide-in-from-top-3 duration-200 ${className}`}
    >
      <div className="bg-slate-900/95 text-slate-100 border-2 border-amber-500 rounded-2xl p-3.5 px-4.5 shadow-2xl backdrop-blur-md flex items-start gap-3.5">
        {/* Glowing Warning Icon */}
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
          <span className="material-symbols-outlined text-[20px]">warning</span>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
              Referenced Document Obsolete
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Action Required
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            Document <strong className="text-amber-300 font-semibold">{docNames}</strong>, which you have referenced in the text editor, has become obsolete (archived). You need to revise your {itemType}.
          </p>

          {/* Action Row */}
          <div className="flex items-center gap-2.5 mt-2.5 pt-2 border-t border-slate-800">
            {canRevise && onRevise && (
              <button
                onClick={onRevise}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">edit_document</span>
                <span>Revise {itemType === 'template' ? 'Template' : 'Document'}</span>
              </button>
            )}

            <button
              onClick={() => setIsCollapsed(true)}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Minimize warning to a small icon"
            >
              <span className="material-symbols-outlined text-[14px]">unfold_less</span>
              <span>Minimize</span>
            </button>
          </div>
        </div>

        {/* Top-Right Close Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
          title="Dismiss warning for this session"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </aside>
  );
}
