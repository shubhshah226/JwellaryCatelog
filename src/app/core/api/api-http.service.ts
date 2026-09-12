import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';
import { ApiClientError, ApiResponse } from './api.types';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Shared HTTP helper for the jewelry catalog API.
 *
 * - Prefixes paths with `environment.apiUrl`
 * - Unwraps envelope `{ status, data, exceptions }`
 * - Converts failures into `ApiClientError`
 * - Shows a toast for API errors automatically (unless skipped)
 *
 * Opt out of auto toast on a call:
 *   headers: new HttpHeaders({ 'X-Skip-Error-Toast': 'true' })
 *
 * Components should still handle `error:` for UI state (stop loading, etc.),
 * but they do NOT need to call `toast.error` for normal API failures.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiHttpService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('GET', path, undefined, params, headers);
  }

  /** Raw bytes (e.g. streamed logo). Does not unwrap the JSON envelope. */
  getBlob(path: string, params?: QueryParams, headers?: HttpHeaders): Observable<Blob> {
    let reqHeaders = headers || new HttpHeaders();
    if (!reqHeaders.has('X-Skip-Loader')) {
      reqHeaders = reqHeaders.set('X-Skip-Loader', 'true');
    }
    return this.http
      .get(this.url(path), {
        params: this.toParams(params),
        headers: reqHeaders,
        responseType: 'blob',
      })
      .pipe(catchError((err) => this.fail(err, reqHeaders)));
  }

  getWithMeta<T>(
    path: string,
    params?: QueryParams,
    headers?: HttpHeaders
  ): Observable<{ data: T; meta?: Record<string, unknown> }> {
    return this.rawRequest<T>('GET', path, undefined, params, headers).pipe(
      map((res) => ({ data: this.unwrap(res), meta: undefined })),
      catchError((err) => this.fail(err, headers))
    );
  }

  post<T>(path: string, body?: unknown, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('POST', path, body, params, headers);
  }

  put<T>(path: string, body?: unknown, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('PUT', path, body, params, headers);
  }

  patch<T>(path: string, body?: unknown, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('PATCH', path, body, params, headers);
  }

  delete<T = void>(path: string, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('DELETE', path, undefined, params, headers);
  }

  /** Multipart upload helper (does not set Content-Type — browser sets boundary). */
  postFormData<T>(path: string, formData: FormData, headers?: HttpHeaders): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), formData, { headers })
      .pipe(
        map((res) => this.unwrap(res)),
        catchError((err) => this.fail(err, headers))
      );
  }

  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
    headers?: HttpHeaders
  ): Observable<T> {
    return this.rawRequest<T>(method, path, body, params, headers).pipe(
      map((res) => this.unwrap(res)),
      catchError((err) => this.fail(err, headers))
    );
  }

  private rawRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
    headers?: HttpHeaders
  ): Observable<ApiResponse<T>> {
    return this.http.request<ApiResponse<T>>(method, this.url(path), {
      body,
      params: this.toParams(params),
      headers,
    });
  }

  private url(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      httpParams = httpParams.set(key, String(value));
    });
    return httpParams;
  }

  /**
   * New API envelope: { exceptions, data, status }
   * status 200 → return data; otherwise throw ApiClientError with API message.
   */
  private unwrap<T>(res: ApiResponse<T>): T {
    if (!res || typeof res !== 'object') {
      throw new ApiClientError('API_ERROR', 'Empty API response', 500);
    }

    const status = Number(res.status);
    if (status === 401) {
      throw new ApiClientError(
        'UNAUTHORIZED',
        this.messageFromData(res.data) || 'Invalid or expired token. Please log in again.',
        401
      );
    }
    if (status === 403) {
      throw new ApiClientError(
        'FORBIDDEN',
        this.messageFromData(res.data) || 'Your role is not permitted to perform this action.',
        403
      );
    }
    if (status !== 200) {
      const detail =
        (typeof res.exceptions === 'string' && res.exceptions.trim()
          ? (res.exceptions.split('File')[0] || res.exceptions).trim().slice(0, 240)
          : null) ||
        this.messageFromData(res.data) ||
        'Request failed';
      throw new ApiClientError('API_ERROR', detail, status || 500);
    }
    return res.data as T;
  }

  private messageFromData(data: unknown): string | null {
    if (typeof data === 'string' && data.trim()) {
      return data;
    }
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return null;
  }

  /** Normalize any failure, toast once (unless skipped / 401), then rethrow. */
  private fail(err: unknown, headers?: HttpHeaders): Observable<never> {
    const apiErr = this.toApiError(err);
    this.maybeToast(apiErr, headers);
    return throwError(() => apiErr);
  }

  private maybeToast(err: ApiClientError, headers?: HttpHeaders): void {
    // Caller opted out (custom UI handling).
    if (headers?.get('X-Skip-Error-Toast') === 'true') {
      return;
    }
    // 401 is handled by authInterceptor (toast + force logout).
    if (err.status === 401) {
      return;
    }
    this.toast.error(err.message || 'Request failed');
  }

  private toApiError(err: unknown): ApiClientError {
    if (err instanceof ApiClientError) {
      return err;
    }
    if (err instanceof HttpErrorResponse) {
      const payload = err.error as ApiResponse | string | undefined;
      if (payload && typeof payload === 'object') {
        return new ApiClientError(
          'HTTP_ERROR',
          payload.exceptions || this.messageFromData(payload.data) || err.message || 'Request failed',
          Number(payload.status) || err.status || 0
        );
      }
      return new ApiClientError(
        'HTTP_ERROR',
        (typeof payload === 'string' && payload) || err.message || 'Unable to reach the API server.',
        err.status || 0
      );
    }
    if (err instanceof Error && err.message) {
      return new ApiClientError('UNKNOWN', err.message);
    }
    return new ApiClientError('UNKNOWN', 'Unexpected error');
  }
}
