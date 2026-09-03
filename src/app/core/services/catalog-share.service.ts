import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../api/api-http.service';
import { CatalogShareRecord } from '../../storefront/models/storefront.model';

export type CatalogSharePayload = CatalogShareRecord['payload'];

interface ShareCreateResponse {
  shortCode: string;
  url: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogShareService {
  private readonly api = inject(ApiHttpService);

  createShortLink(
    vendorId: number,
    storeCode: string,
    payload: CatalogSharePayload
  ): Observable<CatalogShareRecord> {
    return this.api
      .post<ShareCreateResponse>('/vendor/catalog-shares', { payload })
      .pipe(
        map((res) => ({
          shortCode: res.shortCode,
          vendorId,
          storeCode,
          payload,
          createdAt: res.createdAt,
          url: res.url,
        }))
      );
  }

  /** @deprecated Prefer public shared catalog endpoint */
  getByShortCode(_shortCode: string): Observable<CatalogSharePayload | null> {
    return new Observable((sub) => {
      sub.next(null);
      sub.complete();
    });
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
