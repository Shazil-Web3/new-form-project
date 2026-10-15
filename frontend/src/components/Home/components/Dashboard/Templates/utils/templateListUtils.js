import React from 'react';
import { 
  FileOutlined, 
  EditOutlined, 
  StopOutlined,
  FileTextOutlined,
  FilePdfOutlined
} from '@ant-design/icons';

// Status display helper function
export const getStatusDisplay = (status) => {
  switch (status) {
    case 'published':
      return { color: 'success', icon: <FileOutlined />, text: 'Published' };
    case 'pending_revision':
      return { color: 'warning', icon: <EditOutlined />, text: 'Revision' };
    case 'disabled':
      return { color: 'error', icon: <StopOutlined />, text: 'Disabled' };
    default:
      return { color: 'default', icon: <FileOutlined />, text: status || 'Unknown' };
  }
};

// Template icon helper
export const getTemplateIcon = (template) => {
  const templateName = template.title || template.name || "";
  if (templateName.toLowerCase().includes('contract')) {
    return <FileTextOutlined />;
  } else if (templateName.toLowerCase().includes('proposal')) {
    return <FilePdfOutlined />;
  } else {
    return <FileOutlined />;
  }
};

// Category Helper Functions
export const getCategoryNameById = (categoryId, categoryList = []) => {
  const category = categoryList.find(c => c.category_id === categoryId);
  return category ? category.category_name : `Category ${categoryId}`;
};

export const getCategoryBreadcrumb = (categoryId, orgCategories = []) => {
  if (!categoryId) return [];
  
  const breadcrumbs = [];
  let currentCategory = orgCategories.find(c => c.category_id === categoryId);
  
  while (currentCategory) {
    breadcrumbs.unshift({
      id: currentCategory.category_id,
      name: currentCategory.category_name
    });
    
    if (currentCategory.parent_category_id) {
      currentCategory = orgCategories.find(c => c.category_id === currentCategory.parent_category_id);
    } else {
      currentCategory = null;
    }
  }
  
  return breadcrumbs;
};

export const getSubcategories = (parentCategoryId, orgCategories = []) => {
  if (parentCategoryId === 0) {
    return orgCategories.filter(category => !category.parent_category_id);
  }
  return orgCategories.filter(category => category.parent_category_id === parentCategoryId);
};

export const formatTemplateData = (template, orgCategories = []) => {
  const isPublicTemplate = !template.organization_id;
  
  if (isPublicTemplate) {
    return {
      id: template.id,
      title: template.title,
      description: template.description || "No description available",
      content: template.content,
      lockedSections: template.lockedSections,
      isLocked: template.lockedSections && JSON.parse(template.lockedSections).length > 0,
      status: "published",
      isDisabled: false
    };
  }
  
  let formattedTitle = template.name;
  if (template.category_id) {
    const category = orgCategories.find(c => c.category_id === template.category_id);
    if (category && category.category_prefix) {
      formattedTitle = `${category.category_prefix} - ${template.name}`;
    }
  }
  
  return {
    id: template.id,
    title: formattedTitle,
    originalTitle: template.name,
    description: template.description || "No description available",
    content: template.content,
    lockedSections: template.locked_sections,
    requiredApprovers: template.required_approvers,
    categoryId: template.category_id,
    createdBy: template.created_by,
    status: template.status,
    version: template.version,
    createdAt: new Date(template.created_at).toLocaleDateString(),
    updatedAt: new Date(template.updated_at).toLocaleDateString(),
    isLocked: template.locked_sections && JSON.parse(template.locked_sections).length > 0,
    hasApprovers: template.required_approvers && JSON.parse(template.required_approvers).length > 0,
    isDisabled: template.status === 'disabled'
  };
};
