import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ApiHttpService } from '../../core/api/api-http.service';
import { environment } from '../../../environments/environment';
import { Product, ProductFormData, ProductStatus } from '../../dashboard/models/dashboard.model';

interface ApiProductListItem {
  productId?: string;
  skuCode?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  metalTypeId?: string | null;
  metalType?: string | null;
  purityId?: string | null;
  purity?: string | null;
  colorId?: string | null;
  color?: string | null;
  grossWeight?: number | null;
  price?: number | null;
  stockStatus?: string | null;
  status?: string | null;
  collectionName?: string | null;
  primaryImageId?: string | null;
  imageCount?: number | null;
}

interface ApiProductListResponse {
  products?: ApiProductListItem[];
  totalCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly api = inject(ApiHttpService);

  getVendorProducts(): Observable<Product[]> {
    return this.api
      .post<ApiProductListResponse>('/product/productList', {
        status: null,
        search: null,
        pageSize: null,
        pageOffset: null,
      })
      .pipe(map((res) => (res?.products ?? []).map((p) => this.normalizeListItem(p))));
  }

  createProduct(form: ProductFormData, _existing: Product[]): Observable<Product> {
    const formData = new FormData();
    const productJson = {
      skuCode: form.sku.trim() || `SKU-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim() || null,
      categoryName: form.category.trim() || null,
      grossWeight: this.parseWeight(form.weight) ?? 0,
      price: form.price == null || form.price === ('' as unknown) ? null : Number(form.price),
      stockStatus: this.toApiStockStatus(form.status),
      status: 'active',
    };
    formData.append('product', JSON.stringify(productJson));

    const files = this.collectImageFiles(form);
    if (!files.length) {
      return throwError(() => new Error('Please add at least one product image.'));
    }
    for (const file of files) {
      formData.append('images', file, file.name);
    }

    return this.api.postFormData<{ product?: ApiProductListItem; productId?: string }>(
      '/product/addProduct',
      formData
    ).pipe(
      map((res) => {
        const productId = res?.productId || res?.product?.productId;
        return this.normalizeListItem({
          productId,
          name: form.name.trim(),
          skuCode: productJson.skuCode,
          categoryName: form.category,
          grossWeight: productJson.grossWeight,
          price: productJson.price,
          stockStatus: productJson.stockStatus,
          status: 'active',
          metalType: form.metalType || null,
          purity: form.purity || null,
          color: form.color || null,
        });
      }),
      catchError((err: unknown) => {
        if (err instanceof ApiClientError) {
          return throwError(() => new Error(err.message || 'Failed to add product.'));
        }
        return throwError(() => new Error('Unable to connect to the API server.'));
      })
    );
  }

  updateProduct(product: Product, form: ProductFormData): Observable<Product> {
    return this.api
      .post<unknown>('/product/updateProduct', {
        productId: product.id,
        skuCode: form.sku.trim() || product.sku,
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryName: form.category.trim() || null,
        grossWeight: this.parseWeight(form.weight),
        price: form.price == null ? null : Number(form.price),
        stockStatus: this.toApiStockStatus(form.status),
        status: form.status === 'inactive' ? 'inactive' : 'active',
      })
      .pipe(
        map(() => ({
          ...product,
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim(),
          price: form.price,
          metalType: form.metalType,
          weight: form.weight,
          purity: form.purity,
          sku: form.sku.trim(),
          color: form.color,
          status: this.normalizeStatus(form.status),
          stockStatus: this.toApiStockStatus(form.status),
        })),
        catchError((err: unknown) => {
          if (err instanceof ApiClientError) {
            return throwError(() => new Error(err.message || 'Failed to update product.'));
          }
          return throwError(() => new Error('Unable to connect to the API server.'));
        })
      );
  }

  deleteProduct(productId: string): Observable<void> {
    return this.api.post<void>('/product/deleteProduct', { productId });
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
      catalogId: product.catalogId ?? null,
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
      status: this.normalizeStatus(product.status || product.stockStatus),
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
      const matchesCatalog =
        catalogId === 'all' || String(item.catalogId ?? '') === String(catalogId);
      const itemStatus = this.normalizeStatus(item.status || item.stockStatus);
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

  private normalizeListItem(product: ApiProductListItem): Product {
    const imageUrl = product.primaryImageId
      ? `${environment.apiBaseUrl}/public/productImage/pending/${product.primaryImageId}/grid`
      : '';
    return {
      id: String(product.productId || ''),
      name: product.name || '',
      category: product.categoryName || '',
      categoryId: product.categoryId || null,
      price: product.price == null ? null : Number(product.price),
      metalType: product.metalType || '',
      metalTypeId: product.metalTypeId || null,
      weight: product.grossWeight != null ? String(product.grossWeight) : '',
      purity: product.purity || '',
      purityId: product.purityId || null,
      sku: product.skuCode || '',
      color: product.color || '',
      colorId: product.colorId || null,
      status: this.normalizeStatus(product.stockStatus || product.status),
      stockStatus: product.stockStatus || '',
      imageUrl,
      images: imageUrl ? [imageUrl] : [],
    };
  }

  private normalizeStatus(status?: string | null): ProductStatus {
    const value = (status || 'in_stock').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (value === 'active' || value === 'available' || value === 'in_stock') {
      return 'in_stock';
    }
    if (value === 'out_of_stock' || value === 'oos') {
      return 'out_of_stock';
    }
    if (value === 'make_to_order' || value === 'mto') {
      return 'make_to_order';
    }
    if (value === 'inactive') {
      return 'inactive';
    }
    return 'in_stock';
  }

  private toApiStockStatus(status?: string | null): string {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'out_of_stock') {
      return 'out_of_stock';
    }
    if (normalized === 'make_to_order') {
      return 'make_to_order';
    }
    return 'in_stock';
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

  private collectImageFiles(form: ProductFormData): File[] {
    const urls = [
      form.imageUrl,
      ...(form.galleryImages ?? []),
      ...(form.images ?? []),
    ].filter(Boolean);
    const unique = [...new Set(urls)];
    const files: File[] = [];
    let index = 0;
    for (const url of unique) {
      const file = this.dataUrlToFile(url, `product-${index++}.jpg`);
      if (file) {
        files.push(file);
      }
    }
    return files;
  }

  private dataUrlToFile(url: string, filename: string): File | null {
    if (!url?.startsWith('data:')) {
      return null;
    }
    const parts = url.split(',');
    if (parts.length < 2) {
      return null;
    }
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mime = mimeMatch?.[1] || 'image/jpeg';
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  }
}
