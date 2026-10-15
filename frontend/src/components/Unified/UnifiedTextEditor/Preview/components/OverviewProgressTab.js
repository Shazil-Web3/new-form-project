import React from 'react';
import { Card, Row, Col, Typography, Tag, Space, Divider, Steps, List, Tooltip, Avatar, Empty, Alert } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  HistoryOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckOutlined,
  CommentOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;

const getWorkflowParticipants = (item) => {
  if (!item) return { reviewers: [], approvers: [] };
  const raw = item.template_approvers || item.approvers;
  if (!raw) return { reviewers: [], approvers: [] };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      reviewers: Array.isArray(raw.reviewers) ? raw.reviewers : [],
      approvers: Array.isArray(raw.approvers) ? raw.approvers : []
    };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
          approvers: Array.isArray(parsed.approvers) ? parsed.approvers : []
        };
      }
    } catch (e) {
      /* ignore parse error */
    }
  }
  return { reviewers: [], approvers: [] };
};

const OverviewProgressTab = ({ 
  parsedTemplate, 
  users = [], 
  departments = [], 
  categories = [],
  entityLabel = "Template" 
}) => {
  if (!parsedTemplate) return null;

  const { reviewers, approvers } = getWorkflowParticipants(parsedTemplate);
  const rejectedReviewer = reviewers.find(r => r.status?.toLowerCase() === 'rejected');
  const rejectedApprover = approvers.find(a => a.status?.toLowerCase() === 'rejected');
  const rejectedParticipant = rejectedApprover || rejectedReviewer;
  const hasRejection = !!rejectedParticipant;
  const rawStatus = parsedTemplate.status?.toLowerCase();
  const status = rawStatus || (hasRejection && !['published', 'archived'].includes(rawStatus) ? 'rejected' : 'draft');
  
  // Helper to get status tag
  const getStatusTag = (status) => {
    switch (status) {
      case 'draft':
        return <Tag color="default" icon={<FileTextOutlined />}>Draft</Tag>;
      case 'pending_review':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Pending Review</Tag>;
      case 'reviewed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Reviewed</Tag>;
      case 'pending_approval':
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Pending Approval</Tag>;
      case 'approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>;
      case 'published':
        return <Tag color="cyan" icon={<CheckOutlined />}>Published</Tag>;
      case 'rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>;
      case 'pending_revision':
        return <Tag color="orange" icon={<HistoryOutlined />}>Pending Revision</Tag>;
      default:
        return <Tag color="default">{status?.replace('_', ' ').toUpperCase()}</Tag>;
    }
  };

  // Helper to get approval status icon/tag with action time
  const getParticipantStatus = (status, comment, actionDate, dueDate) => {
    const dueInfo = dueDate ? formatDueDateTime(dueDate) : null;
    switch (status?.toLowerCase()) {
      case 'reviewed':
      case 'approved':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <Space>
              <Tag color="success" icon={<CheckCircleOutlined />}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>
              {comment && (
                <Tooltip title={comment}>
                  <CommentOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              )}
            </Space>
            {actionDate && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                {moment(actionDate).format('hh:mm:ss A')}
              </span>
            )}
          </div>
        );
      case 'rejected':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <Space>
              <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>
              {comment && (
                <Tooltip title={comment}>
                  <CommentOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              )}
            </Space>
          </div>
        );
      case 'pending':
      default:
        return null;
    }
  };

  const formatDueDateTime = (dateVal) => {
    if (!dateVal) return null;
    const m = moment(dateVal);
    if (!m.isValid()) return { dateStr: String(dateVal), timeStr: '' };
    const isMidnight = (m.hours() === 0 && m.minutes() === 0 && m.seconds() === 0);
    const hasExplicitTime = !isMidnight && (typeof dateVal === 'string'
      ? (dateVal.includes('T') && !dateVal.endsWith('T00:00:00.000Z') && !dateVal.endsWith('T00:00:00') && !dateVal.includes('T00:00:00')) || 
        (dateVal.includes(':') && !dateVal.endsWith('00:00:00') && !dateVal.includes(' 00:00') && !dateVal.includes('12:00:00 AM') && !dateVal.includes('12:00 AM'))
      : true);
    const dateStr = m.format('MMM DD, YYYY');
    const timeStr = hasExplicitTime ? m.format('hh:mm:ss A') : '';
    return { dateStr, timeStr };
  };

  const author = users.find(u => String(u.id) === String(parsedTemplate.created_by));

  // Helper to get overall phase status
  const getPhaseStatus = (items, phaseType) => {
    if (!items || items.length === 0) return 'pending';
    
    const hasRejected = items.some(item => item.status?.toLowerCase() === 'rejected');
    if (hasRejected) return 'rejected';

    const allCompleted = items.every(item => 
      ['reviewed', 'approved'].includes(item.status?.toLowerCase())
    );
    
    if (allCompleted) return 'completed';

    const someStarted = items.some(item => 
      ['reviewed', 'approved'].includes(item.status?.toLowerCase())
    );

    // Contextual status based on document state
    if (phaseType === 'review') {
      if (status === 'reviewed' || status === 'pending_approval' || status === 'approved' || status === 'published') return 'completed';
      if (status === 'pending_review' || someStarted) return 'in_progress';
    } else if (phaseType === 'approval') {
      if (status === 'approved' || status === 'published') return 'completed';
      if (status === 'pending_approval' || someStarted) return 'in_progress';
    }

    return 'pending';
  };

  const renderPhaseStatusTag = (items, phaseType) => {
    const phaseStatus = getPhaseStatus(items, phaseType);
    
    switch (phaseStatus) {
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Completed</Tag>;
      case 'rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>;
      case 'in_progress':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>In Progress</Tag>;
      default:
        return <Tag color="default">Pending</Tag>;
    }
  };

  // Workflow Stages for Steps component
  const getWorkflowSteps = () => {
    const steps = [
      { title: 'Draft', status: 'finish' },
      { title: 'Review', status: 'wait' },
      { title: 'Approval', status: 'wait' },
      { title: 'Finalized', status: 'wait' }
    ];

    if (status === 'draft' || status === 'pending_revision') {
      steps[0].status = 'process';
    } else if (status === 'pending_review' || status === 'reviewed') {
      steps[0].status = 'finish';
      steps[1].status = status === 'pending_review' ? 'process' : 'finish';
    } else if (status === 'pending_approval' || status === 'approved') {
      steps[0].status = 'finish';
      steps[1].status = 'finish';
      steps[2].status = status === 'pending_approval' ? 'process' : 'finish';
    } else if (status === 'published') {
      steps[0].status = 'finish';
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'finish';
    } else if (status === 'rejected') {
      steps[0].status = 'finish';
      // Determine where it was rejected
      if (reviewers.some(r => r.status === 'rejected')) {
        steps[1].status = 'error';
      } else {
        steps[1].status = 'finish';
        steps[2].status = 'error';
      }
    }

    return steps;
  };

  return (
    <div style={{ padding: '4px' }}>
      <Row gutter={[24, 24]}>
        {/* Summary Card */}
        <Col span={24}>
          <Card bordered={false} className="workflow-summary-card">
            <Row align="middle" gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Space direction="vertical" size={4}>
                  <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Status</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Title level={3} style={{ margin: 0 }}>{getStatusTag(status)}</Title>
                  </div>
                </Space>
              </Col>
              <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                <Space size="large">
                  <div>
                    <Text type="secondary" block>Submission Date</Text>
                    <Text strong>{parsedTemplate.created_at ? moment(parsedTemplate.created_at).format('MMM DD, YYYY') : 'N/A'}</Text>
                    {parsedTemplate.created_at && (
                      <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>
                        {moment(parsedTemplate.created_at).format('hh:mm:ss A')}
                      </Text>
                    )}
                  </div>
                  <div>
                    <Text type="secondary" block>Last Updated</Text>
                    <Text strong>{parsedTemplate.updated_at ? moment(parsedTemplate.updated_at).format('MMM DD, YYYY') : 'N/A'}</Text>
                    {parsedTemplate.updated_at && (
                      <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>
                        {moment(parsedTemplate.updated_at).format('hh:mm:ss A')}
                      </Text>
                    )}
                  </div>
                </Space>
              </Col>
            </Row>
            
            <Divider style={{ margin: '20px 0' }} />
            
            <div style={{ padding: '0 20px' }}>
              <Steps 
                size="small" 
                current={
                  status === 'draft' || status === 'pending_revision' ? 0 :
                  status === 'pending_review' || status === 'reviewed' ? 1 :
                  status === 'pending_approval' || status === 'approved' ? 2 :
                  status === 'published' ? 3 : 1
                }
                items={getWorkflowSteps()}
              />
            </div>

            {(parsedTemplate.document_number || parsedTemplate.project_number || parsedTemplate.cost_center_number) && (
              <div style={{ marginTop: 20, padding: '12px 18px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                {parsedTemplate.document_number && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', fontWeight: 600 }}>Document Number</Text>
                    <Text strong style={{ fontSize: '14px', fontFamily: 'monospace', color: '#1d4ed8' }}>{parsedTemplate.document_number}</Text>
                  </div>
                )}
                {parsedTemplate.project_number && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', fontWeight: 600 }}>Project Number</Text>
                    <Text strong style={{ fontSize: '14px', fontFamily: 'monospace', color: '#0f766e' }}>{parsedTemplate.project_number}</Text>
                  </div>
                )}
                {parsedTemplate.cost_center_number && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', fontWeight: 600 }}>Cost Center</Text>
                    <Text strong style={{ fontSize: '14px', fontFamily: 'monospace', color: '#7c3aed' }}>{parsedTemplate.cost_center_number}</Text>
                  </div>
                )}
                {parsedTemplate.department && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', fontWeight: 600 }}>Department</Text>
                    <Tag color="blue" style={{ fontWeight: 600, marginTop: 2 }}>{parsedTemplate.department}</Tag>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* Details Section */}
        <Col xs={24} lg={8}>
          <Card title={<Space><UserOutlined /> Author Information</Space>} bordered={false} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Avatar size={64} icon={<UserOutlined />} src={author?.avatar} style={{ marginRight: 16, backgroundColor: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{author ? `${author.first_name} ${author.last_name}` : 'Unknown Author'}</Title>
                <Text type="secondary">{author?.email || 'No email available'}</Text>
                <br />
                <Tag color="blue" style={{ marginTop: 4 }}>{author?.role || 'User'}</Tag>
              </div>
            </div>
            <Divider />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Department:</Text>
                <Text strong>{author?.department || 'Not specified'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Entity Type:</Text>
                <Text strong>{entityLabel}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Category:</Text>
                <Text strong>
                  {categories.find(c => c.category_id === parsedTemplate.category_id)?.category_name || 
                   parsedTemplate.category_id || 'Not specified'}
                </Text>
              </div>
              {parsedTemplate.document_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Doc Number:</Text>
                  <Text strong style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{parsedTemplate.document_number}</Text>
                </div>
              )}
              {parsedTemplate.project_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Project No:</Text>
                  <Text strong style={{ fontFamily: 'monospace', color: '#0f766e' }}>{parsedTemplate.project_number}</Text>
                </div>
              )}
              {parsedTemplate.cost_center_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Cost Center:</Text>
                  <Text strong style={{ fontFamily: 'monospace', color: '#7c3aed' }}>{parsedTemplate.cost_center_number}</Text>
                </div>
              )}
              {parsedTemplate.created_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text type="secondary">Created:</Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong>{moment(parsedTemplate.created_at).format('MMM DD, YYYY')}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>
                      {moment(parsedTemplate.created_at).format('hh:mm:ss A')}
                    </Text>
                  </div>
                </div>
              )}
              {parsedTemplate.updated_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text type="secondary">Last Updated:</Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong>{moment(parsedTemplate.updated_at).format('MMM DD, YYYY')}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>
                      {moment(parsedTemplate.updated_at).format('hh:mm:ss A')}
                    </Text>
                  </div>
                </div>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[24, 24]}>
            {/* Reviewers Progress */}
            <Col span={24}>
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space><TeamOutlined /> Review Participants</Space>
                    {renderPhaseStatusTag(reviewers, 'review')}
                  </div>
                } 
                bordered={false}
              >
                {reviewers.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={reviewers}
                    renderItem={(item) => {
                      const dueInfo = formatDueDateTime(item.dueDate);
                      const actionDate = item.reviewedAt || item.reviewed_at || item.rejectedAt || item.rejected_at || item.actionDate || item.date || item.timestamp;
                      const assignedDate = item.assignedAt || item.assigned_at || item.createdAt || item.created_at || parsedTemplate.updated_at || parsedTemplate.created_at;
                      return (
                        <List.Item
                          extra={getParticipantStatus(item.status, item.comment, actionDate, item.dueDate)}
                        >
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={<span style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</span>}
                            description={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                                <Space split={<Divider type="vertical" />} wrap>
                                  {item.department && <Text type="secondary">{item.department}</Text>}
                                  {dueInfo && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                      <CalendarOutlined style={{ color: '#0284c7' }} />
                                      <Text type="secondary">Due: {dueInfo.dateStr}</Text>
                                      {dueInfo.timeStr && (
                                        <>
                                          <span style={{ color: '#cbd5e1' }}>•</span>
                                          <ClockCircleOutlined style={{ color: '#0284c7' }} />
                                          <Text type="secondary" style={{ fontWeight: 500 }}>
                                            Time: {dueInfo.timeStr}
                                          </Text>
                                        </>
                                      )}
                                    </span>
                                  )}
                                </Space>

                                {assignedDate && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                                    <ClockCircleOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
                                    <span>Assigned: {moment(assignedDate).format('MMM DD, YYYY')}</span>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span>Time: {moment(assignedDate).format('hh:mm:ss A')}</span>
                                  </div>
                                )}

                                {actionDate && ['reviewed', 'rejected'].includes(item.status?.toLowerCase()) && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: item.status?.toLowerCase() === 'rejected' ? '#dc2626' : '#16a34a' }}>
                                    {item.status?.toLowerCase() === 'rejected' ? (
                                      <CloseCircleOutlined style={{ fontSize: '11px' }} />
                                    ) : (
                                      <CheckCircleOutlined style={{ fontSize: '11px' }} />
                                    )}
                                    <span style={{ fontWeight: 600 }}>
                                      {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}: {moment(actionDate).format('MMM DD, YYYY')}
                                    </span>
                                    {item.status?.toLowerCase() !== 'rejected' && (
                                      <>
                                        <span>•</span>
                                        <span style={{ fontWeight: 600 }}>
                                          Time: {moment(actionDate).format('hh:mm:ss A')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {item.comment && (
                                  <div style={{
                                    fontSize: '12px',
                                    color: item.status?.toLowerCase() === 'rejected' ? '#b91c1c' : '#475569',
                                    backgroundColor: item.status?.toLowerCase() === 'rejected' ? '#fef2f2' : '#f8fafc',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    borderLeft: `3px solid ${item.status?.toLowerCase() === 'rejected' ? '#ef4444' : '#94a3b8'}`,
                                    marginTop: '4px'
                                  }}>
                                    <strong>{item.status?.toLowerCase() === 'rejected' ? 'Reason: ' : 'Comment: '}</strong>
                                    "{item.comment}"
                                  </div>
                                )}
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Empty description="No reviewers assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            {/* Approvers Progress */}
            <Col span={24}>
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space><CheckCircleOutlined /> Approval Participants</Space>
                    {renderPhaseStatusTag(approvers, 'approval')}
                  </div>
                } 
                bordered={false}
              >
                {approvers.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={approvers}
                    renderItem={(item) => {
                      const dueInfo = formatDueDateTime(item.dueDate);
                      const actionDate = item.approvedAt || item.approved_at || item.rejectedAt || item.rejected_at || item.actionDate || item.date || item.timestamp;
                      const assignedDate = item.assignedAt || item.assigned_at || item.createdAt || item.created_at || parsedTemplate.updated_at || parsedTemplate.created_at;
                      return (
                        <List.Item
                          extra={getParticipantStatus(item.status, item.comment, actionDate, item.dueDate)}
                        >
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={<span style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</span>}
                            description={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                                <Space split={<Divider type="vertical" />} wrap>
                                  {item.department && <Text type="secondary">{item.department}</Text>}
                                  {dueInfo && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                      <CalendarOutlined style={{ color: '#0284c7' }} />
                                      <Text type="secondary">Due: {dueInfo.dateStr}</Text>
                                      {dueInfo.timeStr && (
                                        <>
                                          <span style={{ color: '#cbd5e1' }}>•</span>
                                          <ClockCircleOutlined style={{ color: '#0284c7' }} />
                                          <Text type="secondary" style={{ fontWeight: 500 }}>
                                            Time: {dueInfo.timeStr}
                                          </Text>
                                        </>
                                      )}
                                    </span>
                                  )}
                                </Space>

                                {assignedDate && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                                    <ClockCircleOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
                                    <span>Assigned: {moment(assignedDate).format('MMM DD, YYYY')}</span>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span>Time: {moment(assignedDate).format('hh:mm:ss A')}</span>
                                  </div>
                                )}

                                {actionDate && ['approved', 'rejected'].includes(item.status?.toLowerCase()) && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: item.status?.toLowerCase() === 'rejected' ? '#dc2626' : '#16a34a' }}>
                                    {item.status?.toLowerCase() === 'rejected' ? (
                                      <CloseCircleOutlined style={{ fontSize: '11px' }} />
                                    ) : (
                                      <CheckCircleOutlined style={{ fontSize: '11px' }} />
                                    )}
                                    <span style={{ fontWeight: 600 }}>
                                      {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}: {moment(actionDate).format('MMM DD, YYYY')}
                                    </span>
                                    {item.status?.toLowerCase() !== 'rejected' && (
                                      <>
                                        <span>•</span>
                                        <span style={{ fontWeight: 600 }}>
                                          Time: {moment(actionDate).format('hh:mm:ss A')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {item.comment && (
                                  <div style={{
                                    fontSize: '12px',
                                    color: item.status?.toLowerCase() === 'rejected' ? '#b91c1c' : '#475569',
                                    backgroundColor: item.status?.toLowerCase() === 'rejected' ? '#fef2f2' : '#f8fafc',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    borderLeft: `3px solid ${item.status?.toLowerCase() === 'rejected' ? '#ef4444' : '#94a3b8'}`,
                                    marginTop: '4px'
                                  }}>
                                    <strong>{item.status?.toLowerCase() === 'rejected' ? 'Reason: ' : 'Comment: '}</strong>
                                    "{item.comment}"
                                  </div>
                                )}
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Empty description="No approvers assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default OverviewProgressTab;
