import React from 'react';
import { 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Space, 
  Badge,
  Dropdown,
  Empty
} from 'antd';
import { 
  LockOutlined, 
  UserOutlined, 
  EllipsisOutlined
} from '@ant-design/icons';
import { getTemplateIcon, formatTemplateData, getStatusDisplay } from '../utils/templateListUtils';

export const TemplateListView = ({
  activeTab,
  orgTemplates,
  orgCategories,
  getTemplateCategoryActions,
  handleUseTemplateWithCheck,
  setViewMode
}) => {
  if (activeTab === "1") {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Empty
          description={
            <span style={{ fontWeight: 600 }}>List view is not available for public templates</span>
          }
        />
        <Button 
          type="primary" 
          onClick={() => setViewMode('blocks')}
          style={{ marginTop: 16 }}
        >
          Switch to Blocks View
        </Button>
      </div>
    );
  }
  
  const publishedTemplates = orgTemplates.filter(t => t.status === 'published');
  const disabledTemplates = orgTemplates.filter(t => t.status === 'disabled');
  const pendingRevisionTemplates = orgTemplates.filter(t => t.status === 'pending_revision');
  const allAvailableTemplates = [...publishedTemplates, ...disabledTemplates, ...pendingRevisionTemplates]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  if (allAvailableTemplates.length === 0) {
    return <Empty description="No templates available" />;
  }

  return (
    <div className="file-manager-view">
      <List
        bordered
        dataSource={allAvailableTemplates}
        renderItem={template => {
          const formattedTemplate = formatTemplateData(template, orgCategories);
          const isPublicTemplate = !template.organization_id;
          const statusDisplay = getStatusDisplay(formattedTemplate.status);
          
          return (
            <List.Item
              actions={[
                <Button 
                  type="primary" 
                  size="small" 
                  disabled={formattedTemplate.isDisabled}
                  onClick={() => handleUseTemplateWithCheck(formattedTemplate.id, formattedTemplate.isDisabled)}
                >
                  Use Template
                </Button>,
                <Dropdown
                  menu={{ items: getTemplateCategoryActions(template) }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button type="text" icon={<EllipsisOutlined />} />
                </Dropdown>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Badge 
                    count={`v${formattedTemplate.version || '1.0'}`} 
                    style={{ 
                      backgroundColor: isPublicTemplate ? '#1890ff' : '#52c41a',
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
                        backgroundColor: formattedTemplate.isDisabled ? '#f5f5f5' : '#f0f2f5', 
                        color: formattedTemplate.isDisabled ? '#bfbfbf' : '#1890ff',
                        opacity: formattedTemplate.isDisabled ? 0.7 : 1
                      }} 
                    />
                  </Badge>
                }
                title={
                  <div>
                    <span style={{ 
                      color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit',
                      textDecoration: formattedTemplate.isDisabled ? 'line-through' : 'none'
                    }}>
                      {formattedTemplate.title}
                    </span>
                    <Space style={{ marginLeft: 12 }}>
                      {formattedTemplate.isLocked && (
                        <Tag color="warning">
                          <LockOutlined /> Locked
                        </Tag>
                      )}
                      {formattedTemplate.hasApprovers && (
                        <Tag color="purple">
                          <UserOutlined /> Approvers
                        </Tag>
                      )}
                      {!isPublicTemplate && (
                        <Tag color={statusDisplay.color}>
                          {statusDisplay.icon} {statusDisplay.text}
                        </Tag>
                      )}
                    </Space>
                  </div>
                }
                description={
                  <span style={{ 
                    color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit' 
                  }}>
                    {formattedTemplate.description}
                  </span>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default TemplateListView;
