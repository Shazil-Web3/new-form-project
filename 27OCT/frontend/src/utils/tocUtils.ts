/**
 * Table of Contents (TOC) Numbering Utilities
 */

/**
 * Calculates dynamic hierarchical TOC numbers for Heading 1–6 elements.
 * 
 * Rules:
 * 1. Heading 1 (level 1): Top-level heading ("1", "2", "3", etc.). Resets level 2 and level 3 counts.
 * 2. Heading 2 (level 2): Sub-level heading ("1.1", "1.2", "2.1", etc.). Resets level 3 count.
 * 3. Heading 3–6 (level 3–6): Sub-sub-level heading ("1.1.1", "1.1.2", "1.2.1", etc.),
 *    capped at the 3rd level for TOC numbering without creating deeper nesting levels like 1.1.1.1.
 * 
 * @param {Array<HTMLElement|Object>} headings Array of heading elements or objects containing tagName
 * @returns {Array<string>} Array of calculated TOC number strings corresponding to each heading
 */
export const calculateTOCNumbers = (headings = []) => {
  let h1Count = 0;
  let h2Count = 0;
  let h3Count = 0;

  return headings.map((heading) => {
    const tagName = heading && heading.tagName
      ? heading.tagName.toLowerCase()
      : (heading && heading.level ? `h${heading.level}` : 'h1');
    const level = parseInt(tagName.charAt(1), 10) || (heading && heading.level) || 1;

    if (level <= 1) {
      h1Count += 1;
      h2Count = 0;
      h3Count = 0;
      return `${h1Count}`;
    } else if (level === 2) {
      if (h1Count === 0) {
        h1Count = 1;
      }
      h2Count += 1;
      h3Count = 0;
      return `${h1Count}.${h2Count}`;
    } else {
      if (h1Count === 0) {
        h1Count = 1;
      }
      if (h2Count === 0) {
        h2Count = 1;
      }
      h3Count += 1;
      return `${h1Count}.${h2Count}.${h3Count}`;
    }
  });
};
