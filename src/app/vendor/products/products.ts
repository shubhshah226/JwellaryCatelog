import { CurrencyPipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Catalog,
  METAL_TYPES,
  PRODUCT_CATEGORIES,
  Product,
  ProductFormData,
  createEmptyProductForm,
} from '../../dashboard/models/dashboard.model';
import { CatalogShareService } from '../../core/services/catalog-share.service';
import { buildPublicStoreUrl } from '../../core/utils/store-code.util';
import { VendorAccount } from '../../dashboard/models/vendor.model';
import { VendorDataService } from '../services/vendor-data.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-vendor-products',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './products.html',
  styleUrls: ['../shared/vendor-page.css', './products.css'],
})
export class VendorProducts implements OnInit {
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);
  private readonly catalogShareService = inject(CatalogShareService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allProducts = signal<Product[]>([]);
  readonly catalogs = signal<Catalog[]>([]);
  readonly vendorProfile = signal<VendorAccount | null>(null);

  readonly isDrawerOpen = signal(false);
  readonly isShareOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<'add' | 'edit'>('add');
  readonly editingProductId = signal<number | null>(null);
  readonly shareLink = signal('');
  readonly shareGenerating = signal(false);
  readonly shareCopied = signal(false);
  /** Public website cover (base64 / URL) â€” shown before OTP. */
  readonly coverImage = signal('');
  /** Extra product images â€” shown only after customer OTP verify. */
  readonly galleryImages = signal<string[]>([]);

  search = '';
  category = 'all';
  catalogId = 'all';
  status = 'all';

  productForm: ProductFormData = createEmptyProductForm();

  shareCategory = 'all';
  shareMetalType = 'all';
  shareMinPrice: number | null = null;
  shareMaxPrice: number | null = null;
  shareSearch = '';
  shareSelectedIds = signal<Set<number>>(new Set());

  readonly categories = PRODUCT_CATEGORIES;
  readonly metalTypes = METAL_TYPES;

  readonly shareFilteredProducts = computed(() =>
    this.productService.filterProducts(
      this.allProducts().filter((p) => (p.status ?? 'active') === 'active'),
      this.shareSearch,
      this.shareCategory,
      'all',
      'active',
      this.shareMetalType,
      this.shareMinPrice,
      this.shareMaxPrice
    )
  );

  readonly filteredProducts = computed(() =>
    this.productService.filterProducts(
      this.allProducts(),
      this.search,
      this.category,
      this.catalogId,
      this.status
    )
  );

  readonly categoryOptions = computed(() => {
    const categories = new Set(this.allProducts().map((p) => p.category));
    return Array.from(categories).sort();
  });

  ngOnInit(): void {
    this.loadProducts();
    this.vendorData.getCatalogs().subscribe({
      next: (catalogs) => this.catalogs.set(catalogs),
    });
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
      this.closeShareModal();
    } else if (this.isDrawerOpen()) {
      this.closeDrawer();
    }
  }

  loadProducts(): void {
    this.productService.getVendorProducts().subscribe({
      next: (products) => {
        this.allProducts.set(products);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });
  }

  applyFilters(): void {}

  resetFilters(): void {
    this.search = '';
    this.category = 'all';
    this.catalogId = 'all';
    this.status = 'all';
  }

  getCatalogName(catalogId: number): string {
    return this.catalogs().find((c) => c.id === catalogId)?.name ?? 'â€”';
  }

  openAddDrawer(): void {
    this.drawerMode.set('add');
    this.editingProductId.set(null);
    this.productForm = createEmptyProductForm();
    if (this.catalogs().length) {
      this.productForm.catalogId = this.catalogs()[0].id;
    }
    this.coverImage.set('');
    this.galleryImages.set([]);
    this.formError.set('');
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(product: Product): void {
    this.drawerMode.set('edit');
    this.editingProductId.set(product.id);
    this.productForm = this.productService.mapToForm(product);
    this.coverImage.set(this.productForm.imageUrl || '');
    this.galleryImages.set([...(this.productForm.galleryImages ?? [])]);
    this.formError.set('');
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isDrawerOpen.set(false);
    this.formError.set('');
  }

  submitProduct(): void {
    if (!this.productForm.name.trim() || !this.productForm.catalogId || this.productForm.price === null) {
      this.formError.set('Please fill in product name, catalog, and price.');
      return;
    }

    // Sync signal-based image state into form (base64 strings)
    this.productForm.imageUrl = this.coverImage();
    this.productForm.galleryImages = [...this.galleryImages()];
    this.productForm.images = this.coverImage()
      ? [this.coverImage(), ...this.galleryImages()]
      : [...this.galleryImages()];

    if (!this.productForm.imageUrl) {
      this.formError.set('Please upload a cover image (visible on website).');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.drawerMode() === 'edit') {
      const product = this.allProducts().find((p) => p.id === this.editingProductId());
      if (!product) {
        this.isSubmitting.set(false);
        return;
      }
      this.productService.updateProduct(product, this.productForm).subscribe({
        next: (updated) => {
          this.allProducts.set(this.allProducts().map((p) => (p.id === updated.id ? updated : p)));
          this.isSubmitting.set(false);
          this.closeDrawer();
        },
        error: (err: Error) => {
          this.formError.set(err.message || 'Failed to update product.');
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    this.productService.createProduct(this.productForm, this.allProducts()).subscribe({
      next: (created) => {
        this.allProducts.set([created, ...this.allProducts()]);
        this.isSubmitting.set(false);
        this.closeDrawer();
      },
      error: (err: Error) => {
        this.formError.set(err.message || 'Failed to add product.');
        this.isSubmitting.set(false);
      },
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete "${product.name}"?`)) {
      return;
    }
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.allProducts.set(this.allProducts().filter((p) => p.id !== product.id));
      },
    });
  }

  openShareModal(): void {
    this.shareLink.set('');
    this.shareCopied.set(false);
    this.shareCategory = 'all';
    this.shareMetalType = 'all';
    this.shareMinPrice = null;
    this.shareMaxPrice = null;
    this.shareSearch = '';
    this.syncShareSelection();
    this.isShareOpen.set(true);
  }

  onShareFilterChange(): void {
    this.syncShareSelection();
  }

  syncShareSelection(): void {
    this.shareSelectedIds.set(new Set(this.shareFilteredProducts().map((p) => p.id)));
  }

  selectAllShareFiltered(): void {
    this.syncShareSelection();
  }

  clearShareSelection(): void {
    this.shareSelectedIds.set(new Set());
  }

  closeShareModal(): void {
    this.isShareOpen.set(false);
  }

  toggleShareProduct(id: number, checked: boolean): void {
    const ids = new Set(this.shareSelectedIds());
    if (checked) {
      ids.add(id);
    } else {
      ids.delete(id);
    }
    this.shareSelectedIds.set(ids);
  }

  isShareSelected(id: number): boolean {
    return this.shareSelectedIds().has(id);
  }

  async generateShareLink(): Promise<void> {
    const profile = this.vendorProfile();
    if (!profile?.storeCode) {
      return;
    }
    const storeCode = profile.storeCode;

    this.shareGenerating.set(true);
    const selectedIds = [...this.shareSelectedIds()];

    const payload: {
      v: 1;
      productIds?: number[];
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      metalType?: string;
    } = { v: 1 };

    const filtered = this.shareFilteredProducts();
    if (selectedIds.length && selectedIds.length < filtered.length) {
      payload.productIds = selectedIds;
    }
    if (this.shareCategory !== 'all') {
      payload.category = this.shareCategory;
    }
    if (this.shareMetalType !== 'all') {
      payload.metalType = this.shareMetalType;
    }
    if (this.shareMinPrice !== null) {
      payload.minPrice = this.shareMinPrice;
    }
    if (this.shareMaxPrice !== null) {
      payload.maxPrice = this.shareMaxPrice;
    }

    this.catalogShareService
      .createShortLink(Number(profile.id), storeCode, payload)
      .subscribe({
        next: (record) => {
          this.shareLink.set(
            record.url ||
              `${buildPublicStoreUrl(storeCode).replace('/home', '')}/c/${record.shortCode}`
          );
          this.shareGenerating.set(false);
        },
        error: () => {
          this.shareGenerating.set(false);
        },
      });
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFileAsBase64(file, (base64) => {
      this.coverImage.set(base64);
      this.productForm.imageUrl = base64;
      this.formError.set('');
    });
    input.value = '';
  }

  onGallerySelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }
    Array.from(files).forEach((file) => {
      this.readFileAsBase64(file, (base64) => {
        this.galleryImages.update((list) => [...list, base64]);
        this.productForm.galleryImages = [...this.galleryImages()];
        this.formError.set('');
      });
    });
    input.value = '';
  }

  removeCover(): void {
    this.coverImage.set('');
    this.productForm.imageUrl = '';
  }

  removeGalleryImage(index: number): void {
    this.galleryImages.update((list) => list.filter((_, i) => i !== index));
    this.productForm.galleryImages = [...this.galleryImages()];
  }

  private readFileAsBase64(file: File, onDone: (base64: string) => void): void {
    if (!file.type.startsWith('image/')) {
      this.formError.set('Please select an image file.');
      return;
    }
    // ~1.5MB original â‰ˆ ~2MB base64 â€” keep payloads manageable
    if (file.size > 1_500_000) {
      this.formError.set('Each image must be under 1.5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        onDone(result);
      }
    };
    reader.onerror = () => {
      this.formError.set('Could not read image file.');
    };
    reader.readAsDataURL(file);
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
