import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { ExclamationCircleFilled, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Text, Paragraph, Title } = Typography;

const ReviewPendingModal = ({
  visible,
  pendingInfo,
  onStay,
  onLeaveAnyway
}) => {
  const isReview = pendingInfo?.type === 'review';
  const roleName = pendingInfo?.roleName || (isReview ? 'Reviewer' : 'Approver');
  const actionName = pendingInfo?.actionName || (isReview ? 'Review' : 'Approval');
  const itemType = pendingInfo?.itemType || 'document';

  const modalTitle = `${actionName} Pending`;
  const stayButtonText = `Stay & ${actionName}`;
  const leaveButtonText = 'Leave Anyway';

  return (
    <Modal
      open={visible}
      title={null}
      footer={null}
      closable={false}
      centered
      maskClosable={false}
      width={460}
      styles={{
        content: {
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div 
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#FEF3C7',
            color: '#D97706',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 16
          }}
        >
          <ExclamationCircleFilled />
        </div>

        <Title level={4} style={{ margin: '0 0 8px 0', color: '#1E293B', fontWeight: 600 }}>
          {modalTitle}
        </Title>

        <Paragraph style={{ color: '#64748B', fontSize: 14, lineHeight: '1.6', margin: 0 }}>
          You are currently assigned as a <strong style={{ color: '#0F172A' }}>{roleName}</strong> for this {itemType}.
          Your {actionName.toLowerCase()} has not been completed or submitted yet.
        </Paragraph>

        <Paragraph style={{ color: '#64748B', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          Would you like to stay and complete your {actionName.toLowerCase()}, or leave anyway?
        </Paragraph>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'stretch' }}>
        <Button
          block
          size="large"
          type="default"
          onClick={onLeaveAnyway}
          style={{
            borderRadius: 8,
            fontWeight: 500,
            borderColor: '#E2E8F0',
            color: '#64748B',
            height: 42
          }}
        >
          {leaveButtonText}
        </Button>
        <Button
          block
          size="large"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={onStay}
          style={{
            borderRadius: 8,
            fontWeight: 600,
            backgroundColor: '#2563EB',
            borderColor: '#2563EB',
            height: 42
          }}
        >
          {stayButtonText}
        </Button>
      </div>
    </Modal>
  );
};

ReviewPendingModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  pendingInfo: PropTypes.object,
  onStay: PropTypes.func.isRequired,
  onLeaveAnyway: PropTypes.func.isRequired
};

export default ReviewPendingModal;
