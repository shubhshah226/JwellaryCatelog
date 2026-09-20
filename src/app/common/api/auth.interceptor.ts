import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '@auth/services/auth.service';
import { ToastService } from '@common/services/toast.service';
import { ApiClientError, ApiResponse } from './api.types';

/**
 * Auth interceptor
 * - Attaches `Token` header from the in-memory session (loaded via APP_INITIALIZER)
 * - On 401 (HTTP or envelope status): toast + force logout
 *
 * Anonymous / public / logout calls skip the 401 force-logout path.
 */

let handlingUnauthorized = false;

function isAnonymousAccountRequest(url: string): boolean {
  return (
    url.includes('/account/login') ||
    url.includes('/account/forgotPassword') ||
    url.includes('/account/resetPassword')
  );
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
  toastService.error('Invalid or expired token. Please log in again.');
  authService.forceLogout();
  window.setTimeout(() => {
    handlingUnauthorized = false;
  }, 1500);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (!isApiRequest) {
    return next(req);
  }

  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const skipInvalidTokenHandler =
    isAnonymousAccountRequest(req.url) ||
    isLogoutRequest(req.url) ||
    isPublicApiRequest(req.url);

  let outbound = req;
  if (
    !isAnonymousAccountRequest(req.url) &&
    !isPublicApiRequest(req.url) &&
    !req.headers.has('Token') &&
    !req.headers.has('X-Customer-Session')
  ) {
    const token = authService.getAccessToken();
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
