import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { AuthService } from '../../auth/services/auth.service';
import { AppUser } from '../../admin/models/user.model';
import { relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { Catalog, Enquiry, Product } from '../../dashboard/models/dashboard.model';
import { VendorAccount } from '../../dashboard/models/vendor.model';

type ApiVendor = VendorAccount & { subscriptionLabel?: string };

@Injectable({
  providedIn: 'root',
})
export class VendorDataService {
  private readonly api = inject(ApiHttpService);
  private readonly authService = inject(AuthService);

  getVendorId(): number | null {
    return this.authService.getSession()?.user.vendorId ?? null;
  }

  getCatalogs(): Observable<Catalog[]> {
    return this.api.get<Catalog[]>('/vendor/catalogs').pipe(
      map((items) =>
        items
          .map((c) => ({
            ...c,
            id: Number(c.id),
            vendorId: Number(c.vendorId),
          }))
          // Hide system Default catalog used for product FK / auto-assign
          .filter((c) => c.name !== 'Default')
      )
    );
  }

  createCatalog(name: string, status: Catalog['status'] = 'active'): Observable<Catalog> {
    return this.api
      .post<Catalog>('/vendor/catalogs', { name: name.trim(), status })
      .pipe(
        map((c) => ({
          ...c,
          id: Number(c.id),
          vendorId: Number(c.vendorId),
        }))
      );
  }

  updateCatalog(
    id: number,
    payload: { name?: string; status?: Catalog['status'] }
  ): Observable<Catalog> {
    return this.api.put<Catalog>(`/vendor/catalogs/${id}`, payload).pipe(
      map((c) => ({
        ...c,
        id: Number(c.id),
        vendorId: Number(c.vendorId),
      }))
    );
  }

  deleteCatalog(id: number): Observable<void> {
    return this.api.delete<void>(`/vendor/catalogs/${id}`);
  }

  getProducts(): Observable<Product[]> {
    return this.api.get<Product[]>('/vendor/products');
  }

  getLeads(): Observable<Enquiry[]> {
    return this.api.get<Enquiry[]>('/vendor/leads').pipe(
      map((items) =>
        items.map((lead) => {
          const leadItems =
            lead.items?.length
              ? lead.items
              : lead.productId
                ? [
                    {
                      productId: Number(lead.productId),
                      productName: lead.productName ?? 'Product',
                    },
                  ]
                : [];
          return {
            ...lead,
            id: Number(lead.id),
            vendorId: Number(lead.vendorId ?? this.getVendorId() ?? 0),
            items: leadItems,
            itemCount: lead.itemCount ?? leadItems.length,
            interestType: lead.interestType ?? 'interested',
            timeAgo: relativeTimeFromUtc(lead.createdAt) || lead.timeAgo || '',
            productName:
              lead.productName ??
              (leadItems.length === 1
                ? leadItems[0].productName
                : `${leadItems.length} products`),
          };
        })
      )
    );
  }

  getProfile(): Observable<VendorAccount | null> {
    return this.api.get<ApiVendor & { logoUrl?: string }>('/vendor/profile').pipe(
      map((vendor) => ({
        ...vendor,
        id: Number(vendor.id),
        subscription: vendor.subscriptionLabel || vendor.subscription || '',
        catalogsCount: Number(vendor.catalogsCount ?? 0),
        totalSales: Number(vendor.totalSales ?? 0),
        rank: Number(vendor.rank ?? 0),
        logoUrl: vendor.logoUrl || '',
      }))
    );
  }

  updateProfile(
    payload: {
      email: string;
      phone: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      logoUrl?: string | null;
    }
  ): Observable<VendorAccount> {
    return this.api
      .patch<ApiVendor & { logoUrl?: string }>('/vendor/profile/contact', {
        email: payload.email,
        phone: payload.phone,
        address: payload.address ?? '',
        city: payload.city ?? '',
        state: payload.state ?? '',
        pincode: payload.pincode ?? '',
        logoUrl: payload.logoUrl ?? '',
      })
      .pipe(
        map((vendor) => ({
          ...vendor,
          id: Number(vendor.id),
          subscription: vendor.subscriptionLabel || vendor.subscription || '',
          catalogsCount: Number(vendor.catalogsCount ?? 0),
          totalSales: Number(vendor.totalSales ?? 0),
          rank: Number(vendor.rank ?? 0),
          logoUrl: vendor.logoUrl || '',
        }))
      );
  }

  /** @deprecated use updateProfile */
  updateContact(vendorId: number, email: string, phone: string): Observable<VendorAccount> {
    return this.updateProfile({ email, phone }).pipe(
      map((v) => ({ ...v, id: vendorId }))
    );
  }

  getVendorUsers(): Observable<AppUser[]> {
    return this.api.get<AppUser[]>('/admin/users').pipe(
      map((users) => {
        const vendorId = this.getVendorId();
        if (!vendorId) {
          return [];
        }
        return users.filter((user) => Number(user.vendorId) === vendorId);
      })
    );
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
    catalogId: string
  ): Product[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const matchesCategory = category === 'all' || item.category === category;
      const matchesCatalog = catalogId === 'all' || item.catalogId === Number(catalogId);
      return matchesSearch && matchesCategory && matchesCatalog;
    });
  }

  filterLeads(items: Enquiry[], search: string, status: string): Enquiry[] {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const productText = [
        item.productName ?? '',
        ...(item.items ?? []).map((i) => i.productName),
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch =
        !term ||
        item.customerName.toLowerCase().includes(term) ||
        (item.customerPhone ?? '').includes(term) ||
        productText.includes(term) ||
        item.message.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }

}
