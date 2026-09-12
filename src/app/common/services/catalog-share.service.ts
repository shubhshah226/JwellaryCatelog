import { Injectable, inject } from '@angular/core';
import { CatalogShareRecord } from '@public/models/storefront.model';

export type CatalogSharePayload = CatalogShareRecord['payload'];

@Injectable({
  providedIn: 'root',
})
export class CatalogShareService {
  /** Decode legacy share tokens still used by older public links. */
  async decode(token: string): Promise<CatalogSharePayload | null> {
    try {
      return JSON.parse(atob(token)) as CatalogSharePayload;
    } catch {
      return null;
    }
  }
}
