import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoadingService } from '../services/loading.service';

/** Show global loader for every in-flight API request. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.startsWith(environment.apiBaseUrl);

  if (!isApiRequest) {
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
