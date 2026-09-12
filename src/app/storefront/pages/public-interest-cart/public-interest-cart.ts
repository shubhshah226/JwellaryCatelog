import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicStoreNav } from '../../components/public-store-nav/public-store-nav';
import { PublicStoreContext } from '../../models/storefront.model';
import { InterestCartService } from '../../services/interest-cart.service';
import { LeadService } from '../../services/lead.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';

@Component({
  selector: 'app-public-interest-cart',
  imports: [FormsModule, RouterLink, PublicStoreNav],
  templateUrl: './public-interest-cart.html',
  styleUrl: './public-interest-cart.css',
})
export class PublicInterestCart implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storefrontService = inject(StorefrontService);
  private readonly cart = inject(InterestCartService);
  private readonly leadService = inject(LeadService);

  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly context = signal<PublicStoreContext | null>(null);
  readonly isSubmitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  note = '';
  guestName = '';
  guestPhone = '';

  readonly cartItems = this.cart.items;
  readonly cartCount = this.cart.count;

  ngOnInit(): void {
    const storeCode = this.route.snapshot.paramMap.get('storeCode') ?? '';
    this.cart.setStore(storeCode);

    this.storefrontService.getStoreContext(storeCode).subscribe({
      next: (ctx) => {
        if (!ctx || ctx.isAvailable === false) {
          this.notFound.set(true);
          this.isLoading.set(false);
          return;
        }
        this.context.set(ctx);
        if (ctx.customerName) {
          this.guestName = ctx.customerName;
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  catalogBrowseLink(ctx: PublicStoreContext): string[] {
    return ['/c', ctx.storeCode];
  }

  brandColor(ctx: PublicStoreContext): string {
    return ctx.brandColor || ctx.config.theme.primaryColor || '#c9a227';
  }

  primaryColor(): string {
    const ctx = this.context();
    return ctx ? this.brandColor(ctx) : '#c9a227';
  }

  accentColor(): string {
    return this.context()?.config.theme.accentColor ?? '#1a1a2e';
  }

  itemPrice(price?: number | null): string {
    return hasDisplayPrice(price) ? formatRs(price) : '';
  }

  removeItem(productId: string): void {
    this.cart.remove(productId);
  }

  submitInterest(): void {
    const ctx = this.context();
    if (!ctx || !this.cartItems().length) {
      return;
    }

    const name = this.guestName.trim();
    const phone = this.guestPhone.trim();
    if (!name || !phone) {
      this.errorMessage.set('Please enter your name and phone number.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.leadService
      .submitCartInterest(
        ctx.vendor.id,
        name,
        phone,
        this.cartItems(),
        this.note,
        'cart',
        ctx.storeCode
      )
      .subscribe({
        next: () => {
          this.cart.clear();
          this.submitted.set(true);
          this.successMessage.set(
            `${ctx.vendor.name} has been notified of your interest in these pieces.`
          );
          this.isSubmitting.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            err instanceof Error ? err.message : 'Could not submit your interest. Please try again.'
          );
          this.isSubmitting.set(false);
        },
      });
  }
}
