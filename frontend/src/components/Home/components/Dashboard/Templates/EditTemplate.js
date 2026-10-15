import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../../../../../utils/SocketProvider';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Button, Select,
  Row, Col, Typography,
  Tabs, message, Badge, Dropdown, Tooltip
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
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';
import EditorWrapper from './CreateTemplate/components/EditorWrapper';
import { extractCommentsPayload } from '../../../../Unified/UnifiedTextEditor/Preview/hooks/useTemplatePreviewState';
import TemplateApproversModal from './components/TemplateApproversModal';
import TemplateBasicInfoTab from './components/TemplateBasicInfoTab';
import TemplateStructureTab from './components/TemplateStructureTab';
import TemplateApproversTab from './components/TemplateApproversTab';
import TemplateReviewTab from './components/TemplateReviewTab';

const { Text } = Typography;
const { Option } = Select;

const EditTemplate = ({ fetchUserData, template, user, users, categories, departments, templates = [], onCancel, onSuccess }) => {
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
  const [liveInitialContent, setLiveInitialContent] = useState(() => {
    try {
      return JSON.parse(template?.content || '{}');
    } catch {
      return { content: '' };
    }
  });
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

  // Join socket room for live sync and listen for updates
  useEffect(() => {
    if (!template?.id) return;
    socket.emit('joinTemplateReview', {
      templateId: template.id,
      userId: user?.id,
      userName: user?.email
    });
    const onTemplateUpdate = (data) => {
      if (data?.templateId === template.id && typeof data.content === 'string') {
        setLiveInitialContent((prev) => ({ ...prev, content: data.content }));
      }
    };
    socket.on('templateUpdate', onTemplateUpdate);
    return () => socket.off('templateUpdate', onTemplateUpdate);
  }, [template?.id, user?.id, user?.email]);

  // Add this useEffect at the beginning of your component to auto-fill form data
  useEffect(() => {
    if (template) {
      const extracted = extractCommentsPayload(template);
      const loadedContentData = {
        content: extracted.contentHtml || template.content || '',
        comments: extracted.comments || [],
        suggestions: extracted.suggestions || [],
        references: extracted.references || [],
        manualReferences: extracted.manualReferences || [],
        headerHTML: extracted.headerHTML || '',
        footerHTML: extracted.footerHTML || '',
        logo: extracted.logo || null,
        logoText: extracted.logoText || '',
        logoTextRight: extracted.logoTextRight || '',
        orientation: extracted.orientation || template.orientation || 'portrait',
        paperSize: extracted.paperSize || template.paperSize || 'A4',
        pagesState: extracted.pagesState || template.pagesState || null
      };

      const templateStructure = JSON.parse(template.template_structure || '{}');
      const requiredApprovers = JSON.parse(template.required_approvers || '[]');

      // Set state variables
      setContentData(loadedContentData);
      setLiveInitialContent(loadedContentData);
      setTempReferences(loadedContentData.references || []);
      setTempManualReferences(loadedContentData.manualReferences || []);
      setCurrentTemplateId(template.id || template._id);

      // Set the locked elements state
      if (templateStructure.locked_elements) {
        setLockedElements(templateStructure.locked_elements);
      }

      // Set template approvers if they exist
      const existingTemplateApprovers = typeof template.template_approvers === 'string'
        ? JSON.parse(template.template_approvers || '{"reviewers": [], "approvers": []}')
        : (template.template_approvers || { reviewers: [], approvers: [] });

      if (existingTemplateApprovers.reviewers?.length > 0 || existingTemplateApprovers.approvers?.length > 0) {
        setTemplateApprovers({
          reviewers: (existingTemplateApprovers.reviewers || []).map(reviewer => ({
            ...reviewer,
            dueDate: reviewer.dueDate ? moment(reviewer.dueDate) : null
          })),
          approvers: (existingTemplateApprovers.approvers || []).map(approver => ({
            ...approver,
            dueDate: approver.dueDate ? moment(approver.dueDate) : null
          }))
        });
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
        })),      });

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
    }
  }, [template, form]);

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
        // We need to pass the current content directly or ensure saveTemplateData uses the ref
        // Modifying saveTemplateData to support reading from ref would be ideal, 
        // but for now, we'll rely on the fact that we are inside a function that will be called 
        // with the latest scope if we didn't use debounce... wait, debounce captures scope at creation.
        // So we MUST use refs or get values dynamically.

        // Let's create a specialized auto-save function that reads from refs/form
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
    // Wrapper to call saveTemplateData with current ref data
    // We'll modify saveTemplateData to accept data as arg or we'll assume state is updated?
    // State 'contentData' inside saveTemplateData will be STALE if saveTemplateData isn't recreated.
    // saveTemplateData CLOSES OVER 'contentData'.
    // So we need to call a version of saveTemplateData that accepts overrides.
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
    const tabs = ["basicInfo", "content", "notes", "attachments", "references"];
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

    // Use override data (from ref) if provided, otherwise state (for manual clicks)
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

      // Template approvers - only send if status is pending
      ...(status === 'pending_review' || status === 'pending_approval' ? {
        template_approvers: updatedTemplateApprovers
      } : {}),

      // Approvers and locked elements from state
      approvers: approvers,
      locked_elements: lockedElements,

      // Content structure settings
      includeTableOfContents: formValues.includeTableOfContents || false,
      allowAttachments: formValues.allowAttachments || false,

      // Content data (HTML content)
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
          references: (activeContentData && activeContentData.references && Array.isArray(activeContentData.references))
            ? activeContentData.references.filter(r => !r.isManual && r.refAnchor)
            : [],
          manualReferences: tempManualReferences || [],
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

      notes: formValues.notes || '',

      // Status - new field
      status: status,

      version: template.version,

      revision_parent_id: template.revision_parent_id
    };

    if (isAutoSave) {
      // Silent autosave for production feel
    }
    updateExistingTemplate(templateData, status, isAutoSave);
  };

  // Function to update an existing template
  const updateExistingTemplate = async (templateData, status, isAutoSave) => {
    const templateIdToUse = currentTemplateId || template?.id || template?._id;
    if (!templateIdToUse) {
      console.warn('Cannot update template: templateId is missing');
      return;
    }
    try {
      const response = await axios.put(`/api/update_template/${templateIdToUse}`, templateData);

      if (response.data.success) {
        if (!isAutoSave) {
          // Only show notification for user-initiated saves
          successAlert('Template Updated', `Template has been updated successfully`);
          onCancel();
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
      onClick: () => handleSubmit('draft')
    },
    {
      key: 'review',
      label: 'Submit for Review',
      icon: <FileSearchOutlined />,
      onClick: () => {
        setApproverType('review');
        showTemplateApproversModal();
      }
    },
    {
      key: 'approval',
      label: 'Submit for Approval',
      icon: <SaveOutlined />,
      onClick: () => {
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
    <TemplateBasicInfoTab
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
          status={template?.status || 'draft'}
          isDraft={template?.status === 'draft' || String(template?.status).toLowerCase() === 'draft'}
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

  // Notes/Remarks tab (collaborative TemplateNotesTab)
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
                  ) : null
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
                      associationId={template?.id}
                      canEdit={true}
                      status={template?.status}
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

export default EditTemplate;