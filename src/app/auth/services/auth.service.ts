import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { ApiClientError } from '@common/api/api.types';
import { ApiHttpService } from '@common/api/api-http.service';
import { CryptoStorageService } from '@common/services/crypto-storage.service';
import { ThemeService } from '@common/services/theme.service';
import { ToastService } from '@common/services/toast.service';
import { getRoleFromToken, normalizeAppRole } from '@common/utils/jwt.util';
import {
  AccountActionResponse,
  AuthSession,
  AuthUser,
  ChangePasswordParamModel,
  ForgotPasswordParamModel,
  LoginApiPayload,
  LoginParamModel,
  LoginResponse,
  ResetPasswordParamModel,
  UserProfile,
  UserProfileApiPayload,
  UserRole,
} from '../models/user.model';

/**
 * Authentication + session lifecycle.
 *
 * - Login / logout / password APIs
 * - Keeps an in-memory `session` (token + user role)
 * - Persists the login payload encrypted via CryptoStorageService
 * - Maps API roles to app roles: `superadmin` | `owner`
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiHttpService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly cryptoStorage = inject(CryptoStorageService);

  /** Current signed-in session (memory). Null when logged out. */
  private session: AuthSession | null = null;
  private sessionLoaded = false;
  private sessionLoadPromise: Promise<void> | null = null;

  /**
   * POST /account/login
   * On success: builds session in memory and encrypts it to localStorage.
   */
  login(loginParamModel: LoginParamModel): Observable<LoginResponse> {
    return this.api.post<LoginApiPayload>('/account/login', loginParamModel).pipe(
      map((res) => this.normalizeLoginPayload(res)),
      switchMap((normalized) => {
        if (!normalized.accessToken) {
          const message = normalized.message || 'Login failed';
          this.toast.error(message);
          return throwError(() => new Error(message));
        }
        this.session = this.createSessionFromLogin(normalized);
        this.sessionLoaded = true;
        // Persist encrypted; ignore storage failures for navigation.
        return from(this.cryptoStorage.setJson(normalized)).pipe(map(() => normalized));
      }),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError || err instanceof Error) {
          return throwError(() => new Error(err.message || 'Login failed'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  /** POST /account/changePassword */
  changePassword(paramModel: ChangePasswordParamModel): Observable<AccountActionResponse> {
    return this.api.post<AccountActionResponse>('/account/changePassword', paramModel).pipe(
      map((res) => {
        const response = new AccountActionResponse();
        response.success = res?.success === true;
        response.message = res?.message ?? null;
        if (!response.success) {
          throw new Error(response.message || 'Unable to change password.');
        }
        return response;
      }),
      catchError((err: unknown) => {
        if (err instanceof Error && !(err instanceof ApiClientError)) {
          return throwError(() => err);
        }
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Unable to change password.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  /** POST /account/forgotPassword */
  forgotPassword(paramModel: ForgotPasswordParamModel): Observable<AccountActionResponse> {
    return this.api.post<AccountActionResponse>('/account/forgotPassword', paramModel).pipe(
      map((res) => {
        const response = new AccountActionResponse();
        response.success = res?.success !== false;
        response.message =
          res?.message ??
          'If that email is registered, a reset link has been sent to it.';
        return response;
      }),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Unable to send reset link.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  /** POST /account/resetPassword */
  resetPassword(paramModel: ResetPasswordParamModel): Observable<AccountActionResponse> {
    return this.api.post<AccountActionResponse>('/account/resetPassword', paramModel).pipe(
      map((res) => {
        const response = new AccountActionResponse();
        response.success = res?.success === true;
        response.message = res?.message ?? null;
        if (!response.success) {
          throw new Error(response.message || 'Unable to reset password.');
        }
        return response;
      }),
      catchError((err: unknown) => {
        if (err instanceof Error && !(err instanceof ApiClientError)) {
          return throwError(() => err);
        }
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Unable to reset password.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  /** POST /account/userProfile â€” current logged-in user details. */
  getUserProfile(): Observable<UserProfile> {
    return this.api.post<UserProfileApiPayload>('/account/userProfile', {}).pipe(
      map((res) => this.normalizeUserProfile(res)),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Unable to load profile.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  private normalizeUserProfile(raw: unknown): UserProfile {
    const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const pick = (...keys: string[]): unknown => {
      for (const key of keys) {
        if (r[key] != null && r[key] !== '') {
          return r[key];
        }
      }
      return null;
    };

    const profile = new UserProfile();
    profile.userId = String(pick('userId', 'user_id') ?? '');
    const tenant = pick('tenantId', 'tenant_id');
    profile.tenantId = tenant == null ? null : String(tenant);
    profile.fullName = String(pick('fullName', 'full_name') ?? '');
    profile.email = String(pick('email') ?? '');
    profile.userRole = String(pick('userRole', 'user_role') ?? '');
    profile.accountStatus = String(pick('accountStatus', 'account_status') ?? '');
    const lastLogin = pick('lastLoginAt', 'last_login_at');
    profile.lastLoginAt = lastLogin == null ? null : String(lastLogin);
    const business = pick('businessName', 'business_name');
    profile.businessName = business == null ? null : String(business);
    return profile;
  }

  /** Wait until encrypted session has been loaded (used by route guards + APP_INITIALIZER). */
  async ensureSessionLoaded(): Promise<void> {
    if (this.sessionLoaded) {
      return;
    }
    if (!this.sessionLoadPromise) {
      this.sessionLoadPromise = this.loadSession();
    }
    await this.sessionLoadPromise;
  }

  isAuthenticated(): boolean {
    return this.session !== null && !!this.session.token;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  getAccessToken(): string | null {
    return this.session?.token ?? null;
  }

  getRole(): UserRole | null {
    return this.session?.user.role ?? null;
  }

  getDashboardRoute(): string {
    return this.getRole() === 'superadmin' ? '/superAdmin/dashboard' : '/vendor/dashboard';
  }

  redirectToDashboard(): void {
    void this.router.navigateByUrl(this.getDashboardRoute());
  }

  /** POST /account/logout â€” revoke server session, then clear local auth. */
  logout(): void {
    const token = this.getAccessToken();
    if (!token) {
      this.finishLogout();
      return;
    }

    this.api.post<AccountActionResponse>('/account/logout', {}).subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  /** Clear session without calling logout API (used on 401). */
  forceLogout(): void {
    this.clearLocalSession();
    void this.router.navigate(['/login']);
  }

  private finishLogout(): void {
    this.clearLocalSession();
    this.toast.success('Logout successfully.', 'Success');
    void this.router.navigate(['/login']);
  }

  private clearLocalSession(): void {
    this.session = null;
    this.sessionLoaded = true;
    this.cryptoStorage.clear();
    this.themeService.resetToDark();
  }

  /** Decrypt session from localStorage into memory. */
  private async loadSession(): Promise<void> {
    try {
      const stored = await this.cryptoStorage.getJson<unknown>();
      if (stored) {
        const normalized = this.normalizeLoginPayload(stored);
        if (normalized.accessToken) {
          this.session = this.createSessionFromLogin(normalized);
        } else {
          this.session = null;
        }
      } else {
        this.session = null;
      }
    } catch {
      this.session = null;
      this.cryptoStorage.clear();
    }
    this.sessionLoaded = true;
  }

  /** Accept camelCase or snake_case login payloads from API / storage. */
  normalizeLoginPayload(raw: unknown): LoginResponse {
    const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const pick = (...keys: string[]): unknown => {
      for (const key of keys) {
        if (r[key] != null && r[key] !== '') {
          return r[key];
        }
      }
      return '';
    };

    const tenantRaw = pick('tenantId', 'tenant_id');
    const messageRaw = pick('message');

    return {
      accessToken: String(pick('accessToken', 'access_token') || ''),
      expiresAt: String(pick('expiresAt', 'expires_at') || ''),
      userId: String(pick('userId', 'user_id') || ''),
      tenantId: tenantRaw === '' || tenantRaw == null ? null : String(tenantRaw),
      fullName: String(pick('fullName', 'full_name') || ''),
      userRole: String(pick('userRole', 'user_role') || ''),
      message: messageRaw === '' || messageRaw == null ? null : String(messageRaw),
    };
  }

  /** Build in-memory session from login payload; role from JWT or userRole field. */
  private createSessionFromLogin(data: LoginResponse): AuthSession {
    const token = (data.accessToken || '').trim();
    const role = getRoleFromToken(token) ?? normalizeAppRole(data.userRole);
    if (!token || (role !== 'superadmin' && role !== 'owner')) {
      throw new Error('Invalid user role');
    }

    const fullName = (data.fullName || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);

    const user: AuthUser = {
      id: String(data.userId || ''),
      name: fullName || data.userRole || 'User',
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: '',
      role,
      tenantId: data.tenantId,
      vendorId: data.tenantId,
    };

    return {
      token,
      user,
      expiresAt: data.expiresAt,
      raw: data,
    };
  }
}
