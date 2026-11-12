/**
 * @file RbacDashboardPage.jsx
 * @description Role-Based Access Control — Permission Matrix & Management Forms.
 * Features the bold dark permission matrix from Rbac-Matrix-Temp-View.html
 * together with the Custom Role Creation & User-Role Assignment forms below.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Button, Form, Input, message, Select } from 'antd';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import { toastAlert } from '../../../utils/alerts';
import {
  listRbacOrganizations,
  listRbacUsers,
  createRbacRole,
  assignUserRbacRole
} from '../../../api/rbac';
import {
  INITIAL_ROLES,
  INITIAL_MATRIX,
  CAPABILITIES,
  GROUP_CONFIG,
  STORAGE_KEY_MATRIX,
  STORAGE_KEY_ROLES
} from '../../../utils/rbacConstants';

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
  const [notice, setNotice] = useState(null);

  // Forms state
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [savingForm, setSavingForm] = useState(false);

  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const selectedAssignRoleId = Form.useWatch('roleId', assignForm);

  // Load organizations on mount
  useEffect(() => {
    async function initFormData() {
      try {
        const orgs = await listRbacOrganizations();
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

  // All roles are visible across the matrix
  const visibleRoles = rolesList;

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
      // Automatically save to localStorage and broadcast change immediately across all app views
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_MATRIX, JSON.stringify(next));
          window.localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(rolesList));
          window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
        }
      } catch (e) {}
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

    // Single clean standard toast
    toastAlert('Matrix changes saved successfully!', 'success');
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

    toastAlert('Matrix reverted to default.', 'info');
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
      const created = await createRbacRole({
        name: values.name,
        description: values.description || '',
        permissions: []
      });
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

      // Add a clean column to each row of the matrix for the custom role
      const updatedMatrix = matrix.map(row => [...row, false]);
      const updatedSavedMatrix = savedMatrix.map(row => [...row, false]);
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
          <section className="rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Create a custom role</h2>
              <p className="mt-1 text-sm text-gray-500">
                Define a new role name and description. Once created, you can configure its capabilities directly in the matrix above.
              </p>

              <Form form={createForm} layout="vertical" onFinish={handleCreateRole} className="mt-4">
                <Form.Item
                  name="name"
                  label="Role name"
                  rules={[{ required: true, whitespace: true, max: 120, message: 'Please enter a role name.' }]}
                >
                  <Input maxLength={120} placeholder="e.g. Regional Reviewer" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                  <Input.TextArea rows={3} maxLength={500} placeholder="Role description and scope" />
                </Form.Item>

                <div className="pt-2">
                  <Button type="primary" htmlType="submit" loading={savingForm} className="bg-blue-600">
                    Create role
                  </Button>
                </div>
              </Form>
            </div>
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
