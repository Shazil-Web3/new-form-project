/**
 * @file RbacDashboardPage.jsx
 * @description Role-Based Access Control — Permission Matrix & Management Forms.
 * Features the bold dark permission matrix from Rbac-Matrix-Temp-View.html
 * together with the Custom Role Creation & User-Role Assignment forms below.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button, Checkbox, Form, Input, message, Select } from 'antd';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import {
  listRbacPermissions,
  listRbacOrganizations,
  listRbacUsers,
  createRbacRole,
  assignUserRbacRole
} from '../../../api/rbac';

// 10 Roles matching Rbac-Matrix-Temp-View.html
const INITIAL_ROLES = [
  { id: 'system', label: 'System', short: 'SYS', sub: 'SaaS owner / licence giver', key: 'system', is_system: true },
  { id: 'super_admin', label: 'Super Admin', short: 'SA', sub: 'Creates sites London/Paris, numbering', key: 'super_admin', is_system: true },
  { id: 'admin', label: 'Admin', short: 'ADM', sub: 'Daily activity helping users in templates', key: 'org_admin', is_system: true },
  { id: 'training_admin', label: 'Training Admin', short: 'T-ADM', sub: 'Manages curriculum & training only', key: 'training_admin', is_system: true },
  { id: 'approver', label: 'Approver / Reviewer', short: 'APR', sub: 'Invited Only', key: 'review_appro...', is_system: true },
  { id: 'author', label: 'Author', short: 'AUTH', sub: '', key: 'author', is_system: true },
  { id: 'people', label: 'People Manager', short: 'PEO', sub: '', key: 'people_mana...', is_system: true },
  { id: 'project', label: 'Project Manager', short: 'PM', sub: '', key: 'project_mana...', is_system: true },
  { id: 'view', label: 'View', short: 'VIEW', sub: 'read-only permanent', key: 'view_only', is_system: true },
  { id: 'temp_view', label: 'Temp View', short: 'TEMP', sub: 'visitor / auditor certain doc temporarily', key: 'temporary_vi...', is_system: true }
];

// 25 Capabilities across 4 Groups matching Rbac-Matrix-Temp-View.html
const CAPABILITIES = [
  { id: 'create_account', group: 'ACCESS', label: 'Create Personal Account', detail: 'Self-signup / personal account creation', level: 'System Level' },
  { id: 'reset_pwd', group: 'ACCESS', label: 'Reset Password', detail: 'Can reset own password', level: 'System Level' },
  { id: 'manage_site', group: 'ACCESS', label: 'Manage Site', detail: 'Create / configure sites (London/Paris), licence', level: 'System Level' },
  { id: 'manage_user', group: 'ACCESS', label: 'Manage User', detail: 'Invite, deactivate, roles', level: 'System Level' },
  { id: 'manage_training', group: 'ACCESS', label: 'Manage Training', detail: 'Assign training matrix - now includes Training Admin', level: 'System Level' },
  { id: 'folder_file_access', group: 'ACCESS', label: 'Full / Partial Folder & File (Document) Access', detail: 'SYSTEM LEVEL folder browse + ANALYTICS & ACCESS file open - can view approved doc content', level: 'System Level', note: 'SYSTEM LEVEL - 7 checks - View ✓ / ANALYTICS & ACCESS' },
  { id: 'temp_view_row', group: 'ACCESS', label: 'Temp View / Read-Only = certain document temporarily access (1-8h expires_at)', detail: 'Visitor/auditor link: certain approved doc ONLY, 1-8h + expires_at', level: 'Read-Only' },
  { id: 'report_access', group: 'ACCESS', label: 'Report Access', detail: 'View analytics / compliance reports', level: 'ANALYTICS & ACCESS' },
  { id: 'data_import', group: 'ACCESS', label: 'Data Import', detail: 'Bulk import users / docs', level: 'System Level' },
  { id: 't_comment_review_approve', group: 'TEMPLATE', label: 'Template Comment / Review / Approve (Invited Only)', detail: 'Reviewer can comment by default, approver as part of Review/Approve - Invited Only + dropdown - includes comment count + resolve', level: 'Content Operations', invited: true, note: 'Includes comment counting +1/-1, resolve -1, warning if unresolved' },
  { id: 't_create', group: 'TEMPLATE', label: 'Template Create/Update', detail: 'Create/Update template', level: 'Content Operations' },
  { id: 't_edit', group: 'TEMPLATE', label: 'Template Edit', detail: 'Edit (Template)', level: 'Content Operations' },
  { id: 't_delete', group: 'TEMPLATE', label: 'Template Delete / Pull Back', detail: 'Delete or pull back template', level: 'Content Operations', note: 'Only if not approved by all approvers' },
  { id: 'd_comment_review_approve', group: 'DOCUMENT', label: 'Document Comment / Review / Approve (Invited Only)', detail: 'Reviewer can comment by default, approver as part of Review/Approve - Invited Only + dropdown', level: 'Content Operations', invited: true },
  { id: 'd_edit_same', group: 'DOCUMENT', label: 'Document Edit (Invited Only Same Dept)', detail: 'Edit doc - Same Dept + Invited Only - 6 checks all except System, View, Temp View', level: 'Content Operations', invited: true },
  { id: 'd_create', group: 'DOCUMENT', label: 'Document Create', detail: 'Create new document - 6 checks all except System, View, Temp View', level: 'Content Operations' },
  { id: 'd_delete', group: 'DOCUMENT', label: 'Document Delete / Pull Back', detail: 'Delete or pull back doc', level: 'Content Operations', note: 'Only if not approved by all approvers' },
  { id: 'tr_create', group: 'TRAINING', label: 'Training Curriculum / Exam Create/Update', detail: 'Create/Update curriculum + exams from approved docs - Training Admin only', level: 'Training Admin Only', note: 'Training Admin only = 1 check' },
  { id: 'tr_content_catalog', group: 'TRAINING', label: 'Content Catalog', detail: 'Training Admin responsibility - manage Content Catalog', level: 'Training Admin Only' },
  { id: 'tr_class_library', group: 'TRAINING', label: 'Class Library', detail: 'Training Admin responsibility - manage Class Library', level: 'Training Admin Only' },
  { id: 'tr_assignments', group: 'TRAINING', label: 'Assignments', detail: 'Training Admin responsibility - manage Assignments', level: 'Training Admin Only' },
  { id: 'tr_training_matrix', group: 'TRAINING', label: 'Training Matrix', detail: 'Training Admin responsibility - manage Training Matrix', level: 'Training Admin Only' },
  { id: 'tr_reports', group: 'TRAINING', label: 'Reports', detail: 'Training Admin responsibility - manage Reports', level: 'Training Admin Only' },
  { id: 'tr_records', group: 'TRAINING', label: 'Records', detail: 'Training Admin responsibility - manage Records', level: 'Training Admin Only' },
  { id: 'tr_numbering_rule', group: 'TRAINING', label: 'Numbering Rule', detail: 'Training Admin responsibility - manage Numbering Rule', level: 'Training Admin Only' }
];

// Exact 25 x 10 initial matrix from Rbac-Matrix-Temp-View.html
const INITIAL_MATRIX = [
  [false, true, true, false, true, true, true, true, true, false],
  [false, true, true, false, true, true, true, true, true, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, true, false, false, false, false, false, false],
  [false, true, true, false, true, true, true, true, true, false],
  [false, false, false, false, false, false, false, false, false, true],
  [false, true, true, false, true, true, true, true, false, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, false, true, true, false, false, false, false],
  [false, true, true, false, false, true, false, false, false, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, false, true, true, true, true, false, false],
  [false, true, true, false, true, true, true, true, false, false],
  [false, true, true, false, true, true, true, true, false, false],
  [false, true, true, false, false, true, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false],
  [false, false, false, true, false, false, false, false, false, false]
];

const GROUP_CONFIG = {
  ACCESS: {
    label: 'GROUP 1 — ACCESS',
    icon: 'A',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.3)'
  },
  TEMPLATE: {
    label: 'GROUP 2 — TEMPLATE LIFECYCLE',
    icon: 'T',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.3)'
  },
  DOCUMENT: {
    label: 'GROUP 3 — DOCUMENT',
    icon: 'D',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.15)',
    border: 'rgba(168,85,247,0.3)'
  },
  TRAINING: {
    label: 'GROUP 4 — TRAINING',
    icon: 'R',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.15)',
    border: 'rgba(249,115,22,0.3)'
  }
};

const STORAGE_KEY_MATRIX = 'watermelon_rbac_permission_matrix_v3';
const STORAGE_KEY_ROLES = 'watermelon_rbac_roles_v3';

function loadStoredRoles() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY_ROLES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_ROLES.length) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return [...INITIAL_ROLES];
}

function loadStoredMatrix() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY_MATRIX);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === INITIAL_MATRIX.length) {
          return parsed;
        }
      }
    }
  } catch (e) {}
  return INITIAL_MATRIX.map(row => [...row]);
}

function CheckmarkIcon({ granted, isChanged, isLocked, onClick }) {
  if (!granted) {
    return (
      <button
        type="button"
        disabled={isLocked}
        onClick={onClick}
        title={isLocked ? 'Locked' : 'Click to grant'}
        className={`w-[18px] h-[18px] rounded-full border border-[#444] bg-transparent mx-auto block transition-all focus:outline-none ${
          isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[#777]'
        } ${isChanged ? 'ring-2 ring-amber-400' : ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={onClick}
      title={isLocked ? 'Locked' : 'Click to revoke'}
      className={`w-[18px] h-[18px] rounded-full bg-[#22c55e] flex items-center justify-center mx-auto shadow-[0_0_0_1px_rgba(34,197,94,0.2)] transition-all focus:outline-none ${
        isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:brightness-110'
      } ${isChanged ? 'ring-2 ring-amber-400' : ''}`}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-white">
        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function RbacDashboardContent() {
  const [rolesList, setRolesList] = useState(() => loadStoredRoles());
  const [matrix, setMatrix] = useState(() => loadStoredMatrix());
  const [savedMatrix, setSavedMatrix] = useState(() => loadStoredMatrix());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'admin', 'authors', 'readonly'
  const [auditMode, setAuditMode] = useState('standard'); // 'standard', 'strict', 'training'
  const [notice, setNotice] = useState(null);

  // Forms state
  const [catalog, setCatalog] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [savingForm, setSavingForm] = useState(false);

  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const selectedAssignRoleId = Form.useWatch('roleId', assignForm);

  const filterRef = useRef(null);
  const auditRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
      if (auditRef.current && !auditRef.current.contains(e.target)) {
        setIsAuditOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load catalog permissions and organizations on mount
  useEffect(() => {
    async function initFormData() {
      try {
        const [perms, orgs] = await Promise.all([
          listRbacPermissions(),
          listRbacOrganizations()
        ]);
        setCatalog(perms || []);
        setOrganizations(orgs || []);
      } catch (err) {
        console.error('Failed to init forms data', err);
      }
    }
    initFormData();
  }, []);

  const showNotice = (msg) => {
    setNotice(`${msg} — ${new Date().toLocaleTimeString()} • No backend, local preview only`);
    setTimeout(() => setNotice(null), 3500);
  };

  // Grouped catalog by resource
  const catalogByResource = useMemo(() => {
    return catalog.reduce((grouped, permission) => {
      grouped[permission.resource] = grouped[permission.resource] || [];
      grouped[permission.resource].push(permission);
      return grouped;
    }, {});
  }, [catalog]);

  // Filter roles based on selected Filter Mode
  const visibleRoles = useMemo(() => {
    if (filterMode === 'admin') {
      return rolesList.filter(r => ['system', 'super_admin', 'admin', 'training_admin'].includes(r.id));
    }
    if (filterMode === 'authors') {
      return rolesList.filter(r => ['approver', 'author'].includes(r.id));
    }
    if (filterMode === 'readonly') {
      return rolesList.filter(r => ['view', 'temp_view'].includes(r.id));
    }
    return rolesList;
  }, [filterMode, rolesList]);

  // Statistics calculation
  const stats = useMemo(() => {
    const perRole = rolesList.map((_, colIdx) =>
      matrix.reduce((sum, row) => sum + (row[colIdx] ? 1 : 0), 0)
    );
    const totalChecks = perRole.reduce((a, b) => a + b, 0);
    const totalCells = CAPABILITIES.length * rolesList.length;

    let violations = 0;
    if (perRole[0] > 0) violations += perRole[0];
    matrix[6]?.forEach((val, idx) => {
      if (idx !== 9 && val) violations += 1;
    });

    return { perRole, totalChecks, totalCells, violations };
  }, [matrix, rolesList]);

  // Group row counts
  const groupCounts = useMemo(() => ({
    ACCESS: CAPABILITIES.filter(c => c.group === 'ACCESS').length,
    TEMPLATE: CAPABILITIES.filter(c => c.group === 'TEMPLATE').length,
    DOCUMENT: CAPABILITIES.filter(c => c.group === 'DOCUMENT').length,
    TRAINING: CAPABILITIES.filter(c => c.group === 'TRAINING').length,
  }), []);

  // Unsaved changes count
  const unsavedCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < (matrix[r]?.length || 0); c++) {
        if (matrix[r][c] !== savedMatrix[r]?.[c]) {
          count++;
        }
      }
    }
    return count;
  }, [matrix, savedMatrix]);

  // Toggle permission cell
  const handleToggleCell = (rowIdx, roleId) => {
    const colIdx = rolesList.findIndex(r => r.id === roleId);
    if (colIdx === -1) return;

    if (roleId === 'system') {
      showNotice('System column is grantless (no permissions allowed)');
      return;
    }

    setMatrix(prev => {
      const next = prev.map(row => [...row]);
      next[rowIdx][colIdx] = !next[rowIdx][colIdx];
      return next;
    });
  };

  // Save changes locally
  const handleSave = () => {
    setSavedMatrix(matrix.map(row => [...row]));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(matrix));
        window.localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(rolesList));
        window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
      }
    } catch (e) {}
    showNotice('Changes Saved — local only');
    message.success('Matrix changes saved.');
  };

  // Elevate Admin role to full permissions in the matrix
  const handleElevateAdmin = () => {
    const adminColIdx = rolesList.findIndex(r => r.id === 'admin' || r.key === 'admin');
    if (adminColIdx === -1) return;
    setMatrix(prev => prev.map(row => {
      const next = [...row];
      next[adminColIdx] = true;
      return next;
    }));
    setFilterMode('admin');
    showNotice('Admin role elevated to full permissions (unsaved)');
    message.info('Elevated Admin permissions across all capabilities. Click Save Changes to commit.');
  };

  // Revert to initial template
  const handleRevert = () => {
    const confirmed = window.confirm('Are you sure you want to revert to default? Unsaved changes will be lost.');
    if (!confirmed) return;

    const revertedMatrix = INITIAL_MATRIX.map(row => [...row]);
    const revertedRoles = [...INITIAL_ROLES];
    setMatrix(revertedMatrix);
    setSavedMatrix(revertedMatrix);
    setRolesList(revertedRoles);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(revertedMatrix));
        window.localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(revertedRoles));
        window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
      }
    } catch (e) {}

    showNotice('Reverted to Default');
    message.success('Matrix reverted to default.');
  };

  // Handle Organization change in user assignment form
  const handleOrgChange = async (orgId) => {
    assignForm.resetFields(['userId']);
    setUsers([]);
    if (!orgId) return;
    try {
      const orgUsers = await listRbacUsers(orgId);
      setUsers(orgUsers || []);
    } catch (error) {
      message.error('Unable to load organization users.');
    }
  };

  // Handle Custom Role Creation
  const handleCreateRole = async (values) => {
    setSavingForm(true);
    try {
      const created = await createRbacRole(values);
      const newRole = {
        id: String(created.id || Date.now()),
        label: created.name,
        short: created.name.substring(0, 4).toUpperCase(),
        sub: created.description || '',
        key: created.role_key,
        is_system: false
      };

      const updatedRoles = [...rolesList, newRole];
      setRolesList(updatedRoles);

      // Add a column to each row of the matrix
      const updatedMatrix = matrix.map(row => [...row, true]);
      const updatedSavedMatrix = savedMatrix.map(row => [...row, true]);
      setMatrix(updatedMatrix);
      setSavedMatrix(updatedSavedMatrix);

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(updatedRoles));
          window.localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(updatedMatrix));
          window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
        }
      } catch (e) {}

      message.success(`Custom role "${created.name}" created and added to the matrix.`);
      createForm.resetFields();
      showNotice(`Custom role "${created.name}" created`);
    } catch (error) {
      message.error('Unable to create role.');
    } finally {
      setSavingForm(false);
    }
  };

  // Handle User Role Assignment
  const handleAssign = async (values) => {
    setSavingForm(true);
    try {
      await assignUserRbacRole(values.userId, {
        roleId: values.roleId,
        ...(values.expiresIn ? { expiresIn: values.expiresIn } : {})
      });
      message.success('Role assigned. The user keeps their existing login.');
      assignForm.resetFields(['userId', 'roleId', 'expiresIn']);
      showNotice('Role assigned successfully');
    } catch (error) {
      message.error('Unable to assign role.');
    } finally {
      setSavingForm(false);
    }
  };

  const assigningTemporary = rolesList.some(role =>
    String(role.id) === String(selectedAssignRoleId) && role.id === 'temp_view'
  );

  return (
    <div className="min-h-screen w-full bg-white text-[11px] leading-[1.4] overflow-x-clip font-['Inter',sans-serif]">
      <div className="mx-auto max-w-[1280px] px-3 sm:px-4 py-5">

        {/* Dynamic Notification Toast */}
        {notice && (
          <div className="mb-3 px-3.5 py-2.5 rounded-[8px] bg-gray-900 border border-gray-800 text-[11px] text-white flex items-center justify-between gap-2 shadow-xl animate-fadeIn">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight leading-tight">
              Role-Based Access Control — Permission Matrix
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Matrix Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-[6px] rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {filterMode === 'all' && 'Filter Matrix: View All Roles'}
                {filterMode === 'admin' && 'Filter Matrix: Admin Tier Only'}
                {filterMode === 'authors' && 'Filter Matrix: Reviewers & Authors'}
                {filterMode === 'readonly' && 'Filter Matrix: Read-Only'}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-1 w-[180px] bg-white border border-gray-200 rounded-[8px] p-1 z-30 shadow-xl">
                  <div
                    onClick={() => { setFilterMode('all'); setIsFilterOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${filterMode === 'all' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    View All Roles
                  </div>
                  <div
                    onClick={() => { setFilterMode('admin'); setIsFilterOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${filterMode === 'admin' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Admin Tier Only
                  </div>
                  <div
                    onClick={() => { setFilterMode('authors'); setIsFilterOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${filterMode === 'authors' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Reviewers & Authors
                  </div>
                  <div
                    onClick={() => { setFilterMode('readonly'); setIsFilterOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${filterMode === 'readonly' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Read-Only
                  </div>
                </div>
              )}
            </div>

            {/* Audit Perspective Dropdown */}
            <div className="relative" ref={auditRef}>
              <button
                type="button"
                onClick={() => setIsAuditOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-[6px] rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L2 5v4c0 3 2.5 5 6 5s6-2 6-5V5L8 2z" stroke="#4b5563" strokeWidth="1.2" fill="none" />
                </svg>
                {auditMode === 'standard' && 'Audit Perspective: Standard'}
                {auditMode === 'strict' && 'Audit Perspective: Strict Compliance'}
                {auditMode === 'training' && 'Audit Perspective: Training Focus'}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isAuditOpen && (
                <div className="absolute right-0 mt-1 w-[180px] bg-white border border-gray-200 rounded-[8px] p-1 z-30 shadow-xl">
                  <div
                    onClick={() => { setAuditMode('standard'); setIsAuditOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${auditMode === 'standard' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Standard
                  </div>
                  <div
                    onClick={() => { setAuditMode('strict'); setIsAuditOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${auditMode === 'strict' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Strict Compliance
                  </div>
                  <div
                    onClick={() => { setAuditMode('training'); setIsAuditOpen(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded cursor-pointer ${auditMode === 'training' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Training Focus
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subheader Bar with Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="text-[12px] text-gray-600 leading-[1.4]">
            Manage permissions across {rolesList.length} roles for {CAPABILITIES.length} capabilities • System column is grantless (no permissions)
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Granted Intersects */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
              <span className="w-3 h-3 rounded-full bg-[#22c55e] flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              Granted Intersects {stats.totalChecks} / {stats.totalCells}
            </span>

            {/* Audit Violations */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
              <span className="text-[10px]">⚠</span> Audit Violations {stats.violations} detected
            </span>

            {/* Restricted Entities */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-semibold">
              <span className="text-[10px]">◈</span> Restricted Entities {rolesList.length} roles
            </span>
          </div>
        </div>

        {/* Matrix Container */}
        <div className="rounded-[12px] bg-[#1e1e1e] border border-[#2a2a2a] overflow-hidden shadow-2xl">
          <div className="px-4 py-2.5 border-b border-[#2a2a2a] bg-[#1e1e1e]">
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6b7280]">
              FEATURE / CAPABILITIES
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[980px] border-collapse text-[11px]">
              <colgroup>
                <col style={{ width: '28%' }} />
                {visibleRoles.map(role => (
                  <col key={role.id} style={{ width: `${72 / visibleRoles.length}%` }} />
                ))}
              </colgroup>

              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="p-0" />
                  {visibleRoles.map(role => (
                    <th
                      key={role.id}
                      className="text-center py-3 px-2 align-top border-l border-[#2a2a2a]/50 first:border-l-0"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="text-[11px] font-semibold text-white leading-tight whitespace-nowrap">
                          {role.label}
                        </div>
                        <div className="text-[10px] text-[#6b7280] font-normal leading-tight">
                          ({role.key})
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {['ACCESS', 'TEMPLATE', 'DOCUMENT', 'TRAINING'].map(groupKey => {
                  const group = GROUP_CONFIG[groupKey];
                  const count = groupCounts[groupKey];
                  const groupItems = CAPABILITIES.filter(c => c.group === groupKey);

                  return (
                    <React.Fragment key={`group-sec-${groupKey}`}>
                      {/* Group Header Banner */}
                      <tr className="bg-[#1a1a1a] border-y border-[#2a2a2a]">
                        <td colSpan={visibleRoles.length + 1} className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border"
                              style={{ background: group.bg, borderColor: group.border, color: group.color }}
                            >
                              {group.icon}
                            </div>
                            <span className="text-[11px] font-bold tracking-wide" style={{ color: group.color }}>
                              {group.label}
                            </span>
                            <span className="text-[10px] text-[#6b7280] ml-2">
                              {count} rows
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Capabilities Rows */}
                      {groupItems.map(capability => {
                        const rowIdx = CAPABILITIES.indexOf(capability);

                        return (
                          <tr
                            key={capability.id}
                            className="border-b border-[#2a2a2a]/60 hover:bg-[#252525] transition-colors"
                          >
                            {/* Capability Label & Detail */}
                            <td className="py-[9px] px-4 align-top text-left">
                              <div className="flex flex-col gap-[2px]">
                                <div className="flex items-baseline gap-1 flex-wrap">
                                  <span className="text-[11px] font-semibold text-white leading-tight">
                                    {capability.label}
                                  </span>
                                  <span className="text-[10px] text-[#6b7280] font-normal">
                                    / {capability.level || 'System Level'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#6b7280] leading-[1.3] line-clamp-2">
                                  {capability.detail}
                                </div>

                                {capability.invited && (
                                  <span className="mt-1 inline-flex w-fit px-1.5 py-0.5 rounded-[4px] bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.2)] text-[9px] text-[#60a5fa]">
                                    Invited Only • dropdown
                                  </span>
                                )}

                                {capability.id === 'temp_view_row' && (
                                  <span className="mt-1 inline-flex w-fit px-1.5 py-0.5 rounded-[4px] bg-[rgba(234,179,8,0.15)] border border-[rgba(234,179,8,0.2)] text-[9px] text-[#facc15]">
                                    visitor/auditor • 1-8h • expires_at
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Role Cells */}
                            {visibleRoles.map(role => {
                              const colIdx = rolesList.findIndex(r => r.id === role.id);
                              const isGranted = matrix[rowIdx]?.[colIdx] || false;
                              const isChanged = matrix[rowIdx]?.[colIdx] !== savedMatrix[rowIdx]?.[colIdx];
                              const isLocked = role.id === 'system';

                              return (
                                <td
                                  key={role.id}
                                  className="py-[9px] px-2 text-center align-middle border-l border-[#2a2a2a]/40 first:border-l-0"
                                >
                                  <CheckmarkIcon
                                    granted={isGranted}
                                    isChanged={isChanged}
                                    isLocked={isLocked}
                                    onClick={() => handleToggleCell(rowIdx, role.id)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="mt-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 px-1">
          {/* Unsaved indicator */}
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            {unsavedCount === 0 ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-[#22c55e] flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                No unsaved changes
              </>
            ) : (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center text-zinc-950 font-bold text-[9px]">
                  •
                </span>
                <span className="text-amber-600 font-semibold">
                  {unsavedCount} unsaved change{unsavedCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk Scan */}
            <button
              type="button"
              onClick={() => {
                setAuditMode('strict');
                showNotice('Risk Scan completed');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a4 4 0 014 4" stroke="#4b5563" strokeWidth="1.2" />
              </svg>
              Risk Scan
            </button>

            {/* Matrix Templates */}
            <button
              type="button"
              onClick={() => showNotice('Matrix Templates opened')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#4b5563" strokeWidth="1.2" />
                <path d="M5 5h6M5 8h6M5 11h4" stroke="#4b5563" strokeWidth="1.1" />
              </svg>
              Matrix Templates
            </button>

            {/* Elevate Admin */}
            <button
              type="button"
              onClick={handleElevateAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l1.5 3.5L13 7l-2.5 2.5.5 4L8 11.5 5 13.5l.5-4L3 7l3.5-1.5L8 2z" stroke="#4b5563" strokeWidth="1.1" fill="none" />
              </svg>
              Elevate Admin
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1 hidden lg:block" />

            {/* Revert to Default */}
            <button
              type="button"
              onClick={handleRevert}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-gray-300 text-gray-700 text-[11px] font-medium hover:bg-gray-50 shadow-sm transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M8 3l5 5-5 5" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 8 8)" />
              </svg>
              Revert to Default
            </button>

            {/* Save Changes */}
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#22c55e] border border-[#22c55e] text-white text-[11px] font-semibold hover:bg-[#16a34a] transition-colors shadow-md"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 8.5l2.5 2.5L12 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="1" opacity="0.3" />
              </svg>
              Save Changes
            </button>
          </div>
        </div>

        {/* The White Forms Below the Matrix */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* Create a Custom Role Card */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Create a custom role</h2>
            <Form form={createForm} layout="vertical" onFinish={handleCreateRole} className="mt-3">
              <Form.Item
                name="name"
                label="Role name"
                rules={[{ required: true, whitespace: true, max: 120, message: 'Please enter a role name.' }]}
              >
                <Input maxLength={120} placeholder="e.g. Regional Reviewer" />
              </Form.Item>

              <Form.Item name="description" label="Description">
                <Input.TextArea rows={2} maxLength={500} placeholder="Role description and scope" />
              </Form.Item>

              <Form.Item
                name="permissions"
                label="Permissions"
                rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one permission.' }]}
              >
                <Checkbox.Group className="w-full">
                  <div className="grid gap-3 sm:grid-cols-2 max-h-[360px] overflow-y-auto pr-1">
                    {Object.entries(catalogByResource).map(([resource, perms]) => (
                      <div key={resource} className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                        <div className="text-sm font-medium capitalize text-gray-800">
                          {resource.replace(/_/g, ' ')}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {perms.map(permission => (
                            <Checkbox key={permission.key} value={permission.key}>
                              {permission.action}
                            </Checkbox>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Checkbox.Group>
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={savingForm} className="bg-blue-600">
                Create role
              </Button>
            </Form>
          </section>

          {/* Assign a Role to a User Card */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Assign a role to a user</h2>
            <p className="mt-1 text-sm text-gray-500">
              This updates permissions only. It does not change the user&apos;s password or login.
            </p>

            <Form form={assignForm} layout="vertical" onFinish={handleAssign} className="mt-3">
              <Form.Item name="organizationId" label="Organization" rules={[{ required: true, message: 'Please select an organization.' }]}>
                <Select
                  placeholder="Select an organization"
                  onChange={handleOrgChange}
                  options={organizations.map(org => ({ value: org.id, label: org.name }))}
                />
              </Form.Item>

              <Form.Item name="userId" label="User" rules={[{ required: true, message: 'Please select a user.' }]}>
                <Select
                  placeholder="Select a user"
                  disabled={!users.length}
                  options={users.map(user => ({
                    value: user.id,
                    label: `${user.first_name} ${user.last_name} (${user.email})`
                  }))}
                />
              </Form.Item>

              <Form.Item name="roleId" label="Role" rules={[{ required: true, message: 'Please select a role.' }]}>
                <Select
                  placeholder="Select a role"
                  options={rolesList.map(role => ({ value: role.id, label: role.label || role.name }))}
                />
              </Form.Item>

              {assigningTemporary && (
                <Form.Item
                  name="expiresIn"
                  label="Temporary access duration"
                  rules={[{ required: true, message: 'Please select duration.' }]}
                >
                  <Select
                    placeholder="Select duration"
                    options={[
                      { value: '1h', label: '1 hour' },
                      { value: '4h', label: '4 hours' }
                    ]}
                  />
                </Form.Item>
              )}

              <Button type="primary" htmlType="submit" loading={savingForm} className="bg-blue-600">
                Assign role
              </Button>
            </Form>

            <h3 className="mt-6 text-sm font-semibold text-gray-900">Roles in this matrix</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 max-h-[160px] overflow-y-auto pr-1">
              {rolesList.map(role => {
                const colIdx = rolesList.findIndex(r => r.id === role.id);
                const count = colIdx !== -1 ? stats.perRole[colIdx] : 0;
                return (
                  <li key={role.id} className="flex justify-between gap-3 py-0.5 border-b border-gray-100 last:border-b-0">
                    <span>{role.label || role.name}</span>
                    <span className="text-gray-400">
                      {role.is_system ? 'Built-in' : 'Custom'} · {count} permissions
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Footer Audit Summary */}
        <div className="mt-8 text-center text-[10px] text-gray-500">
          Watermelon Training Integra • RBAC matrix • {rolesList.length} roles • {CAPABILITIES.length} rows (ACCESS {groupCounts.ACCESS} • TEMPLATE {groupCounts.TEMPLATE} • DOCUMENT {groupCounts.DOCUMENT} • TRAINING {groupCounts.TRAINING}) • {stats.totalChecks}/{stats.totalCells} granted • Inter 11px • Green checks #22c55e
        </div>

      </div>
    </div>
  );
}

export default function RbacDashboardPage() {
  return (
    <MainLayout showSearch={false} fullWidth={true}>
      <RbacDashboardContent />
    </MainLayout>
  );
}
