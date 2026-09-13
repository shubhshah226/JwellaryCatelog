import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PRODUCT_STOCK_STATUSES, Product } from '@common/models/dashboard.model';
import { PhoneDigitsDirective } from '@common/directives/phone-digits.directive';
import { phoneFieldError, sanitizePhoneDigits } from '@common/utils/phone.util';
import { resolveShareUrl } from '@common/utils/store-code.util';
import { ToastService } from '@common/services/toast.service';
import { ProductService } from '../../services/product.service';
import { VendorDataService } from '../../services/vendor-data.service';

@Component({
  selector: 'app-vendor-catalog-form',
  imports: [FormsModule, PhoneDigitsDirective],
  templateUrl: './catalog-form.html',
  styleUrls: ['../../shared/vendor-page.css', './catalog-form.css'],
})
export class VendorCatalogForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);

  readonly mode = signal<'add' | 'edit'>('add');
  readonly catalogId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly pageError = signal('');
  readonly storeCode = signal('');
  readonly shareLink = signal('');
  readonly shareCopied = signal(false);
  readonly isRevoked = signal(false);

  readonly allProducts = signal<Product[]>([]);
  readonly selectedProductIds = signal<Set<string>>(new Set());
  /** Products on the catalog when edit opened (used to compute add/remove diffs). */
  readonly initialProductIds = signal<Set<string>>(new Set());
  readonly productSearch = signal('');
  readonly filterCategory = signal('all');
  readonly filterMetal = signal('all');
  readonly filterStock = signal('all');
  readonly loadingProducts = signal(false);
  /** Step 1 = details, Step 2 = selected products */
  readonly step = signal<'details' | 'products'>('details');
  /** Drawer to pick products that are not yet on the catalog */
  readonly addDrawerOpen = signal(false);
  readonly drawerPendingIds = signal<Set<string>>(new Set());
  readonly selectedListSearch = signal('');

  formName = '';
  formCustomerName = '';
  formCustomerPhone = '';
  formPriceVisible = true;
  formNeverExpires = false;
  formExpiryDays: number | null = 30;
  private defaultExpiryDays = 30;

  readonly selectedProducts = computed(() => {
    const selected = this.selectedProductIds();
    const q = this.selectedListSearch().trim().toLowerCase();
    let list = this.allProducts().filter((p) => selected.has(String(p.id)));
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });

  /** Products not currently on the catalog — shown in the add drawer. */
  readonly availableProducts = computed(() => {
    const selected = this.selectedProductIds();
    return this.allProducts().filter((p) => !selected.has(String(p.id)));
  });

  readonly categoryFilterOptions = computed(() => {
    const names = [
      ...new Set(
        this.availableProducts()
          .map((p) => (p.category || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    return [{ label: 'All Categories', value: 'all' }, ...names.map((n) => ({ label: n, value: n }))];
  });

  readonly metalFilterOptions = computed(() => {
    const names = [
      ...new Set(
        this.availableProducts()
          .map((p) => (p.metalType || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    return [{ label: 'All Metals', value: 'all' }, ...names.map((n) => ({ label: n, value: n }))];
  });

  readonly stockFilterOptions = computed(() => [
    { label: 'All Stock', value: 'all' },
    ...PRODUCT_STOCK_STATUSES.map((s) => ({ label: s.label, value: s.value })),
  ]);

  /** Unselected products filtered for the add drawer. */
  readonly filteredAvailableProducts = computed(() => {
    const q = this.productSearch().trim().toLowerCase();
    const category = this.filterCategory();
    const metal = this.filterMetal();
    const stock = this.filterStock();

    return this.availableProducts()
      .filter((p) => {
        if (category !== 'all' && (p.category || '').trim() !== category) {
          return false;
        }
        if (metal !== 'all' && (p.metalType || '').trim() !== metal) {
          return false;
        }
        if (stock !== 'all') {
          const status = (p.stockStatus || p.status || '').trim();
          if (status !== stock) {
            return false;
          }
        }
        if (!q) {
          return true;
        }
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.metalType ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });

  readonly availableCount = computed(() => this.availableProducts().length);
  readonly drawerPendingCount = computed(() => this.drawerPendingIds().size);
  readonly hasActiveFilters = computed(
    () =>
      !!this.productSearch().trim() ||
      this.filterCategory() !== 'all' ||
      this.filterMetal() !== 'all' ||
      this.filterStock() !== 'all'
  );

  readonly selectedCount = computed(() => this.selectedProductIds().size);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.addDrawerOpen()) {
      this.closeAddDrawer();
    }
  }

  ngOnInit(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        this.storeCode.set(profile?.storeCode || '');
        this.defaultExpiryDays = profile?.catalogExpiryDays ?? 30;
        if (this.mode() === 'add') {
          this.formExpiryDays = this.defaultExpiryDays;
          this.formPriceVisible = profile?.priceVisibleDefault ?? true;
        }
      },
      error: () => this.storeCode.set(''),
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.catalogId.set(idParam);
      this.loadEdit(idParam);
    } else {
      this.loadProductsForCreate();
    }
  }

  onNeverExpiresChange(value: boolean): void {
    this.formNeverExpires = value;
    if (value) {
      this.formExpiryDays = null;
    } else if (this.formExpiryDays == null || this.formExpiryDays <= 0) {
      this.formExpiryDays = this.defaultExpiryDays;
    }
  }

  productImage(product: Product): string {
    return (
      product.imageUrl ||
      this.productService.panelImageUrl(product.primaryImageId, 'grid') ||
      ''
    );
  }

  onProductImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement | null;
    if (fallback) {
      fallback.classList.add('visible');
    }
  }

  goBack(): void {
    if (this.isSubmitting()) {
      return;
    }
    if (this.addDrawerOpen()) {
      this.closeAddDrawer();
      return;
    }
    if (this.step() === 'products') {
      this.step.set('details');
      this.formError.set('');
      return;
    }
    void this.router.navigate(['/vendor/catalogs']);
  }

  goToProductsStep(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError.set('Catalog name is required.');
      return;
    }
    const phoneError = phoneFieldError(this.formCustomerPhone, { label: 'Customer phone' });
    if (phoneError) {
      this.formError.set(phoneError);
      return;
    }
    if (!this.formNeverExpires) {
      const days = Number(this.formExpiryDays);
      if (!Number.isFinite(days) || days <= 0) {
        this.formError.set('Enter catalog expiry in days, or turn on Never expires.');
        return;
      }
    }
    this.formError.set('');
    this.step.set('products');
    // Create flow: open the add drawer immediately so the vendor can pick products.
    if (this.mode() === 'add' && !this.selectedCount()) {
      this.openAddDrawer();
    }
  }

  isDrawerPending(id: string): boolean {
    return this.drawerPendingIds().has(String(id));
  }

  removeSelectedProduct(id: string): void {
    const key = String(id);
    const next = new Set(this.selectedProductIds());
    next.delete(key);
    this.selectedProductIds.set(next);
  }

  openAddDrawer(): void {
    if (this.isRevoked()) {
      return;
    }
    this.resetProductFilters();
    this.drawerPendingIds.set(new Set());
    this.addDrawerOpen.set(true);
  }

  closeAddDrawer(): void {
    this.addDrawerOpen.set(false);
    this.drawerPendingIds.set(new Set());
    this.resetProductFilters();
  }

  toggleDrawerProduct(id: string): void {
    const key = String(id);
    const next = new Set(this.drawerPendingIds());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.drawerPendingIds.set(next);
  }

  selectAllAvailableVisible(): void {
    const next = new Set(this.drawerPendingIds());
    for (const p of this.filteredAvailableProducts()) {
      next.add(String(p.id));
    }
    this.drawerPendingIds.set(next);
  }

  clearDrawerPending(): void {
    this.drawerPendingIds.set(new Set());
  }

  confirmAddProducts(): void {
    const pending = this.drawerPendingIds();
    if (!pending.size) {
      return;
    }
    const next = new Set(this.selectedProductIds());
    for (const id of pending) {
      next.add(id);
    }
    this.selectedProductIds.set(next);
    this.closeAddDrawer();
  }

  resetSelectedToInitial(): void {
    if (this.mode() === 'edit') {
      this.selectedProductIds.set(new Set(this.initialProductIds()));
      return;
    }
    this.selectedProductIds.set(new Set());
  }

  resetProductFilters(): void {
    this.productSearch.set('');
    this.filterCategory.set('all');
    this.filterMetal.set('all');
    this.filterStock.set('all');
  }

  onCustomerPhoneChange(value: string): void {
    this.formCustomerPhone = sanitizePhoneDigits(value);
  }

  customerPhoneError(): string {
    return phoneFieldError(this.formCustomerPhone, {
      required: false,
      label: 'Customer phone',
    });
  }

  copyShareLink(): void {
    const link = resolveShareUrl(this.shareLink(), this.storeCode() || undefined);
    if (!link) {
      this.formError.set('Save the catalog first to get a share link.');
      return;
    }
    void this.copyLinkToClipboard(link, 'Share link copied.');
  }

  submit(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError.set('Catalog name is required.');
      return;
    }

    const productIds = [...this.selectedProductIds()];
    if (!productIds.length) {
      this.formError.set('Select at least one product.');
      return;
    }
    const phoneError = phoneFieldError(this.formCustomerPhone, { label: 'Customer phone' });
    if (phoneError) {
      this.formError.set(phoneError);
      return;
    }
    if (!this.formNeverExpires) {
      const days = Number(this.formExpiryDays);
      if (!Number.isFinite(days) || days <= 0) {
        this.formError.set('Enter catalog expiry in days, or turn on Never expires.');
        return;
      }
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const shareOpts = {
      customerName: this.formCustomerName.trim() || null,
      customerPhone: this.formCustomerPhone.trim() || null,
      priceVisible: this.formPriceVisible,
      neverExpires: this.formNeverExpires,
      expiryDays: this.formNeverExpires ? null : Number(this.formExpiryDays),
    };

    if (this.mode() === 'edit' && this.catalogId()) {
      if (this.isRevoked()) {
        this.formError.set('This catalog is revoked and cannot be updated. Create a new one.');
        this.isSubmitting.set(false);
        return;
      }
      const id = this.catalogId()!;
      const initial = this.initialProductIds();
      const selected = new Set(productIds);
      const addProductIds = productIds.filter((pid) => !initial.has(pid));
      const removeProductIds = [...initial].filter((pid) => !selected.has(pid));

      this.vendorData
        .updateCatalog(id, {
          name,
          addProductIds,
          removeProductIds,
          ...shareOpts,
        })
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            const link = resolveShareUrl(this.shareLink(), this.storeCode() || undefined);
            void this.finishWithCopiedLink(
              link,
              link ? 'Catalog updated. Share link copied.' : 'Catalog updated.'
            );
          },
          error: () => {
            this.isSubmitting.set(false);
          },
        });
      return;
    }

    this.vendorData.createCatalog(name, productIds, shareOpts).subscribe({
      next: (catalog) => {
        this.isSubmitting.set(false);
        const link = resolveShareUrl(
          catalog.shareUrl,
          this.storeCode() || undefined,
          catalog.shortCode
        );
        void this.finishWithCopiedLink(
          link,
          link ? 'Catalog created. Share link copied.' : 'Catalog created.'
        );
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  private async finishWithCopiedLink(link: string, successMessage: string): Promise<void> {
    if (link) {
      await this.copyLinkToClipboard(link, successMessage);
    } else {
      this.toast.success(successMessage);
    }
    void this.router.navigate(['/vendor/catalogs']);
  }

  private async copyLinkToClipboard(link: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.shareCopied.set(true);
      this.toast.success(successMessage);
      setTimeout(() => this.shareCopied.set(false), 2000);
    } catch {
      this.toast.success(successMessage.replace('Share link copied.', 'Share link is ready.'));
    }
  }

  private loadProductsForCreate(): void {
    this.loadingProducts.set(true);
    const preselected = this.parseProductIdsQuery(
      this.route.snapshot.queryParamMap.get('products')
    );

    this.productService.getVendorProducts().subscribe({
      next: (products) => {
        const withUrls = this.withImageUrls(products);
        if (preselected.size) {
          const valid = new Set(
            withUrls.map((p) => String(p.id)).filter((id) => preselected.has(id))
          );
          this.selectedProductIds.set(valid);
          // Selected first â€” same as edit flow
          this.allProducts.set([
            ...withUrls.filter((p) => valid.has(String(p.id))),
            ...withUrls.filter((p) => !valid.has(String(p.id))),
          ]);
          if (valid.size) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true,
            });
          }
        } else {
          this.allProducts.set(withUrls);
        }
        this.loadingProducts.set(false);
      },
      error: () => {
        this.allProducts.set([]);
        this.loadingProducts.set(false);
      },
    });
  }

  private parseProductIdsQuery(raw: string | null): Set<string> {
    if (!raw?.trim()) {
      return new Set();
    }
    return new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );
  }

  /** Full product list + catalog items pre-selected. */
  private loadEdit(id: string): void {
    this.isLoading.set(true);
    this.loadingProducts.set(true);

    forkJoin({
      products: this.productService.getVendorProducts().pipe(catchError(() => of([] as Product[]))),
      detail: this.vendorData.getCatalogDetail(id),
    }).subscribe({
      next: ({ products, detail }) => {
        const { catalog, products: catalogProducts, catalogUrl } = detail;
        this.formName = catalog.name;
        this.formCustomerName = catalog.customerName || '';
        this.formCustomerPhone = catalog.customerPhone || '';
        this.formPriceVisible = catalog.priceVisible ?? true;
        this.formNeverExpires = !catalog.expiresAt;
        if (catalog.expiresAt) {
          const ms = new Date(catalog.expiresAt).getTime() - Date.now();
          const daysLeft = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
          this.formExpiryDays = daysLeft;
        } else {
          this.formExpiryDays = this.defaultExpiryDays;
        }
        this.isRevoked.set((catalog.status || '').toLowerCase() !== 'active');
        this.shareLink.set(
          resolveShareUrl(
            catalogUrl || catalog.shareUrl,
            this.storeCode() || undefined,
            catalog.shortCode
          )
        );

        const catalogIds = new Set(
          catalogProducts.map((p) => String(p.id)).filter(Boolean)
        );
        this.initialProductIds.set(catalogIds);
        this.selectedProductIds.set(new Set(catalogIds));
        this.allProducts.set(
          this.mergeProductLists(this.withImageUrls(products), catalogProducts)
        );
        // Edit opens on the product grid; details stay available via Back.
        this.step.set('products');
        this.isLoading.set(false);
        this.loadingProducts.set(false);
      },
      error: () => {
        this.pageError.set('Unable to load catalog.');
        this.isLoading.set(false);
        this.loadingProducts.set(false);
      },
    });
  }

  /** All vendor products, plus any catalog-only rows so selection still shows. */
  private mergeProductLists(all: Product[], catalogItems: Product[]): Product[] {
    const byId = new Map<string, Product>();
    for (const p of all) {
      const id = String(p.id);
      if (id) {
        byId.set(id, p);
      }
    }
    for (const p of catalogItems) {
      const id = String(p.id);
      if (!id) {
        continue;
      }
      const existing = byId.get(id);
      if (existing) {
        byId.set(id, {
          ...existing,
          primaryImageId: existing.primaryImageId || p.primaryImageId || null,
          imageUrl:
            existing.imageUrl ||
            this.productService.panelImageUrl(p.primaryImageId, 'grid') ||
            '',
        });
      } else {
        byId.set(id, {
          ...p,
          imageUrl: this.productService.panelImageUrl(p.primaryImageId, 'grid') || '',
        });
      }
    }
    return [...byId.values()];
  }

  private withImageUrls(products: Product[]): Product[] {
    return products.map((p) => ({
      ...p,
      id: String(p.id),
      imageUrl:
        p.imageUrl || this.productService.panelImageUrl(p.primaryImageId, 'grid') || '',
    }));
  }
}
