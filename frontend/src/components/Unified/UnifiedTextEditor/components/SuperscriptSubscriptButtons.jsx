import React from 'react';
import { Button } from 'react-bootstrap';
import { SuperscriptIcon, SubscriptIcon, WordScriptGlyph } from './SuperscriptSubscriptIcons';
import '../styles/superscriptSubscript.css';

/**
 * SuperscriptSubscriptButtons
 *
 * Dedicated toolbar control group for Subscript (X₂) and Superscript (X²)
 * matching Microsoft Word's Font group interface.
 *
 * Keyboard shortcuts:
 * - Superscript: Ctrl + 1
 * - Subscript:   Ctrl + 2
 */
export const SuperscriptSubscriptButtons = ({
  isSuperscript = false,
  isSubscript = false,
  onToggleSuperscript,
  onToggleSubscript,
  size = "sm",
  useGlyphs = false,
  iconSize = 16,
  disabled = false,
  className = "",
  style = {},
}) => {
  return (
    <div
      className={`word-script-button-group ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        ...style,
      }}
      role="group"
      aria-label="Superscript and Subscript formatting"
    >
      {/* Subscript Button (X₂) */}
      <Button
        type="button"
        variant="light"
        size={size}
        disabled={disabled}
        aria-pressed={isSubscript}
        title="Subscript (Ctrl+2)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleSubscript}
        className={`word-format-btn subscript-btn ${isSubscript ? "active" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          padding: 0,
          backgroundColor: isSubscript ? "#e8f0fe" : undefined,
          color: isSubscript ? "#1967d2" : "#3c4043",
          border: isSubscript ? "1px solid #d2e3fc" : "1px solid transparent",
        }}
      >
        {useGlyphs ? (
          <WordScriptGlyph type="subscript" />
        ) : (
          <SubscriptIcon size={iconSize} />
        )}
      </Button>

      {/* Superscript Button (X²) */}
      <Button
        type="button"
        variant="light"
        size={size}
        disabled={disabled}
        aria-pressed={isSuperscript}
        title="Superscript (Ctrl+1)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleSuperscript}
        className={`word-format-btn superscript-btn ${isSuperscript ? "active" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          padding: 0,
          backgroundColor: isSuperscript ? "#e8f0fe" : undefined,
          color: isSuperscript ? "#1967d2" : "#3c4043",
          border: isSuperscript ? "1px solid #d2e3fc" : "1px solid transparent",
        }}
      >
        {useGlyphs ? (
          <WordScriptGlyph type="superscript" />
        ) : (
          <SuperscriptIcon size={iconSize} />
        )}
      </Button>
    </div>
  );
};

export default SuperscriptSubscriptButtons;
