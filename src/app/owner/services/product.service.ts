import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concatMap, from, map, of, switchMap, throwError, toArray } from 'rxjs';
import { ApiClientError } from '@common/api/api.types';
import { ApiHttpService } from '@common/api/api-http.service';
import { AuthService } from '../../auth/services/auth.service';
import { environment } from '../../../environments/environment';
import { Product, ProductFormData, ProductStatus } from '@common/models/dashboard.model';

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
  description?: string | null;
}

interface ApiProductListResponse {
  products?: ApiProductListItem[];
  totalCount?: number;
}

interface ApiProductImage {
  imageId?: string;
  productId?: string;
  isPrimary?: boolean;
  sortOrder?: number | null;
}

interface ApiProductDetailResponse {
  product?: ApiProductListItem & {
    description?: string | null;
    netWeight?: number | null;
  };
  images?: ApiProductImage[];
  message?: string | null;
}

interface ProductActionResponse {
  success?: boolean;
  productId?: string;
  skuCode?: string;
  name?: string;
  imageIds?: string[];
  message?: string | null;
}

/** Existing saved photo (ids only â€” panel has no authenticated image stream). */
export interface ProductExistingImage {
  imageId: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductDetail {
  product: Product;
  images: ProductExistingImage[];
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly api = inject(ApiHttpService);
  private readonly auth = inject(AuthService);

  /** Authenticated panel image URL for <img src>. */
  panelImageUrl(imageId: string | null | undefined, size: 'grid' | 'full' = 'grid'): string {
    const id = (imageId || '').trim();
    if (!id) {
      return '';
    }
    const base = (environment.apiUrl || '').replace(/\/$/, '');
    // Prefer cookie auth (set at login via withCredentials). Also pass Token in the
    // query so images still load after a page refresh when only localStorage session exists.
    const token = this.auth.getAccessToken();
    const url = `${base}/product/productImage/${encodeURIComponent(id)}/${size}`;
    return token ? `${url}?Token=${encodeURIComponent(token)}` : url;
  }

  getVendorProducts(): Observable<Product[]> {
    return this.api
      .post<ApiProductListResponse>('/product/productList', {
        status: null,
        search: null,
        pageSize: null,
        pageOffset: null,
      })
      .pipe(
        map((res) => (res?.products ?? []).map((p) => this.normalizeListItem(p))),
        catchError((err: unknown) => this.mapHttpError(err, 'Failed to load products.'))
      );
  }

  getProductDetail(productId: string): Observable<ProductDetail> {
    return this.api
      .post<ApiProductDetailResponse>('/product/productDetail', { productId })
      .pipe(
        map((res) => {
          if (!res?.product?.productId) {
            throw new Error(res?.message || 'Product not found.');
          }
          const images = [...(res.images ?? [])]
            .map((img, index) => ({
              imageId: String(img.imageId || ''),
              isPrimary: !!img.isPrimary,
              sortOrder: img.sortOrder ?? index,
            }))
            .filter((img) => !!img.imageId)
            .sort((a, b) => {
              if (a.isPrimary !== b.isPrimary) {
                return a.isPrimary ? -1 : 1;
              }
              return a.sortOrder - b.sortOrder;
            });
          return {
            product: this.normalizeListItem({
              ...res.product,
              primaryImageId: images.find((i) => i.isPrimary)?.imageId || images[0]?.imageId,
              description: res.product.description,
            }),
            images,
          };
        }),
        catchError((err: unknown) => this.mapHttpError(err, 'Failed to load product.'))
      );
  }

  createProduct(form: ProductFormData): Observable<Product> {
    const weight = this.parseWeight(form.weight);
    if (weight == null || weight <= 0) {
      return throwError(() => new Error('Weight in grams is required.'));
    }
    const skuCode = form.sku.trim();
    if (!skuCode) {
      return throwError(() => new Error('Product code (SKU) is required.'));
    }
    if (!form.categoryId && !form.category.trim()) {
      return throwError(() => new Error('Please select a category.'));
    }

    const files = this.collectImageFiles(form);
    if (!files.length) {
      return throwError(() => new Error('Please add at least one product image.'));
    }

    const productJson = this.buildWritePayload(form, weight, skuCode);
    const formData = new FormData();
    formData.append('product', JSON.stringify(productJson));
    for (const file of files) {
      formData.append('images', file, file.name);
    }

    return this.api.postFormData<ProductActionResponse>('/product/addProduct', formData).pipe(
      map((res) => {
        this.assertSuccess(res, 'Failed to add product.');
        return this.normalizeListItem({
          productId: res.productId,
          name: res.name || form.name.trim(),
          skuCode: res.skuCode || skuCode,
          categoryId: form.categoryId || undefined,
          categoryName: form.category,
          metalTypeId: form.metalTypeId,
          metalType: form.metalType || null,
          purityId: form.purityId,
          purity: form.purity || null,
          colorId: form.colorId,
          color: form.color || null,
          grossWeight: weight,
          price: productJson.price,
          stockStatus: productJson.stockStatus,
          status: 'active',
          description: form.description.trim() || null,
        });
      }),
      catchError((err: unknown) => this.mapHttpError(err, 'Failed to add product.'))
    );
  }

  /**
   * Full-object field update. Pass `newImageFiles` to append photos after save.
   * Pass `removedImageIds` to delete existing photos (API refuses deleting the last one).
   * Pass `primaryImageId` to set cover when it is an existing image id.
   */
  updateProduct(
    productId: string,
    form: ProductFormData,
    opts?: {
      newImageFiles?: File[];
      removedImageIds?: string[];
      primaryImageId?: string | null;
      /** When cover is a newly uploaded file, set the first uploaded id as primary. */
      preferFirstNewAsPrimary?: boolean;
    }
  ): Observable<Product> {
    const weight = this.parseWeight(form.weight);
    if (weight == null || weight <= 0) {
      return throwError(() => new Error('Weight in grams is required.'));
    }
    if (!form.categoryId && !form.category.trim()) {
      return throwError(() => new Error('Please select a category.'));
    }

    const fields = this.buildWritePayload(form, weight, null);
    const payload = { productId, ...fields };

    return this.api.post<ProductActionResponse>('/product/updateProduct', payload).pipe(
      switchMap((res) => {
        this.assertSuccess(res, 'Failed to update product.');
        const files = opts?.newImageFiles ?? [];
        const upload$ =
          files.length === 0
            ? of({ action: res, newIds: [] as string[] })
            : this.uploadImages(productId, files).pipe(
                map((uploadRes) => ({
                  action: res,
                  newIds: (uploadRes.imageIds ?? []).map(String),
                }))
              );
        return upload$.pipe(
          switchMap(({ action, newIds }) => {
            const removed = opts?.removedImageIds ?? [];
            if (!removed.length) {
              return of({ action, newIds });
            }
            return from(removed).pipe(
              concatMap((imageId) => this.deleteImage(imageId)),
              toArray(),
              map(() => ({ action, newIds }))
            );
          }),
          switchMap(({ action, newIds }) => {
            let primaryId = opts?.primaryImageId || null;
            if (!primaryId && opts?.preferFirstNewAsPrimary && newIds[0]) {
              primaryId = newIds[0];
            }
            if (!primaryId) {
              return of(action);
            }
            return this.setPrimaryImage(primaryId).pipe(map(() => action));
          })
        );
      }),
      map((res) =>
        this.normalizeListItem({
          productId: res.productId || productId,
          name: res.name || form.name.trim(),
          skuCode: form.sku.trim() || res.skuCode,
          categoryId: form.categoryId || undefined,
          categoryName: form.category,
          metalTypeId: form.metalTypeId,
          metalType: form.metalType || null,
          purityId: form.purityId,
          purity: form.purity || null,
          colorId: form.colorId,
          color: form.color || null,
          grossWeight: weight,
          price: fields.price,
          stockStatus: fields.stockStatus,
          status: 'active',
          description: form.description.trim() || null,
        })
      ),
      catchError((err: unknown) => this.mapHttpError(err, 'Failed to update product.'))
    );
  }

  deleteProduct(productId: string): Observable<void> {
    return this.api.post<ProductActionResponse>('/product/deleteProduct', { productId }).pipe(
      map((res) => {
        this.assertSuccess(res, 'Failed to delete product.');
      }),
      catchError((err: unknown) => this.mapHttpError(err, 'Failed to delete product.'))
    );
  }

  /** POST /product/updateProductStatus â€” active | inactive */
  updateProductStatus(
    productIds: string[],
    status: 'active' | 'inactive'
  ): Observable<ProductActionResponse> {
    return this.api
      .post<ProductActionResponse>('/product/updateProductStatus', { productIds, status })
      .pipe(
        map((res) => {
          this.assertSuccess(res, 'Failed to update product status.');
          return res;
        }),
        catchError((err: unknown) => this.mapHttpError(err, 'Failed to update product status.'))
      );
  }

  /** POST /product/updateStockStatus â€” in_stock | out_of_stock | make_to_order */
  updateStockStatus(
    productIds: string[],
    stockStatus: 'in_stock' | 'out_of_stock' | 'make_to_order'
  ): Observable<ProductActionResponse> {
    return this.api
      .post<ProductActionResponse>('/product/updateStockStatus', { productIds, stockStatus })
      .pipe(
        map((res) => {
          this.assertSuccess(res, 'Failed to update stock status.');
          return res;
        }),
        catchError((err: unknown) => this.mapHttpError(err, 'Failed to update stock status.'))
      );
  }

  uploadImages(productId: string, files: File[]): Observable<ProductActionResponse> {
    const formData = new FormData();
    formData.append('productId', productId);
    for (const file of files) {
      formData.append('images', file, file.name);
    }
    return this.api.postFormData<ProductActionResponse>('/product/uploadImages', formData).pipe(
      map((res) => {
        this.assertSuccess(res, 'Failed to upload images.');
        return res;
      })
    );
  }

  deleteImage(imageId: string): Observable<void> {
    return this.api.post<ProductActionResponse>('/product/deleteImage', { imageId }).pipe(
      map((res) => {
        this.assertSuccess(res, 'Failed to remove image.');
      })
    );
  }

  setPrimaryImage(imageId: string): Observable<void> {
    return this.api.post<ProductActionResponse>('/product/setPrimaryImage', { imageId }).pipe(
      map((res) => {
        this.assertSuccess(res, 'Failed to set cover image.');
      })
    );
  }

  mapToForm(product: Product): ProductFormData {
    return {
      name: product.name,
      category: product.category,
      categoryId: product.categoryId ?? null,
      catalogId: product.catalogId ?? null,
      description: product.description ?? '',
      price: product.price ?? null,
      imageUrl: '',
      galleryImages: [],
      images: [],
      metalType: product.metalType ?? '',
      metalTypeId: product.metalTypeId ?? null,
      weight: product.weight ?? '',
      purity: product.purity ?? '',
      purityId: product.purityId ?? null,
      sku: product.sku ?? '',
      color: product.color ?? '',
      colorId: product.colorId ?? null,
      status: this.normalizeStatus(product.status || product.stockStatus),
      isActive: product.accountStatus !== 'inactive',
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

  collectImageFiles(form: ProductFormData): File[] {
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

  private buildWritePayload(
    form: ProductFormData,
    grossWeight: number,
    skuCode: string | null
  ): {
    name: string | null;
    description: string | null;
    categoryId: string | null;
    categoryName: string | null;
    metalTypeId: string | null;
    purityId: string | null;
    colorId: string | null;
    grossWeight: number;
    price: number | null;
    stockStatus: string;
    skuCode?: string;
  } {
    const payload: {
      name: string | null;
      description: string | null;
      categoryId: string | null;
      categoryName: string | null;
      metalTypeId: string | null;
      purityId: string | null;
      colorId: string | null;
      grossWeight: number;
      price: number | null;
      stockStatus: string;
      skuCode?: string;
    } = {
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      categoryId: form.categoryId || null,
      categoryName: form.categoryId ? null : form.category.trim() || null,
      metalTypeId: form.metalTypeId || null,
      purityId: form.purityId || null,
      colorId: form.colorId || null,
      grossWeight,
      price: form.price == null || Number.isNaN(Number(form.price)) ? null : Number(form.price),
      stockStatus: this.toApiStockStatus(form.status),
    };
    if (skuCode != null) {
      payload.skuCode = skuCode;
    }
    return payload;
  }

  private normalizeListItem(product: ApiProductListItem): Product {
    const accountStatus =
      (product.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const stockRaw = product.stockStatus || 'in_stock';
    const raw = product as ApiProductListItem & Record<string, unknown>;
    const primaryImageId = String(
      product.primaryImageId ||
        raw['primary_image_id'] ||
        raw['imageId'] ||
        raw['image_id'] ||
        ''
    ).trim() || null;
    const imageUrl = this.panelImageUrl(primaryImageId, 'grid');
    return {
      id: String(product.productId || ''),
      name: product.name || '',
      category: product.categoryName || '',
      categoryId: product.categoryId || null,
      description: product.description || '',
      price: product.price == null ? null : Number(product.price),
      metalType: product.metalType || '',
      metalTypeId: product.metalTypeId || null,
      weight: product.grossWeight != null ? String(product.grossWeight) : '',
      purity: product.purity || '',
      purityId: product.purityId || null,
      sku: product.skuCode || '',
      color: product.color || '',
      colorId: product.colorId || null,
      status: this.normalizeStatus(stockRaw),
      stockStatus: stockRaw,
      accountStatus,
      imageCount: product.imageCount ?? 0,
      primaryImageId,
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

  private assertSuccess(res: ProductActionResponse | null | undefined, fallback: string): void {
    if (res && res.success === false) {
      throw new Error(res.message || fallback);
    }
  }

  private mapHttpError(err: unknown, fallback: string): Observable<never> {
    if (err instanceof Error && !(err instanceof ApiClientError)) {
      return throwError(() => err);
    }
    if (err instanceof ApiClientError) {
      return throwError(() => new Error(err.message || fallback));
    }
    return throwError(() => new Error(fallback));
  }
}
