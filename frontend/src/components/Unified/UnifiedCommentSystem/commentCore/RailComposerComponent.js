import React from "react";
import { Form, Button } from "react-bootstrap";

const RailComposerComponent = ({ system }) => {
  const {
    isCommenting, isSuggestingEdit, commentPosition, suggestEditPosition,
    commentText, suggestEditText, setCommentText, setSuggestEditText,
    handleSubmitComment, handleSubmitSuggestEdit, cancelFloatingElement
  } = system;

  if (!isCommenting && !isSuggestingEdit) return null;

  const selText = (isCommenting ? commentPosition?.selectedText : suggestEditPosition?.selectedText) || '';

  return (
    <div className="doc-rail__card doc-rail__composer">
      <div className="doc-rail__chip">{selText}</div>
      <Form.Control
        as="textarea"
        rows={3}
        value={isCommenting ? commentText : suggestEditText}
        placeholder={isCommenting ? "Add your comment…" : "Suggest your edit…"}
        onChange={(e) => isCommenting ? setCommentText(e.target.value) : setSuggestEditText(e.target.value)}
        autoFocus
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
};


export default RailComposerComponent;
export { RailComposerComponent };
