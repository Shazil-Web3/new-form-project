import React from 'react';
import { Card, Row, Col, Form, Table, Tag, Typography, Button, Dropdown, Tooltip } from 'antd';
import { InfoCircleOutlined, DownOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ReviewTab = ({ 
  categories, 
  approvers, 
  lockedElements, 
  canSubmit,
  menuItems
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

  return (
    <Card 
    bordered={false} 
    bodyStyle={{padding: '16px'}}
    title=
      <span>
        Review Template Settings 
          <Tooltip 
        title="Please review your template configuration before creating it."
            >
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >                  
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <>
                  <p><strong>Name:</strong> {getFieldValue('name')}</p>
                  <p><strong>Description:</strong> {getFieldValue('description')}</p>
                  <p><strong>Category:</strong> {
                    categories.find(c => c.category_id === getFieldValue('category'))?.category_name || getFieldValue('category')
                  }</p>
                </>
              )}
            </Form.Item>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Approvers Configuration">
            <Table 
              columns={displayApproverColumns} 
              dataSource={approvers}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Locked Elements">
            <ul>
              {Object.entries(lockedElements).map(([key, value]) => (
                value ? <li key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</li> : null
              ))}
            </ul>
            {!Object.values(lockedElements).some(Boolean) && <Text type="secondary">No elements locked</Text>}
          </Card>
        </Col>
        
        <Col span={24}>
          <Card size="small" title="Structure">
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <ul>
                  {getFieldValue('includeTableOfContents') && <li>Include Table of Contents (Index)</li>}
                  {getFieldValue('allowAttachments') && <li>Allow File Attachments</li>}
                  {!getFieldValue('includeTableOfContents') && !getFieldValue('allowAttachments') && 
                    <Text type="secondary">No special structure settings</Text>
                  }
                </ul>
              )}
            </Form.Item>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Content Configuration">
            <Text type="secondary">Content configuration is set in the Content tab</Text>
          </Card>
        </Col>
      </Row>
      
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit && (menuItems[0]?.key === 'submit' || menuItems[0]?.key === 'review')}>
            Create Template <DownOutlined />
          </Button>
        </Dropdown>
        {!canSubmit && (
          <div style={{ color: '#ff4d4f', marginTop: 8, fontSize: '12px' }}>
            Please complete all required fields in the highlighted tabs before submitting
          </div>
        )}
      </div>
    </Card>
  );
};

export default ReviewTab;
