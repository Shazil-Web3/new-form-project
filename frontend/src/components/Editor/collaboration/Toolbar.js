import { Dropdown, Button } from "react-bootstrap";
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios"; // Make sure axios is imported
import { applyTextAlignment } from "../textAlignment/textAlignment";

const toolbarFunctions = {
  applyStyle: (style) => {
    document.execCommand(style, false, null);
  },

  setAlignment: (alignment) => {
    applyTextAlignment(alignment);
  },

  insertList: (type) => {
    document.execCommand(type === "ordered" ? "insertOrderedList" : "insertUnorderedList", false, null);
  },

  insertMultilevelNumberedList: (type) => {
    document.execCommand(type, false, null);
    
    let selection = window.getSelection();
    let selectedNode = selection.focusNode;

    while (selectedNode && selectedNode.nodeName !== "OL") {
      selectedNode = selectedNode.parentNode;
    }

    if (selectedNode) {
      selectedNode.classList.add("custom-numbered-list");
    }
  },

  undo: () => {
    document.execCommand("undo", false, null);
  },

  redo: () => {
    document.execCommand("redo", false, null);
  },

  changePaperSize: (setPaperSize, size) => {
    setPaperSize(size);
  },

  changeHeading: (heading) => {
    if (document.getSelection) {
      document.execCommand("formatBlock", false, heading);
    }
  },
  
  changeFont: (fontName) => {
    document.execCommand("fontName", false, fontName);
  },
  
  changeFontSize: (size) => {
    document.execCommand("fontSize", false, size);
  },
  
  changeTextColor: (color) => {
    document.execCommand("foreColor", false, color);
  },
  
  changeHighlightColor: (color) => {
    document.execCommand("hiliteColor", false, color);
  },
  
  applyFormatting: (command, value = null) => {
    document.execCommand(command, false, value);
  },

  saveVersion: (docId) => {
    console.log("Saving document version for:", docId);
    // Add actual save logic here
  },

  updateStatus: async (docId, status) => {
    try {
      const response = await axios.put(`/api/update-document-status/${docId}`, { status });
      
      if (response.data.success) {
        // You could add a notification system here
        console.log(`Document status updated to ${status} successfully`);
        return true;
      } else {
        console.error('Failed to update document status:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('Error updating document status:', error.response?.data?.message || error.message);
      return false;
    }
  }
};

const handleKeyDown = (event) => {
  let selection = window.getSelection();
  let range = selection.getRangeAt(0);
  let listItem = range.startContainer;

  // Find the nearest <li> element
  while (listItem && listItem.nodeName !== "LI") {
      listItem = listItem.parentNode;
  }

  // Only handle tabbing inside a `.custom-numbered-list`
  if (listItem && listItem.closest(".custom-numbered-list")) {
      if (event.key === "Tab") {
          event.preventDefault(); // Prevent default tab behavior

          if (event.shiftKey) {
              // Shift + Tab: Outdent
              let parentList = listItem.parentNode;
              if (parentList.nodeName === "OL" && parentList.classList.contains("custom-numbered-list")) {
                  parentList.parentNode.insertBefore(listItem, parentList.nextSibling);
                  if (!parentList.hasChildNodes()) {
                      parentList.remove();
                  }
              }
          } else {
              // Tab: Indent
              let prevItem = listItem.previousElementSibling;
              if (prevItem) {
                  let sublist = prevItem.querySelector("ol");
                  if (!sublist) {
                      sublist = document.createElement("ol");
                      sublist.classList.add("custom-numbered-list");
                      prevItem.appendChild(sublist);
                  }
                  sublist.appendChild(listItem);
              }
          }
      }
  } else {
      // If not in a numbered list, ensure normal typing behavior
      if (event.key === "Tab") {
          event.preventDefault();
          document.execCommand("insertText", false, "    "); // Insert 4 spaces
      }
  }
};

// Common font families
const fontFamilies = [
  "Arial", 
  "Helvetica", 
  "Times New Roman", 
  "Times", 
  "Courier New", 
  "Courier", 
  "Verdana", 
  "Georgia", 
  "Palatino", 
  "Garamond", 
  "Bookman", 
  "Comic Sans MS", 
  "Trebuchet MS", 
  "Arial Black", 
  "Impact"
];

// Common font sizes
const fontSizes = [
  { value: 1, label: "8pt" },
  { value: 2, label: "10pt" },
  { value: 3, label: "12pt" },
  { value: 4, label: "14pt" },
  { value: 5, label: "18pt" },
  { value: 6, label: "24pt" },
  { value: 7, label: "36pt" }
];

// Color options
const colorOptions = [
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#0000FF", name: "Blue" },
  { color: "#008000", name: "Green" },
  { color: "#FFA500", name: "Orange" },
  { color: "#800080", name: "Purple" },
  { color: "#FFC0CB", name: "Pink" },
  { color: "#A52A2A", name: "Brown" },
  { color: "#808080", name: "Gray" },
  { color: "#FFFF00", name: "Yellow" }
];

const TABLE_PICKER_MAX = 10;

const NumberedListIcon = ({ size = 16, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <path d="M4.5 4h1.5v6H4.5V5.5H3V4.2L4.5 4z" />
    <path d="M3 13.8c0-1.4 1-2.3 2.5-2.3 1.4 0 2.5.9 2.5 2.2 0 .9-.5 1.6-1.3 2.3l-1.4 1.3H8V19H3v-1.2l2.6-2.4c.5-.5.8-.9.8-1.5 0-.7-.5-1.1-1.2-1.1-.7 0-1.2.4-1.2 1.1H3z" />
    <rect x="10.5" y="5" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="11" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="17" width="10.5" height="2" rx="1" />
  </svg>
);

const BulletedListIcon = ({ size = 16, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="5" cy="6" r="2.5" />
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="5" cy="18" r="2.5" />
    <rect x="10.5" y="5" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="11" width="10.5" height="2" rx="1" />
    <rect x="10.5" y="17" width="10.5" height="2" rx="1" />
  </svg>
);

const Toolbar = ({
  paperSize,
  setPaperSize,
  docId,
  userName,
  user,
  setSubmitDocumentModalVisible,
  orientation,
  setOrientation,
  onInsertTable
}) => {
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const [isMouseDownSelecting, setIsMouseDownSelecting] = useState(false);
  const tablePickerRef = useRef(null);

  const [isListPickerOpen, setIsListPickerOpen] = useState(false);
  const listPickerRef = useRef(null);
  const listHoverTimeoutRef = useRef(null);

  const handleListMouseEnter = () => {
    if (listHoverTimeoutRef.current) clearTimeout(listHoverTimeoutRef.current);
    setIsListPickerOpen(true);
  };

  const handleListMouseLeave = () => {
    listHoverTimeoutRef.current = setTimeout(() => {
      setIsListPickerOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleDocumentMouseUp = () => {
      setIsMouseDownSelecting(false);
    };

    const handleClickOutside = (event) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(event.target)) {
        setIsTablePickerOpen(false);
      }
      if (listPickerRef.current && !listPickerRef.current.contains(event.target)) {
        setIsListPickerOpen(false);
      }
    };

    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const gridCells = useMemo(() => {
    return Array.from({ length: TABLE_PICKER_MAX * TABLE_PICKER_MAX }, (_, index) => {
      const row = Math.floor(index / TABLE_PICKER_MAX) + 1;
      const col = (index % TABLE_PICKER_MAX) + 1;
      return { row, col };
    });
  }, []);

  const insertSelectedTable = (rows, cols) => {
    if (!rows || !cols || typeof onInsertTable !== "function") return;
    onInsertTable(rows, cols);
    setIsTablePickerOpen(false);
    setIsMouseDownSelecting(false);
  };

  const handleGridCellEnter = (row, col) => {
    setTableHover({ rows: row, cols: col });
  };

  return (
    <div className="toolbar bg-light p-2 d-flex justify-content-between align-items-center flex-wrap">
      <div className="d-flex flex-wrap">
      {/* Orientation Toggle */}
      <Button
        variant={orientation === 'portrait' ? 'dark' : 'outline-dark'}
        className="me-2 mb-1"
        onClick={() => setOrientation && setOrientation('portrait')}
        disabled={orientation === 'portrait'}
      >
        Portrait
      </Button>
      <Button
        variant={orientation === 'landscape' ? 'dark' : 'outline-dark'}
        className="me-3 mb-1"
        onClick={() => setOrientation && setOrientation('landscape')}
        disabled={orientation === 'landscape'}
      >
        Landscape
      </Button>

      {/* Font Family Dropdown */}
      <Dropdown onSelect={toolbarFunctions.changeFont} className="me-2 mb-1">
        <Dropdown.Toggle variant="secondary">Font</Dropdown.Toggle>
        <Dropdown.Menu style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {fontFamilies.map((font) => (
            <Dropdown.Item key={font} eventKey={font} style={{ fontFamily: font }}>
              {font}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      {/* Font Size Dropdown */}
      <Dropdown onSelect={toolbarFunctions.changeFontSize} className="me-2 mb-1">
        <Dropdown.Toggle variant="secondary">Size</Dropdown.Toggle>
        <Dropdown.Menu>
          {fontSizes.map((size) => (
            <Dropdown.Item key={size.value} eventKey={size.value}>
              {size.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      {/* Text Color Dropdown */}
      {/* <Dropdown className="me-2 mb-1">
        <Dropdown.Toggle variant="secondary">
          <i className="bi bi-paint-bucket"></i> Color
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <div className="d-flex flex-wrap p-2" style={{ width: '200px' }}>
            {colorOptions.map((colorOption) => (
              <div 
                key={colorOption.color}
                onClick={() => toolbarFunctions.changeTextColor(colorOption.color)} 
                style={{
                  backgroundColor: colorOption.color,
                  width: '20px',
                  height: '20px',
                  margin: '2px',
                  cursor: 'pointer',
                  border: '1px solid #ddd'
                }}
                title={colorOption.name}
              />
            ))}
          </div>
        </Dropdown.Menu>
      </Dropdown> */}

      {/* Highlight Color Dropdown */}
      {/* <Dropdown className="me-2 mb-1">
        <Dropdown.Toggle variant="secondary">
          <i className="bi bi-highlighter"></i> Highlight
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <div className="d-flex flex-wrap p-2" style={{ width: '200px' }}>
            {colorOptions.map((colorOption) => (
              <div 
                key={colorOption.color}
                onClick={() => toolbarFunctions.changeHighlightColor(colorOption.color)} 
                style={{
                  backgroundColor: colorOption.color,
                  width: '20px',
                  height: '20px',
                  margin: '2px',
                  cursor: 'pointer',
                  border: '1px solid #ddd'
                }}
                title={colorOption.name}
              />
            ))}
            <div 
              onClick={() => toolbarFunctions.changeHighlightColor('transparent')} 
              style={{
                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
                backgroundSize: '10px 10px',
                backgroundPosition: '0 0, 5px 5px',
                width: '20px',
                height: '20px',
                margin: '2px',
                cursor: 'pointer',
                border: '1px solid #ddd'
              }}
              title="No Highlight"
            />
          </div>
        </Dropdown.Menu>
      </Dropdown> */}

      {/* Heading Dropdown */}
      <Dropdown onSelect={toolbarFunctions.changeHeading} className="me-2 mb-1">
        <Dropdown.Toggle variant="secondary">Heading</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item eventKey="p">Paragraph</Dropdown.Item>
          <Dropdown.Item eventKey="h1">Heading 1</Dropdown.Item>
          <Dropdown.Item eventKey="h2">Heading 2</Dropdown.Item>
          <Dropdown.Item eventKey="h3">Heading 3</Dropdown.Item>
          <Dropdown.Item eventKey="h4">Heading 4</Dropdown.Item>
          <Dropdown.Item eventKey="h5">Heading 5</Dropdown.Item>
          <Dropdown.Item eventKey="h6">Heading 6</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      {/* Text Formatting Options */}
      {["bold", "italic", "underline"].map((style) => (
        <Button key={style} onClick={() => toolbarFunctions.applyStyle(style)} variant="outline-dark" className="me-2 mb-1">
          <i className={`bi bi-type-${style}`}></i>
        </Button>
      ))}

      {/* Text Alignment */}
      {["left", "center", "right"].map((align) => (
        <Button key={align} onClick={() => toolbarFunctions.setAlignment(align)} variant="outline-dark" className="me-2 mb-1">
          <i className={`bi bi-text-${align}`}></i>
        </Button>
      ))}

      <Button onClick={() => toolbarFunctions.setAlignment("justify")} variant="outline-dark" className="me-2 mb-1">
        <i className="bi bi-justify"></i>
      </Button>

      {/* Additional Formatting Options */}
      <Button onClick={() => toolbarFunctions.applyFormatting("subscript")} variant="outline-dark" className="me-2 mb-1" title="Subscript">
        <i className="bi bi-subscript"></i>
      </Button>
      
      <Button onClick={() => toolbarFunctions.applyFormatting("superscript")} variant="outline-dark" className="me-2 mb-1" title="Superscript">
        <i className="bi bi-superscript"></i>
      </Button>

      {/* List Dropdown (Numbering & Bullet points) */}
      <div 
        className="position-relative me-2 mb-1" 
        ref={listPickerRef} 
        style={{ display: "inline-block" }}
        onMouseEnter={handleListMouseEnter}
        onMouseLeave={handleListMouseLeave}
      >
        <Button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsListPickerOpen((prev) => !prev)}
          variant="outline-dark" 
          title="Lists"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: isListPickerOpen ? "#e8eaed" : undefined
          }}
        >
          <NumberedListIcon size={16} />
          <i className="bi bi-caret-down-fill" style={{ fontSize: "8px", opacity: 0.7 }}></i>
        </Button>

        {isListPickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              gap: "2px",
              padding: "3px 4px",
              backgroundColor: "#ffffff",
              border: "1px solid #dadce0",
              borderRadius: "6px",
              boxShadow: "0 2px 6px 2px rgba(60,64,67,0.15)",
              whiteSpace: "nowrap"
            }}
          >
            <button
              type="button"
              title="Numbered List"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                toolbarFunctions.insertList("ordered");
                setIsListPickerOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "30px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: "transparent",
                color: "#444746",
                cursor: "pointer",
                transition: "background-color 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f1f3f4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <NumberedListIcon size={16} />
            </button>
            <button
              type="button"
              title="Bulleted List"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                toolbarFunctions.insertList("unordered");
                setIsListPickerOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "30px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: "transparent",
                color: "#444746",
                cursor: "pointer",
                transition: "background-color 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f1f3f4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <BulletedListIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Table insertion */}
      <div className="position-relative me-2 mb-1" ref={tablePickerRef}>
        <Button
          variant="outline-dark"
          onClick={() => setIsTablePickerOpen((prev) => !prev)}
          title="Insert table"
        >
          <i className="bi bi-table"></i>
        </Button>
        {isTablePickerOpen && (
          <div
            className="bg-white border rounded shadow-sm p-2"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 1200,
              minWidth: "220px"
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${TABLE_PICKER_MAX}, 18px)`,
                gap: "3px",
                touchAction: "none"
              }}
            >
              {gridCells.map((cell) => {
                const isSelected = cell.row <= tableHover.rows && cell.col <= tableHover.cols;
                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setIsMouseDownSelecting(true);
                      setTableHover({ rows: cell.row, cols: cell.col });
                    }}
                    onMouseEnter={() => handleGridCellEnter(cell.row, cell.col)}
                    onMouseUp={(event) => {
                      event.preventDefault();
                      insertSelectedTable(cell.row, cell.col);
                    }}
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "1px solid #c8ccd0",
                      padding: 0,
                      background: isSelected ? "#0d6efd" : "#ffffff",
                      borderRadius: "2px"
                    }}
                    aria-label={`Insert ${cell.row} by ${cell.col} table`}
                  />
                );
              })}
            </div>
            <div className="mt-2 small text-muted">
              {tableHover.rows > 0 && tableHover.cols > 0
                ? `${tableHover.rows} x ${tableHover.cols}`
                : "Select table size"}
            </div>
          </div>
        )}
      </div>

      {/* Undo/Redo */}
      <Button onClick={toolbarFunctions.undo} variant="outline-dark" className="me-2 mb-1">
        <i className="bi bi-arrow-counterclockwise"></i>
      </Button>
      <Button onClick={toolbarFunctions.redo} variant="outline-dark" className="me-2 mb-1">
        <i className="bi bi-arrow-clockwise"></i>
      </Button>
    </div>

    <div className="d-flex">
      {user?.role === 'admin' && (
        <Button onClick={() => setSubmitDocumentModalVisible(true)}>
            <i className="bi bi-save me-1"></i> Submit
        </Button>
      )}
    </div>
    </div>
  );
};

export { Toolbar, handleKeyDown, toolbarFunctions, fontFamilies, fontSizes, colorOptions };