import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicStoreNav } from '../../components/public-store-nav/public-store-nav';
import { ProductViewerModal } from '../../components/product-viewer-modal/product-viewer-modal';
import {
  HomepageBannerSlide,
  HomepageContent,
  PublicProduct,
  PublicStorefrontPage,
} from '../../models/storefront.model';
import { HOME_IMAGES, mergeHomepage } from '../../config/homepage.defaults';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';

@Component({
  selector: 'app-public-home',
  imports: [PublicStoreNav, RouterLink, ProductViewerModal],
  templateUrl: './public-home.html',
  styleUrl: './public-home.css',
})
export class PublicHome implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly storefrontService = inject(StorefrontService);
  private readonly customerAuth = inject(CustomerAuthService);
  private storeCode = '';
  private wasVerified = false;
  private pricingReady = false;

  readonly isLoading = signal(true);
  readonly page = signal<PublicStorefrontPage | null>(null);
  readonly notFound = signal(false);
  readonly viewerOpen = signal(false);
  readonly selectedProduct = signal<PublicProduct | null>(null);
  readonly bannerIndex = signal(0);
  readonly trendingTab = signal('all');
  private bannerTouchX = 0;

  ngOnInit(): void {
    this.storeCode = this.route.snapshot.paramMap.get('storeCode') ?? '';
    this.customerAuth.setActiveStore(this.storeCode);

    this.route.fragment.subscribe(() => this.scrollToFragment());
    this.loadPage();
    this.pricingReady = true;
  }

  constructor() {
    effect(() => {
      const verified = this.customerAuth.isVerified(this.storeCode);
      if (this.pricingReady && verified !== this.wasVerified && this.storeCode) {
        this.loadPage(true);
      }
      this.wasVerified = verified;
    });
  }

  isSignedIn(): boolean {
    this.customerAuth.authTick();
    return this.customerAuth.isVerified(this.storeCode);
  }

  hasPrice(product: PublicProduct): boolean {
    return hasDisplayPrice(product.price);
  }

  priceLabel(product: PublicProduct): string {
    return formatRs(product.price);
  }

  private loadPage(quiet = false): void {
    if (!quiet) {
      this.isLoading.set(true);
    }
    this.storefrontService.getPublicPage(this.storeCode).subscribe({
      next: (data) => {
        if (!data) {
          this.notFound.set(true);
        } else {
          this.page.set(data);
        }
        this.isLoading.set(false);
        this.scrollToFragment();
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  primaryColor(): string {
    return this.page()?.config.theme.primaryColor ?? '#c9a227';
  }

  accentColor(): string {
    return this.page()?.config.theme.accentColor ?? '#1a1a2e';
  }

  fontColor(): string {
    return this.page()?.config.theme.fontColor ?? '#1c1917';
  }

  headerColor(): string {
    return this.page()?.config.theme.headerColor ?? this.accentColor();
  }

  headerTextColor(): string {
    return this.page()?.config.theme.headerTextColor ?? '#ffffff';
  }

  hp(data: PublicStorefrontPage): HomepageContent {
    return mergeHomepage(data.config.homepage, data.vendor.name);
  }

  heroImage(data: PublicStorefrontPage): string {
    return this.activeBanner(data) || HOME_IMAGES.hero;
  }

  featuredFallback(): string {
    return HOME_IMAGES.bridal;
  }

  /** Swap broken image URLs to curated jewellery placeholders. */
  onImageError(event: Event, kind: keyof typeof HOME_IMAGES = 'hero'): void {
    const img = event.target as HTMLImageElement;
    if (img.dataset['fallbackApplied']) {
      return;
    }
    img.dataset['fallbackApplied'] = '1';
    img.src = HOME_IMAGES[kind] ?? HOME_IMAGES.hero;
  }

  placeholderProducts(): PublicProduct[] {
    return [
      {
        id: '__ph-1',
        name: 'Classic Solitaire Ring',
        category: 'Rings',
        metalType: 'Diamond',
        purity: '18K',
        imageUrl: HOME_IMAGES.rings,
      },
      {
        id: '__ph-2',
        name: 'Temple Necklace',
        category: 'Necklaces',
        metalType: 'Gold',
        purity: '22K',
        imageUrl: HOME_IMAGES.necklaces,
      },
      {
        id: '__ph-3',
        name: 'Festive Jhumkas',
        category: 'Earrings',
        metalType: 'Gold',
        purity: '22K',
        imageUrl: HOME_IMAGES.earrings,
      },
      {
        id: '__ph-4',
        name: 'Kada Bangle Pair',
        category: 'Bangles',
        metalType: 'Gold',
        purity: '22K',
        imageUrl: HOME_IMAGES.bangles,
      },
      {
        id: '__ph-5',
        name: 'Diamond Pendant',
        category: 'Pendants',
        metalType: 'Diamond',
        purity: '18K',
        imageUrl: HOME_IMAGES.pendants,
      },
      {
        id: '__ph-6',
        name: 'Bridal Necklace Set',
        category: 'Necklaces',
        metalType: 'Gold',
        purity: '22K',
        imageUrl: HOME_IMAGES.bridal,
      },
      {
        id: '__ph-7',
        name: 'Halo Engagement Ring',
        category: 'Rings',
        metalType: 'Diamond',
        purity: '18K',
        imageUrl: HOME_IMAGES.engagement,
      },
      {
        id: '__ph-8',
        name: "Men's Gold Chain",
        category: 'Chains',
        metalType: 'Gold',
        purity: '22K',
        imageUrl: HOME_IMAGES.mens,
      },
    ];
  }

  trendingCategories(data: PublicStorefrontPage): string[] {
    const fromProducts = [...new Set(data.featuredProducts.map((p) => p.category).filter((c): c is string => !!c))];
    const tabs = fromProducts.length ? fromProducts : ['Rings', 'Necklaces', 'Earrings', 'Bangles'];
    return tabs.slice(0, 5);
  }

  trendingProducts(data: PublicStorefrontPage): PublicProduct[] {
    const source = data.featuredProducts.length ? data.featuredProducts : this.placeholderProducts();
    const tab = this.trendingTab();
    const limit = Math.max(data.config.homeProductLimit ?? 5, 5);
    const list = tab === 'all' ? source : source.filter((p) => p.category === tab);
    return list.slice(0, limit);
  }

  stars(count: number): string {
    return '*'.repeat(Math.max(1, Math.min(5, count || 5)));
  }

  vendorInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  currentYear(): number {
    return new Date().getFullYear();
  }

  goBanner(index: number): void {
    this.bannerIndex.set(index);
  }

  footerCollections(data: PublicStorefrontPage) {
    return this.hp(data).collections.items.slice(0, 5);
  }

  bannerUrls(data: PublicStorefrontPage): string[] {
    const urls = data.config.bannerUrls?.length
      ? data.config.bannerUrls
      : data.config.bannerUrl
        ? [data.config.bannerUrl]
        : [];
    if (urls.length) {
      return urls;
    }
    // Jewellery defaults so the public site never looks empty
    return [HOME_IMAGES.hero, HOME_IMAGES.heroBridal, HOME_IMAGES.heroDiamond];
  }

  /** Left-side copy for the currently visible banner image. */
  activeSlide(data: PublicStorefrontPage): HomepageBannerSlide {
    const home = this.hp(data);
    const slides = home.bannerSlides ?? [];
    const idx = this.bannerIndex();
    const slide = slides[idx] ?? slides[0];
    if (slide && (slide.headline || slide.subtitle || slide.ctaText)) {
      return {
        headline: slide.headline || home.hero.headline,
        subtitle: slide.subtitle || home.hero.subtitle,
        ctaText: slide.ctaText || home.hero.ctaText,
        badgeText: slide.badgeText ?? '',
      };
    }
    return {
      headline: home.hero.headline,
      subtitle: home.hero.subtitle,
      ctaText: home.hero.ctaText,
      badgeText: home.hero.badgeText,
    };
  }

  activeBanner(data: PublicStorefrontPage): string {
    const urls = this.bannerUrls(data);
    return urls[this.bannerIndex()] ?? urls[0] ?? '';
  }

  nextBanner(total: number): void {
    this.bannerIndex.update((i) => (i + 1) % total);
  }

  prevBanner(total: number): void {
    this.bannerIndex.update((i) => (i - 1 + total) % total);
  }

  onBannerTouchStart(event: TouchEvent): void {
    this.bannerTouchX = event.changedTouches[0]?.clientX ?? 0;
  }

  onBannerTouchEnd(event: TouchEvent, total: number): void {
    if (total <= 1) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? this.bannerTouchX;
    const delta = endX - this.bannerTouchX;
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta < 0) {
      this.nextBanner(total);
    } else {
      this.prevBanner(total);
    }
  }

  openProduct(product: PublicProduct): void {
    if (!product.id || String(product.id).startsWith('__')) {
      return;
    }
    this.selectedProduct.set(product);
    this.viewerOpen.set(true);
  }

  onCustomerVerified(): void {
    this.loadPage(true);
  }

  onProductHydrated(product: PublicProduct): void {
    this.selectedProduct.set(product);
    this.page.update((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        featuredProducts: current.featuredProducts.map((item) =>
          item.id === product.id ? { ...item, ...product } : item
        ),
      };
    });
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
    this.selectedProduct.set(null);
  }

  contactHref(type: 'phone' | 'email' | 'website', value: string): string {
    if (type === 'phone') {
      return `tel:${value.replace(/\s/g, '')}`;
    }
    if (type === 'email') {
      return `mailto:${value}`;
    }
    const url = value.startsWith('http') ? value : `https://${value}`;
    return url;
  }

  private scrollToFragment(): void {
    const id = this.route.snapshot.fragment;
    if (!id || this.isLoading()) {
      return;
    }
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}
