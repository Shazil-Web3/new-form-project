/**
 * @file useDashboardState.js
 * @description Custom React hook managing Unified Dashboard state, REST requests, and filter computations
 * @dependencies api/documents, api/templates, api/users, utils/dashboardUtils
 * @author Codegen
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { successAlert, errorAlert, confirmAlert, warningAlert, inputAlert, toastAlert } from '../../utils/alerts';
import { getMyDocs, getAllDocs, updateStatusSimple, getPublishReadiness, publishDocumentGroup, reviewDocument, approveDocument, rejectDocument, togglePinDocument, updateDocumentProgress, removeDocument } from '../../api/documents';
import { listTemplates, updateTemplateStatus, removeTemplate, listCategories, reviewTemplate, approveTemplate, rejectTemplate, togglePinTemplate, updateTemplateProgress } from '../../api/templates';

import apiClient from '../../api/apiClient';
import { listDepartments } from '../../api/users';
import { checkInboundReferences } from '../../api/references';
import { getDisplayCategory, getApproversForTemplate, getApproversForDoc, computeItemDetailsAndFilter } from '../../pages/new/Hub/utils/dashboardUtils';
import { getStageBadgeText } from '../../components/Unified/UnifiedTextEditor/Preview/components/TemplateOverviewTab';

export default function useDashboardState(initialType, user, initialActiveTab) {
  const navigate = useNavigate();

  const [dashboardType, setDashboardType] = useState(initialType || 'all');
  const [activeTab, setActiveTab] = useState(initialActiveTab || 'In Progress');
  const [viewAllReadOnly, setViewAllReadOnly] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboard_view_mode') || 'list';
  });
  const [loading, setLoading] = useState(true);

  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  // Inbound references blocking modal state
  const [inboundBlockedModalVisible, setInboundBlockedModalVisible] = useState(false);
  const [inboundReferencingItems, setInboundReferencingItems] = useState([]);
  const [inboundTargetTitle, setInboundTargetTitle] = useState('');
  const [inboundTargetId, setInboundTargetId] = useState(null);
  const [inboundTargetIsTemplate, setInboundTargetIsTemplate] = useState(false);
  const [isCheckingInbound, setIsCheckingInbound] = useState(false);

  // Archive Approval Workflow State
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archiveTargetItem, setArchiveTargetItem] = useState(null);
  const [archiveApprovers, setArchiveApprovers] = useState({ reviewers: [], approvers: [] });
  const [archiveDueDate, setArchiveDueDate] = useState('');

  // Mocked state overrides for Pinned & Progress (Backend Gaps)
  // TODO: Replace with database values once 'is_pinned' columns are added to documents/templates tables.
  const [pinnedIds, setPinnedIds] = useState(new Set());
  // TODO: Replace with database values once 'progress_value' column is added to documents table.
  const [progressOverrides, setProgressOverrides] = useState({});
  const [reassignedIds, setReassignedIds] = useState(() => new Set());

  const [tabFilters, setTabFilters] = useState({
    'Draft': { searchVal: '', selectedDept: '', startDate: '', endDate: '', selectedOwner: '', selectedApproverGroup: '', sortBy: '', appliedSearch: '', appliedDept: '', appliedStartDate: '', appliedEndDate: '', appliedOwner: '', appliedApproverGroup: '' },
    'In Progress': { searchVal: '', selectedDept: '', startDate: '', endDate: '', selectedOwner: '', selectedApproverGroup: '', sortBy: '', appliedSearch: '', appliedDept: '', appliedStartDate: '', appliedEndDate: '', appliedOwner: '', appliedApproverGroup: '' },
    'Published': { searchVal: '', selectedDept: '', startDate: '', endDate: '', selectedOwner: '', selectedApproverGroup: '', sortBy: '', appliedSearch: '', appliedDept: '', appliedStartDate: '', appliedEndDate: '', appliedOwner: '', appliedApproverGroup: '' },
    'Archived': { searchVal: '', selectedDept: '', startDate: '', endDate: '', selectedOwner: '', selectedApproverGroup: '', sortBy: '', appliedSearch: '', appliedDept: '', appliedStartDate: '', appliedEndDate: '', appliedOwner: '', appliedApproverGroup: '' },
  });

  const currentFilters = tabFilters[activeTab] || {
    searchVal: '', selectedDept: '', startDate: '', endDate: '', selectedOwner: '', selectedApproverGroup: '', sortBy: '',
    appliedSearch: '', appliedDept: '', appliedStartDate: '', appliedEndDate: '', appliedOwner: '', appliedApproverGroup: ''
  };

  const setFilterField = (field, value) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value
      }
    }));
  };

  const setSearchVal = (val) => {
    setTabFilters(prev => {
      const updated = { ...prev };
      // Keep searchVal and appliedSearch synchronized across all tabs so switching tabs doesn't wipe out the search
      Object.keys(updated).forEach(tab => {
        updated[tab] = {
          ...updated[tab],
          searchVal: val,
          appliedSearch: val
        };
      });
      return updated;
    });
    setCurrentPage(1);
  };

  const setSelectedDept = (val) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        selectedDept: val,
        appliedDept: val
      }
    }));
    setCurrentPage(1);
  };
  const setStartDate = (val) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        startDate: val,
        appliedStartDate: val
      }
    }));
    setCurrentPage(1);
  };
  const setEndDate = (val) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        endDate: val,
        appliedEndDate: val
      }
    }));
    setCurrentPage(1);
  };
  const setSelectedOwner = (val) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        selectedOwner: val,
        appliedOwner: val
      }
    }));
    setCurrentPage(1);
  };
  const setSelectedApproverGroup = (val) => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        selectedApproverGroup: val,
        appliedApproverGroup: val
      }
    }));
    setCurrentPage(1);
  };
  const setSortBy = (val) => {
    setFilterField('sortBy', val);
    setCurrentPage(1);
  };

  const setAppliedSearch = (val) => setFilterField('appliedSearch', val);
  const setAppliedDept = (val) => setFilterField('appliedDept', val);
  const setAppliedStartDate = (val) => setFilterField('appliedStartDate', val);
  const setAppliedEndDate = (val) => setFilterField('appliedEndDate', val);
  const setAppliedOwner = (val) => setFilterField('appliedOwner', val);
  const setAppliedApproverGroup = (val) => setFilterField('appliedApproverGroup', val);

  const {
    searchVal,
    selectedDept,
    startDate,
    endDate,
    selectedOwner,
    selectedApproverGroup,
    sortBy,
    appliedSearch,
    appliedDept,
    appliedStartDate,
    appliedEndDate,
    appliedOwner,
    appliedApproverGroup,
  } = currentFilters;

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const fetchData = async () => {
    if (!user) return;
    const userId = user.id || user.userId;
    const orgId = user.organization_id || user.orgId || user.org_id;
    if (!userId || !orgId) return;

    try {
      setLoading(true);

      // Parallelize all requests using Promise.allSettled for maximum speed
      const [tRes, cRes, dRes, deptsRes, usersRes] = await Promise.allSettled([
        listTemplates(userId),
        listCategories(orgId),
        getAllDocs(),
        listDepartments(orgId),
        apiClient.get('/api/users').catch(() => apiClient.get(`/api/org_members/${userId}`))
      ]);

      setTemplates(tRes.status === 'fulfilled' && Array.isArray(tRes.value) ? tRes.value : []);
      setCategories(cRes.status === 'fulfilled' && Array.isArray(cRes.value) ? cRes.value : []);
      setDocuments(dRes.status === 'fulfilled' && Array.isArray(dRes.value) ? dRes.value : []);
      setDepartments(deptsRes.status === 'fulfilled' && Array.isArray(deptsRes.value) ? deptsRes.value : []);
      if (usersRes.status === 'fulfilled') {
        const rawUsers = usersRes.value?.data;
        setUsers(Array.isArray(rawUsers) ? rawUsers : rawUsers?.data || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    setViewAllReadOnly(user?.role === 'viewer');
  }, [user, activeTab]);

  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  useEffect(() => {
    if (initialType) {
      setDashboardType(initialType);
    }
  }, [initialType]);

  const handleTogglePin = async (itemId) => {
    const isTemplate = templates.some(t => String(t.id) === String(itemId));
    try {
      if (isTemplate) {
        await togglePinTemplate(itemId);
      } else {
        await togglePinDocument(itemId);
      }
      fetchData();
      toastAlert('Pin state updated.');
    } catch (e) {
      errorAlert('Error', 'Failed to update pin state.');
    }
  };

  const handleProgressChange = async (itemId, newValue) => {
    const isTemplate = templates.some(t => String(t.id) === String(itemId));
    console.log(`🚀 [useDashboardState] Updating ${isTemplate ? 'template' : 'document'} (${itemId}) progress to ${newValue}%`);
    try {
      if (isTemplate) {
        await updateTemplateProgress(itemId, newValue);
      } else {
        await updateDocumentProgress(itemId, newValue);
      }
      setProgressOverrides(prev => ({ ...prev, [itemId]: newValue }));
      console.log(`✅ [useDashboardState] Successfully persisted progress ${newValue}% for ${itemId}`);
      fetchData();
    } catch (e) {
      console.error('❌ [useDashboardState] Failed to update progress:', e);
      errorAlert('Error', 'Failed to update progress on the server.');
    }
  };

  // Helper for status updates
  const updateStatus = async (itemId, isTemplate, label, targetStatus, danger = false) => {
    const result = await confirmAlert(label, `${label} this item?`, label, danger ? 'danger' : undefined);
    if (!result.isConfirmed) return;
    try {
      if (isTemplate) await updateTemplateStatus(itemId, targetStatus);
      else await updateStatusSimple(itemId, targetStatus);
      successAlert(label, `${label} completed successfully.`);
      fetchData();
    } catch {
      errorAlert('Failed', `Could not ${label.toLowerCase()} item.`);
    }
  };

  const handleAction = async (action, itemId, type) => {
    let isTemplate = type === 'template';
    if (!type) {
      isTemplate = templates.some(t => String(t.id) === String(itemId));
    }
    const item = isTemplate
      ? templates.find(t => String(t.id) === String(itemId))
      : documents.find(d => String(d.id || d.document_id) === String(itemId));
    const targetId = isTemplate ? itemId : (item?.document_id || item?.id || itemId);

    if (action === 'use') navigate(isTemplate ? `/document/new?templateId=${targetId}` : `/document/new?documentId=${targetId}`);
    else if (action === 'edit' || action === 'preview' || action === 'review' || action === 'archive_edit') {
      const isArch = item?.status === 'archive_draft' || item?.status === 'archive_reviewed' || action === 'archive_edit';
      const suffix = isArch ? '?archive=true' : '';
      navigate(isTemplate ? `/template/${targetId}${suffix}` : `/document/${targetId}${suffix}`);
    }
    else if (action === 'revise') {
      if (isTemplate) {
        const existingDraft = templates.find(t => 
          String(t.revision_parent_id) === String(itemId) && 
          ['draft', 'pending_revision', 'pending_review', 'pending_approval'].includes(t.status)
        );
        if (existingDraft) {
          const result = await confirmAlert(
            'Resume Revision',
            `An in-progress revision (v${existingDraft.version || '3.0'}) already exists for "${item?.name || 'this template'}". Do you want to resume editing it?`,
            'Resume Draft'
          );
          if (result.isConfirmed) {
            navigate(`/template/${existingDraft.id}`);
          }
          return;
        }
      } else {
        const existingDraft = documents.find(d => 
          String(d.revision_parent_id) === String(itemId) && 
          ['draft', 'pending_revision', 'pending_review', 'pending_approval'].includes(d.status)
        );
        if (existingDraft) {
          const result = await confirmAlert(
            'Resume Revision',
            `An in-progress revision (v${existingDraft.version || '3.0'}) already exists for "${item?.title || 'this document'}". Do you want to resume editing it?`,
            'Resume Draft'
          );
          if (result.isConfirmed) {
            navigate(`/document/${existingDraft.id || existingDraft.document_id}`);
          }
          return;
        }
      }

      const result = await confirmAlert(
        'Revise Version',
        `Do you want to create a new revision for "${item?.name || item?.title || 'this item'}"?`,
        'Start Revision'
      );
      if (result.isConfirmed) {
        if (isTemplate) {
          navigate(`/template/${itemId}?revise=true`);
        } else {
          try {
            const res = await apiClient.post(`/api/documents/${itemId}/revise`);
            if (res.data && res.data.documentId) {
              navigate(`/document/${res.data.documentId}`);
            } else {
              navigate(`/document/${itemId}?revise=true`);
            }
          } catch (err) {
            console.error('Failed to create revision copy:', err);
            navigate(`/document/${itemId}?revise=true`);
          }
        }
      }
    }
    else if (action === 'submit') await updateStatus(targetId, isTemplate, 'Submit', 'pending_review');
    else if (action === 'publish') {
      if (isTemplate) {
        await updateStatus(targetId, true, 'Publish', 'published');
        return;
      }

      // Check publish readiness for document and its related group
      try {
        const readiness = await getPublishReadiness(targetId);
        if (readiness && readiness.canPublish === false && Array.isArray(readiness.blockedBy) && readiness.blockedBy.length > 0) {
          const blockedItemsHtml = readiness.blockedBy
            .map(
              (b) =>
                `<li style="margin-bottom: 8px;"><strong>"${b.title || 'Untitled'}"</strong> is currently in <span style="font-weight: 600; color: #2563eb;">${getStageBadgeText(b.status)}</span></li>`
            )
            .join('');

          await warningAlert(
            'Cannot Publish Document',
            '',
            {
              html: `
                <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.6;">
                  <p style="margin-bottom: 12px;">This document cannot be published individually because it is linked to related document(s) that are still in progress:</p>
                  <ul style="margin: 0 0 14px 18px; padding: 0; list-style-type: disc;">
                    ${blockedItemsHtml}
                  </ul>
                  <p style="margin: 0; color: #64748b; font-size: 13px;">
                    All related documents must complete review and approval before they can be published together.
                  </p>
                </div>
              `,
              confirmButtonText: 'Understood',
              confirmButtonColor: '#2563eb',
            }
          );
          return;
        }

        // If part of an approved related group (groupSize > 1 and all approved)
        if (readiness && readiness.groupSize > 1 && Array.isArray(readiness.groupDetails)) {
          const groupListHtml = readiness.groupDetails
            .map(
              (d) =>
                `<li style="margin-bottom: 6px;"><strong>"${d.title || 'Untitled'}"</strong> (<span style="color: #16a34a; font-weight: 600;">Approved</span>)</li>`
            )
            .join('');

          const confirmResult = await confirmAlert(
            'Publish Related Documents',
            '',
            `Publish All (${readiness.groupSize})`,
            'Cancel',
            {
              html: `
                <div style="text-align: left; font-size: 14px; color: #334155; line-height: 1.6;">
                  <p style="margin-bottom: 10px;">All <strong>${readiness.groupSize}</strong> documents in this related group have completed approval:</p>
                  <ul style="margin: 0 0 14px 18px; padding: 0; list-style-type: disc;">
                    ${groupListHtml}
                  </ul>
                  <p style="margin: 0; font-size: 13px; color: #0284c7; font-weight: 500;">
                    Publishing will atomically publish all ${readiness.groupSize} documents together.
                  </p>
                </div>
              `,
              confirmButtonColor: '#2563eb',
            }
          );

          if (confirmResult.isConfirmed) {
            try {
              const docIds = readiness.groupDetails.map((d) => d.document_id);
              await publishDocumentGroup(docIds);
              successAlert('Published', `Successfully published ${docIds.length} related document(s).`);
              fetchData();
            } catch (pubErr) {
              errorAlert('Publish Failed', pubErr?.response?.data?.message || 'Failed to publish document group.');
            }
          }
          return;
        }
      } catch (readinessErr) {
        console.warn('[useDashboardState] Publish readiness notice:', readinessErr);
      }

      await updateStatus(targetId, false, 'Publish', 'published');
    }
    else if (action === 'archive') {
      const s = (item?.status || '').toLowerCase();
      const targetTitle = item?.name || item?.title || 'this item';

      // Check inbound references for documents before allowing archival
      if (!isTemplate) {
        try {
          const checkRes = await checkInboundReferences(targetId);
          if (checkRes && checkRes.isBlocked && checkRes.referencingItems?.length > 0) {
            setInboundTargetTitle(targetTitle);
            setInboundTargetId(targetId);
            setInboundTargetIsTemplate(false);
            setInboundReferencingItems(checkRes.referencingItems);
            setInboundBlockedModalVisible(true);
            return;
          }
        } catch (err) {
          console.error('Failed to check inbound references before archive:', err);
        }
      }

      if (s === 'published' || s === 'active') {
        const result = await confirmAlert(
          isTemplate ? 'Archive Template' : 'Archive Document',
          `Do you want to archive "${targetTitle}"?`,
          'Start Archive'
        );
        if (result.isConfirmed) {
          navigate(isTemplate ? `/template/${targetId}?archive=true` : `/document/${targetId}?archive=true`);
        }
        return;
      }
      await updateStatus(targetId, isTemplate, 'Archive', 'archived');
    }
    else if (action === 'cancel_archive_request') {
      const result = await confirmAlert('Cancel Archive Request', 'Cancel the archive request and return this item to Published status?', 'Cancel Request');
      if (!result.isConfirmed) return;
      try {
        if (isTemplate) await updateTemplateStatus(targetId, 'published');
        else await updateStatusSimple(targetId, 'published');
        successAlert('Cancelled', 'Item returned to Published status.');
        fetchData();
      } catch {
        errorAlert('Failed', 'Could not cancel archive request.');
      }
    }
    else if (action === 'unsubmit' || action === 'revert') {
      const isArchivedFlow = item?.status === 'pending_archive_review' || item?.status === 'archive_reviewed' || item?.status === 'pending_archive_approval';
      const targetStatus = isArchivedFlow ? 'archive_draft' : 'draft';
      const label = action === 'unsubmit' ? 'Unsubmit' : (isArchivedFlow ? 'Revert to Archive Draft' : 'Revert to Draft');
      const itemName = item?.name || item?.title || (isTemplate ? 'this template' : 'this document');
      const confirmText = action === 'unsubmit'
        ? `Unsubmit "${itemName}" and return it to Draft status? Pending review and approval signatures will be reset.`
        : `Revert "${itemName}" back to ${isArchivedFlow ? 'Archive Draft' : 'Draft'} status? Pending review and approval signatures will be reset.`;

      const result = await confirmAlert(label, confirmText, label);
      if (!result.isConfirmed) return;

      try {
        if (isTemplate) {
          await updateTemplateStatus(targetId, targetStatus);
        } else {
          await updateStatusSimple(targetId, targetStatus);
        }
        successAlert(label, `${label} completed successfully. Item returned to ${isArchivedFlow ? 'Archive Draft' : 'Draft'}.`);
        fetchData();
      } catch (err) {
        errorAlert('Failed', err?.response?.data?.message || err?.response?.data?.error || `Could not ${label.toLowerCase()} item.`);
      }
    }
    else if (action === 'approve' || action === 'sign') {
      try {
        const isReview = item?.status?.toLowerCase() === 'pending_review' || item?.status?.toLowerCase() === 'pending_archive_review';
        const payload = {
          userId: user?.id,
          userEmail: user?.email,
          userName: `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`,
          userRole: user?.role,
          action: isReview ? 'review' : 'approve'
        };
        if (isTemplate) {
          if (isReview) await reviewTemplate(targetId, payload);
          else await approveTemplate(targetId, payload);
        } else {
          if (isReview) await reviewDocument(targetId, payload);
          else await approveDocument(targetId, payload);
        }
        successAlert('Signature processed successfully!');
        fetchData();
      } catch (err) {
        errorAlert(err?.response?.data?.error || 'Failed to sign off signature.');
      }
    } else if (action === 'reject' || action === 'decline') {
      try {
        const payload = {
          userId: user?.id,
          userEmail: user?.email,
          userName: `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`,
          userRole: user?.role,
          action: 'reject',
          comment: ''
        };
        if (isTemplate) await rejectTemplate(targetId, payload);
        else await rejectDocument(targetId, payload);
        successAlert(item?.status === 'pending_archive_approval' ? 'Archive request rejected; item returned to Published.' : 'Item rejected back to draft successfully.');
        fetchData();
      } catch (err) {
        errorAlert(err?.response?.data?.error || 'Failed to reject item.');
      }
    }
    else if (action === 'delete') {
      const result = await confirmAlert('Delete', 'Delete this draft?', 'Delete', 'danger');
      if (result.isConfirmed) {
        try {
          if (isTemplate) {
            await removeTemplate(targetId);
          } else {
            await removeDocument(targetId);
          }
          successAlert('Deleted', 'Draft removed.');
          fetchData();
        } catch {
          errorAlert('Failed', 'Could not delete item.');
        }
      }
    } else if (action === 'restore') {
      try {
        if (isTemplate) await updateTemplateStatus(targetId, 'draft');
        else await updateStatusSimple(targetId, 'draft');
        successAlert('Restored', 'Restored to draft.');
        fetchData();
      } catch {
        errorAlert('Failed', 'Could not restore item.');
      }
    }
  };

  const handleAddArchiveApprover = (userId) => {
    const selectedUser = users.find(u => String(u.id || u.userId) === String(userId));
    if (!selectedUser) return;
    const fullName = selectedUser.name || `${selectedUser.first_name || selectedUser.firstName || ''} ${selectedUser.last_name || selectedUser.lastName || ''}`.trim() || selectedUser.username;
    const newEntry = {
      userId: Number(selectedUser.id || selectedUser.userId),
      name: fullName,
      email: selectedUser.email,
      department: selectedUser.department || '',
      status: 'pending'
    };
    setArchiveApprovers(prev => ({
      ...prev,
      approvers: [...(prev.approvers || []).filter(a => String(a.userId || a.id) !== String(userId)), newEntry]
    }));
  };

  const handleRemoveArchiveApprover = (userId) => {
    setArchiveApprovers(prev => ({
      ...prev,
      approvers: (prev.approvers || []).filter(a => String(a.userId || a.id) !== String(userId))
    }));
  };

  const handleSubmitArchiveApproval = async () => {
    if (!archiveTargetItem) return;
    if (!archiveApprovers.approvers || archiveApprovers.approvers.length === 0) {
      errorAlert('Approvers Required', 'Please assign at least one approver for archive approval.');
      return;
    }
    if (!archiveDueDate) {
      errorAlert('Due Date Required', 'Please select a workflow due date.');
      return;
    }

    try {
      const isTemplate = archiveTargetItem.itemType === 'template';
      const itemId = archiveTargetItem.id;

      const finalApprovers = {
        reviewers: (archiveApprovers.reviewers || []).map(r => ({ ...r, status: 'pending', dueDate: archiveDueDate })),
        approvers: (archiveApprovers.approvers || []).map(a => ({ ...a, status: 'pending', dueDate: archiveDueDate }))
      };

      const payload = isTemplate ? { template_approvers: finalApprovers } : { approvers: finalApprovers };

      if (isTemplate) {
        await updateTemplateStatus(itemId, 'pending_archive_approval', payload);
      } else {
        await updateStatusSimple(itemId, 'pending_archive_approval', payload);
      }

      successAlert('Submitted for Archive Approval', 'The request has been sent for approval and moved to the Archived tab.');
      setArchiveModalVisible(false);
      setArchiveTargetItem(null);
      fetchData();
    } catch (e) {
      console.error('Failed to submit for archive approval:', e);
      errorAlert('Error', 'Failed to submit item for archive approval.');
    }
  };

  const handleApplyFilters = () => {
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        appliedSearch: prev[activeTab].searchVal,
        appliedDept: prev[activeTab].selectedDept,
        appliedStartDate: prev[activeTab].startDate,
        appliedEndDate: prev[activeTab].endDate,
        appliedOwner: prev[activeTab].selectedOwner,
        appliedApproverGroup: prev[activeTab].selectedApproverGroup,
      }
    }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setTabFilters(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(tab => {
        updated[tab] = {
          searchVal: '',
          selectedDept: '',
          startDate: '',
          endDate: '',
          selectedOwner: '',
          selectedApproverGroup: '',
          sortBy: '',
          appliedSearch: '',
          appliedDept: '',
          appliedStartDate: '',
          appliedEndDate: '',
          appliedOwner: '',
          appliedApproverGroup: '',
        };
      });
      return updated;
    });
    setCurrentPage(1);
  };

  const handleReassignSuccess = (item, targetUser, newUser) => {
    if (!item) return;
    const rawId = String(item.id || item.document_id);
    
    // Check if targetUser was the currently logged-in user
    const currentUserId = user?.id ?? user?.userId;
    const currentUserEmail = (user?.email || '').trim().toLowerCase();
    const isSelfTarget = (currentUserId !== undefined && String(targetUser?.userId ?? targetUser?.id) === String(currentUserId)) ||
      (currentUserEmail && targetUser?.email && targetUser.email.trim().toLowerCase() === currentUserEmail);

    if (isSelfTarget) {
      setReassignedIds(prev => new Set([...prev, rawId]));
    }

    // Immediately update templates or documents in state so the reassignment reflects in memory without delay
    const isDoc = item.itemType === 'document' || Boolean(item.document_id);
    if (isDoc) {
      setDocuments(prevDocs => prevDocs.map(doc => {
        if (String(doc.document_id || doc.id) !== rawId) return doc;
        try {
          const raw = doc.approvers || doc.template_approvers;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || { reviewers: [], approvers: [] });
          const reviewers = (parsed.reviewers || []).map(r => {
            const match = String(r.userId || r.id) === String(targetUser?.userId || targetUser?.id) ||
              (targetUser?.email && r.email && r.email.toLowerCase() === targetUser.email.toLowerCase());
            return match ? { ...r, ...newUser, status: 'pending' } : r;
          });
          const approvers = (parsed.approvers || []).map(a => {
            const match = String(a.userId || a.id) === String(targetUser?.userId || targetUser?.id) ||
              (targetUser?.email && a.email && a.email.toLowerCase() === targetUser.email.toLowerCase());
            return match ? { ...a, ...newUser, status: 'pending' } : a;
          });
          return { ...doc, approvers: { ...parsed, reviewers, approvers } };
        } catch (_) {
          return doc;
        }
      }));
    } else {
      setTemplates(prevTemps => prevTemps.map(tpl => {
        if (String(tpl.id) !== rawId) return tpl;
        try {
          const raw = tpl.template_approvers || tpl.approvers;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || { reviewers: [], approvers: [] });
          const reviewers = (parsed.reviewers || []).map(r => {
            const match = String(r.userId || r.id) === String(targetUser?.userId || targetUser?.id) ||
              (targetUser?.email && r.email && r.email.toLowerCase() === targetUser.email.toLowerCase());
            return match ? { ...r, ...newUser, status: 'pending' } : r;
          });
          const approvers = (parsed.approvers || []).map(a => {
            const match = String(a.userId || a.id) === String(targetUser?.userId || targetUser?.id) ||
              (targetUser?.email && a.email && a.email.toLowerCase() === targetUser.email.toLowerCase());
            return match ? { ...a, ...newUser, status: 'pending' } : a;
          });
          return { ...tpl, template_approvers: { ...parsed, reviewers, approvers } };
        } catch (_) {
          return tpl;
        }
      }));
    }

    fetchData();
  };

  const filterList = (items, type) => {
    const list = items
      .map(item => computeItemDetailsAndFilter(item, type, {
        progressOverrides,
        pinnedIds,
        activeTab,
        appliedSearch,
        appliedDept,
        appliedStartDate,
        appliedEndDate,
        appliedOwner,
        appliedApproverGroup,
        currentUser: user,
        viewAllReadOnly,
        users,
        reassignedIds
      }))
      .filter(item => item !== null);

    // Defense-in-depth: Deduplicate multiple drafts/revisions or published ladder versions in the same family
    const seenMap = new Map();
    for (const item of list) {
      const rawId = String(item.id || item.document_id);
      
      let familyKey = rawId;
      if (activeTab === 'Published') {
        // Ladder System for Published: Keep ONLY the single latest published version per family/name
        // When Version 2 was published and revised to create Version 3 (Draft), only Version 2 appears in Published.
        // Predecessor versions (Version 1, etc.) must NEVER appear in Published alongside Version 2.
        familyKey = `${type}-family-${(item.name || item.title || '').trim().toLowerCase()}`;
      } else if (activeTab === 'In Progress' || activeTab === 'Draft') {
        if (item.revision_parent_id) {
          familyKey = `${type}-parent-${item.revision_parent_id}`;
        } else if ((item.status || '').toLowerCase() === 'draft' || (item.status || '').toLowerCase() === 'archive_draft') {
          familyKey = `${type}-draft-${rawId}`;
        }
      }

      if (!seenMap.has(familyKey)) {
        seenMap.set(familyKey, item);
      } else {
        const prev = seenMap.get(familyKey);
        if (activeTab === 'Published') {
          // Keep the highest version number
          const prevVer = parseFloat(prev.version) || 1.0;
          const currVer = parseFloat(item.version) || 1.0;
          if (currVer > prevVer) {
            seenMap.set(familyKey, item);
          } else if (currVer === prevVer) {
            const prevDate = new Date(prev.updated_at || prev.created_at || 0);
            const currDate = new Date(item.updated_at || item.created_at || 0);
            if (currDate > prevDate) {
              seenMap.set(familyKey, item);
            }
          }
        } else {
          const prevDate = new Date(prev.updated_at || prev.created_at || 0);
          const currDate = new Date(item.updated_at || item.created_at || 0);
          if (currDate > prevDate) {
            seenMap.set(familyKey, item);
          }
        }
      }
    }

    return Array.from(seenMap.values());
  };

  const filteredTemplates = (dashboardType === 'all' || dashboardType === 'templates') ? filterList(templates, 'template') : [];
  const filteredDocs = (dashboardType === 'all' || dashboardType === 'documents') ? filterList(documents, 'document') : [];
  const allItems = [...filteredTemplates, ...filteredDocs];

  const sortedItems = [...allItems].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = (a.name || a.title || '').toLowerCase();
      const nameB = (b.name || b.title || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'version') {
      const verA = parseFloat(a.version) || 1.0;
      const verB = parseFloat(b.version) || 1.0;
      return verB - verA;
    }
    if (sortBy === 'completion') {
      const compA = a.progress_value || 0;
      const compB = b.progress_value || 0;
      return compB - compA;
    }

    // Default and 'date' / 'latest': Always sort from latest/newest to oldest
    const getTime = (it) => {
      const val = it.updated_at || it.created_at || it.createdAt || it.updatedAt;
      if (!val) return 0;
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };
    const diff = getTime(b) - getTime(a);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  const pinnedItems = sortedItems.filter(item => item.is_pinned === 1);
  const tabItems = sortedItems.filter(item => item.is_pinned !== 1);
  const paginatedItems = tabItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(tabItems.length / pageSize) || 1;
  const itemsPerPage = pageSize;

  const isUserInvolved = (item, type) => {
    if (!user) return false;
    const rawItemId = String(item.id || item.document_id || '');
    if (reassignedIds.has(rawItemId)) return false;
    if (user.role === 'admin' || user.role === 'project_manager') return true;
    const currentUserId = user.id ?? user.userId;
    const userEmail = (user.email || '').trim().toLowerCase();
    if (currentUserId !== undefined && Number(item.created_by) === Number(currentUserId)) return true;
    if (userEmail && item.created_by_email && String(item.created_by_email).trim().toLowerCase() === userEmail) return true;
    const raw = item.approvers || item.template_approvers;
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
        const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : [];
        const people = [...reviewers, ...approvers];
        return people.some((p) => {
          const pId = p.userId ?? p.id;
          const byId = pId !== undefined && currentUserId !== undefined && String(pId) === String(currentUserId);
          const byEmail = userEmail && String(p.email || '').trim().toLowerCase() === userEmail;
          return byId || byEmail;
        });
      } catch (e) {
        // ignore
      }
    }
    return false;
  };

  const getFilteredCountForScope = (list, type) => {
    return list
      .map(item => computeItemDetailsAndFilter(item, type, {
        progressOverrides,
        pinnedIds,
        activeTab,
        appliedSearch,
        appliedDept,
        appliedStartDate,
        appliedEndDate,
        appliedOwner,
        appliedApproverGroup,
        currentUser: user,
        viewAllReadOnly: false,
        ignoreTabStatus: true,
        reassignedIds
      }))
      .filter(item => item !== null && isUserInvolved(item, type)).length;
  };

  const templatesCount = getFilteredCountForScope(templates, 'template');
  const docsCount = getFilteredCountForScope(documents, 'document');
  const scopeCounts = {
    all: templatesCount + docsCount,
    documents: docsCount,
    templates: templatesCount
  };

  const distinctDepts = departments.map((d) => d.name) || [];
  const distinctOwners = Array.from(new Set(allItems.map(i => i.created_by_name).filter(Boolean)));
  const distinctApproverGroups = ['Review', 'Approver'];

  const getTabCount = (tabName) => {
    const isDocScope = dashboardType === 'all' || dashboardType === 'documents';
    const isTempScope = dashboardType === 'all' || dashboardType === 'templates';

    const getCleanCount = (items, type) => {
      const filtered = items.filter(item => {
        const s = (item.status || '').toLowerCase();
        let match = false;
        if (tabName === 'Draft') match = s === 'draft' || s === 'archive_draft';
        else if (tabName === 'In Progress') match = ['draft', 'archive_draft', 'pending', 'pending_review', 'pending_approval', 'reviewed', 'approved', 'pending_archive_review', 'archive_reviewed', 'pending_archive_approval'].includes(s);
        else if (tabName === 'Published') match = s === 'published' || s === 'active' || s === 'pending_revision';
        else if (tabName === 'Archived') match = s === 'archived' || s === 'old' || s === 'pending_archive_approval' || s === 'pending_archive_review' || s === 'archive_reviewed' || s === 'revised';
        
        if (!match || !isUserInvolved(item, type)) return false;

        // If search is active, reflect search match count for each tab
        if (appliedSearch && appliedSearch.trim()) {
          const res = computeItemDetailsAndFilter(item, type, {
            progressOverrides,
            pinnedIds,
            activeTab: tabName,
            appliedSearch,
            appliedDept: '',
            appliedStartDate: '',
            appliedEndDate: '',
            appliedOwner: '',
            appliedApproverGroup: '',
            currentUser: user,
            viewAllReadOnly,
            users,
            ignoreTabStatus: true,
            reassignedIds
          });
          if (!res) return false;
        }

        return true;
      });

      if (tabName === 'Published') {
        const seen = new Set();
        let count = 0;
        for (const it of filtered) {
          const key = (it.name || it.title || '').trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            count++;
          }
        }
        return count;
      }

      if (tabName === 'Draft' || tabName === 'In Progress') {
        const seen = new Set();
        let count = 0;
        for (const it of filtered) {
          const key = it.revision_parent_id 
            ? `parent-${it.revision_parent_id}` 
            : `name-${(it.name || it.title || '').trim().toLowerCase()}-v${it.version || '1'}`;
          if (!seen.has(key)) {
            seen.add(key);
            count++;
          }
        }
        return count;
      }
      return filtered.length;
    };

    const tCount = isTempScope ? getCleanCount(templates, 'template') : 0;
    const dCount = isDocScope ? getCleanCount(documents, 'document') : 0;

    return tCount + dCount;
  };

  return {
    dashboardType, setDashboardType, activeTab, setActiveTab, viewMode, setViewMode, loading,
    pinnedItems, tabItems, paginatedItems, scopeCounts, distinctDepts, distinctOwners,
    distinctApproverGroups, getTabCount, currentPage, setCurrentPage, pageSize,
    searchVal, setSearchVal, selectedDept, setSelectedDept, startDate, setStartDate,
    endDate, setEndDate, selectedOwner, setSelectedOwner, selectedApproverGroup,
    setSelectedApproverGroup, handleApplyFilters, handleClearFilters, handleTogglePin,
    handleProgressChange, handleAction, setAppliedSearch, sortBy, setSortBy,
    viewAllReadOnly, setViewAllReadOnly, totalPages, itemsPerPage,
    documents, templates, documentsCount: docsCount, templatesCount,
    users, departments, fetchData, handleReassignSuccess, reassignedIds,
    archiveModalVisible, setArchiveModalVisible, archiveTargetItem, setArchiveTargetItem,
    archiveApprovers, setArchiveApprovers, archiveDueDate, setArchiveDueDate,
    handleAddArchiveApprover, handleRemoveArchiveApprover, handleSubmitArchiveApproval,
    inboundBlockedModalVisible, setInboundBlockedModalVisible,
    inboundReferencingItems, setInboundReferencingItems,
    inboundTargetTitle, setInboundTargetTitle,
    inboundTargetId, setInboundTargetId,
    isCheckingInbound,
    handleRecheckInbound: async () => {
      if (!inboundTargetId) return;
      setIsCheckingInbound(true);
      try {
        const checkRes = await checkInboundReferences(inboundTargetId);
        if (checkRes && checkRes.isBlocked && checkRes.referencingItems?.length > 0) {
          setInboundReferencingItems(checkRes.referencingItems);
          toastAlert('info', `Still referenced by ${checkRes.referencingItems.length} active item(s).`);
        } else {
          setInboundBlockedModalVisible(false);
          setInboundReferencingItems([]);
          successAlert('Cleared!', 'All references to this document have been removed. You can now archive it.');
        }
      } catch (err) {
        console.error('Failed to recheck inbound references:', err);
      } finally {
        setIsCheckingInbound(false);
      }
    }
  };
}
