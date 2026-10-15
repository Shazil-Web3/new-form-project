import React from 'react';

/**
 * SuperscriptIcon (X²)
 * Clean SVG icon inspired by Microsoft Word's ribbon button.
 */
export const SuperscriptIcon = ({ size = 16, style = {}, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    aria-hidden="true"
  >
    {/* Base letter 'x' */}
    <path d="M2.5 5.5 L4.7 8.8 L2.5 12.2 H3.9 L5.4 9.8 L6.9 12.2 H8.3 L6.1 8.8 L8.3 5.5 H6.9 L5.4 7.8 L3.9 5.5 Z" />
    {/* Raised '2' superscript */}
    <path d="M10.5 3.3 C10.5 2.5 11.1 1.9 12.0 1.9 C12.9 1.9 13.5 2.5 13.5 3.3 C13.5 3.9 13.1 4.4 12.5 4.8 L10.7 6.2 H13.6 V7.1 H9.8 V6.4 L12.0 4.7 C12.4 4.4 12.6 4.1 12.6 3.4 C12.6 3.0 12.3 2.7 12.0 2.7 C11.6 2.7 11.4 3.0 11.4 3.3 Z" />
  </svg>
);

/**
 * SubscriptIcon (X₂)
 * Clean SVG icon inspired by Microsoft Word's ribbon button.
 */
export const SubscriptIcon = ({ size = 16, style = {}, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    aria-hidden="true"
  >
    {/* Base letter 'x' */}
    <path d="M2.5 3.8 L4.7 7.1 L2.5 10.5 H3.9 L5.4 8.1 L6.9 10.5 H8.3 L6.1 7.1 L8.3 3.8 H6.9 L5.4 6.1 L3.9 3.8 Z" />
    {/* Lowered '2' subscript */}
    <path d="M10.5 10.3 C10.5 9.5 11.1 8.9 12.0 8.9 C12.9 8.9 13.5 9.5 13.5 10.3 C13.5 10.9 13.1 11.4 12.5 11.8 L10.7 13.2 H13.6 V14.1 H9.8 V13.4 L12.0 11.7 C12.4 11.4 12.6 11.1 12.6 10.4 C12.6 10.0 12.3 9.7 12.0 9.7 C11.6 9.7 11.4 10.0 11.4 10.3 Z" />
  </svg>
);

/**
 * WordScriptGlyph
 * Typographic representation rendered with serif x and bold exponent,
 * identical to Word's font toolbar glyphs.
 */
export const WordScriptGlyph = ({ type = "superscript", style = {} }) => {
  if (type === "superscript") {
    return (
      <span className="word-script-glyph" style={style}>
        <span className="word-script-base">x</span>
        <span className="word-script-super-num">2</span>
      </span>
    );
  }
  return (
    <span className="word-script-glyph" style={style}>
      <span className="word-script-base">x</span>
      <span className="word-script-sub-num">2</span>
    </span>
  );
};

export default {
  SuperscriptIcon,
  SubscriptIcon,
  WordScriptGlyph,
};
