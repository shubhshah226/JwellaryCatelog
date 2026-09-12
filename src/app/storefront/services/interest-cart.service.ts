import { Injectable, computed, signal } from '@angular/core';
import { PublicProduct } from '../models/storefront.model';

export interface CartProduct {
  id: string;
  name: string;
  category: string;
  price?: number;
  imageUrl?: string;
  sku?: string;
}

@Injectable({
  providedIn: 'root',
})
export class InterestCartService {
  private readonly storageKeyPrefix = 'jc_interest_cart_';
  private readonly itemsSignal = signal<CartProduct[]>([]);
  private activeStoreCode = '';

  readonly items = this.itemsSignal.asReadonly();
  readonly count = computed(() => this.itemsSignal().length);

  /** Call when entering a public store page so cart is scoped per store. */
  setStore(storeCode: string): void {
    if (this.activeStoreCode === storeCode) {
      return;
    }
    this.activeStoreCode = storeCode;
    this.itemsSignal.set(this.read(storeCode));
  }

  add(product: PublicProduct): { added: boolean; alreadyInCart: boolean } {
    const current = this.itemsSignal();
    if (current.some((p) => p.id === product.id)) {
      return { added: false, alreadyInCart: true };
    }

    const next: CartProduct[] = [
      ...current,
      {
        id: product.id,
        name: product.name,
        category: product.category ?? '',
        price: product.price,
        imageUrl: product.images?.[0] ?? product.imageUrl,
        sku: product.sku,
      },
    ];
    this.persist(next);
    return { added: true, alreadyInCart: false };
  }

  remove(productId: string): void {
    this.persist(this.itemsSignal().filter((p) => p.id !== productId));
  }

  clear(): void {
    this.persist([]);
  }

  has(productId: string): boolean {
    return this.itemsSignal().some((p) => p.id === productId);
  }

  private persist(items: CartProduct[]): void {
    this.itemsSignal.set(items);
    if (!this.activeStoreCode || typeof sessionStorage === 'undefined') {
      return;
    }
    sessionStorage.setItem(this.storageKey(this.activeStoreCode), JSON.stringify(items));
  }

  private read(storeCode: string): CartProduct[] {
    if (typeof sessionStorage === 'undefined') {
      return [];
    }
    try {
      const raw = sessionStorage.getItem(this.storageKey(storeCode));
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as CartProduct[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private storageKey(storeCode: string): string {
    return `${this.storageKeyPrefix}${storeCode}`;
  }
}
