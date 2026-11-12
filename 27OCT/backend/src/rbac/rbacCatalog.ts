// Built-in RBAC role catalog (moved from the removed Access Levels system).
const BUILTIN_ROLE_DEFS = [
  ['system', 'System', 'System account approval permission from the access matrix.'],
  ['org_admin', 'Admin', 'Administrator permissions defined by the access matrix.'],
  ['author', 'Author', 'Author permissions defined by the access matrix.'],
  ['review_approval', 'Approver/Reviewer', 'Review and approval permissions defined by the access matrix.'],
  ['project_manager', 'Project Manager', 'Project manager permissions defined by the access matrix.'],
  ['people_manager', 'People Manager', 'People manager permissions defined by the access matrix.'],
  ['view_only', 'View', 'View permissions defined by the access matrix.'],
  ['temporary_view', 'Temp View', 'Temporary view permissions with one-hour or four-hour expiry.'],
  ['super_admin', 'Super Admin', 'Platform-wide administration and RBAC management.']
];

const FEATURE_ACTIONS = {
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

const BUILTIN_PERMISSIONS = {
  // Approved spreadsheet matrix: the System role holds no grants.
  system: [],
  org_admin: [
    ['templates', 'create'], ['documents', 'create'], ['documents', 'review'],
    ['documents', 'comment'], ['documents', 'approve'], ['documents', 'view'],
    ['users', 'view'], ['users', 'manage'], ['users', 'create_personal_account'],
    ['users', 'approve'], ['calendar', 'view_personal'], ['calendar', 'view_others'],
    ['users', 'reset_password'],
    ['organizations', 'site_create'], ['folders', 'access'],
    ['audit', 'view'], ['reports', 'generate'], ['templates', 'obsolete'],
    ['documents', 'obsolete'], ['templates', 'delete_draft'], ['tasks', 'reassign_own'],
    ['tasks', 'reassign_others'], ['users', 'account_management_tab'],
    ['training', 'view'], ['training', 'admin'], ['training', 'classes'],
    ['calendar', 'view'], ['billing', 'view'], ['billing', 'manage'],
    ['access_levels', 'view'], ['access_levels', 'edit'], ['access_levels', 'create'],
    ['access_levels', 'delete'], ['access_levels', 'manage']
  ],
  author: [
    ['documents', 'view'], ['documents', 'create'], ['documents', 'review'],
    ['documents', 'comment'], ['documents', 'approve'], ['users', 'create_personal_account'],
    ['calendar', 'view_personal'], ['users', 'reset_password'], ['folders', 'access'],
    ['reports', 'generate'], ['documents', 'obsolete'], ['templates', 'delete_draft'],
    ['tasks', 'reassign_own'], ['training', 'view'], ['training', 'classes'],
    ['calendar', 'view']
  ],
  review_approval: [
    ['documents', 'view'], ['documents', 'review'], ['documents', 'comment'],
    ['documents', 'approve'], ['users', 'create_personal_account'],
    ['calendar', 'view_personal'], ['users', 'reset_password'], ['folders', 'access'],
    ['reports', 'generate'], ['training', 'view'], ['training', 'classes'],
    ['calendar', 'view']
  ],
  project_manager: [
    ['users', 'create_personal_account'], ['calendar', 'view_personal'],
    ['calendar', 'view_others'], ['users', 'reset_password'], ['folders', 'access'],
    ['documents', 'view'], ['reports', 'generate'], ['tasks', 'reassign_own'],
    ['tasks', 'reassign_others'], ['training', 'view'], ['training', 'classes'],
    ['calendar', 'view']
  ],
  people_manager: [
    ['users', 'create_personal_account'], ['calendar', 'view_personal'],
    ['calendar', 'view_others'], ['users', 'reset_password'], ['folders', 'access'],
    ['documents', 'view'], ['reports', 'generate'], ['tasks', 'reassign_own'],
    ['tasks', 'reassign_others'], ['training', 'view'], ['training', 'classes'],
    ['calendar', 'view']
  ],
  view_only: [
    ['users', 'create_personal_account'], ['users', 'reset_password'],
    ['folders', 'access'], ['documents', 'view'], ['training', 'view'], ['training', 'classes']
  ],
  temporary_view: [
    ['documents', 'view'], ['documents', 'file_access']
  ],
  super_admin: Object.entries(FEATURE_ACTIONS)
    .flatMap(([feature, actions]) => actions.map(action => [feature, action]))
};

const LEGACY_ROLE_TO_RBAC_KEY = {
  admin: 'org_admin',
  project_manager: 'project_manager',
  author: 'author',
  reviewer: 'review_approval',
  approver: 'review_approval',
  viewer: 'view_only',
  people_manager: 'people_manager',
  system: 'system'
};

export {
  BUILTIN_ROLE_DEFS,
  FEATURE_ACTIONS,
  BUILTIN_PERMISSIONS,
  LEGACY_ROLE_TO_RBAC_KEY
};
