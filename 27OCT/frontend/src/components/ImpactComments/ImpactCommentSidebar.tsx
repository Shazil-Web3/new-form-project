import React from 'react';
import { useImpactComments } from './ImpactCommentContext';
import ImpactCommentThread from './ImpactCommentThread';

export default function ImpactCommentSidebar() {
  const {
    comments,
    filteredComments,
    isSidebarOpen,
    setIsSidebarOpen,
    filter,
    setFilter,
  } = useImpactComments();

  if (!isSidebarOpen) return null;

  const openCount = comments.filter((c) => c.status !== 'resolved').length;
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length;

  return (
    <aside
      className="impact-comments-sidebar"
      aria-label="Impact Comments Sidebar"
    >
      {/* Header */}
      <div className="impact-comments-sidebar-header">
        <div className="impact-comments-sidebar-title">
          <span>💬 Impact Comments</span>
          {comments.length > 0 && (
            <span className="impact-comments-count-pill">
              {comments.length}
            </span>
          )}
        </div>
        <button
          type="button"
          className="impact-btn impact-btn-ghost"
          style={{ fontSize: 16, padding: '2px 6px', lineHeight: 1 }}
          onClick={() => setIsSidebarOpen(false)}
          title="Close comments panel"
        >
          ✕
        </button>
      </div>

      {/* Comment List */}
      <div className="impact-comments-list">
        {comments.length === 0 ? (
          <div className="impact-comments-empty">
            <div className="impact-comments-empty-icon">💭</div>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              No comments yet
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.4 }}>
              Select any text in the Impact form to leave feedback or ask a question.
            </div>
          </div>
        ) : (
          comments.map((comment) => (
            <ImpactCommentThread key={comment.id} comment={comment} />
          ))
        )}
      </div>

      {/* Footer Helper */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          fontSize: 10,
          color: '#64748b',
          textAlign: 'center',
        }}
      >
        Select any text in the Impact form to start a new discussion
      </div>
    </aside>
  );
}
