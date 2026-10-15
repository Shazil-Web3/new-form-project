import React from 'react';
import { Typography, Badge, Tag, Space, Button, notification } from 'antd';
import { CheckOutlined, CloseCircleOutlined } from '@ant-design/icons';

const TemplateApproversBar = ({
  parsedTemplate,
  currentUser,
  handleReview,
  handleApprove,
  handleReject,
  setShowRejectionModal,
  isReviewing,
  isApproving,
  isRejecting,
  actionsOnly = false,
  namesOnly = false
}) => {
  const safeTemplate = parsedTemplate || {};

  const getCurrentUsersToShow = () => {
    if (!parsedTemplate?.template_approvers) return [];
    
    const status = String(parsedTemplate.status || '').toLowerCase();
    
    if (status === 'pending_review' || status === 'reviewed') {
      return parsedTemplate.template_approvers.reviewers || [];
    } else if (status === 'pending_approval' || status === 'approved' || status === 'rejected') {
      return parsedTemplate.template_approvers.approvers || [];
    } else if (status === 'draft' || status === 'pending_revision') {
      const reviewers = parsedTemplate.template_approvers.reviewers || [];
      const approvers = parsedTemplate.template_approvers.approvers || [];
      return [...reviewers, ...approvers];
    }
    
    return [];
  };

  const getCurrentUserRole = () => {
    if (!parsedTemplate?.template_approvers || !currentUser) return null;
    
    const status = String(parsedTemplate.status || '').toLowerCase();
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

  if (actionsOnly) {
    if (!currentUser?.email) return null;
    const roleObj = getCurrentUserRole();
    if (!roleObj) return null;
    
    const { role, user } = roleObj;
    const userStatus = user.status?.toLowerCase();
    
    if (userStatus !== 'pending') return null;
    
    const isArchive = parsedTemplate.status === 'pending_archive_approval' || parsedTemplate.status === 'pending_archive_review';

    if (role === 'reviewer') {
      return (
        <Button
          type="primary"
          icon={<CheckOutlined />}
          loading={isReviewing}
          onClick={handleReview}
          size="small"
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', fontSize: '11px', height: '24px', padding: '0 8px' }}
        >
          {parsedTemplate.status === 'pending_archive_review' ? 'Review Archive' : 'Mark as Reviewed'}
        </Button>
      );
    } else if (role === 'approver') {
      const isActive = isApproverStageActive();
      const approveStyle = isActive 
        ? { backgroundColor: '#52c41a', borderColor: '#52c41a', fontSize: '11px', height: '24px', padding: '0 8px' }
        : { backgroundColor: '#f5f5f5', borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.25)', cursor: 'not-allowed', fontSize: '11px', height: '24px', padding: '0 8px' };
      const rejectStyle = !isActive 
        ? { backgroundColor: '#f5f5f5', borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.25)', cursor: 'not-allowed', fontSize: '11px', height: '24px', padding: '0 8px' }
        : { fontSize: '11px', height: '24px', padding: '0 8px' };
        
      return (
        <Space size={4}>
          <Button
            type={isActive ? "primary" : "default"}
            icon={<CheckOutlined />}
            loading={isApproving}
            onClick={handleApproveClick}
            size="small"
            style={approveStyle}
          >
            {parsedTemplate.status === 'pending_archive_approval' ? 'Approve Archive' : 'Approve'}
          </Button>
          <Button
            danger={isActive}
            icon={<CloseCircleOutlined />}
            loading={isRejecting}
            onClick={handleRejectClick}
            size="small"
            style={rejectStyle}
          >
            {parsedTemplate.status === 'pending_archive_approval' ? 'Decline Archive' : 'Reject'}
          </Button>
        </Space>
      );
    }
    
    return null;
  }

  const usersToShow = getCurrentUsersToShow();
  if (usersToShow.length === 0) return null;

  return (
    <div className="template-approvers-bar" style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
      <Typography.Text strong style={{ fontSize: '12px', marginRight: 4 }}>
        {String(safeTemplate.status || '').toLowerCase() === 'pending_review' || String(safeTemplate.status || '').toLowerCase() === 'reviewed' ? 'Reviewers:' : 'Approvers:'}
      </Typography.Text>
      {usersToShow.map((user, index) => {
        const isCurrentUser = currentUser?.email && user.email && 
          String(user.email).trim().toLowerCase() === String(currentUser.email).trim().toLowerCase();
        const getStatusColor = (status) => {
          switch (status?.toLowerCase()) {
            case 'reviewed':
            case 'approved':
              return 'success';
            case 'rejected':
              return 'error';
            case 'pending':
            default:
              return 'processing';
          }
        };
        
        const isDraftState = parsedTemplate?.status === 'draft' || parsedTemplate?.status === 'pending_revision';
        const effectiveStatus = isDraftState ? 'pending' : (user.status?.toLowerCase() || 'pending');

        return (
          <div key={`user-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge 
              status={getStatusColor(effectiveStatus)}
              text={
                <span style={{ 
                  fontSize: '12px',
                  fontWeight: isCurrentUser ? 'bold' : 'normal',
                  color: isCurrentUser ? '#1890ff' : undefined
                }}>
                  {user.name}
                  {!isDraftState && user.status?.toLowerCase() === 'rejected' && user.comment && ' *'}
                </span>
              }
            />
            
            {(!namesOnly && isCurrentUser) ? (() => {
              const userStatus = effectiveStatus;
              const currentUserRole = getCurrentUserRole();
              
              if (!currentUserRole) return null;
              
              const { role } = currentUserRole;
              
              if (!isDraftState && userStatus === 'pending') {
                if (role === 'reviewer') {
                  return (
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={isReviewing}
                      onClick={handleReview}
                      size="small"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', fontSize: '11px', height: '24px', padding: '0 8px' }}
                    >
                      Mark as Reviewed
                    </Button>
                  );
                } else if (role === 'approver') {
                  const isActive = isApproverStageActive();
                  const approveStyle = isActive 
                    ? { backgroundColor: '#52c41a', borderColor: '#52c41a', fontSize: '11px', height: '24px', padding: '0 8px' }
                    : { backgroundColor: '#f5f5f5', borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.25)', cursor: 'not-allowed', fontSize: '11px', height: '24px', padding: '0 8px' };
                  const rejectStyle = !isActive 
                    ? { backgroundColor: '#f5f5f5', borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.25)', cursor: 'not-allowed', fontSize: '11px', height: '24px', padding: '0 8px' }
                    : { fontSize: '11px', height: '24px', padding: '0 8px' };
                    
                  return (
                    <Space size={4}>
                      <Button
                        type={isActive ? "primary" : "default"}
                        icon={<CheckOutlined />}
                        loading={isApproving}
                        onClick={handleApproveClick}
                        size="small"
                        style={approveStyle}
                      >
                        Approve
                      </Button>
                      <Button
                        danger={isActive}
                        icon={<CloseCircleOutlined />}
                        loading={isRejecting}
                        onClick={handleRejectClick}
                        size="small"
                        style={rejectStyle}
                      >
                        Reject
                      </Button>
                    </Space>
                  );
                }
              }
              
              return (
                <Tag 
                  color={userStatus === 'approved' ? 'success' : 
                         userStatus === 'reviewed' ? 'success' : 
                         userStatus === 'rejected' ? 'error' : 'default'}
                  icon={userStatus === 'approved' || userStatus === 'reviewed' ? <CheckOutlined /> : 
                        userStatus === 'rejected' ? <CloseCircleOutlined /> : null}
                  style={{ fontSize: '11px', margin: 0 }}
                >
                  {userStatus === 'approved' ? 'Approved' :
                   userStatus === 'reviewed' ? 'Reviewed' :
                   userStatus === 'rejected' ? 'Rejected' : 'Pending'}
                </Tag>
              );
            })() : (
              (!isDraftState && user.status && user.status.toLowerCase() !== 'pending') && (
                <Tag 
                  color={user.status.toLowerCase() === 'approved' ? 'success' : 
                         user.status.toLowerCase() === 'reviewed' ? 'success' : 
                         user.status.toLowerCase() === 'rejected' ? 'error' : 'default'}
                  icon={user.status.toLowerCase() === 'approved' || user.status.toLowerCase() === 'reviewed' ? <CheckOutlined /> : 
                        user.status.toLowerCase() === 'rejected' ? <CloseCircleOutlined /> : null}
                  style={{ fontSize: '11px', margin: 0 }}
                >
                  {user.status.toLowerCase() === 'approved' ? 'Approved' :
                   user.status.toLowerCase() === 'reviewed' ? 'Reviewed' :
                   user.status.toLowerCase() === 'rejected' ? 'Rejected' : 'Pending'}
                </Tag>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TemplateApproversBar;
