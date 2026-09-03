import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogShareService } from '../../../core/services/catalog-share.service';
import { METAL_TYPES, PRODUCT_CATEGORIES } from '../../../dashboard/models/dashboard.model';
import { ProductViewerModal } from '../../components/product-viewer-modal/product-viewer-modal';
import { PublicStoreNav } from '../../components/public-store-nav/public-store-nav';
import { PublicProduct, PublicStoreContext } from '../../models/storefront.model';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { InterestCartService } from '../../services/interest-cart.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';

const PURITY_OPTIONS = ['22K', '18K', '14K'] as const;
const QUICK_TABS = ['Rings', 'Necklaces', 'Earrings', 'Bangles', 'Pendants'] as const;

@Component({
  selector: 'app-public-products',
  imports: [FormsModule, RouterLink, PublicStoreNav, ProductViewerModal],
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
  readonly filtersOpen = signal(false);

  private storeCode = '';
  private page = 1;
  private readonly pageSize = 12;

  search = '';
  category = 'all';
  metalType = 'all';
  purity = 'all';
  minPrice: number | null = null;
  maxPrice: number | null = null;
  sort = 'newest';

  draftSearch = '';
  draftCategory = 'all';
  draftMetal = 'all';
  draftPurity = 'all';
  draftMin: number | null = null;
  draftMax: number | null = null;

  readonly categories = PRODUCT_CATEGORIES;
  readonly metalTypes = METAL_TYPES;
  readonly purityOptions = PURITY_OPTIONS;
  readonly quickTabs = QUICK_TABS;
  private shortCode = '';
  private wasVerified = false;
  private pricingReady = false;

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
          void this.catalogShareService.decode(shareToken).then((payload) => {
            if (!payload) {
              this.notFound.set(true);
              this.isLoading.set(false);
              return;
            }
            const products = this.storefrontService.applySharePayload(data.products, payload);
            this.products.set(products);
            this.totalCount.set(products.length);
            this.hasMore.set(false);
            this.isSharedView.set(true);
            this.shareLabel.set(this.buildShareLabel(payload));
            this.shareCustomerName.set(payload.customerName ?? '');
            if (payload.category) this.category = payload.category;
            if (payload.metalType) this.metalType = payload.metalType;
            if (payload.minPrice !== undefined) this.minPrice = payload.minPrice;
            if (payload.maxPrice !== undefined) this.maxPrice = payload.maxPrice;
            this.syncDraftFromApplied();
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

    this.search = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.category = this.route.snapshot.queryParamMap.get('category') ?? 'all';
    this.syncDraftFromApplied();
    this.pricingReady = true;
    this.reloadFirstPage();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  isSignedIn(): boolean {
    this.customerAuth.authTick();
    return this.customerAuth.isVerified(this.storeCode);
  }

  setCategory(category: string): void {
    if (this.isSharedView() || this.category === category) {
      return;
    }
    this.category = category;
    this.draftCategory = category;
    this.reloadFirstPage();
  }

  setSidebarCategory(category: string): void {
    if (this.isSharedView()) {
      return;
    }
    this.draftCategory = category;
  }

  setDraftMetal(metal: string): void {
    this.draftMetal = metal;
  }

  setDraftPurity(purity: string): void {
    this.draftPurity = purity;
  }

  onSortChange(): void {
    if (!this.isSharedView()) {
      this.reloadFirstPage();
    }
  }

  applyFilters(): void {
    if (this.isSharedView()) {
      return;
    }
    this.search = this.draftSearch.trim();
    this.category = this.draftCategory;
    this.metalType = this.draftMetal;
    this.purity = this.draftPurity;
    this.minPrice = this.draftMin;
    this.maxPrice = this.draftMax;
    this.filtersOpen.set(false);
    this.reloadFirstPage();
  }

  clearAllFilters(): void {
    if (this.isSharedView()) {
      return;
    }
    this.search = '';
    this.category = 'all';
    this.metalType = 'all';
    this.purity = 'all';
    this.minPrice = null;
    this.maxPrice = null;
    this.sort = 'newest';
    this.syncDraftFromApplied();
    this.filtersOpen.set(false);
    this.reloadFirstPage();
  }

  toggleFilters(): void {
    this.syncDraftFromApplied();
    this.filtersOpen.update((open) => !open);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  primaryColor(): string {
    return this.context()?.config.theme.primaryColor ?? '#c9a227';
  }

  accentColor(): string {
    return this.context()?.config.theme.accentColor ?? '#2A1A1A';
  }

  tabIcon(tab: string): string {
    const icons: Record<string, string> = {
      Rings: 'fa-solid fa-circle',
      Necklaces: 'fa-solid fa-gem',
      Earrings: 'fa-solid fa-star',
      Bangles: 'fa-solid fa-circle',
      Pendants: 'fa-solid fa-diamond',
    };
    return icons[tab] ?? 'fa-solid fa-gem';
  }

  skuLabel(product: PublicProduct): string {
    return product.sku ? `#${product.sku}` : `#P${product.id}`;
  }

  hasPrice(product: PublicProduct): boolean {
    return hasDisplayPrice(product.price);
  }

  priceLabel(product: PublicProduct): string {
    return formatRs(product.price);
  }

  listPriceLabel(product: PublicProduct): string {
    return formatRs(product.listPrice);
  }

  shareHeadline(): string {
    const label = this.shareLabel().trim();
    if (label && !/^shared catalog$/i.test(label)) {
      return label;
    }
    const name = this.shareCustomerName();
    return name ? `A private selection for ${name}` : 'A private selection';
  }

  shareSubcopy(vendorName: string): string {
    const n = this.products().length;
    const pieces = n === 1 ? 'one piece' : `${n} pieces`;
    if (this.isSignedIn()) {
      return `${vendorName} prepared ${pieces} with prices reserved for this link.`;
    }
    return `${vendorName} prepared ${pieces} for you. Verify your mobile to see the reserved prices.`;
  }

  openSharedIntro(): void {
    const first = this.products()[0];
    if (first) {
      this.openProduct(first);
    }
  }

  productMeta(product: PublicProduct): string {
    const bits = [product.purity, product.metalType].filter((x): x is string => !!x);
    const left = bits.join(' ');
    const weight = this.formatWeight(product.weight != null ? String(product.weight) : undefined);
    if (left && weight) {
      return `${left} • ${weight}`;
    }
    return left || weight || product.category || '';
  }

  private formatWeight(weight?: string): string {
    if (!weight) {
      return '';
    }
    const trimmed = weight.trim();
    if (/[a-zA-Z]/.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}g`;
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
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
    this.selectedProduct.set(null);
  }

  private syncDraftFromApplied(): void {
    this.draftSearch = this.search;
    this.draftCategory = this.category;
    this.draftMetal = this.metalType;
    this.draftPurity = this.purity;
    this.draftMin = this.minPrice;
    this.draftMax = this.maxPrice;
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
        this.products.set(data.products);
        this.totalCount.set(data.products.length);
        this.hasMore.set(false);
        this.isSharedView.set(true);
        this.shareLabel.set(data.shareLabel || this.buildShareLabel(data.payload ?? {}));
        this.shareCustomerName.set(data.payload?.customerName ?? '');
        if (data.payload?.category) this.category = data.payload.category;
        if (data.payload?.metalType) this.metalType = data.payload.metalType;
        if (data.payload?.minPrice !== undefined) this.minPrice = data.payload.minPrice;
        if (data.payload?.maxPrice !== undefined) this.maxPrice = data.payload.maxPrice;
        this.syncDraftFromApplied();
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
        search: this.search,
        category: this.category,
        metalType: this.metalType,
        purity: this.purity,
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        sort: this.sort,
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
