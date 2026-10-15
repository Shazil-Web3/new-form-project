import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';
import apiClient from '../../../api/apiClient';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import ReviseDocument from '../../../components/Home/components/Dashboard/Documents/ReviseDocument';
import ArchiveDocument from '../../../components/Home/components/Dashboard/Documents/ArchiveDocument';
import DocumentPreview from '../../../components/Unified/UnifiedTextEditor/Preview/DocumentPreview';
import ObsoleteReferenceWarningBar from '../../../components/Unified/UnifiedTextEditor/components/ObsoleteReferenceWarningBar';
import InboundReferencesModal from '../../../components/Unified/UnifiedTextEditor/components/InboundReferencesModal';
import { useObsoleteReferences } from '../../../components/Unified/UnifiedTextEditor/hooks/useObsoleteReferences';
import { checkInboundReferences } from '../../../api/references';
import { toastAlert, successAlert } from '../../../utils/alerts';
import { Spin } from 'antd';

// Same parsing rule used elsewhere (e.g. OverviewProgressTab) for the workflow JSON
// stored on the document's `approvers` column: { reviewers: [...], approvers: [...] }.
const parseWorkflowParticipants = (raw) => {
  if (!raw) return { reviewers: [], approvers: [] };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { reviewers: [], approvers: [] };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { reviewers: [], approvers: [] };
  return {
    reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
    approvers: Array.isArray(parsed.approvers) ? parsed.approvers : [],
  };
};

export default function EditDocumentHub() {
  const { docId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [document, setDocument] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const isReferenceView = searchParams.get('view') === 'reference' || searchParams.get('readonly') === 'true';
  const [isRevising, setIsRevising] = useState(!isReferenceView && searchParams.get('revise') === 'true');
  const [isArchiving, setIsArchiving] = useState(!isReferenceView && searchParams.get('archive') === 'true');

  // Inbound references blocking state
  const [inboundBlockedModalVisible, setInboundBlockedModalVisible] = useState(false);
  const [inboundReferencingItems, setInboundReferencingItems] = useState([]);
  const [isCheckingInbound, setIsCheckingInbound] = useState(false);

  const { obsoleteDocs } = useObsoleteReferences({
    sourceType: 'document',
    sourceId: docId,
    content: document?.content,
    elements: document?.elements
  });

  const handleStartRevision = async () => {
    try {
      setLoading(true);
      const res = await apiClient.post(`/api/documents/${docId}/revise`);
      if (res.data?.documentId) {
        navigate(`/document/${res.data.documentId}`, { replace: true });
        return;
      }
      setIsRevising(true);
    } catch (err) {
      console.error('Error starting revision:', err);
      setIsRevising(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAttemptArchive = async () => {
    try {
      setLoading(true);
      const checkRes = await checkInboundReferences(docId);
      if (checkRes && checkRes.isBlocked && checkRes.referencingItems?.length > 0) {
        setInboundReferencingItems(checkRes.referencingItems);
        setInboundBlockedModalVisible(true);
        return;
      }
      setIsArchiving(true);
    } catch (err) {
      console.error('Failed to check inbound references on archive click:', err);
      setIsArchiving(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRecheckInbound = async () => {
    setIsCheckingInbound(true);
    try {
      const checkRes = await checkInboundReferences(docId);
      if (checkRes && checkRes.isBlocked && checkRes.referencingItems?.length > 0) {
        setInboundReferencingItems(checkRes.referencingItems);
        toastAlert('info', `Still referenced by ${checkRes.referencingItems.length} active item(s).`);
      } else {
        setInboundBlockedModalVisible(false);
        setInboundReferencingItems([]);
        successAlert('Cleared!', 'All references to this document have been removed. You can now archive it.');
        setIsArchiving(true);
      }
    } catch (err) {
      console.error('Failed to recheck inbound references:', err);
    } finally {
      setIsCheckingInbound(false);
    }
  };

  useEffect(() => {
    if (!isReferenceView && searchParams.get('revise') === 'true' && document) {
      if (document.status === 'published') {
        handleStartRevision();
      } else {
        setIsRevising(true);
      }
    }
    if (!isReferenceView && (searchParams.get('archive') === 'true' || document?.status === 'archive_draft' || document?.status === 'archive_reviewed')) {
      // If already in archive flow, let them continue, but if arriving via ?archive=true on a published doc, check inbound references
      if (document?.status === 'published' && searchParams.get('archive') === 'true') {
        handleAttemptArchive();
      } else {
        setIsArchiving(true);
      }
    }
  }, [searchParams, isReferenceView, document]);

  const loadData = async () => {
    const userId = user?.id || user?.userId;
    const orgId = user?.organization_id || user?.orgId || user?.org_id;
    if (!userId || !orgId) return;

    try {
      setLoading(true);
      const [docRes, usersRes, catRes, deptRes, tempRes] = await Promise.allSettled([
        apiClient.get(`/api/get_document/${docId}`),
        apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${userId}`)),
        apiClient.get(`/api/template_categories/${orgId}`),
        apiClient.get(`/api/departments/${orgId}`),
        apiClient.get(`/api/templates/${userId}`)
      ]);

      if (docRes.status === 'fulfilled' && docRes.value?.data) {
        const raw = docRes.value.data;
        setDocument(raw?.document || raw);
      }
      if (usersRes.status === 'fulfilled') {
        const raw = usersRes.value?.data;
        setUsers(Array.isArray(raw) ? raw : raw?.data || []);
      }
      if (catRes.status === 'fulfilled') {
        const raw = catRes.value?.data;
        setCategories(Array.isArray(raw) ? raw : raw?.data || []);
      }
      if (deptRes.status === 'fulfilled') {
        const raw = deptRes.value?.data;
        setDepartments(Array.isArray(raw) ? raw : raw?.data || []);
      }
      if (tempRes.status === 'fulfilled') {
        const raw = tempRes.value?.data;
        setTemplates(Array.isArray(raw) ? raw : raw?.data || []);
      }
    } catch (err) {
      console.error('Error loading document dependencies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [docId, user?.id]);

  const handleBack = () => {
    if (window.history && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const docStatus = String(document?.status || '').toLowerCase();
  const isPublished = docStatus === 'published' || docStatus === 'active';
  const isDraft = docStatus === 'draft';
  // Lock content for the whole in-progress lifecycle (sent for review/approval through
  // published), not just once published — matching the approval workflow requirement.
  // A document that was rejected and sent back stays on 'pending_review' too, so an
  // unresolved rejection on it keeps the content editable for the author to address it.
  const LOCKED_WORKFLOW_STATUSES = ['pending_review', 'pending_approval', 'reviewed', 'approved', 'published', 'active', 'revised'];
  const { reviewers: docReviewers, approvers: docApprovers } = parseWorkflowParticipants(document?.approvers);
  const hasUnresolvedRejection = [...docReviewers, ...docApprovers].some(
    (participant) => String(participant?.status || '').toLowerCase() === 'rejected'
  );
  const isLockedWorkflowStatus = LOCKED_WORKFLOW_STATUSES.includes(docStatus) && !hasUnresolvedRejection;
  const isReadOnly = isReferenceView || isLockedWorkflowStatus || searchParams.get('readonly') === 'true';

  const obsoleteDocIds = obsoleteDocs.map((d) => d.id);

  return (
    <MainLayout fullWidth={true}>
      <ObsoleteReferenceWarningBar
        obsoleteDocs={obsoleteDocs}
        itemType="document"
        onRevise={handleStartRevision}
        canRevise={!isReferenceView}
      />
      {loading || !document ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" tip="Loading document..." />
        </div>
      ) : isReferenceView ? (
        <DocumentPreview
          document={document}
          currentUser={user}
          users={users}
          categories={categories}
          departments={departments}
          onCancel={handleBack}
          readOnly={true}
          isReferenceView={true}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : isArchiving ? (
        <ArchiveDocument
          document={document}
          user={user}
          users={users}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : isRevising ? (
        <ReviseDocument
          isRevising={true}
          isRevise={true}
          document={document}
          user={user}
          users={users}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : isDraft ? (
        <ReviseDocument
          document={document}
          user={user}
          users={users}
          departments={departments}
          templates={templates}
          fetchUserData={loadData}
          onCancel={handleBack}
          onSuccess={handleBack}
          obsoleteDocIds={obsoleteDocIds}
        />
      ) : (
        <DocumentPreview
          document={document}
          currentUser={user}
          users={users}
          categories={categories}
          departments={departments}
          onCancel={handleBack}
          onRevise={handleStartRevision}
          onArchive={handleAttemptArchive}
          readOnly={isReadOnly}
          isReferenceView={isReferenceView}
          obsoleteDocIds={obsoleteDocIds}
        />
      )}

      {/* Inbound References Blocking Modal */}
      <InboundReferencesModal
        visible={inboundBlockedModalVisible}
        onClose={() => setInboundBlockedModalVisible(false)}
        documentTitle={document?.title || document?.name}
        referencingItems={inboundReferencingItems}
        onRecheck={handleRecheckInbound}
        isRechecking={isCheckingInbound}
      />
    </MainLayout>
  );
}
