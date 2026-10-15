import React, { useState, useRef } from 'react';
import { useImpactComments } from './ImpactCommentContext';
import ImpactCommentThread from './ImpactCommentThread';

export default function ImpactCommentsGrid() {
  const {
    comments,
    addComment,
    resolveUser,
    availableActors = [],
    activeActorId,
    setActiveActorId,
  } = useImpactComments();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('Department Impact Assessment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localActorId, setLocalActorId] = useState(null);
  const gridContainerRef = useRef(null);

  const currentUser = resolveUser();
  const currentAuthor = (localActorId ? availableActors.find((a) => String(a.id) === String(localActorId)) : null) || resolveUser();
  const roleName = currentAuthor.role || (currentAuthor.is_admin ? 'Admin' : 'Member');
  const roleLower = String(roleName).toLowerCase();

  const handleCreateGeneralComment = async (e) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await addComment({
        text: newCommentText.trim(),
        selectedText: selectedTopic ? `[${selectedTopic}]` : '',
        context: selectedTopic,
        fieldIndex: null,
        isField: false,
        fieldName: selectedTopic,
        customAuthor: currentAuthor,
      });
      setNewCommentText('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      ref={gridContainerRef}
      id="impact-comments-grid-section"
      className="impact-comments-grid-container"
      aria-label="Department Impact Assessment Comments"
    >
      {/* ── Section Header ── */}
      <div className="impact-comments-grid-header">
        <div className="impact-comments-grid-title-area">
          <div className="impact-comments-grid-title">
            <span className="impact-comments-grid-icon">💬</span>
            <span>Department Impact Assessment Comments</span>
            <span className="impact-comments-count-pill">
              {comments.length}
            </span>
          </div>
          <span className="impact-comments-grid-subtitle">
            Review discussions, corrections, and feedback on filled fields and rollout impact
          </span>
        </div>

        <div className="impact-comments-grid-header-actions">
          {/* Add comment action */}
          <button
            type="button"
            className="impact-btn impact-btn-primary"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!isExpanded) setIsExpanded(true);
            }}
            title="Add a comment on the Department Impact Assessment"
          >
            <span>{showAddForm ? '✕ Close' : '+ Add Comment'}</span>
          </button>

          {/* Collapse/Expand toggle */}
          <button
            type="button"
            className="impact-btn impact-btn-ghost"
            style={{ fontSize: 13, padding: '4px 8px' }}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse comments' : 'Expand comments'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="impact-comments-grid-body">
          {/* ── Optional Inline Quick Comment Composer ── */}
          {showAddForm && (
            <div className="impact-grid-inline-composer">
              <div className="impact-composer-author-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>
                    {currentAuthor.name || currentAuthor.first_name || 'Current User'}
                  </span>
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
                    {roleName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ color: '#64748b' }}>Topic:</span>
                  <select
                    className="impact-grid-topic-select"
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                  >
                    <option value="Department Impact Assessment">Department Impact Assessment</option>
                    <option value="Impact Form Fields">Impact Form Fields</option>
                    <option value="Affected Systems / Processes">Affected Systems / Processes</option>
                    <option value="Implementation Effort">Implementation Effort</option>
                    <option value="General Review">General Review</option>
                  </select>
                </div>
              </div>

              <textarea
                className="impact-composer-textarea"
                placeholder="Write a comment or question about the department impact assessment... (Ctrl+Enter to submit)"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCreateGeneralComment();
                  }
                }}
              />

              <div className="impact-composer-actions">
                <button
                  type="button"
                  className="impact-btn impact-btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCommentText('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="impact-btn impact-btn-primary"
                  disabled={!newCommentText.trim() || isSubmitting}
                  onClick={handleCreateGeneralComment}
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          )}

          {/* ── Cards Grid ── */}
          {comments.length === 0 ? (
            <div className="impact-comments-grid-empty">
              <div className="impact-comments-empty-icon">💭</div>
              <div style={{ fontWeight: 600, color: '#334155', fontSize: 14, marginBottom: 4 }}>
                No comments on this assessment yet
              </div>
              <div style={{ fontSize: 12, color: '#64748b', maxWidth: 460, lineHeight: 1.5 }}>
                Select any text or filled field in the form above to add a targeted comment, or click
                {' '}<strong>+ Add Comment</strong> to leave general feedback on the Department Impact Assessment.
              </div>
            </div>
          ) : (
            <div className="impact-comments-cards-grid">
              {comments.map((comment) => (
                <ImpactCommentThread key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
