import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CustomerAuthService } from '../../storefront/services/customer-auth.service';

/** Attach OTP session so public product APIs can reveal prices after verify. */
export const customerSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith(environment.apiBaseUrl);

  if (!isApiRequest || req.headers.has('X-Customer-Session')) {
    return next(req);
  }

  const match = req.url.match(/\/public\/stores\/([^/?#]+)/);
  if (!match) {
    return next(req);
  }

  const storeCode = decodeURIComponent(match[1]);
  const token = inject(CustomerAuthService).getSession(storeCode)?.sessionToken;
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Customer-Session': token } }));
};
