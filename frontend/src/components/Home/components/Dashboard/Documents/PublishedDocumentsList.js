import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../../utils/alerts';
import { sanitizeHtml } from '../../../../../utils/sanitizeHtml';
import { 
  Card, 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Empty, 
  Radio, 
  Space, 
  Tooltip, 
  Divider,
  Badge,
  Skeleton,
  Modal,
  message,
  Tabs,
  Descriptions,
  Table,
  Spin,
  Alert,
  Dropdown
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  EditOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  LockOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarsOutlined,
  MoreOutlined,
  EllipsisOutlined,
  InboxOutlined,
  CalendarOutlined,
  BranchesOutlined,
  HistoryOutlined,
  StopOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  FileSearchOutlined,
  TeamOutlined
} from '@ant-design/icons';
import TemplateImpactTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateImpactTab';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const PublishedDocumentsList = ({ 
  user, 
  navigate, 
  fetchUserData, 
  documents, 
  users, 
  handleReviseDocument,
  handlePreviewDocument,
  handleUseDocument,
  handleOpenDocumentPreviewModal
}) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [orgDocuments, setOrgDocuments] = useState([]);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [archivingDocuments, setArchivingDocuments] = useState(new Set());
  const [statusChangingDocuments, setStatusChangingDocuments] = useState(new Set());

  // Status display helper function
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'published':
        return { color: 'success', icon: <FileOutlined />, text: 'Published' };
      case 'pending_revision':
        return { color: 'warning', icon: <EditOutlined />, text: 'Revision' };
      case 'disabled':
        return { color: 'error', icon: <StopOutlined />, text: 'Disabled' };
      default:
        return { color: 'default', icon: <FileOutlined />, text: status || 'Unknown' };
    }
  };

  // Filter documents on mount
  useEffect(() => {
    try {
      setLoading(true);
      if (documents && documents.length > 0) {
        const orgDocs = documents.filter(d => 
          ['published', 'pending_revision', 'disabled'].includes(d.status)
        );
        setOrgDocuments(orgDocs);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [documents, user]);

  // API Functions
  const handleDocumentStatusUpdate = async (documentId, newStatus) => {
    try {
      const response = await axios.put(`/api/documents/${documentId}/status`, {
        status: newStatus
      });
      
      if (response.status === 200) {
        return response.data;
      }
      throw new Error('Failed to update document status');
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  // Document Status Management Functions
  const handleArchiveDocument = async (documentId) => {
    setArchivingDocuments(prev => new Set([...prev, documentId]));
    
    try {
      await handleDocumentStatusUpdate(documentId, 'archived');
      message.success('Document successfully archived');
      fetchUserData();
    } catch (error) {
      console.error('Error archiving document:', error);
      message.error('Failed to archive document. Please try again.');
    } finally {
      setArchivingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const handleToggleDocumentStatus = async (documentId, currentStatus) => {
    const newStatus = currentStatus === 'published' ? 'disabled' : 'published';
    const actionText = newStatus === 'disabled' ? 'disable' : 'enable';
    
    setStatusChangingDocuments(prev => new Set([...prev, documentId]));
    
    try {
      await handleDocumentStatusUpdate(documentId, newStatus);
      message.success(`Document successfully ${actionText}d`);
      fetchUserData();
    } catch (error) {
      console.error(`Error ${actionText}ing document:`, error);
      message.error(`Failed to ${actionText} document. Please try again.`);
    } finally {
      setStatusChangingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const formatDocumentData = (doc) => {
    return {
      id: doc.document_id,
      title: doc.title || 'Untitled Document',
      description: doc.description || "No description available",
      content: doc.content,
      status: doc.status,
      version: doc.version || 1,
      document_number: doc.document_number || null,
      project_number: doc.project_number || null,
      cost_center_number: doc.cost_center_number || null,
      createdAt: new Date(doc.created_at).toLocaleDateString(),
      updatedAt: new Date(doc.updated_at).toLocaleDateString(),
      isDisabled: doc.status === 'disabled'
    };
  };

  const getDocumentIcon = (doc) => {
    const docTitle = doc.title || "";
    if (docTitle.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (docTitle.toLowerCase().includes('proposal')) {
      return <FilePdfOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  // Document Action Handlers
  const handlePreviewDoc = (doc) => {
    if (handlePreviewDocument) {
      handlePreviewDocument(doc);
    } else {
      setSelectedDocument(doc);
      setPreviewModalVisible(true);
    }
  };

  // Document Actions Menu Generation (three-dot menu - same as Templates.js)
  const getDocumentBlockActions = (doc) => {
    const isArchiving = archivingDocuments.has(doc.document_id);
    const isChangingStatus = statusChangingDocuments.has(doc.document_id);
    const formattedDoc = formatDocumentData(doc);
    
    const menuItems = [
      {
        key: 'preview',
        icon: <EyeOutlined />,
        label: 'Preview',
        onClick: () => handlePreviewDoc(doc)
      }
    ];

    if (user?.role === 'admin') {
      // Add status toggle button
      const statusAction = {
        key: 'toggle-status',
        icon: formattedDoc.status === 'published' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
        label: isChangingStatus 
          ? (formattedDoc.status === 'published' ? 'Disabling...' : 'Enabling...')
          : (formattedDoc.status === 'published' ? 'Disable Document' : 'Enable Document'),
        disabled: isChangingStatus || doc.status === 'pending_revision',
        onClick: () => {
          const actionText = formattedDoc.status === 'published' ? 'disable' : 'enable';
          confirmAlert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Document`,
            `Are you sure you want to ${actionText} this document?`,
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleToggleDocumentStatus(doc.document_id, formattedDoc.status);
            }
          });
        }
      };

      menuItems.push(
        statusAction,
        {
          key: 'revise',
          icon: <HistoryOutlined />,
          label: 'Revise',
          disabled: isArchiving || formattedDoc.isDisabled || doc.status === 'pending_revision',
          onClick: () => {
            confirmAlert(
              'Revise Document',
              'Are you sure you want to revise this document? The old version will be moved to old documents after the revision is published.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleReviseDocument(doc);
              }
            });
          }
        },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: isArchiving ? 'Archiving...' : 'Archive',
          disabled: isArchiving,
          onClick: () => {
            confirmAlert(
              'Archive Document',
              'Are you sure you want to archive this document? It will be moved to archived status.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleArchiveDocument(doc.document_id);
              }
            });
          }
        }
      );
    }

    return menuItems;
  };

  // Document Item Renderer (blocks view - same as Templates.js renderTemplateItem)
  const renderDocumentItem = (doc) => {
    const formattedDoc = formatDocumentData(doc);
    const statusDisplay = getStatusDisplay(formattedDoc.status);
    
    return (
      <List.Item key={doc.document_id}>
        <Card 
          hoverable={!formattedDoc.isDisabled} 
          className={`template-card ${formattedDoc.isDisabled ? 'disabled-template' : ''}`}
          style={{ 
            height: '320px',
            width: '100%',
            display: 'flex', 
            flexDirection: 'column',
            borderLeft: formattedDoc.isDisabled 
              ? '4px solid #ff4d4f' 
              : '4px solid #52c41a',
            opacity: formattedDoc.isDisabled ? 0.7 : 1
          }}
          bodyStyle={{ 
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12 }}>
            <Badge 
              count={`v${formattedDoc.version || '1'}`} 
              style={{ 
                backgroundColor: '#52c41a',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                minWidth: '28px'
              }}
            >
              <Avatar 
                icon={getDocumentIcon(doc)} 
                size={48}
                style={{ 
                  backgroundColor: formattedDoc.isDisabled ? '#f5f5f5' : '#f0f2f5', 
                  color: formattedDoc.isDisabled ? '#bfbfbf' : '#1890ff'
                }} 
              />
            </Badge>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <Tooltip title={formattedDoc.title}>
                <Title 
                  level={5} 
                  ellipsis={{ rows: 2 }} 
                  style={{ 
                    marginBottom: 4,
                    fontSize: '14px',
                    lineHeight: '1.3',
                    color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit'
                  }}
                >
                  {formattedDoc.title}
                </Title>
              </Tooltip>
            </div>
            <Dropdown
              menu={{ items: getDocumentBlockActions(doc) }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button type="text" icon={<EllipsisOutlined />} />
            </Dropdown>
          </div>
          
          <div style={{ flex: 1, marginBottom: 12 }}>
            <Paragraph 
              ellipsis={{ rows: 2 }} 
              type="secondary"
              style={{ 
                fontSize: '12px', 
                marginBottom: 8,
                color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit'
              }}
            >
              {formattedDoc.description}
            </Paragraph>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <Space wrap size={[4, 4]}>
              {formattedDoc.document_number && (
                <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {formattedDoc.document_number}
                </Tag>
              )}
              <Tag color={statusDisplay.color} size="small">
                {statusDisplay.icon} {statusDisplay.text}
              </Tag>
            </Space>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px' }}>
                <Text 
                  type="secondary" 
                  style={{ 
                    display: 'block',
                    color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit'
                  }}
                >
                  <CalendarOutlined /> Updated: {formattedDoc.updatedAt}
                </Text>
                <Text 
                  type="secondary"
                  style={{ 
                    color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit'
                  }}
                >
                  <BranchesOutlined /> Version: {formattedDoc.version || '1'}
                </Text>
              </div>
              {/* <Space size={4}>
                <Button 
                  type="primary" 
                  size="small" 
                  disabled={formattedDoc.isDisabled}
                  onClick={() => handleUseDocument?.(doc.document_id)}
                >
                  Open
                </Button>
              </Space> */}
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  // List view renderer (same as Templates.js category list view style)
  const renderListView = () => {
    const publishedDocs = orgDocuments.filter(d => d.status === 'published');
    const disabledDocs = orgDocuments.filter(d => d.status === 'disabled');
    const pendingRevisionDocs = orgDocuments.filter(d => d.status === 'pending_revision');
    const allDocs = [...publishedDocs, ...disabledDocs, ...pendingRevisionDocs]
      .sort((a, b) => {
        const dateA = moment(a.updated_at || a.created_at);
        const dateB = moment(b.updated_at || b.created_at);
        return dateB.valueOf() - dateA.valueOf(); // Descending order
      });

    if (allDocs.length === 0) {
      return <Empty description="No published documents available" />;
    }

    return (
      <List
        bordered
        dataSource={allDocs}
        renderItem={doc => {
          const formattedDoc = formatDocumentData(doc);
          const statusDisplay = getStatusDisplay(formattedDoc.status);
          
          return (
            <List.Item
              actions={[
                /* <Button 
                  type="primary" 
                  size="small" 
                  disabled={formattedDoc.isDisabled}
                  onClick={() => handleUseDocument?.(doc.document_id)}
                >
                  Open
                </Button>, */
                <Dropdown
                  menu={{ items: getDocumentBlockActions(doc) }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button type="text" icon={<EllipsisOutlined />} />
                </Dropdown>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Badge 
                    count={`v${formattedDoc.version || '1'}`} 
                    style={{ 
                      backgroundColor: '#52c41a',
                      fontSize: '10px',
                      height: '18px',
                      lineHeight: '18px',
                      minWidth: '28px'
                    }}
                  >
                    <Avatar 
                      icon={getDocumentIcon(doc)} 
                      size={48}
                      style={{ 
                        backgroundColor: formattedDoc.isDisabled ? '#f5f5f5' : '#f0f2f5', 
                        color: formattedDoc.isDisabled ? '#bfbfbf' : '#1890ff',
                        opacity: formattedDoc.isDisabled ? 0.7 : 1
                      }} 
                    />
                  </Badge>
                }
                title={
                  <div>
                    <span style={{ 
                      color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit',
                      textDecoration: formattedDoc.isDisabled ? 'line-through' : 'none'
                    }}>
                      {formattedDoc.title}
                    </span>
                    <Space style={{ marginLeft: 12 }}>
                      {formattedDoc.document_number && (
                        <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {formattedDoc.document_number}
                        </Tag>
                      )}
                      <Tag color={statusDisplay.color}>
                        {statusDisplay.icon} {statusDisplay.text}
                      </Tag>
                    </Space>
                  </div>
                }
                description={
                  <div style={{ 
                    color: formattedDoc.isDisabled ? '#bfbfbf' : 'inherit',
                    marginTop: 8,
                    fontSize: '12px'
                  }}>
                    <CalendarOutlined style={{ marginRight: 4 }} /> Updated: {formattedDoc.updatedAt}
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  };

  const renderBlockView = () => {
    const publishedDocs = orgDocuments.filter(d => d.status === 'published');
    const disabledDocs = orgDocuments.filter(d => d.status === 'disabled');
    const pendingRevisionDocs = orgDocuments.filter(d => d.status === 'pending_revision');
    const allAvailableDocs = [...publishedDocs, ...disabledDocs, ...pendingRevisionDocs]
      .sort((a, b) => {
        const dateA = moment(a.updated_at || a.created_at);
        const dateB = moment(b.updated_at || b.created_at);
        return dateB.valueOf() - dateA.valueOf(); // Descending order
      });

    return (
      <div>
        {allAvailableDocs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={4}>Organization Documents</Title>
              <div>
              <Tag color="success">Published: {publishedDocs.length}</Tag>
              <Tag color="warning">Revision: {pendingRevisionDocs.length}</Tag>
              <Tag color="error">Disabled: {disabledDocs.length}</Tag>
              </div>
            </div>
            <List
              grid={{ 
                gutter: [16, 16], 
                xs: 1, 
                sm: 2, 
                md: 3, 
                lg: 3,
                xl: 4,
                xxl: 5
              }}
              dataSource={allAvailableDocs}
              renderItem={renderDocumentItem}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} documents`
              }}
            />
          </div>
        )}
        
        {allAvailableDocs.length === 0 && (
          <Empty description="No documents available" />
        )}
      </div>
    );
  };

  return (
    <div className="templates-dashboard">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Published Documents</Title>
          <Space>
            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
              buttonStyle="solid"
              optionType="button"
            >
              <Radio.Button value="blocks">
                <AppstoreOutlined /> Blocks
              </Radio.Button>
              <Radio.Button value="list">
                <BarsOutlined /> List
              </Radio.Button>
            </Radio.Group>
          </Space>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          viewMode === 'blocks' ? renderBlockView() : renderListView()
        )}
      </Card>

      {/* Document Preview Modal */}
      <DocumentPreviewModalInline
        visible={previewModalVisible}
        document={selectedDocument}
        onClose={() => setPreviewModalVisible(false)}
        users={users}
      />
    </div>
  );
};

// Inline preview modal (same pattern as TemplatePreviewModal in Templates.js)
const DocumentPreviewModalInline = ({ 
  visible, 
  document: doc, 
  onClose, 
  users
}) => {
  const [loading, setLoading] = useState(false);
  const [renderedContent, setRenderedContent] = useState(null);

  const parsedDoc = React.useMemo(() => {
    if (!doc) return null;
    return {
      ...doc,
      impact_assessment: typeof doc.impact === 'string' ? JSON.parse(doc.impact || '{}') : (doc.impact || {})
    };
  }, [doc]);

  const renderDocumentContent = () => {
    if (!doc?.content) return null;

    try {
      let contentObj;
      if (typeof doc.content === 'string') {
        contentObj = JSON.parse(doc.content);
      } else {
        contentObj = doc.content;
      }

      const actualContent = contentObj.content || contentObj;

      return (
        <div className="document-viewer">
          <div className="document-page" style={{
            backgroundColor: 'white',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            margin: '0 auto',
            maxWidth: '800px',
            minHeight: '1000px',
            position: 'relative'
          }}>
            <div
              className="document-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(actualContent) }}
              style={{
                fontFamily: '"Work Sans", "Open Sans", Arial, sans-serif',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#333'
              }}
            />
          </div>
        </div>
      );
    } catch (e) {
      console.error("Error rendering content:", e);
      return (
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <Alert
            message="Content Rendering Error"
            description="Could not properly render the document content."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>
      );
    }
  };

  useEffect(() => {
    if (visible && doc) {
      setLoading(true);
      setTimeout(() => {
        setRenderedContent(renderDocumentContent());
        setLoading(false);
      }, 800);
    }
  }, [visible, doc]);

  if (!doc) return null;

  return (
    <Modal
      visible={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            icon={<FileTextOutlined />} 
            size={40}
            style={{ 
              backgroundColor: '#f0f2f5', 
              color: '#1890ff', 
              marginRight: 16
            }} 
          />
          <span>Document Preview: {doc.title}</span>
        </div>
      }
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      styles={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading document preview...</div>
        </div>
      ) : (
        <div className="template-preview-content">
          <Tabs defaultActiveKey="content">
            <TabPane tab="Overview" key="overview">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Document Title">{doc.title}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={doc.status === 'published' ? 'green' : 'default'}>
                    {doc.status || 'Published'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Version">{doc.version || 1}</Descriptions.Item>
                <Descriptions.Item label="Created">
                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : '—'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane tab="Content" key="content">
              <Card bordered={false}>
                <Alert
                  message="Preview Mode"
                  description="This is a preview of how the document will appear. Content may be adjusted based on user permissions."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <div className="template-content-preview">
                  {renderedContent || (
                    <div style={{ textAlign: 'center', color: '#999', padding: 80 }}>
                      <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                      <p>Content preview not available</p>
                    </div>
                  )}
                </div>
              </Card>
            </TabPane>

            <TabPane tab={<span><TeamOutlined /> Impact</span>} key="impact">
              <TemplateImpactTab parsedTemplate={parsedDoc} />
            </TabPane>
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default PublishedDocumentsList;
