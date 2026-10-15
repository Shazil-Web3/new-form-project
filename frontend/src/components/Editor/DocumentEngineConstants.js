// =======================
// DOCUMENT ENGINE + LAYOUT (Google-Docs-like)
// =======================

import React from 'react';

// Block type definitions (unchanged)
export const BLOCK_TYPES = {
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  LIST: 'list',
  IMAGE: 'image',
  VIDEO: 'video',
  TABLE: 'table',
  QUOTE: 'quote',
  CODE: 'code',
  DIVIDER: 'divider',
  PAGE_BREAK: 'page-break'
};

// List type definitions (unchanged)
export const LIST_TYPES = {
  BULLET: 'bullet',
  NUMBERED: 'numbered',
  CHECKLIST: 'checklist'
};

// Heading levels (unchanged)
export const HEADING_LEVELS = {
  H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6
};

