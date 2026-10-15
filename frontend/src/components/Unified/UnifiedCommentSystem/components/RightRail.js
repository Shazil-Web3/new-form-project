/**
 * RightRail Component
 * Container for displaying comments sidebar on the right side
 * Shared across all comment modes
 */

import React, { useState } from 'react';
import CommentCard from './CommentCard';

const RightRail = ({ 
  comments = [],
  suggestions = [],
  onCommentClick,
  onCommentResolve,
  onCommentDelete,
  onSuggestionApprove,
  onSuggestionReject,
  showApprovalActions = false,
  isCollapsed = false,
  onToggleCollapse,
  isDraft = false,
  isRevise = false
}) => {
  const effectiveIsDraft = isRevise ? false : isDraft;
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' or 'suggestions'
  const [manualSwitchTab, setManualSwitchTab] = useState(null);

  const handleManualTabSwitch = (tab) => {
    if (effectiveIsDraft && tab !== 'comments') return;
    setActiveTab(tab);
    setManualSwitchTab(tab);
    setTimeout(() => setManualSwitchTab(null), 600);
  };

  const allItems = effectiveIsDraft || activeTab === 'comments' ? comments : suggestions;

  if (isCollapsed) {
    return (
      <div style={{
        width: '40px',
        background: '#f8f9fa',
        borderLeft: '1px solid #dee2e6',
        padding: '10px 5px',
      }}>
        <button
          onClick={() => onToggleCollapse?.(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
          }}
          title="Expand Comments"
        >
          💬
        </button>
      </div>
    );
  }

  return (
    <div className="right-rail" style={{
      width: '320px',
      background: '#f8f9fa',
      borderLeft: '1px solid #dee2e6',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
          {effectiveIsDraft || activeTab === 'comments' ? 'Comments' : 'Suggestions'}
        </div>
        <button
          onClick={() => onToggleCollapse?.(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
          }}
          title="Collapse Comments"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
      }}>
        <button
          className={`doc-rail__tab-btn ${manualSwitchTab === 'comments' ? 'manual-switch-active' : ''}`}
          onClick={() => handleManualTabSwitch('comments')}
          style={{
            flex: 1,
            padding: '10px',
            background: (effectiveIsDraft || activeTab === 'comments') ? 'white' : '#f8f9fa',
            border: 'none',
            borderBottom: (effectiveIsDraft || activeTab === 'comments') ? '2px solid #007bff' : 'none',
            cursor: 'pointer',
            fontWeight: (effectiveIsDraft || activeTab === 'comments') ? 'bold' : 'normal',
            color: (effectiveIsDraft || activeTab === 'comments') ? '#007bff' : '#666',
          }}
        >
          Comments ({comments.length})
        </button>
        {!effectiveIsDraft && (
          <button
            className={`doc-rail__tab-btn ${manualSwitchTab === 'suggestions' ? 'manual-switch-active' : ''}`}
            onClick={() => handleManualTabSwitch('suggestions')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'suggestions' ? 'white' : '#f8f9fa',
              border: 'none',
              borderBottom: activeTab === 'suggestions' ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'suggestions' ? 'bold' : 'normal',
              color: activeTab === 'suggestions' ? '#007bff' : '#666',
            }}
          >
            Suggestions ({suggestions.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {allItems.length === 0 ? (
          <p style={{
            color: '#666',
            fontSize: '14px',
            textAlign: 'center',
            marginTop: '40px',
            fontStyle: 'italic',
          }}>
            No {activeTab === 'comments' ? 'comments' : 'suggestions'} yet
          </p>
        ) : (
          allItems.map((item) => (
            <CommentCard
              key={item.id}
              comment={item}
              onClick={() => onCommentClick?.(item.id)}
              onResolve={activeTab === 'comments' ? onCommentResolve : undefined}
              onDelete={activeTab === 'comments' ? onCommentDelete : undefined}
              onApprove={activeTab === 'suggestions' ? onSuggestionApprove : undefined}
              onReject={activeTab === 'suggestions' ? onSuggestionReject : undefined}
              showApprovalActions={showApprovalActions && activeTab === 'suggestions'}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RightRail;
