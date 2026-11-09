/**
 * DISCLAIMER — EDITOR BODY CONTENT GUARDS
 *
 * Do not casually change this file or the save/load/hydrate flow that calls it
 * when adding editor features (including via AI). A small change can wipe stored
 * HTML and leave a blank canvas while comments still appear in the sidebar.
 *
 * Why: the engine empty canvas is real HTML (e.g. `<p data-block-id><br></p>`),
 * not “no content”. Comments live in a JSON array, not in the canvas DOM.
 *
 * Required rules (keep these even if you restyle or extend the editor):
 * 1. Treat no visible plain text as skeleton. Never treat skeleton as loaded body.
 * 2. Never persist skeleton HTML over known-good HTML (autosave, comment save,
 *    unmount debounce.flush, PUT update_template_content / document content).
 * 3. On load, prefer comments.content vs the content column: use whichever has
 *    visible text (`preferNonSkeletonEditorContent`).
 * 4. Do not mount the review editor until `contentLoaded` is true after GET.
 * 5. Do not skip hydrating incoming HTML just because the engine already has a
 *    `<br>` paragraph.
 *
 * Call sites that must keep using these helpers:
 * - Preview/hooks/useTemplateContent.js
 * - Preview/hooks/useDocumentWorkflowContent.js
 * - Preview/hooks/useTemplatePreviewState.js
 * - Preview/hooks/useDocumentWorkflowPreviewState.js
 * - Preview/components/TemplateContentTab.js
 * - Preview/TemplatePreview.js and DocumentPreview.js (wait for contentLoaded)
 * - UnifiedTextEditor/EditorCore.js
 * - backend/utils/editorContentGuards.js (same rules on PUT/GET)
 */

/**
 * Unwrap nested { content } / JSON-string payloads down to HTML or a blocks array.
 */
export const unwrapStoredEditorContent = (value, depth = 6) => {
  let current = value;
  for (let i = 0; i < depth; i += 1) {
    if (current == null) return '';
    if (Array.isArray(current)) return current;
    if (typeof current === 'object') {
      if (Object.prototype.hasOwnProperty.call(current, 'content')) {
        current = current.content;
        continue;
      }
      return '';
    }
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return current;
      const looksJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'));
      if (looksJson) {
        try {
          current = JSON.parse(trimmed);
          continue;
        } catch (_) {
          return current;
        }
      }
      return current;
    }
    return '';
  }
  if (typeof current === 'string' || Array.isArray(current)) return current;
  return '';
};

export const editorContentPlainText = (value) => {
  const unwrapped = unwrapStoredEditorContent(value);
  if (Array.isArray(unwrapped)) {
    return unwrapped
      .map((block) => (typeof block?.content === 'string' ? block.content : ''))
      .join(' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/[\s\u00A0\u200B]+/g, ' ')
      .trim();
  }
  if (typeof unwrapped !== 'string') return '';
  return unwrapped
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\s\u00A0\u200B]+/g, ' ')
    .trim();
};

/** Empty string, empty blocks, or engine skeleton such as <p data-block-id><br></p>. */
export const isSkeletonEditorContent = (value) => editorContentPlainText(value).length === 0;

export const preferNonSkeletonEditorContent = (candidate, fallback) => {
  if (!isSkeletonEditorContent(candidate)) return unwrapStoredEditorContent(candidate);
  if (!isSkeletonEditorContent(fallback)) return unwrapStoredEditorContent(fallback);
  const unwrapped = unwrapStoredEditorContent(candidate);
  return unwrapped == null ? '' : unwrapped;
};
