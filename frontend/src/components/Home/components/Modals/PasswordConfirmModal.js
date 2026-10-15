import React, { useState, useRef } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const PasswordConfirmModal = ({ visible, onCancel, onConfirm }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      try {
        if (onConfirm) {
          await onConfirm(values.password);
        }
        form.resetFields();
      } catch (error) {
        console.error('Password verification error in modal:', error);
      } finally {
        setLoading(false);
      }
    } catch (validationError) {
      console.error('Form validation failed:', validationError);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      title="Confirm Password"
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="back" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleSubmit}
        >
          Confirm
        </Button>,
      ]}
      maskClosable={false}
      destroyOnClose={true}
      ref={modalRef}
    >
      <p style={{ marginBottom: 16 }}>
        Please enter <strong>your account password</strong> to confirm this administrative action:
      </p>
      <Form
        form={form}
        layout="vertical"
        name="password_confirm_form"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="password"
          rules={[{ required: true, message: 'Please enter your password!' }]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="Enter your account password" 
            autoComplete="current-password"
            autoFocus
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PasswordConfirmModal;