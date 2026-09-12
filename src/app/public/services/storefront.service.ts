import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { ApiHttpService } from '@common/api/api-http.service';
import { environment } from '../../../environments/environment';
import { resolveMediaUrl, resolveMediaUrls } from '@common/utils/media-url.util';
import { CatalogSharePayload } from '@common/services/catalog-share.service';
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

interface PublicCatalogApiItem {
  productId?: string;
  skuCode?: string;
  name?: string;
  categoryName?: string;
  metalType?: string;
  purity?: string;
  color?: string;
  grossWeight?: number | string;
  stockStatus?: string;
  primaryImageId?: string;
  imageIds?: string[];
  price?: number;
}

interface PublicCatalogApiResponse {
  status?: string;
  message?: string;
  business?: {
    businessName?: string;
    logoUrl?: string | null;
    brandColor?: string | null;
    contactPhone?: string | null;
    currency?: string | null;
  } | null;
  catalog?: {
    title?: string;
    itemCount?: number;
    priceVisible?: boolean;
    customerDetailsRequired?: boolean;
    customerName?: string | null;
    expiresAt?: string | null;
  } | null;
  items?: PublicCatalogApiItem[];
}

interface PublicProductDetailApiResponse {
  status?: string;
  product?: PublicCatalogApiItem & {
    description?: string;
    imageIds?: string[];
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class StorefrontService {
  private readonly api = inject(ApiHttpService);

  /** In the new API, the route param is the catalog share token. */
  getStoreContext(token: string): Observable<PublicStoreContext | null> {
    return this.fetchCatalog(token).pipe(
      map((res) => (res ? this.toContext(token, res) : null))
    );
  }

  getPublicPage(token: string): Observable<PublicStorefrontPage | null> {
    return this.fetchCatalog(token).pipe(
      map((res) => {
        if (!res) {
          return null;
        }
        const context = this.toContext(token, res);
        const products = (res.items ?? []).map((item) => this.fromApiItem(token, item, res.catalog?.priceVisible));
        return {
          ...context,
          featuredProducts: products.slice(0, context.config.homeProductLimit || 8),
        };
      })
    );
  }

  getPublicProducts(
    token: string,
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
    return this.fetchCatalog(token).pipe(
      map((res) => {
        if (!res) {
          return null;
        }
        const context = this.toContext(token, res);
        let products = (res.items ?? []).map((item) =>
          this.fromApiItem(token, item, res.catalog?.priceVisible)
        );
        products = this.filterPublicProducts(products, {
          search: filters.search,
          category: filters.category,
          metalType: filters.metalType,
          minPrice: filters.minPrice ?? undefined,
          maxPrice: filters.maxPrice ?? undefined,
        });
        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 12;
        const start = (page - 1) * pageSize;
        const pageItems = products.slice(start, start + pageSize);
        return {
          context,
          products: pageItems,
          total: products.length,
          hasMore: start + pageSize < products.length,
          page,
        };
      })
    );
  }

  getPublicProductDetail(
    token: string,
    productId: string | number,
    _sessionToken?: string
  ): Observable<PublicProduct | null> {
    return this.api
      .post<PublicProductDetailApiResponse>('/public/productDetail', {
        token,
        productId: String(productId),
      })
      .pipe(
        map((res) => {
          if (!res?.product) {
            return null;
          }
          return this.fromApiItem(token, res.product, true);
        })
      );
  }

  getSharedCatalog(
    _storeCode: string,
    shortCode: string
  ): Observable<{
    context: PublicStoreContext;
    products: PublicProduct[];
    shareLabel: string;
    status: string;
    message?: string;
  } | null> {
    return this.fetchCatalog(shortCode).pipe(
      map((res) => {
        if (!res || res.status === 'not_found') {
          return null;
        }
        const active = res.status === 'active';
        return {
          context: this.toContext(shortCode, res),
          products: active
            ? (res.items ?? []).map((item) =>
                this.fromApiItem(shortCode, item, res.catalog?.priceVisible)
              )
            : [],
          shareLabel: res.catalog?.title || 'Shared Catalog',
          status: res.status || 'active',
          message: res.message,
        };
      })
    );
  }

  getPublicCategories(token: string): Observable<string[]> {
    return this.fetchCatalog(token).pipe(
      map((res) => {
        const set = new Set<string>();
        for (const item of res?.items ?? []) {
          if (item.categoryName) {
            set.add(item.categoryName);
          }
        }
        return [...set].sort((a, b) => a.localeCompare(b));
      })
    );
  }

  filterPublicProducts(
    products: PublicProduct[],
    filters: {
      search?: string;
      category?: string;
      metalType?: string;
      minPrice?: number;
      maxPrice?: number;
      productIds?: string[];
    }
  ): PublicProduct[] {
    const search = filters.search?.trim().toLowerCase() ?? '';
    const idSet = filters.productIds?.length ? new Set(filters.productIds.map(String)) : null;

    return products.filter((p) => {
      if (idSet && !idSet.has(String(p.id))) {
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
      productIds: payload.productIds?.map(String),
      category: payload.category,
      metalType: payload.metalType,
      minPrice: payload.minPrice,
      maxPrice: payload.maxPrice,
    });
  }

  /** No dedicated storefront CMS in smart-catalog â€” return defaults. */
  getByVendorId(vendorId: number | string, vendorName: string): Observable<StorefrontConfig> {
    return of(mergeStorefrontWithDefaults(null, vendorId, vendorName));
  }

  saveForVendor(
    vendorId: number | string,
    vendorName: string,
    form: StorefrontFormData,
    _existingId?: number
  ): Observable<StorefrontConfig> {
    return of(
      mergeStorefrontWithDefaults(
        {
          tagline: form.tagline,
          aboutText: form.aboutText,
          logoUrl: form.logoUrl,
          showBanner: form.showBanner,
          showAbout: form.showAbout,
          showFeatured: form.showFeatured,
          showContact: form.showContact,
          homeProductLimit: form.homeProductLimit,
          bannerUrls: form.bannerUrls,
          featuredProductIds: form.featuredProductIds,
          theme: form.theme,
          homepage: form.homepage,
        },
        vendorId,
        vendorName
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

  private fetchCatalog(token: string): Observable<PublicCatalogApiResponse | null> {
    return this.api.post<PublicCatalogApiResponse>('/public/fetchCatalog', { token }).pipe(
      map((res) => res ?? null)
    );
  }

  private toContext(token: string, res: PublicCatalogApiResponse): PublicStoreContext {
    const business = res.business;
    const name = business?.businessName || 'Catalog';
    const brandColor = (business?.brandColor || '').trim() || null;
    const logoPath = business?.logoUrl || '';
    const logoUrl = logoPath
      ? logoPath.startsWith('http')
        ? logoPath
        : `${environment.apiUrl}${logoPath}`
      : '';
    const config = mergeStorefrontWithDefaults(
      {
        logoUrl,
        theme: {
          primaryColor: brandColor || undefined,
        },
        tagline: res.catalog?.title || '',
      },
      token,
      name
    );

    return {
      storeCode: token,
      vendor: {
        id: token as unknown as number,
        name,
        phone: business?.contactPhone || undefined,
      },
      config,
      isAvailable: res.status === 'active',
      catalogTitle: res.catalog?.title || undefined,
      customerName: res.catalog?.customerName ?? null,
      currency: business?.currency ?? null,
      brandColor,
    };
  }

  private fromApiItem(
    token: string,
    item: PublicCatalogApiItem & { description?: string },
    priceVisible?: boolean
  ): PublicProduct {
    const imageIds = item.imageIds?.length
      ? item.imageIds
      : item.primaryImageId
        ? [item.primaryImageId]
        : [];
    const images = imageIds.map(
      (imageId) => `${environment.apiUrl}/public/productImage/${token}/${imageId}/grid`
    );
    const price =
      priceVisible === false
        ? undefined
        : item.price != null && Number(item.price) > 0
          ? Number(item.price)
          : undefined;

    return {
      id: String(item.productId || ''),
      name: item.name || 'Product',
      description: item.description,
      category: item.categoryName,
      metalType: item.metalType,
      purity: item.purity,
      weight: item.grossWeight != null ? Number(item.grossWeight) : undefined,
      sku: item.skuCode,
      price,
      priceVisible: price != null,
      imageUrl: images[0],
      images,
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
      return url;
    }
    const base = environment.apiUrl.replace(/\/$/, '');
    if (url.startsWith(base)) {
      return url.slice(base.length) || '/';
    }
    return url;
  }
}

export function parsePublicPrice(product: Pick<PublicProduct, 'price' | 'priceVisible'>): number | undefined {
  if (product.priceVisible === false) {
    return undefined;
  }
  if (product.price == null) {
    return undefined;
  }
  const n = Number(product.price);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
