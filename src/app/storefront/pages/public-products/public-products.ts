import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CatalogShareService } from '../../../core/services/catalog-share.service';
import { resolveMediaUrl } from '../../../core/utils/media-url.util';
import { ProductViewerModal } from '../../components/product-viewer-modal/product-viewer-modal';
import { PublicProduct, PublicStoreContext, PublicVendor } from '../../models/storefront.model';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { InterestCartService } from '../../services/interest-cart.service';
import { StorefrontService } from '../../services/storefront.service';

@Component({
  selector: 'app-public-products',
  imports: [FormsModule, ProductViewerModal],
  templateUrl: './public-products.html',
  styleUrl: './public-products.css',
})
export class PublicProducts implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly storefrontService = inject(StorefrontService);
  private readonly catalogShareService = inject(CatalogShareService);
  private readonly customerAuth = inject(CustomerAuthService);
  readonly cart = inject(InterestCartService);
  private observer: IntersectionObserver | null = null;
  private sentinelEl: HTMLElement | null = null;

  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(ref: ElementRef<HTMLElement> | undefined) {
    if (ref?.nativeElement) {
      this.attachScrollObserver(ref.nativeElement);
    } else {
      this.sentinelEl = null;
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly notFound = signal(false);
  readonly context = signal<PublicStoreContext | null>(null);
  readonly products = signal<PublicProduct[]>([]);
  readonly totalCount = signal(0);
  readonly hasMore = signal(false);
  readonly isSharedView = signal(false);
  readonly shareLabel = signal('');
  readonly shareCustomerName = signal('');
  readonly viewerOpen = signal(false);
  readonly selectedProduct = signal<PublicProduct | null>(null);
  readonly categoriesOpen = signal(false);
  readonly categoryList = signal<string[]>([]);
  readonly categorySearch = signal('');
  readonly productSearch = signal('');
  readonly selectedCategory = signal('all');
  readonly logoBroken = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private storeCode = '';
  private page = 1;
  private readonly pageSize = 12;
  private shortCode = '';
  private wasVerified = false;
  private pricingReady = false;
  private sharedAllProducts: PublicProduct[] = [];

  readonly filteredCategories = computed(() => {
    const q = this.categorySearch().trim().toLowerCase();
    const list = this.categoryList();
    if (!q) {
      return list;
    }
    return list.filter((c) => c.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      const tick = this.customerAuth.authTick();
      const verified = this.customerAuth.isVerified(this.storeCode);
      if (this.wasVerified && !verified && this.viewerOpen()) {
        queueMicrotask(() => {
          this.viewerOpen.set(false);
          this.selectedProduct.set(null);
        });
      }
      if (
        this.pricingReady &&
        tick > 0 &&
        verified &&
        !this.wasVerified &&
        this.storeCode
      ) {
        queueMicrotask(() => {
          if (this.isSharedView() && this.shortCode) {
            this.reloadSharedCatalog();
          } else if (!this.isSharedView()) {
            this.reloadFirstPage();
          }
        });
      }
      this.wasVerified = verified;
    });
  }

  ngOnInit(): void {
    this.storeCode = this.route.snapshot.paramMap.get('storeCode') ?? '';
    const shareToken = this.route.snapshot.paramMap.get('shareToken');
    const shortCode = this.route.snapshot.paramMap.get('shortCode');
    this.cart.setStore(this.storeCode);
    this.customerAuth.setActiveStore(this.storeCode);

    const categoryParam = this.route.snapshot.queryParamMap.get('category');
    if (categoryParam) {
      this.selectedCategory.set(categoryParam);
    }

    if (shortCode) {
      this.shortCode = shortCode;
      this.pricingReady = true;
      this.reloadSharedCatalog();
      return;
    }

    if (shareToken) {
      this.storefrontService.getPublicProducts(this.storeCode, { page: 1, pageSize: 200 }).subscribe({
        next: (data) => {
          if (!data) {
            this.notFound.set(true);
            this.isLoading.set(false);
            return;
          }
          this.context.set(data.context);
          this.logoBroken.set(false);
          void this.catalogShareService.decode(shareToken).then((payload) => {
            if (!payload) {
              this.notFound.set(true);
              this.isLoading.set(false);
              return;
            }
            const products = this.storefrontService.applySharePayload(data.products, payload);
            this.applySharedProducts(products, payload);
            this.isLoading.set(false);
          });
        },
        error: () => {
          this.notFound.set(true);
          this.isLoading.set(false);
        },
      });
      return;
    }

    this.pricingReady = true;
    this.loadCategories();
    this.reloadFirstPage();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.observer?.disconnect();
    this.observer = null;
    this.setBodyScrollLocked(false);
  }

  onProductSearch(value: string): void {
    this.productSearch.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      if (this.isSharedView()) {
        this.applySharedCategoryFilter();
      } else {
        this.reloadFirstPage();
      }
    }, 300);
  }

  isSignedIn(): boolean {
    this.customerAuth.authTick();
    return this.customerAuth.isVerified(this.storeCode);
  }

  vendorInitials(vendor: PublicVendor): string {
    const parts = (vendor.name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'JC';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  vendorAddress(vendor: PublicVendor): string {
    return [vendor.address, vendor.city, vendor.state, vendor.pincode]
      .map((x) => (x ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }

  hasContact(vendor: PublicVendor): boolean {
    return !!(this.vendorAddress(vendor) || vendor.email || vendor.phone);
  }

  logoUrl(ctx: PublicStoreContext): string {
    if (this.logoBroken()) {
      return '';
    }
    return resolveMediaUrl(ctx.config?.logoUrl || '');
  }

  onLogoError(): void {
    this.logoBroken.set(true);
  }

  selectCategory(category: string): void {
    if (this.selectedCategory() === category) {
      this.categoriesOpen.set(false);
      return;
    }
    this.selectedCategory.set(category);
    this.closeCategories();

    if (this.isSharedView()) {
      this.applySharedCategoryFilter();
      return;
    }
    this.reloadFirstPage();
  }

  toggleCategories(): void {
    const next = !this.categoriesOpen();
    this.categoriesOpen.set(next);
    this.setBodyScrollLocked(next);
  }

  closeCategories(): void {
    this.categoriesOpen.set(false);
    this.setBodyScrollLocked(false);
  }

  private setBodyScrollLocked(locked: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  activeCategoryLabel(): string {
    const cat = this.selectedCategory();
    return cat === 'all' ? 'All Products' : cat;
  }

  skuLabel(product: PublicProduct): string {
    return product.sku || `P${product.id}`;
  }

  openProduct(product: PublicProduct): void {
    this.selectedProduct.set(product);
    this.viewerOpen.set(true);
  }

  onCustomerVerified(): void {
    if (this.isSharedView() && this.shortCode) {
      this.reloadSharedCatalog();
    } else if (!this.isSharedView()) {
      this.reloadFirstPage();
    }
  }

  onProductHydrated(product: PublicProduct): void {
    const existing = this.products().find((p) => p.id === product.id);
    const merged: PublicProduct = {
      ...product,
      ...(existing?.isSpecialPrice
        ? {
            price: existing.price,
            listPrice: existing.listPrice,
            isSpecialPrice: true,
          }
        : {}),
    };
    this.selectedProduct.set(merged);
    this.products.update((list) =>
      list.map((item) => (item.id === product.id ? { ...item, ...merged } : item))
    );
    if (this.isSharedView()) {
      this.sharedAllProducts = this.sharedAllProducts.map((item) =>
        item.id === product.id ? { ...item, ...merged } : item
      );
    }
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
    this.selectedProduct.set(null);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const media = img.parentElement;
    img.remove();
    const ph = media?.querySelector('.ph');
    if (ph instanceof HTMLElement) {
      ph.classList.add('visible');
    }
  }

  private loadCategories(): void {
    if (!this.storeCode) {
      return;
    }
    this.storefrontService.getPublicCategories(this.storeCode).subscribe({
      next: (cats) => this.categoryList.set(cats),
      error: () => this.categoryList.set([]),
    });
  }

  private applySharedProducts(
    products: PublicProduct[],
    payload?: { category?: string; customerName?: string } | null,
    shareLabel?: string
  ): void {
    this.sharedAllProducts = products;
    this.isSharedView.set(true);
    this.shareLabel.set(shareLabel || this.buildShareLabel(payload ?? {}));
    this.shareCustomerName.set(payload?.customerName ?? '');
    const fromProducts = [
      ...new Set(products.map((p) => p.category).filter((c): c is string => !!c?.trim())),
    ].sort((a, b) => a.localeCompare(b));
    this.categoryList.set(fromProducts);
    if (payload?.category) {
      this.selectedCategory.set(payload.category);
    }
    this.applySharedCategoryFilter();
  }

  private applySharedCategoryFilter(): void {
    const cat = this.selectedCategory();
    const q = this.productSearch().trim().toLowerCase();
    let filtered =
      cat === 'all'
        ? this.sharedAllProducts
        : this.sharedAllProducts.filter((p) => p.category === cat);
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q)
      );
    }
    this.products.set(filtered);
    this.totalCount.set(filtered.length);
    this.hasMore.set(false);
  }

  private reloadSharedCatalog(): void {
    if (!this.storeCode || !this.shortCode) {
      return;
    }
    this.isLoading.set(true);
    this.storefrontService.getSharedCatalog(this.storeCode, this.shortCode).subscribe({
      next: (data) => {
        if (!data) {
          this.notFound.set(true);
          this.isLoading.set(false);
          return;
        }
        this.context.set(data.context);
        this.logoBroken.set(false);
        this.applySharedProducts(data.products, null, data.shareLabel);
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private reloadFirstPage(): void {
    this.page = 1;
    this.fetchPage(1, false);
  }

  private loadMoreOnScroll(): void {
    if (this.isSharedView() || !this.hasMore() || this.isLoadingMore() || this.isLoading()) {
      return;
    }
    this.fetchPage(this.page + 1, true);
  }

  private fetchPage(page: number, append: boolean): void {
    if (append) {
      this.isLoadingMore.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.storefrontService
      .getPublicProducts(this.storeCode, {
        search: this.productSearch().trim(),
        category: this.selectedCategory(),
        sort: 'newest',
        page,
        pageSize: this.pageSize,
        skipLoader: append,
      })
      .subscribe({
        next: (data) => {
          if (!data) {
            this.notFound.set(true);
            this.isLoading.set(false);
            this.isLoadingMore.set(false);
            return;
          }

          this.context.set(data.context);
          this.logoBroken.set(false);
          this.totalCount.set(data.total);
          this.hasMore.set(data.hasMore);
          this.page = data.page;

          if (append) {
            const seen = new Set(this.products().map((p) => p.id));
            const next = data.products.filter((p) => !seen.has(p.id));
            this.products.set([...this.products(), ...next]);
          } else {
            this.products.set(data.products);
          }

          this.isLoading.set(false);
          this.isLoadingMore.set(false);

          if (append && data.hasMore) {
            requestAnimationFrame(() => this.maybeLoadIfNearBottom());
          }
        },
        error: () => {
          if (!append) {
            this.notFound.set(true);
          }
          this.isLoading.set(false);
          this.isLoadingMore.set(false);
        },
      });
  }

  private attachScrollObserver(el: HTMLElement): void {
    this.sentinelEl = el;
    this.observer?.disconnect();
    if (this.isSharedView()) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.loadMoreOnScroll();
        }
      },
      { root: null, rootMargin: '0px 0px 400px 0px', threshold: 0 }
    );
    this.observer.observe(el);
    requestAnimationFrame(() => this.maybeLoadIfNearBottom());
  }

  private maybeLoadIfNearBottom(): void {
    if (!this.sentinelEl || !this.hasMore()) {
      return;
    }
    const rect = this.sentinelEl.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 400) {
      this.loadMoreOnScroll();
    }
  }

  private buildShareLabel(payload: {
    productIds?: number[];
    category?: string;
    metalType?: string;
    minPrice?: number;
    maxPrice?: number;
  }): string {
    const parts: string[] = [];
    if (payload.category) parts.push(payload.category);
    if (payload.metalType) parts.push(payload.metalType);
    if (payload.minPrice !== undefined || payload.maxPrice !== undefined) {
      parts.push('custom price range');
    }
    if (payload.productIds?.length) {
      parts.push(`${payload.productIds.length} selected pieces`);
    }
    return parts.length ? parts.join(' · ') : 'Curated selection';
  }
}
