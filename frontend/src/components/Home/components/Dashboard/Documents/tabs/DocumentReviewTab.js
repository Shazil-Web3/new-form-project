import React from 'react';
import { Card, Form, Row, Col, Typography, Tag, Table, Dropdown, Button, Tooltip } from 'antd';
import { InfoCircleOutlined, DownOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const DocumentReviewTab = ({
  availableTemplates = [],
  tasks = [],
  documentRequiredApprovers = [],
  impactData = {},
  docMenuItems = [],
  canSubmit,
  tabStatus = {},
}) => {
  return (
    <Card
      bordered={false}
      title={
        <span>
          Review Document Configuration
          <Tooltip title="Please review your document settings before creating it">
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
                  <p><strong>Title:</strong> {getFieldValue('title') || 'Not specified'}</p>
                  <p><strong>Department:</strong> {getFieldValue('department') || 'Not specified'}</p>
                  <p><strong>Template:</strong> {
                    getFieldValue('templateId')
                      ? availableTemplates.find(t => t.id === getFieldValue('templateId'))?.name || 'Template not found'
                      : 'No template selected'
                  }</p>
                </>
              )}
            </Form.Item>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Tasks">
            {tasks.filter(task => task.title && task.title.trim() !== '').length > 0 ? (
              <div>
                {tasks
                  .filter(task => task.title && task.title.trim() !== '')
                  .map((task, index) => (
                    <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
                      <p><strong>{task.title}</strong></p>
                      {task.description && <p style={{ margin: 0, color: '#666' }}>{task.description}</p>}
                      {task.dueDate && (
                        <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
                          <strong>Due:</strong> {task.dueDate.format('YYYY-MM-DD HH:mm')}
                        </p>
                      )}
                    </div>
                  ))
                }
              </div>
            ) : (
              <Text type="secondary">No valid tasks defined</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Approvers Configuration">
            {documentRequiredApprovers.length > 0 ? (
              <Table
                columns={[
                  {
                    title: 'Stage',
                    dataIndex: 'stage',
                    key: 'stage',
                    render: (stage) => <Tag>{stage || 'Approval'}</Tag>
                  },
                  {
                    title: 'Department',
                    dataIndex: 'department',
                    key: 'department',
                  },
                  {
                    title: 'Mandatory',
                    dataIndex: 'mandatory',
                    key: 'mandatory',
                    render: (mandatory) => (
                      <Tag color={mandatory ? 'green' : 'orange'}>
                        {mandatory ? 'Yes' : 'No'}
                      </Tag>
                    )
                  }
                ]}
                dataSource={documentRequiredApprovers}
                pagination={false}
                size="small"
                rowKey={(record, index) => `approver-${index}`}
              />
            ) : (
              <Text type="secondary">No required approvers configured</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Impact Assessment">
            {impactData.impactTemplates && impactData.impactTemplates.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                {impactData.impactTemplates.map((tpl, idx) => (
                  <div key={tpl.id || idx} style={{ marginBottom: 4 }}>
                    <Tag color="blue">Template: {tpl.name}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({(tpl.filledValues || []).filter(v => v?.trim()).length} fields completed)
                    </Text>
                  </div>
                ))}
              </div>
            ) : null}
            <p><strong>Impacted Departments:</strong> {
              impactData.departmentImpacts && impactData.departmentImpacts.length > 0
                ? impactData.departmentImpacts.join(', ')
                : 'None'
            }</p>
            <p><strong>Implementation Effort:</strong> <Tag color="blue">{impactData.implementationEffort?.toUpperCase() || 'MEDIUM'}</Tag></p>
            <p><strong>Training Required:</strong> {impactData.trainingRequired ? 'Yes' : 'No'}</p>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
          <Button type="primary" disabled={!canSubmit && docMenuItems[0].key === 'review'}>
            Create Document <DownOutlined />
          </Button>
        </Dropdown>
        {Object.values(tabStatus).some(s => s === 'incomplete') && (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>
            Please complete all required fields in the highlighted tabs before submitting
          </div>
        )}
      </div>
    </Card>
  );
};

export default DocumentReviewTab;
