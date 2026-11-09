export interface RBACRole {
  id: number;
  role_key: string;
  name: string;
  description?: string | null;
  is_system: boolean | number;
}

export interface TempView {
  documentId: string;
  extraHours: number;
  expiresAt: Date | string;
}

export interface RbacMatrixCell {
  roleKey?: string;
  permissionKey?: string;
  allowed?: boolean;
  [key: string]: any;
}

export interface RbacMatrixRow {
  roleKey?: string;
  roleName?: string;
  cells?: RbacMatrixCell[] | Record<string, boolean>;
  [key: string]: any;
}

export interface RbacStats {
  totalRoles?: number;
  totalPermissions?: number;
  [key: string]: any;
}

export interface AuthUser {
  id: number;
  email?: string;
  role?: string;
  organization_id?: number;
  permissions?: string[];
  isSuperAdmin?: boolean;
}
