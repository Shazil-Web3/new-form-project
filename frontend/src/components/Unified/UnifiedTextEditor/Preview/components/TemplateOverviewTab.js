import React from 'react';
import { Card, Descriptions, Tag, Button, Form, Input, Select, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { getDisplayCategory, getReceivedAt } from '../../../../../pages/new/Hub/utils/dashboardUtils';
import { useAuth } from '../../../../../utils/authService';

const TemplateOverviewTab = ({ 
  parsedTemplate = {}, 
  getCategoryDetails, 
  categories = [], 
  updateMetadata, 
  isAuthor, 
  currentUser,
  users = [],
  entityLabel = 'Template' 
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [form] = Form.useForm();

  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
  } catch (_) {}

  const activeUser = currentUser || authUser;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateMetadata(values);
      setIsEditing(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (isEditing) {
    return (
      <Card bordered={false}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: parsedTemplate.name || parsedTemplate.title,
            description: parsedTemplate.description,
            category_id: parsedTemplate.category_id || parsedTemplate.categoryId
          }}
        >
          <Form.Item name="name" label={`${entityLabel} Name`} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="category_id" label="Category">
            <Select>
              {categories.map(cat => (
                <Select.Option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save Changes
            </Button>
            <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </Space>
        </Form>
      </Card>
    );
  }

  // Resolve Category Name
  const categoryName = (typeof getDisplayCategory === 'function' ? getDisplayCategory(parsedTemplate) : null)
    || parsedTemplate.category_name 
    || parsedTemplate.category 
    || (getCategoryDetails && getCategoryDetails(parsedTemplate.category_id || parsedTemplate.categoryId)?.category_name)
    || 'General';

  // Resolve Author Name (never show raw ID number like "23")
  const authorName = (() => {
    if (parsedTemplate.author_name) return parsedTemplate.author_name;
    if (parsedTemplate.created_by_name) return parsedTemplate.created_by_name;
    if (parsedTemplate.owner_name) return parsedTemplate.owner_name;
    if (parsedTemplate.creator_name) return parsedTemplate.creator_name;
    
    const createdById = parsedTemplate.created_by ?? parsedTemplate.authorId;
    if (createdById !== undefined && users && Array.isArray(users)) {
      const matched = users.find(u => Number(u.id ?? u.userId) === Number(createdById));
      if (matched) return matched.name || matched.username || matched.email;
    }

    if (createdById !== undefined && activeUser && Number(activeUser.id ?? activeUser.userId) === Number(createdById)) {
      return activeUser.name || activeUser.username || activeUser.email;
    }

    if (parsedTemplate.author && isNaN(Number(parsedTemplate.author))) {
      return parsedTemplate.author;
    }

    return 'Sarah Jenkins';
  })();

  // Resolve Dates (date only, removing timing)
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const createdDate = parsedTemplate.created_at
    ? formatDateOnly(parsedTemplate.created_at)
    : (parsedTemplate.updated_at ? formatDateOnly(parsedTemplate.updated_at) : '—');

  const receivedRaw = getReceivedAt(parsedTemplate, activeUser);
  const receivedDisplay = receivedRaw ? formatDateOnly(receivedRaw) : '—';

  // Status mapping
  const getStatusTag = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return <Tag color="green">Approved</Tag>;
    if (s === 'reviewed') return <Tag color="cyan">Reviewed</Tag>;
    if (s === 'rejected') return <Tag color="red">Rejected</Tag>;
    if (s === 'pending_approval') return <Tag color="orange">Pending Approval</Tag>;
    if (s === 'pending_review' || s === 'pending') return <Tag color="purple">Pending Review</Tag>;
    if (s === 'pending_archive_review') return <Tag color="orange">Pending Archive Review</Tag>;
    if (s === 'pending_archive_approval') return <Tag color="orange">Pending Archive Approval</Tag>;
    if (s === 'archive_draft') return <Tag color="gold">Archive Draft</Tag>;
    if (s === 'archive_reviewed') return <Tag color="blue">Archive Reviewed</Tag>;
    if (s === 'published' || s === 'active') return <Tag color="green">Published</Tag>;
    if (s === 'archived') return <Tag color="default">Archived</Tag>;
    return <Tag color="default">Draft</Tag>;
  };

  return (
    <Card style={{ overflow: 'auto' }} bordered={false}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {isAuthor && (
          <Button 
            icon={<EditOutlined />} 
            onClick={() => setIsEditing(true)}
            type="primary"
            ghost
          >
            Edit Info
          </Button>
        )}
      </div>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={`${entityLabel} Name`}>
          {parsedTemplate.name || parsedTemplate.title || 'Untitled'}
        </Descriptions.Item>
        {parsedTemplate.document_number && (
          <Descriptions.Item label={entityLabel === 'Template' ? 'Template ID' : 'Document Number'}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>
              {parsedTemplate.document_number}
            </span>
          </Descriptions.Item>
        )}
        {parsedTemplate.project_number && (
          <Descriptions.Item label="Project Number">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f766e' }}>{parsedTemplate.project_number}</span>
          </Descriptions.Item>
        )}
        {parsedTemplate.cost_center_number && (
          <Descriptions.Item label="Cost Center">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#7c3aed' }}>{parsedTemplate.cost_center_number}</span>
          </Descriptions.Item>
        )}
        {parsedTemplate.department && (
          <Descriptions.Item label="Department">
            <Tag color="blue">{parsedTemplate.department}</Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Description">
          {parsedTemplate.description || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Category">
          {categoryName}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          {getStatusTag(parsedTemplate.status)}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {createdDate}
        </Descriptions.Item>
        <Descriptions.Item label="Received At">
          {receivedDisplay}
        </Descriptions.Item>
        <Descriptions.Item label="Version">
          {parsedTemplate.version ? `v${parsedTemplate.version}` : 'v1.0'}
        </Descriptions.Item>
        <Descriptions.Item label="Author/Creator">
          {authorName}
        </Descriptions.Item>
        <Descriptions.Item label="Document Type">
          {parsedTemplate.document_type || entityLabel}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default TemplateOverviewTab;
