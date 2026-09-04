import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { generateStoreCode } from '../../core/utils/store-code.util';
import {
  SortDirection,
  VendorAccount,
  VendorCreateResult,
  VendorFilters,
  VendorFormData,
  VendorLoginCredentials,
  VendorSortField,
  VendorStats,
} from '../models/vendor.model';

type ApiVendor = VendorAccount & {
  subscriptionLabel?: string;
  loginCredentials?: VendorLoginCredentials;
};

@Injectable({
  providedIn: 'root',
})
export class VendorService {
  private readonly api = inject(ApiHttpService);

  getVendorsData(): Observable<{ vendors: VendorAccount[]; stats: VendorStats }> {
    return forkJoin({
      vendors: this.api.get<ApiVendor[]>('/admin/vendors'),
      stats: this.api.get<VendorStats>('/admin/vendors/stats'),
    }).pipe(
      map((data) => ({
        vendors: data.vendors.map((v) => this.normalizeVendor(v)),
        stats: {
          ...data.stats,
          id: 1,
        },
      }))
    );
  }

  previewStoreCode(name: string, existingVendors: VendorAccount[]): string {
    const nextId = existingVendors.reduce((max, vendor) => Math.max(max, vendor.id), 0) + 1;
    return generateStoreCode(nextId, name.trim() || 'New Vendor');
  }

  createVendor(form: VendorFormData): Observable<VendorCreateResult> {
    const payload = {
      name: form.name.trim(),
      website: form.website.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      alternativePhone: form.alternativePhone.trim() || null,
      contactPerson: form.contactPerson.trim() || null,
      status: form.status,
      plan: 'basic',
      subscriptionType: form.status === 'inactive' ? 'expiry' : 'renewal',
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
    };

    return this.api.post<ApiVendor>('/admin/vendors', payload).pipe(
      map((vendor) => ({
        vendor: this.normalizeVendor(vendor),
        loginCredentials: vendor.loginCredentials,
      }))
    );
  }

  updateVendor(vendor: VendorAccount, form: VendorFormData): Observable<VendorAccount> {
    const payload = {
      name: form.name.trim(),
      website: form.website.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      alternativePhone: form.alternativePhone.trim() || null,
      contactPerson: form.contactPerson.trim() || null,
      status: form.status,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
      rank: vendor.rank,
    };

    return this.api
      .put<ApiVendor>(`/admin/vendors/${vendor.id}`, payload)
      .pipe(map((updated) => this.normalizeVendor(updated)));
  }

  mapVendorToForm(vendor: VendorAccount): VendorFormData {
    return {
      name: vendor.name,
      website: vendor.website ?? '',
      contactPerson: vendor.contactPerson ?? '',
      email: vendor.email,
      phone: vendor.phone,
      alternativePhone: vendor.alternativePhone ?? '',
      address: vendor.address ?? '',
      city: vendor.city ?? '',
      state: vendor.state ?? '',
      pincode: vendor.pincode ?? '',
      status: vendor.status === 'inactive' ? 'inactive' : 'active',
      vendorId: vendor.id,
      storeCode: vendor.storeCode ?? '',
    };
  }

  filterVendors(vendors: VendorAccount[], filters: VendorFilters): VendorAccount[] {
    return vendors.filter((vendor) => {
      const search = filters.search.trim().toLowerCase();
      const matchesSearch =
        !search ||
        vendor.name.toLowerCase().includes(search) ||
        vendor.email.toLowerCase().includes(search) ||
        vendor.website.toLowerCase().includes(search) ||
        vendor.phone.includes(search) ||
        (vendor.storeCode ?? '').toLowerCase().includes(search) ||
        String(vendor.id).includes(search);

      const matchesStatus = filters.status === 'all' || vendor.status === filters.status;
      const matchesPlan = filters.plan === 'all' || vendor.plan === filters.plan;
      const matchesSubscription =
        filters.subscription === 'all' || vendor.subscriptionType === filters.subscription;
      const matchesJoinedDate =
        !filters.joinedDate || vendor.joinedOn.includes(filters.joinedDate);

      return (
        matchesSearch && matchesStatus && matchesPlan && matchesSubscription && matchesJoinedDate
      );
    });
  }

  sortVendors(
    vendors: VendorAccount[],
    field: VendorSortField,
    direction: SortDirection
  ): VendorAccount[] {
    const sorted = [...vendors].sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'joinedOn':
          comparison = this.parseDate(a.joinedOn) - this.parseDate(b.joinedOn);
          break;
        case 'subscription':
          comparison = a.subscription.localeCompare(b.subscription, undefined, {
            sensitivity: 'base',
          });
          break;
        default:
          comparison = String(a[field] ?? '').localeCompare(String(b[field] ?? ''), undefined, {
            sensitivity: 'base',
          });
      }
      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }

  private normalizeVendor(vendor: ApiVendor): VendorAccount {
    return {
      ...vendor,
      id: Number(vendor.id),
      website: vendor.website ?? '',
      email: vendor.email ?? '',
      phone: vendor.phone ?? '',
      alternativePhone: vendor.alternativePhone ?? '',
      userId:
        vendor.userId !== undefined && vendor.userId !== null ? Number(vendor.userId) : undefined,
      catalogsCount: Number(vendor.catalogsCount ?? 0),
      totalSales: Number(vendor.totalSales ?? 0),
      rank: Number(vendor.rank ?? 0),
      subscription: vendor.subscriptionLabel || vendor.subscription || '',
    };
  }

  private parseDate(value: string): number {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
}
