import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicStoreNav } from '../../components/public-store-nav/public-store-nav';
import { mergeHomepage } from '../../config/homepage.defaults';
import { HomepageTextItem, PublicStoreContext } from '../../models/storefront.model';
import { CustomerAuthService } from '../../services/customer-auth.service';
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
  private readonly customerAuth = inject(CustomerAuthService);
  private readonly leadService = inject(LeadService);

  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly context = signal<PublicStoreContext | null>(null);
  readonly isSubmitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  note = '';

  readonly cartItems = this.cart.items;
  readonly cartCount = this.cart.count;

  ngOnInit(): void {
    const storeCode = this.route.snapshot.paramMap.get('storeCode') ?? '';
    this.cart.setStore(storeCode);

    this.storefrontService.getStoreContext(storeCode).subscribe({
      next: (ctx) => {
        if (!ctx) {
          this.notFound.set(true);
          this.isLoading.set(false);
          return;
        }
        this.context.set(ctx);
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  topBarItems(ctx: PublicStoreContext): HomepageTextItem[] {
    const home = mergeHomepage(ctx.config.homepage, ctx.vendor.name);
    return home.topBar.enabled ? home.topBar.items : [];
  }

  primaryColor(): string {
    return this.context()?.config.theme.primaryColor ?? '#c9a227';
  }

  accentColor(): string {
    return this.context()?.config.theme.accentColor ?? '#1a1a2e';
  }

  isVerified(): boolean {
    const code = this.context()?.storeCode;
    return !!code && !!this.customerAuth.getSession(code);
  }

  sessionName(): string {
    const code = this.context()?.storeCode;
    return code ? this.customerAuth.getSession(code)?.name ?? '' : '';
  }

  itemPrice(price?: number | null): string {
    return hasDisplayPrice(price) ? formatRs(price) : '';
  }

  removeItem(productId: number): void {
    this.cart.remove(productId);
  }

  submitInterest(): void {
    const ctx = this.context();
    if (!ctx || !this.cartItems().length) {
      return;
    }

    const session = this.customerAuth.getSession(ctx.storeCode);
    if (!session) {
      this.errorMessage.set('Please verify your mobile number from any product first.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.leadService
      .submitCartInterest(
        ctx.vendor.id,
        session.name,
        session.phone,
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
        error: () => {
          this.errorMessage.set('Could not submit your interest. Please try again.');
          this.isSubmitting.set(false);
        },
      });
  }
}
