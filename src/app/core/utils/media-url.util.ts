import { environment } from '../../../environments/environment';

/** Origin for static uploads (not under /api/v1). */
function mediaOrigin(): string {
  const base = (environment.apiBaseUrl || '').replace(/\/$/, '');
  return base.replace(/\/api\/v1$/i, '');
}

/** Fix wrongly prefixed upload URLs that include /api/v1. */
function normalizeUploadPath(url: string): string {
  return url.replace(/\/api\/v1(\/uploads\/)/gi, '$1');
}

/** Resolve API-relative media paths (e.g. `/uploads/1/x.jpg`) to absolute URLs. */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  const cleaned = normalizeUploadPath(url.trim());
  if (/^(https?:|data:|blob:)/i.test(cleaned)) {
    return cleaned;
  }
  const origin = mediaOrigin();
  if (cleaned.startsWith('/')) {
    return `${origin}${cleaned}`;
  }
  return `${origin}/${cleaned}`;
}

export function resolveMediaUrls(urls: string[] | undefined | null): string[] {
  return (urls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean);
}
