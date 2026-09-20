/** Keep only digits, max 10 (Indian mobile). */
export function sanitizePhoneDigits(value: string | null | undefined, maxLength = 10): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, maxLength);
}

export function isCompletePhone(value: string | null | undefined): boolean {
  return /^\d{10}$/.test(String(value ?? '').trim());
}

/** Empty is OK for optional fields; incomplete/non-digit content returns a message. */
export function phoneFieldError(
  value: string | null | undefined,
  options?: { required?: boolean; label?: string }
): string {
  const phone = String(value ?? '').trim();
  const label = options?.label ?? 'Phone';

  if (!phone) {
    return options?.required ? `${label} is required.` : '';
  }

  if (!/^\d+$/.test(phone)) {
    return `${label} must contain only numbers.`;
  }

  if (phone.length !== 10) {
    return `${label} must be a 10-digit number.`;
  }

  return '';
}

const PHONE_NAV_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

/** Returns true when the key should be blocked for a phone field. */
export function shouldBlockPhoneKey(event: KeyboardEvent): boolean {
  if (PHONE_NAV_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return !/^\d$/.test(event.key);
}
