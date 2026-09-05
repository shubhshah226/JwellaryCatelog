import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Product } from '../../dashboard/models/dashboard.model';
import { ApiClientError } from '../../core/api/api.types';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
import { resolveShareUrl } from '../../core/utils/store-code.util';
import { ProductService } from '../services/product.service';
import { VendorDataService } from '../services/vendor-data.service';

type CatalogFormStatus = 'active' | 'inactive';

@Component({
  selector: 'app-vendor-catalog-form',
  imports: [FormsModule],
  templateUrl: './catalog-form.html',
  styleUrls: ['../shared/vendor-page.css', './catalog-form.css'],
})
export class VendorCatalogForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorData = inject(VendorDataService);
  private readonly productService = inject(ProductService);

  readonly mode = signal<'add' | 'edit'>('add');
  readonly catalogId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly pageError = signal('');
  readonly storeCode = signal('');
  readonly shareLink = signal('');
  readonly shareCopied = signal(false);

  readonly allProducts = signal<Product[]>([]);
  readonly selectedProductIds = signal<Set<number>>(new Set());
  readonly productSearch = signal('');
  readonly loadingProducts = signal(false);

  formName = '';
  formStatus: CatalogFormStatus = 'active';

  readonly filteredPickerProducts = computed(() => {
    const q = this.productSearch().trim().toLowerCase();
    const list = this.allProducts();
    if (!q) {
      return list;
    }
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
    );
  });

  readonly selectedCount = computed(() => this.selectedProductIds().size);

  ngOnInit(): void {
    this.vendorData.getProfile().subscribe({
      next: (profile) => this.storeCode.set(profile?.storeCode || ''),
      error: () => this.storeCode.set(''),
    });

    this.productService.getVendorProducts().subscribe({
      next: (products) => this.allProducts.set(products),
      error: () => this.allProducts.set([]),
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.catalogId.set(Number(idParam));
      this.loadCatalog(Number(idParam));
    }
  }

  productImage(product: Product): string {
    return resolveMediaUrl(product.imageUrl || '');
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
    void this.router.navigate(['/vendor/catalogs']);
  }

  isProductSelected(id: number): boolean {
    return this.selectedProductIds().has(id);
  }

  toggleProduct(id: number): void {
    const next = new Set(this.selectedProductIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedProductIds.set(next);
  }

  selectAllFiltered(): void {
    const next = new Set(this.selectedProductIds());
    for (const p of this.filteredPickerProducts()) {
      next.add(p.id);
    }
    this.selectedProductIds.set(next);
  }

  clearSelection(): void {
    this.selectedProductIds.set(new Set());
  }

  copyShareLink(): void {
    if (this.formStatus !== 'active') {
      this.formError.set('Activate the catalog before copying a share link.');
      return;
    }
    const link = resolveShareUrl(this.shareLink(), this.storeCode() || undefined);
    if (!link) {
      this.formError.set('Save the catalog first to get a share link.');
      return;
    }
    void navigator.clipboard.writeText(link).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    });
  }

  submit(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError.set('Catalog name is required.');
      return;
    }

    const productIds = [...this.selectedProductIds()];
    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.mode() === 'edit' && this.catalogId() != null) {
      const id = this.catalogId()!;
      this.vendorData.updateCatalog(id, { name, status: this.formStatus }).subscribe({
        next: () => {
          this.vendorData.setCatalogProducts(id, productIds).subscribe({
            next: () => {
              this.isSubmitting.set(false);
              this.goBack();
            },
            error: (err: unknown) => {
              this.formError.set(this.errMsg(err, 'Failed to update products.'));
              this.isSubmitting.set(false);
            },
          });
        },
        error: (err: unknown) => {
          this.formError.set(this.errMsg(err, 'Failed to save catalog.'));
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    this.vendorData.createCatalog(name, this.formStatus, productIds).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.goBack();
      },
      error: (err: unknown) => {
        this.formError.set(this.errMsg(err, 'Failed to save catalog.'));
        this.isSubmitting.set(false);
      },
    });
  }

  private loadCatalog(id: number): void {
    this.isLoading.set(true);
    this.loadingProducts.set(true);

    this.vendorData.getCatalogs().subscribe({
      next: (catalogs) => {
        const catalog = catalogs.find((c) => c.id === id);
        if (!catalog) {
          this.pageError.set('Catalog not found.');
          this.isLoading.set(false);
          this.loadingProducts.set(false);
          return;
        }
        this.formName = catalog.name;
        this.formStatus = (catalog.status || '').toLowerCase() === 'active' ? 'active' : 'inactive';
        this.shareLink.set(
          resolveShareUrl(catalog.shareUrl, this.storeCode() || undefined, catalog.shortCode)
        );
        this.isLoading.set(false);

        this.vendorData.getCatalogProducts(id).subscribe({
          next: (products) => {
            this.selectedProductIds.set(new Set(products.map((p) => Number(p.id))));
            this.loadingProducts.set(false);
          },
          error: () => {
            this.loadingProducts.set(false);
            this.formError.set('Could not load catalog products.');
          },
        });
      },
      error: (err: unknown) => {
        this.pageError.set(this.errMsg(err, 'Unable to load catalog.'));
        this.isLoading.set(false);
        this.loadingProducts.set(false);
      },
    });
  }

  private errMsg(err: unknown, fallback: string): string {
    return err instanceof ApiClientError ? err.message : fallback;
  }
}
