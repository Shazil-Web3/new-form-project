import { useState, useEffect } from 'react';
import { preferNonSkeletonEditorContent, unwrapStoredEditorContent } from '../../../../../utils/editorContentGuards';

// Helper functions (moved from original file to avoid duplication/loops)
const parseJsonSafe = (value, fallback = {}) => {
  try {
    if (!value) return fallback;
    let parsed = value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (_) {}
    }
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (_) {}
    }
    return (parsed && typeof parsed === 'object') ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

export const extractCommentsPayload = (template) => {
  if (!template || typeof template !== 'object') {
    return {
      contentHtml: '',
      comments: [],
      suggestions: [],
      references: [],
      manualReferences: [],
      logo: null,
      logoText: '',
      logoTextRight: '',
      headerHTML: '',
      footerHTML: '',
      orientation: 'portrait',
      paperSize: 'A4',
      pagesState: null
    };
  }

  let commentsData = {};
  let allComments = [];
  let allSuggestions = [];
  
  const separateCommentsData = parseJsonSafe(template.comments, {});
  
  if (separateCommentsData.content || separateCommentsData.comments || separateCommentsData.suggestions) {
    commentsData = separateCommentsData;
  } else {
    const contentData = parseJsonSafe(template.content, {});
    if (contentData.comments || contentData.suggestions) {
      commentsData = contentData;
    } else {
      commentsData = { content: template.content || '' };
    }
  }
  
  if (Array.isArray(commentsData.comments)) {
    allComments = commentsData.comments.map(comment => ({
      ...comment,
      id: comment.id || `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: comment.user || comment.author || 'Unknown User',
      email: comment.email || comment.userEmail || '',
      text: comment.text || comment.content || '',
      timestamp: comment.timestamp || new Date().toISOString(),
      highlightedText: comment.highlightedText || comment.selectedText || null,
      fragmentId: comment.fragmentId || comment.id,
      avatar: comment.avatar || null,
      status: comment.status || 'open',
      replies: Array.isArray(comment.replies) ? comment.replies : [],
      type: comment.type || 'comment'
    }));
  }
  
  if (Array.isArray(commentsData.suggestions)) {
    allSuggestions = commentsData.suggestions.map(suggestion => ({
      ...suggestion,
      id: suggestion.id || `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: suggestion.user || suggestion.author || 'Unknown User',
      email: suggestion.email || suggestion.userEmail || '',
      text: suggestion.text || suggestion.content || '',
      timestamp: suggestion.timestamp || new Date().toISOString(),
      highlightedText: suggestion.highlightedText || suggestion.selectedText || null,
      fragmentId: suggestion.fragmentId || suggestion.id,
      avatar: suggestion.avatar || null,
      status: suggestion.status || 'pending',
      replies: Array.isArray(suggestion.replies) ? suggestion.replies : [],
      type: suggestion.type || 'suggestededit'
    }));
  }
  
  let allReferences = [];
  let allManualReferences = [];
  if (Array.isArray(commentsData.references)) {
    allReferences = commentsData.references;
  }
  if (Array.isArray(commentsData.manualReferences)) {
    allManualReferences = commentsData.manualReferences;
  }

  // Fallback: If no comments or suggestions were found in the JSON object,
  // extract them from HTML spans in template.content or commentsData.content
  const rawContentToCheck = typeof commentsData.content === 'string' ? commentsData.content : (typeof template.content === 'string' ? template.content : '');
  if (allComments.length === 0 && allSuggestions.length === 0 && rawContentToCheck && typeof document !== 'undefined') {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = rawContentToCheck;
      const spans = tempDiv.querySelectorAll('span.highlighted-text, [data-comment-id], [data-suggestededit-id], [data-suggested-id]');
      spans.forEach((span, index) => {
        const text = span.textContent?.trim();
        if (!text) return;
        const commentId = span.getAttribute('data-comment-id');
        const suggestId = span.getAttribute('data-suggestededit-id') || span.getAttribute('data-suggested-id');
        const bg = span.style.backgroundColor || '';
        const isSuggestion = Boolean(suggestId) || bg.includes('lightblue') || bg.includes('rgb(173, 216, 230)');

        if (isSuggestion) {
          const id = suggestId || `suggestion-${Date.now()}-${index}`;
          allSuggestions.push({
            id,
            user: 'Author',
            text: text,
            timestamp: new Date().toISOString(),
            highlightedText: text,
            selectedText: text,
            type: 'suggestededit',
            status: 'pending',
            replies: []
          });
        } else {
          const id = commentId || `comment-${Date.now()}-${index}`;
          allComments.push({
            id,
            user: 'Author',
            text: `Comment on: "${text}"`,
            timestamp: new Date().toISOString(),
            highlightedText: text,
            selectedText: text,
            type: 'comment',
            status: 'open',
            replies: []
          });
        }
      });
    } catch (e) {
      console.warn('Error extracting fallback comments from HTML:', e);
    }
  }

  const fromComments = unwrapStoredEditorContent(
    commentsData.content !== undefined && commentsData.content !== null
      ? commentsData.content
      : ''
  );
  const fromColumn = unwrapStoredEditorContent(template.content);
  const finalContent = preferNonSkeletonEditorContent(fromComments, fromColumn);
  
  const docTitle = String(template?.name || template?.title || '').trim();
  const rawHeader = separateCommentsData.headerHTML || template?.headerHTML || '';
  const isCustom = separateCommentsData.hasUserCustomizedHeader === true;
  const headerHTML = isCustom ? rawHeader : (docTitle || rawHeader || '');

  const safePagesState = separateCommentsData.pagesState || commentsData.pagesState || template.pagesState || null;
  if (safePagesState && safePagesState[0] && safePagesState[0].header && !isCustom && docTitle) {
    safePagesState[0] = {
      ...safePagesState[0],
      header: {
        ...(safePagesState[0].header || {}),
        content: docTitle
      }
    };
  }

  const result = {
    contentHtml: finalContent,
    comments: allComments,
    suggestions: allSuggestions,
    references: allReferences,
    manualReferences: allManualReferences,
    logo: separateCommentsData.logo || null,
    logoText: separateCommentsData.logoText || (separateCommentsData.logo && typeof separateCommentsData.logo === 'object' ? separateCommentsData.logo.text : '') || template.logoText || '',
    logoTextRight: separateCommentsData.logoTextRight || (separateCommentsData.logo && typeof separateCommentsData.logo === 'object' ? separateCommentsData.logo.textRight : '') || template.logoTextRight || '',
    headerHTML: headerHTML,
    footerHTML: separateCommentsData.footerHTML || template.footerHTML || '',
    orientation: separateCommentsData.orientation || commentsData.orientation || template.orientation || 'portrait',
    paperSize: separateCommentsData.paperSize || commentsData.paperSize || template.paperSize || 'A4',
    pagesState: safePagesState
  };

  return result;
};


export const useTemplatePreviewState = (template, currentUser) => {
  const [loading, setLoading] = useState(true);
  
  const [parsedTemplate, setParsedTemplate] = useState(() => {
    if (template) {
      return {
        ...template,
        contentHtml: template.content || template.contentHtml || ''
      };
    }
    return {
      id: null,
      template_id: null,
      status: 'pending_review',
      contentHtml: '',
      template_approvers: { reviewers: [], approvers: [] },
      lockedElements: {},
      includeTableOfContents: false,
      allowAttachments: false
    };
  });

  const [initialData, setInitialData] = useState({
    contentHtml: '',
    comments: [],
    suggestions: [],
    references: [],
    manualReferences: []
  });

  useEffect(() => {
    const templateId = template?.id || template?.template_id;
    const currentId = parsedTemplate?.id || parsedTemplate?.template_id;
    
    // Only show loading spinner if we are switching to a completely different template
    if (templateId !== currentId) {
      setLoading(true);
    }

    if (!template) {
      setInitialData({
        contentHtml: '',
        comments: [],
        suggestions: [],
        references: [],
        manualReferences: [],
        logo: null,
        headerHTML: '',
        footerHTML: '',
        orientation: 'portrait',
        paperSize: 'A4',
        pagesState: null
      });
      setLoading(false);
      return;
    }

    let approvers = [];
    try {
      approvers = template.required_approvers ? JSON.parse(template.required_approvers) : [];
    } catch (e) { console.error("Error parsing parsed approvers", e); }
    
    let lockedElements = [];
    let includeTableOfContents = false;
    let allowAttachments = false;
    try {
      if (template.template_structure) {
        const structure = JSON.parse(template.template_structure);
        lockedElements = structure.locked_elements || [];
        includeTableOfContents = structure.includeTableOfContents || false;
        allowAttachments = structure.allowAttachments || false;
      }
    } catch (e) { console.error("Error parsing template structure", e); }
    
    const extractedData = extractCommentsPayload(template);
    const ownedContentHtml = extractedData.contentHtml || '';

    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      if (template.template_approvers) {
        templateApprovers = JSON.parse(template.template_approvers);
      }
    } catch (e) { console.error("Error parsing template_approvers", e); }
        
    const reviewersList = Array.isArray(templateApprovers?.reviewers) ? templateApprovers.reviewers : [];
    const approversList = Array.isArray(templateApprovers?.approvers) ? templateApprovers.approvers : [];
    const hasRejection = reviewersList.some(r => r.status?.toLowerCase() === 'rejected') ||
                         approversList.some(a => a.status?.toLowerCase() === 'rejected');
    // Only treat as rejected if status is explicitly 'rejected', or if draft and hasRejection
    const effectiveStatus = (template.status === 'rejected' || (!['published', 'archived', 'pending_review', 'reviewed', 'pending_approval', 'approved', 'draft', 'pending_revision'].includes(template.status) && hasRejection)) ? 'rejected' : template.status;

    const parsed = {
      ...template,
      status: effectiveStatus,
      approvers,
      template_approvers: templateApprovers,
      lockedElements,
      includeTableOfContents,
      allowAttachments,
      contentHtml: ownedContentHtml,
      parsedComments: extractedData.comments || [],
      parsedSuggestions: extractedData.suggestions || [],
      impact_assessment: typeof template.impact === 'string' ? JSON.parse(template.impact || '{}') : (template.impact || {})
    };
    
    setParsedTemplate(parsed);
    setInitialData({ ...extractedData, contentHtml: ownedContentHtml });
    
    setTimeout(() => setLoading(false), 0);
  }, [template]);

  return { loading, parsedTemplate, setParsedTemplate, initialData };
};
