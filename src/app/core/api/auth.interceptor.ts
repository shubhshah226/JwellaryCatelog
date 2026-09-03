import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { ToastService } from '../services/toast.service';

let handlingUnauthorized = false;

/** Attach Bearer JWT and force logout + toast on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith(environment.apiBaseUrl);

  if (!isApiRequest) {
    return next(req);
  }

  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  let outbound = req;
  if (!req.headers.has('Authorization') && !req.headers.has('X-Customer-Session')) {
    const token = authService.getSession()?.token;
    if (token) {
      outbound = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
  }

  return next(outbound).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/logout')
      ) {
        if (authService.isAuthenticated() && !handlingUnauthorized) {
          handlingUnauthorized = true;
          toastService.error('User is Unauthorized');
          authService.forceLogout();
          window.setTimeout(() => {
            handlingUnauthorized = false;
          }, 1500);
        }
      }
      return throwError(() => err);
    })
  );
};
