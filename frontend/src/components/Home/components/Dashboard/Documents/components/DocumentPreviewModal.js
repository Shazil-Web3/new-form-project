import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Tabs, Spin, Descriptions, Tag, Typography, Card, Alert, Table, Divider } from 'antd';
import { 
  FileTextOutlined, 
  FileSearchOutlined, 
  InfoCircleOutlined,
  UserOutlined,
  TeamOutlined
} from '@ant-design/icons';
import TemplateImpactTab from '../../../../../Unified/UnifiedTextEditor/Preview/components/TemplateImpactTab';
import { sanitizeHtml } from '../../../../../../utils/sanitizeHtml';

const { Text } = Typography;
const { TabPane } = Tabs;

/**
 * Lightweight, read-only preview modal for Documents.
 * Replicates the TemplatePreviewModal behavior exactly.
 */
const DocumentPreviewModal = ({ 
  visible, 
  document, 
  onClose, 
  categories, 
  users,
  departments
}) => {
  const [loading, setLoading] = useState(false);
  const [renderedContent, setRenderedContent] = useState(null);

  // Robust parsing of document content
  const parsedDocument = useMemo(() => {
    if (!document) return null;
    
    let content = document.content || '';
    let logo = null;
    let headerHTML = '';
    let footerHTML = '';
    let logoText = '';
    let logoTextRight = '';
    let approvers = [];

    // 1. Try to parse 'comments' field which usually holds the full editor state
    if (document.comments) {
      try {
        const parsed = typeof document.comments === 'string' ? JSON.parse(document.comments) : document.comments;
        if (parsed && typeof parsed === 'object') {
          content = parsed.content || parsed.contentHtml || content;
          logo = parsed.logo || null;
          headerHTML = parsed.headerHTML || '';
          footerHTML = parsed.footerHTML || '';
          logoText = parsed.logoText || '';
          logoTextRight = parsed.logoTextRight || '';
        }
      } catch (e) {}
    }

    // 2. If content is STILL a JSON string (sometimes happens), parse it
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        const innerParsed = JSON.parse(content);
        if (innerParsed && innerParsed.content) {
          content = innerParsed.content;
        }
      } catch (e) {}
    }

    // 3. Parse workflow approvers
    try {
      if (document.workflow_approvers) {
        approvers = typeof document.workflow_approvers === 'string' ? JSON.parse(document.workflow_approvers) : document.workflow_approvers;
      }
    } catch (e) {}

    return {
      ...document,
      content,
      logo,
      headerHTML,
      footerHTML,
      logoText,
      logoTextRight,
      approvers: Array.isArray(approvers) ? approvers : [],
      impact_assessment: typeof document.impact === 'string' ? JSON.parse(document.impact || '{}') : (document.impact || {})
    };
  }, [document]);

  // Render content as static HTML
  // useCallback prevents a new function reference on every render, which would otherwise
  // cause the useEffect below to re-fire unnecessarily on every parent re-render.
  const renderContent = useCallback(() => {
    if (!parsedDocument?.content) return null;

    return (
      <div className="document-viewer">
        <div className="document-page" style={{
          backgroundColor: 'white',
          padding: '40px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          margin: '0 auto',
          maxWidth: '850px',
          minHeight: '1050px',
          position: 'relative'
        }}>
          {parsedDocument.logo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              <img 
                src={typeof parsedDocument.logo === 'object' ? parsedDocument.logo.preview : parsedDocument.logo} 
                alt="Logo" 
                style={{ 
                  maxHeight: 60,
                  width: typeof parsedDocument.logo === 'object' && parsedDocument.logo.width ? parsedDocument.logo.width : 'auto',
                  height: typeof parsedDocument.logo === 'object' && parsedDocument.logo.height ? parsedDocument.logo.height : 'auto',
                  objectFit: 'contain'
                }} 
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: 12, color: '#666', alignItems: 'center' }}>
                {parsedDocument.logoText && <span>{parsedDocument.logoText}</span>}
                {parsedDocument.logoText && parsedDocument.logoTextRight && <span style={{ color: '#d9d9d9' }}>|</span>}
                {parsedDocument.logoTextRight && <span style={{ color: '#888', fontWeight: 500 }}>{parsedDocument.logoTextRight}</span>}
              </div>
            </div>
          )}
          
          <div
            className="document-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(parsedDocument.content) }}
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
  }, [parsedDocument]);

  useEffect(() => {
    if (visible && document) {
      setLoading(true);
      const timer = setTimeout(() => {
        setRenderedContent(renderContent());
        setLoading(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visible, document, renderContent]);

  if (!parsedDocument) return null;

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'published': return 'success';
      case 'draft': return 'warning';
      case 'review': return 'processing';
      default: return 'default';
    }
  };

  return (
    <Modal
      open={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FileTextOutlined style={{ fontSize: 20, color: '#1890ff', marginRight: 12 }} />
          <span>Document Preview: {parsedDocument.title}</span>
        </div>
      }
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>
      ]}
      styles={{ body: { padding: '20px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>
      ) : (
        <Tabs defaultActiveKey="content">
          <TabPane tab={<span><InfoCircleOutlined /> Overview</span>} key="overview">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Document Title">{parsedDocument.title}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(parsedDocument.status)}>{parsedDocument.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">{parsedDocument.updated_at ? new Date(parsedDocument.updated_at).toLocaleString() : '—'}</Descriptions.Item>
            </Descriptions>
          </TabPane>
          
          <TabPane tab={<span><FileSearchOutlined /> Content</span>} key="content">
            <Card bordered={false} bodyStyle={{ padding: 0 }}>
              <Alert
                message="Read-Only Preview"
                description="This is a lightweight preview. Use 'Open in Editor' to make changes."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <div style={{ background: '#f0f2f5', padding: '20px', borderRadius: '8px' }}>
                {renderedContent}
              </div>
            </Card>
          </TabPane>

          <TabPane tab={<span><TeamOutlined /> Impact</span>} key="impact">
            <TemplateImpactTab parsedTemplate={parsedDocument} />
          </TabPane>
        </Tabs>
      )}
    </Modal>
  );
};

export default DocumentPreviewModal;
