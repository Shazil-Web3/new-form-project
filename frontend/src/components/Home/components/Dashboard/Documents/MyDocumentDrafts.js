import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Empty, 
  Tooltip, 
  Divider,
  Skeleton,
  Space,
  Badge
} from 'antd';
import { 
  FileOutlined, 
  EditOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  CalendarOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;

const MyDocumentDrafts = ({ user, documents, navigate, handleEditDocument }) => {
  const [loading, setLoading] = useState(true);
  const [draftDocuments, setDraftDocuments] = useState([]);

  useEffect(() => {
    const run = () => {
      try {
        setLoading(true);
        if (documents && documents.length > 0 && user?.id != null) {
          const uid = Number(user.id);
          const userDrafts = documents.filter((d) => {
            const st = String(d.status ?? '').toLowerCase();
            const owner = Number(d.created_by);
            return st === 'draft' && owner === uid;
          });

          const draftMap = new Map();
          userDrafts.forEach((draft) => {
            const key = draft.title || draft.document_id;
            const existingDraft = draftMap.get(key);
            if (!existingDraft || new Date(draft.updated_at) > new Date(existingDraft.updated_at)) {
              draftMap.set(key, draft);
            }
          });

          const latestDrafts = Array.from(draftMap.values()).sort(
            (a, b) => moment(b.updated_at || b.created_at).valueOf() - moment(a.updated_at || a.created_at).valueOf()
          );

          setDraftDocuments(latestDrafts);
        } else {
          setDraftDocuments([]);
        }
      } catch (error) {
        console.error('Failed to fetch draft documents:', error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user, documents]);

  const formatDocumentData = (doc) => {
    return {
      id: doc.document_id,
      title: doc.title || 'Untitled',
      originalTitle: doc.title,
      description: 'Document draft',
      status: doc.status,
      version: doc.current_revision ? String(Math.floor(Number(doc.current_revision))) : '1',
      createdAt: doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '',
      updatedAt: doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : ''
    };
  };

  const getTemplateIcon = (template) => {
    const templateName = template.title || template.name || '';
    if (templateName.toLowerCase().includes('contract')) {
      return <FileTextOutlined />;
    } else if (templateName.toLowerCase().includes('proposal')) {
      return <FilePdfOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  const renderDraftItem = (doc) => {
    const formattedTemplate = formatDocumentData(doc);

    return (
      <List.Item key={doc.document_id}>
        <Card 
          hoverable 
          className="draft-template-card"
          style={{ 
            height: '320px', // Fixed height for consistency
            width: '100%',
            display: 'flex', 
            flexDirection: 'column',
            borderLeft: '4px solid #faad14',
            opacity: 0.95
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
              count={`v${Math.floor(Number(formattedTemplate.version))}`} 
              style={{ 
                backgroundColor: '#faad14',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                minWidth: '28px'
              }}
            >
              <Avatar 
                icon={getTemplateIcon({ title: doc.title })} 
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
              <Tag color="warning" size="small">
                <FileOutlined /> Draft
              </Tag>
            </Space>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px' }}>
                <Text type="secondary" style={{ display: 'block' }}>
                  <CalendarOutlined /> Created: {formattedTemplate.createdAt}
                </Text>
                <Text type="secondary">
                  <BranchesOutlined /> Version: {formattedTemplate.version}
                </Text>
              </div>
              <Space size={4}>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEditDocument?.({ document_id: doc.document_id, ...doc })}
                >
                  Review
                </Button>
              </Space>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  return (
    <div className="drafts-dashboard">
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#595959' }}>
            <EditOutlined style={{ marginRight: 8 }} />
            My Draft Documents
            <Text type="secondary" style={{ fontSize: '16px', fontWeight: 'normal', marginLeft: 8 }}>
              ({draftDocuments.length} documents)
            </Text>
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Documents that you can continue editing in the editor
          </Text>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : draftDocuments.length === 0 ? (
          <Empty 
            description="No draft documents found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              Create a new document from the Documents menu to get started
            </Text>
          </Empty>
        ) : (
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
            dataSource={draftDocuments}
            renderItem={renderDraftItem}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} documents`
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default MyDocumentDrafts;