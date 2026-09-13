import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PhoneDigitsDirective } from '@common/directives/phone-digits.directive';
import { phoneFieldError, sanitizePhoneDigits } from '@common/utils/phone.util';
import { ProductViewerModal } from '../../components/product-viewer-modal/product-viewer-modal';
import { PublicProduct, PublicStoreContext } from '../../models/storefront.model';
import { CartProduct, InterestCartService } from '../../services/interest-cart.service';
import { LeadService } from '../../services/lead.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';

@Component({
  selector: 'app-public-interest-cart',
  imports: [FormsModule, RouterLink, ProductViewerModal, PhoneDigitsDirective],
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
  readonly suggestions = signal<PublicProduct[]>([]);
  readonly viewerOpen = signal(false);
  readonly selectedProduct = signal<PublicProduct | null>(null);

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
        this.loadSuggestions(storeCode);
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
    return this.context()?.config.theme.accentColor ?? '#161311';
  }

  itemPrice(price?: number | null): string {
    return hasDisplayPrice(price) ? formatRs(price) : '';
  }

  skuLabel(item: CartProduct): string {
    return item.sku || `P${item.id}`;
  }

  onPhoneInput(value: string): void {
    this.guestPhone = sanitizePhoneDigits(value);
  }

  phoneError(): string {
    return phoneFieldError(this.guestPhone, { required: false, label: 'Phone' });
  }

  removeItem(productId: string): void {
    this.cart.remove(productId);
    this.refreshSuggestions();
  }

  clearAll(): void {
    this.cart.clear();
    this.refreshSuggestions();
  }

  viewDetails(item: CartProduct): void {
    this.selectedProduct.set(this.toPublicProduct(item));
    this.viewerOpen.set(true);
  }

  asCartItem(product: PublicProduct): CartProduct {
    return {
      id: product.id,
      name: product.name,
      category: product.category || '',
      price: product.price,
      imageUrl: product.imageUrl,
      sku: product.sku,
      metalType: product.metalType,
      purity: product.purity,
      weight: product.weight,
    };
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
    this.selectedProduct.set(null);
  }

  onProductHydrated(product: PublicProduct): void {
    this.selectedProduct.set(product);
  }

  addSuggestion(product: PublicProduct): void {
    this.cart.add(product);
    this.refreshSuggestions();
  }

  refreshSuggestions(): void {
    const inCart = new Set(this.cartItems().map((p) => p.id));
    this.suggestions.set(
      this.allCatalogProducts.filter((p) => !inCart.has(p.id)).slice(0, 6)
    );
  }

  submitInterest(): void {
    const ctx = this.context();
    if (!ctx || !this.cartItems().length) {
      return;
    }

    const name = this.guestName.trim();
    if (!name) {
      this.errorMessage.set('Please enter your name and phone number.');
      return;
    }
    const phoneError = phoneFieldError(this.guestPhone, { required: true, label: 'Phone' });
    if (phoneError) {
      this.errorMessage.set(phoneError);
      return;
    }

    const phone = this.guestPhone.trim();
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
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }

  private loadSuggestions(token: string): void {
    this.storefrontService.getSharedCatalog(token, token).subscribe({
      next: (data) => {
        if (!data?.products?.length) {
          this.suggestions.set([]);
          return;
        }
        this.allCatalogProducts = data.products;
        this.refreshSuggestions();
      },
      error: () => this.suggestions.set([]),
    });
  }

  private allCatalogProducts: PublicProduct[] = [];

  private toPublicProduct(item: CartProduct): PublicProduct {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      imageUrl: item.imageUrl,
      images: item.imageUrl ? [item.imageUrl] : [],
      sku: item.sku,
      metalType: item.metalType,
      purity: item.purity,
      weight: item.weight,
      priceVisible: item.price != null,
    };
  }
}
