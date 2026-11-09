// components/Modals/CreateTemplateModal.jsx
import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

const { TextArea } = Input;

const CreateTemplateModal = ({ visible, onCreate, onCancel }) => {
  const [form] = Form.useForm();

  return (
    <Modal
      title="Create Template"
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
                onCreate(values);
              })
              .catch(info => {
                console.log('Validate Failed:', info);
              });
          }}
        >
          Submit
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="name"
          label="Template Name"
          rules={[{ required: true, message: 'Please enter a Template Name' }]}
        >
          <Input placeholder="Enter a Template Name" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
        >
          <TextArea rows={2} placeholder="Enter a description (optional)" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTemplateModal;