import React from "react";

const StrikePopupComponent = ({ system }) => {
  const { strikePopupState, acceptBackspaceStrike, rejectBackspaceStrike, hideBackspaceStrikePopup, strikePopupRef } = system;

  if (!strikePopupState.show || !strikePopupState.strikeIds?.length) return null;

  return (
    <div
      ref={strikePopupRef}
      className="backspace-strike-popup"
      data-ui-element="true"
      contentEditable="false"
      style={{
        top: strikePopupState.top,
        left: strikePopupState.left,
        position: 'absolute',
        zIndex: 2000
      }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="strike-popup-header">
        {strikePopupState.strikeIds.length > 1
          ? `${strikePopupState.strikeIds.length} changes selected`
          : `${strikePopupState.email || 'Reviewer'} edited this`}
      </div>
      <div className="strike-popup-actions">
        <button
          className="strike-reject"
          onClick={() => rejectBackspaceStrike(strikePopupState.strikeIds)}
          title="Reject all selected changes"
        >
          <i className="bi bi-x-lg"></i> Reject
        </button>
      </div>
    </div>
  );
};



export default StrikePopupComponent;
export { StrikePopupComponent };
