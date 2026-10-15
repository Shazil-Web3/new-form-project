import React from 'react';
import {
  Modal,
  Button,
  Card,
  Row,
  Col,
  Select,
  Tag,
  Typography,
  Alert,
  DatePicker,
  Radio,
  Table,
  Empty
} from 'antd';
import moment from 'moment';

const { Text } = Typography;
const { Option } = Select;

/**
 * Shared Template Approvers Modal used by EditTemplate and ReviseTemplate.
 * All props are passed through from the parent component — no internal state duplication.
 */
const TemplateApproversModal = ({
  visible,
  onCancel,
  approverType,
  setApproverType,
  templateApprovers,
  selectedTemplateApprover,
  handleAddTemplateApprover,
  handleRemoveTemplateApprover,
  sharedDueDate,
  setSharedDueDate,
  users,
  onSubmit,
  submitDisabled
}) => {
  return (
    <Modal
      title={`Select Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          Close
        </Button>,
        <Button 
          key="submit" 
          type="primary"
          onClick={onSubmit}
          disabled={submitDisabled}
        >
          Submit for {approverType === 'review' ? 'Review' : 'Approval'}
        </Button>
      ]}
      width={800}
    >
      <Row gutter={[16, 16]}>
        {/* Approver Type Selection */}
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
                  ? "Reviewers will provide feedback and recommendations on the template"
                  : "Approvers will make the final decision to approve or reject the template"
              }
              type="info"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        {/* Due Date Selection */}
        <Col span={24}>
          <Card title="Due Date" size="small">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select due date"
              value={sharedDueDate}
              onChange={setSharedDueDate}
              popupStyle={{ zIndex: 10050 }}
              disabledDate={(current) => current && current < moment().startOf('day')}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              This due date will apply to all selected {approverType === 'review' ? 'reviewers' : 'approvers'}
            </Text>
          </Card>
        </Col>

        <Col span={24}>
          <Card title={`Add Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
            <Select
              style={{ width: '100%' }}
              dropdownStyle={{ zIndex: 10050 }}
              placeholder="Select users by email"
              value={selectedTemplateApprover}
              onChange={handleAddTemplateApprover}
              optionLabelProp="label"
              showSearch
              filterOption={(input, option) => 
                option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {(users || [])
                .filter(user => {
                  const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
                  const alreadyAdded = currentArray.some(approver => String(approver.userId || approver.id) === String(user.id || user.userId));
                  if (alreadyAdded) return false;
                  if (approverType === 'review') {
                    return user.status !== 'inactive';
                  } else {
                    const isApprover = user.template_approver === 'yes' || user.role === 'admin' || user.role === 'approver' || user.role === 'superadmin';
                    const hasDesignated = users.some(u => u.template_approver === 'yes' || u.role === 'approver');
                    return hasDesignated ? isApprover : user.status !== 'inactive';
                  }
                })
                .map(user => (
                  <Option 
                    key={user.id || user.userId} 
                    value={user.id || user.userId}
                    label={user.email}
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
          <Card title={`Selected Template ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
            {(() => {
              const currentArray = (approverType === 'review' ? templateApprovers?.reviewers : templateApprovers?.approvers) || [];
              return currentArray.length > 0 ? (
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
                        <Tag color={role === 'template_reviewer' ? 'blue' : 'green'}>
                          {role === 'template_reviewer' ? 'Reviewer' : 'Approver'}
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
                <Empty description={`No template ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
              );
            })()}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default TemplateApproversModal;
