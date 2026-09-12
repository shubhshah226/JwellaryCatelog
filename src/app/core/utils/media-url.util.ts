import { environment } from '../../../environments/environment';

/** Origin for static uploads (not under /api/v1). */
function mediaOrigin(): string {
  const base = (environment.apiBaseUrl || environment.apiUrl || '').replace(/\/$/, '');
  return base.replace(/\/api\/v1$/i, '');
}

/** Fix wrongly prefixed upload URLs that include /api/v1. */
function normalizeUploadPath(url: string): string {
  return url
    .replace(/\\/g, '/')
    .replace(/\/api\/v1(\/uploads\/)/gi, '$1')
    .replace(/^\/+/, '/');
}

/**
 * Resolve API-relative media paths to absolute URLs.
 * Supports:
 * - `/uploads/...`
 * - `uploads/...`
 * - full http(s) / data / blob URLs
 * - paths incorrectly prefixed with /api/v1/uploads
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  let cleaned = normalizeUploadPath(url.trim());
  if (!cleaned || cleaned === '/') {
    return '';
  }
  if (/^(https?:|data:|blob:)/i.test(cleaned)) {
    // Still strip accidental /api/v1 before /uploads in absolute URLs
    return cleaned.replace(/^(https?:\/\/[^/]+)\/api\/v1(\/uploads\/)/i, '$1$2');
  }

  // Bare filename or relative key → assume uploads folder
  if (!cleaned.startsWith('/')) {
    cleaned = cleaned.startsWith('uploads/') ? `/${cleaned}` : `/uploads/${cleaned}`;
  } else if (!cleaned.startsWith('/uploads/') && !cleaned.includes('/')) {
    cleaned = `/uploads${cleaned}`;
  }

  const origin = mediaOrigin();
  if (!origin) {
    return cleaned;
  }
  return `${origin}${cleaned}`;
}

export function resolveMediaUrls(urls: string[] | undefined | null): string[] {
  return (urls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean);
}
