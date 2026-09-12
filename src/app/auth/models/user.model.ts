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

/** Payload for POST /account/forgotPassword */
export class ForgotPasswordParamModel {
  public email: string = '';
}

/** Payload for POST /account/resetPassword */
export class ResetPasswordParamModel {
  public token: string = '';
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

/** Raw wire shape for login before normalization (allows snake_case variants). */
export interface LoginApiPayload {
  accessToken?: string;
  access_token?: string;
  expiresAt?: string;
  expires_at?: string;
  userId?: string;
  user_id?: string;
  tenantId?: string | null;
  tenant_id?: string | null;
  fullName?: string;
  full_name?: string;
  userRole?: string;
  user_role?: string;
  message?: string | null;
}

/** Raw wire shape for userProfile. */
export interface UserProfileApiPayload {
  userId?: string;
  user_id?: string;
  tenantId?: string | null;
  tenant_id?: string | null;
  fullName?: string;
  full_name?: string;
  email?: string;
  userRole?: string;
  user_role?: string;
  accountStatus?: string;
  account_status?: string;
  lastLoginAt?: string | null;
  last_login_at?: string | null;
  businessName?: string | null;
  business_name?: string | null;
}
