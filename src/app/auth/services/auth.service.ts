import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ApiHttpService } from '../../core/api/api-http.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { getRoleFromToken, normalizeAppRole } from '../../core/utils/jwt.util';
import {
  AccountActionResponse,
  AuthSession,
  AuthUser,
  ChangePasswordParamModel,
  LoginApiPayload,
  LoginParamModel,
  LoginResponse,
  UserProfile,
  UserProfileApiPayload,
  UserRole,
} from '../models/user.model';
import { environment } from '../../../environments/environment';

/** Plain localStorage key used by login (decrypted for now). */
const USER_STORAGE_KEY = 'user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiHttpService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastService);

  private session: AuthSession | null = null;
  private sessionLoaded = false;
  private sessionLoadPromise: Promise<void> | null = null;

  /** Login API — returns unwrapped `data` (LoginResponse). Login component stays unchanged. */
  login(loginParamModel: LoginParamModel): Observable<LoginResponse> {
    return this.api.post<LoginApiPayload>('/account/login', loginParamModel).pipe(
      map((res) => {
        const normalized = this.normalizeLoginPayload(res);
        if (normalized.accessToken) {
          this.session = this.createSessionFromLogin(normalized);
          this.sessionLoaded = true;
        }
        return normalized;
      }),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Login failed'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  /** POST /account/changePassword — body is ChangePasswordParamModel. */
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

  /** POST /account/userProfile — current logged-in user. */
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
    this.hydrateFromStorageIfNeeded();
    return this.session !== null && !!this.session.token;
  }

  getSession(): AuthSession | null {
    this.hydrateFromStorageIfNeeded();
    return this.session;
  }

  getAccessToken(): string | null {
    return this.getSession()?.token ?? null;
  }

  getRole(): UserRole | null {
    return this.getSession()?.user.role ?? null;
  }

  getDashboardRoute(): string {
    return this.getRole() === 'superadmin' ? '/superAdmin/dashboard' : '/vendor/dashboard';
  }

  redirectToDashboard(): void {
    void this.router.navigateByUrl(this.getDashboardRoute());
  }

  /** POST /account/logout — revoke server session, then clear local auth. */
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
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(environment.storageKey);
    this.themeService.resetToDark();
  }

  private hydrateFromStorageIfNeeded(): void {
    if (this.session?.token) {
      return;
    }
    const stored = this.readStoredLogin();
    if (stored?.accessToken) {
      try {
        this.session = this.createSessionFromLogin(stored);
        this.sessionLoaded = true;
      } catch {
        this.session = null;
      }
    }
  }

  private async loadSession(): Promise<void> {
    const stored = this.readStoredLogin();
    if (stored?.accessToken) {
      try {
        this.session = this.createSessionFromLogin(stored);
      } catch {
        this.session = null;
      }
    } else {
      this.session = null;
    }
    this.sessionLoaded = true;
  }

  private readStoredLogin(): LoginResponse | null {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return this.normalizeLoginPayload(JSON.parse(raw));
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
  }

  /** Accept camelCase or snake_case login payloads from API / localStorage. */
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

  private createSessionFromLogin(data: LoginResponse): AuthSession {
    const token = (data.accessToken || '').trim();
    const role = getRoleFromToken(token) ?? normalizeAppRole(data.userRole);
    if (!token || (role !== 'superadmin' && role !== 'vendor')) {
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
