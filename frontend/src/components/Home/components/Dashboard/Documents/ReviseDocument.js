import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../../../../../api/apiClient';
import { successAlert, errorAlert, toastAlert } from '../../../../../utils/alerts';
import {
  Card, Form, Input, Button, Select, DatePicker, Row, Col,
  Tag, Typography, Alert, Divider, Space, Tabs,
  Badge, Dropdown, Tooltip, message, Empty, Table, Radio, Modal
} from 'antd';
import {
  PlusOutlined, CloseOutlined, FileTextOutlined,
  FileTextTwoTone, TeamOutlined as TeamOutlinedTwo,
  EditOutlined, FileSearchOutlined, LeftOutlined,
  RightOutlined, DownOutlined,
  InfoCircleOutlined, SaveOutlined, PaperClipOutlined,
  BookOutlined, TeamOutlined, MessageOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import UnifiedTextEditor from '../../../../Unified/UnifiedTextEditor';
import { stripCommentHighlights, countBlanksInHtml } from '../../../../../utils/templateUtils';
import TemplateApproversModal from '../Templates/CreateTemplate/components/TemplateApproversModal';
import { useAutoSave } from '../Templates/CreateTemplate/hooks/useAutoSave';
import moment from 'moment';
import AttachmentsTab from '../../../../Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import ImpactAssessment from '../Templates/CreateTemplate/components/ImpactAssessment';
import TemplateApproversTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateApproversTab';
import TemplateNotesTab from '../../../../Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const roleColors = {
  author: 'gold',
  editor: 'blue',
  commenter: 'green',
  viewer: 'default'
};

const DOC_REVIEWER_ROLE = 'document_reviewer';
const DOC_APPROVER_ROLE = 'document_approver';

const extractDocumentContent = (doc) => {
  if (!doc) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '', orientation: 'portrait', paperSize: 'A4', pagesState: null };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: '',
    orientation: doc.orientation || 'portrait',
    paperSize: doc.paperSize || 'A4',
    pagesState: doc.pagesState || null
  };

  const parseNestedJson = (val) => {
    let current = val;
    let rounds = 0;
    while (typeof current === 'string' && rounds < 5) {
      const trimmed = current.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        try {
          current = JSON.parse(trimmed);
        } catch (_) {
          break;
        }
      } else {
        break;
      }
      rounds++;
    }
    return current;
  };

  // 1) First check doc.comments (which in documentHelpers.normalizeDocumentRowForClient embeds virtual comments with content)
  if (doc.comments) {
    try {
      const parsedComments = parseNestedJson(doc.comments);
      if (parsedComments && typeof parsedComments === 'object') {
        if (parsedComments.content !== undefined && parsedComments.content !== null && parsedComments.content !== '') {
          loadedData.content = parsedComments.content;
        }
        if (parsedComments.headerHTML) loadedData.headerHTML = parsedComments.headerHTML;
        if (parsedComments.footerHTML) loadedData.footerHTML = parsedComments.footerHTML;
        if (parsedComments.logo) loadedData.logo = parsedComments.logo;
        if (parsedComments.logoText) loadedData.logoText = parsedComments.logoText;
        if (parsedComments.logoTextRight) loadedData.logoTextRight = parsedComments.logoTextRight;
        if (parsedComments.orientation) loadedData.orientation = parsedComments.orientation;
        if (parsedComments.paperSize) loadedData.paperSize = parsedComments.paperSize;
        if (parsedComments.pagesState) loadedData.pagesState = parsedComments.pagesState;
        if (parsedComments.references && Array.isArray(parsedComments.references)) {
          loadedData.references = parsedComments.references.filter(r => !r.isManual && r.refAnchor);
          loadedData.manualReferences = parsedComments.manualReferences || parsedComments.references.filter(r => r.isManual || !r.refAnchor);
        }
      } else if (typeof parsedComments === 'string' && parsedComments.includes('<')) {
        loadedData.content = parsedComments;
      }
    } catch (_) {}
  }

  // 2) Check doc.content
  if (!loadedData.content && doc.content) {
    try {
      const parsed = parseNestedJson(doc.content);
      if (parsed && typeof parsed === 'object') {
        loadedData.content = parsed.content || parsed.html || (Array.isArray(parsed) ? parsed : '');
        if (parsed.references && Array.isArray(parsed.references)) {
          loadedData.references = parsed.references.filter(r => !r.isManual && r.refAnchor);
        }
        if (parsed.manualReferences && Array.isArray(parsed.manualReferences)) {
          loadedData.manualReferences = parsed.manualReferences;
        }
        if (parsed.logo) loadedData.logo = parsed.logo;
        if (parsed.headerHTML && !loadedData.headerHTML) loadedData.headerHTML = parsed.headerHTML;
        if (parsed.footerHTML && !loadedData.footerHTML) loadedData.footerHTML = parsed.footerHTML;
        if (parsed.logoText) loadedData.logoText = parsed.logoText;
        if (parsed.logoTextRight) loadedData.logoTextRight = parsed.logoTextRight;
        if (parsed.orientation) loadedData.orientation = parsed.orientation;
        if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
        if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
      } else if (parsed) {
        loadedData.content = parsed;
      }
    } catch (e) {
      loadedData.content = doc.content;
    }
  }

  // 3) Extract fallbacks from elements
  if (doc.elements) {
    try {
      const parsedElements = parseNestedJson(doc.elements);
      if (parsedElements && typeof parsedElements === 'object') {
        if (!loadedData.content && (parsedElements.content || parsedElements.html)) {
          loadedData.content = parsedElements.content || parsedElements.html;
        }
        if (parsedElements.headerHTML && !loadedData.headerHTML) loadedData.headerHTML = parsedElements.headerHTML;
        if (parsedElements.footerHTML && !loadedData.footerHTML) loadedData.footerHTML = parsedElements.footerHTML;
        if (parsedElements.logo && !loadedData.logo) loadedData.logo = parsedElements.logo;
        if (parsedElements.logoText && !loadedData.logoText) loadedData.logoText = parsedElements.logoText;
        if (parsedElements.logoTextRight && !loadedData.logoTextRight) loadedData.logoTextRight = parsedElements.logoTextRight;
        if (parsedElements.orientation && !loadedData.orientation) loadedData.orientation = parsedElements.orientation;
        if (parsedElements.paperSize && !loadedData.paperSize) loadedData.paperSize = parsedElements.paperSize;
        if (parsedElements.pagesState && !loadedData.pagesState) loadedData.pagesState = parsedElements.pagesState;
      }
    } catch (e) { }
  }

  // Clear comments and suggestions for new revision
  loadedData.comments = [];
  loadedData.suggestions = [];

  if (doc.headerHTML) loadedData.headerHTML = doc.headerHTML;
  if (doc.footerHTML) loadedData.footerHTML = doc.footerHTML;

  if (typeof loadedData.content === 'string') {
    loadedData.content = stripCommentHighlights(loadedData.content);
  }
  return loadedData;
};

const extractTemplateContent = (template) => {
  if (!template) return { content: '', comments: [], suggestions: [], references: [], logo: null, logoText: '', logoTextRight: '', orientation: 'portrait', paperSize: 'A4', pagesState: null };

  let loadedData = {
    content: '',
    comments: [],
    suggestions: [],
    references: [],
    logo: null,
    logoText: '',
    logoTextRight: '',
    orientation: template.orientation || 'portrait',
    paperSize: template.paperSize || 'A4',
    pagesState: template.pagesState || null
  };

  if (template.comments) {
    try {
      let parsed = template.comments;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.content || parsed.logo) {
          loadedData.content = parsed.content || '';
          loadedData.comments = [];
          loadedData.suggestions = [];
          loadedData.references = (parsed.references && Array.isArray(parsed.references))
            ? parsed.references.filter(r => !r.isManual && r.refAnchor)
            : [];
          loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
            ? parsed.references.filter(r => r.isManual || !r.refAnchor)
            : []);
          loadedData.logo = parsed.logo || null;
          loadedData.headerHTML = parsed.headerHTML ? stripCommentHighlights(parsed.headerHTML) : '';
          loadedData.footerHTML = parsed.footerHTML ? stripCommentHighlights(parsed.footerHTML) : '';
          loadedData.logoText = parsed.logoText || '';
          loadedData.logoTextRight = parsed.logoTextRight || '';
          if (parsed.orientation) loadedData.orientation = parsed.orientation;
          if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
          if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
        } else if (typeof parsed === 'string' && parsed.includes('<')) {
          loadedData.content = parsed;
        }
      } else if (typeof parsed === 'string' && parsed.includes('<')) {
        loadedData.content = parsed;
      }
    } catch (e) {
      if (typeof template.comments === 'string' && template.comments.includes('<')) {
        loadedData.content = template.comments;
      }
    }
  }

  if (!loadedData.content && template.content) {
    try {
      let parsed = template.content;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        loadedData.content = parsed.content || '';
        loadedData.references = (parsed.references && Array.isArray(parsed.references))
          ? parsed.references.filter(r => !r.isManual && r.refAnchor)
          : [];
        loadedData.manualReferences = parsed.manualReferences || (parsed.references && Array.isArray(parsed.references)
          ? parsed.references.filter(r => r.isManual || !r.refAnchor)
          : []);
        loadedData.logo = parsed.logo || null;
        loadedData.headerHTML = parsed.headerHTML ? stripCommentHighlights(parsed.headerHTML) : '';
        loadedData.footerHTML = parsed.footerHTML ? stripCommentHighlights(parsed.footerHTML) : '';
        loadedData.logoText = parsed.logoText || '';
        loadedData.logoTextRight = parsed.logoTextRight || '';
        if (parsed.orientation) loadedData.orientation = parsed.orientation;
        if (parsed.paperSize) loadedData.paperSize = parsed.paperSize;
        if (parsed.pagesState) loadedData.pagesState = parsed.pagesState;
      } else {
        loadedData.content = String(template.content);
      }
    } catch (e) {
      loadedData.content = String(template.content);
    }
  }

  loadedData.content = stripCommentHighlights(loadedData.content);
  return loadedData;
};

const mapParticipantRoleForDb = (role) => (role === 'commenter' ? 'viewer' : role);

const ReviseDocument = ({ fetchUserData, document, user, users, templates, departments = [], onCancel, onSuccess }) => {
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
  const creatorId = user?.id ?? user?.userId;
  const [activeTab, setActiveTab] = useState("basicInfo");
  const [tasks, setTasks] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [contentData, setContentData] = useState(null);
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

  // Replicate revision state from ReviseTemplate
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const currentDocumentIdRef = useRef(null);
  const isCreatingRef = useRef(false);

  // Template switching & confirmation state
  const [templateChangeModalVisible, setTemplateChangeModalVisible] = useState(false);
  const pendingTemplateChangeRef = useRef(null);
  const appliedTemplateRef = useRef(null);

  // Numbering system state for revision
  const [documentNumber, setDocumentNumber] = useState(document?.document_number || '');
  const [projectNumber, setProjectNumber] = useState(document?.project_number || '');
  const [costCenterNumber, setCostCenterNumber] = useState(document?.cost_center_number || '');
  const [department, setDepartment] = useState(document?.department || '');

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
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState(null);

  const [tabStatus, setTabStatus] = useState({
    basicInfo: "complete",
    tasks: "complete",
    approvers: "complete",
    content: "complete",
    impact: "complete",
    review: "complete"
  });

  const parsedTemplateForApprovers = useMemo(() => {
    return {
      status: document?.status || 'draft',
      required_approvers: documentRequiredApprovers,
      template_approvers: documentWorkflowApprovers,
      document_id: currentDocumentId || document?.document_id || document?.id
    };
  }, [document, documentRequiredApprovers, documentWorkflowApprovers, currentDocumentId]);

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

  // Auto-fill from parent document
  useEffect(() => {
    if (document) {
      let isCancelled = false;
      const loadDoc = async () => {
        let fullDoc = document;
        const docId = document.document_id || document.id;

        if (docId && !fullDoc.content && !fullDoc.comments && !fullDoc.elements) {
          try {
            const res = await apiClient.get(`/api/get_document/${docId}`);
            if (res.data && !isCancelled) {
              fullDoc = res.data;
            }
          } catch (e) {
            console.error('Error fetching full document in ReviseDocument:', e);
          }
        }
        if (isCancelled) return;

        form.setFieldsValue({
          title: fullDoc.title || '',
          templateId: fullDoc.template_id || undefined
        });
        appliedTemplateRef.current = fullDoc.template_id || null;

        // Initialize currentDocumentId
        if (fullDoc.revision_parent_id || fullDoc.status === 'draft') {
          setCurrentDocumentId(fullDoc.document_id || fullDoc.id);
          currentDocumentIdRef.current = fullDoc.document_id || fullDoc.id;
        } else if (fullDoc.status === 'published') {
          // If a published document was passed, ensure the revision draft exists
          try {
            const revRes = await apiClient.post(`/api/documents/${docId}/revise`);
            if (revRes.data?.documentId) {
              setCurrentDocumentId(revRes.data.documentId);
              currentDocumentIdRef.current = revRes.data.documentId;
            }
          } catch (revErr) {
            console.error('Error ensuring revision draft in ReviseDocument:', revErr);
          }
        }

        if (fullDoc.document_number) setDocumentNumber(fullDoc.document_number);
        if (fullDoc.project_number) setProjectNumber(fullDoc.project_number);
        if (fullDoc.cost_center_number) setCostCenterNumber(fullDoc.cost_center_number);
        if (fullDoc.department) setDepartment(fullDoc.department);

        // Load content
        const extracted = extractDocumentContent(fullDoc);
        setContentData(extracted);

        // Load required approvers from document
        if (fullDoc.required_approvers) {
          try {
            const parsed = typeof fullDoc.required_approvers === 'string'
              ? JSON.parse(fullDoc.required_approvers)
              : fullDoc.required_approvers;
            setDocumentRequiredApprovers(parsed || []);
          } catch (e) {
            console.error("Error parsing document required approvers", e);
          }
        }

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

        // Load impact assessment data (only if this is an existing revision draft in progress; if revising anew, impact resets)
        const isExistingRevisionDraft = Boolean(fullDoc.revision_parent_id && fullDoc.status === 'draft');
        if (fullDoc.impact && isExistingRevisionDraft) {
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
        } else {
          // Impact assessment must be reset so user can choose/evaluate it anew
          setImpactData({
            departmentImpacts: [],
            affectedSystems: [],
            implementationEffort: 'medium',
            trainingRequired: false,
            impactNotes: '',
            impactTemplates: []
          });
          form.setFieldsValue({ impactTemplateId: undefined });
        }

        // Load workflow approvers
        if (fullDoc.template_approvers) {
          try {
            const parsed = typeof fullDoc.template_approvers === 'string'
              ? JSON.parse(fullDoc.template_approvers)
              : fullDoc.template_approvers;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setDocumentWorkflowApprovers({
                reviewers: Array.isArray(parsed.reviewers) ? parsed.reviewers : [],
                approvers: Array.isArray(parsed.approvers) ? parsed.approvers : []
              });
            }
          } catch (e) {
            console.error("Error parsing document template_approvers", e);
          }
        }

        // Set all form/tab status as complete since they are loaded from a valid published document
        setTabStatus({
          basicInfo: "complete",
          tasks: "complete",
          approvers: "complete",
          content: "complete",
          impact: "complete",
          review: "complete"
        });
      };

      loadDoc();
      return () => { isCancelled = true; };
    }
  }, [document, form, templates]);

  const selectedTemplateIdWatch = Form.useWatch('templateId', form);
  const selectedTemplate = useMemo(() => {
    const tId = selectedTemplateIdWatch || document?.template_id;
    return templates.find(t => t.id === tId);
  }, [selectedTemplateIdWatch, templates, document]);

  const loadApproversFromTemplate = useCallback((t) => {
    if (!t) {
      setDocumentRequiredApprovers([]);
      setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
      return;
    }

    if (t.custom_document_approvers) {
      try {
        const parsedCustom = typeof t.custom_document_approvers === 'string'
          ? JSON.parse(t.custom_document_approvers)
          : t.custom_document_approvers;
        
        if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
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
        console.error("Error parsing custom_document_approvers in ReviseDocument:", e);
      }
    }

    setDocumentRequiredApprovers([]);
    setDocumentWorkflowApprovers({ reviewers: [], approvers: [] });
  }, []);

  const handleTemplateSelectChange = useCallback((newTemplateId) => {
    const currentId = appliedTemplateRef.current;
    if (newTemplateId === currentId) return;

    pendingTemplateChangeRef.current = newTemplateId;
    // Keep the displayed form field value as currentId until confirmation
    form.setFieldsValue({ templateId: currentId || undefined });
    setTemplateChangeModalVisible(true);
  }, [form]);

  const confirmTemplateChange = useCallback(async () => {
    const newId = pendingTemplateChangeRef.current;
    pendingTemplateChangeRef.current = null;
    setTemplateChangeModalVisible(false);

    appliedTemplateRef.current = newId;
    form.setFieldsValue({
      templateId: newId || undefined,
      impactTemplateId: undefined
    });

    if (newId) {
      let tpl = templates.find(t => t.id === newId);
      if (tpl && !tpl.content && !tpl.comments) {
        try {
          const res = await apiClient.get(`/api/get_template/${newId}`);
          if (res.data) tpl = res.data;
        } catch (e) {
          console.error('Error fetching template content on change confirm:', e);
        }
      }
      if (tpl) {
        const extracted = extractTemplateContent(tpl);
        setContentData(extracted);
        loadApproversFromTemplate(tpl);
      } else {
        setContentData(null);
        loadApproversFromTemplate(null);
      }
    } else {
      setContentData(null);
      loadApproversFromTemplate(null);
    }

    // Reset impact data, impact tags, and impact templates
    setImpactData({
      departmentImpacts: [],
      affectedSystems: [],
      implementationEffort: 'medium',
      trainingRequired: false,
      impactNotes: '',
      impactTemplates: []
    });

    message.info('Template updated. Template-dependent and impact data have been reset.');
  }, [form, templates, loadApproversFromTemplate]);

  const cancelTemplateChange = useCallback(() => {
    pendingTemplateChangeRef.current = null;
    setTemplateChangeModalVisible(false);
    form.setFieldsValue({ templateId: appliedTemplateRef.current || undefined });
  }, [form]);

  const handleImpactTemplateChange = useCallback(async (templateId) => {
    if (!templateId) {
      setImpactData(prev => ({
        ...prev,
        impactTemplates: []
      }));
      return;
    }

    let selectedTpl = templates.find(t => t.id === templateId);
    if (!selectedTpl) return;

    if (!selectedTpl.content && !selectedTpl.comments) {
      try {
        const res = await apiClient.get(`/api/get_template/${templateId}`);
        if (res.data) selectedTpl = res.data;
      } catch (e) {
        console.error('Error fetching impact template:', e);
      }
    }

    const extracted = extractTemplateContent(selectedTpl);
    const newTemplate = {
      id: templateId,
      name: selectedTpl.name,
      content: extracted?.content || '',
      filledValues: [],
      dropdownValues: [],
    };

    setImpactData(prev => ({
      ...prev,
      impactTemplates: [newTemplate]
    }));
  }, [templates]);

  // Validate fields on tab change
  const validateTabFields = async (tab) => {
    try {
      const tabFieldMapping = {
        basicInfo: ['title'],
        tasks: [],
        approvers: [],
        content: [],
        attachments: [],
        impact: [],
        review: []
      };

      const fields = tabFieldMapping[tab];

      if (tab === 'tasks') {
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
    const tabs = ["basicInfo", "tasks", "approvers", "content", "attachments", "references", "impact"];
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
      (key === "approvers" || key === "content" || key === "review")) {
      setTabStatus(prev => ({ ...prev, [key]: "complete" }));
    }

    setActiveTab(key);
  };

  const getTabStatusColor = (tabKey) => {
    return tabStatus[tabKey] === "complete" ? "success" : "error";
  };

  // Handle task operations
  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', dueDate: null }]);
  };

  const removeTask = (index) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  // Handle participant operations
  const addParticipant = (userId) => {
    const u = users.find(x => x.id === userId);
    if (u && !participants.some(p => p.userId === userId)) {
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

  const handleDocumentStatusUpdate = async (docId, newStatus) => {
    try {
      const response = await axios.put(`/api/documents/${docId}/status`, {
        status: newStatus
      });
      return response.data;
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  const persistDocument = async (docStatus, isAutoSave, overrideContent) => {
    if (!user || creatorId == null) {
      if (!isAutoSave) errorAlert('Not signed in', 'You must be logged in to save.');
      return false;
    }
    const effectiveId = currentDocumentIdRef.current || currentDocumentId;
    const activeContent = overrideContent || contentData;
    const formValues = form.getFieldsValue(true);

    if (isAutoSave) {
      if (!effectiveId && !formValues.title?.trim()) return false;
    } else if (docStatus === 'draft') {
      try {
        await form.validateFields(['title']);
      } catch {
        message.error('Enter a document title on Basic Info before saving a draft.');
        setActiveTab('basicInfo');
        return false;
      }
    }

    let workflowForSubmit = null;
    if (docStatus === 'pending_review' || docStatus === 'pending_approval') {
      let updated = { ...documentWorkflowApprovers };
      if (sharedDueDate) {
        const targetArray = docStatus === 'pending_review' ? 'reviewers' : 'approvers';
        updated[targetArray] = updated[targetArray].map((a) => ({
          ...a,
          dueDate: sharedDueDate
        }));
      }
      workflowForSubmit = updated;
    }

    // Prepare tasks
    const validTasks = tasks
      .filter((task) => task.title && task.title.trim() !== '')
      .map((task) => ({
        title: task.title,
        description: task.description || null,
        due_date:
          task.dueDate && typeof task.dueDate.format === 'function'
            ? task.dueDate.format('YYYY-MM-DD HH:mm')
            : null,
        created_by: creatorId
      }));

    // Prepare content payload
    let finalContent = activeContent?.content ?? '';
    let finalLogo = activeContent?.logo ?? null;
    let finalLogoText = activeContent?.logoText ?? '';
    let finalLogoTextRight = activeContent?.logoTextRight ?? '';

    const contentObj = {
      content: finalContent,
      logo: finalLogo,
      logoText: finalLogoText,
      logoTextRight: finalLogoTextRight,
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || []
    };

    const elementsObj = {
      comments: activeContent?.comments || [],
      suggestedEdits: activeContent?.suggestions || [],
      references: (activeContent?.references && Array.isArray(activeContent.references))
        ? activeContent.references.filter(r => !r.isManual && r.refAnchor)
        : [],
      manualReferences: tempManualReferences || [],
      headerHTML: formValues.title || '',
      footerHTML: activeContent?.footerHTML || '',
      logo: finalLogo,
      logoText: finalLogoText,
      logoTextRight: finalLogoTextRight
    };

    try {
      if (effectiveId) {
        // Update existing revision draft
        const body = {
          title: formValues.title,
          template_id: formValues.templateId || null,
          content: JSON.stringify(contentObj),
          elements: JSON.stringify(elementsObj),
          version: document.revision_parent_id ? document.version : (document.version + 1),
          revision_parent_id: document.revision_parent_id || document.document_id,
          impact: impactData || {},
          required_approvers: documentRequiredApprovers,
          project_number: projectNumber || document?.project_number || null,
          cost_center_number: costCenterNumber || document?.cost_center_number || null,
          department: department || document?.department || null
        };

        if (!isAutoSave) {
          body.status = docStatus;
          if (workflowForSubmit) {
            body.approvers = workflowForSubmit;
          }
        }

        const res = await axios.put(`/api/update_document/${effectiveId}`, body);
        if (res.data.success) {
          if (!isAutoSave) {
            onCancel();
          }
          return true;
        }
      } else {
        // Create new revision draft via revise API to preserve parent Version 1 untouched
        if (isCreatingRef.current) return false;
        isCreatingRef.current = true;

        let newId = null;
        try {
          const revRes = await apiClient.post(`/api/documents/${document.document_id}/revise`);
          if (revRes.data?.documentId) {
            newId = revRes.data.documentId;
            currentDocumentIdRef.current = newId;
            setCurrentDocumentId(newId);

            // Update with form values immediately
            const body = {
              title: formValues.title,
              template_id: formValues.templateId || null,
              content: JSON.stringify(contentObj),
              elements: JSON.stringify(elementsObj),
              impact: impactData || {},
              required_approvers: documentRequiredApprovers,
              project_number: projectNumber || document?.project_number || null,
              cost_center_number: costCenterNumber || document?.cost_center_number || null,
              department: department || document?.department || null
            };
            if (!isAutoSave) {
              body.status = docStatus;
              if (workflowForSubmit) {
                body.approvers = workflowForSubmit;
              }
            }
            await axios.put(`/api/update_document/${newId}`, body);

            if (!isAutoSave) {
              if (onSuccess) onSuccess();
              else if (onCancel) onCancel();
            }
            return true;
          }
        } catch (e) {
          console.error('Error creating revision draft via revise endpoint:', e);
        }
      }
    } catch (error) {
      if (!isAutoSave) {
        errorAlert(
          'Save failed',
          error.response?.data?.message || error.response?.data?.error || error.message
        );
      }
      return false;
    } finally {
      if (!effectiveId) {
        isCreatingRef.current = false;
      }
    }
    return false;
  };

  const handleSubmit = useCallback((status = 'draft', isAutoSave = false, overrideContent = null) => {
    if (isAutoSave) {
      persistDocument('draft', true, overrideContent);
      return;
    }
    if (status === 'draft') {
      persistDocument('draft', false, null).then((ok) => {
        if (ok) toastAlert('Document revision saved as draft');
      });
      return;
    }
    if (status === 'pending_review' || status === 'pending_approval') {
      validateAllTabs().then((result) => {
        const { isValid, failedTab } = result;
        if (!isValid) {
          // If the impact tab is incomplete, show a specific message
          if (failedTab === "impact") {
            errorAlert(
              'Submission failed',
              'Please complete all fields in the Impact Form before submitting for review or approval.'
            );
          } else {
            errorAlert(
              'Creation Failed',
              'Complete the information in Basic Tab'
            );
          }
          return;
        }
        persistDocument(status, false, null).then((ok) => {
          if (ok) {
            const actionText = status === 'pending_review' ? 'review' : 'approval';
            successAlert('Document revision submitted', `Document revision submitted for ${actionText} successfully.`);
          }
        });
      });
    }
  }, [persistDocument, validateAllTabs]);

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
      <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
        <Button size="small" type="primary">
          Update Document <DownOutlined />
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

  const renderBasicInfoTab = () => (
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
                const isConflict = templates.some(
                  t => t.name && 
                       t.name.trim().toLowerCase() === trimmed && 
                       (!userOrgId || !t.organization_id || String(t.organization_id) === String(userOrgId)) &&
                       String(t.id) !== String(document?.template_id)
                );
                if (isConflict) {
                  return Promise.reject(new Error('A template with this name already exists in your organization.'));
                }
              }

              // Real-time authoritative check against database (both templates and documents)
              try {
                const res = await apiClient.get('/api/check-name-conflict', {
                  params: {
                    name: value.trim(),
                    type: 'document',
                    excludeId: document?.document_id || document?.id || undefined
                  }
                });
                if (res.data && res.data.available === false) {
                  return Promise.reject(new Error(res.data.message || 'A document or template with this name already exists in your organization.'));
                }
              } catch (err) {
                console.warn('Name availability check warning:', err);
              }

              return Promise.resolve();
            }
          }
        ]}
      >
        <Input placeholder="Enter document title" size="large" />
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

          {department ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: (documentNumber || projectNumber || costCenterNumber) ? '1px solid #cbd5e1' : 'none',
              paddingLeft: (documentNumber || projectNumber || costCenterNumber) ? 16 : 0
            }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Department:
              </span>
              <span style={{
                fontWeight: 700,
                fontSize: '14px',
                color: '#1d4ed8',
                letterSpacing: '0.3px'
              }}>
                {department}
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
        >
          {availableTemplates.map(template => (
            <Option key={template.id} value={template.id}>
              {template.name}
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

      <Modal
        title="Confirm Template Change"
        open={templateChangeModalVisible}
        onCancel={cancelTemplateChange}
        footer={[
          <Button key="cancel" onClick={cancelTemplateChange}>
            Cancel
          </Button>,
          <Button key="continue" type="primary" danger onClick={confirmTemplateChange}>
            Continue
          </Button>,
        ]}
      >
        <p>
          Changing the template will reset existing template-related data and impact information. This action may cause existing data to be lost. Do you want to continue?
        </p>
      </Modal>
    </Card>
  );

  const renderTasksTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Document Tasks
          <Tooltip title="Define the tasks or sections that need to be completed for this document">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        {tasks.map((task, index) => (
          <div key={index} style={{ position: 'relative', marginBottom: 16, border: '1px solid #f0f0f0', padding: 16, borderRadius: 6 }}>
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Task {index + 1}</Text>
                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => removeTask(index)}
                    style={{ float: 'right' }}
                    size="small"
                  />
                </div>
              </Col>
              <Col span={24}>
                <Input
                  placeholder="Enter task title"
                  value={task.title}
                  onChange={(e) => updateTask(index, 'title', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <TextArea
                  rows={2}
                  placeholder="Enter task description"
                  value={task.description}
                  onChange={(e) => updateTask(index, 'description', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              </Col>
              <Col span={24}>
                <DatePicker
                  placeholder="Select due date (optional)"
                  style={{ width: '100%' }}
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  value={task.dueDate}
                  onChange={(date) => updateTask(index, 'dueDate', date)}
                />
              </Col>
            </Row>
          </div>
        ))}

        <Button
          type="dashed"
          onClick={addTask}
          block
          icon={<PlusOutlined />}
        >
          Add Task
        </Button>
      </div>

      <Alert
        message="Tasks are optional"
        type="info"
        style={{ marginTop: 16 }}
      />
    </Card>
  );

  const renderParticipantsTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Document Access & Participants
          <Tooltip title="Manage who can access this document and their permission levels">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <p><strong>Creator:</strong></p>
        <Tag color={roleColors.author}>
          {user.email} (Author)
        </Tag>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Text strong>Add Team Members</Text>
        <Select
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Select team members by email"
          value={null}
          onChange={addParticipant}
          optionLabelProp="label"
        >
          {selectableUsers
            .filter(user => !participants.some(p => p.userId === user.id))
            .map(user => (
              <Option
                key={user.id}
                value={user.id}
                label={user.email}
              >
                <div>
                  <div>{user.email}</div>
                  <div style={{ fontSize: 'smaller', color: '#666' }}>{user.first_name} {user.last_name}</div>
                </div>
              </Option>
            ))
          }
        </Select>
      </div>

      {participants.length > 0 ? (
        <Table
          dataSource={participants}
          rowKey="userId"
          pagination={false}
          columns={[
            {
              title: 'User',
              dataIndex: 'userId',
              key: 'user',
              render: (uid) => {
                const u = users.find(x => x.id === uid);
                return u ? `${u.first_name} ${u.last_name} (${u.email})` : 'Unknown User';
              }
            },
            {
              title: 'Permission Role',
              dataIndex: 'role',
              key: 'role',
              render: (role, record) => (
                <Select
                  value={role}
                  onChange={(val) => updateParticipantRole(record.userId, val)}
                  style={{ width: 130 }}
                >
                  <Option value="editor">Editor</Option>
                  <Option value="commenter">Commenter</Option>
                  <Option value="viewer">Viewer</Option>
                </Select>
              )
            },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Button
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => removeParticipant(record.userId)}
                />
              )
            }
          ]}
        />
      ) : (
        <Empty description="No other participants added yet" />
      )}
    </Card>
  );

  const renderContentTab = () => (
    <div style={{ padding: 0 }}>
      <Form.Item noStyle shouldUpdate>
        {({ getFieldValue }) => {
          const documentTitle = getFieldValue('title');

          const fallbackEmpty = {
            content: '',
            comments: [],
            suggestions: [],
            references: [],
            logo: null,
            headerHTML: '',
            footerHTML: '',
            logoText: '',
            logoTextRight: ''
          };

          const cd = contentData && typeof contentData === 'object' ? contentData : fallbackEmpty;

          return (
            <UnifiedTextEditor
              isActive={activeTab === "content"}
              mode="create"
              isDocument={true}
              document={document}
              status={document?.status}
              isDraft={false}
              isRevise={true}
              documentId={currentDocumentId || document?.document_id}
              templateId={form.getFieldValue('templateId') || document?.template_id}
              user={user}
              socketEnabled={false}
              documentTitle={documentTitle}
              initialContent={cd}
              workflowApprovers={documentWorkflowApprovers}
              approvers={documentWorkflowApprovers}
              logo={cd.logo}
              setLogo={(logo) =>
                setContentData((prev) => {
                  const safePrev = prev && typeof prev === 'object' ? prev : {};
                  const next = { ...safePrev };
                  if (logo === null) {
                    next.logo = null;
                  } else if (logo && typeof logo === 'object') {
                    next.logo = { ...(safePrev.logo || {}), ...logo };
                  }
                  return next;
                })
              }
              onContentChange={(changeData) => {
                setContentData((prev) => {
                  const safePrev = prev && typeof prev === 'object' ? prev : {};
                  return { ...safePrev, ...changeData };
                });
                if (changeData.source === 'comment-system') {
                  handleSubmit('draft', true, changeData);
                } else {
                  debouncedSave();
                }
              }}
            />
          );
        }}
      </Form.Item>
    </div>
  );

  const renderReviewTab = () => (
    <Card
      bordered={false}
      title={
        <span>
          Review Revision Settings
          <Tooltip title="Please review your document configuration before submitting.">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" title="Basic Information">
            <p><strong>Title:</strong> {form.getFieldValue('title')}</p>
            <p><strong>Original Title:</strong> {document.title}</p>
            <p><strong>New Version:</strong> {document.version + 1}</p>
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Tasks Summary">
            {tasks.length > 0 ? (
              <ul>
                {tasks.map((t, idx) => (
                  <li key={idx}>
                    <strong>{t.title}</strong> {t.dueDate ? `(Due: ${moment(t.dueDate).format('YYYY-MM-DD')})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <Text type="secondary">No tasks defined</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Approvers Configuration">
            {documentRequiredApprovers.length > 0 ? (
              <Table
                columns={[
                  {
                    title: 'Stage',
                    dataIndex: 'stage',
                    key: 'stage',
                    render: (stage) => <Tag>{stage || 'Approval'}</Tag>
                  },
                  {
                    title: 'Department',
                    dataIndex: 'department',
                    key: 'department',
                  },
                  {
                    title: 'Mandatory',
                    dataIndex: 'mandatory',
                    key: 'mandatory',
                    render: (mandatory) => (
                      <Tag color={mandatory ? 'green' : 'orange'}>
                        {mandatory ? 'Yes' : 'No'}
                      </Tag>
                    )
                  }
                ]}
                dataSource={documentRequiredApprovers}
                pagination={false}
                size="small"
                rowKey={(record, index) => `approver-${index}`}
              />
            ) : (
              <Text type="secondary">No required approvers configured</Text>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card size="small" title="Impact Assessment Summary">
            {impactData.impactTemplates && impactData.impactTemplates.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                {impactData.impactTemplates.map((tpl, idx) => (
                  <div key={tpl.id || idx} style={{ marginBottom: 4 }}>
                    <Tag color="blue">Template: {tpl.name}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({(tpl.filledValues || []).filter(v => v?.trim()).length} fields completed)
                    </Text>
                  </div>
                ))}
              </div>
            ) : null}
            <p><strong>Impacted Departments:</strong> {
              impactData.departmentImpacts && impactData.departmentImpacts.length > 0
                ? impactData.departmentImpacts.join(', ')
                : 'None'
            }</p>
            <p><strong>Implementation Effort:</strong> <Tag color="blue">{impactData.implementationEffort?.toUpperCase() || 'MEDIUM'}</Tag></p>
            <p><strong>Training Required:</strong> {impactData.trainingRequired ? 'Yes' : 'No'}</p>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Dropdown menu={{ items: docMenuItems }} placement="bottomRight">
          <Button type="primary" size="large">
            Submit Document Revision <DownOutlined />
          </Button>
        </Dropdown>
      </div>
    </Card>
  );

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
                {
                  key: "tasks",
                  label: (
                    <Badge dot status={getTabStatusColor("tasks")} offset={[5, 0]}>
                      <FileTextOutlined /> Tasks
                    </Badge>
                  ),
                  children: renderTasksTab()
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
                  children: renderContentTab()
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
                      parsedTemplate={document} 
                      associationType="document" 
                      currentUser={user} 
                      onNotesChange={(newNotes) => form.setFieldsValue({ notes: newNotes })}
                    />
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
                      associationType="document"
                      associationId={currentDocumentId || document?.document_id}
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
                      documentId={document?.document_id || document?.id}
                      currentUser={user}
                    />
                  )
                },
                /* {
                  key: "review",
                  label: (
                    <Badge dot status={getTabStatusColor("review")} offset={[5, 0]}>
                      <FileSearchOutlined /> Review & Submit
                    </Badge>
                  ),
                  children: renderReviewTab()
                } */
              ]}
            />
          </Form>
        </Col>
      </Row>

      <Modal
        title={`Select Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`}
        visible={documentApproversModalVisible}
        onCancel={() => setDocumentApproversModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDocumentApproversModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => {
              handleSubmit(approverType === 'review' ? 'pending_review' : 'pending_approval');
              setDocumentApproversModalVisible(false);
            }}
            disabled={
              (approverType === 'review' && documentWorkflowApprovers.reviewers.length === 0) ||
              (approverType === 'approval' && documentWorkflowApprovers.approvers.length === 0) ||
              !sharedDueDate
            }
          >
            Submit for {approverType === 'review' ? 'Review' : 'Approval'}
          </Button>
        ]}
        width={800}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Submission Type" size="small">
              <Radio.Group
                value={approverType}
                onChange={(e) => setApproverType(e.target.value)}
                style={{ width: '100%' }}
              >
                <Radio value="review">Submit for Review</Radio>
                <Radio value="approval">Submit for Approval</Radio>
              </Radio.Group>
              <Alert
                message={
                  approverType === 'review'
                    ? "Reviewers will provide feedback and recommendations on the document"
                    : "Approvers will make the final decision to approve or reject the document"
                }
                type="info"
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Due Date" size="small">
              <DatePicker
                style={{ width: '100%' }}
                placeholder="Select due date"
                value={sharedDueDate}
                onChange={setSharedDueDate}
                popupStyle={{ zIndex: 10050 }}
                disabledDate={(current) => current && current < moment().startOf('day')}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title={`Add Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
              <Select
                style={{ width: '100%' }}
                dropdownStyle={{ zIndex: 10050 }}
                placeholder="Select users by email"
                value={null}
                onChange={handleAddDocumentApprover}
                optionLabelProp="label"
                showSearch
                filterOption={(input, option) =>
                  option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {(users || [])
                  .filter(u => {
                    const currentArray = approverType === 'review' ? documentWorkflowApprovers.reviewers : documentWorkflowApprovers.approvers;
                    const alreadyAdded = currentArray.some(a => String(a.userId || a.id) === String(u.id || u.userId));
                    if (alreadyAdded) return false;
                    if (approverType === 'review') {
                      return u.status !== 'inactive';
                    } else {
                      const isApprover = u.template_approver === 'yes' || u.role === 'admin' || u.role === 'approver' || u.role === 'superadmin';
                      const hasDesignated = users.some(user => user.template_approver === 'yes' || user.role === 'approver');
                      return hasDesignated ? isApprover : u.status !== 'inactive';
                    }
                  })
                  .map(u => (
                    <Option
                      key={u.id || u.userId}
                      value={u.id || u.userId}
                      label={u.email}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.email}</div>
                        <div style={{ fontSize: 'smaller', color: '#666' }}>
                          {u.first_name || u.firstName || ''} {u.last_name || u.lastName || ''}
                          {u.role ? ` (${u.role})` : ''}
                        </div>
                        {u.department && (
                          <div style={{ fontSize: 'smaller', color: '#888' }}>
                            Department: {u.department}
                          </div>
                        )}
                      </div>
                    </Option>
                  ))
                }
              </Select>
            </Card>
          </Col>

          <Col span={24}>
            <Card title={`Selected Document ${approverType === 'review' ? 'Reviewers' : 'Approvers'}`} size="small">
              {(() => {
                const currentArray = approverType === 'review' ? documentWorkflowApprovers.reviewers : documentWorkflowApprovers.approvers;
                return currentArray.length > 0 ? (
                  <Table
                    dataSource={currentArray}
                    rowKey="userId"
                    pagination={false}
                    columns={[
                      {
                        title: 'Name',
                        dataIndex: 'name',
                        key: 'name',
                      },
                      {
                        title: 'Email',
                        dataIndex: 'email',
                        key: 'email',
                      },
                      {
                        title: 'Role',
                        dataIndex: 'role',
                        key: 'role',
                        render: (role) => (
                          <Tag color={role === DOC_REVIEWER_ROLE ? 'blue' : 'green'}>
                            {role === DOC_REVIEWER_ROLE ? 'Reviewer' : 'Approver'}
                          </Tag>
                        )
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        render: (_, record) => (
                          <Button
                            type="link"
                            danger
                            onClick={() => handleRemoveDocumentApprover(record.userId)}
                          >
                            Remove
                          </Button>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Empty description={`No document ${approverType === 'review' ? 'reviewers' : 'approvers'} selected`} />
                );
              })()}
            </Card>
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default ReviseDocument;