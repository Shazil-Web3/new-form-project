import { useState, useEffect } from 'react';
import apiClient from '../../../../../api/apiClient';
import { extractCommentsPayload } from './useTemplatePreviewState';
import {
  assignAuthorOwnershipToHtml,
  getDocumentAuthorOwnershipInfo
} from '../../../../../utils/templateUtils';
import { preferNonSkeletonEditorContent } from '../../../../../utils/editorContentGuards';

/**
 * Loads a document in template-shaped form for DocumentPreview (same tabs as TemplatePreview).
 */
export const useDocumentWorkflowPreviewState = (document, currentUser) => {
  const [loading, setLoading] = useState(true);
  const [parsedTemplate, setParsedTemplate] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const id = document?.document_id || document?.id;
    if (!id) {
      setParsedTemplate(null);
      setInitialData({
        contentHtml: '',
        comments: [],
        suggestions: [],
        references: [],
        manualReferences: [],
        logo: null,
        headerHTML: '',
        footerHTML: '',
        logoText: '',
        logoTextRight: '',
        orientation: 'portrait',
        paperSize: 'A4',
        pagesState: null
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let templateShaped = (document && (document.content !== undefined || document.comments !== undefined || document.elements !== undefined))
          ? document
          : null;

        if (!templateShaped) {
          const { data } = await apiClient.get(`/api/get_document/${id}`);
          templateShaped = data;
        }
        if (cancelled) return;

        const extractedData = extractCommentsPayload(templateShaped);
        // Document content can be persisted in multiple shapes; normalize aggressively for preview.
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

        let fallbackContent = '';
        const parsedContent = parseMaybeJson(templateShaped?.content);
        if (typeof parsedContent === 'string' || Array.isArray(parsedContent)) {
          fallbackContent = parsedContent;
        } else if (parsedContent && typeof parsedContent === 'object') {
          const nested = parseMaybeJson(parsedContent.content);
          fallbackContent = (typeof nested === 'string' || Array.isArray(nested)) ? nested : '';
        }
        const normalizedContentHtml = preferNonSkeletonEditorContent(
          extractedData?.contentHtml,
          fallbackContent
        );
        // Normalize template_approvers / approvers (handle string vs object)
        const templateApproversRaw = templateShaped.template_approvers || templateShaped.approvers;
        let templateApprovers = { reviewers: [], approvers: [] };
        if (templateApproversRaw) {
          if (typeof templateApproversRaw === 'string') {
            try {
              templateApprovers = JSON.parse(templateApproversRaw);
            } catch (e) {
              console.warn('Failed to parse approvers string', e);
            }
          } else if (typeof templateApproversRaw === 'object') {
            templateApprovers = templateApproversRaw;
          }
        }

        const reviewersList = Array.isArray(templateApprovers?.reviewers) ? templateApprovers.reviewers : [];
        const approversList = Array.isArray(templateApprovers?.approvers) ? templateApprovers.approvers : [];
        const hasRejection = reviewersList.some(r => r.status?.toLowerCase() === 'rejected') ||
                             approversList.some(a => a.status?.toLowerCase() === 'rejected');
        // Only treat as rejected if status is explicitly 'rejected', or if draft and hasRejection
        const effectiveStatus = (templateShaped.status === 'rejected' || (!['published', 'archived', 'pending_review', 'reviewed', 'pending_approval', 'approved', 'draft', 'pending_revision'].includes(templateShaped.status) && hasRejection)) ? 'rejected' : templateShaped.status;

        const parsed = {
          ...templateShaped,
          status: effectiveStatus,
          template_approvers: templateApprovers,
          contentHtml: normalizedContentHtml || '',
          parsedComments: extractedData.comments,
          parsedSuggestions: extractedData.suggestions,
          impact_assessment: typeof templateShaped.impact === 'string' ? JSON.parse(templateShaped.impact || '{}') : (templateShaped.impact || {})
        };

        // Mirror what useTemplatePreviewState does: parse required_approvers into the
        // `approvers` array so TemplateApproversTab can display the department config.
        // normalizeDocumentRowForClient already returns required_approvers as a parsed array,
        // but we need to also set the `approvers` field so existing checks work.
        let requiredApproversArray = [];
        try {
          const ra = templateShaped.required_approvers;
          if (Array.isArray(ra)) {
            requiredApproversArray = ra;
          } else if (typeof ra === 'string' && ra) {
            requiredApproversArray = JSON.parse(ra);
          }
        } catch (e) { /* ignore */ }
        parsed.approvers = requiredApproversArray;
        // Also surface individual user configs from template_approvers in the approvers array
        // if there are no department-level configs configured
        if (requiredApproversArray.length === 0 && templateApprovers) {
          const reviewers = Array.isArray(templateApprovers.reviewers) ? templateApprovers.reviewers : [];
          const approvers = Array.isArray(templateApprovers.approvers) ? templateApprovers.approvers : [];
          // Build a synthetic department list from the workflow users for display
          const deptSet = new Set();
          [...reviewers, ...approvers].forEach(u => {
            if (u.department) deptSet.add(u.department);
          });
          if (deptSet.size > 0) {
            parsed.approvers = Array.from(deptSet).map((dept, i) => ({ department: dept, stage: i + 1, mandatory: true }));
          }
        }

        // Apply author ownership to transferred content so it behaves like author-typed content in Review
        const authorInfo = getDocumentAuthorOwnershipInfo(templateShaped, currentUser);
        let ownedContentHtml = normalizedContentHtml || '';
        if (authorInfo.id || authorInfo.email) {
          ownedContentHtml = assignAuthorOwnershipToHtml(ownedContentHtml, authorInfo);
        }

        setParsedTemplate({ ...parsed, contentHtml: ownedContentHtml });
        setInitialData({
          ...extractedData,
          contentHtml: ownedContentHtml,
          logoText: extractedData.logoText || '',
          logoTextRight: extractedData.logoTextRight || ''
        });
      } catch (e) {
        console.error('useDocumentWorkflowPreviewState', e);
        if (!cancelled) {
          setParsedTemplate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document?.document_id, document?.id]);

  return { loading, parsedTemplate, setParsedTemplate, initialData };
};
