import React from "react";
import { createPortal } from "react-dom";
import "../styles/TableContextMenu.css";

const MENU_ITEMS = [
  {
    section: "insert",
    items: [
      { id: "insertRowAbove", label: "Insert row above", icon: "bi-plus" },
      { id: "insertRowBelow", label: "Insert row below", icon: "bi-plus" },
      { id: "insertColumnLeft", label: "Insert column left", icon: "bi-plus" },
      { id: "insertColumnRight", label: "Insert column right", icon: "bi-plus" },
    ],
  },
  {
    section: "delete",
    items: [
      { id: "deleteRow", label: "Delete row", icon: "bi-trash" },
      { id: "deleteColumn", label: "Delete column", icon: "bi-trash" },
      { id: "deleteTable", label: "Delete table", icon: "bi-trash" },
    ],
  },
  {
    section: "actions",
    items: [
      { id: "mergeCells", label: "Merge cells", icon: "bi-grid-fill" },
      { id: "makeOption", label: "Make option", icon: "bi-list-check" },
    ],
  },
];

const TableContextMenu = ({ x, y, onAction, onClose }) => {
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

  const handleAction = (actionId) => {
    onAction(actionId);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="table-context-menu"
      data-ui-element="true"
      contentEditable={false}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
      role="menu"
      aria-label="Table options"
    >
      {MENU_ITEMS.map((group, groupIndex) => (
        <React.Fragment key={group.section}>
          {groupIndex > 0 && <div className="table-context-menu__divider" />}
          <div className="table-context-menu__section">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="table-context-menu__item"
                role="menuitem"
                onClick={() => handleAction(item.id)}
              >
                <i className={`bi ${item.icon} table-context-menu__icon`} aria-hidden />
                <span className="table-context-menu__label">{item.label}</span>
              </button>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>,
    document.body
  );
};

export default TableContextMenu;
