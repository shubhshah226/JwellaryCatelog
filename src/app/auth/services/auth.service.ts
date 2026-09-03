import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ApiHttpService } from '../../core/api/api-http.service';
import { CryptoStorageService } from '../../core/services/crypto-storage.service';
import { ThemeService } from '../../core/services/theme.service';
import { getRoleFromToken } from '../../core/utils/jwt.util';
import { AuthSession, AuthUser, UserRole } from '../models/user.model';

interface LoginResponse {
  token: string;
  user: AuthUser & { status?: string };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiHttpService);
  private readonly router = inject(Router);
  private readonly cryptoStorage = inject(CryptoStorageService);
  private readonly themeService = inject(ThemeService);

  private session: AuthSession | null = null;
  private sessionLoaded = false;
  private sessionLoadPromise: Promise<void> | null = null;

  login(username: string, password: string): Observable<AuthSession> {
    return this.api.post<LoginResponse>('/auth/login', { username, password }).pipe(
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          if (err.code === 'VENDOR_INACTIVE') {
            return throwError(() => new Error('Your vendor account is inactive. Contact admin.'));
          }
          if (err.code === 'PLAN_EXPIRED') {
            return throwError(() => new Error('Your subscription/plan has expired. Contact admin.'));
          }
          return throwError(() => new Error(err.message || 'Login failed'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      }),
      switchMap((data) => {
        const session = this.createSession(data.token, data.user);
        return from(
          this.cryptoStorage.setItem(session).then(() => {
            this.session = session;
            this.sessionLoaded = true;
          })
        ).pipe(map(() => session));
      })
    );
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
    return this.session !== null;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  getRole(): UserRole | null {
    return this.session?.user.role ?? null;
  }

  getDashboardRoute(): string {
    return this.getRole() === 'admin' ? '/admin/dashboard' : '/vendor/dashboard';
  }

  redirectToDashboard(): void {
    void this.router.navigateByUrl(this.getDashboardRoute());
  }

  logout(): void {
    const token = this.session?.token;
    this.clearLocalSession();
    if (token) {
      this.api.post('/auth/logout').subscribe({ error: () => undefined });
    }
    void this.router.navigate(['/login']);
  }

  /** Clear session without calling logout API (used on 401). */
  forceLogout(): void {
    this.clearLocalSession();
    void this.router.navigate(['/login']);
  }

  private clearLocalSession(): void {
    this.session = null;
    this.cryptoStorage.removeItem();
    this.themeService.resetToDark();
  }

  private async loadSession(): Promise<void> {
    const session = await this.cryptoStorage.getItem<AuthSession>();
    if (session?.token) {
      const role = getRoleFromToken(session.token) ?? session.user.role;
      this.session = {
        ...session,
        user: {
          ...session.user,
          role,
          vendorId: session.user.vendorId,
        },
      };
    }
    this.sessionLoaded = true;
  }

  private createSession(token: string, user: AuthUser): AuthSession {
    const role = (getRoleFromToken(token) ?? user.role) as UserRole;
    if (role !== 'admin' && role !== 'vendor') {
      throw new Error('Invalid user role');
    }
    return {
      token,
      user: {
        id: Number(user.id),
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role,
        vendorId: user.vendorId != null ? Number(user.vendorId) : undefined,
      },
    };
  }
}
