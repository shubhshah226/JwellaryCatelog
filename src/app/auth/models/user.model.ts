export type UserRole = 'superadmin' | 'vendor' | 'customer';

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  role: UserRole;
  /** API tenantId for owner/vendor */
  tenantId?: string | null;
  vendorId?: string | null;
  status?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt?: string;
  raw?: LoginResponse;
}

export class LoginParamModel {
  public email: string = '';
  public password: string = '';
}

/** Payload for POST /account/changePassword */
export class ChangePasswordParamModel {
  public oldPassword: string = '';
  public newPassword: string = '';
}

/** Unwrapped `data` from account action endpoints (changePassword, logout, …) */
export class AccountActionResponse {
  public success: boolean = false;
  public message: string | null = null;
}

export class LoginResponse {
  accessToken: string = '';
  expiresAt: string = '';
  userId: string = '';
  tenantId: string | null = null;
  fullName: string = '';
  userRole: string = '';
  message: string | null = null;
}

/** Response from POST /account/userProfile */
export class UserProfile {
  userId: string = '';
  tenantId: string | null = null;
  fullName: string = '';
  email: string = '';
  userRole: string = '';
  accountStatus: string = '';
  lastLoginAt: string | null = null;
  businessName: string | null = null;
}
