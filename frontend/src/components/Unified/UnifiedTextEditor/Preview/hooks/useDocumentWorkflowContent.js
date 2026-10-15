import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../../../../api/apiClient';
import { debounce } from 'lodash';
import {
  stripCommentHighlights,
  assignAuthorOwnershipToHtml,
  getDocumentAuthorOwnershipInfo
} from '../../../../../utils/templateUtils';
import {
  isSkeletonEditorContent,
  preferNonSkeletonEditorContent,
  unwrapStoredEditorContent
} from '../../../../../utils/editorContentGuards';
import { isDraftComment } from '../../../UnifiedCommentSystem/utils/unaddressedCommentsHelper';
/* Document workflow preview: saves via REST only (no template socket rooms). */

const cleanPayloadContent = (content) => {
  // CRITICAL: Preserve review underlines, reviewer edits, and attribution tooltips.
  // Stripping them here via stripCommentHighlights causes all reviewer edits to lose
  // their attribution on save, leading to false 'Edited by' authorship upon reload/rejection.
  if (!content) return "";
  return content;
};

export const useDocumentWorkflowContent = (parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate, readOnly = false) => {
  const [contentHtml, setContentHtml] = useState("");
  const [contentLoaded, setContentLoaded] = useState(false);
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [references, setReferences] = useState([]);
  const [manualReferences, setManualReferences] = useState([]);
  const [logo, setLogo] = useState(null);
  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");
  const [logoText, setLogoText] = useState("");
  const [logoTextRight, setLogoTextRight] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [paperSize, setPaperSize] = useState("A4");
  const [pagesState, setPagesState] = useState(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");

  // Refs for debouncing/callbacks
  const parsedTemplateRef = useRef(parsedTemplate);
  const currentUserRef = useRef(currentUser);
  const lastSavedContentRef = useRef("");
  const lastSavedPayloadRef = useRef("");
  const contentHtmlRef = useRef("");
  const commentsRef = useRef([]);       // always-fresh comments — avoids stale closure
  const suggestionsRef = useRef([]);    // always-fresh suggestions — avoids stale closure
  const referencesRef = useRef([]);     // always-fresh references
  const manualReferencesRef = useRef([]); // always-fresh manual references
  const logoRef = useRef(null);          // always-fresh logo
  const headerHTMLRef = useRef("");
  const footerHTMLRef = useRef("");
  const logoTextRef = useRef("");
  const logoTextRightRef = useRef("");
  const orientationRef = useRef("portrait");
  const paperSizeRef = useRef("A4");
  const pagesStateRef = useRef(null);
  const lastTypingTimeRef = useRef(0);
  const debouncedSaveRef = useRef(null);
  const debouncedSocketEmitRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);
  const contentLoadedRef = useRef(false);
  const knownGoodHtmlRef = useRef("");
  const lastQueuedHtmlRef = useRef("");

  // Sync refs
  useEffect(() => { contentLoadedRef.current = contentLoaded; }, [contentLoaded]);
  useEffect(() => { parsedTemplateRef.current = parsedTemplate; }, [parsedTemplate]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { lastSavedContentRef.current = lastSavedContent; }, [lastSavedContent]);
  useEffect(() => { contentHtmlRef.current = contentHtml; }, [contentHtml]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { referencesRef.current = references; }, [references]);
  useEffect(() => { manualReferencesRef.current = manualReferences; }, [manualReferences]);
  useEffect(() => { logoRef.current = logo; }, [logo]);
  useEffect(() => { headerHTMLRef.current = headerHTML; }, [headerHTML]);
  useEffect(() => { footerHTMLRef.current = footerHTML; }, [footerHTML]);
  useEffect(() => { logoTextRef.current = logoText; }, [logoText]);
  useEffect(() => { logoTextRightRef.current = logoTextRight; }, [logoTextRight]);
  useEffect(() => { orientationRef.current = orientation; }, [orientation]);
  useEffect(() => { paperSizeRef.current = paperSize; }, [paperSize]);
  useEffect(() => { pagesStateRef.current = pagesState; }, [pagesState]);

  // Init from initialData
  useEffect(() => {
    if (initialData) {
      // Handle both contentHtml (Template style) and content (Document style)
      let initialHtml = initialData.contentHtml || initialData.content || "";
      
      // If it's a JSON string, try to parse it
      if (typeof initialHtml === 'string' && initialHtml.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(initialHtml);
          if (parsed && (typeof parsed.content === 'string' || Array.isArray(parsed.content))) {
            initialHtml = parsed.content;
          }
        } catch (e) {}
      }      setContentHtml(initialHtml);
      setLastSavedContent(initialHtml);
      if (!isSkeletonEditorContent(initialHtml)) {
        knownGoodHtmlRef.current = initialHtml;
      }
      const rawInitialComments = initialData.comments || [];
      const normalizedInitialComments = rawInitialComments.map(c => {
        if (c && isDraftComment(c, { template_approvers: parsedTemplate?.template_approvers })) {
          return { ...c, createdInDraft: true, origin: 'draft', stage: 'draft' };
        }
        return c;
      });
      setComments(normalizedInitialComments);
      setSuggestions(initialData.suggestions || []);
      setReferences((initialData.references && Array.isArray(initialData.references))
        ? initialData.references.filter(r => !r.isManual && r.refAnchor)
        : []);
      setManualReferences(initialData.manualReferences || (initialData.references && Array.isArray(initialData.references)
        ? initialData.references.filter(r => r.isManual || !r.refAnchor)
        : []));
      if (initialData.logo) setLogo(initialData.logo);
      setHeaderHTML(initialData.headerHTML || "");
      setFooterHTML(initialData.footerHTML || "");
      setLogoText(initialData.logoText || "");
      setLogoTextRight(initialData.logoTextRight || "");
      if (initialData.orientation) setOrientation(initialData.orientation);
      if (initialData.paperSize) setPaperSize(initialData.paperSize);
      if (initialData.pagesState) setPagesState(initialData.pagesState);
      setContentLoaded(true);

      const initialPayload = {
        content: initialHtml,
        comments: initialData.comments || [],
        suggestions: initialData.suggestions || [],
        references: (initialData.references && Array.isArray(initialData.references))
          ? initialData.references.filter(r => !r.isManual && r.refAnchor)
          : [],
        manualReferences: initialData.manualReferences || (initialData.references && Array.isArray(initialData.references)
          ? initialData.references.filter(r => r.isManual || !r.refAnchor)
          : []),
        headerHTML: initialData.headerHTML || "",
        footerHTML: initialData.footerHTML || "",
        logo: initialData.logo || null,
        logoText: initialData.logoText || "",
        logoTextRight: initialData.logoTextRight || "",
        orientation: initialData.orientation || "portrait",
        paperSize: initialData.paperSize || "A4",
        pagesState: initialData.pagesState || null
      };
      lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    }
  }, [initialData]);

  // Load latest content AND comments/suggestions on mount or document change
  useEffect(() => {
    const parseMaybeJson = (value) => {
      if (value == null) return value;
      if (typeof value === 'object') return value;
      if (typeof value !== 'string') return value;
      const t = value.trim();
      if (!t) return '';
      if (t.startsWith('{') || t.startsWith('[') || (t.startsWith('"') && t.endsWith('"'))) {
        try {
          return JSON.parse(t);
        } catch {
          return value;
        }
      }
      return value;
    };

    const loadSavedContent = async () => {
      const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
      if (!documentId) return;
      try {
        const response = await apiClient.get(`/api/get_document/${documentId}`);
        const templateData = response.data;

        // Extract HTML content (prefer comments.content > content field)
        let loadedContent = null;
        let loadedComments = [];
        let loadedSuggestions = [];
        let loadedReferences = [];
        let loadedManualReferences = [];
        let loadedLogo = null;
        let loadedHeaderHTML = '';
        let loadedFooterHTML = '';
        let loadedLogoText = '';
        let loadedLogoTextRight = '';
        let loadedOrientation = 'portrait';
        let loadedPaperSize = 'A4';
        let loadedPagesState = null;

        if (templateData?.comments) {
          try {
            let commentsCol = templateData.comments;
            if (typeof commentsCol === 'string') {
              try { commentsCol = JSON.parse(commentsCol); } catch (_) {}
            }
            if (typeof commentsCol === 'string') {
              try { commentsCol = JSON.parse(commentsCol); } catch (_) {}
            }
            if (commentsCol && typeof commentsCol === 'object') {
              if (commentsCol.content !== undefined && commentsCol.content !== null) {
                loadedContent = unwrapStoredEditorContent(commentsCol.content);
              }
              if (Array.isArray(commentsCol.comments)) loadedComments = commentsCol.comments;
              if (Array.isArray(commentsCol.suggestions)) loadedSuggestions = commentsCol.suggestions;
              if (Array.isArray(commentsCol.references)) loadedReferences = commentsCol.references;
              if (Array.isArray(commentsCol.manualReferences)) loadedManualReferences = commentsCol.manualReferences;
              if (commentsCol.logo) loadedLogo = commentsCol.logo;
              if (typeof commentsCol.headerHTML === 'string') loadedHeaderHTML = commentsCol.headerHTML;
              if (typeof commentsCol.footerHTML === 'string') loadedFooterHTML = commentsCol.footerHTML;
              if (typeof commentsCol.logoText === 'string') loadedLogoText = commentsCol.logoText;
              if (typeof commentsCol.logoTextRight === 'string') loadedLogoTextRight = commentsCol.logoTextRight;
              if (commentsCol.orientation) loadedOrientation = commentsCol.orientation;
              if (commentsCol.paperSize) loadedPaperSize = commentsCol.paperSize;
              if (commentsCol.pagesState) loadedPagesState = commentsCol.pagesState;
            }
          } catch (e) { /* ignore parse error, fall through */ }
        }

        // Fallback: extract content from content field if comments.content is missing or skeleton
        if ((loadedContent === null || isSkeletonEditorContent(loadedContent)) && templateData?.content) {
          try {
            const contentField = typeof templateData.content === 'string' && templateData.content.trim().startsWith('{')
              ? JSON.parse(templateData.content)
              : templateData;
            const fromColumn = unwrapStoredEditorContent(
              typeof contentField?.content !== 'undefined' ? contentField.content : templateData.content
            );
            if (!isSkeletonEditorContent(fromColumn)) loadedContent = fromColumn;
            if (!loadedHeaderHTML && typeof contentField?.headerHTML === 'string') loadedHeaderHTML = contentField.headerHTML;
            if (!loadedFooterHTML && typeof contentField?.footerHTML === 'string') loadedFooterHTML = contentField.footerHTML;
            if (loadedOrientation === 'portrait' && contentField?.orientation) loadedOrientation = contentField.orientation;
            if (loadedPaperSize === 'A4' && contentField?.paperSize) loadedPaperSize = contentField.paperSize;
            if (!loadedPagesState && contentField?.pagesState) loadedPagesState = contentField.pagesState;
          } catch (e) {
            const fallback = unwrapStoredEditorContent(templateData.content);
            if (!isSkeletonEditorContent(fallback)) loadedContent = fallback;
          }
        }

        if (loadedContent !== null) {
          const authorInfo = getDocumentAuthorOwnershipInfo(templateData, currentUser);
          let ownedContent = loadedContent;
          if ((authorInfo.id || authorInfo.email) && typeof loadedContent === 'string') {
            ownedContent = assignAuthorOwnershipToHtml(loadedContent, authorInfo);
          }
          setContentHtml(ownedContent);
          setLastSavedContent(ownedContent);
          if (!isSkeletonEditorContent(ownedContent)) {
            knownGoodHtmlRef.current = ownedContent;
          }
        }
        const reviewApprovers = parsedTemplate?.template_approvers || templateData?.template_approvers;
        const normalizedLoadedComments = (loadedComments || []).map(c => {
          if (c && isDraftComment(c, { template_approvers: reviewApprovers })) {
            return { ...c, createdInDraft: true, origin: 'draft', stage: 'draft' };
          }
          return c;
        });
        if (normalizedLoadedComments.length > 0) setComments(normalizedLoadedComments);
        if (loadedSuggestions.length > 0) setSuggestions(loadedSuggestions);
        if (loadedReferences.length > 0) setReferences(loadedReferences);
        if (loadedManualReferences.length > 0) setManualReferences(loadedManualReferences);
        if (loadedLogo) setLogo(loadedLogo);
        if (loadedHeaderHTML) setHeaderHTML(loadedHeaderHTML);
        if (loadedFooterHTML) setFooterHTML(loadedFooterHTML);
        if (loadedLogoText) setLogoText(loadedLogoText);
        if (loadedLogoTextRight) setLogoTextRight(loadedLogoTextRight);
        if (loadedOrientation) setOrientation(loadedOrientation);
        if (loadedPaperSize) setPaperSize(loadedPaperSize);
        if (loadedPagesState) setPagesState(loadedPagesState);

        const loadedPayload = {
          content: loadedContent,
          comments: loadedComments,
          suggestions: loadedSuggestions,
          references: loadedReferences,
          manualReferences: loadedManualReferences,
          headerHTML: loadedHeaderHTML,
          footerHTML: loadedFooterHTML,
          logo: loadedLogo,
          logoText: loadedLogoText,
          logoTextRight: loadedLogoTextRight,
          orientation: loadedOrientation,
          paperSize: loadedPaperSize,
          pagesState: loadedPagesState
        };
        lastSavedPayloadRef.current = JSON.stringify(loadedPayload);
      } catch (error) {
        console.error('Error loading saved template content:', error);
      }
    };

    loadSavedContent();
  }, [parsedTemplate?.document_id, parsedTemplate?.id]);

  // Unified debounced auto-save for content, comments, suggestions, and logos
  useEffect(() => {
    debouncedSaveRef.current = debounce(async (content) => {
      const documentId = parsedTemplateRef.current?.document_id || parsedTemplateRef.current?.id;
      const user = currentUserRef.current;
      if (!documentId) return;

      if (isSkeletonEditorContent(content) && !isSkeletonEditorContent(knownGoodHtmlRef.current || lastSavedContentRef.current || contentHtmlRef.current)) {
        console.log('⏭️ Save skipped: refusing skeleton HTML over existing body');
        return;
      }

      const cleanContent = cleanPayloadContent(content);

      const currentPayload = {
        content: cleanContent,
        comments: commentsRef.current || [],
        suggestions: suggestionsRef.current || [],
        references: referencesRef.current || [],
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || '',
        orientation: orientationRef.current || 'portrait',
        paperSize: paperSizeRef.current || 'A4',
        pagesState: pagesStateRef.current || null
      };
      const currentPayloadStr = JSON.stringify(currentPayload);

      // Deep compare against last saved payload to avoid redundant saves
      if (lastSavedPayloadRef.current === currentPayloadStr) {
        console.log('⏭️ Save skipped: payload is identical to last saved');
        return;
      }

      console.log('📤 Sending save request to backend for document:', documentId);

      try {
        setIsSaving(true);
        // Include logo in the save data so it's preserved in the comments column
        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: user?.id
        };
        const response = await apiClient.put(
          `/api/update_document_content/${documentId}`,
          { content: cleanContent, comments: JSON.stringify(commentsPayload), userId: user?.id, timestamp: Date.now() }
        );
        console.log('📥 Save response received:', response.status, response.data);

        if (response?.data?.success || (response.status >= 200 && response.status < 300)) {
           console.log('✅ Save successful!');
           setLastSavedContent(content);
           lastSavedPayloadRef.current = currentPayloadStr;
           if (!isSkeletonEditorContent(content)) {
             knownGoodHtmlRef.current = content;
           }
           
           // Sync status and approvers if they were returned (e.g. reverted to pending)
           if (response.data?.status && setParsedTemplate) {
             setParsedTemplate(prev => ({
               ...prev,
               status: response.data.status,
               template_approvers: response.data.template_approvers
             }));
           }
        } else {
           console.warn('⚠️ Save API returned non-success:', response.status, response.data);
        }
      } catch (error) {
        console.error('❌ Error saving content:', error.message, error.response?.data);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => {
      if (debouncedSaveRef.current) {
        const queued = lastQueuedHtmlRef.current;
        if (queued && !isSkeletonEditorContent(queued)) {
          debouncedSaveRef.current.flush();
        } else {
          debouncedSaveRef.current.cancel();
        }
      }
    };
  }, []);

  // Content, header, footer, logo or orientation change effect (triggering auto-save and socket)
  useEffect(() => {
    contentHtmlRef.current = contentHtml;
    headerHTMLRef.current = headerHTML;
    footerHTMLRef.current = footerHTML;
    logoRef.current = logo;
    logoTextRef.current = logoText;
    logoTextRightRef.current = logoTextRight;
    orientationRef.current = orientation;
    paperSizeRef.current = paperSize;
    pagesStateRef.current = pagesState;
    
    if (!contentLoadedRef.current) return;
    if (readOnly) return;
    
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    if (!documentId) return;

    if (!contentHtml || (typeof contentHtml === 'string' && contentHtml.trim() === "")) return;
    if (isSkeletonEditorContent(contentHtml) && !isSkeletonEditorContent(knownGoodHtmlRef.current || lastSavedContent)) return;

    lastQueuedHtmlRef.current = contentHtml;
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(contentHtml);
    }
  }, [contentHtml, lastSavedContent, headerHTML, footerHTML, logo, logoText, logoTextRight, orientation, paperSize, pagesState, parsedTemplate, currentUser, readOnly]);


  // Helper: read the LIVE DOM content from the editor pages container.
  // This captures highlight spans (<span data-comment-id>, <span data-suggestededit-id>)
  // that were injected by CommentCore.applyHighlight() but never propagated to contentHtml state.
  const readFreshDomContent = useCallback(() => {
    const container = pagesContainerRef?.current;
    if (!container) return contentHtmlRef.current; // fallback to stale ref

    // Collect top-level blocks from all pages, deduplicated by block ID
    const allPageContents = container.querySelectorAll('.page-content');
    if (!allPageContents || allPageContents.length === 0) return contentHtmlRef.current;

    const seenBlockIds = new Set();
    const blockHtmlParts = [];

    allPageContents.forEach(pc => {
      const blocks = pc.querySelectorAll('[data-block-id]');
      blocks.forEach(block => {
        const blockId = block.getAttribute('data-block-id');

        // Skip blocks nested inside other blocks (artifact of extractContents)
        let parent = block.parentElement;
        let isNested = false;
        while (parent && parent !== pc) {
          if (parent.hasAttribute('data-block-id')) {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }

        if (!isNested && !seenBlockIds.has(blockId)) {
          seenBlockIds.add(blockId);
          blockHtmlParts.push(block.outerHTML);
        }
      });
    });

    return blockHtmlParts.length > 0 ? blockHtmlParts.join('') : contentHtmlRef.current;
  }, [pagesContainerRef]);

  const persistableHtmlFromDom = useCallback((freshContent) => {
    const persisted = preferNonSkeletonEditorContent(
      freshContent,
      knownGoodHtmlRef.current || contentHtmlRef.current || lastSavedContentRef.current
    );
    if (!isSkeletonEditorContent(freshContent) && freshContent !== contentHtmlRef.current) {
      setContentHtml(freshContent);
      setLastSavedContent(freshContent);
    }
    if (!isSkeletonEditorContent(persisted)) {
      knownGoodHtmlRef.current = typeof persisted === 'string' ? persisted : JSON.stringify(persisted);
    }
    if (typeof persisted === 'string') return persisted;
    if (Array.isArray(persisted)) return JSON.stringify(persisted);
    return persisted || '';
  }, []);

  const manualSaveContent = async (contentOverride = null) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    // FIX: Read fresh DOM content to capture any highlights that may not have
    // propagated to contentHtml state yet (e.g., user clicks Save right after adding comment)
    const freshDom = readFreshDomContent();
    const toSave = persistableHtmlFromDom(contentOverride ?? freshDom);

    if (!documentId || !toSave || (isSkeletonEditorContent(toSave) && !isSkeletonEditorContent(lastSavedContentRef.current))) return false;
    
    try {
        if (debouncedSaveRef.current) debouncedSaveRef.current.cancel();
        setIsSaving(true);

        const cleanToSave = cleanPayloadContent(toSave);

        const currentPayload = {
          content: cleanToSave,
          comments: commentsRef.current || [],
          suggestions: suggestionsRef.current || [],
          references: referencesRef.current || [],
          manualReferences: manualReferencesRef.current || [],
          headerHTML: headerHTMLRef.current || '',
          footerHTML: footerHTMLRef.current || '',
          logo: logoRef.current,
          logoText: logoTextRef.current || '',
          logoTextRight: logoTextRightRef.current || ''
        };

        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: currentUser?.id
        };

        const response = await apiClient.put(
            `/api/update_document_content/${documentId}`, 
            { 
              content: cleanToSave, 
              comments: JSON.stringify(commentsPayload),
              userId: currentUser?.id, 
              timestamp: Date.now() 
            }
        );
        
        if (response.data?.success || (response.status >= 200 && response.status < 300)) {
            setLastSavedContent(cleanToSave);
            lastSavedPayloadRef.current = JSON.stringify(currentPayload);
            
            // Sync status and approvers if they were returned
            if (response.data?.status && setParsedTemplate) {
              setParsedTemplate(prev => ({
                ...prev,
                status: response.data.status,
                template_approvers: response.data.template_approvers
              }));
            }
            return true;
        }
    } catch(e) { console.error(e); } 
    finally { setIsSaving(false); }
    return false;
  };

  // Instant Save handlers for comments/suggestions
  const handleCommentsChange = useCallback(async (updatedComments) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentSuggestions = suggestionsRef.current; // always-fresh, never overwrites saved suggestions
    if (!documentId) return;
    
    setComments(updatedComments);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    // Without this, contentHtmlRef.current is stale and doesn't contain the highlight markup,
    // so when the user saves without typing, the highlights are lost on reload.
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const cleanContent = cleanPayloadContent(freshContent);
      const currentPayload = {
        content: cleanContent,
        comments: updatedComments,
        suggestions: currentSuggestions,
        references: referencesRef.current || [], 
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await apiClient.put(`/api/update_document_content/${documentId}`,
        { content: cleanContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const handleSuggestionsChange = useCallback(async (updatedSuggestions) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current; // always-fresh, never overwrites saved comments
    if (!documentId) return;
    
    setSuggestions(updatedSuggestions);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const cleanContent = cleanPayloadContent(freshContent);
      const currentPayload = {
        content: cleanContent,
        comments: currentComments,
        suggestions: updatedSuggestions,
        manualReferences: manualReferencesRef.current || [],
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await apiClient.put(`/api/update_document_content/${documentId}`,
        { content: cleanContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const handleReferencesChange = useCallback(async (updatedReferences) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentManualReferences = manualReferencesRef.current;
    if (!documentId) return;
    
    setReferences(updatedReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const cleanContent = cleanPayloadContent(freshContent);
      const currentPayload = {
        content: cleanContent,
        comments: currentComments,
        suggestions: currentSuggestions,
        references: updatedReferences,
        manualReferences: currentManualReferences,
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await apiClient.put(`/api/update_document_content/${documentId}`,
        { content: cleanContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const handleManualReferencesChange = useCallback(async (updatedManualReferences) => {
    const documentId = parsedTemplate?.document_id || parsedTemplate?.id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentReferences = referencesRef.current;
    if (!documentId) return;
    
    setManualReferences(updatedManualReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const cleanContent = cleanPayloadContent(freshContent);
      const currentPayload = {
        content: cleanContent,
        comments: currentComments,
        suggestions: currentSuggestions,
        references: currentReferences,
        manualReferences: updatedManualReferences,
        headerHTML: headerHTMLRef.current || '',
        footerHTML: footerHTMLRef.current || '',
        logo: logoRef.current,
        logoText: logoTextRef.current || '',
        logoTextRight: logoTextRightRef.current || ''
      };
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);

      const commentsData = {
        ...currentPayload,
        lastModified: new Date().toISOString(),
        lastModifiedBy: currentUser?.id
      };
      
      const response = await apiClient.put(`/api/update_document_content/${documentId}`,
        { content: cleanContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );

      // Sync status and approvers if they were returned
      if (response.data?.status && setParsedTemplate) {
        setParsedTemplate(prev => ({
          ...prev,
          status: response.data.status,
          template_approvers: response.data.template_approvers
        }));
      }
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const emitCommentAdd = () => {};
  const emitCommentUpdate = () => {};
  const emitCommentDelete = () => {};
  const emitSuggestionAdd = () => {};
  const emitSuggestionUpdate = () => {};
  const emitSuggestionDelete = () => {};


  return {
    contentLoaded,
    contentHtml,
    setContentHtml,
    comments,
    suggestions,
    logo,
    setLogo,
    headerHTML,
    footerHTML,
    setHeaderHTML,
    setFooterHTML,
    logoText,
    setLogoText,
    logoTextRight,
    setLogoTextRight,
    orientation,
    setOrientation,
    paperSize,
    setPaperSize,
    pagesState,
    setPagesState,
    isSaving,
    lastSavedContent,
    manualSaveContent,
    handleCommentsChange,
    handleSuggestionsChange,
    references,
    handleReferencesChange,
    manualReferences,
    handleManualReferencesChange,
    pagesContainerRef,
    socketUpdateKey: 0,
    lastTypingTimeRef,
    emitCommentAdd,
    emitCommentUpdate,
    emitCommentDelete,
    emitSuggestionAdd,
    emitSuggestionUpdate,
    emitSuggestionDelete
  };
};
