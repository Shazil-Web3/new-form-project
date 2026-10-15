import React from "react";
import { createPortal } from "react-dom";
import "../styles/TableContextMenu.css";

const EditorPasteContextMenu = ({ x, y, onPasteWithFormatting, onPasteWithoutFormatting, onClose }) => {
  const menuRef = React.useRef(null);
  const [position, setPosition] = React.useState({ top: y, left: x });

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let top = y;
    let left = x;

    if (left + rect.width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setPosition({ top, left });
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      className="table-context-menu editor-paste-context-menu"
      data-ui-element="true"
      contentEditable={false}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => {
        // Prevent stealing focus/selection from the editor
        e.preventDefault();
      }}
      role="menu"
      aria-label="Paste options"
    >
      <div className="table-context-menu__section">
        <button
          type="button"
          className="table-context-menu__item"
          role="menuitem"
          onClick={() => {
            onPasteWithFormatting();
            onClose();
          }}
        >
          <i className="bi bi-clipboard-check table-context-menu__icon" aria-hidden />
          <span className="table-context-menu__label">Paste with formatting</span>
        </button>
        <button
          type="button"
          className="table-context-menu__item"
          role="menuitem"
          onClick={() => {
            onPasteWithoutFormatting();
            onClose();
          }}
        >
          <i className="bi bi-clipboard table-context-menu__icon" aria-hidden />
          <span className="table-context-menu__label">Paste without formatting</span>
        </button>
      </div>
    </div>,
    document.body
  );
};

export default EditorPasteContextMenu;
