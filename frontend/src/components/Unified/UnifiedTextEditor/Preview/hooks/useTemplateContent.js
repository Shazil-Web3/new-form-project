import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../../../../api/apiClient';
import { debounce } from 'lodash';
import { socket } from '../../../../../utils/SocketProvider';
import { isSkeletonEditorContent, preferNonSkeletonEditorContent, unwrapStoredEditorContent } from '../../../../../utils/editorContentGuards';
import {
  assignAuthorOwnershipToHtml,
  getDocumentAuthorOwnershipInfo
} from '../../../../../utils/templateUtils';
import { isDraftComment } from '../../../UnifiedCommentSystem/utils/unaddressedCommentsHelper';

export const useTemplateContent = (parsedTemplate, initialData, currentUser, pagesContainerRef, setParsedTemplate) => {
  const [contentHtml, setContentHtml] = useState("");
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
  const [contentLoaded, setContentLoaded] = useState(false);

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
  const knownGoodHtmlRef = useRef("");
  const lastQueuedHtmlRef = useRef("");
  // Guard to prevent the debounced auto-save from firing immediately after
  // initial load with a stale suggestionsRef (which could overwrite resolved suggestions).
  const isInitialLoadRef = useRef(true);
  const contentLoadedRef = useRef(false);

  // Sync refs
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
  useEffect(() => { contentLoadedRef.current = contentLoaded; }, [contentLoaded]);

  // Init from initialData
  useEffect(() => {
    if (initialData) {
      if (initialData.contentHtml) {
        setContentHtml(initialData.contentHtml || "");
        setLastSavedContent(initialData.contentHtml || "");
        if (!isSkeletonEditorContent(initialData.contentHtml)) {
          knownGoodHtmlRef.current = initialData.contentHtml;
        }
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
      if (initialData.orientation) {
        setOrientation(initialData.orientation);
        orientationRef.current = initialData.orientation;
      }
      if (initialData.paperSize) {
        setPaperSize(initialData.paperSize);
        paperSizeRef.current = initialData.paperSize;
      }
      if (initialData.pagesState) {
        setPagesState(initialData.pagesState);
        pagesStateRef.current = initialData.pagesState;
      }

      const initialPayload = {
        content: initialData.contentHtml || "",
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

  // Load latest content AND comments/suggestions on mount or template change
  useEffect(() => {
    const loadSavedContent = async () => {
      const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
      if (!templateId) return;
      setContentLoaded(false);
      contentLoadedRef.current = false;
      try {
        // Use the full template endpoint so we get the 'comments' column
        // which contains both the HTML content and the comments/suggestions arrays
        const response = await apiClient.get(`/api/get_template/${templateId}`);
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

        if (loadedContent !== null && !isSkeletonEditorContent(loadedContent)) {
          // Apply author attribution underlines to original content entering Review mode.
          // This mirrors the identical logic in useDocumentWorkflowContent.js (Bug 1 fix).
          const authorInfo = getDocumentAuthorOwnershipInfo(templateData, currentUser);
          let ownedContent = loadedContent;
          if ((authorInfo.id || authorInfo.email) && typeof loadedContent === 'string') {
            ownedContent = assignAuthorOwnershipToHtml(loadedContent, authorInfo);
          }
          setContentHtml(ownedContent);
          setLastSavedContent(ownedContent);
          knownGoodHtmlRef.current = ownedContent;
        }
        // Always set comments/suggestions/logo from the fresh DB data
        // (even if empty — that's the ground truth)
        const reviewApprovers = parsedTemplate?.template_approvers || templateData?.template_approvers;
        const normalizedLoadedComments = (loadedComments || []).map(c => {
          if (c && isDraftComment(c, { template_approvers: reviewApprovers })) {
            return { ...c, createdInDraft: true, origin: 'draft', stage: 'draft' };
          }
          return c;
        });
        setComments(normalizedLoadedComments);
        setSuggestions(loadedSuggestions);
        setReferences(loadedReferences.filter(r => !r.isManual && r.refAnchor));
        setManualReferences(loadedManualReferences.length > 0 ? loadedManualReferences : loadedReferences.filter(r => r.isManual || !r.refAnchor));
        if (loadedLogo) setLogo(loadedLogo);
        setHeaderHTML(loadedHeaderHTML || "");
        setFooterHTML(loadedFooterHTML || "");
        setLogoText(loadedLogoText || "");
        setLogoTextRight(loadedLogoTextRight || "");
        const finalOrientation = loadedOrientation || orientationRef.current || initialData?.orientation || "portrait";
        const finalPaperSize = loadedPaperSize || paperSizeRef.current || initialData?.paperSize || "A4";
        const finalPagesState = loadedPagesState || pagesStateRef.current || initialData?.pagesState || null;
        setOrientation(finalOrientation);
        orientationRef.current = finalOrientation;
        setPaperSize(finalPaperSize);
        paperSizeRef.current = finalPaperSize;
        setPagesState(finalPagesState);
        pagesStateRef.current = finalPagesState;

        const initialPayload = {
          content: loadedContent || "",
          comments: loadedComments || [],
          suggestions: loadedSuggestions || [],
          references: loadedReferences.filter(r => !r.isManual && r.refAnchor) || [],
          manualReferences: loadedManualReferences.length > 0 ? loadedManualReferences : loadedReferences.filter(r => r.isManual || !r.refAnchor) || [],
          headerHTML: loadedHeaderHTML || "",
          footerHTML: loadedFooterHTML || "",
          logo: loadedLogo || null,
          logoText: loadedLogoText || "",
          logoTextRight: loadedLogoTextRight || "",
          orientation: loadedOrientation || "portrait",
          paperSize: loadedPaperSize || "A4",
          pagesState: loadedPagesState || null
        };
        lastSavedPayloadRef.current = JSON.stringify(initialPayload);
        contentLoadedRef.current = true;
        setContentLoaded(true);
        isInitialLoadRef.current = false;
      } catch (error) {
        console.error('Error loading saved content:', error);
        contentLoadedRef.current = true;
        setContentLoaded(true);
        isInitialLoadRef.current = false;
      }
    };
    loadSavedContent();
    // Allow auto-save to fire only after 3 seconds, giving all refs time to settle
    const initialLoadTimer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 3000);
    return () => clearTimeout(initialLoadTimer);
  }, [parsedTemplate?.id, parsedTemplate?.template_id]);

  // Debounced Save Logic
  useEffect(() => {
    debouncedSaveRef.current = debounce(async (content) => {
      console.log('💾 Auto-save triggered for content length:', content?.length);
      const tpl = parsedTemplateRef.current;
      const user = currentUserRef.current;
      const templateId = tpl?.id || tpl?.template_id;

      if (!contentLoadedRef.current) {
        console.log('⏭️ Save skipped: editor content not loaded from DB yet');
        return;
      }

      if (!templateId || !content) {
        console.log('⏭️ Save skipped: no ID or content');
        return;
      }

      if (isSkeletonEditorContent(content) && !isSkeletonEditorContent(knownGoodHtmlRef.current || lastSavedContentRef.current || contentHtmlRef.current)) {
        console.log('⏭️ Save skipped: refusing skeleton HTML over existing body');
        return;
      }

      // Guard: Don't auto-save within the first 3 seconds of mount.
      // Refs (suggestionsRef, commentsRef) may not have settled yet from the initial
      // DB load, and saving now would overwrite resolved suggestion history with empty arrays.
      if (isInitialLoadRef.current) {
        console.log('⏭️ Save skipped: initial load guard active');
        return;
      }

      const currentPayload = {
        content,
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

      if (currentPayloadStr === lastSavedPayloadRef.current) {
        console.log('⏭️ Save skipped: payload is identical to last saved');
        return;
      }

      console.log('📤 Sending save request to backend for template:', templateId);

      try {
        setIsSaving(true);
        // Include logo in the save data so it's preserved in the comments column
        const commentsPayload = {
          ...currentPayload,
          lastModified: new Date().toISOString(),
          lastModifiedBy: user?.id
        };
        
        const response = await apiClient.put(
          `/api/update_template_content/${templateId}`,
          { content, comments: JSON.stringify(commentsPayload), userId: user?.id, timestamp: Date.now() }
        );
        console.log('📥 Save response received:', response.status, response.data);

        if (response?.data?.success || (response.status >= 200 && response.status < 300)) {
           console.log('✅ Save successful!');
           setLastSavedContent(content);
           lastSavedPayloadRef.current = currentPayloadStr;
           if (!isSkeletonEditorContent(content)) {
             knownGoodHtmlRef.current = content;
           }
           
           // Sync status and approvers if they were returned by backend (e.g., auto-reverted to pending_review)
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
    
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (!templateId) return;

    // Check if anything actually changed since last save
    const contentChanged = contentHtml && contentHtml !== lastSavedContent;
    // For header/footer/logo/orientation, deduplication is handled via commentsPayload comparison
    if (!contentHtml) return;
    if (isSkeletonEditorContent(contentHtml) && !isSkeletonEditorContent(knownGoodHtmlRef.current || lastSavedContent)) return;

    lastQueuedHtmlRef.current = contentHtml;
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current(contentHtml);
    }

    if (!debouncedSocketEmitRef.current) {
        debouncedSocketEmitRef.current = debounce((content, hHTML, fHTML, tId, uId) => {
            socket.emit('updateTemplateContent', { 
                templateId: tId, 
                content,
                headerHTML: hHTML,
                footerHTML: fHTML,
                userId: uId,
                timestamp: Date.now()
            });
        }, 300);
    }
    debouncedSocketEmitRef.current(contentHtml, headerHTML, footerHTML, templateId, currentUser?.id);

    return () => {
      if (debouncedSocketEmitRef.current) {
        debouncedSocketEmitRef.current.flush();
      }
    };
  }, [contentHtml, lastSavedContent, headerHTML, footerHTML, logo, logoText, logoTextRight, orientation, paperSize, pagesState, parsedTemplate, currentUser]);


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
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    // FIX: Read fresh DOM content to capture any highlights that may not have
    // propagated to contentHtml state yet (e.g., user clicks Save right after adding comment)
    const freshDom = readFreshDomContent();
    const toSave = persistableHtmlFromDom(contentOverride ?? freshDom);

    if (!templateId || !toSave || (isSkeletonEditorContent(toSave) && !isSkeletonEditorContent(lastSavedContentRef.current))) return false;
    
    try {
        if (debouncedSaveRef.current) debouncedSaveRef.current.cancel();
        setIsSaving(true);

        const currentPayload = {
          content: toSave,
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
            `/api/update_template_content/${templateId}`, 
            { 
              content: toSave, 
              comments: JSON.stringify(commentsPayload),
              userId: currentUser?.id, 
              timestamp: Date.now() 
            }
        );
        
        if (response.data?.success || (response.status >= 200 && response.status < 300)) {
            setLastSavedContent(toSave);
            lastSavedPayloadRef.current = JSON.stringify(currentPayload);
            return true;
        }
    } catch(e) { console.error(e); } 
    finally { setIsSaving(false); }
    return false;
  };

  // Instant Save handlers for comments/suggestions
  const handleCommentsChange = useCallback(async (updatedComments) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentSuggestions = suggestionsRef.current; // always-fresh, never overwrites saved suggestions
    if (!templateId) return;
    
    setComments(updatedComments);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    // Without this, contentHtmlRef.current is stale and doesn't contain the highlight markup,
    // so when the user saves without typing, the highlights are lost on reload.
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const currentPayload = {
        content: freshContent,
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
      
      await apiClient.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );
      socket.emit('commentsUpdated', { templateId, comments: updatedComments });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const handleSuggestionsChange = useCallback(async (updatedSuggestions) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current; // always-fresh, never overwrites saved comments
    if (!templateId) return;

    // MERGE: preserve any resolved (approved/declined) suggestions that aren't in the
    // incoming list. This prevents a race where a new suggestion save drops history entries
    // that were saved by a different action.
    const incomingIds = new Set(updatedSuggestions.map(s => s.id));
    const preservedResolved = (suggestionsRef.current || []).filter(
      s => !incomingIds.has(s.id) && (s.status === 'approved' || s.status === 'declined')
    );
    const mergedSuggestions = [...updatedSuggestions, ...preservedResolved];
    
    setSuggestions(mergedSuggestions);
    
    // FIX: Read LIVE DOM content which includes highlight spans added by applyHighlight()
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const currentPayload = {
        content: freshContent,
        comments: currentComments,
        suggestions: mergedSuggestions,
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
      
      await apiClient.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );
      socket.emit('suggestionsUpdated', { templateId, suggestions: mergedSuggestions });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  // Socket Logic
  useEffect(() => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (!templateId) return;

    socket.emit('joinTemplate', { templateId, mode: 'preview' });
    socket.emit('joinTemplateRoom', {
        templateId,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userName: `${currentUser?.firstName} ${currentUser?.lastName}`,
        role: currentUser?.role
    });

    const handleContentUpdate = (data) => {
        if (data.userId !== currentUser?.id) {
             const now = Date.now();
             if (now - lastSocketUpdateRef.current < 1000) return;
             
             // If user is actively typing, don't overwrite their local state with socket updates
             if (now - lastTypingTimeRef.current < 3000) return; 

             lastSocketUpdateRef.current = now;

             if (data.content !== undefined && data.content !== contentHtmlRef.current) {
                if (isSkeletonEditorContent(data.content) && !isSkeletonEditorContent(contentHtmlRef.current)) {
                  return;
                }
                setContentHtml(data.content);
                setLastSavedContent(data.content);
             }
             
             if (data.headerHTML !== undefined && data.headerHTML !== headerHTMLRef.current) {
                setHeaderHTML(data.headerHTML || "");
             }
             
             if (data.footerHTML !== undefined && data.footerHTML !== footerHTMLRef.current) {
                setFooterHTML(data.footerHTML || "");
             }
        }
    };
    
    // Comment/Suggestion handlers
    const handleCommentAdded = ({ comment }) => {
        setComments(prev => [...prev, comment]);
    };
    const handleCommentUpdated = ({ commentId, updates }) => {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, ...updates } : c));
    };
    const handleCommentDeleted = ({ commentId }) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
    };
    
    const handleSuggestionAdded = ({ suggestion }) => {
         setSuggestions(prev => [...prev, suggestion]);
    };
    const handleSuggestionUpdated = ({ suggestionId, updates }) => {
         setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, ...updates } : s));
    };
    const handleSuggestionDeleted = ({ suggestionId }) => {
         setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    };

    socket.on('templateContentUpdated', handleContentUpdate);
    socket.on('templateContentUpdate', handleContentUpdate); // Listen to legacy event too
    
    socket.on('commentAdded', handleCommentAdded);
    socket.on('commentUpdated', handleCommentUpdated);
    socket.on('commentDeleted', handleCommentDeleted);
    socket.on('suggestionAdded', handleSuggestionAdded);
    socket.on('suggestionUpdated', handleSuggestionUpdated);
    socket.on('suggestionDeleted', handleSuggestionDeleted);

    socket.on('templateApproversUpdated', ({ templateId: updatedId, template_approvers, status }) => {
        if (setParsedTemplate && String(updatedId) === String(templateId)) {
            setParsedTemplate(prev => ({
                ...prev,
                template_approvers,
                status
            }));
        }
    });

    return () => {
        socket.off('templateContentUpdated', handleContentUpdate);
        socket.off('templateContentUpdate', handleContentUpdate);
        
        socket.off('commentAdded', handleCommentAdded);
        socket.off('commentUpdated', handleCommentUpdated);
        socket.off('commentDeleted', handleCommentDeleted);
        socket.off('suggestionAdded', handleSuggestionAdded);
        socket.off('suggestionUpdated', handleSuggestionUpdated);
        socket.off('suggestionDeleted', handleSuggestionDeleted);
        socket.off('templateApproversUpdated');
        
        socket.emit('leaveTemplate', { templateId });
        socket.emit('leaveTemplateRoom', { templateId });
    };

  }, [parsedTemplate?.id, parsedTemplate?.template_id]);

  // Emitters
  const emitCommentAdd = (comment) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('addComment', { templateId, comment });
  };
  const emitCommentUpdate = (commentId, updates) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('updateComment', { templateId, commentId, updates });
  };
  const emitCommentDelete = (commentId) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('deleteComment', { templateId, commentId });
  };
  const emitSuggestionAdd = (suggestion) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('addSuggestion', { templateId, suggestion });
  };
  const emitSuggestionUpdate = (suggestionId, updates) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('updateSuggestion', { templateId, suggestionId, updates });
  };
  const emitSuggestionDelete = (suggestionId) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    if (templateId) socket.emit('deleteSuggestion', { templateId, suggestionId });
  };

  const handleReferencesChange = useCallback(async (updatedReferences) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentManualReferences = manualReferencesRef.current;
    if (!templateId) return;
    
    setReferences(updatedReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const currentPayload = {
        content: freshContent,
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
      
      await apiClient.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );
      socket.emit('referencesUpdated', { templateId, references: updatedReferences });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);

  const handleManualReferencesChange = useCallback(async (updatedManualReferences) => {
    const templateId = parsedTemplate?.id || parsedTemplate?.template_id;
    const currentComments = commentsRef.current;
    const currentSuggestions = suggestionsRef.current;
    const currentReferences = referencesRef.current;
    if (!templateId) return;
    
    setManualReferences(updatedManualReferences);
    
    // Read LIVE DOM content to capture any highlights
    const freshContent = persistableHtmlFromDom(readFreshDomContent());

    try {
      const currentPayload = {
        content: freshContent,
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
      
      await apiClient.put(`/api/update_template_content/${templateId}`,
        { content: freshContent, comments: JSON.stringify(commentsData), userId: currentUser?.id }
      );
      socket.emit('manualReferencesUpdated', { templateId, manualReferences: updatedManualReferences });
    } catch (e) { console.error(e); }
  }, [parsedTemplate, currentUser, persistableHtmlFromDom]);


  return {
    contentHtml,
    setContentHtml,
    contentLoaded,
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
    lastTypingTimeRef,
    emitCommentAdd,
    emitCommentUpdate,
    emitCommentDelete,
    emitSuggestionAdd,
    emitSuggestionUpdate,
    emitSuggestionDelete
  };
};
