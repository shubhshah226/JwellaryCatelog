export function buildPublicStoreUrl(storeCode: string): string {
  if (typeof window === 'undefined') {
    return `/${storeCode}/products`;
  }
  return `${window.location.origin}/${storeCode}/products`;
}

/** Absolute public share URL — API shape: /c/{token}. */
export function buildCatalogShareUrl(token: string): string {
  const path = `/c/${encodeURIComponent(token)}`;
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.origin}${path}`;
}

/** Normalize API share path or absolute URL to current origin (/c/{token}). */
export function resolveShareUrl(
  urlOrPath: string | null | undefined,
  _storeCode?: string,
  shortCode?: string | null
): string {
  if (shortCode) {
    return buildCatalogShareUrl(shortCode);
  }
  if (!urlOrPath) {
    return '';
  }
  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      const parsed = new URL(urlOrPath);
      const match =
        parsed.pathname.match(/\/c\/([^/]+)/) ||
        parsed.pathname.match(/\/[^/]+\/c\/([^/]+)/);
      if (match?.[1]) {
        return buildCatalogShareUrl(match[1]);
      }
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${parsed.pathname}`;
      }
    } catch {
      /* fall through */
    }
  }
  if (urlOrPath.startsWith('/')) {
    const match =
      urlOrPath.match(/\/c\/([^/]+)/) || urlOrPath.match(/\/[^/]+\/c\/([^/]+)/);
    if (match?.[1]) {
      return buildCatalogShareUrl(match[1]);
    }
    return typeof window === 'undefined'
      ? urlOrPath
      : `${window.location.origin}${urlOrPath}`;
  }
  return urlOrPath;
}
