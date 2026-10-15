// Document persistence logic hook
import { useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { errorAlert, successAlert, toastAlert } from '../../../../../../utils/alerts';
import { extractTemplateContent, mapParticipantRoleForDb } from '../helpers/createDocumentHelpers';

export function useDocumentPersistence({
  user,
  creatorId,
  document,
  form,
  contentData,
  templates,
  tasks,
  participants,
  tempAttachments,
  tempManualReferences,
  documentNotes,
  impactData,
  documentRequiredApprovers,
  documentWorkflowApprovers,
  sharedDueDate,
  documentNumber,
  projectNumber,
  costCenterNumber,
  setDocumentNumber,
  currentDocumentId,
  setCurrentDocumentId,
  currentDocumentIdRef,
  isCreatingRef,
  setActiveTab,
  validateAllTabs,
  onSuccess,
  relatedDocumentIds = [],
}) {
  const buildResolvedTemplateContent = useCallback((templateId) => {
    if (!templateId) return null;
    const t = templates.find((x) => x.id === templateId);
    return t ? extractTemplateContent(t) : null;
  }, [templates]);

  const buildDocumentPayload = useCallback((formValues, activeContent, docStatus, workflowForSubmit) => {
    const templateContent = buildResolvedTemplateContent(formValues.templateId);
    let finalContent = activeContent?.content;
    let finalLogo = activeContent?.logo;
    let finalLogoText = activeContent?.logoText || '';
    let finalLogoTextRight = activeContent?.logoTextRight || '';

    if (templateContent && typeof templateContent === 'object') {
      if (finalContent == null || finalContent === '') {
        finalContent = templateContent.content;
      }
      if (finalLogo == null) finalLogo = templateContent.logo;
      if (!finalLogoText) finalLogoText = templateContent.logoText || '';
      if (!finalLogoTextRight) finalLogoTextRight = templateContent.logoTextRight || '';
    }

    const title =
      (formValues.title || '').trim() || `Untitled Document - ${new Date().toLocaleDateString()}`;

    const validTasks = tasks
      .filter((task) => task.title && task.title.trim() !== '')
      .map((task) => ({
        title: task.title,
        description: task.description || null,
        due_date:
          task.dueDate && typeof task.dueDate.format === 'function'
            ? task.dueDate.format('YYYY-MM-DD HH:mm')
            : null,
        created_by: creatorId
      }));

    const orientation = activeContent?.orientation || templateContent?.orientation || 'portrait';
    const paperSize = activeContent?.paperSize || templateContent?.paperSize || 'A4';
    const pagesState = activeContent?.pagesState || templateContent?.pagesState || null;

    const documentData = {
      title,
      created_by: creatorId,
      template_id: (document && document.document_id && (formValues.templateId === document.template_id || !formValues.templateId))
        ? document.document_id
        : (formValues.templateId || null),
      content: {
        content: finalContent ?? '',
        logo: finalLogo ?? null,
        logoText: finalLogoText || '',
        logoTextRight: finalLogoTextRight || '',
        orientation,
        paperSize,
        pagesState,
        references: (activeContent?.references && Array.isArray(activeContent.references))
          ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
          : [],
        manualReferences: tempManualReferences || []
      },
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML:
        (formValues.title || '').trim() ||
        (activeContent?.headerHTML ?? templateContent?.headerHTML) ||
        '',
      footerHTML: activeContent?.footerHTML || templateContent?.footerHTML || '',
      logo: activeContent?.logo ?? finalLogo,
      logoText: activeContent?.logoText || finalLogoText || '',
      logoTextRight: activeContent?.logoTextRight || finalLogoTextRight || '',
      orientation,
      paperSize,
      pagesState,
      tasks: validTasks,
      participants: participants.map((p) => ({
        user_id: p.userId,
        role: mapParticipantRoleForDb(p.role)
      })),
      status: docStatus,
      tempAttachments: tempAttachments,
      notes: documentNotes || formValues.notes || form.getFieldValue('notes') || '',
      impact: impactData || {},
      required_approvers: documentRequiredApprovers,
      department: formValues.department || '',
      document_number: documentNumber || formValues.documentNumber || null,
      project_number: projectNumber || formValues.projectNumber || null,
      cost_center_number: costCenterNumber || formValues.costCenterNumber || null,
      related_document_ids: relatedDocumentIds || [],
    };

    if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
      documentData.approvers = workflowForSubmit;
    }

    return documentData;
  }, [
    buildResolvedTemplateContent,
    creatorId,
    document,
    tasks,
    participants,
    tempAttachments,
    tempManualReferences,
    documentNotes,
    form,
    impactData,
    documentRequiredApprovers,
    documentNumber,
    projectNumber,
    costCenterNumber,
    relatedDocumentIds,
  ]);

  const buildUpdateBody = useCallback((formValues, activeContent, docStatus, workflowForSubmit, touchStatus) => {
    const templateContent = buildResolvedTemplateContent(formValues.templateId);
    let finalContent = activeContent?.content ?? '';
    let finalLogo = activeContent?.logo;
    let finalLogoText = activeContent?.logoText || '';
    let finalLogoTextRight = activeContent?.logoTextRight || '';

    if (templateContent && typeof templateContent === 'object') {
      if (!finalContent) finalContent = templateContent.content || '';
      if (finalLogo == null) finalLogo = templateContent.logo;
      if (!finalLogoText) finalLogoText = templateContent.logoText || '';
      if (!finalLogoTextRight) finalLogoTextRight = templateContent.logoTextRight || '';
    }

    const orientation = activeContent?.orientation || templateContent?.orientation || 'portrait';
    const paperSize = activeContent?.paperSize || templateContent?.paperSize || 'A4';
    const pagesState = activeContent?.pagesState || templateContent?.pagesState || null;

    const title =
      (formValues.title || '').trim() ||
      document?.title ||
      'Untitled Document';

    const contentObj = {
      content: finalContent ?? '',
      logo: finalLogo ?? null,
      logoText: finalLogoText || '',
      logoTextRight: finalLogoTextRight || '',
      orientation,
      paperSize,
      pagesState,
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || []
    };
    const elementsObj = {
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML:
        (activeContent?.headerHTML ?? templateContent?.headerHTML) ||
        (formValues.title || '').trim() ||
        '',
      footerHTML: activeContent?.footerHTML || templateContent?.footerHTML || '',
      logo: activeContent?.logo ?? finalLogo,
      logoText: activeContent?.logoText || finalLogoText || '',
      logoTextRight: activeContent?.logoTextRight || finalLogoTextRight || '',
      orientation,
      paperSize,
      pagesState
    };

    const body = {
      title,
      content: JSON.stringify(contentObj),
      elements: JSON.stringify(elementsObj),
      notes: documentNotes || formValues.notes || form.getFieldValue('notes') || '',
      impact: impactData || {},
      required_approvers: documentRequiredApprovers,
      department: formValues.department || '',
      project_number: projectNumber || formValues.projectNumber || null,
      cost_center_number: costCenterNumber || formValues.costCenterNumber || null,
      related_document_ids: relatedDocumentIds || [],
    };

    if (touchStatus && docStatus) {
      body.status = docStatus;
    }
    if (workflowForSubmit) {
      body.approvers = workflowForSubmit;
    }
    return body;
  }, [
    buildResolvedTemplateContent,
    document,
    tempManualReferences,
    documentNotes,
    form,
    impactData,
    documentRequiredApprovers,
    projectNumber,
    costCenterNumber,
    relatedDocumentIds,
  ]);

  const persistDocument = useCallback(async (docStatus, isAutoSave, overrideContent) => {
    if (!user || creatorId == null) {
      if (!isAutoSave) errorAlert('Not signed in', 'You must be logged in to save.');
      return false;
    }
    const effectiveId = currentDocumentIdRef.current || currentDocumentId;
    const activeContent = overrideContent || contentData;
    const formValues = form.getFieldsValue(true);

    if (isAutoSave) {
      if (!effectiveId && !formValues.title?.trim()) return false;
    } else if (docStatus === 'draft') {
      try {
        await form.validateFields(['title']);
      } catch {
        message.error('Enter a document title on Basic Info before saving a draft.');
        if (setActiveTab) setActiveTab('basicInfo');
        return false;
      }
    }

    let workflowForSubmit = null;
    if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
      let updated = { ...documentWorkflowApprovers };
      if (sharedDueDate) {
        const targetArray = docStatus === 'pending_review' ? 'reviewers' : 'approvers';
        updated[targetArray] = updated[targetArray].map((a) => ({
          ...a,
          dueDate: sharedDueDate
        }));
      }
      workflowForSubmit = updated;
    }

    try {
      if (effectiveId) {
        const touchStatus = isAutoSave ? false : docStatus !== undefined;
        const body = buildUpdateBody(
          formValues,
          activeContent,
          docStatus,
          workflowForSubmit,
          touchStatus
        );
        if (isAutoSave) {
          delete body.status;
          delete body.approvers;
        }
        const res = await axios.put(`/api/update_document/${effectiveId}`, body);
        if (res.data.success) {
          if (!isAutoSave && onSuccess) onSuccess();
          return true;
        }
      } else {
        // Prevent duplicate document creation (common when auto-save fires before the first create resolves).
        if (isCreatingRef.current) return false;
        isCreatingRef.current = true;
        const payload = buildDocumentPayload(formValues, activeContent, docStatus, workflowForSubmit);
        const res = await axios.post('/api/create-document', payload);
        if (res.data.success) {
          const newId = res.data.document_id;
          currentDocumentIdRef.current = newId;
          if (setCurrentDocumentId) setCurrentDocumentId(newId);
          if (res.data.document_number) {
            if (setDocumentNumber) setDocumentNumber(res.data.document_number);
            form.setFieldsValue({ documentNumber: res.data.document_number });
          }
          if (!isAutoSave && onSuccess) {
            onSuccess();
          }
          return true;
        }
      }
    } catch (error) {
      if (!isAutoSave) {
        errorAlert(
          'Save failed',
          error.response?.data?.message || error.response?.data?.error || error.message
        );
      }
      return false;
    } finally {
      if (!effectiveId) {
        isCreatingRef.current = false;
      }
    }
    return false;
  }, [
    user,
    creatorId,
    currentDocumentIdRef,
    currentDocumentId,
    contentData,
    form,
    documentWorkflowApprovers,
    sharedDueDate,
    buildUpdateBody,
    buildDocumentPayload,
    isCreatingRef,
    setCurrentDocumentId,
    setDocumentNumber,
    onSuccess,
    setActiveTab,
  ]);

  const handleSubmit = useCallback((status = 'draft', isAutoSave = false, overrideContent = null) => {
    if (isAutoSave) {
      persistDocument('draft', true, overrideContent);
      return;
    }
    if (status === 'draft') {
      persistDocument('draft', false, null).then((ok) => {
        if (ok) toastAlert('Document saved as draft');
      });
      return;
    }
    if (status === 'pending_review' || status === 'pending_approval') {
      if (!validateAllTabs) return;
      validateAllTabs().then((result) => {
        const { isValid, failedTab } = result;
        if (!isValid) {
          // If the impact tab is incomplete, show a specific message
          if (failedTab === "impact") {
            errorAlert(
              'Submission failed',
              'Please complete all fields in the Impact Form before submitting for review or approval.'
            );
          } else {
            errorAlert(
              'Creation Failed',
              'Complete the information in Basic Tab'
            );
          }
          return;
        }
        persistDocument(status, false, null).then((ok) => {
          if (ok) {
            const actionText = status === 'pending_review' ? 'review' : 'approval';
            successAlert('Document submitted', `Document submitted for ${actionText} successfully.`);
          }
        });
      });
    }
  }, [persistDocument, validateAllTabs]);

  return {
    persistDocument,
    handleSubmit,
    buildResolvedTemplateContent,
    buildDocumentPayload,
    buildUpdateBody,
  };
}

export default useDocumentPersistence;
