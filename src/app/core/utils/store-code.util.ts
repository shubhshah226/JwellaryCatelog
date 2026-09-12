/**
 * Generates a deterministic, URL-safe store code from vendor id + name.
 * Format: {3-char name prefix}{3-char base36 id}{2-char checksum}
 * Example: Shubh Jewellers, id 1 → "shu001l6"
 *
 * Same inputs always produce the same code (not random).
 * The checksum helps catch typos in URLs.
 */
export function generateStoreCode(vendorId: number, vendorName: string): string {
  const prefix = vendorName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 3)
    .padEnd(3, 'x');

  const idPart = vendorId.toString(36).padStart(3, '0').slice(-3);

  let hash = 0;
  const input = `${vendorId}:${vendorName.toLowerCase().trim()}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const checksum = (hash % 1296).toString(36).padStart(2, '0');

  return `${prefix}${idPart}${checksum}`;
}

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
