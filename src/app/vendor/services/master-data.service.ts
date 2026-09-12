import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';

export interface MasterDataItem {
  id: string;
  vendorId?: string | null;
  name: string;
  status: 'active' | 'inactive' | string;
  masterType?: string;
  productCount?: number;
}

interface ApiCategory {
  categoryId?: string;
  categoryName?: string;
  isActive?: boolean;
  productCount?: number;
}

interface ApiMaster {
  masterId?: string;
  masterType?: string;
  masterValue?: string;
  isActive?: boolean;
  productCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MasterDataService {
  private readonly api = inject(ApiHttpService);

  getCategories(): Observable<MasterDataItem[]> {
    return this.api
      .post<ApiCategory[]>('/master/categoryList', { isActive: null })
      .pipe(map((items) => (items ?? []).map((i) => this.normalizeCategory(i))));
  }

  createCategory(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.api
      .post<{ success?: boolean; message?: string | null; categories?: ApiCategory[] }>(
        '/master/addCategory',
        {
          categories: [{ categoryName: name.trim(), parentId: null, sortOrder: null }],
        }
      )
      .pipe(
        map((res) => {
          const created = res?.categories?.[0];
          if (!created?.categoryId) {
            throw new Error(res?.message || 'Unable to create category.');
          }
          return this.normalizeCategory({
            ...created,
            categoryName: created.categoryName || name.trim(),
            isActive: status !== 'inactive',
          });
        })
      );
  }

  updateCategory(
    id: string,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.api
      .post<ApiCategory>('/master/updateCategory', {
        categoryId: id,
        categoryName: payload.name?.trim() || null,
        isActive: payload.status ? payload.status !== 'inactive' : null,
        parentId: null,
        sortOrder: null,
      })
      .pipe(map((i) => this.normalizeCategory(i)));
  }

  /** Soft-deactivate (API has no hard delete). */
  deleteCategory(id: string): Observable<void> {
    return this.updateCategory(id, { status: 'inactive' }).pipe(map(() => undefined));
  }

  getMetalTypes(): Observable<MasterDataItem[]> {
    return this.getMastersByType('metal_type');
  }

  createMetalType(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.createMaster('metal_type', name, status);
  }

  updateMetalType(
    id: string,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.updateMaster(id, payload);
  }

  deleteMetalType(id: string): Observable<void> {
    return this.updateMaster(id, { status: 'inactive' }).pipe(map(() => undefined));
  }

  getPurities(): Observable<MasterDataItem[]> {
    return this.getMastersByType('purity');
  }

  getColors(): Observable<MasterDataItem[]> {
    return this.getMastersByType('color');
  }

  getMastersByType(masterType: string): Observable<MasterDataItem[]> {
    return this.api
      .post<ApiMaster[]>('/master/masterList', { masterType, isActive: null })
      .pipe(map((items) => (items ?? []).map((i) => this.normalizeMaster(i))));
  }

  createMaster(
    masterType: string,
    name: string,
    status = 'active'
  ): Observable<MasterDataItem> {
    return this.api
      .post<{ success?: boolean; message?: string | null; masters?: ApiMaster[] }>(
        '/master/addMaster',
        {
          masters: [{ masterType, masterValue: name.trim(), sortOrder: null }],
        }
      )
      .pipe(
        map((res) => {
          const created = res?.masters?.[0];
          if (!created?.masterId) {
            throw new Error(res?.message || 'Unable to create master value.');
          }
          return this.normalizeMaster({
            ...created,
            masterValue: created.masterValue || name.trim(),
            masterType,
            isActive: status !== 'inactive',
          });
        })
      );
  }

  updateMaster(
    id: string,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.api
      .post<ApiMaster>('/master/updateMaster', {
        masterId: id,
        masterValue: payload.name?.trim() || null,
        isActive: payload.status ? payload.status !== 'inactive' : null,
        sortOrder: null,
      })
      .pipe(map((i) => this.normalizeMaster(i)));
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
        return a.id.localeCompare(b.id) * dir;
      }
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return cmp * dir;
    });
  }

  private normalizeCategory(item: ApiCategory): MasterDataItem {
    return {
      id: String(item.categoryId || ''),
      name: item.categoryName || '',
      status: item.isActive === false ? 'inactive' : 'active',
      productCount: Number(item.productCount ?? 0),
    };
  }

  private normalizeMaster(item: ApiMaster): MasterDataItem {
    return {
      id: String(item.masterId || ''),
      name: item.masterValue || '',
      status: item.isActive === false ? 'inactive' : 'active',
      masterType: item.masterType,
      productCount: Number(item.productCount ?? 0),
    };
  }
}
