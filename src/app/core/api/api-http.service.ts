import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClientError, ApiResponse } from './api.types';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({
  providedIn: 'root',
})
export class ApiHttpService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: QueryParams, headers?: HttpHeaders): Observable<T> {
    return this.request<T>('GET', path, undefined, params, headers);
  }

  getWithMeta<T>(
    path: string,
    params?: QueryParams,
    headers?: HttpHeaders
  ): Observable<{ data: T; meta?: Record<string, unknown> }> {
    return this.rawRequest<T>('GET', path, undefined, params, headers).pipe(
      map((res) => ({ data: res.data as T, meta: res.meta }))
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

  /** Multipart upload helper (does not set Content-Type â€” browser sets boundary). */
  postFormData<T>(path: string, formData: FormData, headers?: HttpHeaders): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), formData, { headers })
      .pipe(
        map((res) => this.unwrap(res)),
        catchError((err) => throwError(() => this.toApiError(err)))
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
      map((res) => this.unwrap(res))
    );
  }

  private rawRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
    headers?: HttpHeaders
  ): Observable<ApiResponse<T>> {
    return this.http
      .request<ApiResponse<T>>(method, this.url(path), {
        body,
        params: this.toParams(params),
        headers,
      })
      .pipe(catchError((err) => throwError(() => this.toApiError(err))));
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

  private unwrap<T>(res: ApiResponse<T>): T {
    if (!res?.success) {
      throw new ApiClientError(
        res?.error?.code ?? 'UNKNOWN',
        res?.error?.message ?? 'Request failed'
      );
    }
    return res.data as T;
  }

  private toApiError(err: unknown): ApiClientError {
    if (err instanceof ApiClientError) {
      return err;
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiResponse | undefined;
      const code = body?.error?.code ?? 'HTTP_ERROR';
      const message =
        body?.error?.message ||
        (typeof err.error === 'object' &&
        err.error &&
        'detail' in (err.error as object)
          ? String((err.error as { detail: unknown }).detail)
          : null) ||
        err.message ||
        'Unable to reach the API server.';
      return new ApiClientError(code, message, err.status || 0);
    }
    return new ApiClientError('UNKNOWN', 'Unexpected error');
  }
}
