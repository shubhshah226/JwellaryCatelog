import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '@common/api/api-http.service';

export interface MasterDataItem {
  id: string;
  vendorId?: string | null;
  name: string;
  status: 'active' | 'inactive' | string;
  masterType?: string;
  productCount?: number;
  /** Category hierarchy: null/empty = top-level */
  parentId?: string | null;
  parentName?: string | null;
  /** Display order in lists / filters */
  sortOrder?: number | null;
}

/** One category row inside POST /master/addCategory */
export class CategoryParamModel {
  public categoryName: string = '';
  public parentId: string | null = null;
  public sortOrder: number | null = null;
}

/** Payload for POST /master/addCategory */
export class AddCategoryParamModel {
  public tenantId: string | null = null;
  public categories: CategoryParamModel[] = [];
}

interface ApiCategory {
  categoryId?: string;
  categoryName?: string;
  parentId?: string | null;
  parentName?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
  productCount?: number;
}

interface ApiMaster {
  masterId?: string;
  masterType?: string;
  masterValue?: string;
  isActive?: boolean;
  productCount?: number;
  sortOrder?: number | null;
}

interface MasterActionResponse {
  success?: boolean;
  message?: string | null;
  successCount?: number;
  skippedCount?: number;
  categoryIds?: string[];
  masterIds?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MasterDataService {
  private readonly api = inject(ApiHttpService);

  getCategories(): Observable<MasterDataItem[]> {
    return this.api
      .post<ApiCategory[]>('/master/categoryList', {
        tenantId: null,
        parentId: null,
        isActive: null,
      })
      .pipe(map((items) => (items ?? []).map((i) => this.normalizeCategory(i))));
  }

  /** Top-level only — used as Parent dropdown options. */
  getParentCategoryOptions(excludeId?: string | null): Observable<MasterDataItem[]> {
    return this.getCategories().pipe(
      map((items) =>
        items.filter(
          (item) =>
            item.status === 'active' &&
            !item.parentId &&
            (!excludeId || item.id !== excludeId)
        )
      )
    );
  }

  createCategory(param: AddCategoryParamModel): Observable<MasterDataItem> {
    const first = param.categories[0];
    return this.api.post<MasterActionResponse>('/master/addCategory', param).pipe(
      map((res) => {
        if (!res?.success || !res.categoryIds?.length) {
          throw new Error(res?.message || 'Unable to create category.');
        }
        return {
          id: String(res.categoryIds[0]),
          name: first?.categoryName?.trim() || '',
          status: 'active',
          parentId: first?.parentId ?? null,
          parentName: null,
          sortOrder: first?.sortOrder ?? null,
          productCount: 0,
        } satisfies MasterDataItem;
      })
    );
  }

  updateCategory(
    id: string,
    payload: {
      name?: string;
      status?: string;
      parentId?: string | null;
      sortOrder?: number | null;
    }
  ): Observable<MasterDataItem> {
    return this.api
      .post<ApiCategory | MasterActionResponse | null>('/master/updateCategory', {
        tenantId: null,
        categoryId: id,
        categoryName: payload.name?.trim() || null,
        parentId: payload.parentId ?? null,
        sortOrder: payload.sortOrder ?? null,
        isActive: payload.status ? payload.status !== 'inactive' : null,
      })
      .pipe(
        map((res) => {
          if (res && typeof res === 'object' && 'categoryId' in res && res.categoryId) {
            return this.normalizeCategory(res);
          }
          // API may return success payload without the full category row
          return {
            id,
            name: payload.name?.trim() || '',
            status: payload.status === 'inactive' ? 'inactive' : 'active',
            parentId: payload.parentId ?? null,
            parentName: null,
            sortOrder: payload.sortOrder ?? null,
            productCount: 0,
          } satisfies MasterDataItem;
        })
      );
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
    return this.deleteMaster(id);
  }

  getPurities(): Observable<MasterDataItem[]> {
    return this.getMastersByType('purity');
  }

  createPurity(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.createMaster('purity', name, status);
  }

  updatePurity(
    id: string,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.updateMaster(id, payload);
  }

  deletePurity(id: string): Observable<void> {
    return this.deleteMaster(id);
  }

  getColors(): Observable<MasterDataItem[]> {
    return this.getMastersByType('color');
  }

  createColor(name: string, status = 'active'): Observable<MasterDataItem> {
    return this.createMaster('color', name, status);
  }

  updateColor(
    id: string,
    payload: { name?: string; status?: string }
  ): Observable<MasterDataItem> {
    return this.updateMaster(id, payload);
  }

  deleteColor(id: string): Observable<void> {
    return this.deleteMaster(id);
  }

  /** POST /master/masterList â€” filter by masterType (metal_type | purity | color). */
  getMastersByType(masterType: string): Observable<MasterDataItem[]> {
    return this.api
      .post<ApiMaster[]>('/master/masterList', {
        tenantId: null,
        masterType,
        isActive: null,
      })
      .pipe(map((items) => (items ?? []).map((i) => this.normalizeMaster(i))));
  }

  /** POST /master/addMaster */
  createMaster(
    masterType: string,
    name: string,
    status = 'active'
  ): Observable<MasterDataItem> {
    return this.api
      .post<MasterActionResponse>('/master/addMaster', {
        tenantId: null,
        masters: [{ masterType, masterValue: name.trim(), sortOrder: null }],
      })
      .pipe(
        map((res) => {
          if (!res?.success || !res.masterIds?.length) {
            throw new Error(res?.message || 'Unable to create master value.');
          }
          return {
            id: String(res.masterIds[0]),
            name: name.trim(),
            status: status === 'inactive' ? 'inactive' : 'active',
            masterType,
            productCount: 0,
          } satisfies MasterDataItem;
        })
      );
  }

  /** POST /master/updateMaster */
  updateMaster(
    id: string,
    payload: { name?: string; status?: string; sortOrder?: number | null }
  ): Observable<MasterDataItem> {
    return this.api
      .post<ApiMaster | MasterActionResponse | null>('/master/updateMaster', {
        tenantId: null,
        masterId: id,
        masterValue: payload.name?.trim() || null,
        isActive: payload.status ? payload.status !== 'inactive' : null,
        sortOrder: payload.sortOrder ?? null,
      })
      .pipe(
        map((res) => {
          if (res && typeof res === 'object' && 'masterId' in res && res.masterId) {
            return this.normalizeMaster(res);
          }
          return {
            id,
            name: payload.name?.trim() || '',
            status: payload.status === 'inactive' ? 'inactive' : 'active',
            productCount: 0,
            sortOrder: payload.sortOrder ?? null,
          } satisfies MasterDataItem;
        })
      );
  }

  /** Soft-deactivate master row. */
  deleteMaster(id: string): Observable<void> {
    return this.updateMaster(id, { status: 'inactive' }).pipe(map(() => undefined));
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
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.parentName || '').toLowerCase().includes(term);
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
      const orderCmp = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderCmp !== 0) {
        return orderCmp * dir;
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
      parentId: item.parentId ? String(item.parentId) : null,
      parentName: item.parentName || null,
      sortOrder: item.sortOrder ?? null,
    };
  }

  private normalizeMaster(item: ApiMaster): MasterDataItem {
    return {
      id: String(item.masterId || ''),
      name: item.masterValue || '',
      status: item.isActive === false ? 'inactive' : 'active',
      masterType: item.masterType,
      productCount: Number(item.productCount ?? 0),
      sortOrder: item.sortOrder ?? null,
    };
  }
}
