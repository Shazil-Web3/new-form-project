import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Button, Space, Typography, Row, Col, 
  Empty, Input, Select, message, Tooltip, Dropdown
} from 'antd';
import {
  EyeOutlined, SyncOutlined, InfoCircleOutlined, 
  UserOutlined, ClockCircleOutlined, FilterOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  MoreOutlined, CommentOutlined, CalendarOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const PendingReview = ({ templates, users, handlePreviewTemplate, onRefresh, user }) => {
  // State for filtering and search
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'review', 'approval'
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

  // Monitor window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Determine if we're on mobile/tablet or desktop
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  // Get due date status and color
  const getDueDateStatus = (dueDate) => {
    if (!dueDate) return { color: 'default', isOverdue: false, daysLeft: null };
    
    const now = moment();
    const due = moment(dueDate);
    const daysLeft = due.diff(now, 'days');
    
    if (daysLeft < 0) {
      return { color: 'red', isOverdue: true, daysLeft: Math.abs(daysLeft) };
    } else if (daysLeft <= 3) {
      return { color: 'orange', isOverdue: false, daysLeft };
    }
    
    return { color: 'default', isOverdue: false, daysLeft };
  };

  // Get current phase data (reviewers or approvers based on status)
  const getCurrentPhaseData = (template) => {
    if (!template.template_approvers) return { data: [], dueDate: null };
    
    try {
      const approvers = typeof template.template_approvers === 'string' 
        ? JSON.parse(template.template_approvers) 
        : template.template_approvers;
      
      // Handle new JSON structure
      if (approvers.reviewers || approvers.approvers) {
        const status = template.status?.toLowerCase();
        if (status === 'pending_review' || status === 'reviewed') {
          return { 
            data: approvers.reviewers || [], 
            dueDate: approvers.reviewers?.[0]?.dueDate || null 
          };
        } else if (status === 'pending_approval' || status === 'approved') {
          return { 
            data: approvers.approvers || [], 
            dueDate: approvers.approvers?.[0]?.dueDate || null 
          };
        }
      }
      
      // Handle legacy format
      if (Array.isArray(approvers)) {
        return { data: approvers, dueDate: approvers[0]?.dueDate || null };
      }
      
      return { data: [], dueDate: null };
    } catch (error) {
      console.error("Error parsing template approvers:", error);
      return { data: [], dueDate: null };
    }
  };

  // Check if current user is an approver/reviewer for a template
  const isUserApprover = (template) => {
    if (!template.template_approvers || !user?.id) return false;
    
    const { data } = getCurrentPhaseData(template);
    return data.some(person => person.userId === user.id);
  };

  // Check if all assigned people have completed their review/approval
  const hasAllReviewsCompleted = (template) => {
    const { data } = getCurrentPhaseData(template);
    if (!data || data.length === 0) return false;
    
    const status = template.status?.toLowerCase();
    if (status === 'pending_review' || status === 'reviewed') {
      return data.every(reviewer => reviewer.status?.toLowerCase() === 'reviewed');
    } else if (status === 'pending_approval' || status === 'approved') {
      return data.every(approver => approver.status?.toLowerCase() === 'approved');
    }
    
    return false;
  };

  // Auto-update template status based on reviews/approvals
  const getTemplateStatus = (template) => {
    const originalStatus = template.status?.toLowerCase();
    
    if (originalStatus === 'pending_review' && hasAllReviewsCompleted(template)) {
      return 'reviewed';
    } else if (originalStatus === 'pending_approval' && hasAllReviewsCompleted(template)) {
      return 'approved';
    }
    
    return originalStatus;
  };

  // Filter templates based on selected filter type and search
  useEffect(() => {
    if (!templates || !user?.id) {
      setFilteredTemplates([]);
      return;
    }
    
    let filtered = [];
      
    switch (filterType) {
      case 'all':
        filtered = templates.filter(template => {
          const status = template.status?.toLowerCase();
          return (['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status) && 
                  isUserApprover(template));
        });
        break;
      case 'review':
        filtered = templates.filter(template => {
          const status = template.status?.toLowerCase();
          return (['pending_review', 'reviewed'].includes(status) && 
                  isUserApprover(template));
        });
        break;
      case 'approval':
        filtered = templates.filter(template => {
          const status = template.status?.toLowerCase();
          return (['pending_approval', 'approved'].includes(status) && 
                  isUserApprover(template));
        });
        break;
      default:
        filtered = templates.filter(template => {
          const status = template.status?.toLowerCase();
          return (['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status) && 
                  isUserApprover(template));
        });
    }
    
    // Apply search filter if exists
    if (searchText) {
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(searchText.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Sort by latest version/timing (newest updated/created first)
    filtered.sort((a, b) => {
      const dateA = moment(a.updated_at || a.created_at);
      const dateB = moment(b.updated_at || b.created_at);
      return dateB.valueOf() - dateA.valueOf(); // Descending order
    });
      
    setFilteredTemplates(filtered);
  }, [templates, searchText, filterType, user]);

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
  };

  // Handle filter change
  const handleFilterChange = (value) => {
    setFilterType(value);
  };

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    onRefresh?.();
    setTimeout(() => setLoading(false), 500);
  };

  // Get status tag for a template
  const getStatusTag = (template) => {
    const status = getTemplateStatus(template);
    
    switch (status) {
      case 'pending_review':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Review</Tag>;
      case 'reviewed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Reviewed</Tag>;
      case 'pending_approval':
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Approval</Tag>;
      case 'approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  // Get approval status icon
  const getApprovalStatusIcon = (status, comment = null, statusText) => {
    const hasComment = comment && comment.trim();
    
    switch (status?.toLowerCase()) {
      case 'reviewed':
      case 'approved':
        return (
          <Space size={4}>
            <Tooltip title={`Status: ${statusText}`}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
            {hasComment && (
              <Tooltip title={comment}>
                <CommentOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
              </Tooltip>
            )}
          </Space>
        );
      case 'rejected':
        return (
          <Space size={4}>
            <Tooltip title={`Status: ${statusText}`}>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
            {hasComment && (
              <Tooltip title={comment}>
                <CommentOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
              </Tooltip>
            )}
          </Space>
        );
      case 'pending':
      default:
        return (
          <Tooltip title={`Status: ${statusText}`}>
            <ClockCircleOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        );
    }
  };

  // Get dynamic column title based on template status
  const getDynamicColumnTitle = (template) => {
    const status = template.status?.toLowerCase();
    if (status === 'pending_review' || status === 'reviewed') {
      return 'Reviewers';
    } else if (status === 'pending_approval' || status === 'approved') {
      return 'Approvers';
    }
    return 'Approvers/Reviewers';
  };

  // Format template approvers/reviewers with status indicators
  const getTemplateApprovers = (template) => {
    const { data } = getCurrentPhaseData(template);
    
    if (!data || data.length === 0) return '-';
    
    return (
      <Space direction="vertical" size={2}>
        {data.slice(0, 3).map((person, index) => {
          const statusText = person.status?.toLowerCase() === 'reviewed' ? 'Reviewed' 
                          : person.status?.toLowerCase() === 'approved' ? 'Approved'
                          : person.status?.toLowerCase() === 'rejected' ? 'Rejected'
                          : 'Pending';
          
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text>
                {person.name} ({person.department})
              </Text>
              {getApprovalStatusIcon(person.status, person.comment, statusText)}
            </div>
          );
        })}
        {data.length > 3 && (
          <Text type="secondary">
            +{data.length - 3} more
          </Text>
        )}
      </Space>
    );
  };

  // Render due date with color coding
  const renderDueDate = (template) => {
    const { dueDate } = getCurrentPhaseData(template);
    
    if (!dueDate) return '-';
    
    const dueDateStatus = getDueDateStatus(dueDate);
    const formattedDate = moment(dueDate).format('MMM DD, YYYY');
    
    let color = dueDateStatus.color;
    let backgroundColor = '';
    
    if (dueDateStatus.isOverdue) {
      backgroundColor = '#fff2f0';
      color = '#cf1322';
    } else if (dueDateStatus.color === 'orange') {
      backgroundColor = '#fff7e6';
      color = '#d46b08';
    }
    
    const tooltipText = dueDateStatus.isOverdue 
      ? `Overdue by ${dueDateStatus.daysLeft} day${dueDateStatus.daysLeft > 1 ? 's' : ''}`
      : dueDateStatus.daysLeft !== null 
        ? `${dueDateStatus.daysLeft} day${dueDateStatus.daysLeft > 1 ? 's' : ''} left`
        : '';
    
    return (
      <Tooltip title={tooltipText}>
        <div style={{ 
          padding: '2px 6px', 
          borderRadius: '4px', 
          backgroundColor,
          color,
          fontWeight: dueDateStatus.isOverdue || dueDateStatus.color === 'orange' ? 'bold' : 'normal'
        }}>
          <CalendarOutlined style={{ marginRight: 4 }} />
          {formattedDate}
        </div>
      </Tooltip>
    );
  };

  // Get dropdown menu items for actions
  const getActionItems = (record) => {
    const items = [
      {
        key: 'review',
        icon: <EyeOutlined />,
        label: 'Review',
        onClick: () => handlePreviewTemplate(record)
      }
    ];

    return items;
  };

  // Define columns based on screen size
  const getColumns = () => {
    const baseColumns = [
      {
        title: 'Template Name',
        dataIndex: 'name',
        key: 'name',
        width: isMobile ? 150 : 200,
        fixed: isMobile ? 'left' : undefined,
        render: (text, record) => (
          <Space direction="vertical" size={0}>
            <Text strong>{text}</Text>
            {record.description && !isMobile && (
              <Text type="secondary" ellipsis={{ tooltip: record.description }}>
                {record.description.length > (isTablet ? 30 : 40) 
                  ? `${record.description.substring(0, isTablet ? 30 : 40)}...` 
                  : record.description}
              </Text>
            )}
          </Space>
        ),
      },
      {
        title: 'Status',
        key: 'status',
        dataIndex: 'status',
        width: 120,
        render: (status, record) => getStatusTag(record),
      },
      {
        title: 'Due Date',
        key: 'dueDate',
        width: 140,
        render: (_, record) => renderDueDate(record),
      },
      {
        title: 'Created By',
        dataIndex: 'created_by',
        key: 'creator',
        width: 200,
        render: (created_by, record) => {
          const creator = users.find(user => user.id === created_by);
          return (
            <Space>
              <UserOutlined />
              <Text>
                {creator?.first_name} {creator?.last_name}
              </Text>
            </Space>
          );
        },
      },
      {
        title: 'Reviewers/Approvers',
        key: 'templateApprovers',
        render: (_, record) => getTemplateApprovers(record),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: isMobile ? 60 : 80,
        fixed: isMobile ? 'right' : undefined,
        render: (_, record) => (
          <Dropdown
            menu={{ 
              items: getActionItems(record)
            }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Button 
              icon={<MoreOutlined />}
              size="middle"
              type="text"
              title="More actions"
            />
          </Dropdown>
        ),
      }
    ];
    
    return baseColumns;
  };

  // Get filter label based on current selection
  const getFilterLabel = () => {
    switch (filterType) {
      case 'all':
        return 'All Templates';
      case 'review':
        return 'Review Phase';
      case 'approval':
        return 'Approval Phase';
      default:
        return 'All Templates';
    }
  };

  // Show message if no user is provided
  if (!user?.id) {
    return (
      <Card bordered={false}>
        <Empty 
          description="User information not available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card bordered={false}>
      {/* Responsive header */}
      <Row 
        justify="space-between" 
        align={isMobile ? "top" : "middle"} 
        style={{ marginBottom: 16 }}
        gutter={[16, 16]}
      >
        <Col xs={24} md={12}>
          <Title level={4}>My Templates to Review</Title>
          <Paragraph type="secondary">
            Review templates assigned to you for approval
          </Paragraph>
        </Col>
        
        <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space wrap>
            <Select
              value={filterType}
              onChange={handleFilterChange}
              style={{ width: isMobile ? 120 : 150 }}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="all">All</Option>
              <Option value="review">Review</Option>
              <Option value="approval">Approval</Option>
            </Select>
            <Search
              placeholder="Search templates" 
              onSearch={handleSearch}
              style={{ width: isMobile ? '100%' : 200 }}
              allowClear
            />
            <Button 
              icon={<SyncOutlined />} 
              onClick={handleRefresh}
              title="Refresh"
            />
          </Space>
        </Col>
      </Row>

      {/* Filter indicator */}
      <Row style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Space>
            <Text type="secondary">Showing:</Text>
            <Tag color="blue">{getFilterLabel()}</Tag>
            <Text type="secondary">({filteredTemplates.length} templates)</Text>
          </Space>
        </Col>
      </Row>

      {/* Responsive table */}
      <Table 
        dataSource={filteredTemplates} 
        columns={getColumns()}
        rowKey="id"
        pagination={{ 
          pageSize: isMobile ? 5 : isTablet ? 8 : 10,
          size: "small",
          showSizeChanger: !isMobile,
          showQuickJumper: !isMobile
        }}
        loading={loading}
        scroll={{ 
          x: isMobile ? 600 : isTablet ? 900 : 1000,
          y: isMobile ? 400 : undefined
        }}
        size="small"
        locale={{
          emptyText: (
            <Empty description={`No ${getFilterLabel().toLowerCase()} assigned to you for review`} />
          )
        }}
        tableLayout="auto"
      />
      
      {/* Info section - hidden on small screens */}
      {!isMobile && (
        <div style={{ marginTop: 16 }}>
          <Space align="start">
            <InfoCircleOutlined />
            <div>
              <Text strong>Information:</Text>
              <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 0 }}>
                <li><Text>Only templates where you are assigned as a reviewer/approver are shown</Text></li>
                <li><Text>Templates progress through Review → Approval phases</Text></li>
                <li><Text>Use filters to focus on Review or Approval phase templates</Text></li>
                <li><Text>Due dates: <span style={{color: '#d46b08', fontWeight: 'bold'}}>Orange</span> (≤3 days), <span style={{color: '#cf1322', fontWeight: 'bold'}}>Red</span> (overdue)</Text></li>
                <li><Text>Status icons: <CheckCircleOutlined style={{ color: '#52c41a' }} /> Approved/Reviewed, <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Rejected, <ClockCircleOutlined style={{ color: '#faad14' }} /> Pending</Text></li>
                <li><Text>Hover <CommentOutlined style={{ color: '#1890ff' }} /> icon to see rejection comments</Text></li>
              </ul>
            </div>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default PendingReview;