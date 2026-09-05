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
