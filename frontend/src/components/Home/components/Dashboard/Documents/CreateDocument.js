import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../../../../../api/apiClient';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Input, Button, Select, DatePicker, Row, Col,
  Tag, Typography, Alert, Divider, Space, Tabs,
  Badge, Dropdown, Tooltip, message, Empty, Table, Modal
} from 'antd';
import {
  PlusOutlined, CloseOutlined, FileTextOutlined,
  FileTextTwoTone, TeamOutlined as TeamOutlinedTwo,
  EditOutlined, FileSearchOutlined, LeftOutlined,
  RightOutlined, DownOutlined, HistoryOutlined,
  InfoCircleOutlined, SaveOutlined, PaperClipOutlined,
  BookOutlined, TeamOutlined, ExclamationCircleOutlined, MessageOutlined,
  ArrowLeftOutlined, FieldNumberOutlined, LockOutlined
} from '@ant-design/icons';
import UnifiedTextEditor from '../../../../Unified/UnifiedTextEditor';
import { stripCommentHighlights, countBlanksInHtml } from '../../../../../utils/templateUtils';
import TemplateApproversModal from '../Templates/CreateTemplate/components/TemplateApproversModal';
import { useAutoSave } from '../Templates/CreateTemplate/hooks/useAutoSave';
import moment from 'moment';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';
import ImpactAssessment from '../Templates/CreateTemplate/components/ImpactAssessment';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';
import TemplateApproversTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateApproversTab';
import { extractCommentsPayload } from '../../../../Unified/UnifiedTextEditor/Preview/hooks/useTemplatePreviewState';
import {
  roleColors,
  DOC_REVIEWER_ROLE,
  DOC_APPROVER_ROLE,
  isMeaningfulContent,
  extractTemplateContent,
  extractDocumentContent,
  mapParticipantRoleForDb
} from './helpers/createDocumentHelpers';
import {
  TemplateChangeWarningModal,
  DirectApprovalWarningModal
} from './components/CreateDocumentModals';
import DocumentBasicInfoTab from "./tabs/DocumentBasicInfoTab";
import DocumentTasksTab from "./tabs/DocumentTasksTab";
import DocumentContentTab from "./tabs/DocumentContentTab";
import DocumentReviewTab from "./tabs/DocumentReviewTab";
import useDocumentNumbering from "./hooks/useDocumentNumbering";
import useDocumentPersistence from "./hooks/useDocumentPersistence";

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

// Helpers & constants extracted to ./helpers/createDocumentHelpers.js
const CreateDocument = ({ navigate: propNavigate, user, users, templates, template, document, departments = [], onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const hookNavigate = useNavigate();
  const navigate = propNavigate || hookNavigate;

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
  const creatorId = user?.id ?? user?.userId;
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [tasks, setTasks] = useState([{ title: '', description: '', dueDate: null }]);
  const [participants, setParticipants] = useState([]);
  const [contentData, setContentData] = useState(null);
  const contentDataRef = useRef(null);
  const [contentVersion, setContentVersion] = useState(0);

  const updateContentData = useCallback((valOrFn) => {
    setContentData((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      contentDataRef.current = next;
      return next;
    });
  }, []);
  const [templateChangeModalVisible, setTemplateChangeModalVisible] = useState(false);
  const pendingTemplateChangeRef = useRef(null); // stores { newId, oldId }
  const appliedTemplateRef = useRef(undefined);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [documentNotes, setDocumentNotes] = useState('');
  const [tempAttachments, setTempAttachments] = useState([]);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);
  const [impactData, setImpactData] = useState({
    // existing fields
    departmentImpacts: [],
    affectedSystems: [],
    implementationEffort: 'medium',
    trainingRequired: false,
    impactNotes: '',
    // impact template
    impactTemplates: [] // Array containing at most one { id, name, content, filledValues }
  });
  const currentDocumentIdRef = useRef(null);
  const isCreatingRef = useRef(false);

  // Numbering system hook
  const {
    documentNumber,
    setDocumentNumber,
    projectNumber,
    costCenterNumber,
    availableProjects,
    availableCostCenters,
    updateDepartmentNumbers,
  } = useDocumentNumbering({ user, form, document });

  useEffect(() => {
    if (currentDocumentId) currentDocumentIdRef.current = currentDocumentId;
  }, [currentDocumentId]);

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

  const [documentApproversModalVisible, setDocumentApproversModalVisible] = useState(false);
  const [documentWorkflowApprovers, setDocumentWorkflowApprovers] = useState({
    reviewers: [],
    approvers: []
  });
  const [documentRequiredApprovers, setDocumentRequiredApprovers] = useState([]);
  const [loadedDocTemplate, setLoadedDocTemplate] = useState(null);
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState(null);
  const [directApprovalWarningVisible, setDirectApprovalWarningVisible] = useState(false);
  const [tabStatus, setTabStatus] = useState({
    basicInfo: "incomplete",
    tasks: "incomplete",
    approvers: "incomplete",
    content: "incomplete",
    notes: "incomplete",
    impact: "incomplete",
    review: "incomplete"
  });

  const parsedTemplateForApprovers = useMemo(() => {
    return {
      status: 'draft',
      required_approvers: documentRequiredApprovers,
      template_approvers: documentWorkflowApprovers,
      document_id: currentDocumentId || null
    };
  }, [documentRequiredApprovers, documentWorkflowApprovers, currentDocumentId]);

  useEffect(() => {
    const hasApprovers = (documentWorkflowApprovers?.reviewers?.length > 0) || 
                         (documentWorkflowApprovers?.approvers?.length > 0);
    if (documentRequiredApprovers?.length > 0) {
      setTabStatus(prev => ({
        ...prev,
        approvers: hasApprovers ? "complete" : "incomplete"
      }));
    }
  }, [documentWorkflowApprovers, documentRequiredApprovers]);

  const getCurrentUsersToShow = useCallback(() => {
    if (!documentWorkflowApprovers) return [];
    const { reviewers = [], approvers = [] } = documentWorkflowApprovers;
    return [...reviewers, ...approvers];
  }, [documentWorkflowApprovers]);

  const updateMetadata = useCallback(async (data) => {
    if (data.approvers) {
      setDocumentRequiredApprovers(data.approvers);
    }
  }, []);

  // Filter templates to only show published and pending_revision status, plus the document's currently selected template version even if revised
  const availableTemplates = templates.filter(template =>
    template.status === 'published' ||
    template.status === 'pending_revision' ||
    (document && template.id === document.template_id)
  );

  // Filter out current user from selectable users
  const selectableUsers = users.filter(u => u.id !== user.id);

  // Helper: load all approver data from a template object into state
  const loadApproversFromTemplate = useCallback((t) => {
    if (!t) {
      setDocumentRequiredApprovers([]);
      setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      return;
    }

    // Check if the template has custom admin-assigned document approvers first!
    if (t.custom_document_approvers) {
      try {
        const parsedCustom = typeof t.custom_document_approvers === 'string'
          ? JSON.parse(t.custom_document_approvers)
          : t.custom_document_approvers;
        
        if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
          // If it's the new format (array of sets), default to the first set
          if (parsedCustom[0].name !== undefined) {
            const firstSet = parsedCustom[0];
            const customDepts = firstSet.departments.map((item, idx) => ({
              key: idx,
              department: item.department,
              mandatory: true,
              stage: item.stage || 1
            }));
            setDocumentRequiredApprovers(customDepts);
            setDocumentWorkflowApprovers({
              reviewers: [],
              approvers: [],
              selectedSetId: firstSet.id,
              selectedSetName: firstSet.name,
              selectedSetComment: firstSet.comment
            });
            return;
          } else {
            // Legacy single set format
            const customDepts = parsedCustom.map((item, idx) => ({
              key: idx,
              department: item.department,
              mandatory: true,
              stage: item.stage || 1
            }));
            setDocumentRequiredApprovers(customDepts);
            setDocumentWorkflowApprovers({
              reviewers: [],
              approvers: [],
              selectedSetId: 'default',
              selectedSetName: 'Default Set',
              selectedSetComment: ''
            });
            return;
          }
        }
      } catch (e) {
        console.error("Error loading custom document approvers from template:", e);
      }
    }

    // Check if template has standard required_approvers array
    if (t.required_approvers) {
      try {
        const parsedReq = typeof t.required_approvers === 'string'
          ? JSON.parse(t.required_approvers)
          : t.required_approvers;
        if (Array.isArray(parsedReq) && parsedReq.length > 0) {
          setDocumentRequiredApprovers(parsedReq);
          setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
          return;
        }
      } catch (e) {}
    }

    // If no custom_document_approvers or required_approvers are configured for this template in Account Management,
    // default document required approvers and workflow approvers to empty
    setDocumentRequiredApprovers([]);
    setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
  }, []);

  useEffect(() => {
    if (template?.id) {
      let isCancelled = false;
      const loadTemplateDetails = async () => {
        const t = (templates || []).find(tpl => String(tpl.id) === String(template.id)) || template;
        const deptName = t.department || t.category || undefined;
        form.setFieldsValue({
          templateId: t.id,
          ...(deptName ? { department: deptName } : {})
        });
        // Sync the applied-template ref so the first programmatic selection
        // is not treated as a "change away from an existing template".
        appliedTemplateRef.current = t.id;
        loadApproversFromTemplate(t);

        let fullTemplate = t;
        if (!fullTemplate.content && !fullTemplate.comments) {
          try {
            const res = await apiClient.get(`/api/get_template/${t.id}`);
            if (res.data && !isCancelled) {
              fullTemplate = res.data;
              loadApproversFromTemplate(fullTemplate);
            }
          } catch (err) {
            console.error('Failed to fetch full template details in CreateDocument:', err);
          }
        }
        if (isCancelled) return;
        const extracted = extractTemplateContent(fullTemplate);
        if (extracted && (extracted.content || extracted.pagesState || extracted.logo)) {
          setContentData(extracted);
        }
        if (fullTemplate.notes) {
          setDocumentNotes(fullTemplate.notes);
          form.setFieldsValue({ notes: fullTemplate.notes });
        }
      };

      loadTemplateDetails();
      return () => { isCancelled = true; };
    }
  }, [template, form, templates, loadApproversFromTemplate]);

  // Auto-fill from base document
  useEffect(() => {
    if (document) {
      let isCancelled = false;
      const loadDocDetails = async () => {
        const matchingTemplateId = document.template_id || undefined;
        let fullDoc = document;
        const docId = document.document_id || document.id;

        if (docId && (!fullDoc.content && !fullDoc.comments && !fullDoc.elements)) {
          try {
            const res = await apiClient.get(`/api/get_document/${docId}`);
            if (res.data && !isCancelled) {
              fullDoc = res.data;
            }
          } catch (err) {
            console.error('Failed to fetch full document details in CreateDocument:', err);
          }
        }
        if (isCancelled) return;

        const extracted = extractDocumentContent(fullDoc);
        const deptName = fullDoc.department || extracted.logoTextRight || undefined;

        form.setFieldsValue({
          title: fullDoc.title || '',
          templateId: matchingTemplateId,
          department: deptName,
          ...(fullDoc.notes ? { notes: fullDoc.notes } : {})
        });

        if (fullDoc.notes) {
          setDocumentNotes(fullDoc.notes);
        }

        // Sync applied-template ref so switching away later correctly detects
        // the pre-filled template as the "old" value.
        if (matchingTemplateId) {
          appliedTemplateRef.current = matchingTemplateId;
        }

        // Load content
        setContentData(extracted);

        // Load tasks
        if (fullDoc.tasks) {
          try {
            const parsedTasks = typeof fullDoc.tasks === 'string' ? JSON.parse(fullDoc.tasks) : fullDoc.tasks;
            if (Array.isArray(parsedTasks)) {
              setTasks(parsedTasks.map(t => ({
                title: t.title || '',
                description: t.description || '',
                dueDate: t.due_date ? moment(t.due_date) : null
              })));
            }
          } catch (e) {
            console.error("Error parsing document tasks", e);
          }
        }

        // Load participants
        if (fullDoc.participants) {
          try {
            const parsedParts = typeof fullDoc.participants === 'string' ? JSON.parse(fullDoc.participants) : fullDoc.participants;
            if (Array.isArray(parsedParts)) {
              setParticipants(parsedParts.map(p => ({
                userId: p.user_id || p.userId,
                role: p.role || 'viewer'
              })));
            }
          } catch (e) {
            console.error("Error parsing document participants", e);
          }
        }

        // Load impact assessment data
        if (fullDoc.impact) {
          try {
            const parsedImpact = typeof fullDoc.impact === 'string' ? JSON.parse(fullDoc.impact) : fullDoc.impact;
            if (parsedImpact && typeof parsedImpact === 'object') {
              let impactTemplates = parsedImpact.impactTemplates || [];
              
              // Backward compatibility: handle old single template format
              if (impactTemplates.length === 0 && parsedImpact.impactTemplateId) {
                impactTemplates = [{
                  id: parsedImpact.impactTemplateId,
                  name: templates.find(t => t.id === parsedImpact.impactTemplateId)?.name || 'Impact Template',
                  content: parsedImpact.impactTemplateContent || '',
                  filledValues: parsedImpact.impactFilledValues || [],
                  dropdownValues: parsedImpact.impactDropdownValues || [],
                }];
              }

              setImpactData({
                // existing fields
                departmentImpacts: parsedImpact.departmentImpacts || [],
                affectedSystems: parsedImpact.affectedSystems || [],
                implementationEffort: parsedImpact.implementationEffort || 'medium',
                trainingRequired: parsedImpact.trainingRequired || false,
                impactNotes: parsedImpact.impactNotes || '',
                impactTemplates: impactTemplates
              });
              // Sync the Impact Template dropdown with the form
              if (impactTemplates.length > 0) {
                form.setFieldsValue({ impactTemplateId: impactTemplates[0].id });
              }
            }
          } catch (e) {
            console.error("Error parsing document impact", e);
          }
        }

        // Setup approver rules:
        // When reusing a published document, the previously selected reviewers and approvers
        // must NOT be inherited; reviewers and approvers must be empty arrays so the author
        // manually assigns each reviewer and approver.
        // Predefined department requirements and approver sets should be loaded from the template
        // (if the document was based on a template) or preserved from the document's required_approvers.
        let loadedPredefinedApprovers = false;
        if (matchingTemplateId) {
          let t = (templates || []).find(tpl => String(tpl.id) === String(matchingTemplateId));
          if (!t) {
            try {
              const res = await apiClient.get(`/api/get_template/${matchingTemplateId}`);
              if (res.data && !isCancelled) {
                t = res.data;
                setLoadedDocTemplate(t);
              }
            } catch (err) {
              console.warn('Could not fetch template for approvers config in CreateDocument:', err);
            }
          }
          if (t && (t.custom_document_approvers || t.required_approvers)) {
            loadApproversFromTemplate(t);
            loadedPredefinedApprovers = true;
          }
        }

        if (!loadedPredefinedApprovers) {
          // Fall back to document's required approvers if template didn't provide custom approvers
          let reqApprovers = [];
          if (fullDoc.required_approvers) {
            try {
              const parsed = typeof fullDoc.required_approvers === 'string'
                ? JSON.parse(fullDoc.required_approvers)
                : fullDoc.required_approvers;
              if (Array.isArray(parsed)) reqApprovers = parsed;
            } catch (e) {
              console.error("Error parsing document required approvers", e);
            }
          }
          setDocumentRequiredApprovers(reqApprovers);

          // Extract set metadata if any, but NEVER inherit previous reviewers or approvers!
          let setMeta = {};
          if (fullDoc.template_approvers) {
            try {
              const parsed = typeof fullDoc.template_approvers === 'string'
                ? JSON.parse(fullDoc.template_approvers)
                : fullDoc.template_approvers;
              if (parsed && typeof parsed === 'object') {
                if (parsed.selectedSetId) setMeta.selectedSetId = parsed.selectedSetId;
                if (parsed.selectedSetName) setMeta.selectedSetName = parsed.selectedSetName;
                if (parsed.selectedSetComment) setMeta.selectedSetComment = parsed.selectedSetComment;
              }
            } catch (e) {}
          }
          setDocumentWorkflowApprovers({
            reviewers: [],
            approvers: [],
            ...setMeta
          });
        }

        // Set all form/tab status as complete since they are loaded from a valid published document,
        // but mark approvers and review incomplete so the author is required to configure approvers
        setTabStatus({
          basicInfo: "complete",
          tasks: "complete",
          approvers: "incomplete",
          content: "complete",
          impact: "complete",
          review: "incomplete"
        });
      };

      loadDocDetails();
      return () => { isCancelled = true; };
    }
  }, [document, form, templates, loadApproversFromTemplate]);

  // Handler: user selects or clears Impact Template in BasicInfo
  const handleImpactTemplateChange = useCallback(async (templateId) => {
    if (!templateId) {
      setImpactData(prev => ({
        ...prev,
        impactTemplates: []
      }));
      return;
    }

    let selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) return;

    if (!selectedTemplate.content && !selectedTemplate.comments) {
      try {
        const res = await apiClient.get(`/api/get_template/${templateId}`);
        if (res.data) selectedTemplate = res.data;
      } catch (e) {
        console.error('Error fetching impact template:', e);
      }
    }

    const extracted = extractTemplateContent(selectedTemplate);
    const newTemplate = {
      id: templateId,
      name: selectedTemplate.name,
      content: extracted?.content || '',
      filledValues: [],
      dropdownValues: [],
    };

    setImpactData(prev => ({
      ...prev,
      impactTemplates: [newTemplate]
    }));
  }, [templates]);

  const selectedTemplateIdWatch = Form.useWatch('templateId', form);
  const selectedTemplate = useMemo(() => {
    const tId = selectedTemplateIdWatch || document?.template_id;
    return (templates || []).find(t => String(t.id) === String(tId)) || loadedDocTemplate;
  }, [selectedTemplateIdWatch, templates, document, loadedDocTemplate]);
  const prevTplRef = useRef(selectedTemplateIdWatch);
  useEffect(() => {
    const prev = prevTplRef.current;
    prevTplRef.current = selectedTemplateIdWatch;

    // Fire when template value actually changes. The old `prev !== undefined`
    // guard was preventing this from running on programmatic initial selection
    // (e.g. when the `template` prop sets the form value on mount) — causing inconsistency.
    if (prev !== selectedTemplateIdWatch) {
      // Content clearing is now handled by confirmTemplateChange; skip auto-clear here
      // to avoid double-clearing when the modal's confirmed change updates the form.

      if (selectedTemplateIdWatch) {
        const t = (templates || []).find(tpl => String(tpl.id) === String(selectedTemplateIdWatch));
        loadApproversFromTemplate(t || null);
      } else {
        // Template cleared
        setDocumentRequiredApprovers([]);
        setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      }
    }
  }, [selectedTemplateIdWatch, templates, loadApproversFromTemplate]);

  /**
   * Intercepts template selection changes.
   * Case 1 — Editor is empty:
   *   Do NOT show popup. Immediately load the selected template's content.
   * Case 2 — Editor contains manually entered content (and no template loaded yet):
   *   Show confirmation popup warning that changing the template will replace the current content.
   * Case 3 — A template is already loaded:
   *   Show confirmation popup. If confirmed, completely replace with new template.
   */
  const handleTemplateSelectChange = useCallback(async (newTemplateId) => {
    const oldId = appliedTemplateRef.current;
    const currentContent = contentDataRef.current || contentData;
    const hasMeaningful = isMeaningfulContent(currentContent?.content);
    const hasExistingTemplate = oldId !== undefined && oldId !== null;

    // If picking the exact same template, do nothing
    if (hasExistingTemplate && oldId === newTemplateId) {
      return;
    }

    // Determine if warning is needed:
    // Case 2: User has manually entered content (hasMeaningful is true) even if no template was chosen yet.
    // Case 3: A template was already chosen (hasExistingTemplate is true) and user changes to another template or clears it.
    const shouldWarn = (hasMeaningful && !hasExistingTemplate) || (hasExistingTemplate && oldId !== newTemplateId);

    if (shouldWarn) {
      pendingTemplateChangeRef.current = { newId: newTemplateId, oldId };
      // Revert the form field to the OLD value so the Select visually stays on previous value
      form.setFieldValue('templateId', oldId);
      setTemplateChangeModalVisible(true);
    } else {
      // Case 1 — Editor is empty (or no warning needed)
      appliedTemplateRef.current = newTemplateId;
      if (newTemplateId) {
        let tpl = templates.find(t => t.id === newTemplateId);
        if (tpl && !tpl.content && !tpl.comments) {
          try {
            const res = await apiClient.get(`/api/get_template/${newTemplateId}`);
            if (res.data) tpl = res.data;
          } catch (e) {
            console.error('Error fetching template content on select change:', e);
          }
        }
        if (tpl) {
          const extracted = extractTemplateContent(tpl);
          updateContentData(extracted);
          loadApproversFromTemplate(tpl);
        } else {
          updateContentData(null);
        }
      } else {
        updateContentData(null);
      }
      form.setFieldValue('templateId', newTemplateId);
      setContentVersion(v => v + 1);
    }
  }, [form, contentData, templates, loadApproversFromTemplate, updateContentData]);

  /** Called when the user clicks "Yes, change template" in the warning modal */
  const confirmTemplateChange = useCallback(async () => {
    const { newId } = pendingTemplateChangeRef.current || {};
    pendingTemplateChangeRef.current = null;
    setTemplateChangeModalVisible(false);
    
    appliedTemplateRef.current = newId;

    if (newId) {
      let tpl = templates.find(t => t.id === newId);
      if (tpl && !tpl.content && !tpl.comments) {
        try {
          const res = await apiClient.get(`/api/get_template/${newId}`);
          if (res.data) tpl = res.data;
        } catch (e) {
          console.error('Error fetching template on change confirm:', e);
        }
      }
      if (tpl) {
        const extracted = extractTemplateContent(tpl);
        updateContentData(extracted);
        loadApproversFromTemplate(tpl);
      } else {
        updateContentData(null);
      }
    } else {
      updateContentData(null);
    }

    form.setFieldValue('templateId', newId);
    setContentVersion(v => v + 1);
  }, [form, templates, loadApproversFromTemplate, updateContentData]);

  /** Called when the user cancels the template-change warning */
  const cancelTemplateChange = useCallback(() => {
    const { oldId } = pendingTemplateChangeRef.current || {};
    pendingTemplateChangeRef.current = null;
    setTemplateChangeModalVisible(false);
    form.setFieldValue('templateId', oldId !== undefined ? oldId : undefined);
  }, [form]);


  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      const tabFieldMapping = {
        basicInfo: ['title', 'department'],
        tasks: [], // Tasks are optional
        approvers: [], // Approvers are optional
        content: [], // Content tab doesn't have form fields to validate
        settings: [], // Settings are optional
        impact: [], // Impact is optional
        review: [] // Review tab doesn't have form fields to validate
      };

      const fields = tabFieldMapping[tab];

      if (tab === 'tasks') {
        // Tasks are optional; always consider this tab complete.
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (tab === 'content') {
        const html = (contentData && typeof contentData.content === 'string' && contentData.content.trim()) || '';
        if (!html) {
          setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
          return false;
        }
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (tab === 'impact') {
        // If one or more impact templates are selected, ensure all blanks are filled
        if (impactData?.impactTemplates && impactData.impactTemplates.length > 0) {
          const allFilled = impactData.impactTemplates.every(tpl => {
            const totalBlanks = countBlanksInHtml(tpl.content);
            const filledValues = tpl.filledValues || [];
            const filledCount = filledValues.filter(v => v && String(v).trim()).length;
            return filledCount >= totalBlanks;
          });

          if (!allFilled) {
            setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
            return false;
          }
        }
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      if (!fields || fields.length === 0) {
        setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
        return true;
      }

      await form.validateFields(fields);
      setTabStatus(prev => ({ ...prev, [tab]: "complete" }));
      return true;
    } catch (error) {
      console.log("Validation error:", error);
      setTabStatus(prev => ({ ...prev, [tab]: "incomplete" }));
      return false;
    }
  };

  // Navigation between tabs
  const navigateToTab = (direction) => {
    const tabs = ["basicInfo", "tasks", "approvers", "content", "notes", "attachments", "references", "impact"];
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
    if (activeTab) {
      await validateTabFields(activeTab);
    }

    if (tabStatus[key] === "incomplete" &&
      (key === "approvers" || key === "content" || key === "settings" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }

    setActiveTab(key);
  };

  // Get tab status badge color
  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Handle task operations
  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', dueDate: null }]);
  };

  const removeTask = (index) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, i) => i !== index);
      setTasks(newTasks);
    }
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  // Handle participant operations
  const addParticipant = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user && !participants.some(p => p.userId === userId)) {
      setParticipants([...participants, { userId, role: 'viewer' }]);
    }
  };

  const removeParticipant = (userId) => {
    setParticipants(participants.filter(p => p.userId !== userId));
  };

  const updateParticipantRole = (userId, role) => {
    setParticipants(participants.map(p =>
      p.userId === userId ? { ...p, role } : p
    ));
  };

  const handleAddDocumentApprover = (userId) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const newApprover = {
      userId,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      department: u.department || '',
      role: approverType === 'review' ? DOC_REVIEWER_ROLE : DOC_APPROVER_ROLE,
      status: 'pending',
      received_at: new Date().toISOString(),
      dueDate: sharedDueDate,
      ...(approverType === 'approval' && { comment: '' })
    };
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    if (!documentWorkflowApprovers[targetArray].some((a) => a.userId === userId)) {
      setDocumentWorkflowApprovers((prev) => ({
        ...prev,
        [targetArray]: [...prev[targetArray], newApprover]
      }));
    }
  };

  const handleRemoveDocumentApprover = (userId) => {
    const targetArray = approverType === 'review' ? 'reviewers' : 'approvers';
    setDocumentWorkflowApprovers((prev) => ({
      ...prev,
      [targetArray]: prev[targetArray].filter((a) => a.userId !== userId)
    }));
  };

  const validateAllTabs = async () => {
    const order = ['basicInfo', 'approvers', 'content', 'impact'];
    for (const tab of order) {
      const ok = await validateTabFields(tab);
      if (!ok) {
        setActiveTab(tab);
        return { isValid: false, failedTab: tab };
      }
    }
    return { isValid: true };
  };

  const {
    persistDocument,
    handleSubmit,
    buildResolvedTemplateContent,
    buildDocumentPayload,
    buildUpdateBody,
  } = useDocumentPersistence({
    user,
    creatorId,
    document,
    form,
    contentData,
    templates,
    tasks,
    participants,
    tempAttachments,
    tempManualReferences,
    documentNotes,
    impactData,
    documentRequiredApprovers,
    documentWorkflowApprovers,
    sharedDueDate,
    documentNumber,
    projectNumber,
    costCenterNumber,
    setDocumentNumber,
    currentDocumentId,
    setCurrentDocumentId,
    currentDocumentIdRef,
    isCreatingRef,
    setActiveTab,
    validateAllTabs,
    onSuccess,
  });

  const { debouncedSave } = useAutoSave({
    currentDocumentId,
    form,
    contentData,
    onSave: handleSubmit,
    titleField: 'title'
  });

  const docMenuItems = useMemo(
    () => [
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
          setDocumentApproversModalVisible(true);
        }
      },
      {
        key: 'approval',
        label: 'Submit for Approval',
        icon: <SaveOutlined />,
        onClick: () => {
          setApproverType('approval');
          setDocumentApproversModalVisible(true);
        }
      }
    ],
    [handleSubmit]
  );

  const canSubmit = useMemo(
    () => Object.entries(tabStatus)
      .filter(([key]) => key !== 'review')
      .every(([_, status]) => status === "complete"),
    [tabStatus]
  );

  const renderTabBarExtra = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', paddingRight: '12px', flexWrap: 'nowrap' }}>
      <Button
        icon={<LeftOutlined />}
        onClick={() => navigateToTab('prev')}
        disabled={activeTab === 'basicInfo'}
        size="small"
      >
        Previous
      </Button>
      <Button
        type="default"
        onClick={() => navigateToTab('next')}
        disabled={activeTab === 'impact'}
        size="small"
      >
        Next <RightOutlined />
      </Button>
      <Dropdown
        menu={{ items: docMenuItems }}
        placement="bottomRight"
      >
        <Button size="small" type="primary">
          Create Document <DownOutlined />
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
  // Tabs extracted into modular components under ./tabs/



  // Review tab extracted to ./tabs/DocumentReviewTab.js

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
              tabBarExtraContent={renderTabBarExtra()}
              items={[
                {
                  key: "basicInfo",
                  label: (
                    <Badge dot status={getTabStatusColor("basicInfo")} offset={[5, 0]}>
                      <FileTextTwoTone /> Basic Info
                    </Badge>
                  ),
                  children: (
                    <DocumentBasicInfoTab
                      user={user}
                      templates={templates}
                      availableTemplates={availableTemplates}
                      departments={departments}
                      document={document}
                      currentDocumentId={currentDocumentId}
                      documentNumber={documentNumber}
                      projectNumber={projectNumber}
                      costCenterNumber={costCenterNumber}
                      updateDepartmentNumbers={updateDepartmentNumbers}
                      setContentData={setContentData}
                      debouncedSave={debouncedSave}
                      handleTemplateSelectChange={handleTemplateSelectChange}
                      handleImpactTemplateChange={handleImpactTemplateChange}
                    />
                  )
                },
                {
                  key: "tasks",
                  label: (
                    <Badge dot status={getTabStatusColor("tasks")} offset={[5, 0]}>
                      <EditOutlined /> Tasks
                    </Badge>
                  ),
                  children: (
                    <DocumentTasksTab
                      tasks={tasks}
                      addTask={addTask}
                      updateTask={updateTask}
                      removeTask={removeTask}
                    />
                  )
                },
                {
                  key: "approvers",
                  label: (
                    <Badge dot status={getTabStatusColor("approvers")} offset={[5, 0]}>
                      <TeamOutlinedTwo /> Approvers
                    </Badge>
                  ),
                  children: (
                    <TemplateApproversTab
                      parsedTemplate={parsedTemplateForApprovers}
                      selectedTemplate={selectedTemplate}
                      departments={departments}
                      users={users}
                      getCurrentUsersToShow={getCurrentUsersToShow}
                      isAuthor={true}
                      updateMetadata={updateMetadata}
                      workflowApprovers={documentWorkflowApprovers}
                      setWorkflowApprovers={setDocumentWorkflowApprovers}
                      reviewerRoleSlug={DOC_REVIEWER_ROLE}
                      approverRoleSlug={DOC_APPROVER_ROLE}
                    />
                  )
                },
                {
                  key: "content",
                  forceRender: true,
                  label: (
                    <Badge dot status={getTabStatusColor("content")} offset={[5, 0]}>
                      <EditOutlined /> Content
                    </Badge>
                  ),
                  children: (
                    <DocumentContentTab
                      form={form}
                      activeTab={activeTab}
                      templates={templates}
                      contentData={contentData}
                      setContentData={updateContentData}
                      contentVersion={contentVersion}
                      currentDocumentId={currentDocumentId}
                      document={document}
                      user={user}
                      documentWorkflowApprovers={documentWorkflowApprovers}
                      handleSubmit={handleSubmit}
                      debouncedSave={debouncedSave}
                    />
                  )
                },
                {
                  key: "notes",
                  label: (
                    <Badge dot status={getTabStatusColor("notes")} offset={[5, 0]}>
                      <MessageOutlined /> Notes
                    </Badge>
                  ),
                  children: (
                    <TemplateNotesTab 
                      parsedTemplate={{ id: currentDocumentId, notes: documentNotes || form.getFieldValue('notes') }} 
                      associationType="document" 
                      currentUser={user} 
                      onNotesChange={(newNotes) => {
                        setDocumentNotes(newNotes);
                        form.setFieldsValue({ notes: newNotes });
                      }}
                    />
                  )
                },
                {
                  key: "revisionHistory",
                  label: (
                    <span>
                      <HistoryOutlined /> Template History
                    </span>
                  ),
                  children: selectedTemplateIdWatch ? (
                    <TemplateRevisionHistoryTab 
                      templateId={selectedTemplateIdWatch}
                      currentVersion={templates?.find(t => t.id === selectedTemplateIdWatch)?.version}
                    />
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                      <Empty description="Please select a template to view its history" />
                    </div>
                  )
                },
                /* {
                  key: "settings",
                  label: (
                    <Badge dot status={getTabStatusColor("settings")} offset={[5, 0]}>
                      <SettingOutlined /> Settings
                    </Badge>
                  ),
                  children: renderSettingsTab()
                }, */
                {
                  key: "attachments",
                  label: (
                    <span>
                      <PaperClipOutlined /> Attachments
                    </span>
                  ),
                  children: (
                    <AttachmentsTab
                      associationType="document"
                      associationId={currentDocumentId}
                      templateId={selectedTemplateIdWatch}
                      canEdit={true}
                      initialAttachments={tempAttachments}
                      onAttachmentsChange={setTempAttachments}
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
                {
                  key: "impact",
                  label: (
                    <Badge dot status={getTabStatusColor("impact")} offset={[5, 0]}>
                      <TeamOutlined /> Impact
                    </Badge>
                  ),
                  children: (
                    <ImpactAssessment
                      impactData={impactData}
                      setImpactData={setImpactData}
                      departments={departments}
                      impactTemplates={impactData.impactTemplates || []}
                      onImpactTemplatesChange={(updatedTemplates) =>
                        setImpactData(prev => ({ ...prev, impactTemplates: updatedTemplates }))
                      }
                      documentId={currentDocumentId}
                      currentUser={user}
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
                  children: (
                    <DocumentReviewTab
                      availableTemplates={availableTemplates}
                      tasks={tasks}
                      documentRequiredApprovers={documentRequiredApprovers}
                      impactData={impactData}
                      docMenuItems={docMenuItems}
                      canSubmit={canSubmit}
                      tabStatus={tabStatus}
                    />
                  )
                } */
              ]}
            />
          </Form>
        </Col>
      </Row>

      <TemplateChangeWarningModal
        templateChangeModalVisible={templateChangeModalVisible}
        cancelTemplateChange={cancelTemplateChange}
        confirmTemplateChange={confirmTemplateChange}
      />

      <TemplateApproversModal
        visible={documentApproversModalVisible}
        onCancel={() => setDocumentApproversModalVisible(false)}
        approverType={approverType}
        setApproverType={setApproverType}
        sharedDueDate={sharedDueDate}
        setSharedDueDate={setSharedDueDate}
        templateApprovers={documentWorkflowApprovers}
        users={users}
        handleAddTemplateApprover={handleAddDocumentApprover}
        handleRemoveTemplateApprover={handleRemoveDocumentApprover}
        entityLabel="Document"
        reviewerRoleSlug={DOC_REVIEWER_ROLE}
        approverRoleSlug={DOC_APPROVER_ROLE}
        onSubmit={async () => {
          try {
            const isValid = await validateAllTabs();
            if (!isValid) {
              setDocumentApproversModalVisible(false);
              errorAlert('Creation Failed', 'Complete the information in Basic Tab');
              return;
            }
            if (!sharedDueDate) {
              message.error('Please select a due date');
              return;
            }
            if (approverType === 'approval') {
              setDirectApprovalWarningVisible(true);
              return;
            }
            handleSubmit('pending_review');
            setDocumentApproversModalVisible(false);
          } catch (e) {
            console.error(e);
          }
        }}
      />

      <DirectApprovalWarningModal
        directApprovalWarningVisible={directApprovalWarningVisible}
        setDirectApprovalWarningVisible={setDirectApprovalWarningVisible}
        handleSubmit={handleSubmit}
        setDocumentApproversModalVisible={setDocumentApproversModalVisible}
      />
    </div>
  );
};

export default CreateDocument;

