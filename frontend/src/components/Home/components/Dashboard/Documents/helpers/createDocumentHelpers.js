import { stripCommentHighlights } from '../../../../../../utils/templateUtils';
import { extractCommentsPayload } from '../../../../../Unified/UnifiedTextEditor/Preview/hooks/useTemplatePreviewState';

export const roleColors = {
  author: 'gold',
  editor: 'blue',
  commenter: 'green',
  viewer: 'default'
};

export const DOC_REVIEWER_ROLE = 'document_reviewer';
export const DOC_APPROVER_ROLE = 'document_approver';

export const isMeaningfulContent = (content) => {
  if (!content) return false;
  if (typeof content === 'object') {
    if (content.content !== undefined) return isMeaningfulContent(content.content);
    if (Array.isArray(content) && content.length > 0) return true;
    return false;
  }
  if (typeof content !== 'string') return false;
  // Strip tags, entities, and whitespace
  const stripped = content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '')
    .trim();
  return stripped.length > 0;
};

export const extractTemplateContent = (template) => {
  if (!template) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '', orientation: 'portrait', paperSize: 'A4', pagesState: null };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: '',
    orientation: template.orientation || 'portrait',
    paperSize: template.paperSize || 'A4',
    pagesState: template.pagesState || null
  };

  // 1) Primary source: comments column (editor saves here during review/editing)
  if (template.comments) {
    try {
      let parsed = template.comments;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.content || parsed.logo) {
          loadedData.content = parsed.content || '';
          loadedData.comments = [];
          loadedData.suggestions = [];
          loadedData.references = (parsed.references && Array.isArray(parsed.references))
            ? parsed.references.filter(r => !r.isManual && r.refAnchor)
            : [];
          loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
            ? parsed.references.filter(r => r.isManual || !r.refAnchor)
            : []);
          loadedData.logo = parsed.logo || null;
          loadedData.headerHTML = parsed.headerHTML ? stripCommentHighlights(parsed.headerHTML) : '';
          loadedData.footerHTML = parsed.footerHTML ? stripCommentHighlights(parsed.footerHTML) : '';
          loadedData.logoText = parsed.logoText || '';
          loadedData.logoTextRight = parsed.logoTextRight || '';
          if (parsed.orientation) loadedData.orientation = parsed.orientation;
          if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
          if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
        } else if (typeof parsed === 'string' && parsed.includes('<')) {
          loadedData.content = parsed;
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        loadedData.content = parsed;
      }
    } catch (e) {
      if (typeof template.comments === 'string' && template.comments.includes('<')) {
        loadedData.content = template.comments;
      }
    }
  }

  // 2) Fallback: content column
  if (!loadedData.content && template.content) {
    try {
      let parsed = template.content;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) {
          loadedData.content = parsed.content;
          if (parsed.logo) loadedData.logo = parsed.logo;
          if (parsed.orientation) loadedData.orientation = parsed.orientation;
          if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
          if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
        } else if (parsed.sections && Array.isArray(parsed.sections)) {
          loadedData.content = parsed.sections.map(s => `<h3>${s.title || ''}</h3><div>${s.content || ''}</div>`).join('');
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        loadedData.content = parsed;
      }
    } catch (parseError) {
      if (typeof template.content === 'string') {
        loadedData.content = template.content;
      }
    }
  }

  // Ensure content is a string
  if (Array.isArray(loadedData.content)) {
    loadedData.content = loadedData.content.join('');
  }

  // Strip highlights from main content
  loadedData.content = stripCommentHighlights(loadedData.content);

  // Clean pagesState if present so individual pages don't carry highlight spans or comments
  if (loadedData.pagesState && Array.isArray(loadedData.pagesState)) {
    loadedData.pagesState = loadedData.pagesState.map(page => ({
      ...page,
      content: page.content ? stripCommentHighlights(page.content) : '',
      header: page.header ? { ...page.header, content: page.header.content ? stripCommentHighlights(page.header.content) : '' } : page.header,
      footer: page.footer ? { ...page.footer, content: page.footer.content ? stripCommentHighlights(page.footer.content) : '' } : page.footer,
    }));
  }

  // Always force comments and suggestions to empty array for documents created from templates
  loadedData.comments = [];
  loadedData.suggestions = [];

  return loadedData;
};

export const extractDocumentContent = (doc) => {
  if (!doc) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '', orientation: 'portrait', paperSize: 'A4', pagesState: null };

  const extracted = extractCommentsPayload(doc);

  // Strip highlights from main content
  let rawContent = extracted.contentHtml || doc.content || '';
  if (Array.isArray(rawContent)) {
    rawContent = rawContent.join('');
  }
  const cleanContent = stripCommentHighlights(rawContent);

  // Clean pagesState if present so individual pages don't carry highlight spans or comments
  let pagesState = extracted.pagesState || doc.pagesState || null;
  if (pagesState && Array.isArray(pagesState)) {
    pagesState = pagesState.map(page => ({
      ...page,
      content: page.content ? stripCommentHighlights(page.content) : '',
      header: page.header ? { ...page.header, content: page.header.content ? stripCommentHighlights(page.header.content) : '' } : page.header,
      footer: page.footer ? { ...page.footer, content: page.footer.content ? stripCommentHighlights(page.footer.content) : '' } : page.footer,
    }));
  }

  let headerHTML = extracted.headerHTML || doc.headerHTML || '';
  if (headerHTML) headerHTML = stripCommentHighlights(headerHTML);

  let footerHTML = extracted.footerHTML || doc.footerHTML || '';
  if (footerHTML) footerHTML = stripCommentHighlights(footerHTML);

  // Always force comments and suggestions to empty array for documents created from base documents
  return {
    content: cleanContent,
    comments: [],
    suggestions: [],
    references: extracted.references || [],
    manualReferences: extracted.manualReferences || [],
    headerHTML,
    footerHTML,
    logo: extracted.logo || doc.logo || null,
    logoText: extracted.logoText || doc.logoText || '',
    logoTextRight: extracted.logoTextRight || doc.logoTextRight || '',
    orientation: extracted.orientation || doc.orientation || 'portrait',
    paperSize: extracted.paperSize || doc.paperSize || 'A4',
    pagesState
  };
};

export const mapParticipantRoleForDb = (role) => (role === 'commenter' ? 'viewer' : role);

export default {
  roleColors,
  DOC_REVIEWER_ROLE,
  DOC_APPROVER_ROLE,
  extractTemplateContent,
  extractDocumentContent,
  mapParticipantRoleForDb,
};
