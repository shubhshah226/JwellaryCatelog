import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoadingService } from '../services/loading.service';

function isApiRequest(url: string): boolean {
  const bases = [environment.apiUrl, environment.apiBaseUrl].filter(Boolean);
  if (bases.some((base) => !!base && (url === base || url.startsWith(base)))) {
    return true;
  }

  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    return path === '/api/v1' || path.startsWith('/api/v1/');
  } catch {
    return url.includes('/api/v1');
  }
}

/** Show global loader for every in-flight API request. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  // Optional skip: request header X-Skip-Loader: true
  if (req.headers.get('X-Skip-Loader') === 'true') {
    return next(req);
  }

  const loading = inject(LoadingService);
  loading.show();

  return next(req).pipe(finalize(() => loading.hide()));
};
