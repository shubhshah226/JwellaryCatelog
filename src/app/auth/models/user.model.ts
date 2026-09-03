export type UserRole = 'admin' | 'vendor' | 'customer';

export interface AuthUser {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  role: UserRole;
  vendorId?: number;
  status?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}
