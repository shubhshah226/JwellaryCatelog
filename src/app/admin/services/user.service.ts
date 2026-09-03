import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import {
  AppUser,
  SortDirection,
  UserFilters,
  UserFormData,
  UserSortField,
} from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api = inject(ApiHttpService);

  getUsers(): Observable<AppUser[]> {
    return this.api
      .get<AppUser[]>('/admin/users')
      .pipe(map((users) => users.map((u) => this.sanitizeUser(u))));
  }

  createUser(form: UserFormData, _existingUsers: AppUser[]): Observable<AppUser> {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      vendorId: form.role === 'vendor' && form.vendorId ? Number(form.vendorId) : null,
    };
    return this.api.post<AppUser>('/admin/users', payload).pipe(map((u) => this.sanitizeUser(u)));
  }

  updateUser(user: AppUser, form: UserFormData, newPassword?: string): Observable<AppUser> {
    const payload: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      vendorId: form.role === 'vendor' && form.vendorId ? Number(form.vendorId) : null,
    };
    if (newPassword?.trim()) {
      payload['password'] = newPassword.trim();
    }
    return this.api
      .put<AppUser>(`/admin/users/${user.id}`, payload)
      .pipe(map((u) => this.sanitizeUser(u)));
  }

  deleteUser(id: number): Observable<void> {
    return this.api.delete<void>(`/admin/users/${id}`);
  }

  filterUsers(users: AppUser[], filters: UserFilters): AppUser[] {
    const search = filters.search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search) ||
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search);
      const matchesRole = filters.role === 'all' || user.role === filters.role;
      return matchesSearch && matchesRole;
    });
  }

  sortUsers(users: AppUser[], field: UserSortField, direction: SortDirection): AppUser[] {
    const sorted = [...users].sort((a, b) => {
      const left = String(a[field] ?? '');
      const right = String(b[field] ?? '');
      const comparison = left.localeCompare(right, undefined, { sensitivity: 'base' });
      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }

  mapUserToForm(user: AppUser): UserFormData {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      vendorId: user.vendorId != null ? String(user.vendorId) : '',
    };
  }

  private sanitizeUser(user: AppUser): AppUser {
    return {
      id: Number(user.id),
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      vendorId: user.vendorId != null ? Number(user.vendorId) : undefined,
    };
  }
}
