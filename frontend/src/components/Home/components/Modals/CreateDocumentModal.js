// components/Modals/CreateDocumentModal.jsx
import React from 'react';
import { Modal, Form, Input, Button, Select, DatePicker, Divider, Tag, Row, Col } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

const roleColors = {
  author: 'gold',
  editor: 'blue',
  commenter: 'green',
  viewer: 'default'
};

const CreateDocumentModal = ({ 
  visible, 
  onCreate, 
  onCancel,
  currentUser, // {id, name, email} - the creator of the document
  users = [], // Array of user objects: {id, name}
  templates = [] // Array of template objects: {id, name}
}) => {
  const [form] = Form.useForm();

  // Filter out current user from selectable users
  const selectableUsers = users.filter(user => user.id !== currentUser.id);

  return (
    <Modal
      title="Create New Document"
      visible={visible}
      onCancel={onCancel}
      width={700}
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
                // Ensure current user is included as author
                const participants = [
                  { userId: currentUser.id, role: 'author' },
                  ...(values.participants || [])
                ];
                
                form.resetFields();
                onCreate({
                  ...values,
                  participants
                });
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
        initialValues={{
          tasks: [{ title: '', description: '' }], // Initialize with one empty task
          participants: [] // Initialize empty participants array
        }}
      >
        <Form.Item
          name="title"
          label="Document Title"
          rules={[{ required: true, message: 'Please enter a document title' }]}
        >
          <Input placeholder="Enter document title" />
        </Form.Item>

        <Divider orientation="left">Tasks</Divider>
        <Form.List name="tasks">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <div key={key} style={{ position: 'relative', marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        {...restField}
                        name={[name, 'title']}
                        label="Task Title"
                        rules={[{ required: true, message: 'Please enter a task title' }]}
                      >
                        <Input placeholder="Enter task title" />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        {...restField}
                        name={[name, 'description']}
                        label="Task Description"
                      >
                        <TextArea rows={2} placeholder="Enter task description" />
                      </Form.Item>
                    </Col>
                     <Col span={24}>
                        <Form.Item
                        {...restField}
                        name="dueDate"
                        label="Document Due Date (optional)"
                      >
                        <DatePicker 
                          style={{ width: '100%' }}
                          showTime 
                          format="YYYY-MM-DD HH:mm"
                        />
                      </Form.Item>
                    </Col>

                  </Row>
                  {fields.length > 1 && (
                    <Button 
                      type="text" 
                      danger 
                      icon={<CloseOutlined />}
                      onClick={() => remove(name)}
                      style={{ position: 'absolute', top: 0, right: 0 }}
                    />
                  )}
                </div>
              ))}
              <Form.Item>
                <Button 
                  type="dashed" 
                  onClick={() => add({ title: '', description: '' })} 
                  block 
                  icon={<PlusOutlined />}
                >
                  Add Task
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Form.Item
          name="templateId"
          label="Template"
        >
          <Select 
            placeholder="Select a template (optional)"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => {
              const children = option.children;
              if (typeof children === 'string') {
                return children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
              }
              // Handle complex children
              if (children && typeof children === 'object') {
                const text = Array.isArray(children) 
                  ? children.map(c => typeof c === 'string' ? c : '').join(' ')
                  : (children.props?.children || '').toString();
                return text.toLowerCase().indexOf(input.toLowerCase()) >= 0;
              }
              return false;
            }}
          >
            {templates.map(template => (
              <Option key={template.id} value={template.id}>
                {template.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Divider orientation="left">Document Access</Divider>
        
        <div style={{ marginBottom: 16 }}>
          <p><strong>Creator:</strong></p>
          <Tag color={roleColors.author}>
            {currentUser.email} (Author)
          </Tag>
        </div>

        <Form.List name="participants">
          {(fields, { add, remove }) => (
            <>
              <Form.Item label="Add Team Members">
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select team members by email"
                  value={[]}
                  onChange={(userId) => {
                    const user = users.find(u => u.id === userId);
                    if (user) {
                      add({ userId, role: 'viewer' });
                    }
                  }}
                  optionLabelProp="label"
                >
                  {selectableUsers.map(user => (
                    <Option 
                      key={user.id} 
                      value={user.id}
                      label={user.email}
                    >
                      <div>
                        <div>{user.email}</div>
                        {user.name && <div style={{ fontSize: 'smaller', color: '#666' }}>{user.name}</div>}
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {fields.map(({ key, name, ...restField }) => {
                const participant = form.getFieldValue(['participants', name]);
                const user = users.find(u => u.id === participant?.userId);
                
                return (
                  <Row 
                    key={key} 
                    gutter={16} 
                    align="middle" 
                    style={{ marginBottom: 8 }}
                  >
                    <Col flex="auto">
                      <Tag>{user?.email}</Tag>
                    </Col>
                    <Col>
                      <Form.Item
                        {...restField}
                        name={[name, 'role']}
                        noStyle
                      >
                        <Select style={{ width: 120 }}>
                          <Option value="editor">Editor</Option>
                          <Option value="commenter">Commenter</Option>
                          <Option value="viewer">Viewer</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col>
                      <Button 
                        type="text" 
                        danger 
                        onClick={() => remove(name)}
                      >
                        Remove
                      </Button>
                    </Col>
                  </Row>
                );
              })}
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default CreateDocumentModal;