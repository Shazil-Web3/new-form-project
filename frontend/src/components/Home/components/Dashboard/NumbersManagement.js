import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Typography,
  Input,
  Space,
  Modal,
  Form,
  Select,
  Divider,
  Tooltip,
  Badge,
  Switch,
  Radio,
  Tabs,
  Alert,
  Spin,
  Row,
  Col
} from 'antd';
import {
  PlusCircleOutlined,
  EditOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ProjectOutlined,
  DollarCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  LockOutlined,
  NumberOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { successAlert, errorAlert } from '../../../../utils/alerts';
import {
  listNumberRules,
  saveNumberRule,
  updateNumberRule,
  listProjectNumbers,
  createProjectNumber,
  toggleProjectNumberStatus,
  listCostCenterNumbers,
  createCostCenterNumber,
  toggleCostCenterStatus
} from '../../../../api/numbers';

const { Text, Title } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;

const NumbersManagement = ({ orgId, departments = [], requirePasswordConfirmation }) => {
  const [activeTab, setActiveTab] = useState('documents');
  const [loading, setLoading] = useState(false);

  // Document Rules State
  const [rules, setRules] = useState([]);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm] = Form.useForm();
  const [rulePrefix, setRulePrefix] = useState('FIN');
  const [ruleDigitCount, setRuleDigitCount] = useState(8);

  // Project Numbers State
  const [projects, setProjects] = useState([]);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [projectForm] = Form.useForm();
  const [projectSearch, setProjectSearch] = useState('');

  // Cost Center Numbers State
  const [costCenters, setCostCenters] = useState([]);
  const [costCenterModalVisible, setCostCenterModalVisible] = useState(false);
  const [costCenterForm] = Form.useForm();
  const [costCenterSearch, setCostCenterSearch] = useState('');

  // Fetch all data
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [rulesData, projectsData, costCentersData] = await Promise.all([
        listNumberRules(orgId).catch(() => []),
        listProjectNumbers(orgId).catch(() => []),
        listCostCenterNumbers(orgId).catch(() => [])
      ]);
      setRules(rulesData || []);
      setProjects(projectsData || []);
      setCostCenters(costCentersData || []);
    } catch (err) {
      console.error('Error loading numbers management data:', err);
      errorAlert('Load Failed', 'Could not load numbering configurations');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Document Number Rules (only type === 'document')
  const docRules = useMemo(() => {
    return rules.filter(r => r.type === 'document');
  }, [rules]);

  // Project rule if configured
  const projectRule = useMemo(() => {
    return rules.find(r => r.type === 'project') || { prefix: 'PRJ', digit_count: 6, current_number: projects.length };
  }, [rules, projects.length]);

  // Cost Center rule if configured
  const costCenterRule = useMemo(() => {
    return rules.find(r => r.type === 'cost_center') || { prefix: 'CC', digit_count: 6, current_number: costCenters.length };
  }, [rules, costCenters.length]);

  // Next Project Number Preview
  const nextProjectPreview = useMemo(() => {
    const p = (projectRule.prefix || 'PRJ').toUpperCase();
    const d = parseInt(projectRule.digit_count, 10) || 6;
    const next = (projectRule.current_number || 0) + 1;
    return `${p}-${String(next).padStart(d, '0')}`;
  }, [projectRule]);

  // Next Cost Center Number Preview
  const nextCostCenterPreview = useMemo(() => {
    const p = (costCenterRule.prefix || 'CC').toUpperCase();
    const d = parseInt(costCenterRule.digit_count, 10) || 6;
    const next = (costCenterRule.current_number || 0) + 1;
    return `${p}-${String(next).padStart(d, '0')}`;
  }, [costCenterRule]);

  // Handle open rule modal
  const handleOpenRuleModal = (rule = null) => {
    setEditingRule(rule);
    if (rule) {
      setRulePrefix(rule.prefix || 'FIN');
      setRuleDigitCount(rule.digit_count || 8);
      ruleForm.setFieldsValue({
        department_id: rule.department_id ? String(rule.department_id) : 'all',
        prefix: rule.prefix,
        digit_count: rule.digit_count || 8,
        current_number: rule.current_number || 0,
        status: rule.status || 'active'
      });
    } else {
      setRulePrefix('FIN');
      setRuleDigitCount(8);
      ruleForm.setFieldsValue({
        department_id: departments[0]?.id ? String(departments[0].id) : 'all',
        prefix: 'FIN',
        digit_count: 8,
        current_number: 0,
        status: 'active'
      });
    }
    setRuleModalVisible(true);
  };

  // Submit Rule (Create or Edit)
  const handleRuleSubmit = async () => {
    try {
      const values = await ruleForm.validateFields();
      const payload = {
        type: 'document',
        department_id: values.department_id === 'all' ? null : parseInt(values.department_id, 10),
        prefix: values.prefix.trim().toUpperCase(),
        digit_count: parseInt(values.digit_count, 10) || 8,
        current_number: parseInt(values.current_number, 10) || 0,
        status: values.status || 'active'
      };

      if (editingRule) {
        await updateNumberRule(editingRule.id, payload);
        successAlert('Rule Updated', `Numbering rule for prefix "${payload.prefix}" updated successfully`);
      } else {
        await saveNumberRule(orgId, payload);
        successAlert('Rule Created', `Numbering rule "${payload.prefix}" created successfully`);
      }

      setRuleModalVisible(false);
      ruleForm.resetFields();
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      console.error('Error saving rule:', err);
      errorAlert('Save Failed', err.response?.data?.error || err.message || 'Failed to save numbering rule');
    }
  };

  // Toggle Rule Status
  const handleToggleRuleStatus = async (record) => {
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    try {
      await updateNumberRule(record.id, { status: newStatus });
      successAlert('Status Updated', `Rule ${record.prefix} is now ${newStatus}`);
      loadData();
    } catch (err) {
      errorAlert('Update Failed', err.response?.data?.error || 'Failed to update rule status');
    }
  };

  // Submit New Project
  const handleProjectSubmit = async () => {
    try {
      const values = await projectForm.validateFields();
      await createProjectNumber(orgId, {
        name: values.name.trim(),
        department: values.department || null
      });

      successAlert('Project Number Created', `Project number generated successfully`);
      setProjectModalVisible(false);
      projectForm.resetFields();
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      console.error('Error creating project number:', err);
      errorAlert('Creation Failed', err.response?.data?.error || err.message || 'Failed to create project number');
    }
  };

  // Toggle Project Status
  const handleToggleProjectStatus = async (record) => {
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleProjectNumberStatus(record.id, newStatus);
      successAlert('Status Updated', `Project ${record.project_number} is now ${newStatus}`);
      loadData();
    } catch (err) {
      errorAlert('Update Failed', err.response?.data?.error || 'Failed to toggle project status');
    }
  };

  // Submit New Cost Center
  const handleCostCenterSubmit = async () => {
    try {
      const values = await costCenterForm.validateFields();
      await createCostCenterNumber(orgId, {
        name: values.name.trim(),
        department: values.department || null
      });

      successAlert('Cost Center Created', `Cost center number generated successfully`);
      setCostCenterModalVisible(false);
      costCenterForm.resetFields();
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      console.error('Error creating cost center number:', err);
      errorAlert('Creation Failed', err.response?.data?.error || err.message || 'Failed to create cost center number');
    }
  };

  // Toggle Cost Center Status
  const handleToggleCostCenterStatus = async (record) => {
    const newStatus = record.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleCostCenterStatus(record.id, newStatus);
      successAlert('Status Updated', `Cost Center ${record.cost_number} is now ${newStatus}`);
      loadData();
    } catch (err) {
      errorAlert('Update Failed', err.response?.data?.error || 'Failed to toggle cost center status');
    }
  };

  // Document Number Rules Columns
  const ruleColumns = [
    {
      title: 'Department',
      key: 'department',
      render: (_, record) => {
        if (!record.department_id) {
          return <Tag color="geekblue">Default (All Departments)</Tag>;
        }
        return <Text strong>{record.department_name || `Department #${record.department_id}`}</Text>;
      }
    },
    {
      title: 'Prefix',
      dataIndex: 'prefix',
      key: 'prefix',
      render: (prefix) => (
        <Tag color="blue" style={{ fontSize: '13px', fontWeight: 600, padding: '2px 8px' }}>
          {prefix}
        </Tag>
      )
    },
    {
      title: 'Digits',
      dataIndex: 'digit_count',
      key: 'digit_count',
      render: (count) => <Text>{count || 8} digits</Text>
    },
    {
      title: 'Format Separator',
      key: 'separator',
      render: () => <Tag color="default">Hyphen (-)</Tag>
    },
    {
      title: 'Next Sequential Number',
      key: 'preview',
      render: (_, record) => (
        <Tag color="green" style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, padding: '2px 10px' }}>
          {record.preview || `${record.prefix}-${String((record.current_number || 0) + 1).padStart(record.digit_count || 8, '0')}`}
        </Tag>
      )
    },
    {
      title: 'Current Counter',
      dataIndex: 'current_number',
      key: 'current_number',
      render: (num) => <Text type="secondary">{num || 0}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Button type="text" onClick={() => handleToggleRuleStatus(record)} style={{ padding: 0 }}>
          <Tag color={status === 'active' ? 'success' : 'default'} style={{ cursor: 'pointer' }}>
            {status === 'active' ? 'Active' : 'Inactive'}
          </Tag>
        </Button>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => handleOpenRuleModal(record)}
        >
          Edit
        </Button>
      )
    }
  ];

  // Project Columns
  const projectColumns = [
    {
      title: 'Project Number',
      dataIndex: 'project_number',
      key: 'project_number',
      render: (num) => (
        <Tag color="purple" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
          {num}
        </Tag>
      )
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept) => (dept ? <Tag color="blue">{dept}</Tag> : <Text type="secondary">General</Text>)
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? moment(date).format('MMM DD, YYYY') : '-')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Button type="text" onClick={() => handleToggleProjectStatus(record)} style={{ padding: 0 }}>
          <Tag color={status === 'active' ? 'success' : 'default'} style={{ cursor: 'pointer' }}>
            {status === 'active' ? 'Active' : 'Inactive'}
          </Tag>
        </Button>
      )
    }
  ];

  // Cost Center Columns
  const costCenterColumns = [
    {
      title: 'Cost Center Number',
      dataIndex: 'cost_number',
      key: 'cost_number',
      render: (num) => (
        <Tag color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
          {num}
        </Tag>
      )
    },
    {
      title: 'Cost Center Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept) => (dept ? <Tag color="blue">{dept}</Tag> : <Text type="secondary">General</Text>)
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => (date ? moment(date).format('MMM DD, YYYY') : '-')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Button type="text" onClick={() => handleToggleCostCenterStatus(record)} style={{ padding: 0 }}>
          <Tag color={status === 'active' ? 'success' : 'default'} style={{ cursor: 'pointer' }}>
            {status === 'active' ? 'Active' : 'Inactive'}
          </Tag>
        </Button>
      )
    }
  ];

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(
      p => (p.project_number && p.project_number.toLowerCase().includes(q)) ||
           (p.name && p.name.toLowerCase().includes(q))
    );
  }, [projects, projectSearch]);

  const filteredCostCenters = useMemo(() => {
    if (!costCenterSearch.trim()) return costCenters;
    const q = costCenterSearch.toLowerCase();
    return costCenters.filter(
      c => (c.cost_number && c.cost_number.toLowerCase().includes(q)) ||
           (c.name && c.name.toLowerCase().includes(q)) ||
           (c.department && c.department.toLowerCase().includes(q))
    );
  }, [costCenters, costCenterSearch]);

  return (
    <div style={{ marginTop: 8 }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* TAB 1: DOCUMENT NUMBERING */}
        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              Document Numbers
            </span>
          }
          key="documents"
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              message="Configurable Department Document Numbering"
              description={
                <span>
                  Configure a 3-4 letter prefix (e.g. <b>FIN</b>, <b>HR</b>) and digit length (<b>7 to 9 digits</b>) with an automated hyphen separator.
                  When users create a document and select the owner department, the system auto-assigns the consecutive read-only reference number (e.g. <b>FIN-00000001</b>).
                </span>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Space>
                <Text strong style={{ fontSize: '15px' }}>Department Numbering Rules</Text>
                <Badge count={docRules.length} style={{ backgroundColor: '#1890ff' }} />
              </Space>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                <Button
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={() => handleOpenRuleModal(null)}
                >
                  Add Numbering Rule
                </Button>
              </Space>
            </div>

            <Table
              dataSource={docRules}
              columns={ruleColumns}
              rowKey="id"
              loading={loading}
              pagination={false}
              locale={{ emptyText: 'No document numbering rules configured yet. Click "Add Numbering Rule" to create one.' }}
            />
          </div>
        </TabPane>

        {/* TAB 2: PROJECT NUMBERS */}
        <TabPane
          tab={
            <span>
              <ProjectOutlined />
              Project Numbers
            </span>
          }
          key="projects"
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              message="Auto-Incrementing Project Numbers"
              description={
                <span>
                  Projects are automatically assigned consecutive sequential numbers with a hyphen (e.g. <b>{nextProjectPreview}</b>).
                  Use this master list to track project codes across documents.
                </span>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <Search
                placeholder="Search project number or name..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                style={{ width: 280 }}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                <Button
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    projectForm.resetFields();
                    setProjectModalVisible(true);
                  }}
                >
                  New Project Number
                </Button>
              </Space>
            </div>

            <Table
              dataSource={filteredProjects}
              columns={projectColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'No project numbers created yet. Click "New Project Number" to generate one.' }}
            />
          </div>
        </TabPane>

        {/* TAB 3: COST CENTER NUMBERS */}
        <TabPane
          tab={
            <span>
              <DollarCircleOutlined />
              Cost Center Numbers
            </span>
          }
          key="costCenters"
        >
          <div style={{ marginBottom: 16 }}>
            <Alert
              message="Auto-Incrementing Cost Center Numbers"
              description={
                <span>
                  Cost centers are automatically assigned consecutive sequential numbers with a hyphen (e.g. <b>{nextCostCenterPreview}</b>).
                  Use this registry to associate departments with financial accounting codes.
                </span>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <Search
                placeholder="Search cost center or department..."
                value={costCenterSearch}
                onChange={(e) => setCostCenterSearch(e.target.value)}
                style={{ width: 280 }}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                <Button
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    costCenterForm.resetFields();
                    setCostCenterModalVisible(true);
                  }}
                >
                  New Cost Center Number
                </Button>
              </Space>
            </div>

            <Table
              dataSource={filteredCostCenters}
              columns={costCenterColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'No cost center numbers created yet. Click "New Cost Center Number" to generate one.' }}
            />
          </div>
        </TabPane>
      </Tabs>

      {/* MODAL: ADD / EDIT DOCUMENT NUMBER RULE */}
      <Modal
        title={editingRule ? 'Edit Department Numbering Rule' : 'New Department Numbering Rule'}
        visible={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={handleRuleSubmit}
        okText={editingRule ? 'Save Changes' : 'Create Rule'}
        destroyOnClose
      >
        <Form form={ruleForm} layout="vertical">
          <Form.Item
            name="department_id"
            label="Target Department"
            rules={[{ required: true, message: 'Please select a department' }]}
            tooltip="Choose which department this prefix applies to, or set as default."
          >
            <Select placeholder="Select department">
              <Option value="all">Default (All / Unassigned Departments)</Option>
              {departments.map((d) => (
                <Option key={d.id} value={String(d.id)}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="prefix"
                label="Prefix (3-4 Letters)"
                rules={[
                  { required: true, message: 'Please enter a prefix' },
                  { min: 2, max: 6, message: 'Prefix should be 2 to 6 characters' }
                ]}
                tooltip="Short department code, e.g. FIN for Finance, HR for Human Resources"
              >
                <Input
                  placeholder="e.g. FIN"
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => setRulePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="digit_count"
                label="Digit Length (7-9)"
                rules={[{ required: true, message: 'Select digits' }]}
                tooltip="Zero-padded length for consecutive numbers (client recommended 7 to 9)"
              >
                <Select onChange={(val) => setRuleDigitCount(val)}>
                  <Option value={7}>7 digits (0000001)</Option>
                  <Option value={8}>8 digits (00000001)</Option>
                  <Option value={9}>9 digits (000000001)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="current_number"
            label="Current Counter (Starting Value)"
            tooltip="The number to count from. First created document will be Current + 1."
          >
            <Input type="number" min={0} placeholder="0" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>

          {/* LIVE PREVIEW BOX */}
          <div style={{
            background: '#f0f5ff',
            border: '1px dashed #2f54eb',
            borderRadius: 6,
            padding: 12,
            marginTop: 8
          }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              Live Format Preview:
            </Text>
            <Space>
              <Tag color="blue" style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, padding: '4px 10px' }}>
                {rulePrefix || 'FIN'}-{String(1).padStart(ruleDigitCount || 8, '0')}
              </Tag>
              <Text type="secondary" style={{ fontSize: '12px' }}>(Next generated number)</Text>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* MODAL: NEW PROJECT NUMBER */}
      <Modal
        title="Generate New Project Number"
        visible={projectModalVisible}
        onCancel={() => setProjectModalVisible(false)}
        onOk={handleProjectSubmit}
        okText="Generate Project"
        destroyOnClose
      >
        <Form form={projectForm} layout="vertical">
          <div style={{
            background: '#fafafa',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16
          }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              Project Code:
            </Text>
            <Tag color="purple" style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, padding: '4px 10px' }}>
              {nextProjectPreview}
            </Tag>
          </div>

          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: 'Please enter a project name' }]}
          >
            <Input placeholder="e.g. Q4 Financial Audit System" />
          </Form.Item>

          <Form.Item
            name="department"
            label="Associated Department"
          >
            <Select placeholder="Select department (optional)" allowClear>
              {departments.map((d) => (
                <Option key={d.id} value={d.name}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: NEW COST CENTER NUMBER */}
      <Modal
        title="Generate New Cost Center Number"
        visible={costCenterModalVisible}
        onCancel={() => setCostCenterModalVisible(false)}
        onOk={handleCostCenterSubmit}
        okText="Generate Cost Center"
        destroyOnClose
      >
        <Form form={costCenterForm} layout="vertical">
          <div style={{
            background: '#fafafa',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16
          }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
              Cost Center Code:
            </Text>
            <Tag color="cyan" style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, padding: '4px 10px' }}>
              {nextCostCenterPreview}
            </Tag>
          </div>

          <Form.Item
            name="name"
            label="Cost Center Name"
            rules={[{ required: true, message: 'Please enter a cost center name' }]}
          >
            <Input placeholder="e.g. Operations & Logistics" />
          </Form.Item>

          <Form.Item
            name="department"
            label="Associated Department"
          >
            <Select placeholder="Select department (optional)" allowClear>
              {departments.map((d) => (
                <Option key={d.id} value={d.name}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NumbersManagement;
