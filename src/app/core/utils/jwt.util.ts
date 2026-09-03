import { UserRole } from '../../auth/models/user.model';

export interface JwtPayload {
  role?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  sub?: string;
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
  if (payload?.role === 'admin' || payload?.role === 'vendor') {
    return payload.role;
  }

  return null;
}
