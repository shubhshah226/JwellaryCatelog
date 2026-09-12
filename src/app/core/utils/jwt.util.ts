import { UserRole } from '../../auth/models/user.model';

export interface JwtPayload {
  role?: string;
  user_role?: string;
  name?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  sub?: string;
  user_id?: string;
  tenant_id?: string | null;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string): UserRole | null {
  const payload = decodeJwtPayload(token);
  return normalizeAppRole(payload?.user_role || payload?.role);
}

/** Map API roles (superadmin/owner) and legacy names onto app roles. */
export function normalizeAppRole(raw: string | null | undefined): UserRole | null {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'superadmin' || value === 'super_admin' || value === 'admin') {
    return 'superadmin';
  }
  if (value === 'owner' || value === 'vendor' || value === 'jeweller' || value === 'seller') {
    return 'vendor';
  }
  if (value === 'customer') {
    return 'customer';
  }
  return null;
}
