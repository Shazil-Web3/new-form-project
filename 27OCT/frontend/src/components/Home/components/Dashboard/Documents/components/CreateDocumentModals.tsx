import React from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

export const TemplateChangeWarningModal = ({
  templateChangeModalVisible,
  cancelTemplateChange,
  confirmTemplateChange,
}) => {
  return (
      <Modal
        open={templateChangeModalVisible}
        onCancel={cancelTemplateChange}
        footer={null}
        centered
        width={480}
        closable={false}
        styles={{
          body: { padding: 0 }
        }}
      >
        {/* Custom styled body */}
        <div style={{
          borderRadius: 12,
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          {/* Header stripe */}
          <div style={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            padding: '24px 28px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ExclamationCircleOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>
                Change Template?
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 }}>
                This action cannot be undone
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px' }}>
            <p style={{
              margin: '0 0 8px',
              fontSize: 15,
              color: '#262626',
              lineHeight: 1.6
            }}>
              Switching to a different template will <strong>replace all content</strong> in the
              &ldquo;Content&rdquo; tab with the new template&rsquo;s content.
            </p>
            <p style={{
              margin: 0,
              fontSize: 14,
              color: '#595959',
              lineHeight: 1.6
            }}>
              Any text you have already typed or edited will be permanently lost.
            </p>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              marginTop: 28,
              justifyContent: 'flex-end'
            }}>
              <Button
                id="template-change-cancel-btn"
                onClick={cancelTemplateChange}
                style={{
                  borderRadius: 8,
                  height: 40,
                  padding: '0 22px',
                  fontWeight: 500
                }}
              >
                Keep Current Template
              </Button>
              <Button
                id="template-change-confirm-btn"
                type="primary"
                danger
                onClick={confirmTemplateChange}
                style={{
                  borderRadius: 8,
                  height: 40,
                  padding: '0 22px',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                  border: 'none'
                }}
              >
                Yes, Change Template
              </Button>
            </div>
          </div>
        </div>
      </Modal>
  );
};

export const DirectApprovalWarningModal = ({
  directApprovalWarningVisible,
  setDirectApprovalWarningVisible,
  handleSubmit,
  setDocumentApproversModalVisible,
}) => {
  return (
      <Modal
        open={directApprovalWarningVisible}
        onCancel={() => setDirectApprovalWarningVisible(false)}
        footer={null}
        centered
        width={480}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderRadius: 12, overflow: 'hidden', background: '#ffffff' }}>
          <div style={{
            background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
            padding: '24px 28px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ExclamationCircleOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>
                Direct Approval Warning
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 }}>
                Submitting directly for approval
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 28px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 15, color: '#262626', lineHeight: 1.6 }}>
              You are submitting this document <strong>directly for approval</strong>.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#595959', lineHeight: 1.6 }}>
              It is recommended to submit for review first so reviewers can verify the document content before final approval.
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'flex-end' }}>
              <Button
                id="direct-approval-doc-go-back-btn"
                onClick={() => setDirectApprovalWarningVisible(false)}
                style={{ borderRadius: 8, height: 40, padding: '0 20px', fontWeight: 500 }}
              >
                Go Back
              </Button>
              <Button
                id="direct-approval-doc-continue-btn"
                type="primary"
                onClick={() => {
                  setDirectApprovalWarningVisible(false);
                  handleSubmit('pending_approval');
                  setDocumentApproversModalVisible(false);
                }}
                style={{
                  borderRadius: 8,
                  height: 40,
                  padding: '0 20px',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
                  borderColor: '#d48806'
                }}
              >
                OK, Continue Anyway
              </Button>
            </div>
          </div>
        </div>
      </Modal>
  );
};

export default {
  TemplateChangeWarningModal,
  DirectApprovalWarningModal,
};
