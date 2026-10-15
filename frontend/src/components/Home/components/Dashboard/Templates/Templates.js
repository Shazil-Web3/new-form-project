import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../../utils/alerts';
import { sanitizeHtml } from '../../../../../utils/sanitizeHtml';
import TemplatePreviewModal from './components/TemplatePreviewModal';
import TemplateBlockView from './components/TemplateBlockView';
import TemplateListView from './components/TemplateListView';
import CategoryModals from './components/CategoryModals';
import { 
  getStatusDisplay, 
  getTemplateIcon, 
  getCategoryNameById, 
  getCategoryBreadcrumb, 
  getSubcategories, 
  formatTemplateData 
} from './utils/templateListUtils';
import { 
  Card, 
  List, 
  Button, 
  Tag, 
  Avatar, 
  Typography, 
  Tabs, 
  Empty, 
  Radio, 
  Space, 
  Tooltip, 
  Divider,
  Badge,
  Skeleton,
  Breadcrumb,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Table,
  Dropdown,
  Menu,
  Spin,
  Descriptions,
  Alert
} from 'antd';
import { 
  FileOutlined, 
  EyeOutlined, 
  EditOutlined, 
  FolderOutlined,
  FolderAddOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  LockOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarsOutlined,
  PlusOutlined,
  GlobalOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  MoreOutlined,
  CopyOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  EllipsisOutlined,
  InboxOutlined,
  RollbackOutlined,
  FileSearchOutlined,
  PrinterOutlined,
  DownloadOutlined,
  CalendarOutlined,
  ArchiveBoxOutlined,
  BranchesOutlined,
  HistoryOutlined,
  StopOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';



const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const Templates = ({ user, navigate, fetchUserData, templates, users, PUBLIC_TEMPLATES, handleUseTemplate, handleReviseTemplate, categories, departments }) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'blocks' or 'list'
  const [publicTemplates] = useState(PUBLIC_TEMPLATES);
  const [orgTemplates, setOrgTemplates] = useState([]);
  const [orgCategories, setOrgCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState({ id: 0, path: "" });
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);
  const [addCategoryForm] = Form.useForm();
  const [editCategoryVisible, setEditCategoryVisible] = useState(false);
  const [editCategoryForm] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState("2");
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [archivingTemplates, setArchivingTemplates] = useState(new Set());
  const [statusChangingTemplates, setStatusChangingTemplates] = useState(new Set());


  // Fetch organization templates from the database
  useEffect(() => {
    const fetchOrgTemplates = async () => {
      try {
        setLoading(true);
        if (templates && templates.length > 0) {
          // Include both published and disabled templates
          const orgTemps = templates.filter(t => 
            t.organization_id === user.orgId && 
            ['published', 'pending_revision', 'disabled'].includes(t.status)
          );
          setOrgTemplates(orgTemps);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoading(false);
      }
    };

    const processOrgCategories = () => {
      if (categories && categories.length > 0) {
        const templateCategories = categories.filter(c => c.organization_id === user.orgId);
        setOrgCategories(templateCategories);
      }
    };

    fetchOrgTemplates();
    processOrgCategories();
  }, [user, templates, categories]);

  // API Functions
  const handleTemplateStatusUpdate = async (templateId, newStatus) => {
    try {
      const response = await axios.put(`/api/templates/${templateId}/status`, {
        status: newStatus
      });
      
      if (response.status === 200) {
        return response.data;
      }
      throw new Error('Failed to update template status');
    } catch (error) {
      console.error('Error updating template status:', error);
      throw error;
    }
  };

  // Template Status Management Functions
  const handleArchiveTemplate = async (templateId) => {
    setArchivingTemplates(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, 'archived');
      message.success('Template successfully archived');
      fetchUserData();
    } catch (error) {
      console.error('Error archiving template:', error);
      message.error('Failed to archive template. Please try again.');
    } finally {
      setArchivingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };

  const handleToggleTemplateStatus = async (templateId, currentStatus) => {
    const newStatus = currentStatus === 'published' ? 'disabled' : 'published';
    const actionText = newStatus === 'disabled' ? 'disable' : 'enable';
    
    setStatusChangingTemplates(prev => new Set([...prev, templateId]));
    
    try {
      await handleTemplateStatusUpdate(templateId, newStatus);
      message.success(`Template successfully ${actionText}d`);
      fetchUserData();
    } catch (error) {
      console.error(`Error ${actionText}ing template:`, error);
      message.error(`Failed to ${actionText} template. Please try again.`);
    } finally {
      setStatusChangingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };


  // Template Action Handlers
  const handlePreviewTemplate = (template) => {
    setSelectedTemplate(template);
    setPreviewModalVisible(true);
  };

  const handleUseTemplateWithCheck = (templateId, isDisabled) => {
    if (isDisabled) {
      message.warning('This template is currently disabled and cannot be used.');
      return;
    }
    handleUseTemplate(templateId);
  };

  // Template Actions Menu Generation
  const getTemplateBlockActions = (template) => {
    const isPublicTemplate = !template.organization_id;
    const isArchiving = archivingTemplates.has(template.id);
    const isChangingStatus = statusChangingTemplates.has(template.id);
    const formattedTemplate = formatTemplateData(template, orgCategories);
    
    const menuItems = [
      {
        key: 'preview',
        icon: <EyeOutlined />,
        label: 'Preview',
        onClick: () => handlePreviewTemplate(template)
      },
      {
        key: 'use',
        icon: <FileAddOutlined />,
        label: 'Use Template',
        disabled: formattedTemplate.isDisabled,
        onClick: () => handleUseTemplateWithCheck(template.id, formattedTemplate.isDisabled)
      }
    ];

    if (!isPublicTemplate && user?.role === 'admin') {
      // Add status toggle button
      const statusAction = {
        key: 'toggle-status',
        icon: formattedTemplate.status === 'published' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
        label: isChangingStatus 
          ? (formattedTemplate.status === 'published' ? 'Disabling...' : 'Enabling...')
          : (formattedTemplate.status === 'published' ? 'Disable Template' : 'Enable Template'),
        disabled: isChangingStatus || template.status === 'pending_revision',
        onClick: () => {
          const actionText = formattedTemplate.status === 'published' ? 'disable' : 'enable';
          confirmAlert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Template`,
            `Are you sure you want to ${actionText} this template?`,
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleToggleTemplateStatus(template.id, formattedTemplate.status);
            }
          });
        }
      };

      menuItems.push(
        statusAction,
        {
          key: 'revise',
          icon: <HistoryOutlined />,
          label: 'Revise',
          disabled: isArchiving || formattedTemplate.isDisabled || template.status === 'pending_revision',
          onClick: () => {
            confirmAlert(
              'Revise Template',
              'Are you sure you want to revise this template? The old version will be moved to old templates after the revision is published.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleReviseTemplate(template);
              }
            });
          }
        },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: isArchiving ? 'Archiving...' : 'Archive',
          disabled: isArchiving,
          onClick: () => {
            confirmAlert(
              'Archive Template',
              'Are you sure you want to archive this template? It will be moved to archived status.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleArchiveTemplate(template.id);
              }
            });
          }
        }
      );
    }

    return menuItems;
  };

  const getTemplateCategoryActions = (template) => {
    const isPublicTemplate = !template.organization_id;
    const isArchiving = archivingTemplates.has(template.id);
    const isChangingStatus = statusChangingTemplates.has(template.id);
    const formattedTemplate = formatTemplateData(template, orgCategories);
    
    const menuItems = [
      {
        key: 'preview',
        icon: <EyeOutlined />,
        label: 'Preview',
        onClick: () => handlePreviewTemplate(template)
      },
      {
        key: 'use',
        icon: <FileAddOutlined />,
        label: 'Use Template',
        disabled: formattedTemplate.isDisabled,
        onClick: () => handleUseTemplateWithCheck(template.id, formattedTemplate.isDisabled)
      }
    ];

    if (!isPublicTemplate && user?.role === 'admin') {
      const statusAction = {
        key: 'toggle-status',
        icon: formattedTemplate.status === 'published' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
        label: isChangingStatus 
          ? (formattedTemplate.status === 'published' ? 'Disabling...' : 'Enabling...')
          : (formattedTemplate.status === 'published' ? 'Disable Template' : 'Enable Template'),
        disabled: isChangingStatus || template.status === 'pending_revision',
        onClick: () => {
          const actionText = formattedTemplate.status === 'published' ? 'disable' : 'enable';
          confirmAlert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Template`,
            `Are you sure you want to ${actionText} this template?`,
            'Yes, proceed',
            'Cancel'
          ).then((result) => {
            if (result.isConfirmed) {
              handleToggleTemplateStatus(template.id, formattedTemplate.status);
            }
          });
        }
      };

      menuItems.push(
        statusAction,
        {
          key: 'revise',
          icon: <HistoryOutlined />,
          label: 'Revise',
          disabled: isArchiving || formattedTemplate.isDisabled || template.status === 'pending_revision',
          onClick: () => {
            confirmAlert(
              'Revise Template',
              'Are you sure you want to revise this template? The old version will be moved to old templates after the revision is published.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleReviseTemplate(template);
              }
            });
          }
        },
        {
          key: 'archive',
          icon: <InboxOutlined />,
          label: isArchiving ? 'Archiving...' : 'Archive',
          disabled: isArchiving,
          onClick: () => {
            confirmAlert(
              'Archive Template',
              'Are you sure you want to archive this template? It will be moved to archived status.',
              'Yes, proceed',
              'Cancel'
            ).then((result) => {
              if (result.isConfirmed) {
                handleArchiveTemplate(template.id);
              }
            });
          }
        }
      );
    }

    return menuItems;
  };

  // Category Management Functions
  const handleCategoryClick = (category) => {
    setCurrentCategory({
      id: category.category_id,
      path: category.folder_path
    });
  };

  const handleAddCategory = () => {
    setAddCategoryVisible(true);
  };

  const submitAddCategory = async () => {
    try {
      const values = await addCategoryForm.validateFields();
      
      await axios.post(`/api/add_category/${user.orgId}`, { 
        category_name: values.categoryName,
        category_prefix: values.categoryPrefix,
        parent_category_id: currentCategory.id === 0 ? null : currentCategory.id,
      });

      await fetchUserData();
      message.success('Category created successfully');
      addCategoryForm.resetFields();
      setAddCategoryVisible(false);
    } catch (error) {
      console.error("Failed to create category:", error);
      message.error('Failed to create category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await axios.delete(`/api/delete_category`, { 
        data: {
          categoryId: categoryId,
          organization_id: user.orgId,
        }
      });

      await fetchUserData();
      message.success('Category deleted successfully');
      
      if (currentCategory.id === categoryId) {
        navigateToParentCategory();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      message.error('Failed to delete category');
    }
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    editCategoryForm.setFieldsValue({
      categoryName: category.category_name,
      categoryPrefix: category.category_prefix
    });
    setEditCategoryVisible(true);
  };

  const navigateToParentCategory = () => {
    if (currentCategory.id === 0) return;
    
    const currentCategoryObj = orgCategories.find(c => c.category_id === currentCategory.id);
    if (currentCategoryObj && currentCategoryObj.parent_category_id) {
      const parentCategory = orgCategories.find(c => c.category_id === currentCategoryObj.parent_category_id);
      setCurrentCategory({
        id: parentCategory.category_id,
        path: parentCategory.folder_path
      });
    } else {
      setCurrentCategory({ id: 0, path: "" });
    }
  };

  const navigateToRoot = () => {
    setCurrentCategory({ id: 0, path: "" });
  };


  const submitEditCategory = async () => {
    try {
      const values = await editCategoryForm.validateFields();
      
      await axios.put(`/api/update_category/${selectedCategory.category_id}`, {
        category_name: values.categoryName,
        category_prefix: values.categoryPrefix,
        organization_id: user.orgId
      });

      await fetchUserData();
      message.success('Category updated successfully');
      editCategoryForm.resetFields();
      setEditCategoryVisible(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error("Failed to update category:", error);
      message.error('Failed to update category');
    }
  };

  return (
    <div className="templates-dashboard">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Document Templates</Title>
          <Space>
            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
              buttonStyle="solid"
              optionType="button"
            >
              <Radio.Button value="blocks">
                <AppstoreOutlined /> Blocks
              </Radio.Button>
              <Radio.Button value="list" disabled={activeTab === "1"}>
                <BarsOutlined /> List
              </Radio.Button>
            </Radio.Group>
          </Space>
        </div>

        <Tabs 
          defaultActiveKey="2" 
          onChange={(key) => {
            setActiveTab(key);
            setCurrentCategory({ id: 0, path: "" }); // Reset folder view when changing tabs
            if (key === "1") setViewMode('blocks'); // Force blocks view for public templates
          }}
        >
          {/* <TabPane 
            tab={
              <span>
                <GlobalOutlined /> Public Templates
              </span>
            } 
            key="1"
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              renderBlockView()
            )}
          </TabPane> */}
          <TabPane 
            tab={
              <span>
                <TeamOutlined /> Organization Templates
              </span>
            } 
            key="2"
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              viewMode === 'blocks' ? (
                <TemplateBlockView
                  activeTab={activeTab}
                  publicTemplates={publicTemplates}
                  orgTemplates={orgTemplates}
                  orgCategories={orgCategories}
                  getTemplateBlockActions={getTemplateBlockActions}
                  handleUseTemplateWithCheck={handleUseTemplateWithCheck}
                />
              ) : (
                <TemplateListView
                  activeTab={activeTab}
                  orgTemplates={orgTemplates}
                  orgCategories={orgCategories}
                  getTemplateCategoryActions={getTemplateCategoryActions}
                  handleUseTemplateWithCheck={handleUseTemplateWithCheck}
                  setViewMode={setViewMode}
                />
              )
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Category Modals */}
      <CategoryModals
        addCategoryVisible={addCategoryVisible}
        setAddCategoryVisible={setAddCategoryVisible}
        submitAddCategory={submitAddCategory}
        addCategoryForm={addCategoryForm}
        currentCategory={currentCategory}
        orgCategories={orgCategories}
        editCategoryVisible={editCategoryVisible}
        setEditCategoryVisible={setEditCategoryVisible}
        submitEditCategory={submitEditCategory}
        editCategoryForm={editCategoryForm}
      />

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        visible={previewModalVisible}
        template={selectedTemplate}
        onClose={() => setPreviewModalVisible(false)}
        categories={orgCategories}
        users={users}
        departments={departments}
      />

    </div>
  );
};

export default Templates;