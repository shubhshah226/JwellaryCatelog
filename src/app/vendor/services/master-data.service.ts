import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';

export interface MasterDataItem {
  id: number;
  vendorId: number;
  name: string;
  status: 'active' | 'inactive' | string;
}

@Injectable({
  providedIn: 'root',
})
export class MasterDataService {
  private readonly api = inject(ApiHttpService);

  getCategories(): Observable<MasterDataItem[]> {
    return this.api
      .get<MasterDataItem[]>('/vendor/master-data/categories')
      .pipe(map((items) => (items ?? []).map((i) => this.normalize(i))));
  }

  createCategory(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.api
      .post<MasterDataItem>('/vendor/master-data/categories', { name, status })
      .pipe(map((i) => this.normalize(i)));
  }

  updateCategory(
    id: number,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.api
      .put<MasterDataItem>(`/vendor/master-data/categories/${id}`, payload)
      .pipe(map((i) => this.normalize(i)));
  }

  deleteCategory(id: number): Observable<void> {
    return this.api.delete<void>(`/vendor/master-data/categories/${id}`);
  }

  getMetalTypes(): Observable<MasterDataItem[]> {
    return this.api
      .get<MasterDataItem[]>('/vendor/master-data/metal-types')
      .pipe(map((items) => (items ?? []).map((i) => this.normalize(i))));
  }

  createMetalType(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.api
      .post<MasterDataItem>('/vendor/master-data/metal-types', { name, status })
      .pipe(map((i) => this.normalize(i)));
  }

  updateMetalType(
    id: number,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.api
      .put<MasterDataItem>(`/vendor/master-data/metal-types/${id}`, payload)
      .pipe(map((i) => this.normalize(i)));
  }

  deleteMetalType(id: number): Observable<void> {
    return this.api.delete<void>(`/vendor/master-data/metal-types/${id}`);
  }

  filterItems(
    items: MasterDataItem[],
    search: string,
    status: string,
    sortBy: 'name' | 'status' | 'id' = 'name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): MasterDataItem[] {
    const term = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesStatus;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'status') {
        const cmp = a.status.localeCompare(b.status);
        return cmp !== 0 ? cmp * dir : a.name.localeCompare(b.name);
      }
      if (sortBy === 'id') {
        return (a.id - b.id) * dir;
      }
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return cmp * dir;
    });
  }

  private normalize(item: MasterDataItem): MasterDataItem {
    return {
      id: Number(item.id),
      vendorId: Number(item.vendorId),
      name: item.name,
      status: item.status ?? 'active',
    };
  }
}
