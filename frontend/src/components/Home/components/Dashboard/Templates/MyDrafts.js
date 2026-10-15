import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../../utils/alerts';
import { 
  Card, 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Empty, 
  Tooltip, 
  Divider,
  Skeleton,
  Popconfirm,
  message,
  Space,
  Badge
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  EditOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  LockOutlined,
  UserOutlined,
  DeleteOutlined,
  CalendarOutlined,
  FolderOutlined,
  BranchesOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const MyDrafts = ({ user, templates, categories, handleEditTemplate }) => {
  const [loading, setLoading] = useState(true);
  const [draftTemplates, setDraftTemplates] = useState([]);

  // Filter templates to show only drafts created by current user
  useEffect(() => {
    const fetchDraftTemplates = () => {
      try {
        setLoading(true);
        if (templates && templates.length > 0 && user?.id != null) {
          const uid = Number(user.id);
          const oid = user.orgId != null ? Number(user.orgId) : null;
          const userDrafts = templates.filter(
            (t) =>
              String(t.status ?? '').toLowerCase() === 'draft' &&
              Number(t.created_by) === uid &&
              (oid == null || Number(t.organization_id) === oid)
          );

          // Deduplicate: keep only the latest version of each draft
          // Group by template name and keep the one with the latest updated_at
          const draftMap = new Map();
          userDrafts.forEach(draft => {
            const key = draft.name; // Group by template name
            const existingDraft = draftMap.get(key);
            
            // Keep the draft with the most recent updated_at timestamp
            if (!existingDraft || new Date(draft.updated_at) > new Date(existingDraft.updated_at)) {
              draftMap.set(key, draft);
            }
          });

          // Convert map values back to array and sort by most recently updated
          const latestDrafts = Array.from(draftMap.values()).sort(
            (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
          );
          
          setDraftTemplates(latestDrafts);
        } else {
          setDraftTemplates([]);
        }
      } catch (error) {
        console.error("Failed to fetch draft templates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftTemplates();
  }, [user, templates]);

  // Format the template data for display
  const formatTemplateData = (template) => {
    let formattedTitle = template.name;
    if (template.category_id && categories) {
      const category = categories.find(c => c.category_id === template.category_id);
      if (category && category.category_prefix) {
        formattedTitle = `${category.category_prefix} - ${template.name}`;
      }
    }
    
    return {
      id: template.id,
      title: formattedTitle,
      originalTitle: template.name,
      description: template.description || "No description available",
      content: template.content,
      lockedSections: template.locked_sections,
      requiredApprovers: template.required_approvers,
      categoryId: template.category_id,
      createdBy: template.created_by,
      status: template.status,
      version: template.version || '1.0',
      createdAt: new Date(template.created_at).toLocaleDateString(),
      updatedAt: new Date(template.updated_at).toLocaleDateString(),
      isLocked: template.locked_sections && JSON.parse(template.locked_sections).length > 0,
      hasApprovers: template.required_approvers && JSON.parse(template.required_approvers).length > 0
    };
  };

  const getTemplateIcon = (template) => {
    const templateName = template.title || template.name || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FilePdfOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  const getCategoryNameById = (categoryId) => {
    if (!categories || !categoryId) return 'Uncategorized';
    const category = categories.find(c => c.category_id === categoryId);
    return category ? category.category_name : `Category ${categoryId}`;
  };

  const handleDeleteTemplate = async (templateId) => {
    confirmAlert(
      'Delete this Draft',
      `This action cannot be undone.`,
      'Yes, proceed',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`/api/remove_template/${templateId}`);
          const updatedTemplates = draftTemplates.filter(t => t.id !== templateId);
          setDraftTemplates(updatedTemplates);
          message.success('Draft template deleted successfully');
        } catch (error) {
          console.error('Failed to delete Draft template:', error);
          errorAlert('Failed to delete Draft template');
        }
      }
    });
  };

  const renderDraftItem = (template) => {
    const formattedTemplate = formatTemplateData(template);
    
    return (
      <List.Item key={template.id}>
        <Card 
          hoverable 
          className="draft-template-card"
          style={{ 
            height: '320px', // Fixed height for consistency
            width: '100%',
            display: 'flex', 
            flexDirection: 'column',
            borderLeft: '4px solid #faad14',
            opacity: 0.95
          }}
          bodyStyle={{ 
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12 }}>
            <Badge 
              count={`v${formattedTemplate.version}`} 
              style={{ 
                backgroundColor: '#faad14',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                minWidth: '28px'
              }}
            >
              <Avatar 
                icon={getTemplateIcon(template)} 
                size={48}
                style={{ 
                  backgroundColor: '#f5f5f5', 
                  color: '#8c8c8c'
                }} 
              />
            </Badge>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <Tooltip title={formattedTemplate.title}>
                <Title 
                  level={5} 
                  ellipsis={{ rows: 2 }} 
                  style={{ 
                    marginBottom: 4, 
                    color: '#595959',
                    fontSize: '14px',
                    lineHeight: '1.3'
                  }}
                >
                  {formattedTemplate.title}
                </Title>
              </Tooltip>
            </div>
          </div>
          
          <div style={{ flex: 1, marginBottom: 12 }}>
            <Paragraph 
              ellipsis={{ rows: 2 }} 
              type="secondary"
              style={{ fontSize: '12px', marginBottom: 8 }}
            >
              {formattedTemplate.description}
            </Paragraph>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <Space wrap size={[4, 4]}>
              {formattedTemplate.categoryId && (
                <Tag color="default" size="small">
                  <FolderOutlined /> {getCategoryNameById(template.category_id)}
                </Tag>
              )}
              {formattedTemplate.isLocked && (
                <Tag color="default" size="small">
                  <LockOutlined /> Locked
                </Tag>
              )}
              {formattedTemplate.hasApprovers && (
                <Tag color="default" size="small">
                  <UserOutlined /> Approvers
                </Tag>
              )}
              <Tag color="warning" size="small">
                <FileOutlined /> Draft
              </Tag>
            </Space>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px' }}>
                <Text type="secondary" style={{ display: 'block' }}>
                  <CalendarOutlined /> Created: {formattedTemplate.createdAt}
                </Text>
                <Text type="secondary">
                  <BranchesOutlined /> Version: {formattedTemplate.version}
                </Text>
              </div>
              <Space size={4}>
                <Button 
                  type="primary" 
                  icon={<EyeOutlined />}
                  size="small"
                  onClick={() => handleEditTemplate(template)}
                >
                  Review
                </Button>
                  <Tooltip title="Delete Draft">
                    <Button 
                      type="text" 
                      icon={<DeleteOutlined />} 
                      size="small"
                      danger
                      onClick={() => handleDeleteTemplate(template.id)}
                    />
                  </Tooltip>
              </Space>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  return (
    <div className="drafts-dashboard">
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#595959' }}>
            <EditOutlined style={{ marginRight: 8 }} />
            My Draft Templates
            <Text type="secondary" style={{ fontSize: '16px', fontWeight: 'normal', marginLeft: 8 }}>
              ({draftTemplates.length} templates)
            </Text>
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Templates that you've created but haven't submitted for approval yet
          </Text>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : draftTemplates.length === 0 ? (
          <Empty 
            description="No draft templates found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              Create a new template to get started with your drafts
            </Text>
          </Empty>
        ) : (
          <List
            grid={{ 
              gutter: [16, 16], 
              xs: 1, 
              sm: 2, 
              md: 3, 
              lg: 3,
              xl: 4,
              xxl: 5
            }}
            dataSource={draftTemplates}
            renderItem={renderDraftItem}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} templates`
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default MyDrafts;