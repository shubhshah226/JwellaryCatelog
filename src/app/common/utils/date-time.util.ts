/** India Standard Time — used for all vendor-facing timestamps. */
export const INDIA_TIME_ZONE = 'Asia/Kolkata';

/**
 * Parse API datetime strings. Naive ISO (no Z / offset) is treated as UTC,
 * since the backend stores and serializes UTC without a timezone suffix.
 */
export function parseApiUtc(iso?: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const trimmed = iso.trim();
  if (!trimmed) {
    return null;
  }
  // Already has timezone (Z or ±HH:MM)
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // "2026-09-03T04:30:00" or "2026-09-03 04:30:00" → force UTC
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const d = new Date(`${normalized}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function indiaParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

/** Grid/table datetime: dd/mm/yyyy hh:mm AM|PM (India). */
export function formatGridDateTime(value?: string | Date | null): string {
  const date =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? null
        : value
      : parseApiUtc(value);
  if (!date) {
    return '—';
  }

  const map = indiaParts(date);
  const day = map['day'] ?? '00';
  const month = map['month'] ?? '00';
  const year = map['year'] ?? '0000';
  const hour = map['hour'] ?? '00';
  const minute = map['minute'] ?? '00';
  const dayPeriod = (map['dayPeriod'] ?? 'AM').toUpperCase();
  return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
}

/** yyyy-mm-dd in India timezone — useful for date input filters. */
export function formatIndiaDateKey(value?: string | Date | null): string {
  const date =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? null
        : value
      : parseApiUtc(value);
  if (!date) {
    return '';
  }
  const map = indiaParts(date);
  return `${map['year']}-${map['month']}-${map['day']}`;
}

/** Absolute date+time in India timezone, e.g. "03 Sep 2026, 10:00 am". */
export function formatInIndia(iso?: string | null): string {
  const date = parseApiUtc(iso);
  if (!date) {
    return '—';
  }
  return date.toLocaleString('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Relative label from a UTC API timestamp (diff uses real UTC instants). */
export function relativeTimeFromUtc(iso?: string | null): string {
  const date = parseApiUtc(iso);
  if (!date) {
    return '';
  }
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'Just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

