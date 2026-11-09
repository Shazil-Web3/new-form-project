import React, { useState } from "react";
import { Form, Button } from "react-bootstrap";
import { isDraftComment } from "../utils/unaddressedCommentsHelper";

const RailCardComponent = ({ item, system, composerTextareaRef }) => {
  const {
    isCommenting, commentText, setCommentText, suggestEditText, setSuggestEditText,
    handleSubmitComment, handleSubmitSuggestEdit, cancelFloatingElement,
    handleFloatingElementClick, handleFloatingElementEnter, handleFloatingElementLeave,
    user, deleteFloatingElement, resolveComment, freshlyResolvedIdsRef, enableReplies, toggleReply, activeReplyId,
    setActiveReplyId, replyText, setReplyText, replyComment, replySuggestedEdit,
    deleteReply,
    approveSuggestedEdit, declineSuggestedEdit,
    canApproveOrRejectItem
  } = system;

  const data = item?.data;
  const isComment = item?.type === 'comment' || data?.type === 'comment';
  const isDraftOrigin = isComment && isDraftComment(data, system?.commentContext);
  const isHistoryItem = data?.status === 'approved' || data?.status === 'declined' || data?.status === 'resolved';
  const isFreshlyResolved = Boolean(data?.id && freshlyResolvedIdsRef?.current?.has(data.id));

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isHistoryItem) {
      return !isFreshlyResolved;
    }
    return false;
  });

  if (item.type === 'composer') {
    return (
      <div className="doc-rail__card doc-rail__composer">
        <div className="doc-rail__chip">{item.data?.selectedText || ''}</div>
        <Form.Control
          as="textarea"
          rows={3}
          value={isCommenting ? commentText : suggestEditText}
          placeholder={isCommenting ? "Add your comment…" : "Suggest your edit…"}
          onChange={(e) => {
            const value = e.target.value;
            if (isCommenting) setCommentText(value);
            else setSuggestEditText(value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
          }}
          ref={composerTextareaRef}
          onFocus={(e) => {
            e.stopPropagation();
            const textLength = e.target.value.length;
            e.target.setSelectionRange(textLength, textLength);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ minHeight: '50px', resize: 'none' }}
        />
        <div className="mt-2 d-flex gap-2">
          {isCommenting ? (
            <Button type="button" size="sm" onClick={handleSubmitComment} disabled={!commentText.trim()}>Comment</Button>
          ) : (
            <Button type="button" size="sm" onClick={handleSubmitSuggestEdit} disabled={!suggestEditText.trim()}>Suggest</Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={cancelFloatingElement}>Cancel</Button>
        </div>
      </div>
    );
  }



  if (isHistoryItem && isCollapsed) {
    return (
      <div
        className="doc-rail__card history-suggestion collapsed"
        data-element-id={data.id}
        onClick={() => handleFloatingElementClick(data.id, item.type)}
        onMouseEnter={(e) => {
          e.currentTarget.classList.add('hovered');
          handleFloatingElementEnter(data.id, item.type, e);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.classList.remove('hovered');
          handleFloatingElementLeave(e);
        }}
        style={{ padding: '8px 10px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            <span className={`badge ${data.status === 'resolved' ? 'bg-info' : data.status === 'approved' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '10px', padding: '2px 6px', flexShrink: 0 }}>
              {data.status === 'resolved' ? 'Resolved' : data.status === 'approved' ? 'Accepted' : 'Rejected'}
            </span>
            <span style={{ fontSize: '13px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.text}
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
      </div>
    );
  }

  return (
    <div
      className={`doc-rail__card ${isHistoryItem ? 'history-suggestion' : ''}`}
      data-element-id={data.id}
      onClick={() => handleFloatingElementClick(data.id, item.type)}
      onMouseEnter={(e) => {
        e.currentTarget.classList.add('hovered');
        handleFloatingElementEnter(data.id, item.type, e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.classList.remove('hovered');
        handleFloatingElementLeave(e);
      }}
    >
      {isHistoryItem && (
        <button
          type="button"
          title="Collapse"
          className="float-end"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(true);
          }}
          style={{
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
      {user?.id === data.userId && !isHistoryItem && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger float-end"
          onClick={(e) => { e.stopPropagation(); deleteFloatingElement(data.id, item.type); }}
        >
          <i className="bi bi-trash"></i>
        </button>
      )}
      <div className="mb-2">
        <strong>{data.user}</strong>
        <div className="doc-rail__chip">{data.selectedText}</div>
      </div>

      {isComment ? (
        <div className="mb-2">
          <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {data.text}
          </div>
          {isHistoryItem && (
            <div className="mt-2">
              <span className={`badge ${data.status === 'resolved' ? 'bg-info' : data.status === 'approved' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '11px', padding: '4px 8px' }}>
                {data.status === 'resolved' ? 'Resolved' : data.status === 'approved' ? 'Accepted' : 'Rejected'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-2" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
          <div><strong>Original:</strong> <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{data.selectedText}</span></div>
          <div><strong>Suggested:</strong> <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{data.text}</span></div>
          {isHistoryItem && (
            <div className="mt-2">
              <span className={`badge ${data.status === 'approved' ? 'bg-success' : data.status === 'resolved' ? 'bg-info' : 'bg-danger'}`} style={{ fontSize: '11px', padding: '4px 8px' }}>
                {data.status === 'approved' ? 'Accepted' : data.status === 'resolved' ? 'Resolved' : 'Rejected'}
              </span>
            </div>
          )}
        </div>
      )}

      {((enableReplies && !isDraftOrigin) || (isComment && !isDraftOrigin && canApproveOrRejectItem(data))) && !isHistoryItem && (
        <div className="comment-actions">
          {enableReplies && !isDraftOrigin && (
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleReply(data.id); }}>
              💬 Reply {data.replies?.length > 0 && `(${data.replies.length})`}
            </button>
          )}
          {isComment && !isDraftOrigin && canApproveOrRejectItem(data) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resolveComment(data.id);
              }}
            >
              ✅ Resolve
            </button>
          )}
        </div>
      )}

      {canApproveOrRejectItem(data) && !isComment && !isHistoryItem && (
        <div className="mt-2 pt-2 border-top d-flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={(e) => {
              e.stopPropagation();
              approveSuggestedEdit(data.id);
            }}
            style={{ flex: 1 }}
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              declineSuggestedEdit(data.id);
            }}
            style={{ flex: 1 }}
          >
            Reject
          </Button>
        </div>
      )}

      {data.replies?.length > 0 && (
        <div className="reply-section">
          {data.replies.map(r => (
            <div key={r.id} className="reply-item d-flex justify-content-between align-items-start">
              <div style={{ flex: 1, paddingRight: '8px' }}>
                <strong>{r.user}:</strong> {r.text}
              </div>
              {(user?.id === r.userId || user?.email === r.userEmail) && (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger p-0"
                  style={{ opacity: 0.6, fontSize: '12px', border: 'none', background: 'transparent' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteReply(data.id, r.id, item.type);
                  }}
                  title="Delete reply"
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}




            </div>
          ))}
        </div>
      )}

      {!isDraftOrigin && activeReplyId === data.id && (
        <div className="reply-input">
          <Form.Control
            as="textarea"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            autoFocus
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="reply-input-actions">
            <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); isComment ? replyComment(user, data.id) : replySuggestedEdit(user, data.id); }} disabled={!replyText.trim()}>Submit</Button>
            <Button type="button" size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setActiveReplyId(null); setReplyText(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RailCardComponent;
export { RailCardComponent };
