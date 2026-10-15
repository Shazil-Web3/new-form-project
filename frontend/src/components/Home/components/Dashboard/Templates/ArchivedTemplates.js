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
  Popconfirm,
  Alert,
  Modal,
  Tabs,
  Descriptions,
  Table,
  Spin,
  message,
  Badge,
  Dropdown,
  Menu
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  LockOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  FilterOutlined,
  FolderOutlined,
  ExportOutlined,
  DeleteOutlined,
  InboxOutlined,
  CalendarOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  BranchesOutlined,
  BookOutlined
} from '@ant-design/icons';
import moment from 'moment';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ArchivedTemplates = ({ 
  user, 
  templates, 
  users, 
  categories, 
  departments,
  handleCreateTemplate,
  handlePreviewTemplate,
  handleRestoreTemplate,
  handleDeleteTemplate,
  formatTemplateData,
  getCategoryNameById,
  fetchUserData
}) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [oldTemplates, setOldTemplates] = useState([]);
  
  // Preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Loading states for actions
  const [restoringTemplates, setRestoringTemplates] = useState(new Set());

  // Extract archived and revised templates on component mount
  useEffect(() => {
    const fetchOldTemplates = () => {
      try {
        setLoading(true);
        if (templates && templates.length > 0) {
          const oldTemplates = templates.filter(template => 
            (template.status === 'archived' || template.status === 'revised') && 
            template.organization_id === user.orgId
          );
          setOldTemplates(oldTemplates);
        }
      } catch (error) {
        console.error("Failed to fetch old templates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOldTemplates();
  }, [templates, user]);

  // Get categories for the organization
  const orgCategories = categories ? categories.filter(c => 
    c.organization_id === user.orgId
  ) : [];

  // Enhanced format template data function
  const enhancedFormatTemplateData = (template) => {
    if (formatTemplateData) {
      return formatTemplateData(template);
    }

    let formattedTitle = template.name;
    if (template.category_id) {
      const category = orgCategories.find(c => c.category_id === template.category_id);
      if (category && category.category_prefix) {
        formattedTitle = `${category.category_prefix} - ${template.name}`;
      }
    }
    
    return {
      id: template.id,
      title: formattedTitle,
      originalTitle: template.name,
      description: template.description || "No description available",
      content: template.content,
      lockedSections: template.locked_sections,
      requiredApprovers: template.required_approvers,
      categoryId: template.category_id,
      createdBy: template.created_by,
      status: template.status,
      version: template.version || '1.0',
      createdAt: new Date(template.created_at).toLocaleDateString(),
      updatedAt: new Date(template.updated_at).toLocaleDateString(),
      isLocked: template.locked_sections && JSON.parse(template.locked_sections).length > 0,
      hasApprovers: template.required_approvers && JSON.parse(template.required_approvers).length > 0
    };
  };

  // Get template icon based on name
  const getTemplateIcon = (template) => {
    const templateName = template.title || template.name || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FilePdfOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  // Enhanced get category name function
  const enhancedGetCategoryNameById = (categoryId) => {
    if (getCategoryNameById) {
      return getCategoryNameById(categoryId, categories);
    }
    const category = orgCategories.find(c => c.category_id === categoryId);
    return category ? category.category_name : 'Uncategorized';
  };

  // Get unique categories from old templates
  const getUniqueCategories = () => {
    const categoryIds = [...new Set(oldTemplates.map(t => t.category_id).filter(Boolean))];
    return categoryIds.map(id => {
      const category = orgCategories.find(c => c.category_id === id);
      return {
        id,
        name: category ? category.category_name : `Category ${id}`
      };
    });
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

  // Filter and sort templates
  const getFilteredAndSortedTemplates = () => {
    let filtered = [...oldTemplates];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') {
        filtered = filtered.filter(template => !template.category_id);
      } else {
        filtered = filtered.filter(template => template.category_id === parseInt(selectedCategory));
      }
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(template => template.status === selectedStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.updated_at) - new Date(a.updated_at);
        case 'category':
          const categoryA = enhancedGetCategoryNameById(a.category_id);
          const categoryB = enhancedGetCategoryNameById(b.category_id);
          return categoryA.localeCompare(categoryB);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'version':
          return (a.version || '1.0').localeCompare(b.version || '1.0');
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Handle template preview
  const handleTemplatePreview = (template) => {
    setSelectedTemplate(template);
    setPreviewModalVisible(true);
  };

  // Handle template status update using axios
  const handleTemplateStatusUpdate = async (templateId, newStatus) => {
    try {
      const response = await axios.put(`/api/templates/${templateId}/status`, {
        status: newStatus
      });
      
      if (response.status === 200) {
        return response.data;
      }
      throw new Error('Failed to update template status');
    } catch (error) {
      console.error('Error updating template status:', error);
      throw error;
    }
  };

  // Handle restore template with status update
  const handleRestoreTemplateStatus = async (templateId) => {
    setRestoringTemplates(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, 'published');
      message.success('Template successfully restored to published status');
      fetchUserData(); // Refresh the data
    } catch (error) {
      console.error('Error restoring template:', error);
      message.error('Failed to restore template. Please try again.');
    } finally {
      setRestoringTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };

  const filteredTemplates = getFilteredAndSortedTemplates();

  // Render template actions for admin users
  const renderTemplateActions = (template) => {
    const actions = [];

    // Preview action for all users
    actions.push(
      <Tooltip title="Preview Template" key="preview">
        <Button 
          type="text" 
          icon={<EyeOutlined />} 
          size="small" 
          onClick={() => handleTemplatePreview(template)}
        />
      </Tooltip>
    );

    // Admin-only actions
    if (user?.role === 'admin' && template.status === 'archived') {
      // Restore template
      actions.push(
        <Tooltip title="Restore Template" key="restore">
          <Button 
            type="text" 
            icon={<ExportOutlined />} 
            size="small"
            loading={restoringTemplates.has(template.id)}
            onClick={() => {
              confirmAlert(
                'Restore Template',
                'Are you sure you want to restore this template to published status?',
                'Yes, proceed',
                'Cancel'
              ).then((result) => {
                if (result.isConfirmed) {
                  handleRestoreTemplateStatus(template.id); 
                }
              });
            }}
          />
        </Tooltip>
      );
    }

    // Use template action (if available and not admin-only)
    if (handleCreateTemplate && user?.role !== 'admin') {
      actions.push(
        <Button 
          key="use"
          type="primary" 
          size="small" 
          onClick={() => handleCreateTemplate(template.id)}
        >
          Use Template
        </Button>
      );
    }

    return actions;
  };

  // Render template card for blocks view with consistent sizing
  const renderTemplateCard = (template) => {
    const formattedTemplate = enhancedFormatTemplateData(template);
    const statusDisplay = getStatusDisplay(template.status);
    
    return (
      <List.Item key={template.id}>
        <Card 
          hoverable 
          className="archived-template-card"
          style={{ 
            height: '320px', // Fixed height for consistency
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
              count={`v${formattedTemplate.version}`} 
              style={{ 
                backgroundColor: statusDisplay.color === 'red' ? '#ff4d4f' : '#fa8c16',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                minWidth: '28px'
              }}
            >
              <Avatar 
                icon={getTemplateIcon(template)} 
                size={48}
                style={{ 
                  backgroundColor: '#f5f5f5', 
                  color: '#8c8c8c'
                }} 
              />
            </Badge>
            <div style={{ flex: 1, marginLeft: 12 }}>
              <Tooltip title={formattedTemplate.title}>
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
                  {formattedTemplate.title}
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
              {formattedTemplate.description}
            </Paragraph>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <Space wrap size={[4, 4]}>
              {formattedTemplate.categoryId && (
                <Tag color="default" size="small">
                  <FolderOutlined /> {enhancedGetCategoryNameById(template.category_id)}
                </Tag>
              )}
              {formattedTemplate.isLocked && (
                <Tag color="default" size="small">
                  <LockOutlined /> Locked
                </Tag>
              )}
              {formattedTemplate.hasApprovers && (
                <Tag color="default" size="small">
                  <UserOutlined /> Approvers
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
                <Text type="secondary" style={{ display: 'block' }}>
                  <CalendarOutlined /> {template.status === 'archived' ? 'Archived' : 'Revised'}: {formattedTemplate.updatedAt}
                </Text>
                <Text type="secondary">
                  <BranchesOutlined /> Version: {formattedTemplate.version}
                </Text>
              </div>
              <Space size={4}>
                {renderTemplateActions(template)}
              </Space>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  // Render template list item for list view
  const renderTemplateListItem = (template) => {
    const formattedTemplate = enhancedFormatTemplateData(template);
    const statusDisplay = getStatusDisplay(template.status);
    
    return (
      <List.Item
        key={template.id}
        actions={renderTemplateActions(template)}
        style={{ opacity: 0.85 }}
      >
        <List.Item.Meta
          avatar={
            <Badge 
              count={`v${formattedTemplate.version}`} 
              style={{ 
                backgroundColor: statusDisplay.color === 'red' ? '#ff4d4f' : '#fa8c16',
                fontSize: '10px'
              }}
            >
              <Avatar 
                icon={getTemplateIcon(template)} 
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
              <span style={{ marginRight: 12, color: '#595959' }}>{formattedTemplate.title}</span>
              <Space wrap>
                {formattedTemplate.categoryId && (
                  <Tag color="default" size="small">
                    <FolderOutlined /> {enhancedGetCategoryNameById(template.category_id)}
                  </Tag>
                )}
                {formattedTemplate.isLocked && (
                  <Tag color="default" size="small">
                    <LockOutlined /> Locked
                  </Tag>
                )}
                {formattedTemplate.hasApprovers && (
                  <Tag color="default" size="small">
                    <UserOutlined /> Approvers
                  </Tag>
                )}
                <Tag color={statusDisplay.color} size="small">
                  {statusDisplay.icon} {statusDisplay.text}
                </Tag>
              </Space>
            </div>
          }
          description={
            <div>
              <Paragraph ellipsis={{ rows: 1 }} style={{ marginBottom: 4 }}>
                {formattedTemplate.description}
              </Paragraph>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <CalendarOutlined /> {template.status === 'archived' ? 'Archived' : 'Revised'}: {formattedTemplate.updatedAt} | 
                <BranchesOutlined style={{ marginLeft: 8 }} /> Version: {formattedTemplate.version} | 
                Created: {formattedTemplate.createdAt}
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
              Old Templates
              <Text type="secondary" style={{ fontSize: '16px', fontWeight: 'normal', marginLeft: 8 }}>
                ({filteredTemplates.length} templates)
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
                placeholder="Search templates..."
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
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: '100%' }}
                placeholder="Category"
                suffixIcon={<FilterOutlined />}
              >
                <Option value="all">All Categories</Option>
                <Option value="uncategorized">Uncategorized</Option>
                {getUniqueCategories().map(category => (
                  <Option key={category.id} value={category.id.toString()}>
                    {category.name}
                  </Option>
                ))}
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
                <Option value="category">Category</Option>
                <Option value="status">Status</Option>
                <Option value="version">Version</Option>
              </Select>
            </Col>
          </Row>
        </div>

        {/* Templates Display */}
        {filteredTemplates.length === 0 ? (
          <Empty 
            description={
              oldTemplates.length === 0 
                ? "No old templates found"
                : "No templates match your search criteria"
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all') && (
              <Button onClick={() => { 
                setSearchQuery(''); 
                setSelectedCategory('all'); 
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
            dataSource={filteredTemplates}
            renderItem={viewMode === 'blocks' ? renderTemplateCard : renderTemplateListItem}
            pagination={{
              pageSize: viewMode === 'blocks' ? 15 : 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} templates`
            }}
          />
        )}
      </Card>
      
      {/* Template Preview Modal */}
      <TemplatePreviewModal
        visible={previewModalVisible}
        template={selectedTemplate}
        onClose={() => setPreviewModalVisible(false)}
        categories={orgCategories}
        users={users}
        departments={departments}
      />
    </div>
  );
};

const TemplatePreviewModal = ({ 
  visible, 
  template, 
  onClose, 
  categories, 
  users,
  departments 
}) => {
  const [loading, setLoading] = useState(false);
  const [renderedContent, setRenderedContent] = useState(null);

  // Parse the template data to extract necessary information
  const parsedTemplate = React.useMemo(() => {
    if (!template) return null;
    
    // Parse required_approvers JSON string to get approvers array
    let approvers = [];
    try {
      approvers = template.required_approvers ? JSON.parse(template.required_approvers) : [];
    } catch (e) {
      console.error("Error parsing approvers:", e);
    }
    
    // Parse template_structure to get locked elements
    let lockedElements = [];
    let includeTableOfContents = false;
    let allowAttachments = false;
    try {
      if (template.template_structure) {
        const structure = JSON.parse(template.template_structure);
        lockedElements = structure.locked_elements || [];
        includeTableOfContents = structure.includeTableOfContents || false;
        allowAttachments = structure.allowAttachments || false;
      }
    } catch (e) {
      console.error("Error parsing template structure:", e);
    }

    // Extract references from comments column if available
    let references = [];
    try {
      if (template.comments) {
        const commentsData = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
        if (commentsData && Array.isArray(commentsData.references)) {
          references = commentsData.references;
        }
      }
    } catch (e) {
      console.error("Error parsing references:", e);
    }
    
    return {
      ...template,
      approvers,
      lockedElements,
      includeTableOfContents,
      allowAttachments,
      references
    };
  }, [template]);

  // Function to get template icon based on name
  const getTemplateIcon = (template) => {
    const templateName = template?.name || template?.title || "";
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FileSearchOutlined />;
    } else {
      return <FileTextOutlined />;
    }
  };

  // Function to get category details
  const getCategoryDetails = (categoryId) => {
    return categories.find(c => c.category_id === categoryId) || {};
  };

  // Function to parse and display locked elements
  const renderLockedElements = () => {
    if (
      !parsedTemplate?.lockedElements || 
      Object.values(parsedTemplate.lockedElements).filter(isLocked => isLocked).length === 0
    ) {
      return <Text type="secondary">No elements locked</Text>;
    }

    return (
      <ul className="locked-elements-list">
        {Object.entries(parsedTemplate.lockedElements).map(([element, isLocked]) => (
          isLocked && <li key={element}>{element}</li>
        ))}
      </ul>
    );
  };
  
  // Enhanced content renderer
  const renderTemplateContent = () => {
    if (!parsedTemplate?.content) return null;
    
    try {
      // Parse the content JSON
      let contentObj;
      if (typeof parsedTemplate.content === 'string') {
        contentObj = JSON.parse(parsedTemplate.content);
      } else {
        contentObj = parsedTemplate.content;
      }
      
      // If content is nested in a content property (as in your sample data)
      const actualContent = contentObj.content || contentObj;
      
      // Create document viewer container
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
      // Fallback to basic rendering
      return (
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <Alert
            message="Content Rendering Error"
            description="Could not properly render the template content. Displaying raw content instead."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
            {parsedTemplate.content}
          </pre>
        </div>
      );
    }
  };

  // Function to render approvers table with due date
  const renderApproversTable = () => {
    if (!parsedTemplate?.approvers || parsedTemplate.approvers.length === 0) {
      return <Text type="secondary">No approvers configured</Text>;
    }

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
          const dept = departments.find(d => d.id === deptId);
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
        dataSource={parsedTemplate.approvers}
        pagination={false}
        size="small"
        rowKey={(record, index) => `approver-${index}`}
      />
    );
  };

  // Get status display for modal
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'archived':
        return { color: 'red', text: 'Archived' };
      case 'revised':
        return { color: 'orange', text: 'Revised' };
      default:
        return { color: 'default', text: status };
    }
  };

  useEffect(() => {
    if (visible && template) {
      setLoading(true);
      // Simulate loading template content
      setTimeout(() => {
        // Prepare content for rendering
        setRenderedContent(renderTemplateContent());
        setLoading(false);
      }, 800);
    }
  }, [visible, template]);

  if (!parsedTemplate) return null;

  const statusDisplay = getStatusDisplay(parsedTemplate.status);

  return (
    <Modal
      visible={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            icon={getTemplateIcon(parsedTemplate)} 
            size={40}
            style={{ 
              backgroundColor: '#f0f2f5', 
              color: '#1890ff', 
              marginRight: 16
            }} 
          />
          <span>Template Preview: {parsedTemplate.name || parsedTemplate.title}</span>
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
          <div style={{ marginTop: 16 }}>Loading template preview...</div>
        </div>
      ) : (
        <div className="template-preview-content">
          <Tabs defaultActiveKey="content">
            <TabPane tab="Overview" key="overview">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Template Name">{parsedTemplate.name || parsedTemplate.title}</Descriptions.Item>
                <Descriptions.Item label="Description">{parsedTemplate.description}</Descriptions.Item>
                <Descriptions.Item label="Category">
                  {getCategoryDetails(parsedTemplate.category_id || parsedTemplate.categoryId)?.category_name || 'No Category'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={parsedTemplate.status === 'approved' ? 'green' : 
                         parsedTemplate.status === 'submitted' ? 'blue' : 'default'}>
                    {parsedTemplate.status || 'Draft'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {parsedTemplate.created_at ? new Date(parsedTemplate.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {parsedTemplate.updated_at ? new Date(parsedTemplate.updated_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane tab="Content" key="content">
              <Card bordered={false}>
                <Alert
                  message="Preview Mode"
                  description="This is a preview of how the template will appear to users. Content may be adjusted based on user permissions."
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
            
            <TabPane tab="Structure" key="structure">
              <Card title="Locked Elements" size="small" style={{ marginBottom: 16 }}>
                {renderLockedElements()}
              </Card>
              
              <Card title="Document Structure" size="small" style={{ marginBottom: 16 }}>
                <ul>
                  {parsedTemplate.includeTableOfContents && <li>Includes Table of Contents</li>}
                  {parsedTemplate.allowAttachments && <li>Allows File Attachments</li>}
                  {!parsedTemplate.includeTableOfContents && !parsedTemplate.allowAttachments && 
                    <Text type="secondary">No special structure settings</Text>}
                </ul>
              </Card>
            </TabPane>
            
            <TabPane tab="Approvers" key="approvers">
              <Card bordered={false}>
                {renderApproversTable()}
              </Card>
            </TabPane>
            
            <TabPane tab="Notes" key="notes">
              <Card bordered={false}>
                {parsedTemplate.notes ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{parsedTemplate.notes}</div>
                ) : (
                  <Text type="secondary">No additional notes provided</Text>
                )}
              </Card>
            </TabPane>

            <TabPane tab="References" key="references">
              <ReferencesTab 
                references={parsedTemplate.references || []} 
                canEdit={false} 
              />
            </TabPane>
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default ArchivedTemplates;