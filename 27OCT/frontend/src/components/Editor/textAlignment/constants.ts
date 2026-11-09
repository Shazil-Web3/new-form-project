export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'];
export const DEFAULT_TEXT_ALIGN = 'justify';
export const DATA_TEXT_ALIGN_ATTR = 'data-text-align';

export const TEXT_ALIGN_BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre',
]);

export const SKIP_ALIGN_WRAPPER_TAGS = new Set([
  'table', 'figure', 'hr',
]);
