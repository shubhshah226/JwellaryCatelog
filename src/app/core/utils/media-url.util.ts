import { environment } from '../../../environments/environment';

/** Resolve API-relative media paths (e.g. `/uploads/1/x.jpg`) to absolute URLs. */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${environment.apiBaseUrl}${url}`;
  }
  return `${environment.apiBaseUrl}/${url}`;
}

export function resolveMediaUrls(urls: string[] | undefined | null): string[] {
  return (urls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean);
}
