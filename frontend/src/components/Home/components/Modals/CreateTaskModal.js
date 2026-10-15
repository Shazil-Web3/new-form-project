// components/Modals/CreateTaskModal.jsx
import React from 'react';
import { Modal, Form, Input, Button, Select, DatePicker } from 'antd';

const { Option } = Select;

const CreateTaskModal = ({ 
  visible, 
  onCreate, 
  onCancel,
  users = [],
  docs = [],
  user 
}) => {
  const [form] = Form.useForm();

  return (
    <Modal
      title="Create New Task"
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
          Create
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="title"
          label="Task Title"
          rules={[{ required: true, message: 'Please enter a task title' }]}
        >
          <Input placeholder="Enter task title" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea rows={3} placeholder="Enter task description (optional)" />
        </Form.Item>
        <Form.Item
          name="dueDate"
          label="Due Date"
          rules={[{ required: true, message: 'Please select a due date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="priority"
          label="Priority"
          initialValue="Medium"
        >
          <Select>
            <Option value="High">High</Option>
            <Option value="Medium">Medium</Option>
            <Option value="Low">Low</Option>
          </Select>
        </Form.Item>
        <Form.Item
          name="assignedTo"
          label="Assign To"
          initialValue={user?.id}
        >
          <Select>
            <Option value={user?.id}>Me</Option>
            {users.map(u => (
              u.id !== user?.id && 
              <Option key={u.id} value={u.id}>{u.name || u.email}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="docId"
          label="Related Document"
        >
          <Select placeholder="Select a document (optional)">
            {docs.map(doc => (
              <Option key={doc.id} value={doc.id}>{doc.name}</Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;