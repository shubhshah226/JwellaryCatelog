export type RoleStatus = 'active' | 'inactive';
export type RoleSortField = 'name' | 'code' | 'description' | 'status' | 'createdOn';
export type SortDirection = 'asc' | 'desc';

export interface AppRole {
  id: number;
  name: string;
  code: string;
  description: string;
  status: RoleStatus;
  isSystem: boolean;
  createdOn: string;
}

export interface RoleFormData {
  name: string;
  code: string;
  description: string;
  status: RoleStatus;
}

export interface RoleFilters {
  search: string;
  status: string;
}

export function createEmptyRoleForm(): RoleFormData {
  return {
    name: '',
    code: '',
    description: '',
    status: 'active',
  };
}
