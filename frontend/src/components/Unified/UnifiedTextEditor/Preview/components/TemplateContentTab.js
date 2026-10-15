import React from 'react';
import { Card, Spin } from 'antd';
import PreviewEditor from '../../PreviewEditor';
import TemplateApproversBar from './TemplateApproversBar';
import { isSkeletonEditorContent } from '../../../../../utils/editorContentGuards';

const WORKFLOW_REVIEW_APPROVAL_STATUSES = new Set([
  'pending_review',
  'reviewed',
  'pending_approval',
  'approved',
  'published',
]);

const isWorkflowReviewOrApproval = (status) =>
  WORKFLOW_REVIEW_APPROVAL_STATUSES.has(status);

const TemplateContentTab = ({ 
  parsedTemplate, 
  contentHtml, 
  loading,
  contentLoaded = false,
  comments, 
  suggestions, 
  references,
  logo,
  headerHTML,
  footerHTML,
  logoText,
  logoTextRight,
  orientation,
  paperSize,
  pagesState,
  setHeaderHTML,
  setFooterHTML,
  setLogoText,
  setLogoTextRight,
  setLogo,
  setOrientation,
  setPaperSize,
  setPagesState,
  currentUser, 
  socketUpdateKey, 
  pagesContainerRef,
  setContentHtml,
  handleCommentsChange,
  handleSuggestionsChange,
  handleReferencesChange,
  emitCommentAdd,
  emitCommentUpdate,
  emitCommentDelete,
  emitSuggestionAdd,
  emitSuggestionUpdate,
  emitSuggestionDelete,

  lastTypingTimeRef,
  userRole,
  isDocument = false,
  readOnly = false,
  isReferenceView = false,
  handleReview,
  handleApprove,
  setShowRejectionModal,
  isReviewing,
  isApproving,
  isRejecting
}) => {
  const isWorkflowState = isWorkflowReviewOrApproval(parsedTemplate?.status);
  const documentTitle = parsedTemplate?.name || parsedTemplate?.title || '';

  const memoizedInitialContent = React.useMemo(() => ({
    content: contentHtml || '',
    headerHTML: headerHTML || '',
    footerHTML: footerHTML || '',
    logo: logo || null,
    logoText: logoText || '',
    logoTextRight: logoTextRight || '',
    orientation: orientation || 'portrait',
    paperSize: paperSize || 'A4',
    pagesState: pagesState || null
  }), [contentHtml, headerHTML, footerHTML, logo, logoText, logoTextRight, orientation, paperSize, pagesState]);

  return (
    <Card style={{ }} bodyStyle={{ padding: 0 }} bordered={false}>
      <div className="template-content-preview">
        <div className="template-editor-wrapper" style={{ display: 'flex', flexDirection: 'column', position: 'relative', minHeight: '800px', width: '100%' }}>
          {(() => {
            if ((!contentHtml || isSkeletonEditorContent(contentHtml)) && !contentLoaded) {
               return (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>Loading content...</div>
                </div>
               );
            } else {
              return (
                <PreviewEditor
                  isDraft={String(parsedTemplate?.status ?? '').toLowerCase() === 'draft'}
                  user={currentUser}
                  currentUser={currentUser}
                  userRole={userRole} // Pass userRole
                  initialContent={memoizedInitialContent}
                  logo={logo}
                  setLogo={setLogo}
                  headerHTML={headerHTML}
                  footerHTML={footerHTML}
                  logoText={logoText}
                  logoTextRight={logoTextRight}
                  orientation={orientation}
                  paperSize={paperSize}
                  pagesState={pagesState}
                  comments={comments}
                  templateApprovers={parsedTemplate?.template_approvers}
                  reviewers={parsedTemplate?.template_approvers?.reviewers}
                  suggestions={suggestions}
                  references={references}
                  templateId={isDocument ? parsedTemplate.template_id : (parsedTemplate.id || parsedTemplate.template_id)}
                  documentId={isDocument ? (parsedTemplate.document_id || parsedTemplate.id) : undefined}
                  socketEnabled={true}
                  showTOC={parsedTemplate.includeTableOfContents}
                  pagesContainerRef={pagesContainerRef}
                  isApprovalState={parsedTemplate?.status === 'pending_approval' || parsedTemplate?.status === 'approved'}
                  isDocument={isDocument}
                  readOnly={readOnly}
                  documentTitle={documentTitle}
                  syncTitleToHeader={isWorkflowState}
                  lockHeaderEditing={isWorkflowState || readOnly || isReferenceView}
                  approversContent={
                    <TemplateApproversBar
                      parsedTemplate={parsedTemplate}
                      currentUser={currentUser}
                      namesOnly={true}
                    />
                  }
                  onContentChange={(changeData) => {
                    const htmlContent = typeof changeData?.htmlContent === 'string'
                      ? changeData.htmlContent
                      : '';
                    const acceptedBody = Boolean(htmlContent && !isSkeletonEditorContent(htmlContent));
                    if (acceptedBody) {
                      if (lastTypingTimeRef) {
                        lastTypingTimeRef.current = Date.now();
                      }
                      setContentHtml(htmlContent);
                    }
                    if (changeData?.headerHTML !== undefined) {
                      setHeaderHTML(changeData.headerHTML || '');
                    }
                    if (changeData?.footerHTML !== undefined) {
                      setFooterHTML(changeData.footerHTML || '');
                    }
                    if (changeData?.logoText !== undefined) {
                      setLogoText(changeData.logoText || '');
                    } else if (changeData?.logo?.text !== undefined) {
                      setLogoText(changeData.logo.text || '');
                    }
                    
                    if (changeData?.logoTextRight !== undefined) {
                      setLogoTextRight(changeData.logoTextRight || '');
                    } else if (changeData?.logo?.textRight !== undefined) {
                      setLogoTextRight(changeData.logo.textRight || '');
                    }

                    if (changeData?.orientation !== undefined && setOrientation) {
                      setOrientation(changeData.orientation || 'portrait');
                    }
                    if (changeData?.paperSize !== undefined && setPaperSize) {
                      setPaperSize(changeData.paperSize || 'A4');
                    }
                    if (changeData?.pagesState !== undefined && setPagesState) {
                      setPagesState(changeData.pagesState || null);
                    }
                  }}
                  onTyping={() => {
                    // Update typing time IMMEDIATELY on any user interaction
                    if (lastTypingTimeRef) {
                      lastTypingTimeRef.current = Date.now();
                    }
                  }}
                  onCommentsChange={handleCommentsChange}
                  onSuggestionsChange={handleSuggestionsChange}
                  onReferencesChange={handleReferencesChange}
                  onCommentAdd={emitCommentAdd}
                  onCommentUpdate={emitCommentUpdate}
                  onCommentDelete={emitCommentDelete}
                  onSuggestionAdd={emitSuggestionAdd}
                  onSuggestionUpdate={emitSuggestionUpdate}
                  onSuggestionDelete={emitSuggestionDelete}
                />
              );
            }
          })()}
        </div>
      </div>
    </Card>
  );
};

export default TemplateContentTab;
