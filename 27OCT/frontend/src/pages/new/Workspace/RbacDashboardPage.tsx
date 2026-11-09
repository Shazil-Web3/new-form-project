import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input, message, Select, Spin } from 'antd';
import MainLayout from '../../../components/new/tailwind/MainLayout';
import {
  assignUserRbacRole,
  createRbacRole,
  getMyRbac,
  getRbacMatrix,
  listRbacPermissions,
  revertRbacToDefault,
  setRbacRolePermissions
} from '../../../api/rbac';
import {
  listRbacOrganizations,
  listRbacUsers
} from '../../../api/rbac';

const RESTRICTED_KEYS = ['view_only', 'temporary_view'];
const LOCKED_ROLE_KEYS = ['super_admin'];

function isGranted(permissionList, group) {
  const granted = new Set(permissionList || []);
  return group.permissions.some(key =>
    granted.has(key) || granted.has(`${key.split('.')[0]}.manage`)
  );
}

function samePermissions(a, b) {
  const left = new Set(a || []);
  const right = new Set(b || []);
  if (left.size !== right.size) return false;
  return [...left].every(key => right.has(key));
}

function GrantedMark({ changed }) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-500/15 ${
      changed ? 'ring-2 ring-amber-400' : ''}`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-emerald-950">
        ✓
      </span>
    </span>
  );
}

function DeniedMark({ risk, changed }) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${
      risk ? 'bg-amber-500/10' : 'bg-white/[0.03]'} ${changed ? 'ring-2 ring-amber-400' : ''}`}
    >
      <span className={`inline-flex h-5 w-5 rounded-full border-2 ${
        risk ? 'border-amber-400/70' : 'border-zinc-600'}`}
      />
    </span>
  );
}

export function RbacDashboardContent() {
  const [matrix, setMatrix] = useState<any>(null);
  const [draft, setDraft] = useState<any>({});
  const [catalog, setCatalog] = useState([]);
  const [myRbac, setMyRbac] = useState<any>(null);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [perspective, setPerspective] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const selectedAssignRoleId = Form.useWatch('roleId', assignForm);

  const applyMatrix = (matrixData) => {
    setMatrix(matrixData);
    setDraft(JSON.parse(JSON.stringify(matrixData.permissionsByRole || {})));
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [matrixData, permissionData, me, orgs] = await Promise.all([
        getRbacMatrix(),
        listRbacPermissions(),
        getMyRbac(),
        listRbacOrganizations()
      ]);
      applyMatrix(matrixData);
      setCatalog(permissionData);
      setMyRbac(me);
      setOrganizations(orgs);
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to load RBAC data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const visibleRoles = useMemo(() => {
    if (!matrix) return [];
    return roleFilter === 'all'
      ? matrix.roles
      : matrix.roles.filter(role => String(role.id) === String(roleFilter));
  }, [matrix, roleFilter]);

  const dirtyRoleKeys = useMemo(() => {
    if (!matrix) return [];
    return matrix.roles
      .filter(role => !LOCKED_ROLE_KEYS.includes(role.role_key))
      .filter(role => !samePermissions(draft[role.role_key], matrix.permissionsByRole[role.role_key]))
      .map(role => role.role_key);
  }, [matrix, draft]);

  const changedCellKeys = useMemo(() => {
    const changed = new Set();
    if (!matrix) return changed;
    for (const role of matrix.roles) {
      if (LOCKED_ROLE_KEYS.includes(role.role_key)) continue;
      for (const row of matrix.rows) {
        const before = isGranted(matrix.permissionsByRole[role.role_key], row);
        const after = isGranted(draft[role.role_key], row);
        if (before !== after) changed.add(`${role.role_key}:${row.key}`);
      }
    }
    return changed;
  }, [matrix, draft]);

  const localStats = useMemo(() => {
    if (!matrix) return { granted: 0, total: 0, restrictedRoles: 0 };
    let granted = 0;
    for (const row of matrix.rows) {
      for (const role of matrix.roles) {
        if (isGranted(draft[role.role_key], row)) granted += 1;
      }
    }
    const restrictedRoles = matrix.roles.filter(role =>
      !matrix.rows.every(row => isGranted(draft[role.role_key], row))
    ).length;
    return { granted, total: matrix.rows.length * matrix.roles.length, restrictedRoles };
  }, [matrix, draft]);

  const auditViolations = useMemo(() => {
    if (!matrix) return 0;
    let count = 0;
    for (const row of matrix.rows) {
      if (row.key === 'temp_view') continue;
      for (const role of matrix.roles) {
        if (RESTRICTED_KEYS.includes(role.role_key) && isGranted(draft[role.role_key], row)) {
          count += 1;
        }
      }
    }
    return count;
  }, [matrix, draft]);

  const catalogByResource = useMemo(() => catalog.reduce((grouped, permission) => {
    grouped[permission.resource] = grouped[permission.resource] || [];
    grouped[permission.resource].push(permission);
    return grouped;
  }, {}), [catalog]);

  const assigningTemporary = matrix?.roles.some(role =>
    String(role.id) === String(selectedAssignRoleId) && role.role_key === 'temporary_view'
  );

  // Clicking a cell only edits the local draft. Nothing is sent to the
  // server until Save Changes is pressed.
  const toggleCell = (role, row) => {
    if (LOCKED_ROLE_KEYS.includes(role.role_key) || savingMatrix || reverting) return;
    setDraft(previous => {
      const current = new Set(previous[role.role_key] || []);
      if (isGranted([...current], row)) row.permissions.forEach(key => current.delete(key));
      else row.permissions.forEach(key => current.add(key));
      return { ...previous, [role.role_key]: [...current] };
    });
  };

  const discardChanges = () => {
    if (!matrix) return;
    setDraft(JSON.parse(JSON.stringify(matrix.permissionsByRole || {})));
    message.info('Unsaved matrix changes discarded.');
  };

  // Reset the live matrix to the approved default template saved in MySQL.
  // Persists server-side, so a reload still shows the default.
  const revertToDefault = async () => {
    if (savingMatrix || reverting) return;
    const confirmed = window.confirm(
      'Are you sure you want to revert to default? Unsaved changes will be lost.'
    );
    if (!confirmed) return;
    setReverting(true);
    try {
      const matrixData = await revertRbacToDefault();
      applyMatrix(matrixData);
      message.success('Matrix reverted to the approved default template.');
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to revert to default.');
    } finally {
      setReverting(false);
    }
  };

  const saveChanges = async () => {
    if (!dirtyRoleKeys.length) return;
    setSavingMatrix(true);
    try {
      for (const roleKey of dirtyRoleKeys) {
        const role = matrix.roles.find(item => item.role_key === roleKey);
        await setRbacRolePermissions(role.id, draft[roleKey] || []);
      }
      const matrixData = await getRbacMatrix();
      applyMatrix(matrixData);
      message.success(`Saved permissions for ${dirtyRoleKeys.length} role(s).`);
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to save matrix changes.');
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleCreateRole = async (values) => {
    setSaving(true);
    try {
      await createRbacRole(values);
      message.success('Custom role created.');
      createForm.resetFields();
      await loadAll();
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to create role.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (values) => {
    setSaving(true);
    try {
      await assignUserRbacRole(values.userId, {
        roleId: values.roleId,
        ...(assigningTemporary ? { expiresIn: values.expiresIn } : {})
      });
      message.success('Role assigned. The user keeps their existing login.');
      assignForm.resetFields(['userId', 'roleId', 'expiresIn']);
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to assign role.');
    } finally {
      setSaving(false);
    }
  };

  const handleOrgChange = async (orgId) => {
    assignForm.resetFields(['userId']);
    setUsers([]);
    if (!orgId) return;
    try {
      setUsers(await listRbacUsers(orgId));
    } catch (error) {
      message.error(error.response?.data?.error || 'Unable to load users.');
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <>
      {loading || !matrix ? (
        <div className="flex items-center justify-center py-24"><Spin size="large" /></div>
      ) : (
        <div className="w-full max-w-none space-y-5 py-4">
          <div className="rounded-2xl bg-[#17181d] p-5 text-zinc-200 shadow-xl sm:p-7">
            <p className="text-right text-xs text-zinc-400">{today}</p>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-zinc-100">
              Here is an interactive Role-Based Access Control (RBAC) Dashboard Matrix tool
              built using your specific spreadsheet rules to help you visual, manage, audit,
              and design your SaaS permissions.
            </p>
            {myRbac && (
              <p className="mt-3 text-xs text-zinc-400">
                Signed in as {myRbac.role}
                {myRbac.isSuperAdmin ? ' · Super Admin' : ''}
                {` · ${myRbac.permissions.length} permissions`}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Click any cell to grant or revoke it. Yellow-ringed cells are unsaved.
              Nothing changes on the server until you press Save Changes at the bottom.
              Super Admin always has full access, so its column is locked.
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="w-56 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Feature /<br />Capabilities
                    </th>
                    {visibleRoles.map(role => (
                      <th key={role.id} className="px-2 py-3 text-center">
                        <div className="truncate text-[13px] font-semibold text-zinc-100">
                          {role.name}
                          {dirtyRoleKeys.includes(role.role_key) && (
                            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
                          )}
                        </div>
                        <div className="mx-auto mt-1 w-fit max-w-[90px] truncate rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {role.role_key}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map(row => (
                    <tr key={row.key} className="border-b border-white/[0.06]">
                      <td className="px-3 py-3">
                        <div className="truncate text-[13px] font-semibold text-zinc-100">
                          {row.label}
                        </div>
                        <div className="text-[11px] text-zinc-500">{row.category}</div>
                      </td>
                      {visibleRoles.map(role => {
                        const granted = isGranted(draft[role.role_key], row);
                        const changed = changedCellKeys.has(`${role.role_key}:${row.key}`);
                        const risky = perspective === 'risk' && !granted &&
                          (draft[role.role_key] || []).length > 0;
                        const mark = granted
                          ? <GrantedMark changed={changed} />
                          : <DeniedMark risk={risky} changed={changed} />;
                        const locked = LOCKED_ROLE_KEYS.includes(role.role_key);
                        return (
                          <td key={role.id} className="px-2 py-2 text-center">
                            {locked ? (
                              <span title="Super Admin always has full access">{mark}</span>
                            ) : (
                              <button
                                type="button"
                                aria-pressed={granted}
                                aria-label={`${row.label} for ${role.name}: ${granted ? 'granted' : 'denied'}. Click to change.`}
                                title={`Click to ${granted ? 'revoke' : 'grant'} ${row.label} for ${role.name}`}
                                disabled={savingMatrix || reverting}
                                onClick={() => toggleCell(role, row)}
                                className="rounded-[10px] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                              >
                                {mark}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-3 border-b border-white/10 py-4 text-center">
              <div>
                <div className="text-[11px] text-zinc-400">Granted Intersects</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  {localStats.granted} / {localStats.total}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Audit Violations</div>
                <div className={`mt-1 text-sm font-semibold ${
                  auditViolations ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {auditViolations ? `${auditViolations} detected` : '0 detected'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Restricted Entities</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  {localStats.restrictedRoles} roles
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-300">Filter Matrix View</span>
                <Select
                  value={roleFilter}
                  onChange={setRoleFilter}
                  className="min-w-[170px]"
                  options={[
                    { value: 'all', label: 'All Roles' },
                    ...matrix.roles.map(role => ({ value: role.id, label: role.name }))
                  ]}
                />
              </label>
              <div>
                <span className="mb-1.5 block text-xs text-zinc-300">Audit Perspective</span>
                <div className="flex rounded-lg bg-white/[0.06] p-1">
                  {['standard', 'risk'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPerspective(mode)}
                      className={`rounded-md px-4 py-1.5 text-xs font-semibold capitalize ${
                        perspective === mode
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:text-white'}`}
                    >
                      {mode === 'risk' ? 'Risk Scan' : 'Standard'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-xs text-zinc-300">Matrix Templates</span>
                <div className="flex gap-2">
                  <Button onClick={discardChanges} disabled={!dirtyRoleKeys.length || savingMatrix}>
                    Reset Defaults
                  </Button>
                  <Button onClick={() => {
                    const admin = matrix.roles.find(r => r.role_key === 'org_admin');
                    if (admin) setRoleFilter(admin.id);
                  }}>
                    Elevate Admin
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-3">
              <p className="text-sm text-zinc-300" role="status">
                {dirtyRoleKeys.length
                  ? `${changedCellKeys.size} unsaved change(s) across ${dirtyRoleKeys.length} role(s)`
                  : 'No unsaved changes'}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={discardChanges}
                  disabled={!dirtyRoleKeys.length || savingMatrix || reverting}
                >
                  Discard
                </Button>
                <Button
                  loading={reverting}
                  disabled={savingMatrix || reverting}
                  onClick={revertToDefault}
                >
                  Revert to Default
                </Button>
                <Button
                  type="primary"
                  size="large"
                  loading={savingMatrix}
                  disabled={!dirtyRoleKeys.length || reverting}
                  onClick={saveChanges}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">Create a custom role</h2>
              <Form form={createForm} layout="vertical" onFinish={handleCreateRole} className="mt-3">
                <Form.Item
                  name="name"
                  label="Role name"
                  rules={[{ required: true, whitespace: true, max: 120 }]}
                >
                  <Input maxLength={120} placeholder="e.g. Regional Reviewer" />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input.TextArea rows={2} maxLength={500} />
                </Form.Item>
                <Form.Item
                  name="permissions"
                  label="Permissions"
                  rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one permission.' }]}
                >
                  <Checkbox.Group className="w-full">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(catalogByResource).map(([resource, perms]: [string, any]) => (
                        <div key={resource} className="rounded-lg border border-gray-200 p-3">
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
                <Button type="primary" htmlType="submit" loading={saving}>
                  Create role
                </Button>
              </Form>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">Assign a role to a user</h2>
              <p className="mt-1 text-sm text-gray-500">
                This updates permissions only. It does not change the user&apos;s password or login.
              </p>
              <Form form={assignForm} layout="vertical" onFinish={handleAssign} className="mt-3">
                <Form.Item name="organizationId" label="Organization" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select an organization"
                    onChange={handleOrgChange}
                    options={organizations.map(org => ({ value: org.id, label: org.name }))}
                  />
                </Form.Item>
                <Form.Item name="userId" label="User" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select a user"
                    disabled={!users.length}
                    options={users.map(user => ({
                      value: user.id,
                      label: `${user.first_name} ${user.last_name} (${user.email})`
                    }))}
                  />
                </Form.Item>
                <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select a role"
                    options={matrix.roles.map(role => ({ value: role.id, label: role.name }))}
                  />
                </Form.Item>
                {assigningTemporary && (
                  <Form.Item
                    name="expiresIn"
                    label="Temporary access duration"
                    rules={[{ required: true }]}
                  >
                    <Select options={[
                      { value: '1h', label: '1 hour' },
                      { value: '4h', label: '4 hours' }
                    ]} />
                  </Form.Item>
                )}
                <Button type="primary" htmlType="submit" loading={saving}>
                  Assign role
                </Button>
              </Form>

              <h3 className="mt-6 text-sm font-semibold text-gray-900">Roles in this matrix</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {matrix.roles.map(role => (
                  <li key={role.id} className="flex justify-between gap-3">
                    <span>{role.name}</span>
                    <span className="text-gray-400">
                      {role.is_system ? 'Built-in' : 'Custom'} ·{' '}
                      {(draft[role.role_key] || []).length} permissions
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export default function RbacDashboardPage() {
  return (
    <MainLayout showSearch={false}>
      <RbacDashboardContent />
    </MainLayout>
  );
}
