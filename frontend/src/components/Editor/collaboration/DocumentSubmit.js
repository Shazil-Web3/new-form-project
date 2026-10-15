import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Form, Input, Button, Select, Row, Col, 
  Tag, Typography, Alert, Divider, Table, Space, Tabs, 
  Badge, Modal, Empty, Tooltip, Radio, Checkbox, message, Dropdown
} from 'antd';
import { 
  PlusOutlined, CloseOutlined, FileTextOutlined, 
  UserOutlined, TeamOutlined, SettingOutlined, 
  FileTextTwoTone, TeamOutlined as TeamOutlinedTwo, 
  EditOutlined, FileSearchOutlined, LeftOutlined, 
  RightOutlined, DownOutlined, DeleteOutlined,
  InfoCircleOutlined, SaveOutlined, SendOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, EyeOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const stageColors = {
  1: 'blue',
  2: 'green', 
  3: 'orange',
  4: 'red',
  5: 'purple',
  6: 'cyan',
  7: 'magenta',
  8: 'yellow',
  9: 'lime',
  10: 'geekblue'
};

const impactLevels = [
  { value: 'low', label: 'Low', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'orange' },
  { value: 'high', label: 'High', color: 'red' },
  { value: 'critical', label: 'Critical', color: 'purple' }
];

const DocumentSubmit = ({ 
  visible, 
  onSubmit, 
  onCancel,
  document, // Document object being submitted
  templateData = null, // Template data with approvers configuration
  departments = [], // Array of department names: ['Engineering', 'Finance', 'Marketing', etc.]
  users = [], // Array of user objects from your sample data
  user // {id, name, email} - the user submitting the document
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("approvers");
  const [approvers, setApprovers] = useState([]);
  const [tabStatus, setTabStatus] = useState({
    approvers: "incomplete",
    impact: "incomplete"
  });
  const selectRef = useRef(null);

  // Get users by department
  const getUsersByDepartment = (department) => {
    return users.filter(user => 
      user.department === department && 
      user.status === 'active'
    );
  };

  // Get all unique stages currently used
  const getUsedStages = () => {
    return [...new Set(approvers.map(a => a.stage))].sort((a, b) => a - b);
  };

  // Check if a stage can be used (no gaps allowed)
  const canUseStage = (targetStage) => {
    const usedStages = getUsedStages();
    if (targetStage === 1) return true;
    
    // Check if all previous stages exist
    for (let i = 1; i < targetStage; i++) {
      if (!usedStages.includes(i)) {
        return false;
      }
    }
    return true;
  };

  // Get available stages for selection
  const getAvailableStages = () => {
    const usedStages = getUsedStages();
    const maxStage = usedStages.length > 0 ? Math.max(...usedStages) : 0;
    const availableStages = [];
    
    // Add all existing stages
    usedStages.forEach(stage => availableStages.push(stage));
    
    // Add next sequential stage if no gaps
    if (canUseStage(maxStage + 1)) {
      availableStages.push(maxStage + 1);
    }
    
    return availableStages;
  };

  // Initialize approvers from template data
  useEffect(() => {
    if (templateData?.required_approvers) {
      try {
        const requiredApprovers = typeof templateData.required_approvers === 'string' 
          ? JSON.parse(templateData.required_approvers)
          : templateData.required_approvers;
        
        const initialApprovers = requiredApprovers.map((approver, index) => ({
          key: approver.key !== undefined ? approver.key : index,
          department: approver.department,
          stage: approver.stage || 1,
          mandatory: approver.mandatory || false,
          participants: approver.participants || [],
          fromTemplate: true // Mark as from template
        }));
        setApprovers(initialApprovers);
        
        // Initialize form values for approvers
        const formApprovers = initialApprovers.map(approver => ({
          department: approver.department,
          participants: approver.participants,
          mandatory: approver.mandatory,
          stage: approver.stage
        }));
        form.setFieldsValue({ approvers: formApprovers });
        
      } catch (error) {
        console.error('Error parsing template approvers:', error);
      }
    }
  }, [templateData, form]);

  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      if (tab === 'approvers') {
        // Check if all mandatory departments have at least one participant
        const mandatoryApprovers = approvers.filter(approver => approver.mandatory);
        const hasInvalidMandatory = mandatoryApprovers.some(approver => 
          !approver.participants || approver.participants.length === 0
        );
        
        if (hasInvalidMandatory) {
          setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
          return false;
        }
        
        // Check if there's at least one approver with participants selected
        const hasAnyApprovers = approvers.some(approver => 
          approver.participants && approver.participants.length > 0
        );
        
        if (!hasAnyApprovers) {
          setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
          return false;
        }
        
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (tab === 'impact') {
        try {
          await form.validateFields(['impactLevel', 'businessJustification']);
          setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
          return true;
        } catch (error) {
          setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
          return false;
        }
      }

      setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
      return true;
    } catch (error) {
      console.log("Validation error:", error);
      setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
      return false;
    }
  };

  // Check validation when approvers change
  useEffect(() => {
    // Check if there are any approvers with participants
    const hasApprovers = approvers.length > 0;
    
    if (!hasApprovers) {
      setTabStatus(prev => ({ ...prev, approvers: "incomplete" }));
      return;
    }
    
    // Check mandatory approvers
    const mandatoryApprovers = approvers.filter(approver => approver.mandatory);
    const allMandatoryHaveParticipants = mandatoryApprovers.every(approver => 
      approver.participants && approver.participants.length > 0
    );
    
    // Check if at least one approver has participants
    const hasAnyApprovers = approvers.some(approver => 
      approver.participants && approver.participants.length > 0
    );
    
    // If there are mandatory approvers, they must all have participants
    // If no mandatory approvers, at least one approver must have participants
    const isValid = mandatoryApprovers.length > 0 
      ? allMandatoryHaveParticipants && hasAnyApprovers
      : hasAnyApprovers;
    
    setTabStatus(prev => ({ 
      ...prev, 
      approvers: isValid ? "complete" : "incomplete" 
    }));
  }, [approvers]);

  // Navigation between tabs
  const navigateToTab = (direction) => {
    const tabs = ["approvers", "impact"];
    const currentIndex = tabs.indexOf(activeTab);
    
    if (direction === 'next' && currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      handleTabChange(nextTab);
    } else if (direction === 'prev' && currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      handleTabChange(prevTab);
    }
  };

  const handleTabChange = async (key) => {
    if (activeTab) {
      await validateTabFields(activeTab);
    }
    
    setActiveTab(key);
  };

  // Get tab status badge color
  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Handle approver operations
  const addApprover = () => {
    // Get already selected departments
    const selectedDepartments = approvers.map(approver => approver.department);
    
    // Get available departments (convert to proper format if needed)
    const availableDepartments = Array.isArray(departments) 
      ? departments.filter(dept => {
          const deptName = typeof dept === 'string' ? dept : dept.name;
          return !selectedDepartments.includes(deptName);
        })
      : [];
    
    if (availableDepartments.length === 0) {
      message.warning('All departments have already been assigned as approvers.');
      return;
    }
    
    // Find the next available stage number
    const usedStages = getUsedStages();
    const nextStage = usedStages.length > 0 ? Math.max(...usedStages) + 1 : 1;
    const nextKey = Math.max(...approvers.map(a => a.key || 0), -1) + 1;
    
    const firstAvailableDept = availableDepartments[0];
    const deptName = typeof firstAvailableDept === 'string' ? firstAvailableDept : firstAvailableDept.name;
    
    const newApprover = {
      key: nextKey,
      department: deptName,
      stage: nextStage,
      mandatory: true, // Always true for manually added approvers
      participants: [],
      fromTemplate: false
    };
    
    setApprovers([...approvers, newApprover]);
    
    // Update form state
    const currentApprovers = form.getFieldValue('approvers') || [];
    form.setFieldsValue({ 
      approvers: [...currentApprovers, newApprover] 
    });
  };

  const removeApprover = (key) => {
    // Don't allow removing approvers that come from template
    const approver = approvers.find(a => a.key === key);
    if (approver && approver.fromTemplate) {
      message.warning('Cannot remove approvers that are required by the template.');
      return;
    }
    
    const approverToRemove = approvers.find(a => a.key === key);
    if (!approverToRemove) return;
    
    // Remove the approver
    const filteredApprovers = approvers.filter(approver => approver.key !== key);
    
    setApprovers(filteredApprovers);
    
    // Update form values
    const updatedFormApprovers = filteredApprovers.map(approver => ({
      department: approver.department,
      participants: approver.participants,
      mandatory: approver.mandatory,
      stage: approver.stage
    }));
    
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(approver => {
      if (approver.key === key) {
        return { ...approver, [field]: value };
      }
      return approver;
    }));
    
    // Update form values as well
    const formApprovers = form.getFieldValue('approvers') || [];
    const updatedFormApprovers = formApprovers.map((approver, index) => {
      const matchingApprover = approvers.find(a => a.key === index);
      if (matchingApprover && matchingApprover.key === key) {
        return { ...approver, [field]: value };
      }
      return approver;
    });
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  const handleApproverDepartmentChange = (key, value) => {
    // Only allow department changes for non-template approvers
    const approver = approvers.find(a => a.key === key);
    if (approver && approver.fromTemplate) {
      return;
    }
    
    // Update approver department and clear participants
    const updatedApprovers = approvers.map(approver => {
      if (approver.key === key) {
        return { 
          ...approver, 
          department: value,
          participants: [] // Clear participants when department changes
        };
      }
      return approver;
    });
    
    setApprovers(updatedApprovers);
    
    // Update form values
    const formApprovers = form.getFieldValue('approvers') || [];
    const updatedFormApprovers = formApprovers.map((approver, index) => {
      const matchingApprover = updatedApprovers.find(a => a.key === index);
      if (matchingApprover && matchingApprover.key === key) {
        return { 
          ...approver, 
          department: value,
          participants: []
        };
      }
      return approver;
    });
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  const handleStageChange = (key, newStage) => {
    // Only allow stage changes for non-template approvers
    const approver = approvers.find(a => a.key === key);
    if (approver && approver.fromTemplate) {
      return;
    }
    
    // Check if the stage can be used (no gaps)
    if (!canUseStage(newStage)) {
      message.error('Cannot skip stages. Please fill in sequential stages.');
      return;
    }
    
    const updatedApprovers = approvers.map(approver => {
      if (approver.key === key) {
        return { ...approver, stage: newStage };
      }
      return approver;
    });
    
    setApprovers(updatedApprovers);
    
    // Update form values
    const formApprovers = form.getFieldValue('approvers') || [];
    const updatedFormApprovers = formApprovers.map((approver, index) => {
      const matchingApprover = updatedApprovers.find(a => a.key === index);
      if (matchingApprover && matchingApprover.key === key) {
        return { ...approver, stage: newStage };
      }
      return approver;
    });
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  // Handle form submission
  const handleSubmit = async (submissionType = 'approval') => {
    try {
      await validateTabFields('approvers');
      await validateTabFields('impact');
      
      const values = await form.validateFields();
      
      // Prepare approvers data in the format expected by your backend
      const approversData = approvers
        .filter(approver => approver.participants && approver.participants.length > 0)
        .map(approver => ({
          key: approver.key,
          department: approver.department,
          stage: approver.stage,
          mandatory: approver.mandatory,
          participants: approver.participants.map(participant => {
            const user = users.find(u => u.id === participant.userId);
            return {
              userId: participant.userId,
              name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
              email: user?.email,
              role: "approver",
              status: "pending",
              comments: "",
              actionDate: null
            };
          })
        }));

      form.resetFields();
      setApprovers([]);
      setActiveTab("approvers");
      setTabStatus({
        approvers: "incomplete",
        impact: "incomplete"
      });
      
      onSubmit({
        ...values,
        required_approvers: JSON.stringify(approversData),
        documentId: document.id,
        submissionType // 'review' or 'approval'
      });
    } catch (error) {
      console.log('Validation Failed:', error);
      message.error('Please complete all required fields before submitting.');
    }
  };

  const getSubmitMenuItems = () => [
    {
      key: 'review',
      label: (
        <Space>
          <EyeOutlined />
          Submit for Review
        </Space>
      ),
      onClick: () => handleSubmit('review')
    },
    {
      key: 'approval',
      label: (
        <Space>
          <SendOutlined />
          Submit for Approval
        </Space>
      ),
      onClick: () => handleSubmit('approval')
    }
  ];

  // Tab navigation buttons
  const renderTabNavButtons = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
      <Space>
        <Button 
          icon={<LeftOutlined />} 
          onClick={() => navigateToTab('prev')}
          disabled={activeTab === "approvers"}
        >
          Previous
        </Button>
        <Button 
          type="primary" 
          onClick={() => navigateToTab('next')}
          disabled={activeTab === "impact"}
        >
          Next <RightOutlined />
        </Button>
        {activeTab === "impact" && (
          <Dropdown
            menu={{ items: getSubmitMenuItems() }}
            placement="bottomRight"
          >
            <Button type="primary">
              Submit <DownOutlined />
            </Button>
          </Dropdown>
        )}
      </Space>
    </div>
  );

  // Approver columns for table
  const approverColumns = [
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (_, record) => {
        // If from template, show as read-only
        if (record.fromTemplate) {
          return (
            <span>
              {record.department}
              <Tag color="blue" style={{ marginLeft: 8 }}>Template</Tag>
            </span>
          );
        }
        
        // Get already selected departments (excluding current record)
        const selectedDepartments = approvers
          .filter(approver => approver.key !== record.key)
          .map(approver => approver.department);
        
        // Filter available departments
        const availableDepartments = Array.isArray(departments) 
          ? departments.filter(dept => {
              const deptName = typeof dept === 'string' ? dept : dept.name;
              return !selectedDepartments.includes(deptName);
            })
          : [];
        
        // If current department is selected but not in available list, add it back
        const deptOptions = [
          ...availableDepartments,
          ...(record.department && 
            !availableDepartments.some(d => {
              const deptName = typeof d === 'string' ? d : d.name;
              return deptName === record.department;
            }) ? 
            [record.department] : 
            []
          )
        ].filter(Boolean);
        
        return (
          <Select
            value={record.department}
            style={{ width: '100%' }}
            onChange={(value) => handleApproverDepartmentChange(record.key, value)}
          >
            {deptOptions.map(dept => {
              const deptName = typeof dept === 'string' ? dept : dept.name;
              const userCount = getUsersByDepartment(deptName).length;
              return (
                <Option key={deptName} value={deptName}>
                  {deptName} ({userCount} users)
                </Option>
              );
            })}
          </Select>
        );
      },
    },
    {
      title: 'Users',
      dataIndex: 'users',
      key: 'users',
      render: (_, record) => {
        // Get department users
        const departmentUsers = getUsersByDepartment(record.department);
        const hasValidationError = record.mandatory && (!record.participants || record.participants.length === 0);
        
        return (
          <div>
            <Select
              ref={selectRef}
              style={{ width: '100%', marginBottom: 16 }}
              placeholder={record.mandatory ? "Select team members (required)" : "Select team members by email"}
              value={null} // Always keep it empty
              status={hasValidationError ? 'error' : ''}
              onChange={(userId) => {
                const user = users.find(u => u.id === userId);
                if (user) {
                  // Check if user is already added
                  const isAlreadyAdded = record.participants?.some(p => p.userId === userId);
                  if (isAlreadyAdded) {
                    message.warning('This user is already added as an approver.');
                    return;
                  }
                  
                  // Add user to participants
                  const newParticipant = { 
                    userId, 
                    role: "approver", 
                    status: "pending", 
                    comments: "", 
                    actionDate: null 
                  };
                  const updatedParticipants = [...(record.participants || []), newParticipant];
                  handleApproverChange(record.key, 'participants', updatedParticipants);
                  
                  // Clear selection
                  if (selectRef.current) {
                    selectRef.current.blur();
                  }
                }
              }}
              optionLabelProp="label"
            >
              {departmentUsers
                .filter(user => 
                  // Filter out users already added as participants
                  !record.participants?.some(p => p.userId === user.id)
                )
                .map(user => (
                  <Option 
                    key={user.id} 
                    value={user.id}
                    label={user.email}
                  >
                    <div>
                      <div>{user.email}</div>
                      {(user.first_name || user.last_name) && (
                        <div style={{ fontSize: 'smaller', color: '#666' }}>
                          {user.first_name} {user.last_name}
                        </div>
                      )}
                    </div>
                  </Option>
                ))
              }
            </Select>

            {/* Display selected participants */}
            {record.participants && record.participants.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {record.participants.map((participant, index) => {
                  const user = users.find(u => u.id === participant.userId);
                  return (
                    <Row key={index} gutter={16} align="middle" style={{ marginBottom: 4 }}>
                      <Col flex="auto">
                        <Tag color={stageColors[record.stage]}>
                          {user?.email || participant.userId}
                        </Tag>
                      </Col>
                      <Col>
                        <Button 
                          type="text" 
                          danger 
                          size="small"
                          onClick={() => {
                            const updatedParticipants = record.participants.filter((_, idx) => idx !== index);
                            handleApproverChange(record.key, 'participants', updatedParticipants);
                          }}
                        >
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  );
                })}
              </div>
            )}
            
            {departmentUsers.length === 0 && (
              <Text type="warning" style={{ fontSize: '12px', display: 'block' }}>
                No active users found in this department
              </Text>
            )}
            
            {hasValidationError && (
              <Text type="danger" style={{ fontSize: '12px', display: 'block' }}>
                This department is mandatory - please select at least one approver
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Mandatory',
      dataIndex: 'mandatory',
      key: 'mandatory',
      render: (_, record) => (
        <div>
          <Tag color={record.mandatory ? 'red' : 'default'}>
            {record.mandatory ? 'Yes' : 'No'}
          </Tag>
          {record.fromTemplate ? (
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              Set by template
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              Manual addition
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (_, record) => {
        if (record.fromTemplate) {
          return <Tag color={stageColors[record.stage]}>{record.stage}</Tag>;
        }
        
        const availableStages = getAvailableStages();
        
        return (
          <Space>
            <Select
              value={record.stage}
              style={{ width: 80 }}
              onChange={(value) => handleStageChange(record.key, value)}
            >
              {availableStages.map(stage => (
                <Option key={stage} value={stage}>
                  <Tag color={stageColors[stage]}>{stage}</Tag>
                </Option>
              ))}
            </Select>
          </Space>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          danger 
          onClick={() => removeApprover(record.key)}
          disabled={record.fromTemplate}
        >
          {record.fromTemplate ? 'Protected' : 'Remove'}
        </Button>
      ),
    },
  ];

  // Approvers tab content
  const renderApproversTab = () => (
    <Card 
      bordered={false} 
      title={
        <span>
          Document Approvers
          <Tooltip title="Select departments and users who need to approve this document">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      {templateData?.required_approvers && (
        <Alert
          message="Template Approval Configuration"
          description="This document uses a template with predefined approval requirements. Template approvers cannot be removed, but you can add participants and additional departments."
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      <Row style={{ marginBottom: '16px' }}>
        <Col span={24}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={addApprover}
          >
            Add Additional Department
          </Button>
        </Col>
      </Row>
      
      <Table 
        columns={approverColumns} 
        dataSource={approvers}
        pagination={false}
        size="middle"
        rowKey="key"
      />

      {approvers.length === 0 && (
        <Empty 
          description="No approvers configured. Please add departments and select approvers."
          style={{ margin: '40px 0' }}
        />
      )}

      <Divider />
      
      <Alert
        message="Approval Process"
        description={
          <div>
            <p>• Approvers will receive notifications in the order of their assigned stages</p>
            <p>• Multiple departments can be assigned to the same stage for parallel approval</p>
            <p>• Stages must be sequential - no gaps allowed (1, 2, 3, etc.)</p>
            <p>• All manually added departments are automatically set as mandatory</p>
            <p>• Template approvers cannot be removed but additional departments can be added</p>
          </div>
        }
        type="info"
      />
    </Card>
  );

  // Impact tab content
  const renderImpactTab = () => (
    <Card 
      bordered={false} 
      title={
        <span>
          Document Impact Assessment
          <Tooltip title="Assess the impact and urgency of this document submission">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Form.Item
        name="impactLevel"
        label="Impact Level"
        rules={[{ required: true, message: 'Please select an impact level' }]}
      >
        <Radio.Group>
          {impactLevels.map(level => (
            <Radio.Button key={level.value} value={level.value}>
              <Tag color={level.color}>{level.label}</Tag>
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="urgency"
        label="Urgency"
      >
        <Select placeholder="Select urgency level (optional)">
          <Option value="low">Low - Can wait</Option>
          <Option value="normal">Normal - Standard timeline</Option>
          <Option value="high">High - Needs prompt attention</Option>
          <Option value="urgent">Urgent - Immediate action required</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="businessJustification"
        label="Business Justification"
        rules={[{ required: true, message: 'Please provide business justification' }]}
      >
        <TextArea 
          rows={4} 
          placeholder="Explain the business need and impact of this document..."
        />
      </Form.Item>

      <Form.Item
        name="expectedOutcome"
        label="Expected Outcome"
      >
        <TextArea 
          rows={3} 
          placeholder="Describe what you expect to achieve with this document (optional)..."
        />
      </Form.Item>

      <Form.Item
        name="stakeholderImpact"
        label="Stakeholder Impact"
      >
        <Checkbox.Group>
          <Row>
            <Col span={8}><Checkbox value="customers">Customers</Checkbox></Col>
            <Col span={8}><Checkbox value="employees">Employees</Checkbox></Col>
            <Col span={8}><Checkbox value="partners">Partners</Checkbox></Col>
            <Col span={8}><Checkbox value="suppliers">Suppliers</Checkbox></Col>
            <Col span={8}><Checkbox value="regulatory">Regulatory</Checkbox></Col>
            <Col span={8}><Checkbox value="financial">Financial</Checkbox></Col>
          </Row>
        </Checkbox.Group>
      </Form.Item>

      <Form.Item
        name="additionalNotes"
        label="Additional Notes"
      >
        <TextArea 
          rows={3} 
          placeholder="Any additional information for approvers (optional)..."
        />
      </Form.Item>

      <Alert
        message="Impact Assessment Guide"
        description={
          <div>
            <p><strong>Low:</strong> Minor changes, limited scope</p>
            <p><strong>Medium:</strong> Moderate changes, departmental impact</p>
            <p><strong>High:</strong> Significant changes, cross-functional impact</p>
            <p><strong>Critical:</strong> Major changes, organization-wide impact</p>
          </div>
        }
        type="info"
      />
    </Card>
  );

  return (
    <Modal
      title={
        <div>
          <SendOutlined /> Submit Document for Approval
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Submit "{document?.name || document?.title}" for approval. Configure approvers and provide impact assessment.
        </Text>
      </div>

      {renderTabNavButtons()}
      
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          type="card"
          items={[
            {
              key: "approvers",
              label: (
                <Badge dot status={getTabStatusColor("approvers")} offset={[5, 0]}>
                  <TeamOutlined /> Approvers
                </Badge>
              ),
              children: renderApproversTab()
            },
            {
              key: "impact",
              label: (
                <Badge dot status={getTabStatusColor("impact")} offset={[5, 0]}>
                  <ExclamationCircleOutlined /> Impact
                </Badge>
              ),
              children: renderImpactTab()
            }
          ]}
        />
      </Form>
    </Modal>
  );
};

export default DocumentSubmit;