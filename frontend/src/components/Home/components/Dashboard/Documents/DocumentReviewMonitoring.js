import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Button, Space, Typography, Row, Col, 
  Empty, Input, Select, message, Tooltip, Popconfirm, Dropdown
} from 'antd';
import {
  EyeOutlined, SyncOutlined, InfoCircleOutlined, 
  UserOutlined, ClockCircleOutlined, FilterOutlined,
  RollbackOutlined, CheckCircleOutlined, CloseCircleOutlined,
  MinusCircleOutlined, MoreOutlined, SendOutlined, EditOutlined,
  ExclamationCircleOutlined, CalendarOutlined, CommentOutlined
} from '@ant-design/icons';
import apiClient from '../../../../../api/apiClient';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../../utils/alerts';
import moment from 'moment';
import { prepareDocumentForPublication } from '../../../../../utils/templateUtils';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const parseDocWorkflow = (d) => {
  let template_approvers = { reviewers: [], approvers: [] };
  try {
    if (d.approvers) {
      const a = typeof d.approvers === 'string' ? JSON.parse(d.approvers) : d.approvers;
      if (a && (a.reviewers || a.approvers)) template_approvers = a;
    }
  } catch (e) {
    /* ignore */
  }
  return {
    ...d,
    id: d.document_id,
    document_id: d.document_id,
    name: d.title,
    template_approvers
  };
};

const DocumentReviewMonitoring = ({ documents, users, user, handlePreviewDocument, onRefresh, handleEditDocument }) => {
  // State for filtering and search
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'created_by_me', 'need_my_approval', 'review', 'approval'
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unsubmittingDocuments, setUnsubmittingDocuments] = useState(new Set());
  const [publishingDocuments, setPublishingDocuments] = useState(new Set());
  const [sendingForApproval, setSendingForApproval] = useState(new Set());
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
    const uid = Number(user.id);
    return data.some((person) => Number(person.userId) === uid);
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

  // Filter documents based on selected filter type and search
  useEffect(() => {
    if (!documents || !user?.id) {
      setFilteredDocuments([]);
      return;
    }

    const normalized = documents.map(parseDocWorkflow);

    let filtered = [];

    switch (filterType) {
      case 'all':
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return ['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status);
        });
        break;
      case 'created_by_me':
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return (
            ['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status) &&
            Number(template.created_by) === Number(user.id)
          );
        });
        break;
      case 'need_my_approval':
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return (
            ['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status) &&
            isUserApprover(template)
          );
        });
        break;
      case 'review':
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return ['pending_review', 'reviewed'].includes(status);
        });
        break;
      case 'approval':
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return ['pending_approval', 'approved'].includes(status);
        });
        break;
      default:
        filtered = normalized.filter((template) => {
          const status = template.status?.toLowerCase();
          return ['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(status);
        });
    }

    if (searchText) {
      filtered = filtered.filter(
        (template) =>
          template.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          template.title?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const dateA = moment(a.updated_at || a.created_at);
      const dateB = moment(b.updated_at || b.created_at);
      return dateB.valueOf() - dateA.valueOf(); // Descending: latest first
    });

    setFilteredDocuments(filtered);
  }, [documents, searchText, filterType, user]);

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

  const handleDocumentWorkflowStatusUpdate = async (documentId, newStatus) => {
    try {
      const response = await apiClient.put(`/api/documents/${documentId}/workflow-status`, {
        status: newStatus
      });

      if (response.status === 200 || response.data?.success) {
        return response.data;
      }
      throw new Error('Failed to update document status');
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  const handleRevertDocument = async (documentId) => {
    setUnsubmittingDocuments((prev) => new Set([...prev, documentId]));

    try {
      await handleDocumentWorkflowStatusUpdate(documentId, 'reviewed');
      message.success('Document successfully reverted to reviewed status');
      handleRefresh();
    } catch (error) {
      console.error('Error reverting document:', error);
      message.error('Failed to revert document. Please try again.');
    } finally {
      setUnsubmittingDocuments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const handleUnsubmitDocument = async (documentId) => {
    setUnsubmittingDocuments((prev) => new Set([...prev, documentId]));

    try {
      await handleDocumentWorkflowStatusUpdate(documentId, 'draft');
      message.success('Document successfully reverted to draft status');
      handleRefresh();
    } catch (error) {
      console.error('Error unsubmitting document:', error);
      message.error('Failed to unsubmit document. Please try again.');
    } finally {
      setUnsubmittingDocuments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  // Handle send for approval
  /* const handleSendForApproval = async (templateId) => {
    setSendingForApproval(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, 'pending_approval');
      message.success('Template sent for approval successfully');
      handleRefresh();
    } catch (error) {
      console.error('Error sending template for approval:', error);
      message.error('Failed to send template for approval. Please try again.');
    } finally {
      setSendingForApproval(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  }; */

  const handlePublishDocument = async (documentId, parentId) => {
    setPublishingDocuments((prev) => new Set([...prev, documentId]));

    try {
      const response = await apiClient.get(`/api/get_document/${documentId}`);
      if (response.data) {
        const docData = response.data;
        const cleaned = prepareDocumentForPublication(docData);
        await apiClient.put(`/api/update_document/${documentId}`, {
          content: cleaned.content,
          elements: cleaned.elements
        });
      }

      await handleDocumentWorkflowStatusUpdate(documentId, 'published');
      if (parentId) await handleDocumentWorkflowStatusUpdate(parentId, 'revised');

      message.success('Document successfully published (comments and highlights removed)');
      handleRefresh();
    } catch (error) {
      console.error('Error publishing document:', error);
      message.error('Failed to publish document. Please try again.');
    } finally {
      setPublishingDocuments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
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
        return(
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
    const status = getTemplateStatus(record);
    const isCreator = Number(user?.id) === Number(record.created_by);
    
    const items = [
      {
        key: 'preview',
        icon: isCreator ? <EditOutlined /> : <EyeOutlined />,
        label: isCreator ? 'Review' : 'Preview',
        onClick: () => handlePreviewDocument(record)
      }
    ];

      // Send for Approval button - enabled only when status is 'reviewed'
      /* items.push({
        key: 'send_approval',
        icon: <SendOutlined />,
        label: 'Send for Approval',
        disabled: status !== 'reviewed',
        onClick: () => {
          if (status === 'reviewed') {
            confirmAlert(
              'Send for Approval',
              'Are you sure you want to send this template for approval?',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleSendForApproval(record.id);
              }
            });
          }
        }
      }); */

      // Publish button - enabled only when status is 'approved' and user is admin
      if (user?.role === 'admin') {
        items.push({
          key: 'publish',
          icon: <CheckCircleOutlined />,
          label: 'Publish',
          disabled: status !== 'approved',
          onClick: (info) => {
            // Ant Design v5 passes { item, key, keyPath } as first param, not event
            if (status === 'approved') {
              confirmAlert(
                'Publish Document',
                'Are you sure you want to publish this document?',
                'Yes, proceed',
                'Cancel'
              ).then((result) => {
                if (result.isConfirmed) {
                  handlePublishDocument(record.document_id || record.id, record.revision_parent_id);
                }
              });
            }
          }
        });
      }

      items.push({
        key: 'revert',
        icon: <RollbackOutlined />,
        label: 'Revert',
        disabled: ['pending_review', 'reviewed'].includes(status),
        onClick: (info) => {
          // Ant Design v5 passes { item, key, keyPath } as first param, not event
          confirmAlert(
            'Revert Document',
            'Are you sure you want to revert this document to Reviewed status?',
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleRevertDocument(record.document_id || record.id);
            }
          });
        }
      });

      items.push({
        key: 'unsubmit',
        icon: <RollbackOutlined />,
        label: 'Unsubmit',
        danger: true,
        onClick: (info) => {
          // Ant Design v5 passes { item, key, keyPath } as first param, not event
          confirmAlert(
            'Unsubmit Document',
            'Are you sure you want to revert this document to draft status?',
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleUnsubmitDocument(record.document_id || record.id);
            }
          });
        }
      });

    return items;
  };

  // Define columns based on screen size
  const getColumns = () => {
    const baseColumns = [
      {
        title: 'Document Name',
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
          const creator = users.find(user => Number(user.id) === Number(created_by));
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
        render: (_, record) => {
          const rid = record.document_id || record.id;
          const isProcessing = unsubmittingDocuments.has(rid) ||
                              publishingDocuments.has(rid) ||
                              sendingForApproval.has(rid);
          
          return (
            <Dropdown
              menu={{ 
                items: getActionItems(record)
              }}
              placement="bottomRight"
              trigger={['click']}
              disabled={isProcessing}
            >
              <Button 
                icon={<MoreOutlined />}
                size="middle"
                type="text"
                loading={isProcessing}
                title="More actions"
              />
            </Dropdown>
          );
        },
      }
    ];
    
    return baseColumns;
  };

  // Get filter label based on current selection
  const getFilterLabel = () => {
    switch (filterType) {
      case 'all':
        return 'All Documents';
      case 'created_by_me':
        return 'My Submissions';
      case 'need_my_approval':
        return 'Need My Approval';
      case 'review':
        return 'Review Phase';
      case 'approval':
        return 'Approval Phase';
      default:
        return 'All Documents';
    }
  };

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
          <Title level={4}>Document Review Monitoring</Title>
          <Paragraph type="secondary">
            Monitor documents through review and approval phases
          </Paragraph>
        </Col>
        
        <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <Space wrap>
            <Select
              value={filterType}
              onChange={handleFilterChange}
              style={{ width: isMobile ? 150 : 180 }}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="all">All</Option>
              <Option value="created_by_me">My Submissions</Option>
              {user?.template_approver === 'yes' && (
                <Option value="need_my_approval">Need my approval</Option>
              )}
              <Option value="review">Review</Option>
              <Option value="approval">Approval</Option>
            </Select>
            <Search
              placeholder="Search documents" 
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
            <Text type="secondary">({filteredDocuments.length} documents)</Text>
          </Space>
        </Col>
      </Row>

      {/* Responsive table */}
      <Table 
        dataSource={filteredDocuments} 
        columns={getColumns()}
        rowKey={(r) => r.document_id || r.id}
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
            <Empty description={`No ${getFilterLabel().toLowerCase()} found`} />
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
                <li><Text>Documents progress through Review → Approval → Published phases</Text></li>
                <li><Text>Edit: Disabled while in pending approval or approved (open in editor when allowed)</Text></li>
                <li><Text>Publish: Enabled only when status is "Approved"</Text></li>
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

export default DocumentReviewMonitoring;