import React from 'react';
import { Card, Table, Button, Select, Checkbox, Tooltip, Divider, Typography, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Paragraph, Text } = Typography;

const ApproversManager = ({ 
  approvers, 
  setApprovers,   // Need this to update stage for re-assignment
  departments, 
  addApprover, 
  removeApprover, 
  handleApproverChange, 
  handleApproverDepartmentChange 
}) => {
  
  const approverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 250, 
      render: (_, record) => {
        // Get already selected departments (excluding current record)
        const selectedDepartments = approvers
          .filter(approver => approver.key !== record.key)
          .map(approver => approver.department);
        
        // Filter available departments
        const availableDepartments = departments.filter(
          dept => !selectedDepartments.includes(dept.name)
        );
        
        // If current department is selected but not in available list, add it back
        const deptOptions = [
          ...availableDepartments,
          ...(record.department && 
            !availableDepartments.some(d => d.name === record.department) ? 
            [departments.find(d => d.name === record.department)] : 
            []
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
        // Get all available stages (current stages + 1 more)
        const existingStages = [...new Set(approvers.map(a => a.stage))].sort((a, b) => a - b);
        const maxStage = Math.max(...existingStages, 0);
        
        // Generate available stage options (all existing stages plus up to maxStage+1)
        const stageOptions = [];
        for (let i = 1; i <= maxStage + 1; i++) {
          stageOptions.push(i);
        }
        
        return (
          <Select
            value={record.stage}
            style={{ width: 80 }}
            onChange={(value) => {
              // Update the stage for this approver
              // Note: We need to access setApprovers or have a handleStageChange exposed
              // Since we don't have handleStageChange, we'll implement it locally if setApprovers is available
              // Or better, we should rely on handleApproverChange if it supported direct object update
              
              // In this case, we use the passed setApprovers prop if available, or just use handleApproverChange ('stage', value)
              handleApproverChange(record.key, 'stage', value);
              
              // Warning: The original code logic for updating stages was:
              // const updatedApprovers = approvers.map(...)
              // setApprovers(updatedApprovers);
              // 
              // handleApproverChange defined in CreateTemplate.js does:
              // setApprovers(approvers.map(a => a.key === key ? { ...a, [field]: value } : a))
              //
              // This is equivalent.
            }}
          >
            {stageOptions.map(stage => (
              <Option key={stage} value={stage}>
                {stage}
              </Option>
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
        <Button type="link" icon={<DeleteOutlined/>} danger onClick={() => removeApprover(record.key)}></Button>
      ),
    },
  ];

  return (
    <Card 
    bordered={false} 
    bodyStyle={{padding: '16px'}}
    title=
      <span>
        Template Approvers Configuration 
          <Tooltip title="Define which departments must approve documents created from this template, whether their approval is mandatory, and at which stage they should review the document.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
      </span>
    >
      
      <Row style={{ marginBottom: '12px' }}>
        <Col span={24}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={addApprover}
            disabled={departments.length <= approvers.length}
            size="small"
          >
            Add Approver
          </Button>
        </Col>
      </Row>
      
      <Table 
        columns={approverColumns} 
        dataSource={approvers}
        pagination={false}
        size="small"
      />
      
      <Divider />
      
      <Paragraph type="secondary">
        <Text strong>Note:</Text> The Mandatory field determines if approval from this department is required. 
        The Stage field determines the order in which people will review the document.
      </Paragraph>
    </Card>
  );
};

export default ApproversManager;
