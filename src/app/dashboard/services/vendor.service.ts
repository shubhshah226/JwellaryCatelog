import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import {
  ResetOwnerPasswordParamModel,
  UpdateTenantStatusParamModel,
  VendorAccount,
  VendorCreateResult,
  VendorFormData,
  VendorLoginCredentials,
  VendorStats,
  buildVendorMasters,
  createEmptyVendorForm,
} from '../models/vendor.model';

/** New API tenant list item (camelCase wire format). */
interface ApiTenant {
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
  createdAt?: string | null;
  ownerUserId?: string | null;
  ownerEmail?: string | null;
  ownerAccountStatus?: string | null;
  ownerLastLoginAt?: string | null;
  productCount?: number | null;
  catalogCount?: number | null;
  viewedCatalogCount?: number | null;
  enquiryCount?: number | null;
}

interface PlatformSummary {
  tenantCount?: number;
  activeTenantCount?: number;
  suspendedTenantCount?: number;
  newTenantCount?: number;
  productCount?: number;
  catalogCount?: number;
  viewedCatalogCount?: number;
  enquiryCount?: number;
  newEnquiryCount?: number;
}

interface TenantListParams {
  tenantId?: string | null;
  accountStatus?: string | null;
  search?: string | null;
  pageSize?: number | null;
  pageOffset?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class VendorService {
  private readonly api = inject(ApiHttpService);

  getVendorsData(): Observable<{ vendors: VendorAccount[]; stats: VendorStats }> {
    return forkJoin({
      tenants: this.api.post<ApiTenant[]>('/admin/tenantList', {
        tenantId: null,
        accountStatus: null,
        search: null,
        pageSize: null,
        pageOffset: null,
      } satisfies TenantListParams),
      summary: this.api.post<PlatformSummary>('/admin/platformSummary', {}).pipe(
        catchError(() => of(null))
      ),
    }).pipe(
      map(({ tenants, summary }) => {
        const list = Array.isArray(tenants) ? tenants : [];
        const vendors = list.map((t) => this.mapTenantToVendor(t));
        return {
          vendors,
          stats: this.mapSummaryToStats(summary, vendors),
        };
      })
    );
  }

  createVendor(form: VendorFormData): Observable<VendorCreateResult> {
    const categories = form.categories.map((c) => c.trim()).filter(Boolean);
    const masters = buildVendorMasters(form);

    const payload = {
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim() || null,
      ownerEmail: form.ownerEmail.trim(),
      contactPhone: form.contactPhone.trim() || null,
      city: form.city.trim() || null,
      brandColor: form.brandColor.trim() || null,
      currency: form.currency.trim() || 'INR',
      catalogExpiryDays: form.catalogExpiryDays,
      priceVisibleDefault: form.priceVisibleDefault,
      categories: categories.length ? categories : null,
      masters: masters.length ? masters : null,
    };

    return this.api.post<{
      success?: boolean;
      tenantId?: string;
      ownerUserId?: string;
      ownerEmail?: string;
      ownerPassword?: string;
      message?: string | null;
    }>('/admin/addTenant', payload).pipe(
      map((created) => {
        if (!created?.success || !created.tenantId) {
          throw new Error(created?.message || 'Unable to create vendor.');
        }
        const vendor = this.mapTenantToVendor({
          tenantId: created.tenantId,
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim() || null,
          contactEmail: form.ownerEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          city: form.city.trim() || null,
          brandColor: form.brandColor.trim() || null,
          currency: form.currency.trim() || 'INR',
          catalogExpiryDays: form.catalogExpiryDays,
          priceVisibleDefault: form.priceVisibleDefault,
          ownerEmail: created.ownerEmail || form.ownerEmail.trim(),
          ownerUserId: created.ownerUserId,
          accountStatus: form.status === 'inactive' ? 'suspended' : 'active',
          productCount: 0,
          catalogCount: 0,
          enquiryCount: 0,
          createdAt: new Date().toISOString(),
        });
        return {
          vendor,
          loginCredentials: {
            username: created.ownerEmail || form.ownerEmail.trim(),
            password: created.ownerPassword || '',
            emailSent: false,
          },
        };
      })
    );
  }

  updateVendor(vendor: VendorAccount, form: VendorFormData): Observable<VendorAccount> {
    const payload = {
      tenantId: vendor.id,
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim() || null,
      contactEmail: form.ownerEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      city: form.city.trim() || null,
      brandColor: form.brandColor.trim() || null,
      currency: form.currency.trim() || null,
      catalogExpiryDays: form.catalogExpiryDays,
      priceVisibleDefault: form.priceVisibleDefault,
    };

    return this.api.post<{ success?: boolean; message?: string | null }>('/admin/updateTenant', payload).pipe(
      map((res) => {
        if (res && res.success === false) {
          throw new Error(res.message || 'Unable to update vendor.');
        }
        return {
          ...vendor,
          name: form.businessName.trim(),
          initials: this.initialsFromName(form.businessName.trim()),
          contactPerson: form.ownerName.trim() || '',
          email: form.ownerEmail.trim(),
          phone: form.contactPhone.trim(),
          city: form.city.trim() || '',
          brandColor: form.brandColor.trim() || vendor.brandColor,
          currency: form.currency.trim() || vendor.currency,
          catalogExpiryDays: form.catalogExpiryDays ?? vendor.catalogExpiryDays,
          priceVisibleDefault: form.priceVisibleDefault,
        };
      })
    );
  }

  /** POST /admin/updateTenantStatus — accountStatus is `active` | `suspended`. */
  updateTenantStatus(
    param: UpdateTenantStatusParamModel
  ): Observable<{ success: boolean; message: string | null; status: VendorAccount['status'] }> {
    return this.api
      .post<{ success?: boolean; message?: string | null; tenantId?: string }>(
        '/admin/updateTenantStatus',
        param
      )
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to update vendor status.');
          }
          return {
            success: true,
            message: res?.message ?? null,
            status: this.mapAccountStatus(param.accountStatus),
          };
        })
      );
  }

  /** POST /admin/resetOwnerPassword */
  resetOwnerPassword(
    param: ResetOwnerPasswordParamModel
  ): Observable<VendorLoginCredentials & { message: string | null }> {
    return this.api
      .post<{
        success?: boolean;
        message?: string | null;
        tenantId?: string;
        ownerEmail?: string;
        ownerPassword?: string;
        sessionsEnded?: number;
      }>('/admin/resetOwnerPassword', param)
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to reset owner password.');
          }
          const password = (res?.ownerPassword || param.newPassword || '').trim();
          if (!password) {
            throw new Error(res?.message || 'Password reset succeeded but no password was returned.');
          }
          return {
            username: (res?.ownerEmail || '').trim(),
            password,
            emailSent: false,
            message: res?.message ?? null,
          };
        })
      );
  }

  mapVendorToForm(vendor: VendorAccount): VendorFormData {
    return {
      ...createEmptyVendorForm(),
      businessName: vendor.name,
      ownerName: vendor.contactPerson ?? '',
      ownerEmail: vendor.email,
      contactPhone: vendor.phone,
      city: vendor.city ?? '',
      brandColor: this.normalizeHexColor(vendor.brandColor) || '#8B0000',
      currency: vendor.currency || 'INR',
      catalogExpiryDays: vendor.catalogExpiryDays ?? 30,
      priceVisibleDefault: vendor.priceVisibleDefault ?? true,
      status: vendor.status === 'inactive' ? 'inactive' : 'active',
      vendorId: vendor.id,
      storeCode: vendor.storeCode ?? '',
      website: vendor.website ?? '',
      address: vendor.address ?? '',
      state: vendor.state ?? '',
      pincode: vendor.pincode ?? '',
      alternativePhone: vendor.alternativePhone ?? '',
    };
  }

  private mapTenantToVendor(tenant: ApiTenant): VendorAccount {
    const name = (tenant.businessName || '').trim() || 'Untitled';
    const status = this.mapAccountStatus(tenant.accountStatus);
    return {
      id: String(tenant.tenantId || ''),
      userId: tenant.ownerUserId ? String(tenant.ownerUserId) : undefined,
      name,
      initials: this.initialsFromName(name),
      website: '',
      email: (tenant.ownerEmail || tenant.contactEmail || '').trim(),
      phone: (tenant.contactPhone || '').trim(),
      contactPerson: (tenant.ownerName || '').trim(),
      plan: 'basic',
      status,
      subscription: '',
      subscriptionType: status === 'inactive' ? 'expiry' : 'renewal',
      joinedOn: tenant.createdAt ? String(tenant.createdAt) : '',
      city: (tenant.city || '').trim(),
      logoUrl: tenant.logoUri || undefined,
      brandColor: this.normalizeHexColor(tenant.brandColor) || '#8B0000',
      currency: (tenant.currency || '').trim() || 'INR',
      catalogExpiryDays: tenant.catalogExpiryDays ?? 30,
      priceVisibleDefault: tenant.priceVisibleDefault ?? true,
      catalogsCount: Number(tenant.catalogCount ?? 0),
      productCount: Number(tenant.productCount ?? 0),
      enquiryCount: Number(tenant.enquiryCount ?? 0),
      totalSales: 0,
      rank: 0,
    };
  }

  /** HTML color inputs require `#rrggbb`. */
  private normalizeHexColor(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    let hex = value.trim();
    if (!hex) {
      return '';
    }
    if (!hex.startsWith('#')) {
      hex = `#${hex}`;
    }
    const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
    if (short) {
      const [r, g, b] = short[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return hex.toLowerCase();
    }
    return '';
  }

  private mapAccountStatus(status: string | null | undefined): VendorAccount['status'] {
    const value = (status || '').toLowerCase();
    if (value === 'suspended' || value === 'inactive') {
      return 'inactive';
    }
    if (value === 'trial') {
      return 'trial';
    }
    return 'active';
  }

  private mapSummaryToStats(summary: PlatformSummary | null, vendors: VendorAccount[]): VendorStats {
    const total = summary?.tenantCount ?? vendors.length;
    const active = summary?.activeTenantCount ?? vendors.filter((v) => v.status === 'active').length;
    const inactive =
      summary?.suspendedTenantCount ?? vendors.filter((v) => v.status === 'inactive').length;
    const trial = summary?.newTenantCount ?? vendors.filter((v) => v.status === 'trial').length;

    return {
      id: 1,
      total,
      active,
      inactive,
      trial,
      totalChange: 0,
      activeChange: 0,
      inactiveChange: 0,
      trialChange: 0,
      sparklines: {
        total: [],
        active: [],
        inactive: [],
        trial: [],
      },
    };
  }

  private initialsFromName(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'V';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
}
