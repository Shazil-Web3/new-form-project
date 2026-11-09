import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "bootstrap-icons/font/bootstrap-icons.css";

const MakeOptionModal = ({ visible, onClose, onCreate, initialOptions = [] }) => {
  const [options, setOptions] = useState(
    initialOptions.length > 0 ? initialOptions : [""]
  );
  const [error, setError] = useState("");
  const [applyToVerticalBelow, setApplyToVerticalBelow] = useState(false);
  const containerRef = useRef(null);

  // Focus the first input on open
  useEffect(() => {
    if (visible && containerRef.current) {
      const firstInput = containerRef.current.querySelector(
        ".option-input-field"
      );
      if (firstInput) {
        firstInput.focus();
      }
      setOptions(initialOptions.length > 0 ? initialOptions : [""]);
      setError("");
      setApplyToVerticalBelow(false);
    }
  }, [visible, initialOptions]);

  if (!visible) return null;

  const handleAddOption = () => {
    setOptions([...options, ""]);
    setError("");
  };

  const handleRemoveOption = (index) => {
    if (options.length === 1) return;
    const newOptions = options.filter((_, idx) => idx !== index);
    setOptions(newOptions);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    setError("");
  };

  const handleSave = (e) => {
    e.preventDefault();
    const filtered = options.map((opt) => opt.trim()).filter(Boolean);
    if (filtered.length === 0) {
      setError("Please provide at least one valid option.");
      return;
    }
    onCreate(filtered, applyToVerticalBelow);
    onClose();
  };

  const handleDeleteDropdown = () => {
    onCreate(null, applyToVerticalBelow);
    onClose();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If we are on the last field, create a new one, otherwise focus next
      if (index === options.length - 1) {
        handleAddOption();
        setTimeout(() => {
          if (containerRef.current) {
            const inputs = containerRef.current.querySelectorAll(".option-input-field");
            const nextInput = inputs[inputs.length - 1];
            if (nextInput) nextInput.focus();
          }
        }, 50);
      } else {
        if (containerRef.current) {
          const inputs = containerRef.current.querySelectorAll(".option-input-field");
          if (inputs[index + 1]) inputs[index + 1].focus();
        }
      }
    }
  };

  return ReactDOM.createPortal(
    <div className="make-option-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className="make-option-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="make-option-header">
          <div className="title-section">
            <div className="icon-wrapper">
              <i className="bi bi-list-check"></i>
            </div>
            <h5 id="modal-title">Convert Cell to Dropdown</h5>
          </div>
          <button className="close-x-btn" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="make-option-body">
            <p className="subtitle">
              Configure options for the cell's drop-down menu. The first option will be the default.
            </p>

            {error && (
              <div className="error-alert">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span>{error}</span>
              </div>
            )}

            <div className="options-scroll-container">
              {options.map((option, idx) => (
                <div key={idx} className="option-row">
                  <div className="option-number">{idx + 1}</div>
                  <input
                    type="text"
                    className="option-input-field"
                    value={option}
                    placeholder="Type here"
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                  />
                  <button
                    type="button"
                    className="trash-btn"
                    disabled={options.length === 1}
                    onClick={() => handleRemoveOption(idx)}
                    aria-label={`Remove option ${idx + 1}`}
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="add-option-btn"
              onClick={handleAddOption}
            >
              <i className="bi bi-plus-lg"></i> Add Option
            </button>

            <label className="vertical-fill-option">
              <input
                type="checkbox"
                checked={applyToVerticalBelow}
                onChange={(e) => setApplyToVerticalBelow(e.target.checked)}
              />
              <span>Use this option in all vertical cells below</span>
            </label>
          </div>

          <div className="make-option-footer">
            {initialOptions.length > 0 && (
              <button type="button" className="delete-dropdown-btn" onClick={handleDeleteDropdown}>
                Remove Dropdown
              </button>
            )}
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="create-btn">
              Create Menu
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .make-option-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10100;
          animation: overlayFadeIn 0.3s ease-out;
        }

        .make-option-card {
          width: 440px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 18px;
          box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.15), 
                      0 1px 3px 0 rgba(0, 0, 0, 0.05),
                      inset 0 0 0 1px rgba(255, 255, 255, 0.3);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: cardSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .make-option-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(255, 255, 255, 0.35);
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, hsl(220, 95%, 60%), hsl(220, 95%, 45%));
          border-radius: 8px;
          color: white;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
        }

        .make-option-header h5 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }

        .close-x-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        }

        .close-x-btn:hover {
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }

        .make-option-body {
          padding: 24px;
        }

        .subtitle {
          margin: 0 0 16px 0;
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
          color: #b91c1c;
          font-size: 13px;
        }

        .options-scroll-container {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 16px;
          padding-right: 4px;
        }

        /* Customize Scrollbar */
        .options-scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .options-scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .options-scroll-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .options-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .option-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          animation: rowInsert 0.2s ease-out;
        }

        .option-number {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          width: 20px;
          text-align: center;
        }

        .option-input-field {
          flex: 1;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .option-input-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .trash-btn {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        }

        .trash-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
        }

        .trash-btn:disabled {
          color: #cbd5e1;
          cursor: not-allowed;
        }

        .add-option-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          background: rgba(15, 23, 42, 0.05);
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
        }

        .add-option-btn:hover {
          background: rgba(37, 99, 235, 0.05);
          border-color: #3b82f6;
          color: #2563eb;
        }

        .vertical-fill-option {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(37, 99, 235, 0.04);
          border: 1px solid rgba(37, 99, 235, 0.15);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #334155;
          line-height: 1.4;
          user-select: none;
        }

        .vertical-fill-option input {
          margin-top: 2px;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .make-option-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(248, 250, 252, 0.8);
        }

        .cancel-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: background 0.2s;
        }

        .cancel-btn:hover {
          background: #f8fafc;
        }

        .create-btn {
          background: linear-gradient(135deg, hsl(220, 95%, 60%), hsl(220, 95%, 45%));
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
          transition: opacity 0.2s, transform 0.1s;
        }

        .create-btn:hover {
          opacity: 0.95;
        }

        .create-btn:active {
          transform: scale(0.98);
        }

        .delete-dropdown-btn {
          margin-right: auto;
          background: #ffffff;
          border: 1px solid #ef4444;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #ef4444;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .delete-dropdown-btn:hover {
          background: rgba(239, 68, 68, 0.05);
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cardSlideIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes rowInsert {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default MakeOptionModal;
