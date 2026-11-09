import React from 'react';
import { Form } from 'antd';
import UnifiedTextEditor from '../../../../../Unified/UnifiedTextEditor';
import { extractTemplateContent } from '../helpers/createDocumentHelpers';

export const DocumentContentTab = ({
  form,
  activeTab,
  templates = [],
  contentData,
  setContentData,
  contentVersion = 0,
  currentDocumentId,
  document,
  user,
  documentWorkflowApprovers,
  handleSubmit,
  debouncedSave,
}) => {
  return (
    <div style={{ padding: '0 8px 8px 8px' }}>
      <Form.Item noStyle shouldUpdate>
        {({ getFieldValue }) => {
          const selectedTemplateId = getFieldValue('templateId');
          const documentTitle = getFieldValue('title');

          const fallbackEmpty = {
            content: '',
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
          };

          let fallback = fallbackEmpty;
          if (selectedTemplateId) {
            const t = templates.find((x) => x.id === selectedTemplateId);
            if (t) {
              const extractedHtml = extractTemplateContent(t);
              if (extractedHtml) {
                fallback = {
                  content: extractedHtml.content || '',
                  comments: extractedHtml.comments || [],
                  suggestions: extractedHtml.suggestions || [],
                  references: extractedHtml.references || [],
                  manualReferences: extractedHtml.manualReferences || [],
                  logo: extractedHtml.logo ?? null,
                  headerHTML: extractedHtml.headerHTML || '',
                  footerHTML: extractedHtml.footerHTML || '',
                  logoText: extractedHtml.logoText || '',
                  logoTextRight: extractedHtml.logoTextRight || '',
                  orientation: extractedHtml.orientation || 'portrait',
                  paperSize: extractedHtml.paperSize || 'A4',
                  pagesState: extractedHtml.pagesState || null
                };
              }
            }
          }

          const cd = contentData && typeof contentData === 'object' ? contentData : {};
          const isDraftDoc = Boolean(
            cd?.status === 'draft' ||
            String(cd?.status || '').toLowerCase() === 'draft'
          );

          const mergedInitial = {
            ...fallback,
            ...cd,
            content: cd.content !== undefined && cd.content !== null ? cd.content : fallback.content,
            comments: Array.isArray(cd.comments) ? cd.comments : (fallback.comments || []),
            suggestions: Array.isArray(cd.suggestions) ? cd.suggestions : (fallback.suggestions || []),
            references: Array.isArray(cd.references) ? cd.references : (fallback.references || []),
            manualReferences: Array.isArray(cd.manualReferences) ? cd.manualReferences : (fallback.manualReferences || []),
            logo: cd.logo !== undefined ? { ...(fallback.logo || {}), ...cd.logo } : fallback.logo,
            headerHTML: cd.headerHTML !== undefined ? cd.headerHTML : fallback.headerHTML,
            footerHTML: cd.footerHTML !== undefined ? cd.footerHTML : fallback.footerHTML,
            logoText: cd.logoText !== undefined ? cd.logoText : fallback.logoText,
            logoTextRight: cd.logoTextRight !== undefined ? cd.logoTextRight : fallback.logoTextRight,
            orientation: cd.orientation || fallback.orientation || 'portrait',
            paperSize: cd.paperSize || fallback.paperSize || 'A4',
            pagesState: cd.pagesState || fallback.pagesState || null,
            status: isDraftDoc ? 'draft' : undefined
          };

          mergedInitial.logo = cd.logo !== undefined ? { ...(fallback.logo || {}), ...cd.logo } : fallback.logo;

          return (
            <UnifiedTextEditor
              key={`create-doc-editor-${currentDocumentId || 'new'}-${selectedTemplateId || 'none'}-${contentVersion}`}
              isActive={activeTab === "content"}
              mode="create"
              isDocument={true}
              isDraft={isDraftDoc}
              status={isDraftDoc ? 'draft' : undefined}
              documentId={currentDocumentId || undefined}
              templateId={form.getFieldValue('templateId') || document?.template_id}
              user={user}
              socketEnabled={false}
              documentTitle={documentTitle}
              initialContent={mergedInitial}
              workflowApprovers={documentWorkflowApprovers}
              approvers={documentWorkflowApprovers}
              logo={mergedInitial.logo}
              setLogo={(logo) =>
                setContentData((prev) => {
                  const safePrev = prev && typeof prev === 'object' ? prev : {};
                  const next = { ...safePrev };
                  if (logo === null) {
                    next.logo = null;
                  } else if (logo && typeof logo === 'object') {
                    next.logo = { ...(safePrev.logo || {}), ...logo };
                    if (!next.logo.preview && safePrev.logo?.preview) {
                      next.logo.preview = safePrev.logo.preview;
                    }
                    if (next.logo.width == null && safePrev.logo?.width != null) {
                      next.logo.width = safePrev.logo.width;
                    }
                    if (next.logo.height == null && safePrev.logo?.height != null) {
                      next.logo.height = safePrev.logo.height;
                    }
                  }
                  return next;
                })
              }
              onContentChange={(changeData) => {
                // CRITICAL FIX: Prefer htmlContent (clean HTML) over content (blocks JSON).
                // EditorCore emits content=blocksJson and htmlContent=cleanHtml.
                // Without this, the raw blocks JSON (with IDs, metadata) gets saved
                // as the document content, causing drafts to show raw JSON on reopen.
                // This matches the pattern in EditorWrapper.js (template create flow).
                const cleanContentHtml = changeData?.htmlContent || changeData?.content || '';
                setContentData((prev) => {
                  const safePrev = prev && typeof prev === 'object' ? prev : {};
                  const next = { ...safePrev, ...changeData, content: cleanContentHtml };
                  if (Object.prototype.hasOwnProperty.call(changeData, 'logo')) {
                    if (changeData.logo === null) {
                      next.logo = safePrev.logo || null;
                    } else if (changeData.logo && typeof changeData.logo === 'object') {
                      next.logo = { ...(safePrev.logo || {}), ...changeData.logo };
                      if (!next.logo.preview && safePrev.logo?.preview) {
                        next.logo.preview = safePrev.logo.preview;
                      }
                      if (next.logo.width == null && safePrev.logo?.width != null) {
                        next.logo.width = safePrev.logo.width;
                      }
                      if (next.logo.height == null && safePrev.logo?.height != null) {
                        next.logo.height = safePrev.logo.height;
                      }
                    }
                  } else {
                    next.logo = safePrev.logo || null;
                  }
                  return next;
                });
                if (changeData.source === 'comment-system') {
                  handleSubmit('draft', true, { ...changeData, content: cleanContentHtml });
                } else {
                  debouncedSave();
                }
              }}
            />
          );
        }}
      </Form.Item>
    </div>
  );
};

export default DocumentContentTab;
