import React from 'react';
import UnifiedTextEditor from "../../../../../../Unified/UnifiedTextEditor";

const EditorWrapper = ({
  isActive = true,
  user,
  currentTemplateId,
  contentData,
  setContentData,
  onAutoSaveRequested,
  documentTitle,
  template,
  status,
  isDraft,
  workflowApprovers,
  approvers,
  isRevise = false
}) => {
  const effectiveIsDraft = isRevise ? false : Boolean(
    isDraft === true ||
    template?.status === 'draft' ||
    status === 'draft' ||
    String(template?.status || status || contentData?.status || '').toLowerCase() === 'draft'
  );

  const mergedInitial = React.useMemo(() => {
    const cd = contentData && typeof contentData === 'object' ? contentData : {};
    const docTitle = (documentTitle || '').trim();
    return {
      content: cd.content || '',
      comments: cd.comments || [],
      suggestions: cd.suggestions || [],
      references: cd.references || [],
      logo: cd.logo || null,
      headerHTML: cd.headerHTML !== undefined && cd.headerHTML !== '' ? cd.headerHTML : docTitle,
      footerHTML: cd.footerHTML || '',
      logoText: cd.logoText || '',
      logoTextRight: cd.logoTextRight || '',
      orientation: cd.orientation || 'portrait',
      paperSize: cd.paperSize || 'A4',
      pagesState: cd.pagesState || null,
      status: cd.status || template?.status || status || (effectiveIsDraft ? 'draft' : undefined)
    };
  }, [contentData, documentTitle, template?.status, status, effectiveIsDraft]);

  return (
    <div style={{ padding: 0 }}>
      <UnifiedTextEditor
        isActive={isActive}
        mode="create"
        user={user}
        templateId={currentTemplateId}
        documentTitle={documentTitle}
        initialContent={mergedInitial}
        workflowApprovers={workflowApprovers}
        approvers={approvers || workflowApprovers}
        logo={mergedInitial.logo}
        setLogo={(logo) => setContentData(prev => ({ ...prev, logo }))}
        socketEnabled={!!currentTemplateId}
        template={template}
        status={status || template?.status || (effectiveIsDraft ? 'draft' : undefined)}
        isDraft={effectiveIsDraft}
        isRevise={isRevise}
        onContentChange={(changeData) => {
          setContentData(prev => {
            const safePrev = prev && typeof prev === 'object' ? prev : {};
            const cleanContentHtml = changeData?.htmlContent || changeData?.content || '';
            const next = { ...safePrev, ...changeData, content: cleanContentHtml };
            if (Object.prototype.hasOwnProperty.call(changeData, 'logo')) {
              if (changeData.logo === null) {
                next.logo = null;
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
            }
            return next;
          });

          // Check source for smart autosave
          if (changeData.source === 'comment-system') {
            if (onAutoSaveRequested) {
              onAutoSaveRequested(changeData, true); // true = instant
            }
          } else {
            if (onAutoSaveRequested) {
              onAutoSaveRequested(changeData, false); // false = debounced
            }
          }
        }}
      />
    </div>
  );
};

export default EditorWrapper;
