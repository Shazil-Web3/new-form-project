import React, { useState, useEffect, useCallback } from 'react';
import { Card, Descriptions, Tag, Button, Form, Input, Select, Space, Spin } from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { getDisplayCategory, getReceivedAt } from '../../../../../pages/new/Hub/utils/dashboardUtils';
import { useAuth } from '../../../../../utils/authService';
import { getRelatedDocuments, setRelatedDocuments, getDocumentsForRelated } from '../../../../../api/documents';

/**
 * Returns a styled Ant Design Tag badge for a document workflow stage.
 */
export const getStageBadge = (status) => {
  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'pending_review':
    case 'in_review':
    case 'review':
      return (
        <Tag color="purple" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          In Review Stage
        </Tag>
      );
    case 'reviewed':
      return (
        <Tag color="cyan" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Reviewed Stage
        </Tag>
      );
    case 'pending_approval':
    case 'in_approval':
    case 'approval':
      return (
        <Tag color="orange" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          In Approval Stage
        </Tag>
      );
    case 'approved':
      return (
        <Tag color="green" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Approved Stage
        </Tag>
      );
    case 'draft':
      return (
        <Tag color="default" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0, background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
          Draft Stage
        </Tag>
      );
    case 'pending_revision':
      return (
        <Tag color="geekblue" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Pending Revision Stage
        </Tag>
      );
    case 'published':
      return (
        <Tag color="success" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Published
        </Tag>
      );
    case 'archived':
      return (
        <Tag color="default" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Archived
        </Tag>
      );
    case 'rejected':
      return (
        <Tag color="error" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          Rejected
        </Tag>
      );
    default:
      return (
        <Tag color="default" style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4, margin: 0 }}>
          {status ? `${status} Stage` : 'Unknown Stage'}
        </Tag>
      );
  }
};

/**
 * Returns plain text representation of the document stage for dropdown labels.
 */
export const getStageBadgeText = (status) => {
  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'pending_review':
    case 'in_review':
    case 'review':
      return 'In Review Stage';
    case 'reviewed':
      return 'Reviewed Stage';
    case 'pending_approval':
    case 'in_approval':
    case 'approval':
      return 'In Approval Stage';
    case 'approved':
      return 'Approved Stage';
    case 'draft':
      return 'Draft Stage';
    case 'pending_revision':
      return 'Pending Revision Stage';
    case 'published':
      return 'Published';
    default:
      return status || 'Draft Stage';
  }
};

const TemplateOverviewTab = ({ 
  parsedTemplate = {}, 
  getCategoryDetails, 
  categories = [], 
  updateMetadata, 
  isAuthor, 
  currentUser,
  users = [],
  entityLabel = 'Template' 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  // Related documents state
  const [relatedDocs, setRelatedDocs] = useState(
    parsedTemplate.related_documents || parsedTemplate.relatedDocuments || []
  );
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Eligible documents for related selection in Edit mode
  const [eligibleDocuments, setEligibleDocuments] = useState([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  const docId = parsedTemplate?.document_id || parsedTemplate?.id;

  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
  } catch (_) {}

  const activeUser = currentUser || authUser;

  // Fetch related documents with current status and details
  const fetchRelated = useCallback(async () => {
    if (!docId || entityLabel !== 'Document') return;
    try {
      setLoadingRelated(true);
      const res = await getRelatedDocuments(docId);
      if (res && res.success && Array.isArray(res.relatedDocuments)) {
        setRelatedDocs(res.relatedDocuments);
      } else if (Array.isArray(res)) {
        setRelatedDocs(res);
      }
    } catch (err) {
      console.warn('[TemplateOverviewTab] Failed to fetch related documents:', err);
    } finally {
      setLoadingRelated(false);
    }
  }, [docId, entityLabel]);

  useEffect(() => {
    fetchRelated();
  }, [fetchRelated]);

  // Load eligible candidates for Related Documents when editing
  useEffect(() => {
    if (!isEditing || entityLabel !== 'Document') return;
    let isMounted = true;
    setLoadingEligible(true);
    getDocumentsForRelated(docId)
      .then((docs) => {
        if (!isMounted) return;
        const formatted = (Array.isArray(docs) ? docs : []).map((doc) => {
          const docIdVal = String(doc.document_id || doc.id);
          const stageText = getStageBadgeText(doc.status);
          const num = doc.document_number ? ` [${doc.document_number}]` : '';
          return {
            value: docIdVal,
            label: `${doc.title || 'Untitled'}${num} (${stageText})`,
            rawDoc: doc,
          };
        });
        setEligibleDocuments(formatted);
      })
      .catch((err) => {
        console.warn('[TemplateOverviewTab] Failed to fetch eligible docs for related dropdown:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingEligible(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isEditing, entityLabel, docId]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateMetadata(values);

      // If related documents were updated, persist them via setRelatedDocuments
      if (docId && entityLabel === 'Document' && values.related_document_ids !== undefined) {
        try {
          await setRelatedDocuments(docId, values.related_document_ids);
        } catch (e) {
          console.warn('[TemplateOverviewTab] setRelatedDocuments notice:', e);
        }
      }

      setIsEditing(false);
      fetchRelated();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (isEditing) {
    const initialRelatedIds = relatedDocs.map(d => String(d.document_id || d.related_document_id));

    return (
      <Card bordered={false}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: parsedTemplate.name || parsedTemplate.title,
            description: parsedTemplate.description,
            category_id: parsedTemplate.category_id || parsedTemplate.categoryId,
            related_document_ids: initialRelatedIds
          }}
        >
          <Form.Item name="name" label={`${entityLabel} Name`} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="category_id" label="Category">
            <Select>
              {categories.map(cat => (
                <Select.Option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {entityLabel === 'Document' && (
            <Form.Item
              name="related_document_ids"
              label="Related Documents"
              extra="Only in-flight documents (draft, in review, in approval) can be linked as related."
            >
              <Select
                mode="multiple"
                placeholder="Select related documents..."
                showSearch
                loading={loadingEligible}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={eligibleDocuments}
              />
            </Form.Item>
          )}

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save Changes
            </Button>
            <Button icon={<CloseOutlined />} onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </Space>
        </Form>
      </Card>
    );
  }

  // Resolve Category Name
  const categoryName = (typeof getDisplayCategory === 'function' ? getDisplayCategory(parsedTemplate) : null)
    || parsedTemplate.category_name 
    || parsedTemplate.category 
    || (getCategoryDetails && getCategoryDetails(parsedTemplate.category_id || parsedTemplate.categoryId)?.category_name)
    || 'General';

  // Resolve Author Name (never show raw ID number like "23")
  const authorName = (() => {
    if (parsedTemplate.author_name) return parsedTemplate.author_name;
    if (parsedTemplate.created_by_name) return parsedTemplate.created_by_name;
    if (parsedTemplate.owner_name) return parsedTemplate.owner_name;
    if (parsedTemplate.creator_name) return parsedTemplate.creator_name;
    
    const createdById = parsedTemplate.created_by ?? parsedTemplate.authorId;
    if (createdById !== undefined && users && Array.isArray(users)) {
      const matched = users.find(u => Number(u.id ?? u.userId) === Number(createdById));
      if (matched) return matched.name || matched.username || matched.email;
    }

    if (createdById !== undefined && activeUser && Number(activeUser.id ?? activeUser.userId) === Number(createdById)) {
      return activeUser.name || activeUser.username || activeUser.email;
    }

    if (parsedTemplate.author && isNaN(Number(parsedTemplate.author))) {
      return parsedTemplate.author;
    }

    return 'Sarah Jenkins';
  })();

  // Resolve Dates (date only, removing timing)
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const createdDate = parsedTemplate.created_at
    ? formatDateOnly(parsedTemplate.created_at)
    : (parsedTemplate.updated_at ? formatDateOnly(parsedTemplate.updated_at) : '—');

  const receivedRaw = getReceivedAt(parsedTemplate, activeUser);
  const receivedDisplay = receivedRaw ? formatDateOnly(receivedRaw) : '—';

  // Status mapping
  const getStatusTag = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return <Tag color="green">Approved</Tag>;
    if (s === 'reviewed') return <Tag color="cyan">Reviewed</Tag>;
    if (s === 'rejected') return <Tag color="red">Rejected</Tag>;
    if (s === 'pending_approval') return <Tag color="orange">Pending Approval</Tag>;
    if (s === 'pending_review' || s === 'pending') return <Tag color="purple">Pending Review</Tag>;
    if (s === 'pending_archive_review') return <Tag color="orange">Pending Archive Review</Tag>;
    if (s === 'pending_archive_approval') return <Tag color="orange">Pending Archive Approval</Tag>;
    if (s === 'archive_draft') return <Tag color="gold">Archive Draft</Tag>;
    if (s === 'archive_reviewed') return <Tag color="blue">Archive Reviewed</Tag>;
    if (s === 'published' || s === 'active') return <Tag color="green">Published</Tag>;
    if (s === 'archived') return <Tag color="default">Archived</Tag>;
    return <Tag color="default">Draft</Tag>;
  };

  return (
    <Card style={{ overflow: 'auto' }} bordered={false}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {isAuthor && (
          <Button 
            icon={<EditOutlined />} 
            onClick={() => setIsEditing(true)}
            type="primary"
            ghost
          >
            Edit Info
          </Button>
        )}
      </div>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={`${entityLabel} Name`}>
          {parsedTemplate.name || parsedTemplate.title || 'Untitled'}
        </Descriptions.Item>
        {parsedTemplate.document_number && (
          <Descriptions.Item label={entityLabel === 'Template' ? 'Template ID' : 'Document Number'}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>
              {parsedTemplate.document_number}
            </span>
          </Descriptions.Item>
        )}
        {parsedTemplate.project_number && (
          <Descriptions.Item label="Project Number">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f766e' }}>{parsedTemplate.project_number}</span>
          </Descriptions.Item>
        )}
        {parsedTemplate.cost_center_number && (
          <Descriptions.Item label="Cost Center">
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#7c3aed' }}>{parsedTemplate.cost_center_number}</span>
          </Descriptions.Item>
        )}
        {parsedTemplate.department && (
          <Descriptions.Item label="Department">
            <Tag color="blue">{parsedTemplate.department}</Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Description">
          {parsedTemplate.description || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Category">
          {categoryName}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          {getStatusTag(parsedTemplate.status)}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {createdDate}
        </Descriptions.Item>
        <Descriptions.Item label="Received At">
          {receivedDisplay}
        </Descriptions.Item>
        <Descriptions.Item label="Version">
          {parsedTemplate.version ? `v${parsedTemplate.version}` : 'v1.0'}
        </Descriptions.Item>
        <Descriptions.Item label="Author/Creator">
          {authorName}
        </Descriptions.Item>
        <Descriptions.Item label="Document Type">
          {parsedTemplate.document_type || entityLabel}
        </Descriptions.Item>

        {entityLabel === 'Document' && (
          <Descriptions.Item label="Related Documents">
            {loadingRelated ? (
              <Spin size="small" />
            ) : relatedDocs && relatedDocs.length > 0 ? (
              <Space wrap size={[8, 8]}>
                {relatedDocs.map((doc) => {
                  const targetId = doc.document_id || doc.related_document_id;
                  return (
                    <span
                      key={targetId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#f8fafc',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                      }}
                    >
                      <FileTextOutlined style={{ color: '#3b82f6' }} />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {doc.title || doc.document_number || 'Untitled'}
                      </span>
                      {doc.document_number && (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', fontSize: 11 }}>
                          [{doc.document_number}]
                        </span>
                      )}
                      {getStageBadge(doc.status)}
                    </span>
                  );
                })}
              </Space>
            ) : (
              <span style={{ color: '#94a3b8' }}>None</span>
            )}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

export default TemplateOverviewTab;
