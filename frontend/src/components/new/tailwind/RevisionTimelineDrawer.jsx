import React from 'react';
import PropTypes from 'prop-types';

/**
 * RevisionTimelineDrawer - Redesigned Sidebar Version Timeline
 * 
 * Renders a side-drawer showing version history list:
 * - Vertical connecting timeline nodes.
 * - Version tags (e.g. v2.1), timestamps, creator names, and modification summaries.
 * - Easy click action triggers to restore previous revisions.
 */
export default function RevisionTimelineDrawer({
  visible,
  onClose,
  history = [],
  onRestoreVersion,
  currentVersion,
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1050] flex justify-end">
      {/* Click overlay to close */}
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose}></div>

      {/* Drawer panel wrapper */}
      <div className="relative w-80 max-w-sm h-full bg-surface-container-lowest border-l border-outline-variant shadow-2xl flex flex-col animate-slide-in select-none">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">history</span>
            <span className="text-label-md font-bold text-on-surface">Version History</span>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high p-1.5 rounded-full transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Timeline Body list */}
        <div className="flex-1 overflow-y-auto p-5 relative">
          {history && history.length > 0 ? (
            <div className="relative border-l-2 border-outline-variant/60 ml-4 pl-6 space-y-8 py-2">
              {history.map((version, idx) => {
                const isActive = currentVersion === version.version_number;
                const dateStr = version.created_at ? new Date(version.created_at).toLocaleString() : 'N/A';
                
                return (
                  <div key={version.id || idx} className="relative">
                    {/* Node Dot marker */}
                    <span className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 ${
                      isActive 
                        ? 'bg-blue-700 border-white ring-2 ring-blue-700/20' 
                        : 'bg-outline-variant border-surface'
                    }`} />

                    {/* Version & Author metadata */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-xs font-mono font-bold ${
                        isActive ? 'text-blue-700 font-extrabold' : 'text-on-surface-variant/80'
                      }`}>
                        v{version.version_number || '1.0'}
                        {isActive && <span className="ml-1.5 text-[10px] font-sans font-bold uppercase tracking-wider bg-blue-700/10 text-blue-700 px-1.5 py-0.5 rounded">Active</span>}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/60 font-medium">
                        {dateStr}
                      </span>
                    </div>

                    {/* Author block details */}
                    <div className="text-body-xs text-on-surface-variant/80 font-medium mb-2.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[12px]">person</span>
                      <span>{version.author_name || 'Unknown Author'}</span>
                    </div>

                    {/* AI Change summary text block */}
                    <div className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 text-body-sm text-on-surface leading-normal shadow-sm">
                      <p className="font-semibold text-label-xs text-on-surface-variant/70 uppercase tracking-wider mb-1">
                        Change Details
                      </p>
                      <p className="text-[12px]">{version.change_summary || version.comment || 'No change comments recorded.'}</p>
                    </div>

                    {/* Restore CTA Button option */}
                    {!isActive && onRestoreVersion && (
                      <button
                        onClick={() => onRestoreVersion(version)}
                        className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 transition-colors uppercase tracking-wider"
                      >
                        <span className="material-symbols-outlined text-[13px]">restore</span>
                        <span>Restore This Version</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant/60">
              <span className="material-symbols-outlined text-3xl mb-1.5 text-outline">history</span>
              <p className="text-body-sm font-medium">No revision logs found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

RevisionTimelineDrawer.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  history: PropTypes.array,
  onRestoreVersion: PropTypes.func,
  currentVersion: PropTypes.string,
};
