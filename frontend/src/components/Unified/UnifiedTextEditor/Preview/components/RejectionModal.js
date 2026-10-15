import React from 'react';
import { Modal, Form, Input } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

const RejectionModal = ({ 
  visible, 
  onCancel, 
  onReject, 
  rejectionComment, 
  setRejectionComment, 
  isRejecting,
  entityType = 'Template'
}) => {
  const entityLabel = entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : 'Template';
  const entityLower = entityLabel.toLowerCase();

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <CloseCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
          Reject {entityLabel}
        </div>
      }
      open={visible}
      onOk={() => {
        if (!rejectionComment || !rejectionComment.trim()) {
          return;
        }
        onReject();
      }}
      onCancel={onCancel}
      okText={`Reject ${entityLabel}`}
      cancelText="Cancel"
      confirmLoading={isRejecting}
      okButtonProps={{ danger: true, disabled: !rejectionComment || !rejectionComment.trim() }}
      width={500}
    >
      <Form.Item label="Rejection Reason" required style={{ marginBottom: 24, marginTop: 12 }}>
        <Input.TextArea
          value={rejectionComment}
          onChange={e => setRejectionComment(e.target.value)}
          placeholder={`Please explain why you are rejecting this ${entityLower}...`}
          autoSize={{ minRows: 4, maxRows: 8 }}
          autoFocus
          showCount
          maxLength={500}
        />
      </Form.Item>
    </Modal>
  );
};

export default RejectionModal;
