import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Avatar, Tooltip, Badge, Tag, Space, notification, Modal, Select } from 'antd';
import { 
  ArrowLeftOutlined, FileTextOutlined, FileSearchOutlined, CheckOutlined, CloseCircleOutlined, DownOutlined, CheckCircleOutlined, EyeOutlined, EditOutlined
} from '@ant-design/icons';
import { Dropdown } from 'antd';
import TemplateApproversBar from './TemplateApproversBar';

const { Option } = Select;

const TemplatePreviewHeader = ({ 
  parsedTemplate, 
  currentUser, 
  onCancel, 
  onRevise,
  onArchive,
  manualSaveContent, 
  isSaving,
  handleReview,
  handleApprove,
  handleReject,
  setShowRejectionModal,
  isReviewing,
  isApproving,
  isRejecting,
  handleSubmit,
  handleRevertReviewersStatus,
  cleanView,
  setCleanView,
  users = [],
  handleReassign,
  departments = [],
  isDocument = false,
  readOnly = false,
  isReferenceView = false
}) => {
  const safeTemplate = parsedTemplate || {};
  const isAuthor = currentUser && parsedTemplate ? String(currentUser.id) === String(parsedTemplate.created_by) || String(currentUser.id) === String(parsedTemplate.user_id) : false;
  const isAdmin = currentUser?.role === 'admin';
  const isReadMode = readOnly || isReferenceView;
  const canUpdate = !isReadMode && (isAuthor || isAdmin);
  const canPublish = !isReadMode && isAdmin && safeTemplate.status === 'approved';

  const cleanViewMenuItems = [
    {
      key: 'accepted',
      icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
      label: (
        <span style={{ fontWeight: cleanView === 'accepted' ? '600' : '400' }}>
          Show with Accepted Suggestions
        </span>
      ),
      onClick: () => setCleanView && setCleanView('accepted'),
    },
    {
      key: 'rejected',
      icon: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
      label: (
        <span style={{ fontWeight: cleanView === 'rejected' ? '600' : '400' }}>
          Show without Accepted Suggestions
        </span>
      ),
      onClick: () => setCleanView && setCleanView('rejected'),
    },
  ];

  if (cleanView) {
    cleanViewMenuItems.push({
      type: 'divider',
    });
    cleanViewMenuItems.push({
      key: 'markup',
      icon: <EyeOutlined style={{ color: '#4f46e5' }} />,
      label: 'Show Markup (Exit Clean View)',
      onClick: () => setCleanView && setCleanView(false),
    });
  }



  const authorMenuItems = [
    ...(canPublish ? [{
      key: 'published',
      label: isDocument || parsedTemplate?.document_id ? 'Publish Document' : 'Publish Template',
      icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
      onClick: () => handleSubmit('published')
    }] : []),
    ...(safeTemplate.status === 'published' ? [{
      key: 'revise',
      label: isDocument || parsedTemplate?.document_id ? 'Revise Document' : 'Revise Template',
      icon: <EditOutlined />,
      onClick: () => onRevise ? onRevise() : handleSubmit('pending_revision')
    }] : []),
    ...(safeTemplate.status === 'published' && onArchive ? [{
      key: 'archive',
      label: isDocument || parsedTemplate?.document_id ? 'Archive Document' : 'Archive Template',
      icon: <span className="anticon"><span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: '-2px' }}>archive</span></span>,
      onClick: () => onArchive()
    }] : []),
    {
      key: 'draft',
      label: 'Save as Draft',
      icon: <FileTextOutlined />,
      onClick: () => handleSubmit('draft')
    },
    {
      key: 'pending_review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: () => handleSubmit('pending_review')
    },
    {
      key: 'pending_approval',
      label: 'Submit for Approval',
      icon: <CheckOutlined />,
      onClick: () => handleSubmit('pending_approval')
    }
  ];

  const getTemplateIcon = (template) => {
    const templateName = template?.name || template?.title || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FileSearchOutlined />;
    } else {
      return <FileTextOutlined />;
    }
  };

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];
    
    const status = parsedTemplate.status;
    
    if (status === 'pending_review' || status === 'reviewed') {
      return parsedTemplate.template_approvers.reviewers || [];
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return parsedTemplate.template_approvers.approvers || [];
    }
    
    return [];
  };

  const getCurrentUserRole = () => {
    if (!parsedTemplate?.template_approvers || !currentUser) return null;
    
    const status = parsedTemplate.status;
    let ta = parsedTemplate.template_approvers;
    if (typeof ta === 'string') {
      try { ta = JSON.parse(ta); } catch (_) { ta = {}; }
    }
    
    const matchesUser = (item) => {
      if (!item) return false;
      const emailMatch = item.email && currentUser.email && String(item.email).trim().toLowerCase() === String(currentUser.email).trim().toLowerCase();
      const idMatch = (item.userId && currentUser.id && Number(item.userId) === Number(currentUser.id)) ||
                     (item.id && currentUser.id && Number(item.id) === Number(currentUser.id));
      return Boolean(emailMatch || idMatch);
    };

    if (status === 'pending_review' || status === 'reviewed' || status === 'pending_archive_review' || status === 'archive_reviewed') {
      const reviewer = (ta.reviewers || []).find(matchesUser);
      return reviewer ? { role: 'reviewer', user: reviewer } : null;
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected' || status === 'pending_archive_approval') {
      const approver = (ta.approvers || []).find(matchesUser);
      return approver ? { role: 'approver', user: approver } : null;
    }
    
    return null;
  };

  const isApproverStageActive = () => {
    if (!parsedTemplate || parsedTemplate.status !== 'pending_approval') return true;
    
    const roleObj = getCurrentUserRole();
    if (!roleObj || roleObj.role !== 'approver') return true;
    
    const currentUserApprover = roleObj.user;
    const userDept = currentUserApprover.department;
    if (!userDept) return true;
    
    const reqApprovers = Array.isArray(parsedTemplate.required_approvers)
      ? parsedTemplate.required_approvers
      : (Array.isArray(parsedTemplate.approvers) ? parsedTemplate.approvers : []);
      
    const deptConfig = reqApprovers.find(r => r.department?.trim().toLowerCase() === userDept.trim().toLowerCase());
    if (!deptConfig) return true;
    
    const userStage = deptConfig.stage || 1;
    const workflowApprovers = parsedTemplate.template_approvers?.approvers || [];
    
    const isDeptCompleted = (deptName) => {
      if (!deptName) return true;
      const deptApprovers = workflowApprovers.filter(a => a.department?.trim().toLowerCase() === deptName.trim().toLowerCase());
      if (deptApprovers.length === 0) return true;
      return deptApprovers.some(a => String(a.status || '').trim().toLowerCase() === 'approved');
    };
    
    const isBlocked = reqApprovers.some(r => {
      const stage = r.stage || 1;
      if (stage < userStage) {
        return !isDeptCompleted(r.department);
      }
      return false;
    });
    
    return !isBlocked;
  };

  const handleApproveClick = () => {
    if (!isApproverStageActive()) {
      notification.warning({
        message: 'Approval Blocked',
        description: 'Currently, a different stage department is working on the approval. When they complete, you will be allowed to proceed.'
      });
      return;
    }
    handleApprove();
  };

  const handleRejectClick = () => {
    if (!isApproverStageActive()) {
      notification.warning({
        message: 'Approval Blocked',
        description: 'Currently, a different stage department is working on the approval. When they complete, you will be allowed to proceed.'
      });
      return;
    }
    if (setShowRejectionModal) {
      setShowRejectionModal(true);
    } else if (handleReject) {
      handleReject();
    }
  };

  const navigate = useNavigate();

  const handleCancelClick = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    
    if (typeof onCancel === 'function') {
      try {
        onCancel();
        return;
      } catch (err) {
        console.error('Error invoking onCancel callback:', err);
      }
    }

    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    } catch (_) {
      window.location.href = '/dashboard';
    }
  };

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const showAssignDocumentButton = (() => {
    if (!parsedTemplate?.document_id) return false;
    const status = parsedTemplate.status;
    if (status !== 'pending_review' && status !== 'pending_approval') return false;
    
    const isOwner = currentUser && parsedTemplate.created_by && (
      String(currentUser.id ?? currentUser.userId) === String(parsedTemplate.created_by)
    );
    const isAdmin = currentUser?.role === 'admin';
    return isOwner || isAdmin;
  })();

  const getEligibleAssignees = () => {
    if (!currentUser || !parsedTemplate || !parsedTemplate.template_approvers) return [];
    
    const roleObj = getCurrentUserRole();
    const userDept = roleObj?.user?.department;
    if (!userDept) return [];

    const deptUsers = users.filter(u => 
      String(u.id) !== String(currentUser.id) &&
      String(u.userId) !== String(currentUser.id) &&
      u.status === 'active' &&
      u.department && u.department.trim().toLowerCase() === userDept.trim().toLowerCase()
    );
    
    const workflow = parsedTemplate.template_approvers;
    const reviewers = Array.isArray(workflow.reviewers) ? workflow.reviewers : [];
    const approversList = Array.isArray(workflow.approvers) ? workflow.approvers : [];
    const currentWfUserIds = new Set([
      ...reviewers.map(u => String(u.userId)),
      ...approversList.map(u => String(u.userId))
    ]);
    
    return deptUsers.filter(u => !currentWfUserIds.has(String(u.id)));
  };

  const handleAssignSubmit = async () => {
    if (!selectedAssignee) {
      notification.warning({
        message: 'No user selected',
        description: 'Please select a member to assign the document to.'
      });
      return;
    }
    
    const eligible = getEligibleAssignees();
    const assigneeUser = eligible.find(u => String(u.id) === String(selectedAssignee));
    if (!assigneeUser) return;
    
    setAssignLoading(true);
    try {
      const ok = await handleReassign({
        id: assigneeUser.id,
        name: assigneeUser.name || `${assigneeUser.first_name || ''} ${assigneeUser.last_name || ''}`.trim(),
        email: assigneeUser.email,
        department: assigneeUser.department
      });
      if (ok) {
        setAssignModalVisible(false);
        setSelectedAssignee(null);
        if (onCancel) onCancel();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="template-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
      {/* Clean View Dropdown */}
      <Dropdown menu={{ items: cleanViewMenuItems }} placement="bottomLeft" trigger={['click']}>
        <Button 
          type={cleanView ? "primary" : "default"} 
          size="small"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: cleanView ? '600' : '400'
          }}
        >
          <EyeOutlined />
          {cleanView === 'accepted'
            ? "Clean View (Accepted)"
            : cleanView === 'rejected'
            ? "Clean View (Original)"
            : cleanView
            ? "Clean View"
            : "Clean View"}
          <DownOutlined style={{ fontSize: '10px', marginLeft: '2px' }} />
        </Button>
      </Dropdown>

      {/* Review / Approval Action Buttons (Visible across all tabs) */}
      <TemplateApproversBar
        parsedTemplate={parsedTemplate}
        currentUser={currentUser}
        handleReview={handleReview}
        handleApprove={handleApprove}
        handleReject={handleReject}
        setShowRejectionModal={setShowRejectionModal}
        isReviewing={isReviewing}
        isApproving={isApproving}
        isRejecting={isRejecting}
        actionsOnly={true}
      />

      {/* Assign Document Button */}
      {showAssignDocumentButton && (
        <Button
          type="default"
          size="small"
          onClick={() => setAssignModalVisible(true)}
        >
          Assign Document
        </Button>
      )}

      {/* Publish Button when Approved (Admin Only) */}
      {canPublish && (
        <Button 
          type="primary" 
          size="small"
          icon={<CheckCircleOutlined />}
          style={{ background: '#10b981', borderColor: '#10b981' }}
          onClick={() => handleSubmit('published')}
        >
          {isDocument || parsedTemplate?.document_id ? 'Publish Document' : 'Publish Template'}
        </Button>
      )}

      {/* Revise Button when Published */}
      {canUpdate && safeTemplate.status === 'published' && (
        <Button 
          type="primary" 
          size="small"
          icon={<EditOutlined />}
          onClick={() => onRevise ? onRevise() : handleSubmit('pending_revision')}
        >
          {isDocument || parsedTemplate?.document_id ? 'Revise Document' : 'Revise Template'}
        </Button>
      )}

      {/* Archive Button when Published */}
      {canUpdate && safeTemplate.status === 'published' && onArchive && (
        <Button 
          type="default" 
          size="small"
          danger
          onClick={() => onArchive()}
        >
          {isDocument || parsedTemplate?.document_id ? 'Archive Document' : 'Archive Template'}
        </Button>
      )}

      {/* Circulate Template / Circulate Document Dropdown */}
      {canUpdate && (
        <Dropdown menu={{ items: authorMenuItems }} placement="bottomRight">
          <Button type="primary" size="small">
            {isDocument || parsedTemplate?.document_id ? 'Circulate Document' : 'Circulate Template'} <DownOutlined style={{ fontSize: '10px' }} />
          </Button>
        </Dropdown>
      )}

      {/* Update Status Button */}
      {canUpdate && (safeTemplate.status === 'pending_review' || safeTemplate.status === 'reviewed') && (
        <Button 
          type="default" 
          size="small"
          onClick={handleRevertReviewersStatus}
        >
          Update Status
        </Button>
      )}

      {/* Reference View Badge */}
      {isReadMode && (
        <Tag color="cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontWeight: 500, margin: 0 }}>
          <EyeOutlined /> Reference View (Read-Only)
        </Tag>
      )}

      {/* Manual Save Button (Auto-save 1.5s badge REMOVED) */}
      {!isReadMode && (safeTemplate.status === 'draft' || safeTemplate.status === 'pending_review' || safeTemplate.status === 'reviewed' || !safeTemplate.status) && (
        <Tooltip title="Manual save (Ctrl+S)">
          <Button 
            icon={<CheckOutlined />}
            onClick={() => manualSaveContent && manualSaveContent()}
            size="small"
            type="default"
            loading={isSaving}
          >
            Save
          </Button>
        </Tooltip>
      )}

      {/* Back Arrow Button */}
      <Tooltip title="Back" placement="left" getPopupContainer={(trigger) => trigger.parentElement || document.body}>
        <Button 
          type="default"
          htmlType="button"
          icon={<ArrowLeftOutlined />} 
          size="small"
          onClick={handleCancelClick}
          style={{ marginLeft: 4, cursor: 'pointer', zIndex: 1 }}
        />
      </Tooltip>

      {/* Modal for Assign Document Authority */}
      <Modal
        title="Assign Document Authority"
        visible={assignModalVisible}
        onOk={handleAssignSubmit}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedAssignee(null);
        }}
        confirmLoading={assignLoading}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Paragraph>
            Choose a colleague from your department to assign your review/approval authority for this document. You will be removed and they will take your place.
          </Typography.Paragraph>
        </div>
        <div style={{ fontWeight: '500', marginBottom: 8 }}>Select Colleague:</div>
        <Select
          placeholder="Select a colleague in your department"
          style={{ width: '100%' }}
          value={selectedAssignee}
          onChange={(val) => setSelectedAssignee(val)}
        >
          {getEligibleAssignees().map(u => (
            <Option key={u.id} value={u.id}>
              {u.name || `${u.first_name} ${u.last_name}`} ({u.email})
            </Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default TemplatePreviewHeader;
