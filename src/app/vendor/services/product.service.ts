import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ApiHttpService } from '../../core/api/api-http.service';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
import { Product, ProductFormData, ProductStatus } from '../../dashboard/models/dashboard.model';

interface ApiProductImage {
  id?: number;
  url: string;
  sortOrder?: number;
  isCover?: boolean;
}

interface ApiProduct extends Omit<Product, 'images'> {
  images?: ApiProductImage[] | string[];
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly api = inject(ApiHttpService);

  getVendorProducts(): Observable<Product[]> {
    return this.api
      .get<ApiProduct[]>('/vendor/products')
      .pipe(map((items) => items.map((p) => this.normalize(p))));
  }

  createProduct(form: ProductFormData, _existing: Product[]): Observable<Product> {
    return this.api.post<ApiProduct>('/vendor/products', this.buildPayload(form)).pipe(
      map((p) => this.normalize(p)),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Failed to add product.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  updateProduct(product: Product, form: ProductFormData): Observable<Product> {
    return this.api.put<ApiProduct>(`/vendor/products/${product.id}`, this.buildPayload(form)).pipe(
      map((p) => this.normalize(p)),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Failed to update product.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  deleteProduct(productId: number): Observable<void> {
    return this.api.delete<void>(`/vendor/products/${productId}`);
  }

  mapToForm(product: Product): ProductFormData {
    const all =
      product.images?.length
        ? [...product.images]
        : product.imageUrl
          ? [product.imageUrl]
          : [];
    const cover = all[0] ?? '';
    const gallery = all.slice(1);

    return {
      name: product.name,
      category: product.category,
      catalogId: product.catalogId,
      description: product.description ?? '',
      price: product.price ?? null,
      imageUrl: cover,
      galleryImages: gallery,
      images: all,
      metalType: product.metalType ?? '',
      weight: product.weight ?? '',
      purity: product.purity ?? '',
      sku: product.sku ?? '',
      color: product.color ?? '',
      status: this.normalizeStatus(product.status),
    };
  }

  filterProducts(
    products: Product[],
    search: string,
    category: string,
    catalogId: string,
    status = 'all',
    metalType = 'all',
    minPrice?: number | null,
    maxPrice?: number | null,
    minWeight?: number | null,
    maxWeight?: number | null
  ): Product[] {
    const term = search.trim().toLowerCase();
    return products.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.sku ?? '').toLowerCase().includes(term);
      const matchesCategory = category === 'all' || item.category === category;
      const matchesCatalog = catalogId === 'all' || item.catalogId === Number(catalogId);
      const itemStatus = this.normalizeStatus(item.status);
      const matchesStatus = status === 'all' || itemStatus === status;
      const matchesMetal = metalType === 'all' || item.metalType === metalType;
      const price = item.price ?? null;
      const matchesMinPrice = minPrice == null || (price != null && price >= minPrice);
      const matchesMaxPrice = maxPrice == null || (price != null && price <= maxPrice);
      const weight = this.parseWeight(item.weight);
      const matchesMinWeight = minWeight == null || (weight != null && weight >= minWeight);
      const matchesMaxWeight = maxWeight == null || (weight != null && weight <= maxWeight);
      return (
        matchesSearch &&
        matchesCategory &&
        matchesCatalog &&
        matchesStatus &&
        matchesMetal &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesMinWeight &&
        matchesMaxWeight
      );
    });
  }

  stockLabel(status?: string | null): string {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'out_of_stock') {
      return 'Out Of Stock';
    }
    if (normalized === 'make_to_order') {
      return 'Make to Order';
    }
    return 'In Stock';
  }

  private parseWeight(weight?: string | null): number | null {
    if (!weight) {
      return null;
    }
    const match = String(weight).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (!match) {
      return null;
    }
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Sends base64 data URLs (or existing /uploads paths) in JSON.
   * API saves cover as public image; gallery images are post-OTP only.
   * catalogId omitted so API assigns Default catalog.
   */
  private buildPayload(form: ProductFormData) {
    const cover = this.toStoredUrl(form.imageUrl);
    const gallery = (form.galleryImages ?? []).map((u) => this.toStoredUrl(u)).filter(Boolean);

    return {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price: form.price === null || form.price === undefined || form.price === ('' as unknown)
        ? null
        : Number(form.price),
      metalType: form.metalType || null,
      weight: form.weight.trim() || null,
      purity: form.purity.trim() || null,
      sku: form.sku.trim() || null,
      color: form.color.trim() || null,
      status: this.normalizeStatus(form.status),
      coverImage: cover || null,
      galleryImages: gallery,
    };
  }

  /** Keep data: URLs as-is; strip absolute API host from /uploads paths. */
  private toStoredUrl(url: string): string {
    if (!url) {
      return '';
    }
    if (url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('/uploads/')) {
      return url;
    }
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return url.slice(idx);
    }
    return url;
  }

  private normalize(product: ApiProduct): Product {
    const imageUrls = this.extractImageUrls(product);
    return {
      ...product,
      id: Number(product.id),
      vendorId: Number(product.vendorId),
      catalogId: Number(product.catalogId),
      price: product.price == null || product.price === ('' as unknown) ? null : Number(product.price),
      color: product.color ?? '',
      status: this.normalizeStatus(product.status),
      images: imageUrls,
      imageUrl: imageUrls[0] ?? resolveMediaUrl(product.imageUrl),
    };
  }

  private normalizeStatus(status?: string | null): ProductStatus {
    const value = (status || 'in_stock').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (value === 'active') {
      return 'in_stock';
    }
    if (value === 'inactive') {
      return 'out_of_stock';
    }
    if (value === 'out_of_stock' || value === 'make_to_order' || value === 'in_stock') {
      return value;
    }
    return 'in_stock';
  }

  private extractImageUrls(product: ApiProduct): string[] {
    if (product.images?.length) {
      const sorted = [...product.images].sort((a, b) => {
        if (typeof a === 'string' || typeof b === 'string') {
          return 0;
        }
        if (a.isCover && !b.isCover) {
          return -1;
        }
        if (!a.isCover && b.isCover) {
          return 1;
        }
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
      return sorted
        .map((img) => (typeof img === 'string' ? img : img.url))
        .map((u) => resolveMediaUrl(u))
        .filter(Boolean);
    }
    return product.imageUrl ? [resolveMediaUrl(product.imageUrl)] : [];
  }
}
