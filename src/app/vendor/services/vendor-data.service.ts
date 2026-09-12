import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { AuthService } from '../../auth/services/auth.service';
import { relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { Catalog, Enquiry, Product } from '../../dashboard/models/dashboard.model';
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
}

interface ApiCatalogListResponse {
  catalogs?: ApiCatalog[];
}

interface ApiEnquiry {
  enquiryId?: string;
  catalogId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerNote?: string | null;
  itemCount?: number;
  totalPrice?: number;
  enquiryStatus?: string;
  createdAt?: string;
  token?: string;
  catalogTitle?: string | null;
}

interface ApiEnquiryListResponse {
  enquiries?: ApiEnquiry[];
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

  createCatalog(
    name: string,
    status: Catalog['status'] = 'active',
    productIds: string[] = []
  ): Observable<Catalog> {
    return this.api
      .post<{
        success?: boolean;
        catalogId?: string;
        token?: string;
        catalogUrl?: string;
        whatsappUrl?: string;
        title?: string;
        itemCount?: number;
        message?: string | null;
      }>('/catalog/createCatalog', {
        title: name.trim(),
        productIds: productIds.length ? productIds : null,
        selectAll: productIds.length ? false : true,
        priceVisible: true,
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
            itemCount: res.itemCount ?? productIds.length,
            catalogUrl: res.catalogUrl,
            whatsappUrl: res.whatsappUrl,
            effectiveStatus: status,
            status: status === 'inactive' ? 'revoked' : 'active',
          });
        })
      );
  }

  updateCatalog(
    id: string,
    payload: { name?: string; status?: Catalog['status'] }
  ): Observable<Catalog> {
    if (payload.status === 'inactive') {
      return this.deleteCatalog(id).pipe(
        map(() =>
          this.normalizeCatalog({
            catalogId: id,
            title: payload.name,
            status: 'revoked',
            effectiveStatus: 'revoked',
          })
        )
      );
    }
    return this.api
      .post<{ success?: boolean; message?: string | null }>('/catalog/updateCatalog', {
        catalogId: id,
        title: payload.name?.trim() || null,
      })
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to update catalog.');
          }
          return this.normalizeCatalog({
            catalogId: id,
            title: payload.name,
            status: 'active',
            effectiveStatus: 'active',
          });
        })
      );
  }

  getCatalogProducts(catalogId: string): Observable<Product[]> {
    return this.api
      .post<{ items?: Array<{
        productId?: string;
        name?: string;
        skuCode?: string;
        categoryName?: string;
        metalType?: string;
        purity?: string;
        color?: string;
        currentPrice?: number;
        priceSnapshot?: number;
      }> }>('/catalog/catalogDetail', { catalogId })
      .pipe(
        map((res) =>
          (res?.items ?? []).map((p) => ({
            id: String(p.productId || ''),
            name: p.name || '',
            category: p.categoryName || '',
            sku: p.skuCode || '',
            metalType: p.metalType || '',
            purity: p.purity || '',
            color: p.color || '',
            price: p.currentPrice ?? p.priceSnapshot ?? null,
            catalogId,
          }))
        )
      );
  }

  setCatalogProducts(catalogId: string, productIds: string[]): Observable<Catalog> {
    return this.api
      .post<{ success?: boolean; message?: string | null }>('/catalog/updateCatalog', {
        catalogId,
        productIds,
      })
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to update catalog products.');
          }
          return this.normalizeCatalog({
            catalogId,
            itemCount: productIds.length,
            status: 'active',
            effectiveStatus: 'active',
          });
        })
      );
  }

  ensureCatalogShare(catalogId: string): Observable<{ shortCode: string; url: string }> {
    return this.api.post<{ catalog?: ApiCatalog; catalogUrl?: string; token?: string }>(
      '/catalog/catalogDetail',
      { catalogId }
    ).pipe(
      map((res) => ({
        shortCode: res?.catalog?.token || res?.token || '',
        url: res?.catalogUrl || res?.catalog?.catalogUrl || '',
      }))
    );
  }

  deleteCatalog(id: string): Observable<void> {
    return this.api
      .post<{ success?: boolean; message?: string | null }>('/catalog/revokeCatalog', {
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

  getProducts(): Observable<Product[]> {
    return this.api
      .post<{ products?: unknown[] }>('/product/productList', {})
      .pipe(map((res) => (res?.products as Product[]) ?? []));
  }

  getLeads(): Observable<Enquiry[]> {
    return this.api
      .post<ApiEnquiryListResponse>('/enquiry/enquiryList', {
        enquiryId: null,
        enquiryStatus: null,
        search: null,
        pageSize: null,
        pageOffset: null,
      })
      .pipe(map((res) => (res?.enquiries ?? []).map((e) => this.normalizeEnquiry(e))));
  }

  updateLeadStatus(enquiryId: string, enquiryStatus: string): Observable<void> {
    return this.api
      .post<{ success?: boolean }>('/enquiry/updateEnquiryStatus', {
        enquiryId,
        enquiryStatus,
      })
      .pipe(map(() => undefined));
  }

  filterLeads(items: Enquiry[], search: string, status: string): Enquiry[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.customerName.toLowerCase().includes(term) ||
        (item.customerPhone || '').includes(term) ||
        (item.message || '').toLowerCase().includes(term) ||
        (item.productName || '').toLowerCase().includes(term);
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }

  getProfile(): Observable<VendorAccount | null> {
    return this.api.post<ApiBusinessProfile>('/master/businessProfile', {}).pipe(
      map((profile) => {
        if (!profile) {
          return null;
        }
        const name = profile.businessName || 'Business';
        return {
          id: String(profile.tenantId || this.getVendorId() || ''),
          name,
          initials: name.slice(0, 2).toUpperCase(),
          website: '',
          email: profile.contactEmail || '',
          phone: profile.contactPhone || '',
          contactPerson: profile.ownerName || '',
          plan: 'basic',
          status: profile.accountStatus === 'suspended' ? 'inactive' : 'active',
          subscription: '',
          subscriptionType: 'renewal',
          joinedOn: '',
          city: profile.city || '',
          logoUrl: profile.logoUri || '',
          catalogsCount: 0,
          totalSales: 0,
          rank: 0,
          brandColor: profile.brandColor || undefined,
          currency: profile.currency || undefined,
          catalogExpiryDays: profile.catalogExpiryDays ?? undefined,
          priceVisibleDefault: profile.priceVisibleDefault ?? true,
        } as VendorAccount;
      })
    );
  }

  updateProfile(payload: {
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    logoUrl?: string | null;
    businessName?: string;
    ownerName?: string;
  }): Observable<VendorAccount> {
    const profile = {
      businessName: payload.businessName || 'Business',
      ownerName: payload.ownerName || null,
      contactEmail: payload.email,
      contactPhone: payload.phone,
      city: payload.city || null,
    };
    const formData = new FormData();
    formData.append('profile', JSON.stringify(profile));
    return this.api.postFormData<ApiBusinessProfile>('/master/updateBusinessProfile', formData).pipe(
      map((updated) => ({
        id: String(updated?.tenantId || this.getVendorId() || ''),
        name: updated?.businessName || profile.businessName,
        initials: (updated?.businessName || profile.businessName).slice(0, 2).toUpperCase(),
        website: '',
        email: updated?.contactEmail || payload.email,
        phone: updated?.contactPhone || payload.phone,
        contactPerson: updated?.ownerName || payload.ownerName || '',
        plan: 'basic' as const,
        status: 'active' as const,
        subscription: '',
        subscriptionType: 'renewal' as const,
        joinedOn: '',
        city: updated?.city || payload.city || '',
        logoUrl: updated?.logoUri || payload.logoUrl || '',
        catalogsCount: 0,
        totalSales: 0,
        rank: 0,
      }))
    );
  }

  /** @deprecated use updateProfile */
  updateContact(vendorId: string | number, email: string, phone: string): Observable<VendorAccount> {
    return this.updateProfile({ email, phone });
  }

  getVendorUsers(): Observable<never[]> {
    return of([]);
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
    };
  }

  private normalizeEnquiry(e: ApiEnquiry): Enquiry {
    const name = e.customerName || 'Customer';
    const statusRaw = (e.enquiryStatus || 'new').toLowerCase();
    let status: Enquiry['status'] = 'new';
    if (statusRaw === 'in_progress' || statusRaw === 'open') {
      status = 'in_progress';
    } else if (statusRaw === 'responded' || statusRaw === 'won') {
      status = 'responded';
    } else if (statusRaw === 'closed' || statusRaw === 'lost') {
      status = 'closed';
    }
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
      message: e.customerNote || e.catalogTitle || '',
      status,
      timeAgo: relativeTimeFromUtc(e.createdAt || '') || '',
      createdAt: e.createdAt,
      itemCount: Number(e.itemCount ?? 0),
      productName: e.catalogTitle || `${e.itemCount ?? 0} products`,
      interestType: 'enquiry',
      catalogId: e.catalogId,
      token: e.token,
      totalPrice: e.totalPrice,
      items: [],
    };
  }
}
