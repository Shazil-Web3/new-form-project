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
  Input,
  Select,
  Row,
  Col,
  Skeleton,
  Alert,
  Modal,
  Tabs,
  Descriptions,
  Spin,
  message,
  Badge
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  InboxOutlined,
  CalendarOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ArchivedDocumentsList = ({ 
  user, 
  documents, 
  users, 
  handlePreviewDocument,
  fetchUserData
}) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [oldDocuments, setOldDocuments] = useState([]);
  
  // Preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  // Loading states for actions
  const [restoringDocuments, setRestoringDocuments] = useState(new Set());

  // Extract archived and revised documents on component mount
  useEffect(() => {
    try {
      setLoading(true);
      if (documents && documents.length > 0) {
        const oldDocs = documents.filter(doc => 
          (doc.status === 'archived' || doc.status === 'revised')
        );
        setOldDocuments(oldDocs);
      }
    } catch (error) {
      console.error("Failed to fetch old documents:", error);
    } finally {
      setLoading(false);
    }
  }, [documents, user]);

  // Enhanced format document data function
  const formatDocumentData = (doc) => {
    return {
      id: doc.document_id,
      title: doc.title || 'Untitled Document',
      description: doc.description || "No description available",
      content: doc.content,
      status: doc.status,
      version: doc.version || 1,
      createdAt: new Date(doc.created_at).toLocaleDateString(),
      updatedAt: new Date(doc.updated_at).toLocaleDateString(),
    };
  };

  // Get document icon based on name
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

  // Get status color and display
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'archived':
        return { color: 'red', icon: <InboxOutlined />, text: 'Archived' };
      case 'revised':
        return { color: 'orange', icon: <HistoryOutlined />, text: 'Revised' };
      default:
        return { color: 'default', icon: <FileOutlined />, text: status };
    }
  };

  // Filter and sort documents
  const getFilteredAndSortedDocuments = () => {
    let filtered = [...oldDocuments];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === selectedStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        case 'date':
          const dateA = moment(a.updated_at || a.created_at);
          const dateB = moment(b.updated_at || b.created_at);
          return dateB.valueOf() - dateA.valueOf(); // Descending: latest first
        case 'status':
          return a.status.localeCompare(b.status);
        case 'version':
          return (a.version || 1) - (b.version || 1);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Handle document preview
  const handleDocumentPreview = (doc) => {
    if (handlePreviewDocument) {
      handlePreviewDocument(doc);
    } else {
      setSelectedDocument(doc);
      setPreviewModalVisible(true);
    }
  };

  // Handle document status update using axios
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

  // Handle restore document with status update
  const handleRestoreDocumentStatus = async (documentId) => {
    setRestoringDocuments(prev => new Set([...prev, documentId]));
    
    try {
      await handleDocumentStatusUpdate(documentId, 'published');
      message.success('Document successfully restored to published status');
      fetchUserData();
    } catch (error) {
      console.error('Error restoring document:', error);
      message.error('Failed to restore document. Please try again.');
    } finally {
      setRestoringDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const filteredDocuments = getFilteredAndSortedDocuments();

  // Render document actions for admin users
  const renderDocumentActions = (doc) => {
    const actions = [];

    // Preview action for all users
    actions.push(
      <Tooltip title="Preview Document" key="preview">
        <Button 
          type="text" 
          icon={<EyeOutlined />} 
          size="small" 
          onClick={() => handleDocumentPreview(doc)}
        />
      </Tooltip>
    );

    // Admin-only actions
    if (user?.role === 'admin' && doc.status === 'archived') {
      // Restore document
      actions.push(
        <Tooltip title="Restore Document" key="restore">
          <Button 
            type="text" 
            icon={<ExportOutlined />} 
            size="small"
            loading={restoringDocuments.has(doc.document_id)}
            onClick={() => {
              confirmAlert(
                'Restore Document',
                'Are you sure you want to restore this document to published status?',
                'Yes, proceed',
                'Cancel'
              ).then((result) => {
                if (result.isConfirmed) {
                  handleRestoreDocumentStatus(doc.document_id); 
                }
              });
            }}
          />
        </Tooltip>
      );
    }

    return actions;
  };

  // Render document card for blocks view with consistent sizing
  const renderDocumentCard = (doc) => {
    const formattedDoc = formatDocumentData(doc);
    const statusDisplay = getStatusDisplay(doc.status);
    
    return (
      <List.Item key={doc.document_id}>
        <Card 
          hoverable 
          className="archived-template-card"
          style={{ 
            height: '320px',
            width: '100%',
            display: 'flex', 
            flexDirection: 'column',
            borderLeft: `4px solid ${statusDisplay.color === 'red' ? '#ff4d4f' : '#fa8c16'}`,
            opacity: 0.85
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
              count={`v${formattedDoc.version}`} 
              style={{ 
                backgroundColor: statusDisplay.color === 'red' ? '#ff4d4f' : '#fa8c16',
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
                  backgroundColor: '#f5f5f5', 
                  color: '#8c8c8c'
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
                    color: '#595959',
                    fontSize: '14px',
                    lineHeight: '1.3'
                  }}
                >
                  {formattedDoc.title}
                </Title>
              </Tooltip>
            </div>
          </div>
          
          <div style={{ flex: 1, marginBottom: 12 }}>
            <Paragraph 
              ellipsis={{ rows: 2 }} 
              type="secondary"
              style={{ fontSize: '12px', marginBottom: 8 }}
            >
              {formattedDoc.description}
            </Paragraph>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <Space wrap size={[4, 4]}>
              <Tag color={statusDisplay.color} size="small">
                {statusDisplay.icon} {statusDisplay.text}
              </Tag>
            </Space>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px' }}>
                <Text type="secondary" style={{ display: 'block' }}>
                  <CalendarOutlined /> {doc.status === 'archived' ? 'Archived' : 'Revised'}: {formattedDoc.updatedAt}
                </Text>
                <Text type="secondary">
                  <BranchesOutlined /> Version: {formattedDoc.version}
                </Text>
              </div>
              <Space size={4}>
                {renderDocumentActions(doc)}
              </Space>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  // Render document list item for list view
  const renderDocumentListItem = (doc) => {
    const formattedDoc = formatDocumentData(doc);
    const statusDisplay = getStatusDisplay(doc.status);
    
    return (
      <List.Item
        key={doc.document_id}
        actions={renderDocumentActions(doc)}
        style={{ opacity: 0.85 }}
      >
        <List.Item.Meta
          avatar={
            <Badge 
              count={`v${formattedDoc.version}`} 
              style={{ 
                backgroundColor: statusDisplay.color === 'red' ? '#ff4d4f' : '#fa8c16',
                fontSize: '10px'
              }}
            >
              <Avatar 
                icon={getDocumentIcon(doc)} 
                size={48}
                style={{ 
                  backgroundColor: '#f5f5f5', 
                  color: '#8c8c8c'
                }} 
              />
            </Badge>
          }
          title={
            <div>
              <span style={{ marginRight: 12, color: '#595959' }}>{formattedDoc.title}</span>
              <Space wrap>
                <Tag color={statusDisplay.color} size="small">
                  {statusDisplay.icon} {statusDisplay.text}
                </Tag>
              </Space>
            </div>
          }
          description={
            <div>
              <Paragraph ellipsis={{ rows: 1 }} style={{ marginBottom: 4 }}>
                {formattedDoc.description}
              </Paragraph>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <CalendarOutlined /> {doc.status === 'archived' ? 'Archived' : 'Revised'}: {formattedDoc.updatedAt} | 
                <BranchesOutlined style={{ marginLeft: 8 }} /> Version: {formattedDoc.version} | 
                Created: {formattedDoc.createdAt}
              </Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  return (
    <div className="archived-templates">
      <Card>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={3} style={{ margin: 0, color: '#595959' }}>
              <HistoryOutlined style={{ marginRight: 8 }} />
              Old Documents
              <Text type="secondary" style={{ fontSize: '16px', fontWeight: 'normal', marginLeft: 8 }}>
                ({filteredDocuments.length} documents)
              </Text>
            </Title>
            
            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
              buttonStyle="solid"
              optionType="button"
            >
              <Radio.Button value="blocks">
                <AppstoreOutlined /> Cards
              </Radio.Button>
              <Radio.Button value="list">
                <BarsOutlined /> List
              </Radio.Button>
            </Radio.Group>
          </div>

          {/* Filters and Search */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Search
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onSearch={setSearchQuery}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                style={{ width: '100%' }}
                placeholder="Status"
                suffixIcon={<FilterOutlined />}
              >
                <Option value="all">All Status</Option>
                <Option value="archived">Archived</Option>
                <Option value="revised">Revised</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: '100%' }}
                placeholder="Sort by"
              >
                <Option value="name">Name (A-Z)</Option>
                <Option value="date">Last Updated</Option>
                <Option value="status">Status</Option>
                <Option value="version">Version</Option>
              </Select>
            </Col>
          </Row>
        </div>

        {/* Documents Display */}
        {filteredDocuments.length === 0 ? (
          <Empty 
            description={
              oldDocuments.length === 0 
                ? "No old documents found"
                : "No documents match your search criteria"
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {(searchQuery || selectedStatus !== 'all') && (
              <Button onClick={() => { 
                setSearchQuery(''); 
                setSelectedStatus('all');
              }}>
                Clear Filters
              </Button>
            )}
          </Empty>
        ) : (
          <List
            grid={viewMode === 'blocks' ? { 
              gutter: [16, 16], 
              xs: 1, 
              sm: 2, 
              md: 3, 
              lg: 3,
              xl: 4,
              xxl: 5
            } : false}
            dataSource={filteredDocuments}
            renderItem={viewMode === 'blocks' ? renderDocumentCard : renderDocumentListItem}
            pagination={{
              pageSize: viewMode === 'blocks' ? 15 : 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} documents`
            }}
          />
        )}
      </Card>
      
      {/* Document Preview Modal */}
      <OldDocumentPreviewModal
        visible={previewModalVisible}
        document={selectedDocument}
        onClose={() => setPreviewModalVisible(false)}
        users={users}
      />
    </div>
  );
};

const OldDocumentPreviewModal = ({ 
  visible, 
  document: doc, 
  onClose, 
  users
}) => {
  const [loading, setLoading] = useState(false);
  const [renderedContent, setRenderedContent] = useState(null);

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
                  <Tag color={doc.status === 'archived' ? 'red' : 'orange'}>
                    {doc.status === 'archived' ? 'Archived' : 'Revised'}
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
                  message="Preview Mode (Read-Only)"
                  description="This is an archived/revised version. The content is read-only."
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
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default ArchivedDocumentsList;
