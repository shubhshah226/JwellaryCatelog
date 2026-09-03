export type AppUserRole = 'admin' | 'vendor';
export type UserSortField = 'name' | 'email' | 'username' | 'role';
export type SortDirection = 'asc' | 'desc';

export interface AppUser {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: AppUserRole;
  vendorId?: number;
}

export interface UserFilters {
  search: string;
  role: string;
}

export interface UserFormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: AppUserRole;
  vendorId: string;
}

export function createEmptyUserForm(): UserFormData {
  return {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    role: 'admin',
    vendorId: '',
  };
}
