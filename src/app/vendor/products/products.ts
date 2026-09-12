import { CurrencyPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PRODUCT_STOCK_STATUSES, Product } from '../../dashboard/models/dashboard.model';
import { resolveShareUrl } from '../../core/utils/store-code.util';
import { VendorAccount } from '../../dashboard/models/vendor.model';
import { VendorDataService } from '../services/vendor-data.service';
import { MasterDataService } from '../services/master-data.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-vendor-products',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './products.html',
  styleUrls: ['../shared/vendor-page.css', './products.css'],
})
export class VendorProducts implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly masterDataService = inject(MasterDataService);
  private fabHostedOnBody = false;

  @ViewChild('addFab')
  set addFab(ref: ElementRef<HTMLButtonElement> | undefined) {
    const el = ref?.nativeElement;
    if (!el) {
      return;
    }
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
      this.fabHostedOnBody = true;
    }
  }

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allProducts = signal<Product[]>([]);
  readonly categories = signal<{ id: string; name: string; status: string }[]>([]);
  readonly metalTypes = signal<{ id: string; name: string }[]>([]);
  readonly vendorProfile = signal<VendorAccount | null>(null);

  readonly isShareOpen = signal(false);
  readonly shareLink = signal('');
  readonly shareGenerating = signal(false);
  readonly shareCopied = signal(false);
  readonly shareError = signal('');

  readonly search = signal('');
  readonly category = signal('all');
  readonly status = signal('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minWeight = signal<number | null>(null);
  readonly maxWeight = signal<number | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly brokenImageIds = signal<Set<string>>(new Set());
  readonly sortBy = signal<'latest' | 'name' | 'price_asc' | 'price_desc'>('latest');
  readonly filtersOpen = signal(false);
  readonly openMenuId = signal<string | null>(null);

  readonly stockStatuses = PRODUCT_STOCK_STATUSES;
  shareCatalogName = '';

  readonly filteredProducts = computed(() => {
    const list = this.productService.filterProducts(
      this.allProducts(),
      this.search(),
      this.category(),
      'all',
      this.status(),
      'all',
      this.minPrice(),
      this.maxPrice(),
      this.minWeight(),
      this.maxWeight()
    );
    const sort = this.sortBy();
    return [...list].sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      if (sort === 'price_asc') {
        return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      }
      if (sort === 'price_desc') {
        return (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY);
      }
      return String(b.id).localeCompare(String(a.id));
    });
  });

  readonly categoryFilterOptions = computed(() =>
    this.categories()
      .filter((c) => c.status === 'active')
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
  );

  readonly activeFilterCount = computed(() => {
    let n = 0;
    if (this.category() !== 'all') n += 1;
    if (this.status() !== 'all') n += 1;
    if (this.minPrice() != null) n += 1;
    if (this.maxPrice() != null) n += 1;
    if (this.minWeight() != null) n += 1;
    if (this.maxWeight() != null) n += 1;
    return n;
  });

  readonly selectedProducts = computed(() => {
    const ids = this.selectedIds();
    return this.allProducts().filter((p) => ids.has(p.id));
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  ngOnInit(): void {
    this.loadProducts();
    this.loadMasterData();
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.vendorProfile.set({ ...profile, id: String(profile.id) });
        }
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.filtersOpen()) {
      this.closeFilters();
      return;
    }
    if (this.openMenuId() != null) {
      this.openMenuId.set(null);
      return;
    }
    if (this.isShareOpen()) {
      this.closeShareDrawer();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuId.set(null);
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.productService.getVendorProducts().subscribe({
      next: (products) => {
        this.allProducts.set(products);
        this.brokenImageIds.set(new Set());
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });
  }

  loadMasterData(): void {
    this.masterDataService.getCategories().subscribe({
      next: (items) => this.categories.set(items),
    });
    this.masterDataService.getMetalTypes().subscribe({
      next: (items) => this.metalTypes.set(items),
    });
  }

  onSearchChange(value: string): void {
    this.search.set(value ?? '');
  }

  onCategoryChange(value: string): void {
    this.category.set(value || 'all');
  }

  onStatusChange(value: string): void {
    this.status.set(value || 'all');
  }

  onMinPriceChange(value: string | number | null): void {
    this.minPrice.set(this.toNullableNumber(value));
  }

  onMaxPriceChange(value: string | number | null): void {
    this.maxPrice.set(this.toNullableNumber(value));
  }

  onMinWeightChange(value: string | number | null): void {
    this.minWeight.set(this.toNullableNumber(value));
  }

  onMaxWeightChange(value: string | number | null): void {
    this.maxWeight.set(this.toNullableNumber(value));
  }

  resetFilters(): void {
    this.search.set('');
    this.category.set('all');
    this.status.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.minWeight.set(null);
    this.maxWeight.set(null);
  }

  resetSheetFilters(): void {
    this.status.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.minWeight.set(null);
    this.maxWeight.set(null);
  }

  openFilters(event?: Event): void {
    event?.stopPropagation();
    this.openMenuId.set(null);
    this.filtersOpen.set(true);
    document.body.classList.add('mp-filter-open');
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
    document.body.classList.remove('mp-filter-open');
  }

  applyFiltersSheet(): void {
    this.closeFilters();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('mp-filter-open');
    const fab = document.getElementById('mp-add-product-fab');
    if (this.fabHostedOnBody && fab?.parentElement === document.body) {
      fab.remove();
    }
  }

  onSortChange(value: string): void {
    if (
      value === 'latest' ||
      value === 'name' ||
      value === 'price_asc' ||
      value === 'price_desc'
    ) {
      this.sortBy.set(value);
    }
  }

  toggleMenu(event: Event, productId: string): void {
    event.stopPropagation();
    this.openMenuId.update((id) => (id === productId ? null : productId));
  }

  productMeta(product: Product): string {
    const parts: string[] = [];
    if (product.metalType) {
      parts.push(product.metalType);
    }
    if (product.purity) {
      parts.push(product.purity);
    }
    if (product.weight) {
      parts.push(
        this.weightHasUnit(product.weight) ? product.weight : `${product.weight}g`
      );
    }
    return parts.join(' · ') || '—';
  }

  private toNullableNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }

  stockLabel(status?: string | null): string {
    return this.productService.stockLabel(status);
  }

  weightHasUnit(weight?: string | null): boolean {
    return /[a-zA-Z]/.test(weight ?? '');
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  hasImage(product: Product): boolean {
    return !!product.imageUrl && !this.brokenImageIds().has(product.id);
  }

  onImageError(productId: string): void {
    const ids = new Set(this.brokenImageIds());
    ids.add(productId);
    this.brokenImageIds.set(ids);
  }

  toggleSelect(product: Product, event?: Event): void {
    event?.stopPropagation();
    this.openMenuId.set(null);
    const ids = new Set(this.selectedIds());
    if (ids.has(product.id)) {
      ids.delete(product.id);
    } else {
      ids.add(product.id);
    }
    this.selectedIds.set(ids);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  openAddPage(): void {
    void this.router.navigateByUrl('/vendor/products/new');
  }

  openEditPage(product: Product, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigateByUrl(`/vendor/products/${product.id}/edit`);
  }

  deleteProduct(product: Product, event?: Event): void {
    event?.stopPropagation();
    if (!confirm(`Delete "${product.name}"?`)) {
      return;
    }
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.allProducts.set(this.allProducts().filter((p) => p.id !== product.id));
        const ids = new Set(this.selectedIds());
        ids.delete(product.id);
        this.selectedIds.set(ids);
      },
    });
  }

  openShareDrawer(): void {
    if (!this.selectedCount()) {
      return;
    }
    this.shareLink.set('');
    this.shareCopied.set(false);
    this.shareError.set('');
    this.shareCatalogName = '';
    this.isShareOpen.set(true);
  }

  closeShareDrawer(): void {
    if (this.shareGenerating()) {
      return;
    }
    this.isShareOpen.set(false);
    this.shareError.set('');
  }

  removeFromShare(productId: string): void {
    const ids = new Set(this.selectedIds());
    ids.delete(productId);
    this.selectedIds.set(ids);
    if (!ids.size) {
      this.closeShareDrawer();
    }
  }

  createAndShareCatalog(): void {
    const name = this.shareCatalogName.trim();
    if (!name) {
      this.shareError.set('Please enter a catalog name (e.g. Catalog for Shubh).');
      return;
    }
    const profile = this.vendorProfile();
    if (!profile?.storeCode) {
      this.shareError.set('Vendor store code is missing. Update your profile first.');
      return;
    }
    const productIds = [...this.selectedIds()];
    if (!productIds.length) {
      this.shareError.set('Select at least one product.');
      return;
    }

    this.shareGenerating.set(true);
    this.shareError.set('');
    this.shareLink.set('');

    this.vendorData.createCatalog(name, 'active', productIds).subscribe({
      next: (catalog) => {
        if (catalog.shareUrl || catalog.shortCode) {
          this.shareLink.set(
            resolveShareUrl(catalog.shareUrl, profile.storeCode!, catalog.shortCode)
          );
          this.shareGenerating.set(false);
          this.selectedIds.set(new Set());
          return;
        }
        this.vendorData.ensureCatalogShare(catalog.id).subscribe({
          next: (share) => {
            this.shareLink.set(
              resolveShareUrl(share.url, profile.storeCode!, share.shortCode)
            );
            this.shareGenerating.set(false);
            this.selectedIds.set(new Set());
          },
          error: () => {
            this.shareGenerating.set(false);
            this.shareError.set(
              'Catalog created, but share link failed. Open Catalogs to copy the link.'
            );
          },
        });
      },
      error: () => {
        this.shareGenerating.set(false);
        this.shareError.set('Failed to create catalog. Please try again.');
      },
    });
  }

  copyShareLink(): void {
    const link = this.shareLink();
    if (!link) {
      return;
    }
    navigator.clipboard.writeText(link).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    });
  }
}
