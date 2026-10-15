import React, { useState } from 'react';
import { useImpactComments } from './ImpactCommentContext';

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function ImpactCommentThread({ comment }) {
  const {
    activeCommentId,
    setActiveCommentId,
    addReply,
    deleteComment,
    deleteReply,
    resolveUser,
    availableActors = [],
    activeActorId,
    setActiveActorId,
  } = useImpactComments();

  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [localActorId, setLocalActorId] = useState(null);

  const currentUser = resolveUser();
  const currentAuthor = (localActorId ? availableActors.find((a) => String(a.id) === String(localActorId)) : null) || resolveUser();

  const currentUserId = currentUser.id || currentUser.userId;
  const isCurrentUserAdmin = Boolean(
    currentUser.is_admin ||
    currentUser.isAdmin ||
    String(currentUser.role || '').toLowerCase().includes('admin')
  );

  const isAuthor = Boolean(
    currentUserId && comment.author?.id && String(currentUserId) === String(comment.author.id)
  );
  const canDeleteComment = isAuthor || isCurrentUserAdmin;

  const roleLower = String(comment.author?.role || 'member').toLowerCase();
  const isActive = activeCommentId === comment.id;

  const handleSendReply = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!replyText.trim() || isSendingReply) return;

    try {
      setIsSendingReply(true);
      await addReply(comment.id, replyText.trim(), currentAuthor);
      setReplyText('');
      setShowReplyBox(false); // Close the reply box immediately after sending
    } catch (err) {
      console.error('Failed to add reply:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSnippetClick = () => {
    setActiveCommentId(comment.id);

    // If comment is associated with a specific blank field, scroll to that field
    if (comment.fieldIndex != null) {
      const fieldEl = document.querySelector(`[data-field-index="${comment.fieldIndex}"]`);
      if (fieldEl) {
        fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        fieldEl.classList.add('impact-comment-highlight');
        fieldEl.classList.add('active');
        setTimeout(() => {
          fieldEl.classList.remove('active');
          fieldEl.classList.remove('impact-comment-highlight');
        }, 2200);
        return;
      }
    }

    // Find highlighted text element if any
    const el = document.querySelector(`[data-impact-comment-id="${comment.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 2000);
    }
  };

  return (
    <div
      className={`impact-comment-card ${isActive ? 'active' : ''}`}
      onClick={() => setActiveCommentId(comment.id)}
    >
      {/* Header */}
      <div className="impact-comment-card-header">
        <div className="impact-author-info">
          <div className="impact-avatar">
            {getInitials(comment.author?.name)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="impact-author-name">{comment.author?.name || 'User'}</span>
              <span
                className={`impact-role-badge ${
                  roleLower.includes('admin')
                    ? 'admin'
                    : roleLower.includes('review')
                    ? 'reviewer'
                    : roleLower.includes('approv')
                    ? 'approver'
                    : 'member'
                }`}
              >
                {comment.author?.role || 'Member'}
              </span>
            </div>
            <div className="impact-comment-time">
              {formatTimestamp(comment.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Quoted snippet */}
      {comment.selectedText && (
        <div
          className="impact-quoted-snippet"
          onClick={handleSnippetClick}
          title="Click to jump to quoted text or field"
        >
          {comment.isField ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="impact-field-pill-badge">
                🏷️ {comment.fieldName || 'Field'}
              </span>
              <span style={{ fontWeight: 600, color: '#1d4ed8' }}>
                “{comment.fieldValue || comment.selectedText}”
              </span>
            </div>
          ) : (
            <div>
              {comment.fields && comment.fields.length > 0 && (
                <div style={{ marginBottom: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {comment.fields.map((f, idx) => (
                    <span key={idx} className="impact-field-pill-badge">
                      🏷️ {f.fieldName}: “{f.fieldValue || '(empty)'}”
                    </span>
                  ))}
                </div>
              )}
              <div style={{ fontStyle: 'italic' }}>
                “{comment.selectedText}”
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Comment Text */}
      <div className="impact-comment-text">
        {comment.text}
      </div>

      {/* Actions / Footer */}
      <div className="impact-comment-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="impact-reply-trigger-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowReplyBox(!showReplyBox);
            }}
          >
            💬 Reply {comment.replies?.length > 0 ? `(${comment.replies.length})` : ''}
          </button>
        </div>

        {canDeleteComment && (
          <button
            type="button"
            className="impact-btn-danger impact-btn"
            style={{ fontSize: 11, padding: '2px 4px' }}
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Delete this comment thread?')) {
                deleteComment(comment.id);
              }
            }}
            title="Delete comment"
          >
            🗑
          </button>
        )}
      </div>

      {/* Replies Thread */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="impact-replies-list">
          {comment.replies.map((reply) => {
            const replyRoleLower = String(reply.author?.role || 'member').toLowerCase();
            const canDeleteReply =
              isCurrentUserAdmin ||
              (currentUserId && reply.author?.id && String(currentUserId) === String(reply.author.id));

            return (
              <div key={reply.id} className="impact-reply-item">
                <div className="impact-reply-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="impact-reply-author-name">
                      {reply.author?.name || 'User'}
                    </span>
                    <span
                      className={`impact-role-badge ${
                        replyRoleLower.includes('admin')
                          ? 'admin'
                          : replyRoleLower.includes('review')
                          ? 'reviewer'
                          : replyRoleLower.includes('approv')
                          ? 'approver'
                          : 'member'
                      }`}
                    >
                      {reply.author?.role || 'Member'}
                    </span>
                    <span className="impact-reply-time">
                      {formatTimestamp(reply.createdAt)}
                    </span>
                  </div>

                  {canDeleteReply && (
                    <button
                      type="button"
                      className="impact-reply-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReply(comment.id, reply.id);
                      }}
                      title="Delete reply"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="impact-reply-text">{reply.text}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input box - Only open when user clicked Reply */}
      {showReplyBox && (
        <div
          className="impact-reply-input-box"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Read-only Persona indicator - No dropdown selection */}
          <div className="impact-reply-persona-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="impact-reply-as-label">Replying as:</span>
              <span
                className={`impact-role-badge ${String(currentAuthor.role || 'member').toLowerCase()}`}
              >
                {currentAuthor.role || 'Member'}
              </span>
              <span className="impact-reply-as-name">
                {currentAuthor.name || currentAuthor.first_name || 'User'}
              </span>
            </div>
          </div>

          <textarea
            className="impact-reply-textarea"
            placeholder={`Write a reply as ${currentAuthor.name || currentAuthor.first_name || 'user'}... (Ctrl+Enter to send)`}
            value={replyText}
            rows={2}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                handleSendReply(e);
              }
            }}
          />

          <div className="impact-reply-actions-row">
            <button
              type="button"
              className="impact-btn impact-btn-secondary"
              style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowReplyBox(false);
                setReplyText('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="impact-btn impact-btn-primary"
              style={{ padding: '5px 16px', fontSize: 12, fontWeight: 600 }}
              disabled={!replyText.trim() || isSendingReply}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendReply(e);
              }}
            >
              {isSendingReply ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
