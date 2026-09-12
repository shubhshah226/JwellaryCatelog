import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { ApiHttpService } from '../api/api-http.service';
import { CatalogShareRecord } from '../../storefront/models/storefront.model';

export type CatalogSharePayload = CatalogShareRecord['payload'];

interface CreateCatalogResponse {
  success?: boolean;
  catalogId?: string;
  token?: string;
  catalogUrl?: string;
  whatsappUrl?: string;
  title?: string;
  itemCount?: number;
  message?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogShareService {
  private readonly api = inject(ApiHttpService);

  /**
   * Creates a shareable catalog via POST /catalog/createCatalog
   * (replaces old /vendor/catalog-shares short links).
   */
  createShortLink(
    vendorId: number | string,
    storeCode: string,
    payload: CatalogSharePayload
  ): Observable<CatalogShareRecord> {
    const productIds = (payload.productIds ?? []).map(String);
    return this.api
      .post<CreateCatalogResponse>('/catalog/createCatalog', {
        title: payload.shareLabel || `Catalog for ${payload.customerName || 'customer'}`,
        customerName: payload.customerName || null,
        customerPhone: payload.customerPhone || null,
        productIds: productIds.length ? productIds : null,
        selectAll: false,
        priceVisible: true,
      })
      .pipe(
        map((res) => {
          if (!res?.success || !res.catalogId) {
            throw new Error(res?.message || 'Unable to create share link.');
          }
          const token = res.token || '';
          return {
            shortCode: token,
            vendorId,
            storeCode,
            payload: {
              ...payload,
              catalogId: res.catalogId,
              productIds,
            },
            createdAt: new Date().toISOString(),
            url: res.catalogUrl || '',
          };
        })
      );
  }

  /** @deprecated Prefer public fetchCatalog by token */
  getByShortCode(_shortCode: string): Observable<CatalogSharePayload | null> {
    return of(null);
  }

  async encode(payload: CatalogSharePayload): Promise<string> {
    return btoa(JSON.stringify(payload));
  }

  async decode(token: string): Promise<CatalogSharePayload | null> {
    try {
      return JSON.parse(atob(token)) as CatalogSharePayload;
    } catch {
      return null;
    }
  }
}
