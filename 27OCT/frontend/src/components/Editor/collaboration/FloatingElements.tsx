import React from "react";
import { Form, Button } from "react-bootstrap";

const FloatingElements = ({
  showFloatingElements,
  showFloatingButton,
  setShowFloatingButton,
  floatingButtonPosition,
  handleAddComment,
  handleAddSuggestEdit,
  floatingElements,
  sidebarWidth,
  activeItemId,
  handleFloatingElementClick,
  userName,
  deleteFloatingElement,
  activeReplyId,
  setActiveReplyId,
  replyText,
  setReplyText,
  replyComment,
  replySuggestedEdit,
  adjustItemPositionsRef,
  realignFloatingItemsRef,
  approveSuggestedEdit,
  declineSuggestedEdit,
  isCommenting,
  commentPosition,
  commentText,
  setCommentText,
  handleSubmitComment,
  cancelFloatingElement,
  isSuggestingEdit,
  suggestEditPosition,
  suggestEditText,
  setSuggestEditText,
  handleSubmitSuggestEdit,
  isDraft = false,
}) => {
  if (!showFloatingElements) return null;

  return (
    <>
      {/* Floating buttons for adding comments and suggested edits */}
      {showFloatingButton && (
        <div 
          className="quick-access-toolbar"
          style={{ 
            top: `${floatingButtonPosition.top}px`, 
            left: `${floatingButtonPosition.left}px`,
          }}
        >
          <Button
            variant="light"
            className="toolbar-btn"
            onClick={() => {
              handleAddComment();
              setShowFloatingButton(false);
            }}
          >
            <i className="bi bi-chat-left-text me-1"></i>
            Comment
          </Button>
          {!isDraft && (
            <Button
              variant="light"
              className="toolbar-btn"
              onClick={() => {
                handleAddSuggestEdit();
                setShowFloatingButton(false);
              }}
            >
              <i className="bi bi-pencil-square me-1"></i>
              Suggest Edit
            </Button>
          )}
        </div>
      )}

      {/* Render floating comments */}
      {floatingElements
        .filter((element) => element.type === "comment")
        .map((comment) => (
          <div
            key={comment.id}
            className="floating-comment"
            data-comment-id={comment.id}
            style={{ top: `${comment.position.top}px`, left: `calc(${sidebarWidth}px + 70%)`, background: activeItemId === comment.id ? "lightyellow" : "white" }}
            onClick={() => handleFloatingElementClick(comment.id, "comment")}
          >

          {userName === comment.user && (
          /* Delete Button */
          <button 
            className="delete-floating-item"
            onClick={(e) => {
              e.stopPropagation();
              deleteFloatingElement(comment.id, "comment");
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
          )}

            <li className="mb-2 floating-item">
              <strong>
                {comment.user}
                <br />
                commented on:
                <span className="badge bg-success badge-ellipsis">{comment.selectedText}</span>
                <br />
              </strong>
              {comment.text}
            </li>

            {/* Display Replies */}
            {comment.replies.length > 0 && (
              <ul className="mt-2">
                {comment.replies.map((reply) => (
                  <li key={reply.id} className="text-secondary">
                    <strong>{reply.user}:</strong> {reply.text}
                  </li>
                ))}
              </ul>
            )}

            {/* Reply Input Field (Shows Only When Reply Button Clicked) */}
            {activeReplyId !== comment.id && (
              <div className="mt-2 d-flex align-items-center gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div
                  className="btn btn-primary btn-lg mt-1"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    replyComment(userName, comment.id);
                    setActiveReplyId(null); // Close the reply input
                    
                    // Allow the DOM to update before adjusting positions
                    setTimeout(() => {
                      adjustItemPositionsRef.current();
                      realignFloatingItemsRef.current(); // Add realignment after submitting reply
                    }, 10);
                  }}
                >
                  <i className="bi bi-send" style={{ pointerEvents: 'none' }}></i>
                </div>
              </div>
            )}

            {comment.status === "deleted" && <p className="text-danger mt-2">✖ Deleted</p>}
          </div>
        ))}

      {/* Render floating suggested edits */}
      {floatingElements
        .filter((element) => element.type === "suggestededit")
        .map((suggestededit) => (
          <div
            key={suggestededit.id}
            className="floating-suggestededit"
            data-suggestededit-id={suggestededit.id}
            style={{ top: `${suggestededit.position.top}px`, left: `calc(${sidebarWidth}px + 70%)`, background: activeItemId === suggestededit.id ? "lightyellow" : "white" }}
            onClick={() => handleFloatingElementClick(suggestededit.id, "suggestededit")}
          >

          {userName === suggestededit.user && (
          /* Delete Button */
          <button 
            className="delete-floating-item"
            onClick={(e) => {
              e.stopPropagation();
              deleteFloatingElement(suggestededit.id, "suggestededit");
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
          )}

            <li className="mb-2 floating-item">
              <strong>
                {suggestededit.user}
                <br />
                Replace:
                <p>
                  "{suggestededit.selectedText}" with "
                  <span style={{ color: "blue" }}>{suggestededit.text}</span>"
                </p>
              </strong>
            </li>

            {/* Display Replies */}
            {suggestededit.replies.length > 0 && (
              <ul className="mt-2">
                {suggestededit.replies.map((reply) => (
                  <li key={reply.id} className="text-secondary">
                    <strong>{reply.user}:</strong> {reply.text}
                  </li>
                ))}
              </ul>
            )}

            <div className="d-flex justify-content-end mt-2 gap-2">
              {suggestededit.status === "pending" && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      approveSuggestedEdit(suggestededit.id);
                      setTimeout(() => {
                        adjustItemPositionsRef.current();
                        realignFloatingItemsRef.current(); // Add realignment
                      }, 10);
                    }}
                  >
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger" 
                    onClick={() => {
                      declineSuggestedEdit(suggestededit.id);
                      setTimeout(() => {
                        adjustItemPositionsRef.current();
                        realignFloatingItemsRef.current(); // Add realignment
                      }, 10);
                    }}
                  >
                    Decline
                  </Button>
                </>
              )}
            </div>

            {/* Reply Input Field (Shows Only When Reply Button Clicked) */}
            {activeReplyId !== suggestededit.id && (
              <div className="mt-2 d-flex align-items-center gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <Button
                  className="btn btn-primary btn-lg mt-1"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    replySuggestedEdit(userName, suggestededit.id);
                    setActiveReplyId(null); // Close the reply input
                    
                    // Allow the DOM to update before adjusting positions
                    setTimeout(() => {
                      adjustItemPositionsRef.current();
                      realignFloatingItemsRef.current(); // Add realignment after submitting reply
                    }, 10);
                  }}
                >
                  <i className="bi bi-send" style={{ pointerEvents: 'none' }}></i>
                </Button>
              </div>
            )}

            {suggestededit.status === "approved" && (
              <p className="text-success mt-2">✔ Approved</p>
            )}

            {suggestededit.status === "declined" && (
              <p className="text-danger mt-2">✖ Declined</p>
            )}

            {suggestededit.status === "deleted" && (
              <p className="text-danger mt-2">✖ Deleted</p>
            )}
          </div>
        ))}

      {/* Comment Input Field */}
      {isCommenting && commentPosition?.top !== undefined && (
        <div
          className="item-input"
          style={{ top: `${commentPosition.top}px`, left: `calc(${sidebarWidth}px + 70%)` }}
        >
          <strong>
            {userName}
            <br />
            commenting on:
            <span className="badge bg-success badge-ellipsis">{commentPosition.selectedText}</span>
            <br />
          </strong>
          <Form.Control
            type="textarea"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
            autoFocus
          />
          <div className="col">
            <Button size="sm" variant="success" onClick={handleSubmitComment}>
              Submit
            </Button>{" "}
            <Button 
              size="sm" 
              variant="danger" 
              onClick={() => {
                cancelFloatingElement("comment");
                setTimeout(() => {
                  adjustItemPositionsRef.current();
                  realignFloatingItemsRef.current(); // Add realignment after canceling
                }, 10);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Suggested Edit Input Field */}
      {isSuggestingEdit && suggestEditPosition?.top !== undefined && (
        <div
          className="item-input"
          style={{ top: `${suggestEditPosition.top}px`, left: `calc(${sidebarWidth}px + 70%)` }}
        >
          <strong>
            {userName}
            <br />
            Replace:
            <span className="badge bg-success badge-ellipsis">"{suggestEditPosition.selectedText}"</span> with
            <br />
          </strong>
          <Form.Control
            type="textarea"
            placeholder="Suggest a replacement..."
            value={suggestEditText}
            onChange={(e) => setSuggestEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitSuggestEdit()}
            autoFocus
          />
          <div className="col">
            <Button size="sm" variant="success" onClick={handleSubmitSuggestEdit}>
              Submit
            </Button>{" "}
            <Button 
              size="sm" 
              variant="danger" 
              onClick={() => {
                cancelFloatingElement("suggestededit");
                setTimeout(() => {
                  adjustItemPositionsRef.current();
                  realignFloatingItemsRef.current(); // Add realignment after canceling
                }, 10);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingElements;