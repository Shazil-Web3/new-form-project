import React, { useState } from 'react';
import axios from 'axios';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Select, 
  Tag, 
  Space, 
  Popconfirm, 
  notification, 
  Card, 
  Typography, 
  Divider, 
  List, 
  Checkbox,
  Empty,
  Input
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  CheckCircleOutlined,
  TeamOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const TemplateApproversConfig = ({ templates = [], users = [], departments = [], fetchUserData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingSetId, setEditingSetId] = useState(null);
  const [form] = Form.useForm();
  
  // Track selected departments in form
  const [selectedDepts, setSelectedDepts] = useState([]);
  // Track stage number per department: { [deptName]: stageNumber }
  const [deptStages, setDeptStages] = useState({});

  // Filter templates that are published (or approved)
  const publishedTemplates = (templates || []).filter(t => t.status === 'published' || t.status === 'approved');

  // Flat-map configured templates into individual sets for the table
  const tableData = React.useMemo(() => {
    const data = [];
    templates.forEach(t => {
      if (!t.custom_document_approvers) return;
      try {
        const parsed = typeof t.custom_document_approvers === 'string'
          ? JSON.parse(t.custom_document_approvers)
          : t.custom_document_approvers;
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && parsed[0].name !== undefined) {
            parsed.forEach(set => {
              data.push({
                ...t,
                key: `${t.id}-${set.id}`,
                setId: set.id,
                setName: set.name,
                setComment: set.comment,
                departmentsConfig: set.departments
              });
            });
          } else {
            // Legacy format: treat as a single default set
            data.push({
              ...t,
              key: `${t.id}-default`,
              setId: 'default',
              setName: 'Default Set',
              setComment: 'Legacy configuration',
              departmentsConfig: parsed
            });
          }
        }
      } catch (e) {}
    });
    return data;
  }, [templates]);

  const handleOpenAddModal = () => {
    setEditingTemplate(null);
    setEditingSetId(null);
    setSelectedDepts([]);
    setDeptStages({});
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record) => {
    setEditingTemplate(record);
    setEditingSetId(record.setId);
    form.resetFields();
    form.setFieldsValue({ 
      templateId: record.id,
      setName: record.setName,
      setComment: record.setComment
    });

    const deptsConfig = record.departmentsConfig || [];
    const depts = deptsConfig.map(item => item.department);
    const stages = {};
    deptsConfig.forEach(item => {
      stages[item.department] = item.stage || 1;
    });

    setSelectedDepts(depts);
    setDeptStages(stages);
    form.setFieldsValue({ departments: depts });
    setIsModalOpen(true);
  };

  const handleDeleteConfig = async (record) => {
    try {
      const template = templates.find(t => t.id === record.id);
      if (!template) return;

      let existingSets = [];
      if (template.custom_document_approvers) {
        try {
          const parsed = typeof template.custom_document_approvers === 'string'
            ? JSON.parse(template.custom_document_approvers)
            : template.custom_document_approvers;
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && parsed[0].name !== undefined) {
              existingSets = parsed;
            } else {
              existingSets = [{
                id: 'default',
                name: 'Default Set',
                comment: 'Legacy configuration',
                departments: parsed
              }];
            }
          }
        } catch (e) {}
      }

      const updatedSets = existingSets.filter(s => s.id !== record.setId);

      await axios.put(`/api/templates/${record.id}/custom_approvers`, {
        custom_document_approvers: updatedSets.length > 0 ? updatedSets : null
      });

      notification.success({
        message: 'Configuration Removed',
        description: 'Successfully removed custom approver set.'
      });
      fetchUserData();
    } catch (error) {
      notification.error({
        message: 'Deletion Failed',
        description: error.response?.data?.error || 'Could not delete custom approver set.'
      });
    }
  };

  const handleDeptChange = (values) => {
    setSelectedDepts(values);
    const updatedStages = {};
    const usedStages = new Set();
    
    // First, preserve stages for departments that are still selected
    values.forEach(dept => {
      if (deptStages[dept] && !usedStages.has(deptStages[dept])) {
        updatedStages[dept] = deptStages[dept];
        usedStages.add(deptStages[dept]);
      }
    });
    
    // Then, assign the next available stage to any new departments
    values.forEach(dept => {
      if (!updatedStages[dept]) {
        let stage = 1;
        while (usedStages.has(stage)) {
          stage++;
        }
        updatedStages[dept] = stage;
        usedStages.add(stage);
      }
    });
    setDeptStages(updatedStages);
  };

  const handleStageChange = (deptName, val) => {
    setDeptStages(prev => {
      const updated = { ...prev };
      const conflictDept = Object.keys(updated).find(
        (dName) => dName !== deptName && updated[dName] === val
      );
      if (conflictDept) {
        updated[conflictDept] = updated[deptName];
      }
      updated[deptName] = val;
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const templateId = editingTemplate ? editingTemplate.id : values.templateId;

      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      let existingSets = [];
      if (template.custom_document_approvers) {
        try {
          const parsed = typeof template.custom_document_approvers === 'string'
            ? JSON.parse(template.custom_document_approvers)
            : template.custom_document_approvers;
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && parsed[0].name !== undefined) {
              existingSets = parsed;
            } else {
              existingSets = [{
                id: 'default',
                name: 'Default Set',
                comment: 'Legacy configuration',
                departments: parsed
              }];
            }
          }
        } catch (e) {}
      }

      const newSet = {
        id: editingSetId || `set-${Date.now()}`,
        name: values.setName,
        comment: values.setComment || '',
        departments: selectedDepts.map(deptName => ({
          department: deptName,
          stage: deptStages[deptName] || 1,
          users: []
        }))
      };

      let updatedSets = [];
      if (editingSetId) {
        updatedSets = existingSets.map(s => s.id === editingSetId ? newSet : s);
      } else {
        updatedSets = [...existingSets, newSet];
      }

      await axios.put(`/api/templates/${templateId}/custom_approvers`, {
        custom_document_approvers: updatedSets
      });

      notification.success({
        message: 'Configuration Saved',
        description: 'Template approver set successfully saved.'
      });

      setIsModalOpen(false);
      fetchUserData();
    } catch (error) {
      console.error(error);
      notification.error({
        message: 'Save Failed',
        description: error.response?.data?.error || 'An error occurred while saving.'
      });
    }
  };

  // Columns for main table
  const columns = [
    {
      title: 'Template Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>
    },
    {
      title: 'Approver Set Name',
      dataIndex: 'setName',
      key: 'setName',
      render: (text) => <Text>{text || 'Default Set'}</Text>
    },
    {
      title: 'Comments',
      dataIndex: 'setComment',
      key: 'setComment',
      render: (text) => <Text type="secondary" style={{ fontStyle: 'italic' }}>{text || '-'}</Text>
    },
    {
      title: 'Assigned Departments & Stages',
      key: 'departments',
      render: (_, record) => {
        const parsed = record.departmentsConfig || [];
        return (
          <Space wrap>
            {parsed.map((item, idx) => (
              <Tag color="blue" key={idx}>
                {item.department} (Stage {item.stage || 1})
              </Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEditModal(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this template approvers set?"
            onConfirm={() => handleDeleteConfig(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger
              icon={<DeleteOutlined />} 
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card 
      title={
        <Space>
          <TeamOutlined />
          <span>Document Approvers (Template-wise)</span>
        </Space>
      }
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleOpenAddModal}
        >
          Add Template Approvers
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Configure default document approvers for published templates. When a document is created using one of these templates, it will automatically inherit these settings.
        </Text>
      </div>

      <Table 
        dataSource={tableData}
        columns={columns}
        rowKey="key"
        locale={{ emptyText: <Empty description="No templates configured with custom approvers" /> }}
      />

      <Modal
        title={editingTemplate ? 'Edit Template Approvers Set' : 'Add Template Approvers Set'}
        visible={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {!editingTemplate && (
            <Form.Item
              name="templateId"
              label="Choose published template"
              rules={[{ required: true, message: 'Please select a template' }]}
            >
              <Select 
                placeholder="Select a published template"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
                notFoundContent="No published templates found"
              >
                {publishedTemplates.map(t => (
                  <Option key={t.id} value={t.id}>{t.name || `Template ${t.id}`}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {editingTemplate && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>Template: {editingTemplate.name}</Text>
            </div>
          )}

          <Form.Item
            name="setName"
            label="Approver Set Name"
            rules={[{ required: true, message: 'Please enter a name for this approver set' }]}
          >
            <Input placeholder="e.g. Finance Set, Core Engineering Set" />
          </Form.Item>

          <Form.Item
            name="setComment"
            label="Comments / Instructions"
          >
            <Input.TextArea placeholder="Describe when to use this approver set" rows={2} />
          </Form.Item>

          <Form.Item
            name="departments"
            label="Select Departments"
            rules={[{ required: true, message: 'Please select at least one department' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select departments to add approvers from"
              onChange={handleDeptChange}
              style={{ width: '100%' }}
            >
              {departments.map(d => (
                <Option key={d.id} value={d.name}>{d.name}</Option>
              ))}
            </Select>
          </Form.Item>

          {selectedDepts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Configure Department Stages:</Text>
              {selectedDepts.map(deptName => (
                <div key={deptName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                  <Text>{deptName}</Text>
                  <Select
                    value={deptStages[deptName] || 1}
                    onChange={(val) => handleStageChange(deptName, val)}
                    style={{ width: 120 }}
                  >
                    {Array.from({ length: selectedDepts.length }, (_, i) => i + 1).map(num => (
                      <Option key={num} value={num}>
                        Stage {num}
                      </Option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default TemplateApproversConfig;
