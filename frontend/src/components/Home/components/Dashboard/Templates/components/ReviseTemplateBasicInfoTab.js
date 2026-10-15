import React from 'react';
import { Card, Form, Input, Select } from 'antd';
import apiClient from '../../../../../../api/apiClient';

const { TextArea } = Input;
const { Option } = Select;

/**
 * Basic Info tab for ReviseTemplate.
 * Contains a name validator that checks for conflicts against the API,
 * but skips the check for revisions (revision_parent_id or version > 1).
 */
const ReviseTemplateBasicInfoTab = ({
  template,
  templates,
  user,
  filterCategory,
  setCategory,
  categories,
  getParentPath,
}) => {
  return (
    <Card bordered={false} title="Basic Template Information">
      <Form.Item
        name="name"
        label="Template Name"
        validateFirst
        validateDebounce={300}
        rules={[
          { required: true, message: 'Please enter a template name' },
          {
            validator: async (_, value) => {
              // Revisions intentionally reuse the parent template's name
              if (template?.revision_parent_id || Number(template?.version) > 1) {
                return Promise.resolve();
              }
              if (!value || !value.trim()) {
                return Promise.resolve();
              }
              const trimmed = value.trim().toLowerCase();
              const userOrgId = user?.orgId || user?.organization_id || user?.org_id;

              // Fast local check if templates loaded
              if (templates && user) {
                const isConflict = templates.some(
                  t =>
                    t.name &&
                    t.name.trim().toLowerCase() === trimmed &&
                    (!userOrgId || !t.organization_id || String(t.organization_id) === String(userOrgId)) &&
                    String(t.id) !== String(template?.id) &&
                    String(t.revision_parent_id) !== String(template?.id) &&
                    String(t.id) !== String(template?.revision_parent_id)
                );
                if (isConflict) {
                  return Promise.reject(new Error('A template with this name already exists in your organization.'));
                }
              }

              // Real-time authoritative check against database
              try {
                const res = await apiClient.get('/api/check-name-conflict', {
                  params: {
                    name: value.trim(),
                    type: 'template',
                    excludeId: template?.id || undefined,
                  },
                });
                if (res.data && res.data.available === false) {
                  return Promise.reject(
                    new Error(res.data.message || 'A template or document with this exact name already exists in your organization.')
                  );
                }
              } catch (err) {
                console.warn('Name conflict check warning:', err);
              }

              return Promise.resolve();
            },
          },
        ]}
      >
        <Input placeholder="Enter template name" size="large" />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, message: 'Please provide a description' }]}
      >
        <TextArea rows={4} placeholder="Describe what this template is used for and any important details" />
      </Form.Item>

      <Form.Item name="category" label="Template Category">
        <Select
          placeholder="Select a category"
          value={filterCategory}
          onChange={(value) => setCategory(value)}
          allowClear
        >
          {categories.map(category => {
            const parentPath = getParentPath(category.folder_path, category.category_id);
            return (
              <Option key={category.category_id} value={category.category_id}>
                <span style={{ fontWeight: 500 }}>{category.category_name}</span>
                {parentPath.length > 0 && (
                  <span
                    style={{
                      color: '#888',
                      fontSize: '0.85em',
                      marginLeft: '6px',
                      fontWeight: 'normal',
                    }}
                  >
                    (in {parentPath.join(' › ')})
                  </span>
                )}
              </Option>
            );
          })}
        </Select>
      </Form.Item>
    </Card>
  );
};

export default ReviseTemplateBasicInfoTab;
