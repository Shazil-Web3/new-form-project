import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../utils/authService';
import { getAttachments } from '../../../api/attachments';
import {
  getDocument,
  updateDocument,
  reviewDocument,
  approveDocument,
  rejectDocument,
  updateDocumentStatus
} from '../../../api/documents';
import {
  getTemplate,
  updateTemplate,
  getTemplateHistory,
  listCategories,
  listTemplates,
  reviewTemplate,
  approveTemplate,
  rejectTemplate,
  updateTemplateStatus
} from '../../../api/templates';
import { listOrgMembers, listDepartments, listSites } from '../../../api/users';
import { successAlert, errorAlert } from '../../../utils/alerts';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import UnifiedApproversModal from '../../../components/new/tailwind/UnifiedApproversModal';
import RevisionTimelineDrawer from '../../../components/new/tailwind/RevisionTimelineDrawer';

// Tab sub-components
import BasicInfoTab from './components/BasicInfoTab';
import TasksTab from './components/TasksTab';
import ParticipantsStep from './components/ParticipantsStep';
import ImpactTab from './components/ImpactTab';
import DocumentImpactTab from './components/DocumentImpactTab';
import StructureTab from './components/StructureTab';
import Editor from '../../../components/Editor/Editor';
import TemplateApproversTab from './components/TemplateApproversTab';
import RejectionModal from '../../../components/Unified/UnifiedTextEditor/Preview/components/RejectionModal';

// Legacy sub-components
import AttachmentsTab from '../../../components/Unified/UnifiedTextEditor/Preview/components/AttachmentsTab';
import ReferencesTab from '../../../components/Unified/UnifiedTextEditor/Preview/components/ReferencesTab';
import TemplateRevisionHistoryTab from '../../../components/Unified/UnifiedTextEditor/Preview/components/TemplateRevisionHistoryTab';
import TemplateNotesTab from '../../../components/Unified/UnifiedTextEditor/Preview/components/TemplateNotesTab';

const UnifiedTextEditorPlaceholder = () => (
  <div className="p-8 text-center text-on-surface-variant font-medium bg-surface-container rounded-xl border border-dashed border-outline-variant">
    <span className="material-symbols-outlined text-[36px] text-blue-600 mb-2 block">edit_note</span>
    <h3 className="text-lg font-bold text-on-surface mb-1">Unified Text Editor Workspace</h3>
    <p className="text-sm text-slate-500">Real DOM Unified Text Editor will be wired here in Part 2.</p>
  </div>
);


/**
 * ReviseFileHub - Redesigned Revision/Editor Workspace Page
 */
export default function ReviseFileHub({ isDocument = true }) {
  const { user } = useAuth();
  const { docId, tempId } = useParams();
  const id = isDocument ? docId : tempId;
  const navigate = useNavigate();

  // Navigation & Dropdown States
  const [activeTab, setActiveTab] = useState('basicInfo');
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // File Record States
  const [item, setItem] = useState(null);
  const [formValues, setFormValues] = useState({ title: '', name: '', template_id: '', category_id: '', department_id: '', due_date: '', site_id: '' });
  const [tasks, setTasks] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [editorContent, setEditorContent] = useState('');
  const [lockedElements, setLockedElements] = useState({ content: false, toc: false, fontSize: false, fontStyle: false, headerFooter: false });
  const [tempAttachments, setTempAttachments] = useState([]);
  const [tempReferences, setTempReferences] = useState([]);
  const [tempManualReferences, setTempManualReferences] = useState([]);
  const [impactData, setImpactData] = useState({ departmentImpacts: [], affectedSystems: '', implementationEffort: 'medium', trainingRequired: false, impactNotes: '' });
  const [deptApprovers, setDeptApprovers] = useState([]);
  const [approverKey, setApproverKey] = useState(1);
  const [includeTableOfContents, setIncludeTableOfContents] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(false);

  const handleAddDeptApprover = () => {
    setDeptApprovers((prev) => [...prev, { key: approverKey, department: '', mandatory: false, stage: 1 }]);
    setApproverKey((k) => k + 1);
  };

  const handleRemoveDeptApprover = (key) => {
    setDeptApprovers((prev) => prev.filter((a) => a.key !== key));
  };

  const handleDeptApproverChange = (key, field, value) => {
    setDeptApprovers((prev) =>
      prev.map((app) => (app.key === key ? { ...app, [field]: value } : app))
    );
  };

  const handleDeptApproverDeptChange = (key, dept) => {
    setDeptApprovers((prev) =>
      prev.map((app) => (app.key === key ? { ...app, department: dept } : app))
    );
  };

  // Workflow Approvals States
  const [approvalsModalVisible, setApprovalsModalVisible] = useState(false);
  const [approverType, setApproverType] = useState('review');
  const [sharedDueDate, setSharedDueDate] = useState('');
  const [workflowApprovers, setWorkflowApprovers] = useState({ reviewers: [], approvers: [] });
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');

  // Lists configurations
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/workspace');
    }
  };

  // Computed Roles & Permissions check
  const isDraft = String(item?.status ?? '').toLowerCase() === 'draft';
  const isAuthor = item ? (Number(item.created_by) === Number(user?.id) || user?.role === 'admin') : false;
  const readOnly = !isDraft || !isAuthor;

  const isReviewerOrApprover = (() => {
    if (!item || !user?.id) return false;
    
    // Admins can always review/approve
    if (user.role === 'admin') return true;
    
    const raw = isDocument ? item.approvers : item.template_approvers;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
      const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : [];
      const status = item.status?.toLowerCase();
      if (status === 'pending_review' || status === 'reviewed') {
        return reviewers.some(r => Number(r.userId || r.id) === Number(user.id) || r.email === user.email);
      } else if (status === 'pending_approval' || status === 'approved') {
        return approvers.some(a => Number(a.userId || a.id) === Number(user.id) || a.email === user.email);
      }
    } catch (_) { }
    return false;
  })();

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch file & setup config parameters on mount
  useEffect(() => {
    async function loadConfig() {
      const orgId = user?.organization_id || user?.orgId || user?.org_id;
      const userId = user?.id || user?.userId;
      if (!user || !id || !orgId || !userId) return;
      try {
        setLoading(true);
        const [tplList, catList, deptList, siteList, userList, fileData, attachmentsList] = await Promise.all([
          listTemplates(userId),
          listCategories(orgId),
          listDepartments(orgId),
          listSites(orgId),
          listOrgMembers(userId),
          isDocument ? getDocument(id) : getTemplate(id),
          getAttachments(isDocument ? 'document' : 'template', id).catch(() => []),
        ]);

        setTemplates(tplList || []);
        setCategories(catList || []);
        setDepartments(deptList || []);
        setSites(siteList || []);
        setOrgMembers(userList || []);
        setTempAttachments(attachmentsList || []);

        if (fileData) {
          setItem(fileData);
          setFormValues({
            title: fileData.title || '',
            name: fileData.name || '',
            template_id: fileData.template_id || '',
            category_id: fileData.category_id || '',
            department_id: fileData.department_id || '',
            due_date: fileData.due_date ? fileData.due_date.substring(0, 10) : '',
            site_id: fileData.site_id || '',
            notes: fileData.notes || '',
            description: fileData.description || '',
          });

          if (fileData.comments) {
            try {
              // fileData.comments may already be parsed by flattenTemplateMetadata (object) or still a string
              const parsedComments = typeof fileData.comments === 'string' ? JSON.parse(fileData.comments) : fileData.comments;
              if (parsedComments) {
                if (Array.isArray(parsedComments.references)) {
                  setTempReferences(parsedComments.references);
                }
                if (Array.isArray(parsedComments.manualReferences)) {
                  setTempManualReferences(parsedComments.manualReferences);
                }
              }
            } catch (_) { }
          }

          let htmlContent = '';
          if (fileData.content) {
            try {
              // content may already be parsed into an object by flattenTemplateMetadata
              const parsed = typeof fileData.content === 'string' ? JSON.parse(fileData.content) : fileData.content;
              if (parsed && typeof parsed === 'object' && parsed.html !== undefined) {
                htmlContent = parsed.html;
              } else if (parsed && typeof parsed === 'object' && parsed.content !== undefined) {
                htmlContent = parsed.content;
              } else {
                htmlContent = typeof fileData.content === 'string' ? fileData.content : '';
              }
            } catch (_) {
              htmlContent = typeof fileData.content === 'string' ? fileData.content : '';
            }
          }
          setEditorContent(htmlContent);

          let initialParticipants = [];
          if (isDocument) {
            setTasks(fileData.tasks || []);
            initialParticipants = (fileData.participants || []).map(p => ({
              id: p.userId || p.user_id || p.id,
              name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || 'Unknown',
              email: p.email,
              role: p.role === 'reviewer' ? 'document_reviewer' : p.role === 'approver' ? 'document_approver' : p.role
            }));
            if (fileData.impact) {
              try {
                const parsedImpact = typeof fileData.impact === 'string' ? JSON.parse(fileData.impact) : fileData.impact;
                setImpactData(parsedImpact || {});
              } catch (_) { }
            }
            const reviewerParticipants = initialParticipants.filter(p => p.role === 'document_reviewer');
            const approverParticipants = initialParticipants.filter(p => p.role === 'document_approver');

            // The `approvers` column is just cached workflow metadata (per-person status,
            // shared due date) used to drive the Approvals modal — it must never be treated
            // as the source of truth for *who* is assigned. That's `fileData.participants`
            // (documentpermissions), already loaded above. Merge in status/dueDate only.
            let statusById = {};
            let dueDateFromBlob = '';
            const raw = fileData.approvers;
            if (raw) {
              try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (parsed && !Array.isArray(parsed)) {
                  dueDateFromBlob = parsed.dueDate || '';
                  [...(Array.isArray(parsed.reviewers) ? parsed.reviewers : []),
                   ...(Array.isArray(parsed.approvers) ? parsed.approvers : [])].forEach(p => {
                    const key = String(p.userId || p.id);
                    if (key) statusById[key] = p.status;
                  });
                }
              } catch (_) { }
            }
            if (dueDateFromBlob) setSharedDueDate(dueDateFromBlob);

            setWorkflowApprovers({
              reviewers: reviewerParticipants.map(p => ({
                id: p.id,
                userId: p.id,
                name: p.name,
                email: p.email,
                status: statusById[String(p.id)] || 'Pending'
              })),
              approvers: approverParticipants.map(p => ({
                id: p.id,
                userId: p.id,
                name: p.name,
                email: p.email,
                status: statusById[String(p.id)] || 'Pending'
              }))
            });
          } else {
            // Template structural settings (locked_elements, TOC, attachments) live inside
            // the `template_structure` JSON column. flattenTemplateMetadata may have pre-parsed it.
            if (fileData.template_structure) {
              const structure = typeof fileData.template_structure === 'object'
                ? fileData.template_structure
                : (() => { try { return JSON.parse(fileData.template_structure); } catch (_) { return {}; } })();
              if (structure) {
                setLockedElements({
                  content: !!structure.locked_elements?.content,
                  toc: !!structure.locked_elements?.toc,
                  fontSize: !!structure.locked_elements?.fontSize,
                  fontStyle: !!structure.locked_elements?.fontStyle,
                  headerFooter: !!structure.locked_elements?.headerFooter,
                });
                setIncludeTableOfContents(!!structure.includeTableOfContents);
                setAllowAttachments(!!structure.allowAttachments);
              }
            }

            // required_approvers may be pre-parsed by flattenTemplateMetadata
            let parsedRequiredApprovers = [];
            if (fileData.required_approvers) {
              parsedRequiredApprovers = Array.isArray(fileData.required_approvers)
                ? fileData.required_approvers
                : (() => { try { return JSON.parse(fileData.required_approvers); } catch (_) { return []; } })();
              if (!Array.isArray(parsedRequiredApprovers)) parsedRequiredApprovers = [];
            }
            // Assign local React keys (not persisted) so TemplateApproversTab can track rows.
            const hydratedApprovers = parsedRequiredApprovers.map((a, idx) => ({
              key: idx + 1,
              department: a.department || '',
              mandatory: !!a.mandatory,
              stage: a.stage || 1,
            }));
            setDeptApprovers(hydratedApprovers);
            setApproverKey(hydratedApprovers.length + 1);

            // template_approvers may be pre-parsed by flattenTemplateMetadata
            const rawApprovers = fileData.template_approvers;
            if (rawApprovers) {
              const parsed = typeof rawApprovers === 'object' ? rawApprovers
                : (() => { try { return JSON.parse(rawApprovers); } catch (_) { return {}; } })();

              const authors = Array.isArray(parsed.authors) ? parsed.authors : [];
              const reviewers = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];
              const approvers = Array.isArray(parsed.approvers) ? parsed.approvers : [];

              setWorkflowApprovers({ reviewers, approvers });

              const authorParts = authors.map(a => ({
                id: a.userId || a.id,
                name: a.name,
                email: a.email,
                role: 'author'
              }));
              const revParts = reviewers.map(r => ({
                id: r.userId || r.id,
                name: r.name,
                email: r.email,
                role: 'document_reviewer'
              }));
              const appParts = approvers.map(a => ({
                id: a.userId || a.id,
                name: a.name,
                email: a.email,
                role: 'document_approver'
              }));

              initialParticipants = [...authorParts, ...revParts, ...appParts];
            }

            // If no authors in template_approvers, fall back to the template creator
            const hasAuthor = initialParticipants.some(p => p.role === 'author');
            if (!hasAuthor && fileData.created_by) {
              const creatorMember = (userList || []).find(m => String(m.id || m.userId) === String(fileData.created_by));
              initialParticipants = [{
                id: fileData.created_by,
                name: fileData.created_by_name || (creatorMember?.name) || 'Creator',
                email: creatorMember?.email || '',
                role: 'author'
              }, ...initialParticipants];
            }

            try {
              const hist = await getTemplateHistory(id);
              setHistory(hist || []);
            } catch (_) { }
          }
          setParticipants(initialParticipants);
        }
      } catch (err) {
        errorAlert('Failed to load edit details.');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [id, isDocument, user]);

  const handleFormChange = (key, val) => {
    if (readOnly) return;
    setFormValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleLockToggle = (key) => {
    if (readOnly) return;
    setLockedElements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddApprover = (type, memberId) => {
    if (readOnly) return;
    const member = orgMembers.find(m => String(m.id || m.userId) === String(memberId));
    if (!member) return;
    setWorkflowApprovers((prev) => {
      const key = type === 'review' ? 'reviewers' : 'approvers';
      if (prev[key].some((m) => String(m.userId) === String(memberId))) return prev;
      const fullName = member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username || 'Unknown';
      return {
        ...prev,
        [key]: [
          ...prev[key],
          {
            id: member.id || member.userId,
            userId: member.id || member.userId,
            name: fullName,
            email: member.email,
            department: member.department || 'All',
            status: 'Pending',
            received_at: new Date().toISOString(),
          }
        ]
      };
    });
    const newRole = type === 'review' ? 'document_reviewer' : 'document_approver';
    const fullName = member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username || 'Unknown';
    setParticipants((prev) => {
      if (prev.some(p => String(p.id || p.userId || p.user_id) === String(memberId) && p.role === newRole)) return prev;
      return [...prev, {
        id: member.id || member.userId,
        name: fullName,
        email: member.email,
        role: newRole
      }];
    });
  };

  const handleRemoveApprover = (type, memberId) => {
    if (readOnly) return;
    setWorkflowApprovers((prev) => {
      const key = type === 'review' ? 'reviewers' : 'approvers';
      return {
        ...prev,
        [key]: prev[key].filter((m) => String(m.userId) !== String(memberId) && String(m.id) !== String(memberId)),
      };
    });
    const oldRole = type === 'review' ? 'document_reviewer' : 'document_approver';
    setParticipants((prev) => prev.filter(p => !(String(p.id || p.userId || p.user_id) === String(memberId) && p.role === oldRole)));
  };

  const handleAddParticipant = (newP) => {
    if (readOnly) return;
    setParticipants((prev) => {
      if (prev.some(p => String(p.id) === String(newP.id) && p.role === newP.role)) return prev;
      return [...prev, newP];
    });
    if (newP.role === 'document_reviewer' || newP.role === 'document_approver') {
      const typeKey = newP.role === 'document_reviewer' ? 'reviewers' : 'approvers';
      setWorkflowApprovers((prev) => {
        if (prev[typeKey].some(u => String(u.id || u.userId) === String(newP.id))) return prev;
        return {
          ...prev,
          [typeKey]: [
            ...prev[typeKey],
            {
              id: newP.id,
              userId: newP.id,
              name: newP.name,
              email: newP.email,
              status: 'Pending',
            }
          ]
        };
      });
    }
  };

  const handleRemoveParticipant = (partId, role) => {
    if (readOnly) return;
    setParticipants((prev) => prev.filter(p => !(String(p.id) === String(partId) && p.role === role)));
    if (role === 'document_reviewer' || role === 'document_approver') {
      const typeKey = role === 'document_reviewer' ? 'reviewers' : 'approvers';
      setWorkflowApprovers((prev) => ({
        ...prev,
        [typeKey]: prev[typeKey].filter((u) => String(u.id || u.userId) !== String(partId)),
      }));
    }
  };

  const handleSave = async (finalStatus = null) => {
    if (readOnly && !finalStatus) return;
    try {
      const statusToSave = finalStatus || item.status || 'draft';
      const payload = isDocument ? {
        title: formValues.title,
        description: formValues.description,
        template_id: formValues.template_id || null,
        department_id: parseInt(formValues.department_id, 10),
        due_date: formValues.due_date,
        site_id: formValues.site_id ? parseInt(formValues.site_id, 10) : null,
        content: { html: editorContent },
        status: statusToSave,
        notes: formValues.notes,
        tasks: tasks.map(t => ({
          title: t.title,
          description: t.description,
          assigned_to: Number(t.assigned_to || t.assignedTo),
          due_date: t.due_date || t.dueDate
        })),
        participants: participants.map(p => ({
          user_id: Number(p.id || p.userId || p.user_id),
          role: p.role
        })),
        impact: impactData,
        references: [...tempReferences, ...tempManualReferences],
        approvers: {
          reviewers: workflowApprovers.reviewers.map(r => ({
            userId: Number(r.id || r.userId),
            name: r.name || r.username,
            email: r.email,
            status: r.status || 'Pending',
            received_at: r.received_at || r.assigned_at || new Date().toISOString()
          })),
          approvers: workflowApprovers.approvers.map(a => ({
            userId: Number(a.id || a.userId),
            name: a.name || a.username,
            email: a.email,
            status: a.status || 'Pending',
            received_at: a.received_at || a.assigned_at || new Date().toISOString()
          }))
        }
      } : {
        name: formValues.name,
        description: formValues.description,
        category_id: parseInt(formValues.category_id, 10),
        department_id: parseInt(formValues.department_id, 10),
        content: { html: editorContent },
        status: statusToSave,
        locked_elements: lockedElements,
        includeTableOfContents: includeTableOfContents,
        allowAttachments: allowAttachments,
        references: [...tempReferences, ...tempManualReferences].filter(
          r => (r.refContent || r.refText || '').trim() !== '' || r.refAnchor
        ),
        due_date: formValues.due_date,
        notes: formValues.notes,
        tempAttachments: tempAttachments,
        approvers: deptApprovers.map(a => ({
          department: a.department,
          mandatory: a.mandatory,
          stage: a.stage,
        })),
        template_approvers: {
          authors: participants.filter(p => p.role === 'author').map(p => ({
            userId: Number(p.id || p.userId),
            name: p.name || p.username,
            email: p.email,
          })),
          reviewers: [
            ...participants.filter(p => p.role === 'document_reviewer' || p.role === 'reviewer').map(p => ({
              userId: Number(p.id || p.userId),
              name: p.name || p.username,
              email: p.email,
              status: 'Pending',
              received_at: p.received_at || new Date().toISOString()
            })),
            ...(workflowApprovers.reviewers || []).filter(
              r => !participants.some(p => String(p.id) === String(r.id || r.userId) && (p.role === 'document_reviewer' || p.role === 'reviewer'))
            ).map(r => ({
              userId: Number(r.id || r.userId),
              name: r.name || r.username,
              email: r.email,
              status: (finalStatus === 'draft' || finalStatus === 'pending_revision' || finalStatus === 'pending_review') ? 'Pending' : (r.status || 'Pending'),
              received_at: r.received_at || new Date().toISOString()
            }))
          ],
          approvers: [
            ...participants.filter(p => p.role === 'document_approver' || p.role === 'approver').map(p => ({
              userId: Number(p.id || p.userId),
              name: p.name || p.username,
              email: p.email,
              status: 'Pending',
              received_at: p.received_at || new Date().toISOString()
            })),
            ...(workflowApprovers.approvers || []).filter(
              a => !participants.some(p => String(p.id) === String(a.id || a.userId) && (p.role === 'document_approver' || p.role === 'approver'))
            ).map(a => ({
              userId: Number(a.id || a.userId),
              name: a.name || a.username,
              email: a.email,
              status: (finalStatus === 'draft' || finalStatus === 'pending_revision' || finalStatus === 'pending_review' || finalStatus === 'pending_approval') ? 'Pending' : (a.status || 'Pending'),
              received_at: a.received_at || new Date().toISOString()
            }))
          ]
        }
      };

      if (isDocument) {
        await updateDocument(id, payload);
      } else {
        await updateTemplate(id, payload);
      }
      successAlert('File updated successfully!');
      goBack();
    } catch (err) {
      errorAlert('Failed to save file changes.');
    }
  };

  const handleSignAction = async () => {
    try {
      const isReview = item.status?.toLowerCase() === 'pending_review';
      const payload = {
        userId: user?.id,
        userEmail: user?.email,
        userName: `${user?.first_name || user?.firstName} ${user?.last_name || user?.lastName}`,
        userRole: user?.role,
        action: isReview ? 'review' : 'approve'
      };
      if (isDocument) {
        if (isReview) await reviewDocument(id, payload);
        else await approveDocument(id, payload);
      } else {
        if (isReview) await reviewTemplate(id, payload);
        else await approveTemplate(id, payload);
      }
      successAlert('Signature processed successfully!');
      goBack();
    } catch (_) {
      errorAlert('Failed to approve signature.');
    }
  };

  const handleRejectAction = async (comment) => {
    try {
      const payload = {
        userId: user?.id,
        userEmail: user?.email,
        userName: `${user?.first_name || user?.firstName} ${user?.last_name || user?.lastName}`,
        userRole: user?.role,
        action: 'reject',
        comment
      };
      if (isDocument) {
        await rejectDocument(id, payload);
      } else {
        await rejectTemplate(id, payload);
      }
      setShowRejectionModal(false);
      setRejectionComment('');
      successAlert('File rejected back to draft.');
      goBack();
    } catch (_) {
      errorAlert('Failed to reject file.');
    }
  };

  const handlePublishAction = async () => {
    try {
      if (isDocument) {
        await updateDocumentStatus(id, 'published');
      } else {
        await updateTemplateStatus(id, 'published');
      }
      successAlert('Published successfully!');
      goBack();
    } catch (_) {
      errorAlert('Failed to publish file.');
    }
  };

  const handleRevertAction = async () => {
    try {
      if (isDocument) {
        await updateDocumentStatus(id, 'draft');
      } else {
        await updateTemplateStatus(id, 'draft');
      }
      successAlert('Reverted to Draft successfully.');
      goBack();
    } catch (_) {
      errorAlert('Failed to revert status.');
    }
  };


  // Client Demanded Tabs Definition
  const tabs = isDocument ? [
    { id: 'basicInfo', label: 'Basic Info', icon: 'description' },
    { id: 'tasks', label: 'Tasks', icon: 'task' },
    { id: 'participants', label: 'Participants', icon: 'group' },
    { id: 'content', label: 'Content', icon: 'edit' },
    { id: 'notes', label: 'Notes', icon: 'notes' },
    { id: 'revisionHistory', label: 'Template History', icon: 'history' },
    { id: 'attachments', label: 'Attachments', icon: 'attachment' },
    { id: 'references', label: 'References', icon: 'menu_book' },
    { id: 'impact', label: 'Impact Scope', icon: 'analytics' },
    { id: 'activity', label: 'Activity', icon: 'schedule' },
    { id: 'feedback', label: 'Feedback', icon: 'rate_review' }
  ] : [
    { id: 'basicInfo', label: 'Basic Info', icon: 'description' },
    { id: 'approvers', label: 'Approval Matrix', icon: 'schema' },
    { id: 'participants', label: 'Participants', icon: 'group' },
    { id: 'structure', label: 'Structure & Locks', icon: 'lock' },
    { id: 'content', label: 'Outline Content', icon: 'edit' },
    { id: 'attachments', label: 'Attachments', icon: 'attachment' },
    { id: 'references', label: 'References', icon: 'menu_book' },
    { id: 'notes', label: 'Notes', icon: 'notes' },
    { id: 'activity', label: 'Activity', icon: 'schedule' },
    { id: 'feedback', label: 'Feedback', icon: 'rate_review' }
  ];

  // Check if dropdown trigger actions exist
  const hasWorkflowActions = (isDraft && isAuthor) ||
    (item?.status === 'approved' && isAuthor) ||
    (isReviewerOrApprover && !isDraft && item?.status !== 'approved' && item?.status !== 'published');



  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
          <span className="material-symbols-outlined text-4xl text-blue-700 animate-spin">sync</span>
          <span className="text-body-md text-on-surface-variant font-medium">Loading workspace...</span>
        </div>
      </MainLayout>
    );
  }




  return (
    <MainLayout fullWidth={true}>
      <div className="w-full flex flex-col font-sans select-none pb-12 mt-4 animate-fade-in">

        {/* Editor Toolbar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (readOnly) navigate(-1);
                else setShowBackConfirm(true);
              }}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors shadow-sm"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-title-lg font-bold text-on-surface flex items-center gap-2">
                <span>{isDocument ? 'Document' : 'Template'}: {item?.name || item?.title}</span>
                <span className="text-xs font-mono font-bold text-on-surface-variant/60 bg-surface-container border border-outline-variant/40 px-2 py-0.5 rounded">
                  v{item?.version || '1.0'}
                </span>
              </h2>
              <p className="text-body-xs text-on-surface-variant font-medium capitalize">
                Status: {String(item?.status || 'draft').replace(/_/g, ' ')} {readOnly && '• [👁️ Read Only]'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative" ref={dropdownRef}>
            {/* Version history drawer button */}
            {!isDocument && history.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-semibold h-10 px-4 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Version History</span>
              </button>
            )}

            {/* Dropdown action trigger */}
            {hasWorkflowActions ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold h-10 px-4 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm text-xs"
                >
                  <span>Update {isDocument ? 'Document' : 'Template'}</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest border border-outline-variant/65 rounded-xl shadow-lg z-50 py-1.5 animate-scale-up">
                    {isDraft && isAuthor && (
                      <>
                        <button
                          onClick={() => { setDropdownOpen(false); handleSave(null); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-blue-700">save</span>
                          <span>Save Changes</span>
                        </button>
                        <button
                          onClick={() => { setDropdownOpen(false); setApproverType('review'); setApprovalsModalVisible(true); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-orange-600">send</span>
                          <span>Submit for Review</span>
                        </button>
                        <button
                          onClick={() => { setDropdownOpen(false); setApproverType('approval'); setApprovalsModalVisible(true); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-purple-700">assignment_turned_in</span>
                          <span>Submit for Approval</span>
                        </button>
                      </>
                    )}

                    {item?.status === 'approved' && isAuthor && (
                      <>
                        <button
                          onClick={() => { setDropdownOpen(false); handlePublishAction(); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                          <span>Publish Version</span>
                        </button>
                        <button
                          onClick={() => { setDropdownOpen(false); handleRevertAction(); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-600">undo</span>
                          <span>Revert to Draft</span>
                        </button>
                      </>
                    )}

                    {isReviewerOrApprover && !isDraft && item?.status !== 'approved' && item?.status !== 'published' && (
                      <>
                        <button
                          onClick={() => { setDropdownOpen(false); handleSignAction(); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">draw</span>
                          <span>Approve & Sign</span>
                        </button>
                        <button
                          onClick={() => { setDropdownOpen(false); setRejectionComment(''); setShowRejectionModal(true); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low text-xs font-semibold text-on-surface flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-600">cancel</span>
                          <span>Decline / Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant bg-surface-container-low text-on-surface-variant/70 text-xs font-bold rounded-xl shadow-inner">
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                <span>Read Only Mode</span>
              </span>
            )}
          </div>
        </div>

        {/* Tab Headers */}
        <div className="border-b border-outline-variant pb-2 mb-6">
          <div className="flex gap-6 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 pb-2 transition-all relative whitespace-nowrap text-xs font-semibold ${activeTab === tab.id
                  ? 'text-primary font-bold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body Render Panel */}
        <div className={activeTab === 'content' ? 'w-full min-h-[450px]' : 'bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm min-h-[450px]'}>

          {/* 1. Basic Info Tab */}
          {activeTab === 'basicInfo' && (
            <BasicInfoTab
              isDocument={isDocument}
              values={formValues}
              onChange={handleFormChange}
              templates={templates}
              categories={categories}
              departments={departments}
              sites={sites}
              disabled={readOnly}
              fileId={id}
            />
          )}

          {/* 2. Tasks Tab (Documents only) */}
          {activeTab === 'tasks' && isDocument && (
            <div className="animate-fade-in">
              <TasksTab
                tasks={tasks}
                onTasksChange={setTasks}
                orgMembers={orgMembers}
                disabled={readOnly}
              />
            </div>
          )}

          {/* 3. Approval Matrix Tab (Templates only) */}
          {activeTab === 'approvers' && !isDocument && (
            <div className="animate-fade-in">
              <TemplateApproversTab
                approvers={deptApprovers}
                departments={departments}
                onAddApprover={handleAddDeptApprover}
                onRemoveApprover={handleRemoveDeptApprover}
                onApproverChange={handleDeptApproverChange}
                onApproverDepartmentChange={handleDeptApproverDeptChange}
                disabled={readOnly}
              />
            </div>
          )}

          {/* 4. Participants Tab */}
          {activeTab === 'participants' && (
            <div className="animate-fade-in">
              <ParticipantsStep
                participants={participants}
                onAddParticipant={(newP) => setParticipants(prev => [...prev, newP])}
                onRemoveParticipant={(userId, role) => setParticipants(prev => prev.filter(p => !(p.id === userId && p.role === role)))}
                orgMembers={orgMembers}
                disabled={readOnly}
              />
            </div>
          )}

          {/* 5. Structure & Locks Tab (Templates only) */}
          {activeTab === 'structure' && !isDocument && (
            <StructureTab
              lockedElements={lockedElements}
              onLockToggle={handleLockToggle}
              includeTableOfContents={includeTableOfContents}
              onIncludeTocChange={setIncludeTableOfContents}
              allowAttachments={allowAttachments}
              onAllowAttachmentsChange={setAllowAttachments}
              disabled={readOnly}
            />
          )}

          {/* 6. Content Tab */}
          {activeTab === 'content' && (
            <div className="w-full animate-fade-in">
              <Editor />
            </div>
          )}

          {/* 7. Template History Tab (Documents only) */}
          {activeTab === 'revisionHistory' && isDocument && (
            formValues.template_id ? (
              <div className="space-y-4 animate-fade-in">
                <span className="text-xs font-bold text-on-surface uppercase tracking-wide block">Template Revision History</span>
                <TemplateRevisionHistoryTab
                  templateId={formValues.template_id}
                  currentVersion={templates.find(t => String(t.id) === String(formValues.template_id))?.version}
                />
              </div>
            ) : (
              <div className="py-20 text-center text-on-surface-variant/50 italic text-body-sm">
                No base template layout is selected for this document.
              </div>
            )
          )}

          {/* 8. Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <AttachmentsTab
                associationType={isDocument ? "document" : "template"}
                associationId={id}
                canEdit={!readOnly}
                initialAttachments={tempAttachments}
                onAttachmentsChange={setTempAttachments}
              />
            </div>
          )}

          {/* 9. References Tab */}
          {activeTab === 'references' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <ReferencesTab
                references={tempReferences}
                manualReferences={tempManualReferences}
                onReferencesChange={setTempReferences}
                onManualReferencesChange={setTempManualReferences}
                canEdit={!readOnly}
              />
            </div>
          )}

          {/* 10. Notes Tab (Collaborative for both Templates & Documents across all lifecycle stages) */}
          {activeTab === 'notes' && (
            <div className="animate-fade-in">
              <TemplateNotesTab 
                parsedTemplate={{ 
                  id: id, 
                  template_id: !isDocument ? id : undefined,
                  document_id: isDocument ? id : undefined,
                  notes: formValues.notes || item?.notes 
                }} 
                associationType={isDocument ? "document" : "template"} 
                currentUser={user} 
                onNotesChange={(newNotes) => {
                  handleFormChange('notes', newNotes);
                }}
              />
            </div>
          )}

          {/* 11. Impact Tab (Documents only) */}
          {activeTab === 'impact' && isDocument && (
            <div className="animate-fade-in">
              <DocumentImpactTab
                impactData={impactData}
                setImpactData={setImpactData}
                departments={departments}
                readOnly={readOnly}
                documentId={id}
                currentUser={user}
              />
            </div>
          )}

          {/* 12. Activity Tab */}
          {activeTab === 'activity' && (
            isDocument ? (
              <div className="max-w-xl mx-auto space-y-4 py-8 animate-fade-in text-center select-none">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">timeline</span>
                <h4 className="text-sm font-bold text-on-surface">Document Audit Logs</h4>
                <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                  History logs are tracked upon publication or rejection of version releases.
                </p>
                <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-4 text-left text-xs font-semibold mt-4 text-on-surface-variant/70 leading-loose">
                  • Version 1.0 drafted and submitted by creator on {new Date(item?.created_at).toLocaleDateString()}<br />
                  {item?.status !== 'draft' && `• Workflow routing state updated to ${item?.status}`}
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <span className="text-xs font-bold text-on-surface uppercase tracking-wide block">Template Revision History</span>
                <TemplateRevisionHistoryTab
                  templateId={id}
                  currentVersion={item?.version}
                />
              </div>
            )
          )}

          {/* 13. Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="animate-fade-in">
              <NotesTab item={item} isDocument={isDocument} />
            </div>
          )}

          {/* Bottom tab navigation prev/next stepper */}
          {(() => {
            const currentIndex = tabs.findIndex(t => t.id === activeTab);
            return (
              <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-outline-variant/60">
                {currentIndex > 0 && (
                  <button
                    onClick={() => setActiveTab(tabs[currentIndex - 1].id)}
                    className="flex items-center gap-1.5 border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-semibold h-9 px-4 rounded-xl text-xs transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Previous</span>
                  </button>
                )}
                {currentIndex < tabs.length - 1 && (
                  <button
                    onClick={() => setActiveTab(tabs[currentIndex + 1].id)}
                    className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold h-9 px-4 rounded-xl text-xs transition-colors shadow-sm"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Workflow Approvers Modal */}
        <UnifiedApproversModal
          visible={approvalsModalVisible}
          onCancel={() => setApprovalsModalVisible(false)}
          approverType={approverType}
          setApproverType={setApproverType}
          sharedDueDate={sharedDueDate}
          setSharedDueDate={setSharedDueDate}
          templateApprovers={workflowApprovers}
          users={orgMembers}
          handleAddTemplateApprover={(userId) => handleAddApprover(approverType, userId)}
          handleRemoveTemplateApprover={(userId) => handleRemoveApprover(approverType, userId)}
          onSubmit={() => {
            const finalStatus = approverType === 'review' ? 'pending_review' : 'pending_approval';
            handleSave(finalStatus);
            setApprovalsModalVisible(false);
          }}
          entityLabel={isDocument ? 'Document' : 'Template'}
        />

        {/* Slide-out Version History Drawer */}
        <RevisionTimelineDrawer
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          history={history}
          currentVersion={item?.version}
          onRestoreVersion={async (v) => {
            setEditorContent(v.content || '');
            setShowHistory(false);
            successAlert(`Restored to version ${v.version_number}! Save changes.`);
          }}
        />

        <RejectionModal
          visible={showRejectionModal}
          onCancel={() => {
            setShowRejectionModal(false);
            setRejectionComment('');
          }}
          onReject={() => handleRejectAction(rejectionComment)}
          rejectionComment={rejectionComment}
          setRejectionComment={setRejectionComment}
          entityType={isDocument ? 'Document' : 'Template'}
        />

        {showBackConfirm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-[28px] text-amber-500">save_as</span>
                  <h3 className="text-title-md font-bold text-on-surface">Save changes?</h3>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed mb-4">
                  You have unsaved changes. Would you like to save your current progress before leaving?
                </p>
                {isDocument && isDraft && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-xs font-bold text-on-surface-variant/80 uppercase">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      value={formValues.due_date || ''}
                      onChange={(e) => handleFormChange('due_date', e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-md text-on-surface shadow-sm cursor-pointer"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 mt-4">
                <button
                  onClick={() => { setShowBackConfirm(false); navigate(-1); }}
                  className="border border-outline-variant bg-surface hover:bg-surface-container-high text-on-surface font-semibold h-10 px-5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Discard Changes
                </button>
                <button
                  onClick={async () => { setShowBackConfirm(false); await handleSave(null); }}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold h-10 px-5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Yes, Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}