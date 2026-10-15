import React from 'react';
import {
  Card, Form, Table, Row, Col, Tag, Typography, Dropdown, Button, Tooltip
} from 'antd';
import { DownOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TemplateReviewTab = ({
  approvers,
  lockedElements,
  categories,
  canSubmit,
  items,
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
      title={
        <span>
          Review Template Settings
          <Tooltip title="Please review your template configuration before creating it.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Row gutter={[16, 16]}>
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

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit && items[0].key === 'submit'}>
            Update Template <DownOutlined />
          </Button>
        </Dropdown>
        {!canSubmit && (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>
            Please complete all required fields in the highlighted tabs before submitting
          </div>
        )}
      </div>
    </Card>
  );
};

export default TemplateReviewTab;
