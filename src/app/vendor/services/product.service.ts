import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
import { Product, ProductFormData } from '../../dashboard/models/dashboard.model';

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
    return this.api
      .post<ApiProduct>('/vendor/products', this.buildPayload(form))
      .pipe(map((p) => this.normalize(p)));
  }

  updateProduct(product: Product, form: ProductFormData): Observable<Product> {
    return this.api
      .put<ApiProduct>(`/vendor/products/${product.id}`, this.buildPayload(form))
      .pipe(map((p) => this.normalize(p)));
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
      price: product.price,
      imageUrl: cover,
      galleryImages: gallery,
      images: all,
      metalType: product.metalType ?? 'Gold',
      weight: product.weight ?? '',
      purity: product.purity ?? '',
      sku: product.sku ?? '',
      status: product.status ?? 'active',
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
    maxPrice?: number | null
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
      const matchesStatus = status === 'all' || (item.status ?? 'active') === status;
      const matchesMetal = metalType === 'all' || item.metalType === metalType;
      const matchesMin = minPrice == null || item.price >= minPrice;
      const matchesMax = maxPrice == null || item.price <= maxPrice;
      return (
        matchesSearch &&
        matchesCategory &&
        matchesCatalog &&
        matchesStatus &&
        matchesMetal &&
        matchesMin &&
        matchesMax
      );
    });
  }

  /**
   * Sends base64 data URLs (or existing /uploads paths) in JSON.
   * API saves cover as public image; gallery images are post-OTP only.
   */
  private buildPayload(form: ProductFormData) {
    const cover = this.toStoredUrl(form.imageUrl);
    const gallery = (form.galleryImages ?? []).map((u) => this.toStoredUrl(u)).filter(Boolean);

    return {
      name: form.name.trim(),
      category: form.category,
      catalogId: form.catalogId,
      description: form.description.trim(),
      price: Number(form.price ?? 0),
      metalType: form.metalType,
      weight: form.weight.trim(),
      purity: form.purity.trim(),
      sku: form.sku.trim(),
      status: form.status,
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
      price: Number(product.price ?? 0),
      status: product.status ?? 'active',
      images: imageUrls,
      imageUrl: imageUrls[0] ?? resolveMediaUrl(product.imageUrl),
    };
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
