// components/Modals/JoinDocumentModal.jsx
import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

const JoinDocumentModal = ({ 
  visible, 
  onJoin, 
  onCancel 
}) => {
  const [form] = Form.useForm();

  return (
    <Modal
      title="Join Document"
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={() => {
            form
              .validateFields()
              .then(values => {
                form.resetFields();
                onJoin(values);
              })
              .catch(info => {
                console.log('Validate Failed:', info);
              });
          }}
        >
          Join
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="docId"
          label="Document ID"
          rules={[{ required: true, message: 'Please enter a document ID' }]}
        >
          <Input placeholder="Enter document ID to join" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default JoinDocumentModal;