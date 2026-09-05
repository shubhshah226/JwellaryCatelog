import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { resolveMediaUrl, resolveMediaUrls } from '../../core/utils/media-url.util';
import { CatalogSharePayload } from '../../core/services/catalog-share.service';
import {
  mergeStorefrontWithDefaults,
} from '../config/default-storefront.config';
import { createDefaultHomepage } from '../config/homepage.defaults';
import {
  PublicProduct,
  PublicStoreContext,
  PublicStorefrontPage,
  StorefrontConfig,
  StorefrontFormData,
} from '../models/storefront.model';
import { CustomerAuthService } from './customer-auth.service';

interface PublicHomeResponse {
  context: PublicStoreContext;
  featuredProducts: PublicProduct[];
}

interface PublicProductsResponse {
  context: PublicStoreContext;
  products: PublicProduct[];
}

interface PublicShareResponse {
  context: PublicStoreContext;
  products: PublicProduct[];
  shareLabel?: string;
}

interface PublicProductDetailResponse {
  id: number;
  name: string;
  category: string;
  description?: string;
  price?: number;
  priceVisible?: boolean;
  imageUrl?: string;
  images?: Array<string | { url: string; sortOrder?: number; isCover?: boolean }>;
  metalType?: string;
  weight?: string;
  purity?: string;
  sku?: string;
  verified?: boolean;
  publicCover?: PublicProduct;
}

@Injectable({
  providedIn: 'root',
})
export class StorefrontService {
  private readonly api = inject(ApiHttpService);
  private readonly customerAuth = inject(CustomerAuthService);

  private customerHeaders(storeCode: string, extra?: HttpHeaders): HttpHeaders {
    let headers = extra ?? new HttpHeaders();
    const token = this.customerAuth.getSession(storeCode)?.sessionToken;
    if (token) {
      headers = headers.set('X-Customer-Session', token);
    }
    return headers;
  }

  getStoreContext(storeCode: string): Observable<PublicStoreContext | null> {
    return this.api.get<PublicStoreContext>(`/public/stores/${storeCode}`).pipe(
      map((ctx) => this.normalizeContext(ctx))
    );
  }

  getPublicPage(storeCode: string): Observable<PublicStorefrontPage | null> {
    return this.api.get<PublicHomeResponse & Partial<PublicStoreContext>>(
      `/public/stores/${storeCode}/home`,
      undefined,
      this.customerHeaders(storeCode)
    ).pipe(
      map((res) => {
        const ctx = res?.context ?? (res.vendor ? res : null);
        if (!ctx?.vendor) {
          return null;
        }
        return {
          ...this.normalizeContext(ctx as PublicStoreContext),
          featuredProducts: (res.featuredProducts ?? []).map((p) => this.toPublicProduct(p)),
        };
      })
    );
  }

  getPublicProducts(
    storeCode: string,
    filters: {
      page?: number;
      pageSize?: number;
      search?: string;
      category?: string;
      metalType?: string;
      purity?: string;
      minPrice?: number | null;
      maxPrice?: number | null;
      sort?: string;
      skipLoader?: boolean;
    } = {}
  ): Observable<{
    context: PublicStoreContext;
    products: PublicProduct[];
    total: number;
    hasMore: boolean;
    page: number;
  } | null> {
    const category = filters.category && filters.category !== 'all' ? filters.category : undefined;
    const metalType = filters.metalType && filters.metalType !== 'all' ? filters.metalType : undefined;
    const purity = filters.purity && filters.purity !== 'all' ? filters.purity : undefined;
    const headers = this.customerHeaders(
      storeCode,
      filters.skipLoader ? new HttpHeaders({ 'X-Skip-Loader': 'true' }) : undefined
    );
    const verified = !!this.customerAuth.getSession(storeCode)?.sessionToken;
    return this.api
      .getWithMeta<PublicProductsResponse>(`/public/stores/${storeCode}/products`, {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 12,
        search: filters.search?.trim() || undefined,
        category,
        metalType,
        purity,
        minPrice: verified ? filters.minPrice ?? undefined : undefined,
        maxPrice: verified ? filters.maxPrice ?? undefined : undefined,
        sort: verified ? filters.sort || 'newest' : 'newest',
      }, headers)
      .pipe(
        map((res) => {
          if (!res.data?.context) {
            return null;
          }
          const meta = res.meta ?? {};
          const products = (res.data.products ?? []).map((p) => this.toPublicProduct(p));
          const total = Number(meta['total'] ?? products.length);
          const page = Number(meta['page'] ?? filters.page ?? 1);
          const hasMore =
            typeof meta['hasMore'] === 'boolean' ? meta['hasMore'] : products.length >= (filters.pageSize ?? 12);
          return {
            context: this.normalizeContext(res.data.context),
            products,
            total,
            hasMore,
            page,
          };
        })
      );
  }

  getPublicProductDetail(storeCode: string, productId: number, sessionToken?: string): Observable<PublicProduct | null> {
    const headers = this.customerHeaders(
      storeCode,
      new HttpHeaders({
        'X-Skip-Loader': 'true',
        ...(sessionToken ? { 'X-Customer-Session': sessionToken } : {}),
      })
    );
    return this.api
      .get<PublicProductDetailResponse>(`/public/stores/${storeCode}/products/${productId}`, undefined, headers)
      .pipe(
        map((res) => {
          if (!res?.id) {
            return null;
          }
          const cover = res.publicCover;
          return this.toPublicProduct({
            ...(cover ?? {}),
            ...res,
            images: res.images?.length ? res.images : cover?.images,
          } as PublicProduct);
        })
      );
  }

  getSharedCatalog(
    storeCode: string,
    shortCode: string
  ): Observable<{
    context: PublicStoreContext;
    products: PublicProduct[];
    shareLabel: string;
  } | null> {
    return this.api
      .get<PublicShareResponse>(`/public/stores/${storeCode}/c/${shortCode}`, undefined, this.customerHeaders(storeCode))
      .pipe(
        map((res) => ({
          context: this.normalizeContext(res.context),
          products: (res.products ?? []).map((p) => this.toPublicProduct(p)),
          shareLabel: res.shareLabel ?? 'Shared Catalog',
        }))
      );
  }

  getPublicCategories(storeCode: string): Observable<string[]> {
    return this.api
      .get<{ categories: string[] }>(
        `/public/stores/${storeCode}/categories`,
        undefined,
        new HttpHeaders({ 'X-Skip-Loader': 'true' })
      )
      .pipe(map((res) => res?.categories ?? []));
  }

  filterPublicProducts(
    products: PublicProduct[],
    filters: {
      search?: string;
      category?: string;
      metalType?: string;
      minPrice?: number;
      maxPrice?: number;
      productIds?: number[];
    }
  ): PublicProduct[] {
    const search = filters.search?.trim().toLowerCase() ?? '';
    const idSet = filters.productIds?.length ? new Set(filters.productIds) : null;

    return products.filter((p) => {
      if (idSet && !idSet.has(p.id)) {
        return false;
      }
      if (
        search &&
        !p.name.toLowerCase().includes(search) &&
        !(p.category ?? '').toLowerCase().includes(search)
      ) {
        return false;
      }
      if (filters.category && filters.category !== 'all' && p.category !== filters.category) {
        return false;
      }
      if (filters.metalType && filters.metalType !== 'all' && p.metalType !== filters.metalType) {
        return false;
      }
      if (filters.minPrice !== undefined && (p.price == null || p.price < filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice !== undefined && (p.price == null || p.price > filters.maxPrice)) {
        return false;
      }
      return true;
    });
  }

  applySharePayload(products: PublicProduct[], payload: CatalogSharePayload): PublicProduct[] {
    return this.filterPublicProducts(products, {
      productIds: payload.productIds,
      category: payload.category,
      metalType: payload.metalType,
      minPrice: payload.minPrice,
      maxPrice: payload.maxPrice,
    });
  }

  getByVendorId(vendorId: number, vendorName: string): Observable<StorefrontConfig> {
    return this.api.get<Partial<StorefrontConfig>>('/vendor/storefront').pipe(
      map((cfg) =>
        mergeStorefrontWithDefaults(this.normalizeStorefront(cfg), vendorId, vendorName)
      )
    );
  }

  saveForVendor(
    vendorId: number,
    vendorName: string,
    form: StorefrontFormData,
    _existingId?: number
  ): Observable<StorefrontConfig> {
    const payload = {
      tagline: form.tagline,
      aboutText: form.aboutText,
      logoUrl: this.toRelativeMedia(form.logoUrl),
      showBanner: form.showBanner,
      showAbout: form.showAbout,
      showFeatured: form.showFeatured,
      showContact: form.showContact,
      homeProductLimit: form.homeProductLimit,
      bannerUrls: form.bannerUrls.map((u) => this.toRelativeMedia(u)),
      featuredProductIds: form.featuredProductIds,
      theme: form.theme,
      homepage: this.toRelativeHomepage(form.homepage),
    };

    return this.api.put<Partial<StorefrontConfig>>('/vendor/storefront', payload).pipe(
      map((cfg) =>
        mergeStorefrontWithDefaults(this.normalizeStorefront(cfg), vendorId, vendorName)
      )
    );
  }

  mapConfigToForm(config: StorefrontConfig): StorefrontFormData {
    return {
      tagline: config.tagline,
      showBanner: config.showBanner,
      bannerUrl: config.bannerUrl,
      bannerUrls: [...(config.bannerUrls ?? [])],
      logoUrl: config.logoUrl,
      showFeatured: config.showFeatured,
      showContact: config.showContact,
      showAbout: config.showAbout,
      aboutText: config.aboutText,
      featuredProductIds: [...config.featuredProductIds],
      homeProductLimit: config.homeProductLimit ?? 4,
      customSections: (config.customSections ?? []).map((s) => ({ ...s })),
      theme: { ...config.theme },
      homepage: structuredClone(config.homepage ?? createDefaultHomepage()),
    };
  }

  private normalizeContext(ctx: PublicStoreContext): PublicStoreContext {
    const vendorId = Number(ctx.vendor.id);
    return {
      ...ctx,
      vendor: {
        ...ctx.vendor,
        id: vendorId,
      },
      config: mergeStorefrontWithDefaults(
        this.normalizeStorefront(ctx.config),
        vendorId,
        ctx.vendor.name
      ),
    };
  }

  private normalizeStorefront(
    cfg: Partial<StorefrontConfig> | null | undefined
  ): Partial<StorefrontConfig> | null {
    if (!cfg) {
      return null;
    }
    const bannerUrls = resolveMediaUrls(
      cfg.bannerUrls?.length ? cfg.bannerUrls : cfg.bannerUrl ? [cfg.bannerUrl] : []
    );
    return {
      ...cfg,
      logoUrl: resolveMediaUrl(cfg.logoUrl),
      bannerUrls,
      bannerUrl: bannerUrls[0] ?? '',
      customSections: cfg.customSections ?? [],
      homepage: this.resolveHomepageMedia(cfg.homepage) as StorefrontConfig['homepage'],
    };
  }

  private toPublicProduct(product: PublicProduct): PublicProduct {
    const images = this.extractImages(product);
    const price = parsePublicPrice(product);
    const listRaw = (product as PublicProduct).listPrice as unknown;
    const listPrice =
      listRaw == null || listRaw === ''
        ? undefined
        : Number(listRaw);
    return {
      ...product,
      id: Number(product.id),
      price,
      listPrice:
        listPrice != null && Number.isFinite(listPrice) && listPrice > 0
          ? listPrice
          : undefined,
      isSpecialPrice: !!product.isSpecialPrice && price != null,
      imageUrl: images[0] ?? resolveMediaUrl(product.imageUrl),
      images,
    };
  }

  private extractImages(product: PublicProduct): string[] {
    const raw = product.images as unknown;
    if (Array.isArray(raw) && raw.length) {
      if (typeof raw[0] === 'string') {
        return resolveMediaUrls(raw as string[]);
      }
      const rows = [...(raw as { url: string; isCover?: boolean; sortOrder?: number }[])];
      rows.sort((a, b) => {
        const cover = Number(!!b.isCover) - Number(!!a.isCover);
        if (cover !== 0) {
          return cover;
        }
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
      return rows.map((img) => resolveMediaUrl(img.url)).filter(Boolean);
    }
    return product.imageUrl ? [resolveMediaUrl(product.imageUrl)] : [];
  }

  private toRelativeHomepage(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.toRelativeHomepage(item));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if ((k === 'imageUrl' || k === 'image_url') && typeof v === 'string') {
          out[k] = this.toRelativeMedia(v);
        } else {
          out[k] = this.toRelativeHomepage(v);
        }
      }
      return out;
    }
    return value;
  }

  private resolveHomepageMedia(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveHomepageMedia(item));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if ((k === 'imageUrl' || k === 'image_url') && typeof v === 'string') {
          out[k] = resolveMediaUrl(v);
        } else {
          out[k] = this.resolveHomepageMedia(v);
        }
      }
      return out;
    }
    return value;
  }

  private toRelativeMedia(url: string): string {
    if (!url) {
      return '';
    }
    if (url.startsWith('data:')) {
      return url;
    }
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return url.slice(idx);
    }
    return url;
  }
}

export function parsePublicPrice(product: Pick<PublicProduct, 'price' | 'priceVisible'>): number | undefined {
  if (product.priceVisible === false) {
    return undefined;
  }
  const raw = product.price as unknown;
  if (raw == null || raw === '') {
    return undefined;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return undefined;
  }
  return n;
}

export function formatRs(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}

export function hasDisplayPrice(amount?: number | null): boolean {
  return amount != null && Number.isFinite(amount) && amount > 0;
}
