import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import { useAuth } from '../../utils/authService';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../utils/alerts';

import {
  Layout, Avatar, Badge, Card, notification, Spin, Form,
} from 'antd';
import {
  CheckSquareOutlined, FileOutlined,
  PlusOutlined, DashboardOutlined, 
  FileTextOutlined, CalendarOutlined,
  TeamOutlined, SettingOutlined, LinkOutlined, AuditOutlined,
} from '@ant-design/icons';
import moment from 'moment';

// Import Components
import HeaderComponent from './components/Header';
import Sidebar from './components/Sidebar';

import Overview from './components/Dashboard/Overview';
import MyTasks from './components/Dashboard/MyTasks';
import RecentDocuments from './components/Dashboard/Documents/RecentDocuments';
import CreateDocument from './components/Dashboard/Documents/CreateDocument';
import MyDocumentDrafts from './components/Dashboard/Documents/MyDocumentDrafts';
import DocumentReviewMonitoring from './components/Dashboard/Documents/DocumentReviewMonitoring';
import DocumentPendingReview from './components/Dashboard/Documents/DocumentPendingReview';
import PublishedDocumentsList from './components/Dashboard/Documents/PublishedDocumentsList';
import ArchivedDocumentsList from './components/Dashboard/Documents/ArchivedDocumentsList';
import ReviseDocument from './components/Dashboard/Documents/ReviseDocument';

import CalendarTab from './components/Dashboard/CalendarTab';
import Accounts from './components/Dashboard/Accounts';
import Audit from './components/Dashboard/Audit';
import References from './components/Dashboard/References';
import Settings from './components/Dashboard/Settings';
import Templates from './components/Dashboard/Templates/Templates';
import ArchivedTemplates from './components/Dashboard/Templates/ArchivedTemplates';
import CreateTemplate from './components/Dashboard/Templates/CreateTemplate/CreateTemplateContainer';
import EditTemplate from './components/Dashboard/Templates/EditTemplate';
import ReviseTemplate from './components/Dashboard/Templates/ReviseTemplate';
import TemplatePreview from '../Unified/UnifiedTextEditor/Preview/TemplatePreview';
import DocumentPreview from '../Unified/UnifiedTextEditor/Preview/DocumentPreview';
import DocumentPreviewModal from './components/Dashboard/Documents/components/DocumentPreviewModal';
import MyDrafts from './components/Dashboard/Templates/MyDrafts';
import PendingReview from './components/Dashboard/Templates/PendingReview';
import ReviewMonitoring from './components/Dashboard/Templates/ReviewMonitoring';

import PasswordConfirmModal from './components/Modals/PasswordConfirmModal';
import JoinDocumentModal from './components/Modals/JoinDocumentModal';
import CreateTaskModal from './components/Modals/CreateTaskModal';
import apiClient from '../../api/apiClient';

const { Content } = Layout;

function parseDocumentWorkflowForCount(approvers) {
  try {
    if (!approvers) return { reviewers: [], approvers: [] };
    const a = typeof approvers === 'string' ? JSON.parse(approvers) : approvers;
    if (!a || typeof a !== 'object') return { reviewers: [], approvers: [] };
    return { reviewers: a.reviewers || [], approvers: a.approvers || [] };
  } catch {
    return { reviewers: [], approvers: [] };
  }
}

const Home = () => {
  const { user, logout } = useAuth(); // Get user and logout from auth context
  const [activeTab, setActiveTab] = useState('overview');
  const [localTime, setLocalTime] = useState('');
  const [previewDocument, setPreviewDocument] = useState(null); // Full editor view
  const [isPreviewOnly, setIsPreviewOnly] = useState(false); // Whether current full view is read-only
  const [previewModalVisible, setPreviewModalVisible] = useState(false); // Modal view
  const [documentToPreview, setDocumentToPreview] = useState(null); // Modal content
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [users, setUsers] = useState([]);
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [templateCategories, setTemplateCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [useTemplate, setUseTemplate] = useState(null);
  const [useDocument, setUseDocument] = useState(null);
  const [newTaskVisible, setNewTaskVisible] = useState(false);
  const [isJoinDocModalVisible, setIsJoinDocModalVisible] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [revisingTemplate, setRevisingTemplate] = useState(null);
  const [revisingDocument, setRevisingDocument] = useState(null);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordConfirmCallback, setPasswordConfirmCallback] = useState(null);
  const confirmationInProgress = useRef(false);
  const [taskForm] = Form.useForm();
  
  const navigate = useNavigate();

  const documentDraftCount = useMemo(() => {
    if (user?.id == null || !documents?.length) return 0;
    const uid = Number(user.id);
    return documents.filter(
      (d) =>
        String(d.status ?? '').toLowerCase() === 'draft' && Number(d.created_by) === uid
    ).length;
  }, [documents, user]);

  const documentWorkflowBadgeCount = useMemo(() => {
    if (!documents?.length) return 0;
    const phases = ['pending_review', 'pending_approval'];
    return documents.filter((d) => phases.includes(String(d.status ?? '').toLowerCase())).length;
  }, [documents]);

  const documentPendingForMeCount = useMemo(() => {
    if (user?.id == null || !documents?.length) return 0;
    const uid = Number(user.id);
    let n = 0;
    for (const d of documents) {
      const st = String(d.status ?? '').toLowerCase();
      if (!['pending_review', 'reviewed', 'pending_approval', 'approved'].includes(st)) continue;
      const { reviewers, approvers } = parseDocumentWorkflowForCount(d.approvers);
      const list = ['pending_review', 'reviewed'].includes(st) ? reviewers : approvers;
      if (list.some((p) => Number(p.userId) === uid)) n++;
    }
    return n;
  }, [documents, user]);

  const templateDraftCount = useMemo(() => {
    if (user?.id == null || !templates?.length) return 0;
    const uid = Number(user.id);
    const oid = user.orgId || user.organization_id;
    return templates.filter(
      (t) =>
        String(t.status ?? '').toLowerCase() === 'draft' &&
        Number(t.created_by) === uid &&
        (oid == null || Number(t.organization_id) === Number(oid))
    ).length;
  }, [templates, user]);

  const menuBadgeLabel = (text, count) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {text}
      {count > 0 ? <Badge count={count} size="small" overflowCount={99} /> : null}
    </span>
  );

  // Define the password confirmation handler
  const requirePasswordConfirmation = useCallback((callback) => {
    if (confirmationInProgress.current) return;
    confirmationInProgress.current = true;
    
    setPasswordConfirmCallback(() => () => {
      callback();
      confirmationInProgress.current = false;
    });
    setPasswordModalVisible(true);
  }, []);

  // Handle successful password confirmation
  const handlePasswordConfirmed = async (password) => {
    try {
      // Call the verify-password endpoint
      const response = await axios.post('/api/verify-password', {
        userId: user?.id,
        password
      });
      
      if (response.data?.verified) {
        setPasswordModalVisible(false);
        if (passwordConfirmCallback) {
          await passwordConfirmCallback();
        }
        confirmationInProgress.current = false;
      } else {
        errorAlert(response.data?.error || 'Incorrect password. Please enter your account password.');
        confirmationInProgress.current = false;
      }
    } catch (error) {
      console.error('Password verification failed:', error);
      errorAlert(error.response?.data?.error || 'Incorrect password. Please enter your account password.');
      confirmationInProgress.current = false;
    }
  };

  // Handle modal cancellation
  const handlePasswordModalCancel = () => {
    setPasswordModalVisible(false);
    confirmationInProgress.current = false;
  };

  // Dashboard menu items with dropdowns
  const menuItems = useMemo(() => [
    {
      key: 'overview',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'my-tasks',
      icon: <CheckSquareOutlined />,
      label: 'My Tasks',
    },
    {
      key: 'documents',
      icon: <FileOutlined />,
      label: 'Documents',
      children: [
        {
          key: 'create-document',
          icon: <PlusOutlined />,
          style: { border: '1px solid #d9d9d9' },
          label: 'Create Document',
          excludeMember: true,
        },
        {
          key: 'documents-drafts',
          label: menuBadgeLabel('My Drafts', documentDraftCount),
        },
        {
          key: 'documents-monitoring',
          label: menuBadgeLabel('Pending Review', documentWorkflowBadgeCount),
          adminOnly: true,
        },
        {
          key: 'document-pending-review',
          label: menuBadgeLabel('Pending Review', documentPendingForMeCount),
          tempApprover: true,
        },
        {
          key: 'documents-published',
          label: 'Published Documents',
        },
        {
          key: 'documents-archived',
          label: 'Old Documents',
          adminOnly: true,
        },
        {
          key: 'join-document',
          icon: <FileTextOutlined />,
          style: { border: '1px solid #d9d9d9' },
          label: 'Join Document',
          excludeMember: true,
        },
      ]
    },
    {
      key: 'templates',
      icon: <FileTextOutlined />,
      label: 'Templates',
      children: [
        {
          key: 'create-template',
          icon: <PlusOutlined />,
          style: { border: '1px solid #d9d9d9' },
          label: 'Create Template',
          adminOnly: true,
        },
        {
          key: 'my-drafts',
          label: menuBadgeLabel('My Drafts', templateDraftCount),
        },
        {
          key: 'template-monitoring',
          label: 'Pending Review',
          adminOnly: true,
        },
        {
          key: 'template-approval',
          label: 'Pending Review',
          tempApprover: true,
        },
        {
          key: 'templates-list',
          label: 'Published Templates',
        },
        {
          key: 'archived-templates',
          label: 'Old Templates',
          adminOnly: true,
        },
      ]
    },
    {
      key: 'calendar',
      icon: <CalendarOutlined />,
      label: 'Calendar',
    },
    {
      key: 'accounts',
      icon: <TeamOutlined />,
      label: 'Account Management',
    },
    {
      key: 'references',
      icon: <LinkOutlined />,
      label: 'References',
    },
    {
      key: 'audit',
      icon: <AuditOutlined />,
      label: 'Audit Trail',
      adminOnly: true,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ], [documentDraftCount, documentWorkflowBadgeCount, documentPendingForMeCount, templateDraftCount]);

  // Check for logged-in user on component mount
  useEffect(() => {
    console.log(user);
    if (!user) {
      // Redirect to login if no user is authenticated
      navigate('/login');
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  // Logout handler
  const handleLogout = () => {
    logout();
    notification.success({
      message: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
    navigate('/login');
  };

  // Handle menu item selection
  const handleMenuSelect = (key) => {
    if (key === 'join-document') {
      setIsJoinDocModalVisible(true);
    } else {
      setPreviewDocument(null);
      setUseTemplate(null);
      setUseDocument(null);
      setActiveTab(key);
    }
  };

// Create New Document
const handleCreateDocument = () => {
  setUseTemplate(null);
  setUseDocument(null);
  setActiveTab('create-document');
};


  const handleJoin = async (values) => {
    if (!user) {
      notification.warning({
        message: 'Authentication Required',
        description: 'Please log in to join a document.',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`/api/check-document-access/${user.id}/${values.docId}`);
      
      if (response.data.hasAccess) {
        setIsJoinDocModalVisible(false);
        navigate(`/document/${values.docId}`);
      } else {
        notification.warning({
          message: 'Access Denied',
          description: 'You do not have access to this document.',
        });
      }
    } catch (error) {
      console.error("❌ Error joining document:", error);
      notification.error({
        message: 'Failed to Join',
        description: 'Failed to join the document. Please check the document ID and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template) => {
    const templateToEdit = templates.find(t => t.id === template.id);
    setPreviewTemplate(templateToEdit);
  };

  const handleReviseTemplate = (template) => {
    const templateToRevise = templates.find(t => t.id === template.id);
    setRevisingTemplate(templateToRevise);
  };

  const handleReviseDocument = async (doc) => {
    const id = doc.document_id || doc.id;
    try {
      setLoading(true);
      const res = await apiClient.post(`/api/documents/${id}/revise`);
      await fetchUserData(false);
      if (res.data && res.data.document) {
        setRevisingDocument(res.data.document);
      } else if (res.data && res.data.documentId) {
        const newDocId = res.data.documentId;
        const newDoc = documents.find(d => String(d.document_id) === String(newDocId));
        setRevisingDocument(newDoc || { ...doc, document_id: newDocId, id: newDocId, status: 'draft', version: res.data.version || (doc.version + 1) });
      } else {
        const documentToRevise = documents.find(d => String(d.document_id) === String(id));
        setRevisingDocument(documentToRevise);
      }
    } catch (err) {
      console.error("Failed to revise document:", err);
      const documentToRevise = documents.find(d => String(d.document_id) === String(id)) || doc;
      setRevisingDocument(documentToRevise);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTemplate = (template) => {
    const templateToPreview = templates.find(t => t.id === template.id);
    setPreviewTemplate(templateToPreview);
  };

  const handlePreviewDocument = (doc) => {
    const id = doc.document_id || doc.id;
    const full = documents.find((d) => String(d.document_id) === String(id));
    setIsPreviewOnly(true);
    setPreviewDocument(full || doc);
  };

  const handleOpenDocumentPreviewModal = (doc) => {
    const id = doc.document_id || doc.id;
    const full = documents.find((d) => String(d.document_id) === String(id));
    setDocumentToPreview(full || doc);
    setPreviewModalVisible(true);
  };

  const handleEditDocument = (doc) => {
    const id = doc.document_id || doc.id;
    const full = documents.find((d) => String(d.document_id) === String(id));
    setIsPreviewOnly(false);
    setPreviewDocument(full || doc);
  };

  const handleUseTemplate = (templateId) => {
    const templateToUse = templates.find(t => t.id === templateId) || { id: templateId };
    setUseTemplate(templateToUse);
    setUseDocument(null);
    setActiveTab('create-document');
  }

  const handleUseDocument = (documentId) => {
    const documentToUse = documents.find(d => String(d.document_id) === String(documentId)) || { document_id: documentId };
    setUseDocument(documentToUse);
    setUseTemplate(null);
    setActiveTab('create-document');
  };

  const handleTaskFormSubmit = async (values) => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await axios.post('/api/create-task', {
        title: values.title,
        description: values.description || '',
        due_date: values.dueDate.format('YYYY-MM-DD'),
        priority: values.priority,
        assigned_to: values.assignedTo,
        document_id: values.docId,
        created_by: user.id,
      });

      if (response.data.success) {
        setNewTaskVisible(false);
        taskForm.resetFields();
        notification.success({
          message: 'Task Created',
          description: 'Your new task has been created successfully.',
        });
        fetchUserData(false);
      }
    } catch (error) {
      console.error("Error creating task:", error);
      notification.error({
        message: 'Failed to Create Task',
        description: 'There was an error creating your task. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle task completion
  const toggleTask = async (taskId, completed) => {
    try {
      const response = await axios.put(`/api/update-task/${taskId}`, {
        completed: !completed
      });
      
      if (response.data.success) {
        setTasks(tasks.map(task => 
          task.id === taskId ? { ...task, completed: !completed } : task
        ));
        notification.success({
          message: completed ? 'Task Reopened' : 'Task Completed',
          description: completed ? 'The task has been marked as incomplete.' : 'The task has been marked as complete.',
        });
      }
    } catch (error) {
      console.error("Error updating task:", error);
      notification.error({
        message: 'Failed to Update Task',
        description: 'There was an error updating the task status.',
      });
    }
  };

  // Time formatting
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(moment().format('HH:mm:ss A [GMT]Z'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const [docsRes, tasksRes, templatesRes, usersRes, invitedUsersRes, eventsRes, activityRes, departmentsRes, templateCategoriesRes, sitesRes] = await Promise.all([
        axios.get(`/api/my-docs/${user.id}`),
        axios.get(`/api/tasks/${user.id}`),
        axios.get(`/api/templates/${user.id}`),
        axios.get(`/api/org_members/${user.id}`),
        axios.get(`/api/invited_users/${user.id}`),
        axios.get(`/api/calendar-events/${user.id}`),
        axios.get(`/api/activity-log/${user.id}`),
        axios.get(`/api/departments/${user.orgId || user.organization_id}`),
        axios.get(`/api/template_categories/${user.orgId || user.organization_id}`),
        axios.get(`/api/sites/${user.orgId || user.organization_id}`),
        /* axios.get(`/api/notifications/${user.id}`), */
      ]);
      
      setDocuments(docsRes.data || []);
      setTasks(tasksRes.data || []);
      setTemplates(templatesRes.data || []);
      setUsers(usersRes.data || []);
      setInvitedUsers(invitedUsersRes.data || []);
      setCalendarEvents(eventsRes.data || []);
      setActivityLog(activityRes.data || []);
      setDepartments(departmentsRes.data || []);
      setTemplateCategories(templateCategoriesRes.data || []);
      setSites(sitesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      notification.error({
        message: 'Data Fetch Error',
        description: 'Failed to load your dashboard data. Please refresh the page.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

// Predefined Ant Design colors
// This includes the standard colors from Ant Design's palette
// Define Ant Design's standard colors
const antColors = [
  'red',
  'volcano',
  'orange',
  'gold',
  'yellow',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
  'magenta'
];

// Function to get a deterministic color based on string input
const getConsistentColor = (str) => {
  if (!str) return 'default';
  
  // Simple hash function to get number from string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use absolute value of hash to get index
  const index = Math.abs(hash) % antColors.length;
  return antColors[index];
};


  // Mock data for demonstration in case the API calls fail (do not inject fake documents — it masks real lists and breaks draft/status filters)
  useEffect(() => {
    if (!tasks.length) {
      setTasks([
        { id: '1', title: 'Finalize design mockups', completed: false, dueDate: '2025-04-05', priority: 'High' },
        { id: '2', title: 'Review content strategy', completed: true, dueDate: '2025-03-25', priority: 'Medium' },
        { id: '3', title: 'Prepare presentation slides', completed: false, dueDate: '2025-04-02', priority: 'High' },
      ]);
    }
    
    if (!notifications.length) {
      setNotifications([
        { id: '1', message: 'John commented on "Marketing Strategy"', time: '1 hour ago', read: false },
        { id: '2', message: 'Document "Quarterly Review" was approved', time: '3 hours ago', read: false },
        { id: '3', message: 'New task assigned: "Prepare presentation"', time: '5 hours ago', read: true },
      ]);
    }

    
    if (!calendarEvents.length) {
      setCalendarEvents([
        { id: '1', title: 'Team Meeting', start: '2025-03-31 10:00', end: '2025-03-31 11:00' },
        { id: '2', title: 'Document Review', start: '2025-04-02 14:00', end: '2025-04-02 15:30' },
        { id: '3', title: 'Project Deadline', start: '2025-04-10', end: '2025-04-10', allDay: true },
      ]);
    }
    
    if (!activityLog.length) {
      setActivityLog([
        { id: '1', action: 'Document created', user: 'You', item: 'Marketing Strategy', time: '2025-03-30 09:15' },
        { id: '2', action: 'Comment added', user: 'John Smith', item: 'Quarterly Review', time: '2025-03-30 11:30' },
        { id: '3', action: 'Task completed', user: 'You', item: 'Review content strategy', time: '2025-03-29 16:45' },
      ]);
    }
  }, [documents, tasks, notifications, users, calendarEvents, activityLog]);

  // Hard-coded public templates
  const PUBLIC_TEMPLATES = [
    {
      id: 1,
      title: "Standard Contract",
      description: "A standard contract template with common legal terms",
      content: JSON.stringify({ sections: [{ title: "Terms and Conditions", content: "Standard terms..." }] }),
      lockedSections: JSON.stringify([1, 2])
    },
    {
      id: 2,
      title: "NDA Agreement",
      description: "Non-disclosure agreement for protecting confidential information",
      content: JSON.stringify({ sections: [{ title: "Confidentiality", content: "All information shared..." }] }),
      lockedSections: JSON.stringify([])
    },
    {
      id: 3,
      title: "Employment Contract",
      description: "Standard employment contract with customizable terms",
      content: JSON.stringify({ sections: [{ title: "Employment Terms", content: "Terms of employment..." }] }),
      lockedSections: JSON.stringify([3])
    },
    {
      id: 4,
      title: "Sales Proposal",
      description: "Professional sales proposal template for new business opportunities",
      content: JSON.stringify({ sections: [{ title: "Executive Summary", content: "Proposal overview..." }] }),
      lockedSections: JSON.stringify([])
    },
    {
      id: 5,
      title: "Project Statement of Work",
      description: "Detailed statement of work template for project documentation",
      content: JSON.stringify({ sections: [{ title: "Project Scope", content: "The scope includes..." }] }),
      lockedSections: JSON.stringify([1, 4])
    }
  ];

  // Render loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading Dashboard..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <HeaderComponent
        user={user}
        localTime={localTime}
        notifications={notifications}
        handleLogout={handleLogout}
      />
      
      <Layout>
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          activeTab={activeTab}
          setActiveTab={handleMenuSelect}
          menuItems={menuItems}
          user={user}
        />
        
        <Content style={{ 
          padding: ['create-template', 'create-document'].includes(activeTab) || 
                   previewTemplate || 
                   previewDocument || 
                   revisingTemplate || 
                   revisingDocument 
                     ? '0px' 
                     : '24px', 
          background: '#f0f2f5' 
        }}>
          {activeTab === 'overview' && <Overview 
            documents={documents}
            tasks={tasks}
            activityLog={activityLog}
            user={user}
            users={users}
            navigate={navigate}
            notifications={notifications}
            handleCreateDocument={handleCreateDocument}
            showJoinDocModal={() => setIsJoinDocModalVisible(true)}
          />}

          {activeTab === 'my-tasks' && <MyTasks 
            tasks={tasks}
            toggleTask={toggleTask}
            handleCreateTask={() => setNewTaskVisible(true)}
          />}

          {activeTab === 'create-document' && <CreateDocument
          navigate={navigate}
          template={useTemplate}
          document={useDocument}
          user={user}
          users={users}
          templates={templates}
          departments={departments}
          onSuccess={fetchUserData}
          onCancel={() => {
            setActiveTab('documents-recent');
            fetchUserData(false);
          }}
          />}

          {activeTab === 'documents-recent' && !previewDocument && (
            <RecentDocuments 
              documents={documents}
              navigate={navigate}
              handlePreviewDocument={handlePreviewDocument}
              handleOpenDocumentPreviewModal={handleOpenDocumentPreviewModal}
            />
          )}

          {activeTab === 'documents-recent' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}

          {activeTab === 'documents-drafts' && !previewDocument && (
            <MyDocumentDrafts user={user} documents={documents} navigate={navigate} handleEditDocument={handleEditDocument} />
          )}

          {activeTab === 'documents-drafts' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}

          {activeTab === 'documents-monitoring' && !previewDocument && (
            <DocumentReviewMonitoring
              documents={documents}
              users={users}
              user={user}
              onRefresh={() => fetchUserData(false)}
              handlePreviewDocument={handlePreviewDocument}
              handleEditDocument={handleEditDocument}
            />
          )}

          {activeTab === 'documents-monitoring' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}

          {activeTab === 'documents-published' && !previewDocument && !revisingDocument && (
            <PublishedDocumentsList
              user={user}
              navigate={navigate}
              fetchUserData={() => fetchUserData(false)}
              documents={documents}
              users={users}
              handleReviseDocument={handleReviseDocument}
              handlePreviewDocument={handlePreviewDocument}
              handleUseDocument={handleUseDocument}
              handleOpenDocumentPreviewModal={handleOpenDocumentPreviewModal}
            />
          )}

          {activeTab === 'documents-published' && !previewDocument && revisingDocument && (
            <ReviseDocument
              fetchUserData={() => fetchUserData(false)}
              document={revisingDocument}
              user={user}
              users={users}
              templates={templates}
              departments={departments}
              onCancel={() => {
                setRevisingDocument(null);
                fetchUserData(false);
              }}
            />
          )}

          {activeTab === 'documents-published' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onRevise={() => {
                const docToRevise = previewDocument;
                setPreviewDocument(null);
                handleReviseDocument(docToRevise);
              }}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}

          {activeTab === 'documents-archived' && !previewDocument && (
            <ArchivedDocumentsList
              user={user}
              documents={documents}
              users={users}
              handlePreviewDocument={handlePreviewDocument}
              fetchUserData={() => fetchUserData(false)}
            />
          )}

          {activeTab === 'documents-archived' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}



          {activeTab === 'document-pending-review' && !previewDocument && (
            <DocumentPendingReview
              documents={documents}
              user={user}
              users={users}
              onRefresh={() => fetchUserData(false)}
              handlePreviewDocument={handlePreviewDocument}
            />
          )}

          {activeTab === 'document-pending-review' && previewDocument && (
            <DocumentPreview
              document={previewDocument}
              currentUser={user}
              users={users}
              categories={templateCategories}
              departments={departments}
              readOnly={isPreviewOnly}
              onCancel={() => {
                setPreviewDocument(null);
                fetchUserData(false);
              }}
            />
          )}


          {activeTab === 'calendar' && <CalendarTab 
            calendarEvents={calendarEvents}
          />}

          {activeTab === 'accounts' && <Accounts 
            PasswordConfirmModal={PasswordConfirmModal}
            requirePasswordConfirmation={requirePasswordConfirmation}
            fetchUserData={fetchUserData}
            departments={departments}
            sites={sites}
            users={users}
            invitedUsers={invitedUsers}
            user={user}
            templates={templates}
            getConsistentColor={getConsistentColor}
          />}

          {/* {activeTab === 'audit' && <Audit 
            activityLog={activityLog}
          />}

          {activeTab === 'references' && <References />} */}

          {activeTab === 'my-drafts' && !previewTemplate && (
          <MyDrafts 
            user={user}
            navigate={navigate}
            fetchUserData={fetchUserData}
            users={users}
            templates={templates}
            handleEditTemplate={handleEditTemplate}
            PUBLIC_TEMPLATES={PUBLIC_TEMPLATES}
            categories={templateCategories}
            departments={departments}
          />
          )}

          {activeTab === 'templates-list' && !revisingTemplate && (
          <Templates 
            user={user}
            navigate={navigate}
            fetchUserData={() => fetchUserData(false)}
            users={users}
            templates={templates}
            handleReviseTemplate={handleReviseTemplate}
            PUBLIC_TEMPLATES={PUBLIC_TEMPLATES}
            categories={templateCategories}
            departments={departments}
            handleUseTemplate={handleUseTemplate}
          />
          )}

          {activeTab === 'archived-templates' && (
          <ArchivedTemplates 
            user={user}
            navigate={navigate}
            fetchUserData={() => fetchUserData(false)}
            users={users}
            templates={templates}
            handleEditTemplate={handleEditTemplate}
            PUBLIC_TEMPLATES={PUBLIC_TEMPLATES}
            categories={templateCategories}
            departments={departments}
          />
          )}

          {activeTab === 'create-template' && <CreateTemplate 
            fetchUserData={() => fetchUserData(false)}
            user={user}
            users={users}
            templates={templates}
            categories={templateCategories}
            departments={departments}
            onCancel={() => {
              setActiveTab('templates-list');
              fetchUserData(false);
            }}
            onSuccess={() => {
              setActiveTab('templates-list');
              fetchUserData(false); // Refresh the templates list
            }}
          />}

          {activeTab === 'my-drafts' && previewTemplate && (
          <TemplatePreview
            fetchUserData={() => fetchUserData(false)} 
            template={previewTemplate}
            currentUser={user}
            users={users}
            categories={templateCategories}
            departments={departments}
            onCancel={() => {
              setPreviewTemplate(null);
              fetchUserData(false);
            }}
          />
          )}


          {activeTab === 'templates-list' && revisingTemplate && (
          <ReviseTemplate
            fetchUserData={() => fetchUserData(false)}
            template={revisingTemplate}
            user={user}
            users={users}
            categories={templateCategories}
            departments={departments}
            templates={templates}
            onCancel={() => {
              setRevisingTemplate(null);
              fetchUserData(false);
            }}
          />
          )}

          {activeTab === 'template-approval' && !previewTemplate && (
          <PendingReview  
            templates={templates}
            user={user}
            users={users}
            onRefresh={() => fetchUserData(false)}
            departments={departments}
            handlePreviewTemplate={handlePreviewTemplate}
          />
          )}

          {activeTab === 'template-monitoring' && !previewTemplate && (
          <ReviewMonitoring 
            templates={templates}
            user={user}
            users={users}
            onRefresh={() => fetchUserData(false)}
            departments={departments}
            handlePreviewTemplate={handlePreviewTemplate}
            handleEditTemplate={handleEditTemplate}
          />
          )}

          {activeTab === 'template-approval' && previewTemplate && (
          <TemplatePreview 
            fetchUserData={() => fetchUserData(false)}
            template={previewTemplate}
            currentUser={user}
            users={users}
            categories={templateCategories}
            departments={departments}
            onCancel={() => {
              setPreviewTemplate(null);
              fetchUserData(false);
            }}
          />
          )}

          {activeTab === 'template-monitoring' && previewTemplate && (
          <TemplatePreview 
            fetchUserData={() => fetchUserData(false)}
            template={previewTemplate}
            currentUser={user}
            users={users}
            categories={templateCategories}
            departments={departments}
            onCancel={() => {
              setPreviewTemplate(null);
              fetchUserData(false);
            }}
          />
          )}

          {/* {activeTab === 'settings' && <Settings 
            user={user}
          />} */}
        </Content>
      </Layout>

      <PasswordConfirmModal 
        visible={isPasswordModalVisible}
        onConfirm={handlePasswordConfirmed}
        onCancel={handlePasswordModalCancel}
      />

      <JoinDocumentModal
        visible={isJoinDocModalVisible}
        onJoin={handleJoin}
        onCancel={() => setIsJoinDocModalVisible(false)}
      />

      <CreateTaskModal
        visible={newTaskVisible}
        onCreate={handleTaskFormSubmit}
        onCancel={() => setNewTaskVisible(false)}
        users={users}
        user={user}
      />
      <DocumentPreviewModal
        visible={previewModalVisible}
        document={documentToPreview}
        onClose={() => {
          setPreviewModalVisible(false);
          setDocumentToPreview(null);
        }}
        categories={templateCategories}
        users={users}
        departments={departments}
      />

      {refreshing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          pointerEvents: 'all'
        }}>
          <Spin size="large" tip="Syncing database changes..." />
        </div>
      )}
    </Layout>
  );
};

export default Home;