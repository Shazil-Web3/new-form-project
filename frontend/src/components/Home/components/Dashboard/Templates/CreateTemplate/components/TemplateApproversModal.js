import React from 'react';
import { Modal, Row, Col, Card, Radio, Alert, DatePicker, Typography, Select, Table, Button, Empty, Tag, Tooltip } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Text } = Typography;
const { Option } = Select;

const TemplateApproversModal = ({ 
  visible, 
  onCancel, 
  approverType, 
  setApproverType, 
  sharedDueDate, 
  setSharedDueDate, 
  templateApprovers, 
  users, 
  handleAddTemplateApprover, 
  handleRemoveTemplateApprover, 
  onSubmit,
  entityLabel = 'Template',
  reviewerRoleSlug = 'template_reviewer',
  approverRoleSlug = 'template_approver'
}) => {

  const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
  const entity = entityLabel || 'Template';

  return (
    <Modal
      title={`Select ${entity} ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          Close
        </Button>,
        <Tooltip
          key="submit-tooltip"
          title={
            !sharedDueDate && currentArray.length === 0
              ? `Please select a due date and add at least one ${approverType === 'review' ? 'reviewer' : 'approver'}`
              : !sharedDueDate
              ? 'Please select a due date to enable submission'
              : currentArray.length === 0
              ? `Please add at least one ${approverType === 'review' ? 'reviewer' : 'approver'}`
              : ''
          }
        >
          <span>
            <Button 
              key="submit" 
              type="primary"
              onClick={onSubmit}
              disabled={
                currentArray.length === 0 || !sharedDueDate
              }
            >
              Submit for {approverType === 'review' ? 'Review' : 'Approval'}
            </Button>
          </span>
        </Tooltip>
      ]}
      width={800}
    >      
      <Row gutter={[16, 16]}>
       
        <Col span={24}>
          <Card title="Submission Type" size="small">
            <Radio.Group 
              value={approverType} 
              onChange={(e) => setApproverType(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio value="review">Submit for Review</Radio>
              <Radio value="approval">Submit for Approval</Radio>
            </Radio.Group>
            <Alert
              message={
                approverType === 'review' 
                  ? `Reviewers will provide feedback and recommendations on the ${entity.toLowerCase()}`
                  : `Approvers will make the final decision to approve or reject the ${entity.toLowerCase()}`
              }
              type="info"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
    
        <Col span={24}>
          <Card 
            title={
              <span>
                Due Date <span style={{ color: '#ff4d4f' }}>*</span>
              </span>
            } 
            size="small"
            style={{
              borderColor: !sharedDueDate ? '#ffccc7' : undefined,
              transition: 'border-color 0.3s'
            }}
          >
            <DatePicker
              style={{
                width: '100%',
                borderColor: !sharedDueDate ? '#ff4d4f' : undefined,
                backgroundColor: !sharedDueDate ? '#fff2f0' : undefined,
                boxShadow: !sharedDueDate ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : undefined,
                transition: 'all 0.3s'
              }}
              status={!sharedDueDate ? 'error' : undefined}
              placeholder="Select due date"
              format="YYYY-MM-DD"
              value={sharedDueDate}
              onChange={setSharedDueDate}
              popupStyle={{ zIndex: 10050 }}
              disabledDate={(current) => current && current < moment().startOf('day')}
            />
            {!sharedDueDate ? (
              <div 
                style={{ 
                  color: '#cf1322', 
                  fontSize: '12px', 
                  marginTop: 6, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  fontWeight: 500 
                }}
              >
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                <span>Please select a due date to enable {approverType === 'review' ? 'review' : 'approval'} submission.</span>
              </div>
            ) : (
              <div 
                style={{ 
                  color: '#389e0d', 
                  fontSize: '12px', 
                  marginTop: 6, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6 
                }}
              >
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>This due date will apply to all selected {approverType === 'review' ? 'reviewers' : 'approvers'}.</span>
              </div>
            )}
          </Card>
        </Col>
        
        <Col span={24}>
          <Card title={`Add ${entity} ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
            <Select
              style={{ width: '100%' }}
              dropdownStyle={{ zIndex: 10050 }}
              placeholder="Select users by email"
              value={null}
              onChange={handleAddTemplateApprover}
              optionLabelProp="label"
              showSearch
              filterOption={(input, option) => 
                (option?.label || '').toLowerCase().indexOf((input || '').toLowerCase()) >= 0 ||
                (option?.name || '').toLowerCase().indexOf((input || '').toLowerCase()) >= 0
              }
            >
              {(users || [])
                .filter(user => {
                  const alreadyAdded = currentArray.some(approver => String(approver.userId || approver.id) === String(user.id || user.userId));
                  if (alreadyAdded) return false;
                  
                  if (approverType === 'review') {
                    return user.status !== 'inactive';
                  } else {
                    const isApprover = user.template_approver === 'yes' || 
                                       user.role === 'admin' || 
                                       user.role === 'approver' || 
                                       user.role === 'superadmin';
                    const hasDesignatedApprovers = users.some(u => u.template_approver === 'yes' || u.role === 'approver');
                    return hasDesignatedApprovers ? isApprover : user.status !== 'inactive';
                  }
                })
                .map(user => (
                  <Option 
                    key={user.id || user.userId} 
                    value={user.id || user.userId}
                    label={user.email}
                    name={`${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim()}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{user.email}</div>
                      <div style={{ fontSize: 'smaller', color: '#666' }}>
                        {user.first_name || user.firstName || ''} {user.last_name || user.lastName || ''}
                        {user.role ? ` (${user.role})` : ''}
                      </div>
                      {user.department && (
                        <div style={{ fontSize: 'smaller', color: '#888' }}>
                          Department: {user.department}
                        </div>
                      )}
                    </div>
                  </Option>
                ))
              }
            </Select>
          </Card>
        </Col>
        
        <Col span={24}>
          <Card 
            title={
              <span>
                Selected {entity} {approverType === 'review' ? 'Reviewers' : 'Approvers'} <span style={{ color: '#ff4d4f' }}>*</span>
              </span>
            } 
            size="small"
            style={{
              borderColor: currentArray.length === 0 ? '#ffccc7' : undefined,
              transition: 'border-color 0.3s'
            }}
          >
            {currentArray.length > 0 ? (
              <Table
                dataSource={currentArray}
                rowKey="userId"
                pagination={false}
                columns={[
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                  },
                  {
                    title: 'Email',
                    dataIndex: 'email',
                    key: 'email',
                  },
                  {
                    title: 'Department',
                    dataIndex: 'department',
                    key: 'department',
                  },
                  {
                    title: 'Role',
                    dataIndex: 'role',
                    key: 'role',
                    render: (role) => (
                      <Tag color={role === reviewerRoleSlug ? 'blue' : 'green'}>
                        {role === reviewerRoleSlug ? 'Reviewer' : 'Approver'}
                      </Tag>
                    )
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    render: (_, record) => (
                      <Button 
                        type="link" 
                        danger 
                        onClick={() => handleRemoveTemplateApprover(record.userId)}
                      >
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Empty description={`No ${entity.toLowerCase()} ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500 }}>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  <span>Please add at least one {approverType === 'review' ? 'reviewer' : 'approver'} from the dropdown above.</span>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default TemplateApproversModal;
