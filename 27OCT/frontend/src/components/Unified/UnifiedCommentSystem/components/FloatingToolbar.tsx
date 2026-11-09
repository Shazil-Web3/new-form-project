/**
 * FloatingToolbar Component
 * Appears when text is selected, allowing users to add comments or suggestions
 * Shared across all comment modes
 */

import React from 'react';

const FloatingToolbar = ({ 
  position = { top: 0, left: 0 },
  onCommentClick,
  onSuggestionClick,
  visible = false,
  isDraft = false,
  isRevise = false,
}) => {
  const effectiveIsDraft = isRevise ? false : isDraft;
  if (!visible) return null;

  return (
    <div
      className="floating-toolbar"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateY(-100%)',
        marginTop: '-8px',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        padding: '4px',
        display: 'flex',
        gap: '4px',
        zIndex: 1000,
      }}
    >
      <button
        onClick={onCommentClick}
        style={{
          padding: '6px 12px',
          border: 'none',
          background: '#f8f9fa',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title="Add Comment"
      >
        <i className="bi bi-chat-left-text"></i>
        Comment
      </button>
      
      {!effectiveIsDraft && onSuggestionClick && (
        <button
          onClick={onSuggestionClick}
          style={{
            padding: '6px 12px',
            border: 'none',
            background: '#f8f9fa',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Add Suggestion"
        >
          <i className="bi bi-pencil-square"></i>
          Suggest
        </button>
      )}
    </div>
  );
};

export default FloatingToolbar;
