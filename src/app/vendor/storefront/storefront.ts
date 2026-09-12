import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { buildPublicStoreUrl } from '../../core/utils/store-code.util';
import { lockBodyScroll, unlockBodyScroll } from '../../core/utils/body-scroll-lock';
import { Product } from '../../dashboard/models/dashboard.model';
import { VendorAccount } from '../../dashboard/models/vendor.model';
import { StorefrontFormData, HomepageBannerSlide } from '../../storefront/models/storefront.model';
import { createDefaultHomepage } from '../../storefront/config/homepage.defaults';
import { StorefrontService } from '../../storefront/services/storefront.service';
import { VendorDataService } from '../services/vendor-data.service';

export type PageSection =
  | 'header'
  | 'banner'
  | 'stats'
  | 'collections'
  | 'featuredBanner'
  | 'trending'
  | 'occasions'
  | 'why'
  | 'about'
  | 'catalogue'
  | 'testimonials'
  | 'contact';

const SECTION_META: Record<PageSection, { title: string; hint: string; previewId: string }> = {
  header: {
    title: 'Header',
    hint: 'Logo and trust bar at the top of every page.',
    previewId: 'nav',
  },
  banner: {
    title: 'Banner / Hero',
    hint: 'Each image has its own left-side headline. Turning this off hides the whole banner section.',
    previewId: 'hero',
  },
  stats: {
    title: 'Trust stats',
    hint: 'Numbers under the banner (customers, hallmarked, years, rating). Edit values or hide the row.',
    previewId: 'hero',
  },
  collections: {
    title: 'Collections',
    hint: 'Category circles under the hero. Customers tap a category to browse products.',
    previewId: 'collection',
  },
  featuredBanner: {
    title: 'Featured banner',
    hint: 'Campaign strip (e.g. bridal) below collections.',
    previewId: 'bridal',
  },
  about: {
    title: 'Our Story & Custom',
    hint: 'Story and custom jewellery cards on the home page.',
    previewId: 'about',
  },
  trending: {
    title: 'Trending products',
    hint: 'Product grid on the home page from the pieces you select.',
    previewId: 'trending',
  },
  occasions: {
    title: 'Occasions',
    hint: 'Occasion cards (wedding, festive, etc.).',
    previewId: 'occasions',
  },
  why: {
    title: 'Why choose us',
    hint: 'Trust points shown on the home page.',
    previewId: 'why',
  },
  catalogue: {
    title: 'Catalogue promo',
    hint: 'Browse / request catalogue strip.',
    previewId: 'catalogue',
  },
  testimonials: {
    title: 'Testimonials',
    hint: 'Customer quotes near the footer.',
    previewId: 'testimonials',
  },
  contact: {
    title: 'Contact',
    hint: 'Contact block near the footer. Phone and email come from Profile.',
    previewId: 'contact',
  },
};

@Component({
  selector: 'app-vendor-storefront',
  imports: [FormsModule],
  templateUrl: './storefront.html',
  styleUrls: ['../shared/vendor-page.css', './storefront.css'],
})
export class VendorStorefront implements OnInit, OnDestroy {
  private readonly vendorData = inject(VendorDataService);
  private readonly storefrontService = inject(StorefrontService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly vendor = signal<VendorAccount | null>(null);
  readonly products = signal<Product[]>([]);
  readonly storefrontId = signal<number | undefined>(undefined);
  readonly publicUrl = signal('');
  readonly activeSection = signal<PageSection>('banner');
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewOpen = signal(false);

  readonly sectionNav: { id: PageSection; label: string; blurb: string; step: number }[] = [
    { id: 'header', label: 'Header', blurb: 'Logo & trust bar', step: 1 },
    { id: 'banner', label: 'Banner / Hero', blurb: 'Images & headlines', step: 2 },
    { id: 'stats', label: 'Trust stats', blurb: 'Numbers under banner', step: 3 },
    { id: 'collections', label: 'Collections', blurb: 'Category row', step: 4 },
    { id: 'featuredBanner', label: 'Featured banner', blurb: 'Campaign strip', step: 5 },
    { id: 'about', label: 'Our Story & Custom', blurb: 'About cards', step: 6 },
    { id: 'trending', label: 'Trending products', blurb: 'Home product grid', step: 7 },
    { id: 'occasions', label: 'Occasions', blurb: 'Wedding, festive…', step: 8 },
    { id: 'why', label: 'Why choose us', blurb: 'Trust points', step: 9 },
    { id: 'catalogue', label: 'Catalogue promo', blurb: 'Browse strip', step: 10 },
    { id: 'testimonials', label: 'Testimonials', blurb: 'Customer quotes', step: 11 },
    { id: 'contact', label: 'Contact', blurb: 'Near footer', step: 12 },
  ];

  form: StorefrontFormData = {
    tagline: '',
    showBanner: true,
    bannerUrl: '',
    bannerUrls: [],
    logoUrl: '',
    showFeatured: true,
    showContact: true,
    showAbout: true,
    aboutText: '',
    featuredProductIds: [],
    homeProductLimit: 4,
    customSections: [],
    theme: {
      primaryColor: '#c9a227',
      accentColor: '#1a1a2e',
      headerColor: '#1a1a2e',
      headerTextColor: '#ffffff',
      fontColor: '#1c1917',
    },
    homepage: createDefaultHomepage(),
  };

  readonly logoError = signal('');
  readonly bannerError = signal('');

  readonly activeProducts = computed(() =>
    this.products().filter((p) => (p.status ?? 'active') === 'active')
  );

  readonly editingMeta = computed(() => SECTION_META[this.activeSection()]);

  ngOnInit(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (!profile) {
          this.errorMessage.set('Vendor profile not found.');
          this.isLoading.set(false);
          return;
        }
        const normalized = { ...profile, id: String(profile.id) };
        this.vendor.set(normalized);
        if (normalized.storeCode) {
          const url = buildPublicStoreUrl(normalized.storeCode);
          this.publicUrl.set(url);
        }
        this.storefrontService.getByVendorId(normalized.id, normalized.name).subscribe({
          next: (config) => {
            this.storefrontId.set(config.id);
            this.form = this.storefrontService.mapConfigToForm(config);
            this.form.customSections = [];
            this.syncBannerSlides();
            this.ensureStats();
            this.isLoading.set(false);
          },
          error: () => {
            this.errorMessage.set('Unable to load storefront settings.');
            this.isLoading.set(false);
          },
        });
      },
      error: () => {
        this.errorMessage.set('Unable to load profile.');
        this.isLoading.set(false);
      },
    });

    this.vendorData.getProducts().subscribe({
      next: (items) => this.products.set(items),
    });
  }

  ngOnDestroy(): void {
    if (this.previewOpen()) {
      unlockBodyScroll();
    }
  }

  openSection(section: PageSection): void {
    this.activeSection.set(section);
  }

  isOpen(section: PageSection): boolean {
    return this.activeSection() === section;
  }

  isSectionOff(section: PageSection): boolean {
    switch (section) {
      case 'banner':
        return !this.form.showBanner;
      case 'stats':
        return !this.form.homepage.stats?.enabled;
      case 'collections':
        return !this.form.homepage.collections.enabled;
      case 'featuredBanner':
        return !this.form.homepage.featuredBanner.enabled;
      case 'about':
        return !this.form.homepage.story.enabled && !this.form.homepage.customJewellery.enabled;
      case 'trending':
        return !this.form.showFeatured;
      case 'occasions':
        return !this.form.homepage.occasions.enabled;
      case 'why':
        return !this.form.homepage.whyChoose.enabled;
      case 'catalogue':
        return !this.form.homepage.cataloguePromo.enabled;
      case 'testimonials':
        return !this.form.homepage.testimonials.enabled;
      case 'contact':
        return !this.form.showContact;
      case 'header':
        return !this.form.homepage.topBar.enabled && !this.form.logoUrl;
      default:
        return false;
    }
  }

  openLivePreview(): void {
    this.refreshPreview();
    if (!this.previewOpen()) {
      lockBodyScroll();
      this.previewOpen.set(true);
    }
  }

  closeLivePreview(): void {
    if (this.previewOpen()) {
      this.previewOpen.set(false);
      unlockBodyScroll();
    }
  }

  private emptyBannerSlide(fromHero = false): HomepageBannerSlide {
    const hero = this.form.homepage.hero;
    if (fromHero) {
      return {
        headline: hero.headline || '',
        subtitle: hero.subtitle || '',
        ctaText: hero.ctaText || 'Explore Collection',
        badgeText: hero.badgeText || '',
      };
    }
    return {
      headline: '',
      subtitle: '',
      ctaText: 'Explore Collection',
      badgeText: '',
    };
  }

  /** Keep bannerSlides length aligned with bannerUrls; seed first from hero if empty. */
  syncBannerSlides(): void {
    const urls = this.form.bannerUrls ?? [];
    const existing = [...(this.form.homepage.bannerSlides ?? [])];
    const slides: HomepageBannerSlide[] = urls.map((_, i) => {
      const prev = existing[i];
      if (prev) {
        return {
          headline: prev.headline ?? '',
          subtitle: prev.subtitle ?? '',
          ctaText: prev.ctaText || 'Explore Collection',
          badgeText: prev.badgeText ?? '',
        };
      }
      return this.emptyBannerSlide(i === 0 && !existing.length);
    });
    this.form.homepage.bannerSlides = slides;
    if (slides[0]) {
      this.form.homepage.hero = {
        headline: slides[0].headline,
        subtitle: slides[0].subtitle,
        ctaText: slides[0].ctaText,
        badgeText: slides[0].badgeText,
      };
    }
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }
    Array.from(files).forEach((file) => {
      this.readFileAsBase64(file, 'banner', (base64) => {
        const isFirst = this.form.bannerUrls.length === 0;
        this.form.bannerUrls = [...this.form.bannerUrls, base64];
        this.form.bannerUrl = this.form.bannerUrls[0] ?? '';
        this.form.showBanner = true;
        this.form.homepage.bannerSlides = [
          ...(this.form.homepage.bannerSlides ?? []),
          this.emptyBannerSlide(isFirst),
        ];
        this.syncBannerSlides();
        this.bannerError.set('');
      });
    });
    input.value = '';
  }

  removeBanner(index: number): void {
    this.form.bannerUrls = this.form.bannerUrls.filter((_, i) => i !== index);
    this.form.homepage.bannerSlides = (this.form.homepage.bannerSlides ?? []).filter(
      (_, i) => i !== index
    );
    this.form.bannerUrl = this.form.bannerUrls[0] ?? '';
    this.syncBannerSlides();
  }

  moveBanner(index: number, direction: -1 | 1): void {
    const next = index + direction;
    if (next < 0 || next >= this.form.bannerUrls.length) {
      return;
    }
    const urls = [...this.form.bannerUrls];
    const [item] = urls.splice(index, 1);
    urls.splice(next, 0, item);
    this.form.bannerUrls = urls;
    this.form.bannerUrl = urls[0] ?? '';

    const slides = [...(this.form.homepage.bannerSlides ?? [])];
    const [slide] = slides.splice(index, 1);
    slides.splice(next, 0, slide);
    this.form.homepage.bannerSlides = slides;
    this.syncBannerSlides();
  }

  ensureStats(): void {
    const defaults = createDefaultHomepage().stats;
    const raw = this.form.homepage.stats as unknown;
    if (Array.isArray(raw)) {
      this.form.homepage.stats = {
        enabled: true,
        items: (raw as { value?: string; label?: string }[]).map((s) => ({
          value: s?.value ?? '',
          label: s?.label ?? '',
        })),
      };
    } else if (!raw || typeof raw !== 'object') {
      this.form.homepage.stats = {
        enabled: true,
        items: defaults.items.map((s) => ({ ...s })),
      };
    } else {
      const obj = raw as { enabled?: boolean; items?: { value?: string; label?: string }[] };
      const items = Array.isArray(obj.items)
        ? obj.items.map((s) => ({
            value: s?.value ?? '',
            label: s?.label ?? '',
          }))
        : [];
      this.form.homepage.stats = {
        enabled: obj.enabled !== false,
        items: items.length ? items : defaults.items.map((s) => ({ ...s })),
      };
    }
  }

  addStat(): void {
    this.ensureStats();
    if (this.form.homepage.stats.items.length >= 6) {
      return;
    }
    this.form.homepage.stats.items = [
      ...this.form.homepage.stats.items,
      { value: '', label: '' },
    ];
  }

  removeStat(index: number): void {
    this.ensureStats();
    this.form.homepage.stats.items = this.form.homepage.stats.items.filter((_, i) => i !== index);
  }

  updateStatValue(index: number, value: string): void {
    this.ensureStats();
    const items = [...this.form.homepage.stats.items];
    if (!items[index]) {
      return;
    }
    items[index] = { ...items[index], value };
    this.form.homepage.stats = { ...this.form.homepage.stats, items };
  }

  updateStatLabel(index: number, label: string): void {
    this.ensureStats();
    const items = [...this.form.homepage.stats.items];
    if (!items[index]) {
      return;
    }
    items[index] = { ...items[index], label };
    this.form.homepage.stats = { ...this.form.homepage.stats, items };
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFileAsBase64(file, 'logo', (base64) => {
      this.form.logoUrl = base64;
      this.logoError.set('');
    });
    input.value = '';
  }

  removeLogo(): void {
    this.form.logoUrl = '';
    this.logoError.set('');
  }

  private readFileAsBase64(
    file: File,
    kind: 'logo' | 'banner',
    onDone: (base64: string) => void
  ): void {
    const setError = (msg: string) => {
      if (kind === 'logo') {
        this.logoError.set(msg);
      } else {
        this.bannerError.set(msg);
      }
    };
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (jpg, png, or webp).');
      return;
    }
    if (file.size > 2_000_000) {
      setError('Image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        onDone(result);
      }
    };
    reader.onerror = () => setError('Could not read image file.');
    reader.readAsDataURL(file);
  }

  addTopBarItem(): void {
    this.form.homepage.topBar.items = [...this.form.homepage.topBar.items, { text: 'New highlight' }];
  }

  removeTopBarItem(index: number): void {
    this.form.homepage.topBar.items = this.form.homepage.topBar.items.filter((_, i) => i !== index);
  }

  addCollectionItem(): void {
    this.form.homepage.collections.items = [
      ...this.form.homepage.collections.items,
      { name: 'New collection', category: 'Rings', imageUrl: '' },
    ];
  }

  removeCollectionItem(index: number): void {
    this.form.homepage.collections.items = this.form.homepage.collections.items.filter(
      (_, i) => i !== index
    );
  }

  addOccasion(): void {
    this.form.homepage.occasions.items = [
      ...this.form.homepage.occasions.items,
      { name: 'Occasion', tagline: '', imageUrl: '' },
    ];
  }

  removeOccasion(index: number): void {
    this.form.homepage.occasions.items = this.form.homepage.occasions.items.filter(
      (_, i) => i !== index
    );
  }

  addWhyItem(): void {
    this.form.homepage.whyChoose.items = [
      ...this.form.homepage.whyChoose.items,
      { title: 'Reason', text: '' },
    ];
  }

  removeWhyItem(index: number): void {
    this.form.homepage.whyChoose.items = this.form.homepage.whyChoose.items.filter(
      (_, i) => i !== index
    );
  }

  addTestimonial(): void {
    this.form.homepage.testimonials.items = [
      ...this.form.homepage.testimonials.items,
      { quote: '', name: '', rating: 5 },
    ];
  }

  removeTestimonial(index: number): void {
    this.form.homepage.testimonials.items = this.form.homepage.testimonials.items.filter(
      (_, i) => i !== index
    );
  }

  onHomepageImage(event: Event, assign: (url: string) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFileAsBase64(file, 'banner', (base64) => assign(base64));
    input.value = '';
  }

  onCollectionImage(index: number, event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.collections.items[index].imageUrl = url;
    });
  }

  onOccasionImage(index: number, event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.occasions.items[index].imageUrl = url;
    });
  }

  onStoryImage(event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.story.imageUrl = url;
    });
  }

  onCustomJewImage(event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.customJewellery.imageUrl = url;
    });
  }

  onFeaturedBannerImage(event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.featuredBanner.imageUrl = url;
    });
  }

  onCatalogueImage(event: Event): void {
    this.onHomepageImage(event, (url) => {
      this.form.homepage.cataloguePromo.imageUrl = url;
    });
  }

  toggleFeaturedProduct(productId: string, checked: boolean): void {
    const ids = new Set(this.form.featuredProductIds);
    if (checked) {
      ids.add(productId);
    } else {
      ids.delete(productId);
    }
    this.form.featuredProductIds = [...ids];
  }

  isFeatured(productId: string): boolean {
    return this.form.featuredProductIds.includes(productId);
  }

  refreshPreview(): void {
    const code = this.vendor()?.storeCode;
    if (code) {
      const meta = this.editingMeta();
      const hash = meta.previewId ? `#${meta.previewId}` : '';
      const url = `${buildPublicStoreUrl(code)}?t=${Date.now()}${hash}`;
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    }
  }

  save(): void {
    const profile = this.vendor();
    if (!profile) {
      return;
    }
    this.form.bannerUrl = this.form.bannerUrls[0] ?? '';
    this.syncBannerSlides();
    this.ensureStats();
    this.form.homepage.stats.items = (this.form.homepage.stats.items ?? []).filter(
      (s) => (s.value || '').trim() || (s.label || '').trim()
    );
    this.form.customSections = [];
    this.form.homepage.trending.enabled = this.form.showFeatured;
    this.form.tagline = this.form.homepage.hero.subtitle;
    this.form.aboutText = this.form.homepage.story.body;
    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.storefrontService
      .saveForVendor(profile.id, profile.name, this.form, this.storefrontId())
      .subscribe({
        next: (saved) => {
          this.storefrontId.set(saved.id);
          this.isSaving.set(false);
          this.successMessage.set('Saved. Open Live Preview to check the customer site.');
          if (this.previewOpen()) {
            this.refreshPreview();
          }
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('Failed to save website settings.');
        },
      });
  }
}
