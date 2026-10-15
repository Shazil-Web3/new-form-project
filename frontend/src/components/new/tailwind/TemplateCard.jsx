import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function TemplateCard({ template, onAction, currentUser }) {
  const {
    id,
    name,
    category,
    description,
    owner_name,
    status,
    version,
    updated_at,
    usage_count,
    locked,
    approvers,
    due_date,
    created_by,
  } = template;

  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedStatus = (status || 'draft').toLowerCase();

  const isAuthor = Number(created_by) === Number(currentUser?.id) || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  // Version formatted with lowercase 'v' prefix
  const formattedVersion = version
    ? String(version).toLowerCase().startsWith('v')
      ? String(version).toLowerCase()
      : 'v' + version
    : 'v1.0';

  // Left accent border classes
  let borderClass = 'bg-surface-variant';
  if (normalizedStatus === 'published' || normalizedStatus === 'active') {
    borderClass = 'bg-primary-container';
  } else if (['pending', 'pending_review', 'reviewed', 'pending_approval', 'approved'].includes(normalizedStatus)) {
    borderClass = 'bg-tertiary-container';
  } else if (normalizedStatus === 'old' || normalizedStatus === 'archived') {
    borderClass = 'bg-surface-dim';
  }

  // Category specific styles
  let catIcon = 'description';
  let catTextClass = 'text-primary';
  let catBgClass = 'bg-primary-fixed';

  const catLower = (category || '').toLowerCase();
  if (catLower.includes('hr') || catLower.includes('human')) {
    catIcon = 'description';
    catTextClass = 'text-primary';
    catBgClass = 'bg-primary-fixed';
  } else if (catLower.includes('fin') || catLower.includes('expense') || catLower.includes('pay')) {
    catIcon = 'receipt_long';
    catTextClass = 'text-tertiary';
    catBgClass = 'bg-tertiary-fixed';
  } else if (catLower.includes('leg') || catLower.includes('nda') || catLower.includes('rule')) {
    catIcon = 'gavel';
    catTextClass = 'text-on-primary-fixed-variant';
    catBgClass = 'bg-primary-fixed';
  }

  // Helper for due date urgency colors (Green >3 days, Orange <=3 days, Red overdue)
  const renderDueTag = () => {
    if (!due_date) return null;
    const diffTime = new Date(due_date) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-error-container text-error border border-error gap-1 select-none">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>warning</span>
          Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary gap-1 select-none">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
          Due {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 gap-1 select-none">
        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
        Due {diffDays}d
      </span>
    );
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col relative group hover:shadow-md transition-shadow select-none">
      {/* Status Accent (Left Border) */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${borderClass}`}></div>

      {/* Main Body */}
      <div className="p-card_padding pl-5 flex-1">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span 
              className={`material-symbols-outlined ${catTextClass} ${catBgClass} p-1.5 rounded-lg`} 
              style={{ fontVariationSettings: '"FILL" 1', fontSize: '18px' }}
            >
              {catIcon}
            </span>
            {category && (
              <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-label-xs text-label-xs uppercase">
                {category}
              </span>
            )}
            {renderDueTag()}
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant">
            {locked && (
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: '16px' }}>
                lock
              </span>
            )}
            <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded-full font-label-xs text-label-xs font-bold">
              {formattedVersion}
            </span>
          </div>
        </div>

        <h3 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold leading-snug line-clamp-1">
          {name}
        </h3>
        <p className="text-on-surface-variant text-sm mb-4 line-clamp-2 min-h-[40px]">
          {description || 'No description provided.'}
        </p>

        {/* Tab-specific Middle Section */}
        {normalizedStatus === 'draft' && (
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>edit_note</span>
            <span>Draft Mode</span>
          </div>
        )}

        {(['pending', 'pending_review', 'reviewed', 'pending_approval', 'approved'].includes(normalizedStatus)) && approvers && approvers.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 mb-2">
            <span className="text-[10px] text-on-surface-variant font-semibold">Approvers:</span>
            <div className="flex -space-x-1 overflow-hidden">
              {approvers.map((app, idx) => {
                const initials = (app.name || 'R').split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);
                let statusBadgeColor = 'border-outline-variant bg-surface-variant text-on-surface-variant';
                if (app.status === 'approved' || app.status === 'reviewed') statusBadgeColor = 'border-primary-container bg-primary-fixed text-primary';
                else if (app.status === 'rejected') statusBadgeColor = 'border-error bg-error-container text-error';
                return (
                  <div 
                    key={idx}
                    className={`w-5 h-5 rounded-full border text-[9px] font-bold flex items-center justify-center ${statusBadgeColor}`}
                    title={`${app.name} (${app.role || 'Reviewer'}): ${app.status}`}
                  >
                    {initials}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(normalizedStatus === 'published' || normalizedStatus === 'active') && (
          <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>analytics</span>
              Used {usage_count || 0} times
            </span>
          </div>
        )}
      </div>

      {/* Card Action footer */}
      <div className="border-t border-outline-variant px-5 py-3 bg-surface-bright flex justify-between items-center min-h-[58px] relative">
        <div className="text-xs text-on-surface-variant">
          <div>Modified: {updated_at || 'Just now'}</div>
          <div>By: {owner_name || 'Admin'}</div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-1">
          {/* Draft actions directly visible on card. No three-dot menu. */}
          {normalizedStatus === 'draft' && (
            <div className="flex gap-1">
              <button 
                onClick={() => onAction('edit', id)}
                disabled={!isAuthor}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded disabled:opacity-40" 
                title="Edit"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              </button>
              <button 
                onClick={() => onAction('submit', id)}
                disabled={!isAuthor}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded disabled:opacity-40" 
                title="Submit for Review"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>publish</span>
              </button>
              <button 
                onClick={() => onAction('delete', id)}
                disabled={!isAuthor}
                className="p-1.5 text-error hover:bg-error-container rounded disabled:opacity-40" 
                title="Delete"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            </div>
          )}

          {/* Published actions */}
          {(normalizedStatus === 'published' || normalizedStatus === 'active' || normalizedStatus === 'pending_revision') && (
            <div className="flex gap-1">
              <button 
                onClick={() => onAction('revise', id)}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded" 
                title="Revise"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              </button>
              <button 
                onClick={() => onAction('export', id)}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded" 
                title="Export PDF"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>picture_as_pdf</span>
              </button>
              <button 
                onClick={() => onAction('archive', id)}
                disabled={!isAdmin}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded disabled:opacity-40" 
                title="Archive"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>archive</span>
              </button>
              <button 
                onClick={() => onAction('use', id)}
                className="px-3 py-1.5 bg-primary text-on-primary rounded font-label-sm text-label-sm hover:opacity-90 ml-1 font-semibold transition-opacity"
              >
                Use
              </button>
            </div>
          )}

          {/* Pending actions (three-dot menu is allowed here) */}
          {(['pending', 'pending_review', 'reviewed', 'pending_approval', 'approved'].includes(normalizedStatus)) && (
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-high transition-colors"
                title="More actions"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 bottom-full mb-2 w-48 rounded-lg bg-surface-container-lowest border border-outline-variant shadow-lg z-40 py-1 text-xs text-left">
                    <button
                      onClick={() => { setMenuOpen(false); onAction('review', id); }}
                      className="w-full px-4 py-2 hover:bg-surface-container-low text-on-surface flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rate_review</span>
                      Review
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onAction('publish', id); }}
                      disabled={!isAdmin && !(isAuthor && approvers?.every(a => a.status === 'approved' || a.status === 'reviewed'))}
                      className="w-full px-4 py-2 hover:bg-surface-container-low text-on-surface disabled:opacity-40 flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>publish</span>
                      Publish
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onAction('revert', id); }}
                      disabled={!isAuthor && !isAdmin}
                      className="w-full px-4 py-2 hover:bg-surface-container-low text-on-surface disabled:opacity-40 flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings_backup_restore</span>
                      Revert to Draft
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onAction('unsubmit', id); }}
                      disabled={!isAuthor && !isAdmin}
                      className="w-full px-4 py-2 hover:bg-surface-container-low text-on-surface disabled:opacity-40 flex items-center gap-2 font-semibold"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
                      Unsubmit
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Old Actions: do NOT show restore button on cards, only view audit trail is allowed */}
          {(normalizedStatus === 'old' || normalizedStatus === 'archived') && (
            <button 
              onClick={() => onAction('audit', id)}
              className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface-variant rounded font-label-sm text-label-sm hover:bg-surface-container-high font-semibold transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
              Audit Trail
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

TemplateCard.propTypes = {
  template: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    category: PropTypes.string,
    description: PropTypes.string,
    owner_name: PropTypes.string,
    status: PropTypes.string,
    version: PropTypes.string,
    updated_at: PropTypes.string,
    usage_count: PropTypes.number,
    locked: PropTypes.bool,
    approvers: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        role: PropTypes.string,
        status: PropTypes.string,
      })
    ),
    due_date: PropTypes.string,
    created_by: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onAction: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
};
