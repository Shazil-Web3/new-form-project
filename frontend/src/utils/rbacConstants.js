/**
 * @file rbacConstants.js
 * @description Central definitions for RBAC roles, 25 capabilities, initial matrix, and permission mappings.
 */

export const STORAGE_KEY_MATRIX = 'watermelon_rbac_permission_matrix_v4';
export const STORAGE_KEY_ROLES = 'watermelon_rbac_roles_v4';
export const STORAGE_KEY_USER_ASSIGNMENTS = 'watermelon_rbac_user_assignments_v1';
export const STORAGE_KEY_TEMP_EXPIRATION = 'watermelon_rbac_temp_expiration_v1';

// 10 Roles matching Rbac-Matrix-Temp-View.html
export const INITIAL_ROLES = [
  { id: 'system', label: 'System', short: 'SYS', sub: 'SaaS owner / licence giver', key: 'system', is_system: true },
  { id: 'super_admin', label: 'Super Admin', short: 'SA', sub: 'Creates sites London/Paris, numbering', key: 'super_admin', is_system: true },
  { id: 'admin', label: 'Admin', short: 'ADM', sub: 'Daily activity helping users in templates', key: 'org_admin', is_system: true },
  { id: 'training_admin', label: 'Training Admin', short: 'T-ADM', sub: 'Manages curriculum & training only', key: 'training_admin', is_system: true },
  { id: 'approver', label: 'Approver / Reviewer', short: 'APR', sub: 'Invited Only', key: 'review_approval', is_system: true },
  { id: 'author', label: 'Author', short: 'AUTH', sub: '', key: 'author', is_system: true },
  { id: 'people', label: 'People Manager', short: 'PEO', sub: '', key: 'people_manager', is_system: true },
  { id: 'project', label: 'Project Manager', short: 'PM', sub: '', key: 'project_manager', is_system: true },
  { id: 'view', label: 'View', short: 'VIEW', sub: 'read-only permanent', key: 'view_only', is_system: true },
  { id: 'temp_view', label: 'Temp View', short: 'TEMP', sub: 'visitor / auditor certain doc temporarily', key: 'temporary_view', is_system: true }
];

// 25 Capabilities across 4 Groups matching Rbac-Matrix-Temp-View.html
export const CAPABILITIES = [
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
export const INITIAL_MATRIX = [
  [false, true, true, false, true, true, true, true, true, false],
  [false, true, true, false, true, true, true, true, true, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, false, false, false, false, false, false, false],
  [false, true, true, true, false, false, false, false, false, false],
  [false, true, true, false, false, true, true, true, true, false],
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

export const GROUP_CONFIG = {
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

// Direct mapping from 25 Matrix Capabilities to granular catalog permissions
export const CAPABILITY_TO_PERMISSIONS = {
  create_account: ['users.create_personal_account', 'users.create'],
  reset_pwd: ['users.reset_password'],
  manage_site: ['organizations.site_create', 'organizations.manage'],
  manage_user: ['users.manage', 'users.create', 'users.edit', 'users.delete', 'users.account_management_tab'],
  manage_training: ['training.manage', 'training.admin'],
  folder_file_access: ['folders.access', 'documents.view', 'documents.file_access', 'templates.view'],
  temp_view_row: ['documents.view', 'temporary_access'],
  report_access: ['reports.generate', 'audit.view'],
  data_import: ['users.import', 'documents.import'],
  t_comment_review_approve: ['templates.review', 'templates.comment', 'templates.approve'],
  t_create: ['templates.create'],
  t_edit: ['templates.edit'],
  t_delete: ['templates.delete', 'templates.delete_draft', 'templates.obsolete'],
  d_comment_review_approve: ['documents.review', 'documents.comment', 'documents.approve'],
  d_edit_same: ['documents.edit'],
  d_create: ['documents.create'],
  d_delete: ['documents.delete', 'documents.obsolete'],
  tr_create: ['training.curriculum_create', 'training.exam_create', 'training.create'],
  tr_content_catalog: ['training.catalog', 'training.view'],
  tr_class_library: ['training.classes', 'training.library'],
  tr_assignments: ['training.assignments', 'training.manage'],
  tr_training_matrix: ['training.matrix'],
  tr_reports: ['training.reports'],
  tr_records: ['training.records'],
  tr_numbering_rule: ['training.numbering']
};

// Normalized role alias resolution
export const ROLE_ALIASES = {
  admin: 'admin',
  org_admin: 'admin',
  administrator: 'admin',
  super_admin: 'super_admin',
  superadmin: 'super_admin',
  author: 'author',
  editor: 'author',
  reviewer: 'approver',
  approver: 'approver',
  review_approval: 'approver',
  project: 'project',
  project_manager: 'project',
  people: 'people',
  people_manager: 'people',
  training_admin: 'training_admin',
  view: 'view',
  viewer: 'view',
  view_only: 'view',
  temp_view: 'temp_view',
  temporary_view: 'temp_view',
  system: 'system'
};

export const normalizeRoleId = (rawRole) => {
  if (!rawRole) return 'view';
  const clean = String(rawRole).trim().toLowerCase();
  return ROLE_ALIASES[clean] || clean;
};

