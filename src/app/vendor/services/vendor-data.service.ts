import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiHttpService } from '../../core/api/api-http.service';
import { AuthService } from '../../auth/services/auth.service';
import { relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { Catalog, Enquiry, LeadItem, Product } from '../../dashboard/models/dashboard.model';
import { VendorAccount } from '../../dashboard/models/vendor.model';

interface ApiCatalog {
  catalogId?: string;
  token?: string;
  title?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  status?: string;
  effectiveStatus?: string;
  itemCount?: number;
  catalogUrl?: string | null;
  whatsappUrl?: string | null;
  createdAt?: string;
  expiresAt?: string | null;
  priceVisible?: boolean | null;
}

interface ApiCatalogListResponse {
  catalogs?: ApiCatalog[];
}

interface ApiCatalogCreateResponse {
  success?: boolean;
  catalogId?: string;
  token?: string;
  catalogUrl?: string;
  whatsappUrl?: string;
  title?: string;
  itemCount?: number;
  message?: string | null;
}

interface ApiCatalogActionResponse {
  success?: boolean;
  itemCount?: number;
  message?: string | null;
}

interface ApiEnquiry {
  enquiryId?: string;
  catalogId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerNote?: string | null;
  itemCount?: number;
  totalPrice?: number;
  pricedItemCount?: number;
  enquiryStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  token?: string;
  catalogTitle?: string | null;
  priceVisible?: boolean;
  viewCount?: number;
  previewImageId?: string | null;
}

interface ApiEnquiryItem {
  productId?: string;
  quantity?: number;
  priceSnapshot?: number;
  priceOnRequest?: boolean;
  grossWeightSnapshot?: number;
  skuCode?: string;
  name?: string;
  categoryName?: string;
  metalType?: string | null;
  purity?: string | null;
  primaryImageId?: string | null;
  currentPrice?: number | null;
}

interface ApiEnquiryListResponse {
  enquiries?: ApiEnquiry[];
}

interface ApiEnquiryDetailResponse {
  enquiry?: ApiEnquiry | null;
  items?: ApiEnquiryItem[];
  catalogUrl?: string | null;
  message?: string | null;
}

interface ApiBusinessProfile {
  tenantId?: string;
  businessName?: string;
  ownerName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  city?: string | null;
  logoUri?: string | null;
  brandColor?: string | null;
  currency?: string | null;
  catalogExpiryDays?: number | null;
  priceVisibleDefault?: boolean | null;
  accountStatus?: string | null;
}

/** Partial response from updateBusinessProfile (RETURNING logo only). */
interface BusinessProfileUpdateResponse {
  success?: boolean;
  tenantId?: string;
  logoUri?: string | null;
  message?: string | null;
}

/** Payload for POST /master/updateBusinessProfile (JSON part of FormData). */
export interface UpdateBusinessProfilePayload {
  businessName: string;
  ownerName?: string | null;
  contactEmail: string;
  contactPhone: string;
  city?: string | null;
  brandColor?: string | null;
  currency?: string | null;
  catalogExpiryDays?: number | null;
  priceVisibleDefault?: boolean | null;
  logoUri?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class VendorDataService {
  private readonly api = inject(ApiHttpService);
  private readonly authService = inject(AuthService);

  getVendorId(): string | null {
    const user = this.authService.getSession()?.user;
    return user?.tenantId ?? user?.vendorId ?? null;
  }

  getCatalogs(): Observable<Catalog[]> {
    return this.api
      .post<ApiCatalogListResponse>('/catalog/catalogList', {
        catalogId: null,
        status: null,
        search: null,
        pageSize: null,
        pageOffset: null,
      })
      .pipe(map((res) => (res?.catalogs ?? []).map((c) => this.normalizeCatalog(c))));
  }

  /** POST /catalog/createCatalog — requires at least one product id. */
  createCatalog(
    name: string,
    productIds: string[],
    opts?: {
      customerName?: string | null;
      customerPhone?: string | null;
      priceVisible?: boolean | null;
      expiryDays?: number | null;
      neverExpires?: boolean | null;
    }
  ): Observable<Catalog> {
    const ids = [...new Set(productIds.map(String).filter(Boolean))];
    if (!ids.length) {
      return throwError(() => new Error('Select at least one product for the catalog.'));
    }
    return this.api
      .post<ApiCatalogCreateResponse>('/catalog/createCatalog', {
        title: name.trim(),
        productIds: ids,
        selectAll: false,
        customerName: opts?.customerName?.trim() || null,
        customerPhone: opts?.customerPhone?.trim() || null,
        priceVisible: opts?.priceVisible ?? null,
        expiryDays: opts?.neverExpires ? null : opts?.expiryDays ?? null,
        neverExpires: opts?.neverExpires ?? false,
      })
      .pipe(
        map((res) => {
          if (!res?.success || !res.catalogId) {
            throw new Error(res?.message || 'Unable to create catalog.');
          }
          return this.normalizeCatalog({
            catalogId: res.catalogId,
            token: res.token,
            title: res.title || name.trim(),
            itemCount: res.itemCount ?? ids.length,
            catalogUrl: res.catalogUrl,
            whatsappUrl: res.whatsappUrl,
            effectiveStatus: 'active',
            status: 'active',
          });
        })
      );
  }

  /** POST /catalog/catalogDetail */
  getCatalogDetail(catalogId: string): Observable<{
    catalog: Catalog;
    products: Product[];
    catalogUrl: string;
    whatsappUrl: string;
  }> {
    return this.api
      .post<{
        catalog?: ApiCatalog;
        items?: Array<{
          productId?: string;
          name?: string;
          skuCode?: string;
          categoryName?: string;
          metalType?: string;
          purity?: string;
          color?: string;
          currentPrice?: number;
          priceSnapshot?: number;
          primaryImageId?: string | null;
        }>;
        catalogUrl?: string;
        whatsappUrl?: string;
      }>('/catalog/catalogDetail', { catalogId })
      .pipe(
        map((res) => {
          const catalog = this.normalizeCatalog({
            ...(res?.catalog || {}),
            catalogId: res?.catalog?.catalogId || catalogId,
            catalogUrl: res?.catalogUrl || res?.catalog?.catalogUrl,
            whatsappUrl: res?.whatsappUrl || res?.catalog?.whatsappUrl,
            itemCount: res?.items?.length ?? res?.catalog?.itemCount,
          });
          const products: Product[] = (res?.items ?? []).map((p) => ({
            id: String(p.productId || ''),
            name: p.name || '',
            category: p.categoryName || '',
            sku: p.skuCode || '',
            metalType: p.metalType || '',
            purity: p.purity || '',
            color: p.color || '',
            price: p.currentPrice ?? p.priceSnapshot ?? null,
            primaryImageId: p.primaryImageId ? String(p.primaryImageId) : null,
            catalogId,
          }));
          return {
            catalog,
            products,
            catalogUrl: res?.catalogUrl || catalog.shareUrl || '',
            whatsappUrl: res?.whatsappUrl || catalog.whatsappUrl || '',
          };
        })
      );
  }

  updateCatalog(
    id: string,
    payload: {
      name?: string;
      /** Product ids to ADD. */
      addProductIds?: string[];
      /** Product ids to REMOVE. */
      removeProductIds?: string[];
      customerName?: string | null;
      customerPhone?: string | null;
      priceVisible?: boolean | null;
      expiryDays?: number | null;
      neverExpires?: boolean | null;
    }
  ): Observable<Catalog> {
    const addIds = [...new Set((payload.addProductIds ?? []).map(String).filter(Boolean))];
    const removeIds = [...new Set((payload.removeProductIds ?? []).map(String).filter(Boolean))];
    return this.api
      .post<ApiCatalogActionResponse>(
        '/catalog/updateCatalog',
        {
          catalogId: id,
          title: payload.name?.trim() || null,
          productIds: addIds.length ? addIds : null,
          removeProductIds: removeIds.length ? removeIds : null,
          customerName: payload.customerName?.trim() || null,
          customerPhone: payload.customerPhone?.trim() || null,
          priceVisible: payload.priceVisible ?? null,
          expiryDays: payload.neverExpires ? null : payload.expiryDays ?? null,
          neverExpires: payload.neverExpires ?? null,
        }
      )
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to update catalog.');
          }
          return this.normalizeCatalog({
            catalogId: id,
            title: payload.name,
            itemCount: res?.itemCount,
            status: 'active',
            effectiveStatus: 'active',
            priceVisible: payload.priceVisible,
          });
        })
      );
  }

  ensureCatalogShare(catalogId: string): Observable<{ shortCode: string; url: string }> {
    return this.getCatalogDetail(catalogId).pipe(
      map((d) => ({
        shortCode: d.catalog.token || d.catalog.shortCode || '',
        url: d.catalogUrl || d.catalog.shareUrl || '',
      }))
    );
  }

  /** POST /catalog/revokeCatalog */
  deleteCatalog(id: string): Observable<void> {
    return this.api
      .post<ApiCatalogActionResponse>('/catalog/revokeCatalog', {
        catalogId: id,
      })
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to revoke catalog.');
          }
        })
      );
  }

  revokeCatalog(id: string): Observable<void> {
    return this.deleteCatalog(id);
  }

  getProducts(): Observable<Product[]> {
    return this.api
      .post<{ products?: unknown[] }>('/product/productList', {})
      .pipe(map((res) => (res?.products as Product[]) ?? []));
  }

  getLeads(filters?: {
    enquiryStatus?: string | null;
    search?: string | null;
  }): Observable<Enquiry[]> {
    return this.api
      .post<ApiEnquiryListResponse>('/enquiry/enquiryList', {
        enquiryId: null,
        enquiryStatus: filters?.enquiryStatus || null,
        search: filters?.search || null,
        pageSize: null,
        pageOffset: null,
      })
      .pipe(map((res) => (res?.enquiries ?? []).map((e) => this.normalizeEnquiry(e))));
  }

  getLeadDetail(enquiryId: string): Observable<Enquiry> {
    return this.api
      .post<ApiEnquiryDetailResponse>('/enquiry/enquiryDetail', { enquiryId })
      .pipe(
        map((res) => {
          if (!res?.enquiry) {
            throw new Error(res?.message || 'Enquiry not found.');
          }
          return this.normalizeEnquiry(res.enquiry, res.items, res.catalogUrl);
        })
      );
  }

  updateLeadStatus(enquiryId: string, enquiryStatus: string): Observable<Enquiry['status']> {
    return this.api
      .post<{ success?: boolean; enquiryStatus?: string; message?: string | null }>(
        '/enquiry/updateEnquiryStatus',
        {
          enquiryId,
          enquiryStatus,
        }
      )
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to update status.');
          }
          return this.mapEnquiryStatus(res?.enquiryStatus || enquiryStatus);
        })
      );
  }

  filterLeads(items: Enquiry[], search: string, status: string): Enquiry[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.customerName.toLowerCase().includes(term) ||
        (item.customerPhone || '').includes(term) ||
        (item.message || '').toLowerCase().includes(term) ||
        (item.productName || '').toLowerCase().includes(term) ||
        (item.catalogTitle || '').toLowerCase().includes(term);
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }

  /** POST /master/businessProfile */
  getProfile(): Observable<VendorAccount | null> {
    return this.api.post<ApiBusinessProfile>('/master/businessProfile', {}).pipe(
      map((profile) => (profile ? this.mapBusinessProfile(profile) : null))
    );
  }

  /**
   * logoUri from businessProfile is s3://… (not browser-loadable).
   * Existing public route streams it: GET /public/businessLogo/{catalogToken}.
   */
  resolveBusinessLogoUrl(cacheBust = false): Observable<string> {
    return this.getCatalogs().pipe(
      map((catalogs) => {
        const token = this.findCatalogShareToken(catalogs);
        if (!token) {
          return '';
        }
        const base = (environment.apiUrl || '').replace(/\/$/, '');
        const url = `${base}/public/businessLogo/${encodeURIComponent(token)}`;
        return cacheBust ? `${url}?t=${Date.now()}` : url;
      })
    );
  }

  private findCatalogShareToken(catalogs: Catalog[]): string {
    for (const c of catalogs) {
      const direct = (c.token || c.shortCode || '').trim();
      if (direct) {
        return direct;
      }
      const fromUrl = this.tokenFromCatalogUrl(c.shareUrl || '');
      if (fromUrl) {
        return fromUrl;
      }
    }
    return '';
  }

  private tokenFromCatalogUrl(url: string): string {
    if (!url) {
      return '';
    }
    // e.g. https://host/c/aB3xY9k2 or /c/aB3xY9k2
    const match = url.match(/\/c\/([A-Za-z0-9_-]+)/);
    return match?.[1] || '';
  }

  /** POST /master/updateBusinessProfile (multipart: profile JSON + optional logo file) */
  updateProfile(
    payload: UpdateBusinessProfilePayload,
    logoFile?: File | null
  ): Observable<VendorAccount> {
    const profile = {
      businessName: payload.businessName.trim(),
      ownerName: payload.ownerName?.trim() || null,
      contactEmail: payload.contactEmail.trim(),
      contactPhone: payload.contactPhone.trim(),
      city: payload.city?.trim() || null,
      brandColor: payload.brandColor?.trim() || null,
      currency: payload.currency?.trim() || null,
      catalogExpiryDays:
        payload.catalogExpiryDays != null && !Number.isNaN(Number(payload.catalogExpiryDays))
          ? Number(payload.catalogExpiryDays)
          : null,
      priceVisibleDefault: payload.priceVisibleDefault ?? true,
      logoUri: logoFile ? null : payload.logoUri || null,
    };

    const formData = new FormData();
    formData.append('profile', JSON.stringify(profile));
    if (logoFile) {
      formData.append('logo', logoFile, logoFile.name);
    }

    return this.api
      .postFormData<ApiBusinessProfile | BusinessProfileUpdateResponse>('/master/updateBusinessProfile', formData)
      .pipe(
        map((updated) => {
          const logoUri =
            updated && typeof updated === 'object' && 'logoUri' in updated
              ? (updated as ApiBusinessProfile).logoUri
              : null;
          return this.mapBusinessProfile(
            {
              tenantId:
                (updated && 'tenantId' in updated && updated.tenantId) ||
                this.getVendorId() ||
                undefined,
              businessName: payload.businessName,
              ownerName: payload.ownerName,
              contactEmail: payload.contactEmail,
              contactPhone: payload.contactPhone,
              city: payload.city,
              brandColor: payload.brandColor,
              currency: payload.currency,
              catalogExpiryDays: payload.catalogExpiryDays,
              priceVisibleDefault: payload.priceVisibleDefault,
              logoUri: logoUri || payload.logoUri || null,
              accountStatus: 'active',
            },
            {
              fallbackEmail: payload.contactEmail,
              fallbackPhone: payload.contactPhone,
              fallbackLogo: payload.logoUri || '',
            }
          );
        })
      );
  }

  /** @deprecated use updateProfile */
  updateContact(vendorId: string | number, email: string, phone: string): Observable<VendorAccount> {
    return this.updateProfile({
      businessName: 'Business',
      contactEmail: email,
      contactPhone: phone,
    });
  }

  private mapBusinessProfile(
    profile: ApiBusinessProfile | UpdateBusinessProfilePayload,
    opts?: {
      fallbackEmail?: string;
      fallbackPhone?: string;
      fallbackLogo?: string;
    }
  ): VendorAccount {
    const name = profile.businessName || 'Business';
    const accountStatus =
      'accountStatus' in profile ? profile.accountStatus : undefined;
    const logoUri =
      'logoUri' in profile ? profile.logoUri : null;

    return {
      id: String(
        ('tenantId' in profile && profile.tenantId) || this.getVendorId() || ''
      ),
      name,
      initials: name.slice(0, 2).toUpperCase(),
      website: '',
      email: profile.contactEmail || opts?.fallbackEmail || '',
      phone: profile.contactPhone || opts?.fallbackPhone || '',
      contactPerson: profile.ownerName || '',
      plan: 'basic',
      status: accountStatus === 'suspended' ? 'inactive' : 'active',
      subscription: '',
      subscriptionType: 'renewal',
      joinedOn: '',
      city: profile.city || '',
      // Keep raw s3:// uri — display via /public/businessLogo/{catalogToken}
      logoUrl: logoUri || opts?.fallbackLogo || '',
      catalogsCount: 0,
      totalSales: 0,
      rank: 0,
      brandColor: profile.brandColor || undefined,
      currency: profile.currency || undefined,
      catalogExpiryDays: profile.catalogExpiryDays ?? undefined,
      priceVisibleDefault: profile.priceVisibleDefault ?? true,
    };
  }

  filterCatalogs(items: Catalog[], search: string, status: string): Catalog[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }

  filterProducts(
    items: Product[],
    search: string,
    category: string,
    status = 'all'
  ): Product[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const matchesCategory = category === 'all' || item.category === category;
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  private normalizeCatalog(c: ApiCatalog): Catalog {
    const effective = (c.effectiveStatus || c.status || 'active').toLowerCase();
    let status: Catalog['status'] = 'active';
    if (effective === 'revoked' || effective === 'inactive') {
      status = 'inactive';
    } else if (effective === 'expired') {
      status = 'expired';
    } else if (effective === 'pending') {
      status = 'pending';
    }
    return {
      id: String(c.catalogId || ''),
      vendorId: this.getVendorId(),
      name: c.title || c.customerName || 'Catalog',
      status,
      productCount: Number(c.itemCount ?? 0),
      shareUrl: c.catalogUrl || null,
      shortCode: c.token || null,
      token: c.token || null,
      customerName: c.customerName || null,
      customerPhone: c.customerPhone || null,
      whatsappUrl: c.whatsappUrl || null,
      priceVisible: c.priceVisible ?? null,
      expiresAt: c.expiresAt || null,
    };
  }

  private normalizeEnquiry(
    e: ApiEnquiry,
    items?: ApiEnquiryItem[] | null,
    catalogUrl?: string | null
  ): Enquiry {
    const name = e.customerName || 'Customer';
    const status = this.mapEnquiryStatus(e.enquiryStatus || 'new');
    const leadItems = (items ?? []).map((item) => this.normalizeEnquiryItem(item));
    return {
      id: String(e.enquiryId || ''),
      vendorId: this.getVendorId(),
      customerName: name,
      customerPhone: e.customerPhone || '',
      initials: name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join(''),
      message: e.customerNote || '',
      status,
      timeAgo: relativeTimeFromUtc(e.createdAt || '') || '',
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      itemCount: Number(e.itemCount ?? leadItems.length),
      productName: e.catalogTitle || `${e.itemCount ?? leadItems.length} products`,
      interestType: 'enquiry',
      catalogId: e.catalogId,
      token: e.token,
      catalogUrl: catalogUrl || (e.token ? `/c/${e.token}` : undefined),
      catalogTitle: e.catalogTitle || undefined,
      totalPrice: e.totalPrice,
      pricedItemCount: e.pricedItemCount,
      viewCount: e.viewCount,
      items: leadItems,
    };
  }

  private normalizeEnquiryItem(item: ApiEnquiryItem): LeadItem {
    const priceOnRequest = !!item.priceOnRequest;
    const price =
      priceOnRequest || item.priceSnapshot == null || Number(item.priceSnapshot) <= 0
        ? undefined
        : Number(item.priceSnapshot);
    return {
      productId: String(item.productId || ''),
      productName: item.name || 'Product',
      category: item.categoryName,
      price,
      priceOnRequest,
      sku: item.skuCode,
      quantity: item.quantity ?? 1,
      metalType: item.metalType || undefined,
      purity: item.purity || undefined,
      weight: item.grossWeightSnapshot != null ? Number(item.grossWeightSnapshot) : undefined,
      imageUrl: item.primaryImageId || undefined,
    };
  }

  private mapEnquiryStatus(raw: string): Enquiry['status'] {
    const statusRaw = (raw || 'new').toLowerCase();
    if (statusRaw === 'contacted' || statusRaw === 'in_progress' || statusRaw === 'open') {
      return 'contacted';
    }
    if (statusRaw === 'closed_won' || statusRaw === 'responded' || statusRaw === 'won') {
      return 'closed_won';
    }
    if (statusRaw === 'closed_lost' || statusRaw === 'closed' || statusRaw === 'lost') {
      return 'closed_lost';
    }
    return 'new';
  }
}
