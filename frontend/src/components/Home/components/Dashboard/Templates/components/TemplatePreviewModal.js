import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Tag,
  Avatar,
  Typography,
  Tabs,
  Skeleton,
  Table,
  Spin,
  Descriptions,
  Alert
} from 'antd';
import {
  FileOutlined,
  FileTextOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { sanitizeHtml } from '../../../../../../utils/sanitizeHtml';

const { Text } = Typography;
const { TabPane } = Tabs;

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
  const parsedTemplate = useMemo(() => {
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
    
    return {
      ...template,
      approvers,
      lockedElements,
      includeTableOfContents,
      allowAttachments
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

  // Render content as static HTML for pure read-only preview mode.
  const renderTemplateContent = () => {
    if (!parsedTemplate?.content) return null;

    try {
      let contentObj;
      if (typeof parsedTemplate.content === 'string') {
        contentObj = JSON.parse(parsedTemplate.content);
      } else {
        contentObj = parsedTemplate.content;
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

  useEffect(() => {
    if (visible && template) {
      setLoading(true);
      setTimeout(() => {
        setRenderedContent(renderTemplateContent());
        setLoading(false);
      }, 800);
    }
  }, [visible, template]);


  if (!parsedTemplate) return null;

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
                  <Tag color={parsedTemplate.status === 'published' ? 'green' : 'default'}>
                    {parsedTemplate.status || 'Published'}
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
              <div style={{ border: 'none' }}>
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

              </div>
            </TabPane>
            
            <TabPane tab="Structure" key="structure">
              <div style={{ marginBottom: 16, border: '1px solid #f0f0f0', padding: 16, borderRadius: 4 }}>
                <h4>Locked Elements</h4>
                {renderLockedElements()}
              </div>
              
              <div style={{ marginBottom: 16, border: '1px solid #f0f0f0', padding: 16, borderRadius: 4 }}>
                <h4>Document Structure</h4>
                <ul>
                  {parsedTemplate.includeTableOfContents && <li>Includes Table of Contents</li>}
                  {parsedTemplate.allowAttachments && <li>Allows File Attachments</li>}
                  {!parsedTemplate.includeTableOfContents && !parsedTemplate.allowAttachments && 
                    <Text type="secondary">No special structure settings</Text>}
                </ul>
              </div>
            </TabPane>
            
            <TabPane tab="Approvers" key="approvers">
              <div style={{ border: 'none' }}>
                {renderApproversTable()}
              </div>
            </TabPane>
            
            <TabPane tab="Notes" key="notes">
              <div style={{ border: 'none' }}>
                {parsedTemplate.notes ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{parsedTemplate.notes}</div>
                ) : (
                  <Text type="secondary">No additional notes provided</Text>
                )}
              </div>
            </TabPane>
          </Tabs>
        </div>
      )}
    </Modal>
  );
};

export default TemplatePreviewModal;
