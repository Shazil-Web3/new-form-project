import React from 'react';
import { Modal, Button, Alert } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Simple warning modal shown when the user tries to submit for approval
 * while there are unresolved/pending comments or suggestions.
 *
 * Props:
 *   open        – boolean, whether the modal is visible
 *   onGoBack    – called when the user clicks "Go Back & Address"
 *   onProceed   – called when the user clicks "Proceed Anyway"
 *   entityLabel – "Template" or "Document"
 */
const UnaddressedCommentsWarningModal = ({ open, onGoBack, onProceed, entityLabel = 'Template' }) => (
  <Modal
    open={!!open}
    onCancel={onGoBack}
    closable={false}
    title={
      <span style={{ color: '#d48806', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ExclamationCircleOutlined />
        Unaddressed Comments &amp; Suggestions
      </span>
    }
    footer={[
      <Button key="back" onClick={onGoBack}>
        Go Back &amp; Address
      </Button>,
      <Button key="proceed" type="primary" danger onClick={onProceed}>
        Proceed for Approval Anyway
      </Button>,
    ]}
    width={480}
    centered
    destroyOnClose
  >
    <Alert
      type="warning"
      showIcon
      message="There are unresolved comments or suggestions in this document."
      description={`Please accept, reject, or resolve all comments and suggestions before sending this ${entityLabel.toLowerCase()} for approval.`}
      style={{ marginBottom: 8 }}
    />
  </Modal>
);

export default UnaddressedCommentsWarningModal;
