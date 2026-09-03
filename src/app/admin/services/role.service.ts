import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import {
  AppRole,
  RoleFilters,
  RoleFormData,
  RoleSortField,
  SortDirection,
} from '../models/role.model';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly api = inject(ApiHttpService);

  getRoles(): Observable<AppRole[]> {
    return this.api.get<AppRole[]>('/admin/roles').pipe(
      map((roles) =>
        roles.map((role) => ({
          ...role,
          id: Number(role.id),
          isSystem: !!role.isSystem,
        }))
      )
    );
  }

  createRole(form: RoleFormData, _existingRoles: AppRole[]): Observable<AppRole> {
    const payload = {
      name: form.name.trim(),
      code: this.normalizeCode(form.code),
      description: form.description.trim(),
      status: form.status,
    };
    return this.api.post<AppRole>('/admin/roles', payload);
  }

  updateRole(role: AppRole, form: RoleFormData): Observable<AppRole> {
    const payload = {
      name: form.name.trim(),
      code: this.normalizeCode(form.code),
      description: form.description.trim(),
      status: form.status,
    };
    return this.api.put<AppRole>(`/admin/roles/${role.id}`, payload);
  }

  deleteRole(id: number): Observable<void> {
    return this.api.delete<void>(`/admin/roles/${id}`);
  }

  filterRoles(roles: AppRole[], filters: RoleFilters): AppRole[] {
    const search = filters.search.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesSearch =
        !search ||
        role.name.toLowerCase().includes(search) ||
        role.code.toLowerCase().includes(search) ||
        role.description.toLowerCase().includes(search);
      const matchesStatus = filters.status === 'all' || role.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }

  sortRoles(roles: AppRole[], field: RoleSortField, direction: SortDirection): AppRole[] {
    const sorted = [...roles].sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'createdOn':
          comparison = this.parseDate(a.createdOn) - this.parseDate(b.createdOn);
          break;
        default:
          comparison = a[field].localeCompare(b[field], undefined, { sensitivity: 'base' });
      }
      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }

  normalizeCode(code: string): string {
    return code
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private parseDate(value: string): number {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
}
