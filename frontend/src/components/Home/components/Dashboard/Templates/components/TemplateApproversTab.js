import React from 'react';
import {
  Card, Button, Table, Divider, Select, Checkbox, Tooltip,
  Typography, Row, Col
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, InfoCircleOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const TemplateApproversTab = ({
  approvers,
  departments,
  addApprover,
  removeApprover,
  handleApproverChange,
  handleApproverDepartmentChange,
}) => {
  const approverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 250,
      render: (_, record) => {
        const selectedDepartments = approvers
          .filter(approver => approver.key !== record.key)
          .map(approver => approver.department);

        const availableDepartments = departments.filter(
          dept => !selectedDepartments.includes(dept.name)
        );

        const deptOptions = [
          ...availableDepartments,
          ...(record.department &&
            !availableDepartments.some(d => d.name === record.department)
            ? [departments.find(d => d.name === record.department)]
            : []
          )
        ].filter(Boolean);

        return (
          <Select
            value={record.department}
            style={{ width: '100%' }}
            onChange={(value) => handleApproverDepartmentChange(record.key, value)}
          >
            {deptOptions.map(dept => (
              <Option key={dept.id} value={dept.name}>{dept.name}</Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: 'Mandatory',
      dataIndex: 'mandatory',
      key: 'mandatory',
      width: 120,
      render: (_, record) => (
        <Tooltip title="When checked, the document cannot proceed to the next stage without this department's approval">
          <Checkbox
            checked={record.mandatory}
            onChange={(e) => handleApproverChange(record.key, 'mandatory', e.target.checked)}
          />
        </Tooltip>
      )
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 150,
      render: (_, record) => {
        const existingStages = [...new Set(approvers.map(a => a.stage))].sort((a, b) => a - b);
        const maxStage = Math.max(...existingStages, 0);
        const stageOptions = [];
        for (let i = 1; i <= maxStage + 1; i++) {
          stageOptions.push(i);
        }
        return (
          <Select
            value={record.stage}
            style={{ width: 80 }}
            onChange={(value) => handleApproverChange(record.key, 'stage', value)}
          >
            {stageOptions.map(stage => (
              <Option key={stage} value={stage}>{stage}</Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" icon={<DeleteOutlined />} danger onClick={() => removeApprover(record.key)} />
      ),
    },
  ];

  return (
    <Card
      bordered={false}
      title={
        <span>
          Template Approvers Configuration
          <Tooltip title="Define which departments must approve documents created from this template, whether their approval is mandatory, and at which stage they should review the document.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Row style={{ marginBottom: '16px' }}>
        <Col span={24}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addApprover}
            disabled={departments.length <= approvers.length}
          >
            Add Approver
          </Button>
        </Col>
      </Row>

      <Table
        columns={approverColumns}
        dataSource={approvers}
        pagination={false}
        size="middle"
      />

      <Divider />

      <Paragraph type="secondary">
        <Text strong>Note:</Text> The Mandatory field determines if approval from this department is required.
        The Stage field determines the order in which people will review the document.
      </Paragraph>
    </Card>
  );
};

export default TemplateApproversTab;
