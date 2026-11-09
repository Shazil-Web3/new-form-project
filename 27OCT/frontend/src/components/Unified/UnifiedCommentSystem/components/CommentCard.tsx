/**
 * CommentCard Component
 * Displays a single comment or suggestion
 * Shared across all comment modes
 */

import React, { useState } from 'react';

const CommentCard = ({ 
  comment,
  onResolve,
  onDelete,
  onApprove,
  onReject,
  showApprovalActions = false,
  onClick
}) => {
  const {
    id,
    author,
    text,
    quotedText,
    timestamp,
    type = 'comment', // 'comment' or 'suggestion'
    status = 'pending' // 'pending', 'approved', 'rejected', 'resolved'
  } = comment;

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const isHistoryItem = status === 'resolved' || status === 'approved' || status === 'rejected' || status === 'declined';
  const [isCollapsed, setIsCollapsed] = useState(() => isHistoryItem);

  if (isHistoryItem && isCollapsed) {
    return (
      <div
        className={`comment-card ${type} history-suggestion collapsed`}
        onClick={onClick}
        style={{
          background: '#f8f9fa',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          padding: '6px 10px',
          marginBottom: '8px',
          opacity: 0.65,
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <div className="status-badge" style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            background: status === 'approved' ? '#4caf50' : status === 'resolved' ? '#17a2b8' : '#f44336',
            color: 'white',
            flexShrink: 0
          }}>
            {status === 'resolved' ? 'RESOLVED' : status === 'approved' ? 'ACCEPTED' : 'REJECTED'}
          </div>
          <span style={{ fontSize: '13px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text}
          </span>
        </div>
        <button
          type="button"
          title="Expand"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: '#666',
            fontSize: '12px',
            flexShrink: 0
          }}
        >
          <i className="bi bi-chevron-down"></i>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`comment-card ${type} ${isHistoryItem ? 'history-suggestion' : ''}`}
      onClick={onClick}
      style={{
        background: isHistoryItem ? '#f8f9fa' : 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px',
        opacity: isHistoryItem ? 0.65 : 1,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      {isHistoryItem && (
        <button
          type="button"
          title="Collapse"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(true);
          }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: '#666',
            fontSize: '12px'
          }}
        >
          <i className="bi bi-chevron-up"></i>
        </button>
      )}
      <div className="comment-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div className="comment-author" style={{
          fontWeight: 600,
          fontSize: '14px',
          color: '#333',
        }}>
          {author?.name || author?.email || 'Anonymous'}
        </div>
        <div className="comment-timestamp" style={{
          fontSize: '12px',
          color: '#666',
        }}>
          {formatTimestamp(timestamp)}
        </div>
      </div>

      {quotedText && (
        <div className="quoted-text" style={{
          background: '#f8f9fa',
          borderLeft: '3px solid #007bff',
          padding: '8px',
          margin: '8px 0',
          fontStyle: 'italic',
          fontSize: '13px',
          color: '#666',
        }}>
          "{quotedText}"
        </div>
      )}

      <div className="comment-text" style={{
        fontSize: '14px',
        color: '#444',
        lineHeight: '1.5',
        marginBottom: '8px',
      }}>
        {text}
      </div>

      {status && status !== 'pending' && (
        <div className="status-badge" style={{
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          background: status === 'approved' ? '#4caf50' : status === 'resolved' ? '#17a2b8' : status === 'rejected' || status === 'declined' ? '#f44336' : '#ff9800',
          color: 'white',
        }}>
          {status === 'resolved' ? 'RESOLVED' : status === 'approved' ? 'ACCEPTED' : status === 'rejected' || status === 'declined' ? 'REJECTED' : status.toUpperCase()}
        </div>
      )}

      {showApprovalActions && status === 'pending' && (
        <div className="approval-actions" style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #f0f0f0',
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove?.(id);
            }}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Approve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject?.(id);
            }}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Reject
          </button>
        </div>
      )}

      {onResolve && status !== 'resolved' && !showApprovalActions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResolve(id);
          }}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Resolve
        </button>
      )}

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          style={{
            marginTop: '8px',
            marginLeft: '8px',
            padding: '4px 8px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
};

export default CommentCard;
