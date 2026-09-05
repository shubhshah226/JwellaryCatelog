import { CurrencyPipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PRODUCT_STOCK_STATUSES, Product } from '../../dashboard/models/dashboard.model';
import { CatalogShareService } from '../../core/services/catalog-share.service';
import { buildPublicStoreUrl } from '../../core/utils/store-code.util';
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
export class VendorProducts implements OnInit {
  private readonly router = inject(Router);
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly masterDataService = inject(MasterDataService);
  private readonly catalogShareService = inject(CatalogShareService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allProducts = signal<Product[]>([]);
  readonly categories = signal<{ id: number; name: string; status: string }[]>([]);
  readonly metalTypes = signal<{ id: number; name: string }[]>([]);
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
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly brokenImageIds = signal<Set<number>>(new Set());

  readonly stockStatuses = PRODUCT_STOCK_STATUSES;
  shareCatalogName = '';

  readonly filteredProducts = computed(() =>
    this.productService.filterProducts(
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
    )
  );

  readonly categoryFilterOptions = computed(() =>
    this.categories()
      .filter((c) => c.status === 'active')
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
  );

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
          this.vendorProfile.set({ ...profile, id: Number(profile.id) });
        }
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isShareOpen()) {
      this.closeShareDrawer();
    }
  }

  loadProducts(): void {
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

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  hasImage(product: Product): boolean {
    return !!product.imageUrl && !this.brokenImageIds().has(product.id);
  }

  onImageError(productId: number): void {
    const ids = new Set(this.brokenImageIds());
    ids.add(productId);
    this.brokenImageIds.set(ids);
  }

  toggleSelect(product: Product, event?: Event): void {
    event?.stopPropagation();
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

  removeFromShare(productId: number): void {
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

    this.vendorData.createCatalog(name, 'active').subscribe({
      next: () => {
        this.catalogShareService
          .createShortLink(Number(profile.id), profile.storeCode!, {
            v: 1,
            productIds,
          })
          .subscribe({
            next: (record) => {
              this.shareLink.set(
                record.url ||
                  `${buildPublicStoreUrl(profile.storeCode!).replace(/\/(home|products)$/, '')}/c/${record.shortCode}`
              );
              this.shareGenerating.set(false);
            },
            error: () => {
              this.shareGenerating.set(false);
              this.shareError.set(
                'Catalog created, but share link failed. Check Catalogs page for the new entry.'
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
