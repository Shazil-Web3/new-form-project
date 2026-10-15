import React from 'react';
import { Card, Row, Col, Table, Tag, Typography, Tooltip, Dropdown, Button, Divider } from 'antd';
import { InfoCircleOutlined, FileSearchOutlined, SaveOutlined, FileTextOutlined, DownOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TemplateReviewTab = ({ 
  parsedTemplate, 
  approvers, 
  departments, 
  categories, 
  handleSubmit, 
  canSubmit, 
  showTemplateApproversModal,
  setApproverType,
  handleRevertReviewersStatus,
  currentUser
}) => {
  
  const displayApproverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Mandatory',
      dataIndex: 'mandatory',
      key: 'mandatory',
      render: (text) => (
        <Tag color={text ? 'green' : 'red'}>
          {text ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (text) => <Tag>{text}</Tag>,
    },
  ];

  const authorMenuItems = [
    {
      key: 'draft',
      label: 'Save as Draft',
      icon: <FileTextOutlined />,
      onClick: () => handleSubmit('draft')
    },
    {
      key: 'review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: () => {
        setApproverType('review');
        showTemplateApproversModal();
      }
    },
    {
      key: 'approval',
      label: 'Submit for Approval',
      icon: <SaveOutlined />,
      onClick: () => {
        setApproverType('approval');
        showTemplateApproversModal('approval');
      }
    }
  ];

  return (
    <Card 
      bordered={false} 
      title={
        <span>
          Review Template Settings 
          <Tooltip title="Please review your template configuration before submitting.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >                  
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <p><strong>Name:</strong> {parsedTemplate.name || parsedTemplate.title}</p>
            <p><strong>Description:</strong> {parsedTemplate.description || 'No description provided'}</p>
            <p><strong>Category:</strong> {
              categories.find(c => c.category_id === parsedTemplate.category_id)?.category_name || parsedTemplate.category_id || 'Not specified'
            }</p>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Approvers Configuration">
            <Table 
              columns={displayApproverColumns} 
              dataSource={Array.isArray(parsedTemplate.approvers) ? parsedTemplate.approvers : []}
              pagination={false}
              size="small"
              rowKey={(record, index) => index}
            />
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Locked Elements">
            <ul>
              {Object.entries(parsedTemplate.locked_elements || {}).map(([key, value]) => (
                value ? <li key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</li> : null
              ))}
            </ul>
            {!Object.values(parsedTemplate.locked_elements || {}).some(Boolean) && <Text type="secondary">No elements locked</Text>}
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Structure">
            <ul>
              {parsedTemplate.template_structure?.includeTableOfContents && <li>Include Table of Contents (Index)</li>}
              {parsedTemplate.template_structure?.allowAttachments && <li>Allow File Attachments</li>}
              {!parsedTemplate.template_structure?.includeTableOfContents && !parsedTemplate.template_structure?.allowAttachments && 
                <Text type="secondary">No special structure settings</Text>
              }
            </ul>
          </Card>
        </Col>
      </Row>
      
      <Divider />
      
      <div style={{ marginTop: 24, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {(parsedTemplate.status === 'pending_review' || parsedTemplate.status === 'reviewed') && (
          <Button 
            type="default" 
            onClick={handleRevertReviewersStatus}
          >
            Update Status
          </Button>
        )}
        <Dropdown menu={{ items: authorMenuItems }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit}>
            Circulate Template <DownOutlined />
          </Button>
        </Dropdown>
      </div>
    </Card>
  );
};

export default TemplateReviewTab;
