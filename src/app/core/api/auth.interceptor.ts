import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { ToastService } from '../services/toast.service';
import { ApiClientError, ApiResponse } from './api.types';

let handlingUnauthorized = false;

function isLoginRequest(url: string): boolean {
  return url.includes('/account/login');
}

function isLogoutRequest(url: string): boolean {
  return url.includes('/account/logout');
}

function isPublicApiRequest(url: string): boolean {
  return url.includes('/public/');
}

function envelopeStatus(body: unknown): number {
  if (!body || typeof body !== 'object') {
    return 0;
  }
  return Number((body as ApiResponse).status) || 0;
}

function handleInvalidToken(authService: AuthService, toastService: ToastService): void {
  if (handlingUnauthorized) {
    return;
  }
  handlingUnauthorized = true;
  toastService.error('Invalid or expired token. Please log in again.', 'Error');
  authService.forceLogout();
  window.setTimeout(() => {
    handlingUnauthorized = false;
  }, 1500);
}

/** Attach smart-catalog `Token` header; logout + redirect on invalid token (401). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith(environment.apiBaseUrl);

  if (!isApiRequest) {
    return next(req);
  }

  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const isLogin = isLoginRequest(req.url);
  const skipInvalidTokenHandler =
    isLogin || isLogoutRequest(req.url) || isPublicApiRequest(req.url);

  let outbound = req;
  if (
    !isLogin &&
    !isPublicApiRequest(req.url) &&
    !req.headers.has('Token') &&
    !req.headers.has('X-Customer-Session')
  ) {
    let token = authService.getAccessToken();
    if (!token) {
      try {
        const raw = localStorage.getItem(environment.storageKey) || localStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw) as { accessToken?: string; access_token?: string };
          token = (parsed.accessToken || parsed.access_token || '').trim() || null;
        }
      } catch {
        token = null;
      }
    }
    if (token) {
      outbound = req.clone({
        setHeaders: { Token: token },
      });
    }
  }

  return next(outbound).pipe(
    map((event) => {
      // smart-catalog returns HTTP 200 with envelope status 401 for bad tokens
      if (!skipInvalidTokenHandler && event instanceof HttpResponse) {
        if (envelopeStatus(event.body) === 401) {
          handleInvalidToken(authService, toastService);
        }
      }
      return event;
    }),
    catchError((err: unknown) => {
      const status =
        err instanceof HttpErrorResponse
          ? Number((err.error as ApiResponse | undefined)?.status) || err.status
          : err instanceof ApiClientError
            ? err.status
            : 0;

      if (!skipInvalidTokenHandler && status === 401) {
        handleInvalidToken(authService, toastService);
      }
      return throwError(() => err);
    })
  );
};
