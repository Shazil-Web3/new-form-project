import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { successAlert, errorAlert, confirmAlert, toastAlert } from '../../../../utils/alerts';
import { 
  Card, 
  Table,
  Avatar, 
  Tag, 
  Button, 
  Typography, 
  Input, 
  Space,
  Modal,
  Form,
  Select,
  Divider,
  Badge,
  Tabs,
  Tooltip,
  message,
  Switch,
  List,
  notification,
  DatePicker,
  Radio,
  Popover
} from 'antd';
import { 
  StopOutlined,
  PlusOutlined, 
  SearchOutlined, 
  UserOutlined,
  EditOutlined,
  SendOutlined,
  DeleteOutlined,
  LockOutlined,
  TeamOutlined,
  MailOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UsergroupAddOutlined,
  BellOutlined,
  CalendarOutlined,
  EyeInvisibleOutlined,
  ImportOutlined,
  EyeOutlined,
  PlusCircleOutlined,
  BarsOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
  FieldNumberOutlined
} from '@ant-design/icons';
import moment from 'moment';
import TemplateApproversConfig from './TemplateApproversConfig';
import NumbersManagement from './NumbersManagement';

const { Text, Title, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const Accounts = ({requirePasswordConfirmation, users, invitedUsers, user, fetchUserData, departments, sites, templates = [], getConsistentColor }) => {
  const currentOrgId = user?.orgId || user?.organization_id || user?.organizationId || user?.org_id;
  const parseSites = (siteValue) => {
    if (!siteValue) return [];
    try {
      if (siteValue.startsWith('[') && siteValue.endsWith(']')) {
        return JSON.parse(siteValue);
      }
      return siteValue.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      return [siteValue];
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isDepartmentModalVisible, setIsDepartmentModalVisible] = useState(false);
  const [isEditDepartmentModalVisible, setIsEditDepartmentModalVisible] = useState(false);
  const [isMultipleInviteModalVisible, setIsMultipleInviteModalVisible] = useState(false);
  const [isNotificationSettingsVisible, setIsNotificationSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('accountsActiveTab') || '1');
  const [form] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [templateApprovers, setTemplateApprovers] = useState([]);
  const [departmentForm] = Form.useForm();
  const [renameDepartmentForm] = Form.useForm();
  const [multipleInviteForm] = Form.useForm();
  const [notificationSettingsForm] = Form.useForm();
  const [editMode, setEditMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentDepartment, setCurrentDepartment] = useState(null);
  const [hasProjectManager, setHasProjectManager] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterDeptStatus, setFilterDeptStatus] = useState('active');
  const [userViewMode, setUserViewMode] = useState('table'); // 'list' or 'table'
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [viewableUsers, setViewableUsers] = useState([]);
  const [viewableDepartments, setViewableDepartments] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState({
    approvalNotifications: true,
    inviteNotifications: true,
    departmentChangeNotifications: true,
    userStatusNotifications: true
  });

  // Sites state
  const [isSiteModalVisible, setIsSiteModalVisible] = useState(false);
  const [isEditSiteModalVisible, setIsEditSiteModalVisible] = useState(false);
  const [siteForm] = Form.useForm();
  const [renameSiteForm] = Form.useForm();
  const [currentSite, setCurrentSite] = useState(null);
  const [filterSiteStatus, setFilterSiteStatus] = useState('active');
  const [viewableSites, setViewableSites] = useState([]);

  // Check if there's already a project manager when users change
  useEffect(() => {
    const pmExists = users.some(u => u.role === 'project_manager' && u.status !== 'inactive');
    setHasProjectManager(pmExists);
  }, [users]);

  useEffect(() => {
    if(invitedUsers) {
      const invites = invitedUsers.filter(user => user.status === 'invited');
      const approvals = invitedUsers.filter(user => user.status === 'pending');
      setPendingInvites(invites);
      setPendingApprovals(approvals);
    }
  }, [invitedUsers]);

  // Update viewable users based on filters
  useEffect(() => {
    let filtered = users.filter(user => {
      const matchesSearch = `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = filterDepartment === 'all' || user.department === filterDepartment;
      
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      
      return matchesSearch && matchesDepartment && matchesStatus;
    });
    
    setViewableUsers(filtered);
  }, [users, searchQuery, filterDepartment, filterStatus]);

  // Update viewable users based on filters
  useEffect(() => {
    let filtered = departments.filter(dept => {

      const matchesStatus = filterDeptStatus === 'all' || dept.status === filterDeptStatus;
      
      return matchesStatus;
    });
    
    setViewableDepartments(filtered);
  }, [departments, filterDeptStatus]);

  // Update viewable sites based on filters
  useEffect(() => {
    if (sites) {
      let filtered = sites.filter(site => {
        const matchesStatus = filterSiteStatus === 'all' || site.status === filterSiteStatus;
        return matchesStatus;
      });
      setViewableSites(filtered);
    }
  }, [sites, filterSiteStatus]);

// Update template approvers list
useEffect(() => {
  const approvers = users.filter(user => user.template_approver === 'yes' && user.status === 'active');
  setTemplateApprovers(approvers);
}, [users]);

  // Group users by department for table view
  const getUsersByDepartment = () => {
    const departmentGroups = {};
    
    viewableUsers.forEach(member => {
      const managedDept = Array.isArray(departments) ? departments.find(d => String(d.manager) === String(member.id)) : null;
      const dept = member.department || (managedDept ? managedDept.name : 'Unassigned');
      if (!departmentGroups[dept]) {
        departmentGroups[dept] = [];
      }
      departmentGroups[dept].push(member);
    });
    
    return departmentGroups;
  };

  // Handle member form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Check if trying to add a new project manager when one already exists
      if (!editMode && values.role === 'project_manager' && hasProjectManager) {
        errorAlert('Role Conflict', 'There can only be one Project Manager in the team');
        return;
      }

      const payload = {
        firstName: values.first_name,
        lastName: values.last_name,
        email: values.email,
        password: values.password,
        role: values.role || null,
        department: values.department || null,
        site: values.site && values.site.length > 0 ? JSON.stringify(values.site) : null,
        status: values.status || 'active',
        template_approver: values.template_approver || 'no'
      };
        
      try {
        if (editMode) {
          await axios.put(`/api/edit_org_member/${currentUser.id}`, payload);
          
          successAlert('Update Successful', `${values.first_name} ${values.last_name}'s profile has been updated`);
          fetchUserData();
        } else {
          await axios.post(`/api/add_org_member/${currentOrgId}`, payload);
          
          successAlert('Success!', `${values.first_name} ${values.last_name} has been added to the organization`);
          fetchUserData();
        }
        
        setIsModalVisible(false);
        form.resetFields();
      } catch (error) {
        console.error('Operation failed:', error);
        const errMsg = error.response?.data?.error || 'An unexpected error occurred';
        message.error(errMsg);
        errorAlert('Operation Failed', errMsg);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      const errMsg = error.errorFields?.[0]?.errors?.[0] || error.response?.data?.error || 'Please check the form inputs';
      message.error(errMsg);
      errorAlert('Validation Error', errMsg);
    }
  };

  // Handle department creation
  const handleDepartmentSubmit = async () => {
    try {
      const values = await departmentForm.validateFields();
      
      try {
        await axios.post(`/api/add_department/${currentOrgId}`, { 
          name: values.departmentName,
          manager: values.departmentManager,
        });

        successAlert('Department Created', `Department "${values.departmentName}" created successfully`);
        fetchUserData();
        
        setIsDepartmentModalVisible(false);
        departmentForm.resetFields();
      } catch (error) {
        console.error('Failed to create department:', error);
        errorAlert('Department Creation Failed', error.response?.data?.error || 'Failed to create department');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the department form inputs');
    }
  };

  // Toggle user status with password confirmation
  const handleToggleUserStatus = (member) => {
    confirmAlert(
      member.status === 'active' ? 'Deactivate User' : 'Activate User',
      `Are you sure you want to ${member.status === 'active' ? 'deactivate' : 'activate'} ${member.first_name} ${member.last_name}?`,
      'Yes, proceed',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        const toggleStatus = async () => {
          try {
            const newStatus = member.status === 'active' ? 'deactivated' : 'active';
            
            const payload = {
              firstName: member.first_name,
              lastName: member.last_name,
              email: member.email,
              password: member.password,
              role: member.role,
              department: member.department,
              status: newStatus,
              template_approver: member.template_approver
            };
              
            await axios.put(`/api/edit_org_member/${member.id}`, payload);

            successAlert(`User ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, 
              `${member.first_name} ${member.last_name} has been ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
            fetchUserData();
            
          } catch (error) {
            console.error('Failed to update user status:', error);
            errorAlert('Status Update Failed', error.response?.data?.error || 'Failed to update user status');
          }
        };
        
        requirePasswordConfirmation(toggleStatus);
      }
    });
  };

  // Remove user with password confirmation
  const handleRemoveUser = (member) => {
    confirmAlert(
      'Remove User', 
      `Are you sure you want to remove ${member.first_name} ${member.last_name} from the organization? This action cannot be undone.`,
      'Yes, remove user',
      'Cancel',
      { 
        confirmButtonColor: '#d33',
        icon: 'warning'
      }
    ).then((result) => {
      if (result.isConfirmed) {
        const removeUser = async () => {
          try {
            await axios.delete(`/api/del_org_member/${member.id}`);
         
            successAlert('User Removed', `${member.first_name} ${member.last_name} has been removed from the organization`);
            fetchUserData();
            
          } catch (error) {
            console.error('Failed to remove team member:', error);
            errorAlert('Removal Failed', error.response?.data?.error || 'Failed to remove team member');
          }
        };
        
        requirePasswordConfirmation(removeUser);
      }
    });
  };

  // Toggle template approver status
  const handleToggleTemplateApprover = (member) => {
    confirmAlert(
      member.template_approver === 'yes' ? 'Remove Template Approver' : 'Assign as Template Approver',
      `Are you sure you want to ${member.template_approver === 'yes' ? 'remove' : 'assign'} ${member.first_name} ${member.last_name} ${member.template_approver === 'yes' ? 'from' : 'as'} template approver?`,
      'Yes, proceed',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        const toggleTemplateApprover = async () => {
          try {
            const newStatus = member.template_approver === 'yes' ? 'no' : 'yes';
            
            const payload = {
              firstName: member.first_name,
              lastName: member.last_name,
              email: member.email,
              password: member.password,
              role: member.role,
              department: member.department,
              status: member.status,
              template_approver: newStatus
            };
              
            await axios.put(`/api/edit_org_member/${member.id}`, payload);

            successAlert(`Template Approver ${newStatus === 'yes' ? 'Assigned' : 'Removed'}`, 
              `${member.first_name} ${member.last_name} has been ${newStatus === 'yes' ? 'assigned as' : 'removed from'} template approver successfully`);
            fetchUserData();
            
          } catch (error) {
            console.error('Failed to update template approver status:', error);
            errorAlert('Status Update Failed', error.response?.data?.error || 'Failed to update template approver status');
          }
        };
        
        requirePasswordConfirmation(toggleTemplateApprover);
      }
    });
  };

  // Handle rename department submission
  const handleEditDepartmentSubmit = async () => {
    try {
      const values = await renameDepartmentForm.validateFields();
      
      const updateDepartment = async () => {
        try {
          await axios.put(`/api/edit_department/${currentDepartment.id}`, {
            name: values.newDepartmentName,
            manager: values.departmentManager,
            status: currentDepartment.status,
            orgId: currentDepartment.organization_id
          });
          
          successAlert('Department Updated', `Department "${currentDepartment.name}" has been renamed to "${values.newDepartmentName}"`);
          fetchUserData();
                  
          setIsEditDepartmentModalVisible(false);
          renameDepartmentForm.resetFields();
        } catch (error) {
          console.error('Failed to rename department:', error);
          errorAlert('Update Failed', error.response?.data?.error || 'Failed to rename department');
        }
      };
      
      requirePasswordConfirmation(updateDepartment);
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the form inputs');
    }
  };

  // Change department status (active/inactive)
  const handleToggleDepartmentStatus = async (department) => {
    const newStatus = department.status === 'active' ? 'inactive' : 'active';
    
    confirmAlert(
      newStatus === 'active' ? 'Activate Department' : 'Deactivate Department',
      `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} the "${department.name}" department?`,
      'Yes, proceed',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        const toggleDepartmentStatus = async () => {
          try {
            await axios.put(`/api/edit_department/${department.id}`, {
              name: department.name,
              description: department.description,
              status: newStatus,
              orgId: department.organization_id
            });
            
            successAlert(`Department ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, 
              `Department "${department.name}" has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            fetchUserData();
            
          } catch (error) {
            console.error('Failed to update department status:', error);
            errorAlert('Status Update Failed', error.response?.data?.error || 'Failed to update department status');
          }
        };
        
        requirePasswordConfirmation(toggleDepartmentStatus);
      }
    });
  };

  // Handle site creation
  const handleSiteSubmit = async () => {
    try {
      const values = await siteForm.validateFields();
      
      try {
        await axios.post(`/api/add_site/${currentOrgId}`, { 
          name: values.siteName,
        });

        successAlert('Site Created', `Site "${values.siteName}" created successfully`);
        fetchUserData();
        
        setIsSiteModalVisible(false);
        siteForm.resetFields();
      } catch (error) {
        console.error('Failed to create site:', error);
        errorAlert('Site Creation Failed', error.response?.data?.error || 'Failed to create site');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the site form inputs');
    }
  };

  // Handle edit site name submission
  const handleEditSiteSubmit = async () => {
    try {
      const values = await renameSiteForm.validateFields();
      
      const updateSite = async () => {
        try {
          await axios.put(`/api/edit_site/${currentSite.id}`, {
            name: values.newSiteName,
            status: currentSite.status,
          });
          
          successAlert('Site Updated', `Site "${currentSite.name}" has been renamed to "${values.newSiteName}"`);
          fetchUserData();
                  
          setIsEditSiteModalVisible(false);
          renameSiteForm.resetFields();
        } catch (error) {
          console.error('Failed to rename site:', error);
          errorAlert('Update Failed', error.response?.data?.error || 'Failed to rename site');
        }
      };
      
      requirePasswordConfirmation(updateSite);
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the form inputs');
    }
  };

  // Toggle site status (active/inactive)
  const handleToggleSiteStatus = async (site) => {
    const newStatus = site.status === 'active' ? 'inactive' : 'active';
    
    confirmAlert(
      newStatus === 'active' ? 'Activate Site' : 'Deactivate Site',
      `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} the "${site.name}" site?`,
      'Yes, proceed',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        const toggleSiteStatus = async () => {
          try {
            await axios.put(`/api/edit_site/${site.id}`, {
              name: site.name,
              status: newStatus,
            });
            
            successAlert(`Site ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, 
              `Site "${site.name}" has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            fetchUserData();
            
          } catch (error) {
            console.error('Failed to update site status:', error);
            errorAlert('Status Update Failed', error.response?.data?.error || 'Failed to update site status');
          }
        };
        
        requirePasswordConfirmation(toggleSiteStatus);
      }
    });
  };

  // Open edit site modal
  const handleEditSite = (site) => {
    setCurrentSite(site);
    renameSiteForm.setFieldsValue({
      newSiteName: site.name,
    });
    setIsEditSiteModalVisible(true);
  };

  // Handle invite form submission
  const handleInviteSubmit = async () => {
    try {
      const values = await inviteForm.validateFields();
      
      // Check if trying to invite a new project manager when one already exists
      if (values.role === 'project_manager' && hasProjectManager) {
        errorAlert('There can only be one Project Manager in the team');
        return;
      }

      const payload = {
        email: values.email,
        role: values.role || null,
        department: values.department || null,
        site: values.site && values.site.length > 0 ? JSON.stringify(values.site) : null,
        message: values.message || null
      };
      
      try {
        const response = await axios.post(`/api/invite_org_member/${currentOrgId}`, payload);
        
        console.log('Invitation Link:', response.data?.link);
        
        setIsInviteModalVisible(false);
        inviteForm.resetFields();
        
        successAlert('Invitation Sent', `An invitation has been sent to ${values.email}.`);
        fetchUserData();
      } catch (error) {
        console.error('Failed to send invitation:', error);
        errorAlert('Invitation Failed', error.response?.data?.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the form inputs');
    }
  };

  // Handle multiple invites submission
  const handleMultipleInviteSubmit = async () => {
    try {
      const values = await multipleInviteForm.validateFields();
      
      // Parse emails from the textarea
      const emails = values.emails.split(/[\s,;]+/).filter(email => email.trim() !== '');
      
      if (emails.length === 0) {
        errorAlert('Please enter at least one valid email address');
        return;
      }
      
      // Check if trying to invite a new project manager when one already exists
      if (values.role === 'project_manager' && hasProjectManager) {
        errorAlert('There can only be one Project Manager in the team');
        return;
      }
      
      const payload = {
        emails: emails,
        role: values.role,
        department: values.department,
        site: values.site && values.site.length > 0 ? JSON.stringify(values.site) : null,
        message: values.message
      };
      
      try {
        await axios.post(`/api/invite_multiple_org_members/${currentOrgId}`, payload);
              
        setIsMultipleInviteModalVisible(false);
        multipleInviteForm.resetFields();
        
        successAlert(`${emails.length} invitations have been sent successfully`);
        fetchUserData();
      } catch (error) {
        console.error('Failed to send multiple invitations:', error);
        errorAlert(error.response?.data?.error || 'Failed to send invitations');
      }
    } catch (error) {
      console.error('Validation failed:', error);
      errorAlert('Validation Error', 'Please check the form inputs');
    }
  };

  // Handle notification settings submission
  const handleNotificationSettingsSubmit = async () => {
    try {
      const values = await notificationSettingsForm.validateFields();
      
      setNotificationSettings({
        approvalNotifications: values.approvalNotifications,
        inviteNotifications: values.inviteNotifications,
        departmentChangeNotifications: values.departmentChangeNotifications,
        userStatusNotifications: values.userStatusNotifications
      });
      
      await axios.post(`/api/update_notification_settings/${user.id}`, values);
      
      successAlert('Notification settings updated successfully');
      setIsNotificationSettingsVisible(false);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      errorAlert('Failed to update notification settings');
    }
  };

  // Open user edit modal
  const handleEdit = (member) => {
    setCurrentUser(member);
    setEditMode(true);
    form.setFieldsValue({
      first_name: `${member.first_name}`,
      last_name: `${member.last_name}`,
      email: member.email,
      role: member.role,
      department: member.department,
      site: parseSites(member.site),
      status: member.status,
      template_approver: member.template_approver
    });
    setIsModalVisible(true);
  };

  // Open rename department modal
  const handleEditDepartment = (department) => {
    setCurrentDepartment(department);
    renameDepartmentForm.setFieldsValue({
      newDepartmentName: department.name,
      departmentManager: department.description || ''
    });
    setIsEditDepartmentModalVisible(true);
  };

  // Resend invitation
  const handleResendInvite = async (invitedUser) => {
    confirmAlert(
      'Resend Invitation',
      `Are you sure you want to resend the invitation to ${invitedUser.email}?`,
      'Yes, proceed',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.post(`/api/resend_invite/${invitedUser.id}`);
          successAlert('Invitation Resent', 'Invitation resent successfully');
          message.success('Invitation resent successfully');
          fetchUserData();
        } catch (error) {
          console.error('Failed to resend invitation:', error);
          const errMsg = error.response?.data?.error || 'Failed to resend invitation';
          message.error(errMsg);
          errorAlert('Failed to resend invitation', errMsg);
        }
      }
    });
  };

  // Cancel invitation
  const handleCancelInvite = async (invitedUser) => {
    confirmAlert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation to ${invitedUser.email}?`,
      'Yes, proceed',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`/api/cancel_invite/${invitedUser.id}`);
          setPendingInvites(pendingInvites.filter(invite => invite.id !== invitedUser.id));
          successAlert('Invitation Cancelled', 'The invitation has been cancelled successfully');
          message.success('Invitation cancelled successfully');
          fetchUserData();
        } catch (error) {
          console.error('Failed to cancel invitation:', error);
          const errMsg = error.response?.data?.error || 'Failed to cancel invitation';
          message.error(errMsg);
          errorAlert('Failed to cancel invitation', errMsg);
        }
      }
    });
  };

  // Approve invitation
  const handleApproveInvite = async (invitedUser) => {
    confirmAlert(
      'Approve Request',
      `Are you sure you want to approve the request of ${invitedUser.email}?`,
      'Yes, proceed',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.post(`/api/approve_invite/${invitedUser.id}`);
          setPendingApprovals(pendingApprovals.filter(invite => invite.id !== invitedUser.id));
          successAlert('Request Approved', 'User approved successfully');
          message.success('User approved successfully');
          fetchUserData();
        } catch (error) {
          console.error('Failed to approve user:', error);
          const errMsg = error.response?.data?.error || 'Failed to approve user';
          message.error(errMsg);
          errorAlert('Failed to approve user', errMsg);
        }
      }
    });
  };

  // Reject invitation
  const handleRejectInvite = async (invitedUser) => {
    confirmAlert(
      'Reject Request',
      `Are you sure you want to reject the request of ${invitedUser.email}?`,
      'Yes, proceed',
      'Cancel'
    ).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`/api/reject_invite/${invitedUser.id}`);
          setPendingApprovals(pendingApprovals.filter(invite => invite.id !== invitedUser.id));
          successAlert('Request Rejected', 'User rejected successfully');
          message.success('User rejected successfully');
          fetchUserData();
        } catch (error) {
          console.error('Failed to reject user:', error);
          const errMsg = error.response?.data?.error || 'Failed to reject user';
          message.error(errMsg);
          errorAlert('Failed to reject user', errMsg);
        }
      }
    });
  };

  // Update localStorage when tab changes
  const handleTabChange = (key) => {
    setActiveTab(key);
    localStorage.setItem('accountsActiveTab', key);
  };

  // Close modal and reset form
  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditMode(false);
    setCurrentUser(null);
  };

  // Get role tag color
  const getRoleColor = (role) => {
    const roleColorMap = {
      'admin': 'red',
      'project_manager': 'green',
      'author': 'green',
      'reviewer': 'green',
      'approver': 'green',
      'viewer': 'green',
    };
    
    // Use the predefined color if it exists, otherwise get a consistent color
    return roleColorMap[role] || getConsistentColor(role);
  };

  // Get department tag color
  const getDepartmentColor = (department) => {
    // Use the get consistent color
    return getConsistentColor(department);
  };

  // Get status tag color
  const getStatusColor = (status) => {
    const statusColorMap = {
      'active': 'green',
      'inactive': 'orange',
      'pending': 'blue',
      'invited': 'purple'
    };
    
    return statusColorMap[status] || 'default';
  };

  // Format role name
  const formatRoleName = (role) => {
    switch(role) {
      case 'admin': return 'Administrator';
      case 'author': return 'Author (Engineer)';
      case 'project_manager': return 'Project Manager';
      case 'reviewer': return 'Reviewer';
      case 'approver': return 'Approver';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  // Format user's full name
  const getFullName = (user) => `${user.first_name} ${user.last_name}`;

// Table view for users
const renderUserTableView = () => {
  
  const columns = [
    {
      title: 'Name',
      dataIndex: 'user',
      key: 'user',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: 12 }} />
          <div>
            <div>              {`${record.first_name} ${record.last_name}`}
              {record.id === user?.id && (
                <Tag color="gold" style={{ marginLeft: 8 }}>You</Tag>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Sites',
      key: 'sites',
      render: (_, record) => {
        const assignedSites = parseSites(record.site);
        const countText = `${assignedSites.length} site${assignedSites.length === 1 ? '' : 's'}`;
        
        return assignedSites.length > 0 ? (
          <Popover
            content={
              <div style={{ padding: '6px 10px', minWidth: '150px' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#1f1f1f', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <EnvironmentOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                  <span>Assigned Sites</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {assignedSites.map((site, index) => (
                    <Tag 
                      key={index} 
                      color="blue" 
                      style={{ 
                        margin: 0, 
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9',
                        background: '#e6f7ff',
                        color: '#1890ff',
                        fontWeight: 500,
                        padding: '2px 8px',
                        fontSize: '12px'
                      }}
                    >
                      {site}
                    </Tag>
                  ))}
                </div>
              </div>
            }
            title={null}
            trigger="click"
            overlayClassName="sites-popover"
            styles={{
              body: {
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 4px 18px rgba(0,0,0,0.1)'
              }
            }}
          >
            <Button 
              type="link" 
              size="small" 
              style={{ 
                padding: 0, 
                fontWeight: 500,
                color: '#1890ff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <EnvironmentOutlined style={{ fontSize: '13px' }} />
              <span style={{ borderBottom: '1px dashed #1890ff' }}>{countText}</span>
            </Button>
          </Popover>
        ) : (
          <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>0 sites</Text>
        );
      }
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: role => (
        <Tag color={getRoleColor(role)}>
          {formatRoleName(role)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => {
        let color = 'default';
        let text = record.status;
        
        if (record.status === 'active') {
          color = 'success';
          text = 'Active';
        } else if (record.status === 'deactivated') {
          color = 'error'; // Changed from 'warning' to 'error' for better visibility
          text = 'Inactive';
        } else if (record.status === 'pending') {
          color = 'processing';
          text = 'Pending';
        }

        return record.role !== 'admin' ? (
          <Button 
            type="text" 
            onClick={() => handleToggleUserStatus(record)}
          >
            <Badge status={color} text={text} />
          </Button>
        ) : (
          <Badge status={color} text={text} />
        );
      }
    },
    /* {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: department => (
        department ? (
          <Tag color={getDepartmentColor(department)} icon={<TeamOutlined />}>
            {department}
          </Tag>
        ) : (
          <Text type="secondary">Unassigned</Text>
        )
      ),
    }, */
  ];

if (user?.role === 'admin') {
  columns.push({
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
          {record.role !== 'admin' && (
              <Button 
                type="text" 
                icon={<DeleteOutlined />} 
                danger 
                onClick={() => handleRemoveUser(record)}
              />
          )}
        </Space>
      ),
    });
  }

  return (
    <>
      {/* Department Tables */}
      {Object.entries(getUsersByDepartment()).map(([department, viewableUsers]) => (
        <div key={department} style={{ marginBottom: 24 }}>
          <Divider orientation="left">
            <Space>
              <TeamOutlined />
              <Text strong>{department}</Text>
              <Tag>{viewableUsers.length}</Tag>
            </Space>
          </Divider>
          <Table 
            dataSource={viewableUsers} 
            columns={columns} 
            rowKey="id"
            pagination={false}
          />
        </div>
      ))}
    </>
  );
};

// List view for users - Updated to match table view details
const renderUserListView = () => {
  return (
    <>
          <List
            itemLayout="horizontal"
            dataSource={viewableUsers}
            renderItem={(record) => {
              // Determine status properties
              let statusColor = 'default';
              let statusText = record.status;
              
              if (record.status === 'active') {
                statusColor = 'success';
                statusText = 'Active';
              } else if (record.status === 'deactivated') {
                statusColor = 'warning';
                statusText = 'Inactive';
              }

              return (
                <List.Item
                  actions={user?.role === 'admin' && ([
                    <Button key="edit" 
                      type="text" 
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    />,
                    record.role !== 'admin' && (
                      <Button 
                        type="text" 
                        icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
                        danger={record.status === 'active'}
                        onClick={() => handleToggleUserStatus(record)}
                      >
                      </Button>
                    ),
                    record.role !== 'admin' && (
                        <Button 
                          type="text" 
                          icon={<DeleteOutlined />} 
                          danger 
                          onClick={() => handleRemoveUser(record)}
                        />
                    )
                  ].filter(Boolean))}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {`${record.first_name} ${record.last_name}`}
                        {record.id === user?.id && (
                          <Tag color="gold" style={{ marginLeft: 8 }}>You</Tag>
                        )}
                        <Badge 
                          status={statusColor} 
                          text={statusText} 
                          style={{ marginLeft: 8 }}
                        />
                      </div>
                    }
                    description={
                      <div>
                        <div>{record.email}</div>
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <Tag 
                            color={getRoleColor(record.role)} 
                            style={{ margin: 0 }}
                          >
                            {formatRoleName(record.role)}
                          </Tag>
                          <Tag color={getDepartmentColor(record.department)} icon={<TeamOutlined />} style={{ margin: 0 }}>
                            {record.department || 'Unassigned'}
                          </Tag>
                          {(() => {
                            const assignedSites = parseSites(record.site);
                            const countText = `${assignedSites.length} site${assignedSites.length === 1 ? '' : 's'}`;
                            return assignedSites.length > 0 ? (
                              <Popover
                                content={
                                  <div style={{ padding: '6px 10px', minWidth: '150px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#1f1f1f', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <EnvironmentOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                      <span>Assigned Sites</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                                      {assignedSites.map((site, index) => (
                                        <Tag 
                                          key={index} 
                                          color="blue" 
                                          style={{ 
                                            margin: 0, 
                                            borderRadius: '4px',
                                            border: '1px solid #d9d9d9',
                                            background: '#e6f7ff',
                                            color: '#1890ff',
                                            fontWeight: 500,
                                            padding: '2px 8px',
                                            fontSize: '12px'
                                          }}
                                        >
                                          {site}
                                        </Tag>
                                      ))}
                                    </div>
                                  </div>
                                }
                                title={null}
                                trigger="click"
                                styles={{
                                  body: {
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                    boxShadow: '0 4px 18px rgba(0,0,0,0.1)'
                                  }
                                }}
                              >
                                <Button 
                                  type="link" 
                                  size="small" 
                                  style={{ 
                                    padding: 0, 
                                    fontWeight: 500,
                                    color: '#1890ff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <EnvironmentOutlined style={{ fontSize: '13px' }} />
                                  <span style={{ borderBottom: '1px dashed #1890ff' }}>{countText}</span>
                                </Button>
                              </Popover>
                            ) : (
                              <Tag icon={<EnvironmentOutlined />} style={{ margin: 0 }}>0 sites</Tag>
                            );
                          })()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
    </>
  );
};

  // Pending invites table columns
  const inviteColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: role => (
        <Tag color={getRoleColor(role)}>
          {formatRoleName(role)}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: department => (
        department ? (
          <Tag color={getDepartmentColor(department)} icon={<TeamOutlined />}>
            {department}
          </Tag>
        ) : (
          <Text type="secondary">Unassigned</Text>
        )
      ),
    },
    {
      title: 'Invited On',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => moment(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="text" 
            icon={<SendOutlined />} 
            style={{ color: 'green' }}
            onClick={() => handleResendInvite(record)}
          >
            Resend
          </Button>
            <Button 
              type="text" 
              icon={<CloseCircleOutlined />} 
              danger
              onClick={() => handleCancelInvite(record)}
            >
              Cancel
            </Button>
        </Space>
      ),
    },
  ];

  // Account Approval table columns
  const approvalColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        record.first_name && record.last_name ? 
        `${record.first_name} ${record.last_name}` : 
        <Text type="secondary">Not provided</Text>
      ),
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
      render: role => (
        <Tag color={getRoleColor(role)}>
          {formatRoleName(role)}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: department => (
        department ? (
          <Tag color={getDepartmentColor(department)} icon={<TeamOutlined />}>
            {department}
          </Tag>
        ) : (
          <Text type="secondary">Unassigned</Text>
        )
      ),
    },
    {
      title: 'Joined On',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => moment(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="text" 
            icon={<CheckCircleOutlined />} 
            style={{ color: 'green' }}
            onClick={() => handleApproveInvite(record)}
          >
            Approve
          </Button>
          <Button 
            type="text" 
            icon={<CloseCircleOutlined />} 
            danger
            onClick={() => handleRejectInvite(record)}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  // Department table columns
  const departmentColumns = [
    {
      title: 'Department',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Button 
          type="text" 
          onClick={() => handleEditDepartment(record)}
        >
          {record.name}
        </Button>
      ),
    },
    {
      title: 'Manager',
      dataIndex: 'manager',
      key: 'manager',
      render: (_, record) => {
        if (!record.manager) {
          return <Text type="secondary">No Manager</Text>;
        }
        
        const manager = users.find(user => user.id === record.manager);
        return manager ? (
          <Text>{manager.email}</Text>
        ) : (
          <Text type="warning">Manager not found</Text>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => (
        <Button 
          type="text" 
          onClick={() => handleToggleDepartmentStatus(record)}
        >
          <Tag color={getStatusColor(record.status || 'active')}>
            {record.status ? (record.status).charAt(0).toUpperCase() + (record.status).slice(1) : 'Active'}
          </Tag>
        </Button>
      ),
    },
    {
      title: 'Members',
      key: 'members',
      render: (_, record) => {
        const deptMembers = users.filter(u => 
          u.department?.trim().toLowerCase() === record.name?.trim().toLowerCase() || 
          (record.manager && String(u.id) === String(record.manager))
        );
        return (
          <Text>{deptMembers.length}</Text>
        );
      }
    }
  ];

  // Site table columns
  const siteColumns = [
    {
      title: 'Site',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Button 
          type="text" 
          onClick={() => handleEditSite(record)}
        >
          {record.name}
        </Button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => (
        <Button 
          type="text" 
          onClick={() => handleToggleSiteStatus(record)}
        >
          <Tag color={getStatusColor(record.status || 'active')}>
            {record.status ? (record.status).charAt(0).toUpperCase() + (record.status).slice(1) : 'Active'}
          </Tag>
        </Button>
      ),
    },
    {
      title: 'Members',
      key: 'members',
      render: (_, record) => {
        const siteMembers = users.filter(u => parseSites(u.site).includes(record.name));
        return (
          <Text>{siteMembers.length}</Text>
        );
      }
    }
  ];

  // Template Matrix table columns
  const templateMatrixColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: 12 }} />
          <div>
            <div>{`${record.first_name} ${record.last_name}`}
              {record.id === user?.id && (
                <Tag color="gold" style={{ marginLeft: 8 }}>You</Tag>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: role => (
        <Tag color={getRoleColor(role)}>
          {formatRoleName(role)}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: department => (
        department ? (
          <Tag color={getDepartmentColor(department)} icon={<TeamOutlined />}>
            {department}
          </Tag>
        ) : (
          <Text type="secondary">Unassigned</Text>
        )
      ),
    },
    {
      title: 'Template Approver',
      dataIndex: 'template_approver',
      key: 'template_approver',
      render: (approver, record) => (
        <Switch 
          checked={approver === 'yes'} 
          onChange={() => handleToggleTemplateApprover(record)}
          disabled={!user || user.role !== 'admin'}
        />
      ),
    }
  ];

  const renderTemplateMatrix = () => {
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="Search by name or email"
            allowClear
            style={{ width: 250, marginRight: 16 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Select
            style={{ width: 180, marginRight: 16 }}
            placeholder="Department"
            value={filterDepartment}
            onChange={setFilterDepartment}
          >
            <Option value="all">All Departments</Option>
            {departments.map(dept => (
              <Option key={dept.id} value={dept.name}>{dept.name}</Option>
            ))}
            <Option value="">Unassigned</Option>
          </Select>
        </div>
        
        <Divider orientation="left">
          <Space>
            <CheckCircleOutlined />
            <Text strong>Template Approvers</Text>
            <Tag>{templateApprovers.length}</Tag>
          </Space>
        </Divider>
        
        <Table 
          dataSource={viewableUsers.filter(u => u.status === 'active')} 
          columns={templateMatrixColumns} 
          rowKey="id"
          pagination={false}
        />
      </>
    );
  };

  return (
    <Card
      title={
        <Space>
          <TeamOutlined />
          <span>Account Management</span>
        </Space>
      }
      extra={
        <Tooltip title="Notification Settings">
        {user?.role === 'admin' && (
          <Button 
            icon={<BellOutlined />} 
            onClick={() => {
              notificationSettingsForm.setFieldsValue(notificationSettings);
              setIsNotificationSettingsVisible(true);
            }}
          />
        )}
        </Tooltip>
      }
    >
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane 
            tab={
              <span>
                <UserOutlined />
              {"  "}
              Users
              </span>
            } 
            key="1"
          >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <Search
                  placeholder="Search by name or email"
                  allowClear
                  style={{ width: 250 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  prefix={<SearchOutlined />}
                />
                <Select
                  style={{ width: 180 }}
                  placeholder="Department"
                  value={filterDepartment}
                  onChange={setFilterDepartment}
                >
                  <Option value="all">All Departments</Option>
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.name}>{dept.name}</Option>
                  ))}
                  <Option value="">Unassigned</Option>
                </Select>
                <Select
                  style={{ width: 150 }}
                  placeholder="Status"
                  value={filterStatus}
                  onChange={setFilterStatus}
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active</Option>
                  <Option value="deactivated">Inactive</Option>
                </Select>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Radio.Group 
                  value={userViewMode} 
                  onChange={e => setUserViewMode(e.target.value)}
                  buttonStyle="solid"
                  optionType="button"
                >
                  <Radio.Button value="list">
                    <BarsOutlined /> List
                  </Radio.Button>
                  <Radio.Button value="table">
                    <AppstoreOutlined /> Table
                  </Radio.Button>
                </Radio.Group>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>

                {user?.role === 'admin' && (
                  <>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />} 
                      onClick={() => { setCurrentUser(null); setEditMode(false); setIsModalVisible(true); }}
                    >
                      Add User
                    </Button>
                    <Button 
                      icon={<SendOutlined />} 
                      onClick={() => setIsInviteModalVisible(true)}
                    >
                      Invite
                    </Button>
                    <Button 
                      icon={<UsergroupAddOutlined />} 
                      onClick={() => setIsMultipleInviteModalVisible(true)}
                    >
                      Bulk Invite
                    </Button>
                  </>
                )}
              </div>
            </div>

           {userViewMode === 'list' ? renderUserListView() : renderUserTableView()}

        </TabPane>

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <UsergroupAddOutlined />
                {"  "}
                Pending Invites
              </span>
              <span>
                {pendingInvites.length > 0 && (
                  <Badge count={pendingInvites.length} style={{ marginLeft: 8 }} />
                )}
              </span>
              </>
            } 
            key="2"
          >
            <Table 
              columns={inviteColumns}
              dataSource={pendingInvites}
              rowKey="id"
              pagination={false}
            />
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <UsergroupAddOutlined />
                {"  "}
                Account Approval
              </span>
              <span>
                {pendingApprovals.length > 0 && (
                  <Badge count={pendingApprovals.length} style={{ marginLeft: 8 }} />
                )}
              </span>
              </>
            } 
            key="3"
          >
            <Table 
              columns={approvalColumns}
              dataSource={pendingApprovals}
              rowKey="id"
              pagination={false}
            />
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <TeamOutlined />
                {"  "}
                Departments
              </span>
              </>
            } 
            key="4"
          >
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Select
                  style={{ width: 150 }}
                  placeholder="Status"
                  value={filterDeptStatus}
                  onChange={setFilterDeptStatus}
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>

                <Button 
                  type="primary" 
                  icon={<PlusCircleOutlined />} 
                  onClick={() => setIsDepartmentModalVisible(true)}
                >
                  New Department
                </Button>
              </div>

            <Table 
              columns={departmentColumns}
              dataSource={viewableDepartments}
              rowKey="id"
              pagination={false}
            />
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <EnvironmentOutlined />
                {"  "}
                Sites
              </span>
              </>
            } 
            key="6"
          >
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Select
                  style={{ width: 150 }}
                  placeholder="Status"
                  value={filterSiteStatus}
                  onChange={setFilterSiteStatus}
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>

                <Button 
                  type="primary" 
                  icon={<PlusCircleOutlined />} 
                  onClick={() => setIsSiteModalVisible(true)}
                >
                  New Site
                </Button>
              </div>

            <Table 
              columns={siteColumns}
              dataSource={viewableSites}
              rowKey="id"
              pagination={false}
            />
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <CheckCircleOutlined />
                {"  "}
                Template Matrix
              </span>
              </>
            } 
            key="5"
          >
            {renderTemplateMatrix()}
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <TeamOutlined />
                {"  "}
                Approvers
              </span>
              </>
            } 
            key="7"
          >
            <TemplateApproversConfig 
              templates={templates}
              users={users}
              departments={departments}
              fetchUserData={fetchUserData}
            />
          </TabPane>
        )}

        {user?.role === 'admin' && (
          <TabPane 
            tab={
              <>
              <span>
                <FieldNumberOutlined />
                {"  "}
                Numbers
              </span>
              </>
            } 
            key="8"
          >
            <NumbersManagement 
              orgId={currentOrgId}
              departments={departments}
              requirePasswordConfirmation={requirePasswordConfirmation}
            />
          </TabPane>
        )}
      </Tabs>

      {/* User Add/Edit Modal */}
      <Modal
        title={editMode ? 'Edit User' : 'Add New User'}
        visible={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>
            {editMode ? 'Update' : 'Add'}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          name="user_form"
        >
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: 'Please input the first name!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="First Name" />
          </Form.Item>
          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: 'Please input the last name!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Last Name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input the email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" disabled={editMode} />
          </Form.Item>
          {!editMode && (
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please input the password!' },
                { min: 6, message: 'Password must be at least 6 characters long!' }
              ]}
              extra="Must be at least 6 characters"
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password (minimum 6 characters)" />
            </Form.Item>
          )}

          {(currentUser?.role === 'admin') && (
          <Form.Item name="role" hidden>
            <Input type="hidden" />
          </Form.Item>
          )}

          {(currentUser?.role !== 'admin') && (
          <Form.Item
            name="role"
            label="Role"
          >
            <Select placeholder="Select role" allowClear>
              <Option value="project_manager" disabled={hasProjectManager}>Project Manager</Option>
              <Option value="author">Author (Engineer)</Option>
              <Option value="reviewer">Reviewer</Option>
              <Option value="approver">Approver</Option>
              <Option value="viewer">Viewer</Option>
            </Select>
          </Form.Item>
          )}
          <Form.Item
            name="department"
            label="Department"
          >
            <Select placeholder="Select department" allowClear>
              {departments.map(dept => (
                <Option key={dept.id} value={dept.name}>{dept.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="site"
            label="Site"
          >
            <Select mode="multiple" placeholder="Select sites" allowClear>
              {sites && sites.filter(s => s.status === 'active').map(s => (
                <Option key={s.id} value={s.name}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" hidden>
            <Input type="hidden" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Invite Modal */}
      <Modal
        title="Invite Team Member"
        visible={isInviteModalVisible}
        onOk={handleInviteSubmit}
        onCancel={() => {
          setIsInviteModalVisible(false);
          inviteForm.resetFields();
        }}
      >
        <Form
          form={inviteForm}
          layout="vertical"
          name="invite_form"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input the email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
          >
            <Select placeholder="Select role" allowClear>
              <Option value="project_manager" disabled={hasProjectManager}>Project Manager</Option>
              <Option value="author">Author (Engineer)</Option>
              <Option value="reviewer">Reviewer</Option>
              <Option value="approver">Approver</Option>
              <Option value="viewer">Viewer</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="Department"
          >
            <Select placeholder="Select department" allowClear>
              {departments.map(dept => (
                <Option key={dept.id} value={dept.name}>{dept.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="site"
            label="Site"
          >
            <Select mode="multiple" placeholder="Select sites" allowClear>
              {sites && sites.filter(s => s.status === 'active').map(s => (
                <Option key={s.id} value={s.name}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="message"
            label="Custom Message (Optional)"
          >
            <TextArea 
              rows={4} 
              placeholder="Add a personal message to the invitation email" 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Multiple Invite Modal */}
      <Modal
        title="Bulk Invite Team Members"
        visible={isMultipleInviteModalVisible}
        onOk={handleMultipleInviteSubmit}
        onCancel={() => {
          setIsMultipleInviteModalVisible(false);
          multipleInviteForm.resetFields();
        }}
        width={600}
      >
        <Form
          form={multipleInviteForm}
          layout="vertical"
          name="multiple_invite_form"
        >
          <Form.Item
            name="emails"
            label="Email Addresses"
            rules={[{ required: true, message: 'Please input at least one email!' }]}
            extra="Enter multiple email addresses separated by commas, spaces, or new lines"
          >
            <TextArea 
              rows={6} 
              placeholder="example1@example.com, example2@example.com, ..." 
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
          >
            <Select placeholder="Select role">
              <Option value="project_manager" disabled >Project Manager</Option>
              <Option value="author">Author (Engineer)</Option>
              <Option value="reviewer">Reviewer</Option>
              <Option value="approver">Approver</Option>
              <Option value="viewer">Viewer</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="Department"
          >
            <Select placeholder="Select department" allowClear>
              {departments.map(dept => (
                <Option key={dept.id} value={dept.name}>{dept.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="site"
            label="Site"
          >
            <Select mode="multiple" placeholder="Select sites" allowClear>
              {sites && sites.filter(s => s.status === 'active').map(s => (
                <Option key={s.id} value={s.name}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="message"
            label="Custom Message (Optional)"
          >
            <TextArea 
              rows={4} 
              placeholder="Add a personal message to the invitation emails" 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Department Modal */}
      <Modal
        title="Create New Department"
        visible={isDepartmentModalVisible}
        onOk={handleDepartmentSubmit}
        onCancel={() => {
          setIsDepartmentModalVisible(false);
          departmentForm.resetFields();
        }}
      >
        <Form
          form={departmentForm}
          layout="vertical"
          name="department_form"
        >
          <Form.Item
            name="departmentName"
            label="Department Name"
            rules={[{ required: true, message: 'Please input the department name!' }]}
          >
            <Input prefix={<TeamOutlined />} placeholder="Department Name" />
          </Form.Item>
          <Form.Item
            name="departmentManager"
            label="Department Manager"
          >
            <Select
              showSearch
              placeholder="Select a department manager"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.filter(u => u.status === 'active').map(user => (
                <Option 
                  key={user.id} 
                  value={user.id}
                  label={`${user.email} (${user.first_name} ${user.last_name})`}
                >
                  {user.email} ({user.first_name} {user.last_name})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Rename Department Modal */}
      <Modal
        title="Edit Department"
        visible={isEditDepartmentModalVisible}
        onOk={handleEditDepartmentSubmit}
        onCancel={() => {
          setIsEditDepartmentModalVisible(false);
          renameDepartmentForm.resetFields();
        }}
      >
        <Form
          form={renameDepartmentForm}
          layout="vertical"
          name="rename_department_form"
        >
          <Form.Item
            name="newDepartmentName"
            label="Department Name"
            rules={[{ required: true, message: 'Please input the department name!' }]}
          >
            <Input prefix={<TeamOutlined />} placeholder="Department Name" />
          </Form.Item>
          <Form.Item
            name="departmentManager"
            label="Department Manager"
          >
            <Select
              showSearch
              placeholder="Select a department manager"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.filter(u => u.status === 'active').map(user => (
                <Option 
                  key={user.id} 
                  value={user.id}
                  label={`${user.email} (${user.first_name} ${user.last_name})`}
                >
                  {user.email} ({user.first_name} {user.last_name})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Site Modal */}
      <Modal
        title="Create New Site"
        visible={isSiteModalVisible}
        onOk={handleSiteSubmit}
        onCancel={() => {
          setIsSiteModalVisible(false);
          siteForm.resetFields();
        }}
      >
        <Form
          form={siteForm}
          layout="vertical"
          name="site_form"
        >
          <Form.Item
            name="siteName"
            label="Site Name"
            rules={[{ required: true, message: 'Please input the site name!' }]}
          >
            <Input prefix={<EnvironmentOutlined />} placeholder="Site Name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rename Site Modal */}
      <Modal
        title="Edit Site"
        visible={isEditSiteModalVisible}
        onOk={handleEditSiteSubmit}
        onCancel={() => {
          setIsEditSiteModalVisible(false);
          renameSiteForm.resetFields();
        }}
      >
        <Form
          form={renameSiteForm}
          layout="vertical"
          name="rename_site_form"
        >
          <Form.Item
            name="newSiteName"
            label="Site Name"
            rules={[{ required: true, message: 'Please input the site name!' }]}
          >
            <Input prefix={<EnvironmentOutlined />} placeholder="Site Name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        title="Notification Settings"
        visible={isNotificationSettingsVisible}
        onOk={handleNotificationSettingsSubmit}
        onCancel={() => {
          setIsNotificationSettingsVisible(false);
          notificationSettingsForm.resetFields();
        }}
      >
        <Form
          form={notificationSettingsForm}
          layout="vertical"
          name="notification_settings_form"
          initialValues={notificationSettings}
        >
          <Form.Item
            name="approvalNotifications"
            valuePropName="checked"
            label="User Approval Notifications"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="inviteNotifications"
            valuePropName="checked"
            label="Invitation Notifications"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Accounts;