import React from 'react';
import { 
  Card, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Space, 
  Tooltip, 
  Divider,
  Badge,
  Dropdown,
  List
} from 'antd';
import { 
  LockOutlined, 
  UserOutlined, 
  EllipsisOutlined,
  CalendarOutlined,
  BranchesOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { getTemplateIcon, getCategoryNameById } from '../utils/templateListUtils';

const { Title, Text, Paragraph } = Typography;

export const TemplateCardItem = ({
  template,
  formattedTemplate,
  statusDisplay,
  isPublicTemplate,
  activeTab,
  orgCategories,
  getTemplateBlockActions,
  handleUseTemplateWithCheck
}) => {
  return (
    <List.Item key={template.id}>
      <Card 
        hoverable={!formattedTemplate.isDisabled} 
        className={`template-card ${formattedTemplate.isDisabled ? 'disabled-template' : ''}`}
        style={{ 
          height: '320px',
          width: '100%',
          display: 'flex', 
          flexDirection: 'column',
          borderLeft: formattedTemplate.isDisabled 
            ? '4px solid #ff4d4f' 
            : formattedTemplate.isLocked 
              ? '4px solid #faad14' 
              : '4px solid #52c41a',
          opacity: formattedTemplate.isDisabled ? 0.7 : 1
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
                color: formattedTemplate.isDisabled ? '#bfbfbf' : '#1890ff'
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
                  fontSize: '14px',
                  lineHeight: '1.3',
                  color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                }}
              >
                {formattedTemplate.title}
              </Title>
            </Tooltip>
          </div>
          <Dropdown
            menu={{ items: getTemplateBlockActions(template) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<EllipsisOutlined />} />
          </Dropdown>
        </div>
        
        <div style={{ flex: 1, marginBottom: 12 }}>
          <Paragraph 
            ellipsis={{ rows: 2 }} 
            type="secondary"
            style={{ 
              fontSize: '12px', 
              marginBottom: 8,
              color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
            }}
          >
            {formattedTemplate.description}
          </Paragraph>
        </div>
        
        <div style={{ marginBottom: 12 }}>
          <Space wrap size={[4, 4]}>
            {activeTab === "2" && formattedTemplate.categoryId && (
              <Tag color="blue" size="small">
                <FolderOutlined /> {getCategoryNameById(template.category_id, orgCategories)}
              </Tag>
            )}
            {formattedTemplate.isLocked && (
              <Tag color="warning" size="small">
                <LockOutlined /> Locked
              </Tag>
            )}
            {formattedTemplate.hasApprovers && (
              <Tag color="purple" size="small">
                <UserOutlined /> Approvers
              </Tag>
            )}
            {!isPublicTemplate && (
              <Tag color={statusDisplay.color} size="small">
                {statusDisplay.icon} {statusDisplay.text}
              </Tag>
            )}
          </Space>
        </div>
        
        <div style={{ marginTop: 'auto' }}>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px' }}>
              {!isPublicTemplate && (
                <>
                  <Text 
                    type="secondary" 
                    style={{ 
                      display: 'block',
                      color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                    }}
                  >
                    <CalendarOutlined /> Updated: {formattedTemplate.updatedAt}
                  </Text>
                  <Text 
                    type="secondary"
                    style={{ 
                      color: formattedTemplate.isDisabled ? '#bfbfbf' : 'inherit'
                    }}
                  >
                    <BranchesOutlined /> Version: {formattedTemplate.version || '1.0'}
                  </Text>
                </>
              )}
            </div>
            <Space size={4}>
              <Button 
                type="primary" 
                size="small" 
                disabled={formattedTemplate.isDisabled}
                onClick={() => handleUseTemplateWithCheck(formattedTemplate.id, formattedTemplate.isDisabled)}
              >
                Use Template
              </Button>
            </Space>
          </div>
        </div>
      </Card>
    </List.Item>
  );
};

export default TemplateCardItem;
