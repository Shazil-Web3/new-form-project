import React from 'react';
import { Card, Typography, Table, Tag, Divider, Descriptions, Button, Space, message, Row, Col, Select } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons';
import ApproversManager from '../../../../Home/components/Dashboard/Templates/CreateTemplate/components/ApproversManager';

const { Option } = Select;

const TemplateApproversTab = ({ 
  parsedTemplate, 
  selectedTemplate,
  departments, 
  users = [],
  getCurrentUsersToShow,
  isAuthor,
  isAdmin = false,
  updateMetadata,
  defaultEditing = false,
  workflowApprovers,
  setWorkflowApprovers,
  reviewerRoleSlug = 'doc_reviewer',
  approverRoleSlug = 'doc_approver'
}) => {
  const canEdit = isAuthor || isAdmin;
  const [isEditing, setIsEditing] = React.useState(defaultEditing);

  // Parse sets from selectedTemplate
  const sets = React.useMemo(() => {
    if (!selectedTemplate?.custom_document_approvers) return [];
    try {
      const parsed = typeof selectedTemplate.custom_document_approvers === 'string'
        ? JSON.parse(selectedTemplate.custom_document_approvers)
        : selectedTemplate.custom_document_approvers;
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].name !== undefined) {
          return parsed;
        } else {
          return [{
            id: 'default',
            name: 'Default Set',
            comment: 'Legacy configuration',
            departments: parsed
          }];
        }
      }
    } catch (e) {}
    return [];
  }, [selectedTemplate]);

  const [approvers, setApprovers] = React.useState(
    Array.isArray(parsedTemplate.required_approvers) 
      ? parsedTemplate.required_approvers 
      : (Array.isArray(parsedTemplate.approvers) ? parsedTemplate.approvers : [])
  );

  // Update local approvers state when parsedTemplate changes (e.g. after a successful save)
  React.useEffect(() => {
    setApprovers(
      Array.isArray(parsedTemplate.required_approvers) 
        ? parsedTemplate.required_approvers 
        : (Array.isArray(parsedTemplate.approvers) ? parsedTemplate.approvers : [])
    );
  }, [parsedTemplate]);



  const isUserSelected = (userId) => {
    if (getCurrentUsersToShow) {
      return getCurrentUsersToShow().some(u => u.userId === userId || u.id === userId);
    }
    if (workflowApprovers) {
      const reviewers = workflowApprovers.reviewers || [];
      const approversList = workflowApprovers.approvers || [];
      return [...reviewers, ...approversList].some(u => u.userId === userId);
    }
    return false;
  };

  const handleUserToggle = (u) => {
    if (!setWorkflowApprovers) return;

    setWorkflowApprovers(prev => {
      if (!prev) return prev;
      const targetReviewers = prev.reviewers || [];
      const targetApprovers = prev.approvers || [];

      const isSelected = [...targetReviewers, ...targetApprovers].some(a => a.userId === u.id);

      if (isSelected) {
        return {
          ...prev,
          reviewers: targetReviewers.filter(r => r.userId !== u.id),
          approvers: targetApprovers.filter(a => a.userId !== u.id)
        };
      } else {
        const reviewerObj = {
          userId: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          department: u.selectedDepartment || u.department || '',
          role: reviewerRoleSlug,
          status: 'pending'
        };
        const approverObj = {
          userId: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
          department: u.selectedDepartment || u.department || '',
          role: approverRoleSlug,
          status: 'pending',
          comment: ''
        };
        return {
          ...prev,
          reviewers: [...targetReviewers, reviewerObj],
          approvers: [...targetApprovers, approverObj]
        };
      }
    });
  };

  const addApprover = () => {
    const selectedDepartments = approvers.map(a => a.department);
    const availableDepartments = departments.filter(d => !selectedDepartments.includes(d.name));
    if (availableDepartments.length === 0) {
      message.warning('All departments assigned.');
      return;
    }
    const maxStage = approvers.length > 0 ? Math.max(...approvers.map(a => a.stage)) : 0;
    setApprovers([...approvers, {
      key: approvers.length,
      department: availableDepartments[0].name,
      mandatory: false,
      stage: maxStage > 0 ? maxStage : 1
    }]);
  };

  const removeApprover = (key) => {
    const filtered = approvers.filter(a => a.key !== key);
    setApprovers(filtered.map((a, i) => ({ ...a, key: i })));
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(a => a.key === key ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    await updateMetadata({ approvers });
    setIsEditing(false);
  };
  
  const renderApproversTable = () => {
    // Priority: parsedTemplate.approvers (array set by hook) → required_approvers → empty
    const dataSource = Array.isArray(parsedTemplate?.approvers) && parsedTemplate.approvers.length > 0
      ? parsedTemplate.approvers
      : (Array.isArray(parsedTemplate?.required_approvers) && parsedTemplate.required_approvers.length > 0
          ? parsedTemplate.required_approvers
          : []);

    // Also check template_approvers for individual user configs to display
    const workflowApprovers = parsedTemplate?.template_approvers;
    const workflowReviewers = Array.isArray(workflowApprovers?.reviewers) ? workflowApprovers.reviewers : [];
    const workflowApproversList = Array.isArray(workflowApprovers?.approvers) ? workflowApprovers.approvers : [];
    const allWorkflowUsers = [...workflowReviewers, ...workflowApproversList];

    if (dataSource.length === 0 && allWorkflowUsers.length === 0) {
      return <Typography.Text type="secondary">No approvers configured</Typography.Text>;
    }

    // If we have department-level config, show the table
    if (dataSource.length > 0) {
      const columns = [
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
          render: (deptId) => {
            const dept = departments.find(d => d.id === deptId || d.name === deptId);
            return dept ? dept.name : `${deptId}`;
          }
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
      ];

      return (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="small"
          rowKey={(record, index) => `approver-${index}`}
        />
      );
    }

    // Fallback: show individual user configs from template_approvers
    if (allWorkflowUsers.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workflowReviewers.length > 0 && (
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Reviewers</Typography.Text>
              {workflowReviewers.map((u, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                  {u.name || u.email} {u.department ? `(${u.department})` : ''}
                </Tag>
              ))}
            </div>
          )}
          {workflowApproversList.length > 0 && (
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Approvers</Typography.Text>
              {workflowApproversList.map((u, i) => (
                <Tag key={i} color="green" style={{ marginBottom: 4 }}>
                  {u.name || u.email} {u.department ? `(${u.department})` : ''}
                </Tag>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <Typography.Text type="secondary">No approvers configured</Typography.Text>;
  };


  const renderDepartmentalUsers = () => {
    if (!approvers || approvers.length === 0) return null;

    return (
      <div style={{ marginTop: 24 }}>
        <Typography.Title level={5}>Departmental Contacts</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          The following users from required departments have visibility into this {parsedTemplate.document_id ? 'document' : 'template'}. Click on a user's badge below to add or remove them from the approval workflow.
        </Typography.Text>
        
        <Row gutter={[16, 16]}>
          {approvers.map((approver, idx) => {
            const deptUsers = users.filter(u => u.department === approver.department && u.template_approver === 'yes');
            return (
              <Col span={24} key={`dept-users-${idx}`}>
                <Card 
                  size="small" 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{approver.department} Department</span>
                      <Tag color="blue">Stage {approver.stage}</Tag>
                    </div>
                  }
                  style={{ backgroundColor: '#fafafa' }}
                >
                  {deptUsers.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {deptUsers.map(u => {
                        const selected = isUserSelected(u.id);
                        return (
                          <Tag 
                            key={u.id} 
                            color={selected ? 'green' : 'default'}
                            onClick={() => handleUserToggle(u)}
                            style={{ 
                              cursor: 'pointer', 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              border: selected ? '1px solid #52c41a' : '1px dashed #d9d9d9',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            {selected && <CheckOutlined style={{ marginRight: 4 }} />}
                            {u.first_name} {u.last_name} ({u.email})
                          </Tag>
                        );
                      })}
                    </div>
                  ) : (
                    <Typography.Text type="secondary" italic>No eligible users found in this department</Typography.Text>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };

  if (isEditing) {
    return (
      <Card bordered={false}>
        <ApproversManager 
          approvers={approvers}
          setApprovers={setApprovers}
          departments={departments}
          addApprover={addApprover}
          removeApprover={removeApprover}
          handleApproverChange={handleApproverChange}
          handleApproverDepartmentChange={(key, val) => handleApproverChange(key, 'department', val)}
        />
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Save Approvers
          </Button>
          <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </Space>
      </Card>
    );
  }

  const usersToShow = getCurrentUsersToShow() || [];

  // Deduplicate users so that if a user is both reviewer and approver, they only show up once in the UI list
  const uniqueUsers = [];
  const seenUserIds = new Set();
  usersToShow.forEach(user => {
    const key = user.userId || user.email;
    if (key && !seenUserIds.has(key)) {
      seenUserIds.add(key);
      uniqueUsers.push(user);
    }
  });

  const canChangeSet = isEditing || (parsedTemplate.status === 'draft' || parsedTemplate.status === 'pending_revision');

  return (
    <Card bordered={false}>
      {/* Set Selector Dropdown */}
      {sets.length > 1 && (
        <div style={{ marginBottom: 20, padding: '16px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: '600', marginBottom: 8, fontSize: '14px', color: '#262626' }}>Select Approver Set:</div>
          {canChangeSet ? (
            <Select
              value={workflowApprovers?.selectedSetId || (sets[0] && sets[0].id)}
              style={{ width: '100%', marginBottom: 8 }}
              onChange={(setId) => {
                const selectedSet = sets.find(s => s.id === setId);
                if (selectedSet) {
                  // Reset users and set selection metadata
                  setWorkflowApprovers({
                    reviewers: [],
                    approvers: [],
                    selectedSetId: selectedSet.id,
                    selectedSetName: selectedSet.name,
                    selectedSetComment: selectedSet.comment
                  });
                  // Update required departments/stages
                  if (updateMetadata) {
                    const customDepts = selectedSet.departments.map((item, idx) => ({
                      key: idx,
                      department: item.department,
                      mandatory: true,
                      stage: item.stage || 1
                    }));
                    updateMetadata({ approvers: customDepts });
                  }
                }
              }}
            >
              {sets.map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          ) : (
            <div style={{ fontWeight: '500', fontSize: '15px', color: '#1890ff', marginBottom: 8 }}>
              {workflowApprovers?.selectedSetName || 'Default Set'}
            </div>
          )}
          {workflowApprovers?.selectedSetComment && (
            <div style={{ fontSize: '13px', color: '#8c8c8c', fontStyle: 'italic' }}>
              Comment: {workflowApprovers.selectedSetComment}
            </div>
          )}
        </div>
      )}
      
      {/* If there's only 1 set (e.g. legacy/single set), but it has a name/comment, display it as text */}
      {sets.length === 1 && (workflowApprovers?.selectedSetName || workflowApprovers?.selectedSetComment) && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: '600', color: '#595959', fontSize: '13px' }}>Approver Set:</div>
          <div style={{ fontWeight: '500', color: '#262626' }}>{workflowApprovers?.selectedSetName || 'Default Set'}</div>
          {workflowApprovers?.selectedSetComment && (
            <div style={{ fontSize: '12px', color: '#8c8c8c', fontStyle: 'italic', marginTop: 4 }}>
              Comment: {workflowApprovers.selectedSetComment}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={5}>
          {parsedTemplate.status === 'pending_review' || parsedTemplate.status === 'reviewed'
            ? 'Reviewers Status'
            : parsedTemplate.status === 'draft' || parsedTemplate.status === 'pending_revision'
              ? 'Configured Approvers (Pre-set from Template)'
              : 'Approvers Status'}
        </Typography.Title>
        
        {/* Selected Approvers List (at the start section) */}
        {uniqueUsers.length === 0 ? (
          canEdit ? (
            <Card 
              style={{ 
                border: '2px dashed #d9d9d9', 
                borderRadius: '8px', 
                textAlign: 'center', 
                padding: '24px',
                cursor: 'pointer',
                backgroundColor: '#fafafa',
                marginBottom: 24
              }}
              onClick={() => {
                const el = document.getElementById('department-members-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <PlusOutlined style={{ fontSize: '40px', color: '#1890ff', marginBottom: '12px' }} />
              <div style={{ fontWeight: '500', fontSize: '16px' }}>Assign Document Approvers</div>
              <div style={{ color: '#8c8c8c', marginTop: '4px' }}>Click here or use the plus buttons below to add members from the required departments</div>
            </Card>
          ) : (
            <Typography.Text type="secondary" italic>No approvers assigned yet.</Typography.Text>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {uniqueUsers.map((u, index) => (
              <Card 
                key={index} 
                size="small" 
                style={{ borderLeft: '4px solid #52c41a', borderRadius: '4px' }}
                extra={
                  canEdit ? (
                    <Button 
                      type="text" 
                      danger 
                      icon={<CloseOutlined />} 
                      onClick={() => handleUserToggle({ id: u.userId, first_name: u.name?.split(' ')[0] || '', last_name: u.name?.split(' ').slice(1).join(' ') || '', email: u.email, department: u.department })}
                    >
                      Remove
                    </Button>
                  ) : null
                }
              >
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="Name">{u.name}</Descriptions.Item>
                  <Descriptions.Item label="Email">{u.email}</Descriptions.Item>
                  <Descriptions.Item label="Department">
                    <Tag color="blue">{u.department || 'Other'}</Tag>
                    {(() => {
                      const deptConfig = approvers.find(a => a.department?.trim().toLowerCase() === u.department?.trim().toLowerCase());
                      if (deptConfig) {
                        return <Tag color="purple">Stage {deptConfig.stage || 1}</Tag>;
                      }
                      return null;
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Role">
                    <Tag color={u.role === reviewerRoleSlug ? 'cyan' : 'gold'}>
                      {u.role === reviewerRoleSlug ? 'Reviewer' : 'Approver'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ))}
          </div>
        )}

        {/* Pre-selected Departments and Members Section */}
        {(() => {
          if (!approvers || approvers.length === 0) {
            return (
              <div style={{ marginTop: 24 }}>
                <Typography.Text type="secondary" italic>No required departments configured for this template.</Typography.Text>
              </div>
            );
          }

          return (
            <div id="department-members-section" style={{ marginTop: 24 }}>
              <Divider />
              <Typography.Title level={5} style={{ marginBottom: 16 }}>
                🏢 Pre-selected Department Members
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Choose members from the departments configured in this template. Click the plus button to add them as approvers.
              </Typography.Text>

              {approvers.map((approver, idx) => {
                const deptInfo = Array.isArray(departments) ? departments.find(d => d.name && approver.department && d.name.trim().toLowerCase() === approver.department.trim().toLowerCase()) : null;
                const managerId = deptInfo ? deptInfo.manager : null;
                const deptUsers = users.filter(u => 
                  u.status === 'active' && 
                  (
                    (u.department && approver.department && u.department.trim().toLowerCase() === approver.department.trim().toLowerCase()) || 
                    (managerId && (String(u.id) === String(managerId) || String(u.userId) === String(managerId)))
                  )
                );

                return (
                  <Card 
                    key={`dept-card-${idx}`} 
                    size="small" 
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600' }}>{approver.department} Department</span>
                        <Tag color="blue">Stage {approver.stage || 1}</Tag>
                      </div>
                    }
                    style={{ marginBottom: 16, backgroundColor: '#fbfbfb' }}
                  >
                    {deptUsers.length === 0 ? (
                      <Typography.Text type="secondary" italic>No active members found in this department</Typography.Text>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {deptUsers.map(member => {
                          const selected = isUserSelected(member.id);
                          return (
                            <div 
                              key={member.id} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '8px 12px', 
                                backgroundColor: '#ffffff', 
                                border: '1px solid #f0f0f0', 
                                borderRadius: '6px' 
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: '500' }}>{member.first_name} {member.last_name}</div>
                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{member.email}</div>
                              </div>
                              {canEdit && (
                                <Button
                                  type={selected ? "dashed" : "primary"}
                                  icon={selected ? <CheckOutlined /> : <PlusOutlined />}
                                  danger={selected}
                                  onClick={() => handleUserToggle({ ...member, selectedDepartment: approver.department })}
                                  style={{
                                    borderRadius: '4px'
                                  }}
                                >
                                  {selected ? "Remove" : "Add"}
                                </Button>
                              )}
                              {!canEdit && selected && (
                                <Tag color="green" icon={<CheckOutlined />}>Selected</Tag>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </div>
    </Card>
  );
};

export default TemplateApproversTab;
