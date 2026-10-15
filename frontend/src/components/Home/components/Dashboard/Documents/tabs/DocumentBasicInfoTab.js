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
  handleImpactTemplateChange
}) => {
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
    </Card>
  );
};

export default DocumentBasicInfoTab;
