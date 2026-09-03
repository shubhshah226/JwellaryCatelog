import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { Enquiry } from '../../dashboard/models/dashboard.model';
import { CartProduct } from './interest-cart.service';
import { CustomerAuthService } from './customer-auth.service';

interface LeadSubmitResponse {
  leadId: number;
  itemCount: number;
  status: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class LeadService {
  private readonly api = inject(ApiHttpService);
  private readonly customerAuth = inject(CustomerAuthService);

  submitCartInterest(
    vendorId: number,
    _customerName: string,
    _customerPhone: string,
    products: CartProduct[],
    note = '',
    source: 'store_home' | 'products' | 'shared_catalog' | 'cart' = 'cart',
    storeCode = ''
  ): Observable<Enquiry> {
    const code = storeCode || this.customerAuth.getActiveStoreCode();
    const session = code ? this.customerAuth.getSession(code) : null;
    if (!code || !session?.sessionToken) {
      return throwError(() => new Error('Please verify your mobile number first.'));
    }
    if (!products.length) {
      return throwError(() => new Error('Add at least one product to your interest list.'));
    }

    const headers = new HttpHeaders({
      'X-Customer-Session': session.sessionToken,
    });

    const apiSource =
      source === 'cart' || source === 'products'
        ? 'products'
        : source === 'store_home'
          ? 'store_home'
          : 'shared_catalog';

    return this.api
      .post<LeadSubmitResponse>(
        `/public/stores/${code}/leads`,
        {
          productIds: products.map((p) => p.id),
          message: note.trim() || undefined,
          source: apiSource,
        },
        undefined,
        headers
      )
      .pipe(
        map((res) => ({
          id: res.leadId,
          vendorId,
          customerName: session.name,
          customerPhone: session.phone,
          initials: this.getInitials(session.name),
          message: note.trim() || `Interested in ${products.length} products`,
          status: (res.status as Enquiry['status']) || 'new',
          timeAgo: 'Just now',
          interestType: 'interested' as const,
          createdAt: res.createdAt,
          itemCount: res.itemCount,
          productName:
            products.length === 1 ? products[0].name : `${products.length} products`,
          items: products.map((p) => ({
            productId: p.id,
            productName: p.name,
            category: p.category,
            price: p.price,
            imageUrl: p.imageUrl,
            sku: p.sku,
          })),
        }))
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
