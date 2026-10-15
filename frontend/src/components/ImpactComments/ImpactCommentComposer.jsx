import React, { useState, useEffect, useRef } from 'react';
import { useImpactComments } from './ImpactCommentContext';

export default function ImpactCommentComposer() {
  const {
    selectionState,
    isComposerOpen,
    setIsComposerOpen,
    setSelectionState,
    addComment,
    resolveUser,
    availableActors = [],
    activeActorId,
    setActiveActorId,
  } = useImpactComments();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localActorId, setLocalActorId] = useState(null);
  const cardRef = useRef(null);
  const textareaRef = useRef(null);

  const currentUser = resolveUser();
  const currentAuthor = (localActorId ? availableActors.find((a) => String(a.id) === String(localActorId)) : null) || resolveUser();
  const roleName = currentAuthor.role || (currentAuthor.is_admin ? 'Admin' : 'Member');
  const roleLower = String(roleName).toLowerCase();

  useEffect(() => {
    if (isComposerOpen) {
      setCommentText('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isComposerOpen]);

  // Handle clicking outside to dismiss
  useEffect(() => {
    if (!isComposerOpen) return;

    const handleMouseDownOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setIsComposerOpen(false);
        setSelectionState(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDownOutside);
    return () => {
      document.removeEventListener('mousedown', handleMouseDownOutside);
    };
  }, [isComposerOpen, setIsComposerOpen, setSelectionState]);

  if (!isComposerOpen || !selectionState) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await addComment({
        text: commentText.trim(),
        selectedText: selectionState.text,
        context: selectionState.context,
        fieldIndex: selectionState.fieldIndex,
        isField: selectionState.isField,
        fieldName: selectionState.fieldName,
        fieldValue: selectionState.fieldValue,
        fields: selectionState.fields || [],
        customAuthor: currentAuthor,
      });
      setCommentText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsComposerOpen(false);
      setSelectionState(null);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Positioning coordinates
  const rect = selectionState.rect || {};
  const cardWidth = 320;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.left != null ? rect.left - cardWidth / 2 : viewportWidth / 2 - cardWidth / 2;
  // Keep inside viewport horizontally
  left = Math.max(16, Math.min(viewportWidth - cardWidth - 16, left));

  let top = rect.top != null ? rect.top + 15 : viewportHeight / 2 - 100;
  // If too close to bottom, position above
  if (top + 200 > viewportHeight) {
    top = Math.max(20, (rect.top || 100) - 220);
  }

  return (
    <div
      ref={cardRef}
      className="impact-composer-card"
      style={{
        top: `${top}px`,
        left: `${left}px`,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Quoted snippet */}
      <div className="impact-composer-quote" title={selectionState.text}>
        {selectionState.isField ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="impact-field-pill-badge">
              🏷️ {selectionState.fieldName || 'Field'}
            </span>
            <span style={{ fontWeight: 600, color: '#1d4ed8' }}>
              “{selectionState.fieldValue || selectionState.text}”
            </span>
          </div>
        ) : (
          <div>
            {selectionState.fields && selectionState.fields.length > 0 && (
              <div style={{ marginBottom: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selectionState.fields.map((f, idx) => (
                  <span key={idx} className="impact-field-pill-badge">
                    🏷️ {f.fieldName}: “{f.fieldValue || '(empty)'}”
                  </span>
                ))}
              </div>
            )}
            <div>“{selectionState.text}”</div>
          </div>
        )}
      </div>

      {/* Author badge bar - read-only indicator */}
      <div className="impact-composer-author-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      </div>

      {/* Input textarea */}
      <textarea
        ref={textareaRef}
        className="impact-composer-textarea"
        placeholder="Add a comment or suggestion... (Ctrl+Enter to post)"
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        rows={3}
      />

      {/* Actions */}
      <div className="impact-composer-actions">
        <button
          type="button"
          className="impact-btn impact-btn-secondary"
          onClick={() => {
            setIsComposerOpen(false);
            setSelectionState(null);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="impact-btn impact-btn-primary"
          disabled={!commentText.trim() || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
