import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../../../../../api/apiClient';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import { socket } from '../../../../../utils/SocketProvider';
import {
  Card, Form, Button, Select,
  Row, Col, Typography,
  Tabs, message, Badge, Dropdown, Empty, Tooltip
} from 'antd';
import {
  FileTextOutlined, SaveOutlined,
  FileTextTwoTone,
  EditOutlined, FileSearchOutlined,
  MessageOutlined, LeftOutlined, RightOutlined, DownOutlined,
  PaperClipOutlined, BookOutlined, HistoryOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import moment from 'moment';

import { debounce } from 'lodash';
import { stripCommentHighlights } from '../../../../../utils/templateUtils';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';
import EditorWrapper from './CreateTemplate/components/EditorWrapper';
import TemplateApproversModal from './components/TemplateApproversModal';
import ReviseTemplateBasicInfoTab from './components/ReviseTemplateBasicInfoTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateReviewTab from './components/TemplateReviewTab';

const { Text } = Typography;
const { Option } = Select;

const ReviseTemplate = ({ fetchUserData, template, user, users, categories, departments, templates = [], onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleCancelClick = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (typeof onCancel === 'function') {
      try {
        onCancel();
        return;
      } catch (err) {
        console.error('Error invoking onCancel callback:', err);
      }
    }
    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    } catch (_) {
      window.location.href = '/dashboard';
    }
  };
  const [filterCategory, setCategory] = useState();
  const [contentData, setContentData] = useState(null);
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [approvers, setApprovers] = useState([]);
  const [lockedElements, setLockedElements] = useState({
    content: false,
    toc: false,
    fontSize: false,
    fontStyle: false,
    headerFooter: false
  });
  const selectRef = useRef(null);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [liveInitialContent, setLiveInitialContent] = useState(null);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);

  // Sync references from contentData to tempReferences and tempManualReferences for the References tab
  useEffect(() => {
    if (contentData?.references && Array.isArray(contentData.references)) {
      setTempReferences(contentData.references.filter(r => !r.isManual && r.refAnchor));
    }
    if (contentData?.manualReferences && Array.isArray(contentData.manualReferences)) {
      setTempManualReferences(contentData.manualReferences);
    } else if (contentData?.references && Array.isArray(contentData.references)) {
      setTempManualReferences(contentData.references.filter(r => r.isManual || !r.refAnchor));
    }
  }, [contentData?.references, contentData?.manualReferences]);

  // Track tab completion status
  const [tabStatus, setTabStatus] = useState({
    basicInfo: "incomplete",
    approvers: "incomplete",
    structure: "incomplete",
    content: "incomplete",
    notes: "incomplete", 
    review: "incomplete"
  });

  const [templateApproversModalVisible, setTemplateApproversModalVisible] = useState(false);
  const [templateApprovers, setTemplateApprovers] = useState({
    reviewers: [],
    approvers: []
  });
  const [approverType, setApproverType] = useState('review'); // 'review' or 'approval'
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [selectedTemplateApprover, setSelectedTemplateApprover] = useState(null);

  const parsedTemplateForApprovers = useMemo(() => {
    return {
      status: template?.status || 'draft',
      required_approvers: approvers,
      template_approvers: templateApprovers,
      id: template?.id
    };
  }, [approvers, templateApprovers, template]);

  const getCurrentUsersToShow = useCallback(() => {
    if (!templateApprovers) return [];
    const { reviewers = [], approvers: appList = [] } = templateApprovers;
    return [...reviewers, ...appList];
  }, [templateApprovers]);

  const updateMetadata = useCallback(async (data) => {
    if (data.approvers) {
      setApprovers(data.approvers);
      const updatedFormApprovers = data.approvers.map(approver => ({
        department: approver.department,
        participants: approver.participants,
        mandatory: approver.mandatory,
        stage: approver.stage
      }));
      form.setFieldsValue({ approvers: updatedFormApprovers });
    }
  }, [setApprovers, form]);

// Add this useEffect at the beginning of your component to auto-fill form data
useEffect(() => {
  if (template) {
    // Parse JSON string values
    // Parse content and comments
    let loadedContentData = { content: '', comments: [], suggestions: [], references: [], manualReferences: [] };
    try {
      if (template.comments) {
        try {
          const parsedComments = typeof template.comments === 'string' ? JSON.parse(template.comments) : template.comments;
          if (parsedComments && typeof parsedComments.content === 'string') {
            // STRIP HIGHLIGHTS AND COMMENTS FOR REVISION
            const cleanedContent = stripCommentHighlights(parsedComments.content);
            loadedContentData = { 
              content: cleanedContent,
              comments: [], // Clear comments for new revision
              suggestions: [], // Clear suggestions for new revision
              references: (parsedComments.references && Array.isArray(parsedComments.references))
                ? parsedComments.references.filter(r => !r.isManual && r.refAnchor)
                : [],
              manualReferences: parsedComments.manualReferences || (parsedComments.references && Array.isArray(parsedComments.references)
                ? parsedComments.references.filter(r => r.isManual || !r.refAnchor)
                : []),
              headerHTML: parsedComments.headerHTML || '',
              footerHTML: parsedComments.footerHTML || '',
              logo: parsedComments.logo || null,
              logoText: parsedComments.logoText || '',
              logoTextRight: parsedComments.logoTextRight || '',
              orientation: parsedComments.orientation || template.orientation || 'portrait',
              paperSize: parsedComments.paperSize || template.paperSize || 'A4',
              pagesState: parsedComments.pagesState || template.pagesState || null
            };
          } else {
            // Check if it's the old structure (just comments array)
            const content = template.content || '';
            const cleanedContent = stripCommentHighlights(content);
            loadedContentData = { 
              content: cleanedContent,
              comments: [], 
              suggestions: [],
              references: [],
              manualReferences: [],
              orientation: template.orientation || 'portrait',
              paperSize: template.paperSize || 'A4',
              pagesState: template.pagesState || null
            };
          }
        } catch (e) {
          const content = template.content || '';
          const cleanedContent = stripCommentHighlights(content);
          loadedContentData = {
            content: cleanedContent,
            comments: [],
            suggestions: [],
            references: [],
            manualReferences: [],
            orientation: template.orientation || 'portrait',
            paperSize: template.paperSize || 'A4',
            pagesState: template.pagesState || null
          };
        }
      } else if (template.content) {
        // Fallback to content column
        try {
           const parsedContent = typeof template.content === 'string' ? JSON.parse(template.content) : template.content;
           if (typeof parsedContent === 'object' && parsedContent !== null) {
             const cleanedContent = stripCommentHighlights(parsedContent.content || '');
             loadedContentData = {
               ...parsedContent,
               content: cleanedContent,
               comments: [],
               suggestions: [],
               references: (parsedContent.references && Array.isArray(parsedContent.references))
                 ? parsedContent.references.filter(r => !r.isManual && r.refAnchor)
                 : [],
               manualReferences: parsedContent.manualReferences || (parsedContent.references && Array.isArray(parsedContent.references)
                 ? parsedContent.references.filter(r => r.isManual || !r.refAnchor)
                 : []),
               headerHTML: parsedContent.headerHTML || '',
               footerHTML: parsedContent.footerHTML || '',
               logo: parsedContent.logo || null,
               logoText: parsedContent.logoText || '',
               logoTextRight: parsedContent.logoTextRight || '',
               orientation: parsedContent.orientation || template.orientation || 'portrait',
               paperSize: parsedContent.paperSize || template.paperSize || 'A4',
               pagesState: parsedContent.pagesState || template.pagesState || null
             };
           } else {
             const cleanedContent = stripCommentHighlights(String(template.content));
             loadedContentData = { 
               content: cleanedContent,
               comments: [],
               suggestions: [],
               references: [],
               manualReferences: []
             };
           }
        } catch (e) {
           const cleanedContent = stripCommentHighlights(String(template.content));
           loadedContentData = { 
             content: cleanedContent,
             comments: [],
             suggestions: [],
             references: [],
             manualReferences: []
           };
        }
      }
    } catch (error) {
      console.error('Error parsing template content/comments:', error);
      loadedContentData = { content: template.content || '', comments: [], suggestions: [], references: [], manualReferences: [] };
    }

    const templateStructure = JSON.parse(template.template_structure || '{}');
    const requiredApprovers = JSON.parse(template.required_approvers || '[]');
    
    // Set state variables
    setContentData(loadedContentData);
    setLiveInitialContent(loadedContentData);
    setTempReferences(loadedContentData.references || []);
    setTempManualReferences(loadedContentData.manualReferences || []);
    
    // Set the locked elements state
    if (templateStructure.locked_elements) {
      setLockedElements(templateStructure.locked_elements);
    }
    
    // Set approvers state
    if (requiredApprovers.length > 0) {
      setApprovers(requiredApprovers.map(approver => {
        // Ensure the dueDate is converted to moment if present
        if (approver.dueDate) {
          approver.dueDate = moment(approver.dueDate);
        }
        return approver;
      }));
    }
    
    // Set form values
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      category: template.category_id,
      notes: template.notes,
      
      // Structure settings
      includeTableOfContents: templateStructure.includeTableOfContents || false,
      allowAttachments: templateStructure.allowAttachments || false,
      
      // Set lock element values from templateStructure
      lockContent: templateStructure.locked_elements?.content || false,
      lockTOC: templateStructure.locked_elements?.toc || false,
      lockFontSize: templateStructure.locked_elements?.fontSize || false,
      lockFontStyle: templateStructure.locked_elements?.fontStyle || false,
      lockHeaderFooter: templateStructure.locked_elements?.headerFooter || false,
      
      // Initialize approvers in form
      approvers: requiredApprovers.map(approver => ({
        department: approver.department,
        mandatory: approver.mandatory,
        stage: approver.stage,
      })),
    });
        
    // Mark all tabs as viewed since we're editing an existing template
    setTabStatus({
      basicInfo: "complete",
      approvers: requiredApprovers.length > 0 ? "complete" : "incomplete",
      structure: "complete",
      content: "complete",
      notes: "complete",
      review: "complete"
    });
    
    // Set the category
    if (template.category_id) {
      setCategory(template.category_id);
    }

    // Check if an active draft revision already exists in the system for this template
    if (templates && Array.isArray(templates) && template.id) {
      const existingDraft = templates.find(t => 
        String(t.revision_parent_id) === String(template.id) &&
        ['draft', 'pending_revision', 'pending_review', 'pending_approval'].includes(t.status)
      );
      if (existingDraft) {
        setCurrentTemplateId(existingDraft.id);
      }
    }
  }
}, [template, form, templates]);

  // Auto-save timer setup
  // Auto-save logic
  const contentDataRef = useRef(contentData);
  useEffect(() => {
    contentDataRef.current = contentData;
  }, [contentData]);

  // Debounced save function
  const debouncedSave = useRef(
    debounce(() => {
      // Use current ref values to avoid stale closures
      if (currentTemplateId || form.getFieldValue('name')) {
        console.log('📝 Triggering debounced auto-save'); 
        performAutoSave();
      }
    }, 2000)
  ).current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const performAutoSave = () => {
     handleSubmit('draft', true, contentDataRef.current);
  };

  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      // Define which fields to validate for each tab
      const tabFieldMapping = {
        basicInfo: ['name', 'description', 'category'],
        approvers: [], // We'll handle approvers validation separately
        structure: [], // No required fields in structure tab
        content: [], // Content tab validation will depend on your implementation
        notes: [], // Notes are optional
        review: [] // Review tab doesn't have form fields to validate
      };

      // Get fields for the current tab
      const fields = tabFieldMapping[tab];
            
      if (!fields || fields.length === 0) {
        // If no fields to validate or they're optional, mark as complete
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      // Validate specific fields
      await form.validateFields(fields);
      
      // If validation succeeds, mark tab as complete
      setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
      return true;
    } catch (error) {
      console.log("Validation error:", error);
      // If validation fails, tab remains incomplete
      setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
      return false;
    }
  };

  // Function to handle adding template approvers
const handleAddTemplateApprover = (userId) => {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  const newApprover = {
    userId,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    department: user.department || '',
    role: approverType === 'review' ? 'template_reviewer' : 'template_approver',
    status: 'pending',
    dueDate: sharedDueDate,
    ...(approverType === 'approval' && { comment: '' })
  };

  const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
  
  // Check if user already exists in the current target array
  if (!templateApprovers[targetArray].some(approver => approver.userId === userId)) {
    setTemplateApprovers(prev => ({
      ...prev,
      [targetArray]: [...prev[targetArray], newApprover]
    }));
  }
  
  setSelectedTemplateApprover(null);
};

  // Function to remove template approver
const handleRemoveTemplateApprover = (userId) => {
  const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
  
  setTemplateApprovers(prev => ({
    ...prev,
    [targetArray]: prev[targetArray].filter(approver => approver.userId !== userId)
  }));
};

  // Function to open the template approvers modal
  const showTemplateApproversModal = () => {
    setTemplateApproversModalVisible(true);
  };

  // Function to close the template approvers modal
  const handleTemplateApproversModalCancel = () => {
    setTemplateApproversModalVisible(false);
  };

  // Check if at least one user is assigned for each approver
  useEffect(() => {
    // First check if there are any approvers at all
    const hasApprovers = approvers.length > 0;
    
    // Then check if all approvers have at least one participant
    const allApproversHaveParticipants = hasApprovers && 
      approvers.every(approver => (approver.participants || []).length > 0);
    
    setTabStatus(prev => ({ 
      ...prev, 
      approvers: hasApprovers && allApproversHaveParticipants ? "complete" : "incomplete" 
    }));
  }, [approvers]);

  // Track if all required tabs are complete for submission
  const canSubmit = Object.entries(tabStatus)
    .filter(([key]) => key !== 'notes' && key !== 'structure' && key !== 'review') // Notes, structure, review tabs optional/hidden
    .every(([_, status]) => status === "complete");



  const handleApproverDepartmentChange = (key, value) => {
    // First update form values
    const currentApprovers = [...form.getFieldValue('approvers') || []];
    if (currentApprovers[key]) {
      // Update department
      currentApprovers[key].department = value;
      // Clear participants
      currentApprovers[key].participants = [];
      // Update form values
      form.setFieldsValue({ approvers: currentApprovers });
    }
    
    // Then update state
    const updatedApprovers = approvers.map(approver => {
      if (approver.key === key) {
        return { 
          ...approver, 
          department: value,
          participants: [] // Clear participants when department changes
        };
      }
      return approver;
    });
    
    setApprovers(updatedApprovers);
  };

  // Navigation between tabs
  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "content", "notes", "revisionHistory", "attachments", "references"];
    const currentIndex = tabs.indexOf(activeTab);
    
    if (direction === 'next' && currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      handleTabChange(nextTab);
    } else if (direction === 'prev' && currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      handleTabChange(prevTab);
    }
  };

  const handleTabChange = async (key) => {
    // If the current tab has validation, validate it first
    if (activeTab) {
      const isValid = await validateTabFields(activeTab);
      // Even if not valid, we still allow changing tabs
    }
    
    // Mark the tab as viewed
    if (tabStatus[key] === "incomplete" && 
        (key === "structure" || key === "content" || key === "notes" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }
    
    setActiveTab(key);
  };

  const validateAllTabs = async () => {
    const allTabs = ["basicInfo", "approvers", "structure", "content", "notes"];
    let isValid = true;
    
    for (const tab of allTabs) {
      const valid = await validateTabFields(tab);
      if (!valid) isValid = false;
    }
    
    return isValid;
  };

  // Explicitly structure data for submission
const handleSubmit = (status = 'pending', isAutoSave = false, overrideContentData = null) => {
  // Determine the actual status based on approver type
  let finalStatus = status;
  if (status === 'pending') {
    finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
  }

  // For pending status, validate all tabs
  if (status === 'pending' && !isAutoSave) {
    validateAllTabs().then(isValid => {
      if (!isValid) {
        errorAlert('Creation Failed', 'Complete the information in Basic Tab');
        return;
      }
      saveTemplateData(finalStatus);
      const actionText = approverType === 'review' ? 'Review' : 'Approval';
      successAlert('Template Submitted', `Template submitted for ${actionText} successfully`);
    });
  } else {
    // For draft or auto-save, skip validation
    saveTemplateData(finalStatus, isAutoSave, overrideContentData);
    if (!isAutoSave) {
      toastAlert('Template Saved as Draft');
    }
  }
};

  // Extract the actual saving logic to a separate function
const saveTemplateData = (status, isAutoSave = false, overrideContentData = null) => {
  const formValues = form.getFieldsValue(true);
  const activeContentData = overrideContentData || contentData;
  
  // Update the shared due date for all approvers of the current type
  const updatedTemplateApprovers = { ...templateApprovers };
  if (sharedDueDate && (status === 'pending_review' || status === 'pending_approval')) {
    const targetArray = status === 'pending_review' ? 'reviewers' : 'approvers';
    updatedTemplateApprovers[targetArray] = updatedTemplateApprovers[targetArray].map(approver => ({
      ...approver,
      dueDate: sharedDueDate
    }));
  }

  const templateData = {
      // Basic template info
      name: formValues.name,
      description: formValues.description,
      category_id: formValues.category,
      
      // User and org info
      created_by: user?.id,
      organization_id: user?.orgId,
      
      // Template approvers - formatted as JSON string for database
      template_approvers: (status === 'pending_review' || status === 'pending_approval') ? updatedTemplateApprovers : null,
      
      // Approvers and locked elements from state
      approvers: approvers,
      locked_elements: lockedElements,
      
      // Content structure settings
      includeTableOfContents: formValues.includeTableOfContents || false,
      allowAttachments: formValues.allowAttachments || false,
      
      // Content data
      content: (activeContentData && activeContentData.content) || '',

      // Comments and suggestions data - store full object in comments column
      comments: (() => {
        const isCustomHeader = activeContentData?.hasUserCustomizedHeader === true;
        const canonicalTitle = (formValues.name || '').trim();
        const finalHeaderHTML = isCustomHeader
          ? (activeContentData?.headerHTML || '')
          : (canonicalTitle || activeContentData?.headerHTML || '');

        const safePagesState = (activeContentData && activeContentData.pagesState) ? [...activeContentData.pagesState] : null;
        if (safePagesState && safePagesState[0] && safePagesState[0].header && !isCustomHeader) {
          safePagesState[0] = {
            ...safePagesState[0],
            header: {
              ...(safePagesState[0].header || {}),
              content: finalHeaderHTML
            }
          };
        }

        return {
          content: (activeContentData && activeContentData.content) || '',
          comments: (activeContentData && activeContentData.comments) || [],
          suggestions: (activeContentData && activeContentData.suggestions) || [],
          references: (activeContentData && activeContentData.references) || [],
          manualReferences: (activeContentData && activeContentData.manualReferences) || [],
          headerHTML: finalHeaderHTML,
          footerHTML: (activeContentData && activeContentData.footerHTML) || '',
          logo: (activeContentData && activeContentData.logo) || null,
          logoText: (activeContentData && activeContentData.logoText) || '',
          orientation: (activeContentData && activeContentData.orientation) || 'portrait',
          paperSize: (activeContentData && activeContentData.paperSize) || 'A4',
          pagesState: safePagesState,
          hasUserCustomizedHeader: isCustomHeader
        };
      })(),

      // Notes/Remarks
      notes: formValues.notes || '',
      
      // Status - new field
      status: status,

      version: template.version + 1,

      revision_parent_id: (template.id && String(template.id) !== String(currentTemplateId)) ? template.id : null
    };
    
    if (isAutoSave) {
      // Silent autosave for production feel
      if (currentTemplateId) {
        // toastAlert('Template auto-saved');
      }
    }

    // If we already have a template ID, update it. Otherwise create new
    if (currentTemplateId) {
      updateExistingTemplate(templateData, status, isAutoSave);
    } else {
      createNewTemplate(templateData, status, isAutoSave);
    }
  };

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
  const handleReviseTemplate = async (templateId, isAutoSave = false) => {    
    try {
      await handleTemplateStatusUpdate(templateId, 'pending_revision');
      if (!isAutoSave) {
        message.success('Template successfully revised');
        fetchUserData();
      }
    } catch (error) {
      console.error('Error revising template:', error);
      if (!isAutoSave) {
        message.error('Failed to revise template. Please try again.');
      }
    }
  };

  // Function to create a new template
  const createNewTemplate = async (templateData, status, isAutoSave) => {
    try {
      const response = await axios.post('/api/newtemplate', templateData);
      
      if (response.data.success) {
        // Store the template ID for future updates
        setCurrentTemplateId(response.data.templateId);
        // Parent template must remain published and unchanged while the new revision is in draft/review/approval
        if (!isAutoSave) {
          // Only show notification for user-initiated saves
          successAlert('Template Created', `Template has been created successfully`);
          if (onSuccess) onSuccess();
          else if (onCancel) onCancel();
        }
      }
    } catch (error) {
      console.error('Error creating template:', error);
      if (!isAutoSave) {
        // Only show error for user-initiated saves
        errorAlert('Creation Failed', error.response?.data?.message || 'There was an error creating your template');
      }
    }
  };

  // Function to update an existing template
  const updateExistingTemplate = async (templateData, status, isAutoSave) => {
    try {
      const response = await axios.put(`/api/update_template/${currentTemplateId}`, templateData);
      
      if (response.data.success) {
        if (!isAutoSave) {
          // Only show notification for user-initiated saves
          successAlert('Template Updated', `Template has been updated successfully`);
          if (onSuccess) onSuccess();
          else if (onCancel) onCancel();
        }
      }
    } catch (error) {
      console.error('Error updating template:', error);
      if (!isAutoSave) {
        // Only show error for user-initiated saves
        errorAlert('Update Failed', error.response?.data?.message || 'There was an error updating your template');
      }
    }
  };

  // Dropdown menu items
const items = [
  {
    key: 'draft',
    label: 'Save as Draft',
    icon: <FileTextOutlined />,
    onClick: (info) => {
      // Ant Design v5 passes { item, key, keyPath } as first param, not event
      handleSubmit('draft');
    }
  },
  {
    key: 'review',
    label: 'Submit for Review',
    icon: <FileSearchOutlined />,
    onClick: (info) => {
      // Ant Design v5 passes { item, key, keyPath } as first param, not event
      setApproverType('review');
      showTemplateApproversModal();
    }
  },
  {
    key: 'approval',
    label: 'Submit for Approval',
    icon: <SaveOutlined />,
    onClick: (info) => {
      // Ant Design v5 passes { item, key, keyPath } as first param, not event
      setApproverType('approval');
      showTemplateApproversModal();
    }
  }
];

  // Update the addApprover function to ensure proper stage numbering
const addApprover = () => {
  // Get already selected departments
  const selectedDepartments = approvers.map(approver => approver.department);
  
  // Check if there are any unselected departments left
  const availableDepartments = departments.filter(
    dept => !selectedDepartments.includes(dept.name)
  );
  
  if (availableDepartments.length === 0) {
    message.warning('All departments have already been assigned as approvers.');
    return;
  }
  
  // Find all existing stages and get the maximum stage number
  const existingStages = approvers.map(a => a.stage);
  const maxStage = existingStages.length > 0 ? Math.max(...existingStages) : 0;
  
  // Default to stage 1 for the first approver, otherwise use the latest stage
  const nextStage = maxStage > 0 ? maxStage : 1;
  
  const newApprover = {
    key: approvers.length,
    department: availableDepartments[0]?.name || '',
    mandatory: false,
    stage: nextStage,
    participants: []
  };
  
  setApprovers([...approvers, newApprover]);
};

  // Update the removeApprover function to reindex stages
  const removeApprover = (key) => {
    const approverToRemove = approvers.find(a => a.key === key);
    if (!approverToRemove) return;
    
    const removedStage = approverToRemove.stage;
    
    // Remove the approver
    const filteredApprovers = approvers.filter(approver => approver.key !== key);
    
    // Adjust stages for remaining approvers
    const updatedApprovers = filteredApprovers.map(approver => {
      if (approver.stage > removedStage) {
        return { ...approver, stage: approver.stage - 1 };
      }
      return approver;
    });
    
    // Sort by stage
    const sortedApprovers = [...updatedApprovers].sort((a, b) => a.stage - b.stage);
    
    // Update keys to be sequential
    const reindexedApprovers = sortedApprovers.map((approver, index) => ({
      ...approver,
      key: index
    }));
    
    setApprovers(reindexedApprovers);
    
    // Update form values
    const updatedFormApprovers = reindexedApprovers.map(approver => {
      return {
        department: approver.department,
        participants: approver.participants,
        mandatory: approver.mandatory,
        stage: approver.stage
      };
    });
    
    form.setFieldsValue({ approvers: updatedFormApprovers });
  };

  const handleApproverChange = (key, field, value) => {
    setApprovers(approvers.map(approver => {
      if (approver.key === key) {
        return { ...approver, [field]: value };
      }
      return approver;
    }));
  };

  const handleLockElementToggle = (element) => {
    setLockedElements({
      ...lockedElements,
      [element]: !lockedElements[element]
    });
  };
    
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

  // Get tab status badge color
  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Initialize form with values for locked elements
  React.useEffect(() => {
    form.setFieldsValue({
      // Set initial values for form fields
      lockContent: lockedElements.content,
      lockTOC: lockedElements.toc,
      lockFontSize: lockedElements.fontSize,
      lockFontStyle: lockedElements.fontStyle,
      lockHeaderFooter: lockedElements.headerFooter,
    });
  }, [form]);

  // Effects for form-state synchronization
  React.useEffect(() => {
    // Update form values when lockedElements state changes
    form.setFieldsValue({
      lockContent: lockedElements.content,
      lockTOC: lockedElements.toc,
      lockFontSize: lockedElements.fontSize,
      lockFontStyle: lockedElements.fontStyle,
      lockHeaderFooter: lockedElements.headerFooter,
    });
  }, [lockedElements, form]);

  // Tab navigation buttons
  const renderTabNavButtons = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', paddingRight: '12px', flexWrap: 'nowrap' }}>
      <Button 
        size="small"
        icon={<LeftOutlined />} 
        onClick={() => navigateToTab('prev')}
        disabled={activeTab === "basicInfo"}
      >
        Previous
      </Button>
      <Button 
        size="small"
        onClick={() => navigateToTab('next')}
        disabled={activeTab === "references"}
      >
        Next <RightOutlined />
      </Button>
      <Dropdown menu={{ items }} placement="bottomRight">
        <Button size="small" type="primary">
          Update Template <DownOutlined />
        </Button>
      </Dropdown>
      <Tooltip title="Back" placement="left" getPopupContainer={(trigger) => trigger.parentElement || document.body}>
        <Button 
          type="default"
          htmlType="button"
          icon={<ArrowLeftOutlined />} 
          size="small"
          onClick={handleCancelClick}
          style={{ cursor: 'pointer', zIndex: 1 }}
        />
      </Tooltip>
    </div>
  );

  // Basic information tab content
  const renderBasicInfoTab = () => (
    <ReviseTemplateBasicInfoTab
      template={template}
      templates={templates}
      user={user}
      filterCategory={filterCategory}
      setCategory={setCategory}
      categories={categories}
      getParentPath={getParentPath}
    />
  );

  // Approvers tab content
  const renderApproversTab = () => (
    <TemplateApproversTab
      approvers={approvers}
      departments={departments}
      addApprover={addApprover}
      removeApprover={removeApprover}
      handleApproverChange={handleApproverChange}
      handleApproverDepartmentChange={handleApproverDepartmentChange}
    />
  );

  // Structure tab content
  const renderStructureTab = () => (
    <TemplateStructureTab
      lockedElements={lockedElements}
      handleLockElementToggle={handleLockElementToggle}
    />
  );

  // Content tab (integrating with external content editor)
  const renderContentTab = () => (
    <Form.Item noStyle shouldUpdate>
      {({ getFieldValue }) => (
        <EditorWrapper
          isActive={activeTab === "content"}
          user={user}
          currentTemplateId={currentTemplateId || template?.id}
          contentData={contentData}
          setContentData={setContentData}
          documentTitle={getFieldValue('name')}
          template={template}
          status={template?.status}
          isDraft={false}
          isRevise={true}
          onAutoSaveRequested={(data, instant) => {
            if (instant) {
              if (currentTemplateId || getFieldValue('name')) {
                handleSubmit('draft', true, data);
              }
            } else {
              debouncedSave();
            }
          }}
        />
      )}
    </Form.Item>
  );



  // Notes/Remarks tab (new tab)
  const renderNotesTab = () => (
    <TemplateNotesTab 
      parsedTemplate={template} 
      associationType="template" 
      currentUser={user} 
      onNotesChange={(newNotes) => form.setFieldsValue({ notes: newNotes })}
    />
  );

  // Review tab content
  const renderReviewTab = () => (
    <TemplateReviewTab
      approvers={approvers}
      lockedElements={lockedElements}
      categories={categories}
      canSubmit={canSubmit}
      items={items}
    />
  );

  // Render the component
  return (
    <div className="create-template-tabs">
      <Row gutter={[16, 0]}>
        <Col span={24}>
          <Form
            form={form}
            layout="vertical"
          >
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              type="card"
              destroyInactiveTabPane={false}
              tabBarExtraContent={renderTabNavButtons()}
              items={[
                {
                  key: "basicInfo",
                  label: (
                    <Badge dot status={getTabStatusColor("basicInfo")} offset={[5, 0]}>
                      <FileTextTwoTone /> Basic Info
                    </Badge>
                  ),
                  children: renderBasicInfoTab()
                },
                /* {
                  key: "structure",
                  label: (
                    <Badge dot status={getTabStatusColor("structure")} offset={[5, 0]}>
                      <LockOutlinedTwo /> Structure & Locks
                    </Badge>
                  ),
                  children: renderStructureTab()
                }, */
                {
                  key: "content",
                  forceRender: true,
                  label: (
                    <Badge dot status={getTabStatusColor("content")} offset={[5, 0]}>
                      <EditOutlined /> Content
                    </Badge>
                  ),
                  children: renderContentTab()
                },
                {
                  key: "notes",
                  label: (
                    <Badge dot status={getTabStatusColor("notes")} offset={[5, 0]}>
                      <MessageOutlined /> Notes
                    </Badge>
                  ),
                  children: renderNotesTab()
                },
                {
                  key: "revisionHistory",
                  label: (
                    <span>
                      <HistoryOutlined /> Revision History
                    </span>
                  ),
                  children: template?.id ? (
                    <TemplateRevisionHistoryTab 
                      templateId={template?.id}
                      currentVersion={template?.version}
                    />
                  ) : (
                    <Empty description="No parent template found" />
                  )
                },
                {
                  key: "attachments",
                  label: (
                    <span>
                      <PaperClipOutlined /> Attachments
                    </span>
                  ),
                  children: (
                    <AttachmentsTab 
                      associationType="template" 
                      associationId={currentTemplateId || template?.id} 
                      canEdit={true} 
                    />
                  )
                },
                {
                  key: "references",
                  label: (
                    <span>
                      <BookOutlined /> References
                    </span>
                  ),
                  children: (
                    <ReferencesTab 
                      references={tempReferences} 
                      manualReferences={tempManualReferences}
                      onReferencesChange={(refs) => {
                        setTempReferences(refs);
                        setContentData(prev => {
                          const safePrev = prev && typeof prev === 'object' ? prev : {};
                          return { ...safePrev, references: refs };
                        });
                      }}
                      onManualReferencesChange={(refs) => {
                        setTempManualReferences(refs);
                        setContentData(prev => {
                          const safePrev = prev && typeof prev === 'object' ? prev : {};
                          return { ...safePrev, manualReferences: refs };
                        });
                      }}
                      canEdit={true}
                    />
                  )
                },
                /* {
                  key: "review",
                  label: (
                    <Badge dot status={getTabStatusColor("review")} offset={[5, 0]}>
                      <FileSearchOutlined /> Review
                    </Badge>
                  ),
                  children: renderReviewTab()
                } */
              ]}
            />
          </Form>
        </Col>
      </Row>
<TemplateApproversModal
  visible={templateApproversModalVisible}
  onCancel={handleTemplateApproversModalCancel}
  approverType={approverType}
  setApproverType={setApproverType}
  templateApprovers={templateApprovers}
  selectedTemplateApprover={selectedTemplateApprover}
  handleAddTemplateApprover={handleAddTemplateApprover}
  handleRemoveTemplateApprover={handleRemoveTemplateApprover}
  sharedDueDate={sharedDueDate}
  setSharedDueDate={setSharedDueDate}
  users={users}
  onSubmit={async () => {
    const isValid = await validateAllTabs();
    if (!isValid) {
      setTemplateApproversModalVisible(false);
      errorAlert('Creation Failed', 'Complete the information in Basic Tab');
      return;
    }
    handleSubmit('pending');
    setTemplateApproversModalVisible(false);
  }}
  submitDisabled={
    (approverType === 'review' && templateApprovers.reviewers.length === 0) ||
    (approverType === 'approval' && templateApprovers.approvers.length === 0) ||
    !sharedDueDate
  }
/>
    </div>
  );
};

export default ReviseTemplate;