import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { ApiHttpService } from '@common/api/api-http.service';
import { Enquiry } from '@common/models/dashboard.model';
import { CartProduct } from './interest-cart.service';

interface SubmitEnquiryResponse {
  success?: boolean;
  enquiryId?: string;
  itemCount?: number;
  businessName?: string;
  contactPhone?: string;
  message?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LeadService {
  private readonly api = inject(ApiHttpService);

  /**
   * Public enquiry via POST /public/submitEnquiry.
   * `storeCode` is the catalog share token.
   */
  submitCartInterest(
    vendorId: string | number,
    customerName: string,
    customerPhone: string,
    products: CartProduct[],
    note = '',
    _source: 'store_home' | 'products' | 'shared_catalog' | 'cart' = 'cart',
    storeCode = ''
  ): Observable<Enquiry> {
    const token = storeCode.trim();
    if (!token) {
      return throwError(() => new Error('Catalog link is missing.'));
    }
    if (!products.length) {
      return throwError(() => new Error('Add at least one product to your interest list.'));
    }

    const name = customerName.trim();
    const phone = customerPhone.trim();

    return this.api
      .post<SubmitEnquiryResponse>('/public/submitEnquiry', {
        token,
        customerName: name || null,
        customerPhone: phone || null,
        customerNote: note.trim() || null,
        items: products.map((p) => ({
          productId: String(p.id),
          quantity: 1,
        })),
      })
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to submit enquiry.');
          }
          return {
            id: String(res?.enquiryId || ''),
            vendorId: String(vendorId),
            customerName: name || 'Customer',
            customerPhone: phone,
            initials: this.getInitials(name || 'Customer'),
            message: note.trim() || `Interested in ${products.length} products`,
            status: 'new' as const,
            timeAgo: 'Just now',
            interestType: 'interested' as const,
            createdAt: new Date().toISOString(),
            itemCount: Number(res?.itemCount ?? products.length),
            productName:
              products.length === 1 ? products[0].name : `${products.length} products`,
            items: products.map((p) => ({
              productId: String(p.id),
              productName: p.name,
              category: p.category,
              price: p.price,
              imageUrl: p.imageUrl,
              sku: p.sku,
            })),
          };
        })
      );
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
}
