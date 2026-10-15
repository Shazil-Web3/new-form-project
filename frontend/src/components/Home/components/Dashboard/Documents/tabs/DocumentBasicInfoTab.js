import React from 'react';
import { Card, Form, Input, Select, Tag } from 'antd';
import apiClient from '../../../../../../api/apiClient';

const { Option } = Select;

export const DocumentBasicInfoTab = ({
  user,
  templates = [],
  availableTemplates = [],
  departments = [],
  document = null,
  currentDocumentId = null,
  documentNumber,
  projectNumber,
  costCenterNumber,
  updateDepartmentNumbers,
  setContentData,
  debouncedSave,
  handleTemplateSelectChange,
  handleImpactTemplateChange,
  // Related Documents props:
  // Published documents CANNOT be selected in related documents.
  // Documents in review, documents in approval, as well as in draft can be selected.
  relatedDocumentCandidates = [],
  publishedDocuments = [],
  relatedDocumentIds = [],
  onRelatedDocumentsChange,
}) => {
  const candidateDocs = (relatedDocumentCandidates && relatedDocumentCandidates.length > 0)
    ? relatedDocumentCandidates
    : publishedDocuments;

  // Filter: published, revised, and archived documents CANNOT be selected.
  // Documents in draft, review, and approval CAN be selected.
  const selfId = currentDocumentId || document?.document_id || document?.id;
  const relatedDocOptions = candidateDocs
    .filter(doc => 
      doc.status !== 'published' && 
      doc.status !== 'revised' && 
      doc.status !== 'archived' && 
      doc.status !== 'disabled' &&
      (!selfId || String(doc.document_id) !== String(selfId))
    )
    .map((doc) => ({
      value: String(doc.document_id || ''),
      label: String(doc.title || ''),
      badge: doc.status
        ? doc.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : undefined,
    }));

  // Currently selected IDs always as strings
  const selectedRelatedIds = (relatedDocumentIds || []).map(String);

  return (
    <Card bordered={false} title="Basic Document Information">
      <Form.Item
        name="title"
        label="Document Title"
        validateFirst
        validateDebounce={300}
        rules={[
          { required: true, message: 'Please enter a document title' },
          {
            validator: async (_, value) => {
              if (!value || !value.trim()) {
                return Promise.resolve();
              }
              const trimmed = value.trim().toLowerCase();
              const userOrgId = user?.orgId || user?.organization_id || user?.org_id;

              // Fast client-side check if templates are in memory
              if (templates && Array.isArray(templates)) {
                const isLocalConflict = templates.some(
                  t => t.name && 
                       t.name.trim().toLowerCase() === trimmed && 
                       (!userOrgId || !t.organization_id || String(t.organization_id) === String(userOrgId))
                );
                if (isLocalConflict) {
                  return Promise.reject(new Error('A template with this name already exists in your organization.'));
                }
              }

              // Real-time authoritative check against database (both templates and documents)
              try {
                const effectiveExcludeId = document?.document_id || document?.id || currentDocumentId || undefined;
                const res = await apiClient.get('/api/check-name-conflict', {
                  params: {
                    name: value.trim(),
                    type: 'document',
                    excludeId: effectiveExcludeId
                  }
                });
                if (res.data && res.data.available === false) {
                  return Promise.reject(new Error(res.data.message || 'A document or template with this name already exists in your organization.'));
                }
              } catch (err) {
                // If network check fails, fallback without blocking user typing
                console.warn('Name availability check warning:', err);
              }

              return Promise.resolve();
            }
          }
        ]}
      >
        <Input placeholder="Enter document title" size="large" />
      </Form.Item>

      <Form.Item
        name="department"
        label="Department"
        rules={[{ required: true, message: 'Please select a department' }]}
      >
        <Select
          placeholder="Select a department"
          showSearch
          optionFilterProp="children"
          onChange={(value) => {
            updateDepartmentNumbers(value);
            setContentData((prev) => {
              const safePrev = prev && typeof prev === 'object' ? prev : {};
              const nextLogo = safePrev.logo ? { ...safePrev.logo, textRight: value || '' } : { textRight: value || '' };
              return {
                ...safePrev,
                logo: nextLogo,
                logoTextRight: value || ''
              };
            });
            debouncedSave();
          }}
        >
          {departments.map(dept => (
            <Option key={dept.id || dept.name} value={dept.name}>
              {dept.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="documentNumber" noStyle>
        <input type="hidden" />
      </Form.Item>
      <Form.Item name="projectNumber" noStyle>
        <input type="hidden" />
      </Form.Item>
      <Form.Item name="costCenterNumber" noStyle>
        <input type="hidden" />
      </Form.Item>

      {(documentNumber || projectNumber || costCenterNumber) ? (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 20,
          marginTop: -6,
          marginBottom: 18,
          padding: '10px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          width: 'fit-content'
        }}>
          {documentNumber ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Document Number:
              </span>
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontWeight: 700,
                fontSize: '14px',
                color: '#0f172a',
                letterSpacing: '0.5px'
              }}>
                {documentNumber}
              </span>
            </div>
          ) : null}

          {projectNumber ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: documentNumber ? '1px solid #cbd5e1' : 'none',
              paddingLeft: documentNumber ? 16 : 0
            }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Project Number:
              </span>
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontWeight: 700,
                fontSize: '14px',
                color: '#6b21a8',
                letterSpacing: '0.5px'
              }}>
                {projectNumber}
              </span>
            </div>
          ) : null}

          {costCenterNumber ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: (documentNumber || projectNumber) ? '1px solid #cbd5e1' : 'none',
              paddingLeft: (documentNumber || projectNumber) ? 16 : 0
            }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Cost Center:
              </span>
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontWeight: 700,
                fontSize: '14px',
                color: '#0e7490',
                letterSpacing: '0.5px'
              }}>
                {costCenterNumber}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <Form.Item
        name="templateId"
        label="Template"
      >
        <Select
          placeholder="Select a template (optional)"
          showSearch
          allowClear
          optionFilterProp="children"
          onChange={handleTemplateSelectChange}
          filterOption={(input, option) => {
            const children = option.children;
            if (typeof children === 'string') {
              return children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
            }
            if (children && typeof children === 'object') {
              const text = Array.isArray(children)
                ? children.map(c => {
                  if (typeof c === 'string') return c;
                  if (c && c.props && c.props.children) {
                    return typeof c.props.children === 'string' ? c.props.children : '';
                  }
                  return '';
                }).join(' ')
                : (children.props?.children || '').toString();
              return text.toLowerCase().indexOf(input.toLowerCase()) >= 0;
            }
            return false;
          }}
        >
          {availableTemplates.map(template => (
            <Option key={template.id} value={template.id}>
              <div>
                <span>{template.name}</span>
                <Tag
                  color={template.status === 'published' ? 'green' : template.status === 'revised' ? 'red' : 'orange'}
                  style={{ marginLeft: 8, fontSize: '10px' }}
                >
                  {template.status === 'published' ? 'Published' : template.status === 'revised' ? 'Revised Version' : 'Revision'}
                </Tag>
              </div>
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="impactTemplateId"
        label="Impact Template"
        extra="Optional. Select a published template to use as a structured Impact form."
      >
        <Select
          placeholder="Select an impact template (optional)"
          allowClear
          showSearch
          optionFilterProp="children"
          onChange={handleImpactTemplateChange}
          filterOption={(input, option) => {
            if (!option) return false;
            const label = typeof option.children === 'string'
              ? option.children
              : '';
            return label.toLowerCase().includes(input.toLowerCase());
          }}
        >
          {templates
            .filter(t => t.status === 'published')
            .map(t => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))
          }
        </Select>
      </Form.Item>

      {/* ── Related Documents ─────────────────────────────────────────────────
          Published documents CANNOT be selected in related documents.
          Documents in review, documents in approval, and in draft can be selected.
      ─────────────────────────────────────────────────────────────────────── */}
      <Form.Item
        name="related_document_ids"
        label={
          <span style={{ fontWeight: 600 }}>
            Related Documents{' '}
            <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8' }}>(Optional)</span>
          </span>
        }
        extra={
          selectedRelatedIds.length > 0
            ? '⚡ Synchronized publishing active — this document cannot be published until all selected related documents are also approved and published.'
            : 'Select related documents in Draft, Under Review, or Under Approval. Published documents cannot be selected.'
        }
      >
        <Select
          mode="multiple"
          allowClear
          showSearch
          placeholder={
            relatedDocOptions.length === 0
              ? 'No draft, review, or approval documents available'
              : 'Select related documents (draft, review, approval)...'
          }
          value={selectedRelatedIds}
          onChange={(ids) => {
            if (typeof onRelatedDocumentsChange === 'function') {
              onRelatedDocumentsChange(ids);
            }
          }}
          disabled={relatedDocOptions.length === 0}
          style={{ width: '100%' }}
          filterOption={(input, option) => {
            const labelStr = String(option?.title || option?.value || '');
            return labelStr.toLowerCase().includes(input.toLowerCase());
          }}
          tagRender={({ label, value, closable, onClose }) => {
            const opt = relatedDocOptions.find(o => String(o.value) === String(value));
            const badge = opt?.badge;
            return (
              <Tag
                closable={closable}
                onClose={onClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginRight: 4,
                  marginTop: 2,
                  marginBottom: 2,
                  borderRadius: 6,
                  padding: '2px 8px',
                  backgroundColor: '#eff6ff',
                  borderColor: '#bfdbfe',
                  color: '#1e40af',
                  fontWeight: 500,
                }}
              >
                <span>{opt?.label || label}</span>
                {badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '0 4px',
                      borderRadius: 4,
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      marginLeft: 4,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Tag>
            );
          }}
        >
          {relatedDocOptions.map((doc) => (
            <Option key={doc.value} value={doc.value} title={doc.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.label}
                </span>
                {doc.badge && (
                  <Tag
                    color={
                      doc.badge.toLowerCase().includes('draft') ? 'default' :
                      doc.badge.toLowerCase().includes('review') ? 'processing' :
                      doc.badge.toLowerCase().includes('approv') ? 'warning' : 'blue'
                    }
                    style={{ marginLeft: 8, fontSize: 10, lineHeight: '16px' }}
                  >
                    {doc.badge}
                  </Tag>
                )}
              </div>
            </Option>
          ))}
        </Select>
      </Form.Item>
    </Card>
  );
};

export default DocumentBasicInfoTab;
