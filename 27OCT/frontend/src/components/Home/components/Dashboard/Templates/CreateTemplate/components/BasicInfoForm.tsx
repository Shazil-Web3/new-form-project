import React from 'react';
import { Card, Form, Input, Select } from 'antd';
import apiClient from '../../../../../../../api/apiClient';

const { TextArea } = Input;
const { Option } = Select;

const BasicInfoForm = ({ categories, filterCategory, setCategory, templates, user, currentTemplateId }) => {
  // Function to get parent names excluding current category
  const getParentPath = (folder_path, currentId) => {
    if (!folder_path) return [];
    
    return folder_path.split('/')
      .filter(id => id != currentId) // Exclude current category ID
      .map(id => {
        const cat = categories.find(c => c.category_id == id);
        return cat ? cat.category_name : null;
      })
      .filter(Boolean)
      .reverse(); // Show nearest parent first
  };

  return (
    <Card bordered={false} title="Basic Template Information" bodyStyle={{padding: '16px'}}>
      <Form.Item
        name="name"
        label="Template Name"
        validateFirst
        validateDebounce={300}
        rules={[
          { required: true, message: 'Please enter a template name' },
          {
            validator: async (_, value) => {
              if (!value || !value.trim()) {
                return Promise.resolve();
              }
              const trimmed = value.trim().toLowerCase();
              const userOrgId = user?.orgId || user?.organization_id || user?.org_id;

              // Fast local check if templates loaded, excluding self if auto-saved
              if (templates && Array.isArray(templates)) {
                const isDuplicate = templates.some(
                  t => t.name && 
                       t.name.trim().toLowerCase() === trimmed && 
                       (!userOrgId || !t.organization_id || String(t.organization_id) === String(userOrgId)) &&
                       (!currentTemplateId || String(t.id) !== String(currentTemplateId))
                );
                if (isDuplicate) {
                  return Promise.reject(new Error('A template with this name already exists.'));
                }
              }

              // Authoritative database check for documents and templates
              try {
                const res = await apiClient.get('/api/check-name-conflict', {
                  params: {
                    name: value.trim(),
                    type: 'template',
                    excludeId: currentTemplateId || undefined
                  }
                });
                if (res.data && res.data.available === false) {
                  return Promise.reject(new Error(res.data.message || 'A template or document with this exact name already exists in your organization.'));
                }
              } catch (err) {
                console.warn('Name conflict check warning:', err);
              }

              return Promise.resolve();
            }
          }
        ]}
        style={{ marginBottom: '16px' }}
      >
        <Input placeholder="Enter template name" size="middle" />
      </Form.Item>
      
      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, message: 'Please provide a description' }]}
        style={{ marginBottom: '16px' }}
      >
        <TextArea rows={3} placeholder="Describe what this template is used for and any important details" />
      </Form.Item>
      
      <Form.Item
        name="category"
        label="Template Category"
        style={{ marginBottom: '16px' }}
      >
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
                  <span style={{
                    color: '#888',
                    fontSize: '0.85em',
                    marginLeft: '6px',
                    fontWeight: 'normal'
                  }}>
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

export default BasicInfoForm;
