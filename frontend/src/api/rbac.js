/**
 * @file rbac.js
 * @description Frontend client-side RBAC Mock Service & API layer.
 * Mirrors the reference RBAC contracts for standalone frontend functionality.
 */

const STORAGE_KEY = 'watermelon_rbac_matrix_v1';

const DEFAULT_ROLES = [
  { id: 1, role_key: 'system', name: 'System', description: 'System account approval permission from the access matrix.', is_system: true },
  { id: 2, role_key: 'org_admin', name: 'Admin', description: 'Administrator permissions defined by the access matrix.', is_system: true },
  { id: 3, role_key: 'author', name: 'Author', description: 'Author permissions defined by the access matrix.', is_system: true },
  { id: 4, role_key: 'review_approval', name: 'Approver/Reviewer', description: 'Review and approval permissions defined by the access matrix.', is_system: true },
  { id: 5, role_key: 'project_manager', name: 'Project Manager', description: 'Project manager permissions defined by the access matrix.', is_system: true },
  { id: 6, role_key: 'people_manager', name: 'People Manager', description: 'People manager permissions defined by the access matrix.', is_system: true },
  { id: 7, role_key: 'view_only', name: 'View', description: 'View permissions defined by the access matrix.', is_system: true },
  { id: 8, role_key: 'temporary_view', name: 'Temp View', description: 'Temporary view permissions with one-hour or four-hour expiry.', is_system: true },
  { id: 9, role_key: 'super_admin', name: 'Super Admin', description: 'Platform-wide administration and RBAC management.', is_system: true }
];

const DEFAULT_FEATURE_GROUPS = [
  { key: 'create_template', label: 'Create Template', category: 'Content Operations', permissions: ['templates.create'] },
  { key: 'create_document', label: 'Create Document', category: 'Content Operations', permissions: ['documents.create'] },
  { key: 'review', label: 'Review', category: 'Content Operations', permissions: ['documents.review', 'templates.review'] },
  { key: 'comment', label: 'Comment', category: 'Content Operations', permissions: ['documents.comment'] },
  { key: 'approval', label: 'Approval', category: 'Content Operations', permissions: ['documents.approve', 'templates.approve'] },
  { key: 'create_personal_account', label: 'Create Personal Account', category: 'System Level', permissions: ['users.create_personal_account'] },
  { key: 'approve_account', label: 'Approve Account', category: 'System Level', permissions: ['users.approve'] },
  { key: 'view_personal_calendar', label: 'View Personal Calendar', category: 'System Level', permissions: ['calendar.view_personal'] },
  { key: 'view_other_calendar', label: 'View Other Calendar', category: 'System Level', permissions: ['calendar.view_others'] },
  { key: 'reset_password', label: 'Reset Password', category: 'System Level', permissions: ['users.reset_password'] },
  { key: 'site_creation', label: 'Site Creation', category: 'System Level', permissions: ['organizations.site_create'] },
  { key: 'folder_access', label: 'Full/Partial Folder Access', category: 'System Level', permissions: ['folders.access'] },
  { key: 'file_access', label: 'File (Document) Access', category: 'Analytics & Access', permissions: ['documents.file_access'] },
  { key: 'audit_trail', label: 'Audit Trail', category: 'Analytics & Access', permissions: ['audit.view'] },
  { key: 'report_generation', label: 'Report Generation', category: 'Analytics & Access', permissions: ['reports.generate'] },
  { key: 'obsolete_template', label: 'Obsoleting Template', category: 'Content Operations', permissions: ['templates.obsolete'] },
  { key: 'obsolete_document', label: 'Obsoleting Document', category: 'Content Operations', permissions: ['documents.obsolete'] },
  { key: 'delete_draft_template', label: 'Delete Draft Template', category: 'Content Operations', permissions: ['templates.delete_draft'] },
  { key: 'reassign_own', label: 'Re-assign Own Tasks', category: 'Content Operations', permissions: ['tasks.reassign_own'] },
  { key: 'reassign_others', label: 'Re-assign Tasks to Others', category: 'Content Operations', permissions: ['tasks.reassign_others'] },
  { key: 'account_management_tab', label: 'Account Management Tab Access', category: 'System Level', permissions: ['users.account_management_tab'] },
  { key: 'training_admin', label: 'Training Admin Access', category: 'Training', permissions: ['training.admin'] },
  { key: 'training_classes', label: 'Classes', category: 'Training', permissions: ['training.classes'] },
  { key: 'temp_view', label: 'Temp View', category: 'Read-Only', permissions: ['documents.view', 'documents.file_access'] }
];

const DEFAULT_PERMISSIONS_BY_ROLE = {
  system: [],
  org_admin: [
    'audit.view', 'billing.manage', 'billing.view', 'calendar.view', 'calendar.view_others',
    'calendar.view_personal', 'documents.approve', 'documents.comment', 'documents.create',
    'documents.obsolete', 'documents.review', 'documents.view', 'folders.access',
    'organizations.site_create', 'reports.generate', 'tasks.reassign_others', 'tasks.reassign_own',
    'templates.create', 'templates.delete_draft', 'templates.obsolete', 'training.admin',
    'training.classes', 'training.view', 'users.account_management_tab', 'users.approve',
    'users.create_personal_account', 'users.manage', 'users.reset_password', 'users.view'
  ],
  author: [
    'calendar.view', 'calendar.view_personal', 'documents.approve', 'documents.comment',
    'documents.create', 'documents.obsolete', 'documents.review', 'documents.view',
    'folders.access', 'reports.generate', 'tasks.reassign_own', 'templates.delete_draft',
    'training.classes', 'training.view', 'users.create_personal_account', 'users.reset_password'
  ],
  review_approval: [
    'calendar.view', 'calendar.view_personal', 'documents.approve', 'documents.comment',
    'documents.review', 'documents.view', 'folders.access', 'reports.generate',
    'training.classes', 'training.view', 'users.create_personal_account', 'users.reset_password'
  ],
  project_manager: [
    'calendar.view', 'calendar.view_others', 'calendar.view_personal', 'documents.view',
    'folders.access', 'reports.generate', 'tasks.reassign_others', 'tasks.reassign_own',
    'training.classes', 'training.view', 'users.create_personal_account', 'users.reset_password'
  ],
  people_manager: [
    'calendar.view', 'calendar.view_others', 'calendar.view_personal', 'documents.view',
    'folders.access', 'reports.generate', 'tasks.reassign_others', 'tasks.reassign_own',
    'training.classes', 'training.view', 'users.create_personal_account', 'users.reset_password'
  ],
  view_only: [
    'documents.view', 'folders.access', 'training.classes', 'training.view',
    'users.create_personal_account', 'users.reset_password'
  ],
  temporary_view: [
    'documents.file_access', 'documents.view'
  ],
  super_admin: [
    'access_levels.create', 'access_levels.delete', 'access_levels.edit', 'access_levels.manage', 'access_levels.view',
    'audit.export', 'audit.manage', 'audit.view', 'billing.manage', 'billing.view',
    'calendar.create', 'calendar.delete', 'calendar.edit', 'calendar.view', 'calendar.view_others', 'calendar.view_personal',
    'documents.approve', 'documents.comment', 'documents.create', 'documents.delete', 'documents.edit', 'documents.export',
    'documents.file_access', 'documents.manage', 'documents.obsolete', 'documents.review', 'documents.view',
    'folders.access', 'numbering.create', 'numbering.delete', 'numbering.edit', 'numbering.manage', 'numbering.view',
    'organizations.create', 'organizations.delete', 'organizations.edit', 'organizations.manage', 'organizations.site_create', 'organizations.view',
    'references.create', 'references.delete', 'references.edit', 'references.view', 'reports.generate',
    'tasks.create', 'tasks.delete', 'tasks.edit', 'tasks.manage', 'tasks.reassign_others', 'tasks.reassign_own', 'tasks.view',
    'templates.approve', 'templates.comment', 'templates.create', 'templates.delete', 'templates.delete_draft', 'templates.edit',
    'templates.export', 'templates.manage', 'templates.obsolete', 'templates.review', 'templates.view',
    'training.admin', 'training.approve', 'training.classes', 'training.create', 'training.delete', 'training.edit',
    'training.manage', 'training.review', 'training.view', 'users.account_management_tab', 'users.approve', 'users.create',
    'users.create_personal_account', 'users.delete', 'users.edit', 'users.manage', 'users.reset_password', 'users.view',
    'workspace.create', 'workspace.delete', 'workspace.edit', 'workspace.view'
  ]
};

const FEATURE_CATALOG = {
  documents: ['view', 'create', 'edit', 'delete', 'review', 'comment', 'approve', 'export', 'file_access', 'obsolete', 'manage'],
  templates: ['view', 'create', 'edit', 'delete', 'review', 'comment', 'approve', 'export', 'obsolete', 'delete_draft', 'manage'],
  users: ['view', 'create', 'edit', 'delete', 'manage', 'create_personal_account', 'approve', 'reset_password', 'account_management_tab'],
  organizations: ['view', 'create', 'edit', 'delete', 'manage', 'site_create'],
  folders: ['access'],
  reports: ['generate'],
  training: ['view', 'create', 'edit', 'delete', 'review', 'approve', 'admin', 'classes', 'manage'],
  references: ['view', 'create', 'edit', 'delete'],
  numbering: ['view', 'create', 'edit', 'delete', 'manage'],
  tasks: ['view', 'create', 'edit', 'delete', 'manage', 'reassign_own', 'reassign_others'],
  calendar: ['view', 'create', 'edit', 'delete', 'view_personal', 'view_others'],
  audit: ['view', 'export', 'manage'],
  workspace: ['view', 'create', 'edit', 'delete'],
  billing: ['view', 'manage'],
  access_levels: ['view', 'create', 'edit', 'delete', 'manage']
};

const DEFAULT_CATALOG_PERMISSIONS = Object.entries(FEATURE_CATALOG).flatMap(([resource, actions]) =>
  actions.map(action => ({
    key: `${resource}.${action}`,
    permission_key: `${resource}.${action}`,
    resource,
    action
  }))
);

const MOCK_ORGANIZATIONS = [
  { id: 1, name: 'Watermelon Technologies HQ' },
  { id: 2, name: 'Global Pharma Operations' },
  { id: 3, name: 'BioTech Clinical Systems' }
];

const MOCK_USERS_BY_ORG = {
  1: [
    { id: 101, first_name: 'John', last_name: 'Doe', email: 'john.doe@watermelon.io', role: 'admin', organization_id: 1 },
    { id: 102, first_name: 'Alice', last_name: 'Smith', email: 'alice.smith@watermelon.io', role: 'author', organization_id: 1 },
    { id: 103, first_name: 'Robert', last_name: 'Johnson', email: 'robert.j@watermelon.io', role: 'reviewer', organization_id: 1 },
    { id: 104, first_name: 'Emily', last_name: 'Davis', email: 'emily.d@watermelon.io', role: 'viewer', organization_id: 1 }
  ],
  2: [
    { id: 201, first_name: 'Michael', last_name: 'Brown', email: 'michael.b@globalpharma.com', role: 'author', organization_id: 2 },
    { id: 202, first_name: 'Sarah', last_name: 'Wilson', email: 'sarah.w@globalpharma.com', role: 'reviewer', organization_id: 2 }
  ],
  3: [
    { id: 301, first_name: 'David', last_name: 'Miller', email: 'david.m@biotech.com', role: 'admin', organization_id: 3 }
  ]
};

// In-Memory & LocalStorage State Manager
function getInitialState() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roles && parsed.permissionsByRole) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved RBAC state from localStorage', e);
  }

  return {
    roles: JSON.parse(JSON.stringify(DEFAULT_ROLES)),
    rows: JSON.parse(JSON.stringify(DEFAULT_FEATURE_GROUPS)),
    permissionsByRole: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE)),
    usersByOrg: JSON.parse(JSON.stringify(MOCK_USERS_BY_ORG))
  };
}

let rbacState = getInitialState();

function persistState() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rbacState));
    }
  } catch (e) {
    console.warn('Failed to persist RBAC state to localStorage', e);
  }
}

// Micro delay for realistic async reactivity
const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

export const getMyRbac = async () => {
  await delay();
  return {
    role: 'Admin',
    role_key: 'org_admin',
    isSuperAdmin: true,
    permissions: rbacState.permissionsByRole.super_admin || []
  };
};

export const checkRbacPermission = async (resource, action) => {
  await delay(50);
  const key = `${resource}.${action}`;
  const granted = (rbacState.permissionsByRole.org_admin || []).includes(key);
  return { allowed: granted };
};

export const listRbacRoles = async () => {
  await delay();
  return JSON.parse(JSON.stringify(rbacState.roles));
};

export const listRbacPermissions = async () => {
  await delay();
  return JSON.parse(JSON.stringify(DEFAULT_CATALOG_PERMISSIONS));
};

export const getRbacMatrix = async () => {
  await delay();
  return {
    roles: JSON.parse(JSON.stringify(rbacState.roles)),
    rows: JSON.parse(JSON.stringify(rbacState.rows)),
    permissionsByRole: JSON.parse(JSON.stringify(rbacState.permissionsByRole))
  };
};

export const getRbacDefault = async () => {
  await delay();
  return {
    roles: JSON.parse(JSON.stringify(DEFAULT_ROLES)),
    rows: JSON.parse(JSON.stringify(DEFAULT_FEATURE_GROUPS)),
    permissionsByRole: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE))
  };
};

export const getAssignableRbacRoles = async () => {
  await delay();
  return JSON.parse(JSON.stringify(rbacState.roles.filter(r => r.role_key !== 'super_admin')));
};

export const revertRbacToDefault = async () => {
  await delay(180);
  rbacState = {
    roles: JSON.parse(JSON.stringify(DEFAULT_ROLES)),
    rows: JSON.parse(JSON.stringify(DEFAULT_FEATURE_GROUPS)),
    permissionsByRole: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE)),
    usersByOrg: JSON.parse(JSON.stringify(MOCK_USERS_BY_ORG))
  };
  persistState();
  return getRbacMatrix();
};

export const saveRbacMatrix = async (permissionsByRole) => {
  await delay(150);
  rbacState.permissionsByRole = {
    ...rbacState.permissionsByRole,
    ...permissionsByRole
  };
  persistState();
  return getRbacMatrix();
};

export const setRbacRolePermissions = async (roleId, permissions) => {
  await delay(120);
  const role = rbacState.roles.find(r => String(r.id) === String(roleId));
  if (role) {
    rbacState.permissionsByRole[role.role_key] = Array.from(new Set(permissions));
    persistState();
  }
  return { success: true };
};

export const createRbacRole = async (data) => {
  await delay(180);
  const roleKey = data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
  const newRole = {
    id: Date.now(),
    role_key: roleKey,
    key: roleKey,
    name: data.name.trim(),
    label: data.name.trim(),
    description: data.description || '',
    is_system: false
  };

  rbacState.roles.push(newRole);
  rbacState.permissionsByRole[roleKey] = Array.isArray(data.permissions) ? data.permissions : [];
  persistState();
  return newRole;
};

export const listRbacOrganizations = async () => {
  await delay();
  return JSON.parse(JSON.stringify(MOCK_ORGANIZATIONS));
};

export const listRbacUsers = async (organizationId) => {
  await delay();
  const users = rbacState.usersByOrg[organizationId] || rbacState.usersByOrg[1] || [];
  return JSON.parse(JSON.stringify(users));
};

export const getUserRbacRoles = async (userId) => {
  await delay();
  return [{ role_key: 'org_admin', name: 'Admin' }];
};

export const assignUserRbacRole = async (userId, data) => {
  await delay(150);
  // Updates local user entry if present
  for (const orgUsers of Object.values(rbacState.usersByOrg)) {
    const user = orgUsers.find(u => String(u.id) === String(userId));
    if (user) {
      const selectedRole = rbacState.roles.find(r => String(r.id) === String(data.roleId));
      if (selectedRole) {
        user.role = selectedRole.role_key;
        user.role_name = selectedRole.name;
        if (data.expiresIn) {
          user.expiresIn = data.expiresIn;
        }
      }
    }
  }
  persistState();

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = JSON.parse(window.localStorage.getItem('watermelon_rbac_user_assignments_v1') || '{}');
      existing[userId] = {
        roleId: data.roleId,
        expiresIn: data.expiresIn || null,
        assignedAt: new Date().toISOString()
      };
      window.localStorage.setItem('watermelon_rbac_user_assignments_v1', JSON.stringify(existing));

      if (data.expiresIn) {
        const hours = data.expiresIn === '1h' ? 1 : data.expiresIn === '4h' ? 4 : 8;
        const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        window.localStorage.setItem('watermelon_rbac_temp_expiration_v1', JSON.stringify({
          userId,
          expiresAt,
          duration: data.expiresIn
        }));
      }
      window.dispatchEvent(new CustomEvent('watermelon_rbac_matrix_changed'));
    }
  } catch (e) {}

  return { success: true, userId, ...data };
};

export const removeUserRbacRole = async (userId, roleId) => {
  await delay(100);
  return { success: true };
};
