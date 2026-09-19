import { CurrencyPipe, NgStyle } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { PRODUCT_STOCK_STATUSES, Product } from '@common/models/dashboard.model';
import { DataGridComponent } from '@common/components/data-grid/data-grid';
import { DataGridCellDirective } from '@common/components/data-grid/data-grid-cell.directive';
import {
  DataGridActionEvent,
  DataGridConfig,
  DataGridSelectionEvent,
} from '@common/components/data-grid/data-grid.types';
import { ToastService } from '@common/services/toast.service';
import { ConfirmDialogService } from '@common/services/confirm-dialog.service';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-vendor-products',
  imports: [CurrencyPipe, NgStyle, DataGridComponent, DataGridCellDirective],
  templateUrl: './products.html',
  styleUrls: ['../../shared/vendor-page.css', './products.css'],
})
export class VendorProducts implements OnInit {
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(DataGridComponent) private dataGrid?: DataGridComponent<Product>;

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allProducts = signal<Product[]>([]);

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);

  /** Amazon/Flipkart-style large image preview on thumbnail hover (desktop). */
  readonly imagePreview = signal<{
    url: string;
    name: string;
    style: Record<string, string>;
  } | null>(null);

  /** Same Add Catalog form, with selected products pre-checked. */
  openCreateCatalog(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) {
      this.toast.error('Select at least one product.');
      return;
    }
    void this.router.navigate(['/vendor/catalogs/new'], {
      queryParams: { products: ids.join(',') },
    });
  }

  readonly gridConfig = computed<DataGridConfig<Product>>(() => {
    const products = this.allProducts();
    const categoryNames = [
      ...new Set(
        products
          .map((p) => (p.category || '').trim())
          .filter((name) => !!name)
      ),
    ].sort((a, b) => a.localeCompare(b));
    const metalNames = [
      ...new Set(
        products
          .map((p) => (p.metalType || '').trim())
          .filter((name) => !!name)
      ),
    ].sort((a, b) => a.localeCompare(b));

    const categoryOptions = [
      { label: 'All Categories', value: 'all' },
      ...categoryNames.map((name) => ({ label: name, value: name })),
    ];
    const metalOptions = [
      { label: 'All Metals', value: 'all' },
      ...metalNames.map((name) => ({ label: name, value: name })),
    ];
    const stockOptions = [
      { label: 'All Stock', value: 'all' },
      ...PRODUCT_STOCK_STATUSES.map((s) => ({
        label: s.label,
        value: s.value,
      })),
    ];

    return {
      rowId: 'id',
      selectable: true,
      entityLabel: 'products',
      emptyMessage: 'No products yet. Add your first design to get started.',
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50],
      filters: [
        {
          key: 'search',
          type: 'search',
          placeholder: 'Search name, SKU, category...',
          searchFields: ['name', 'sku', 'category', 'metalType'],
        },
        {
          key: 'category',
          type: 'select',
          defaultValue: 'all',
          matchField: 'category',
          matchMode: 'equals',
          options: categoryOptions,
        },
        {
          key: 'metalType',
          type: 'select',
          defaultValue: 'all',
          matchField: 'metalType',
          matchMode: 'equals',
          options: metalOptions,
        },
        {
          key: 'stock',
          type: 'select',
          defaultValue: 'all',
          matchValue: (row) => (row as Product).stockStatus || (row as Product).status || '',
          matchMode: 'equals',
          options: stockOptions,
        },
        {
          key: 'accountStatus',
          type: 'select',
          defaultValue: 'all',
          matchField: 'accountStatus',
          matchMode: 'equals',
          options: [
            { label: 'All Status', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
      ],
      columns: [
        {
          key: 'image',
          header: 'Photo',
          sortable: false,
          cellType: 'template',
          templateKey: 'photo',
          className: 'dg-col-photo',
        },
        {
          key: 'name',
          header: 'Product',
          sortable: true,
          cellType: 'stack',
          className: 'dg-col-product',
          value: (row) => row.name,
          subtitle: (row) => row.sku || '—',
        },
        {
          key: 'category',
          header: 'Category',
          sortable: true,
          cellType: 'stack',
          className: 'dg-col-category',
          value: (row) => row.category || '—',
          subtitle: (row) =>
            [row.metalType, row.purity, row.weight ? `${row.weight}g` : '']
              .filter(Boolean)
              .join(' · ') || '—',
        },
        {
          key: 'price',
          header: 'Price',
          sortable: true,
          cellType: 'template',
          templateKey: 'price',
          className: 'dg-col-price',
          sortValue: (row) => row.price ?? -1,
        },
        {
          key: 'stockStatus',
          header: 'Stock',
          sortable: true,
          cellType: 'badge',
          className: 'dg-col-stock',
          value: (row) => this.stockLabelShort(row.stockStatus || row.status),
          badgeClass: (row) => `status-${this.normalizeStockKey(row.stockStatus || row.status)}`,
          sortValue: (row) => row.stockStatus || row.status || '',
        },
        {
          key: 'accountStatus',
          header: 'Status',
          sortable: true,
          cellType: 'badge',
          className: 'dg-col-status',
          value: (row) => (row.accountStatus === 'inactive' ? 'Off' : 'On'),
          badgeClass: (row) =>
            row.accountStatus === 'inactive' ? 'status-inactive' : 'status-active',
          sortValue: (row) => row.accountStatus || 'active',
        },
      ],
      actions: [
        { id: 'edit', label: 'Edit', icon: 'fa-solid fa-pen' },
        {
          id: 'stock_in',
          label: 'Mark In Stock',
          icon: 'fa-solid fa-box-open',
          visible: (row) => (row.stockStatus || row.status) !== 'in_stock',
        },
        {
          id: 'stock_out',
          label: 'Mark Out of Stock',
          icon: 'fa-solid fa-box',
          visible: (row) => (row.stockStatus || row.status) !== 'out_of_stock',
        },
        {
          id: 'stock_mto',
          label: 'Mark Make to Order',
          icon: 'fa-solid fa-hammer',
          visible: (row) => (row.stockStatus || row.status) !== 'make_to_order',
        },
        {
          id: 'deactivate',
          label: 'Set Inactive',
          icon: 'fa-solid fa-ban',
          visible: (row) => row.accountStatus !== 'inactive',
        },
        {
          id: 'activate',
          label: 'Set Active',
          icon: 'fa-solid fa-check',
          visible: (row) => row.accountStatus === 'inactive',
        },
        { id: 'delete', label: 'Delete', icon: 'fa-solid fa-trash' },
      ],
    };
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.productService
      .getVendorProducts()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (products) => {
          this.allProducts.set(products);
        },
        error: () => {
          this.errorMessage.set('Unable to load products.');
        },
      });
  }

  onGridAction(event: DataGridActionEvent<Product>): void {
    const product = event.row;
    switch (event.actionId) {
      case 'edit':
        this.openEditPage(product);
        break;
      case 'stock_in':
        this.setStock(product, 'in_stock');
        break;
      case 'stock_out':
        this.setStock(product, 'out_of_stock');
        break;
      case 'stock_mto':
        this.setStock(product, 'make_to_order');
        break;
      case 'activate':
        this.setAccountStatus(product, 'active');
        break;
      case 'deactivate':
        this.setAccountStatus(product, 'inactive');
        break;
      case 'delete':
        this.deleteProduct(product);
        break;
      default:
        break;
    }
  }

  onSelectionChange(event: DataGridSelectionEvent): void {
    this.selectedIds.set(new Set(event.selectedIds));
  }

  openAddPage(): void {
    void this.router.navigateByUrl('/vendor/products/new');
  }

  openEditPage(product: Product): void {
    void this.router.navigateByUrl(`/vendor/products/${product.id}/edit`);
  }

  stockLabel(status?: string | null): string {
    return this.productService.stockLabel(status);
  }

  /** Compact labels so stock badges fit the grid column. */
  stockLabelShort(status?: string | null): string {
    const key = this.normalizeStockKey(status);
    if (key === 'out_of_stock') return 'Out';
    if (key === 'make_to_order') return 'MTO';
    return 'In stock';
  }

  setStock(product: Product, stockStatus: 'in_stock' | 'out_of_stock' | 'make_to_order'): void {
    this.productService.updateStockStatus([product.id], stockStatus).subscribe({
      next: () => {
        this.allProducts.update((list) =>
          list.map((p) =>
            p.id === product.id
              ? { ...p, stockStatus, status: stockStatus }
              : p
          )
        );
        this.toast.success(`Stock updated to ${this.stockLabel(stockStatus)}.`);
      },
    });
  }

  async setAccountStatus(product: Product, status: 'active' | 'inactive'): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: status === 'inactive' ? 'Set Inactive' : 'Activate Product',
      message:
        status === 'inactive'
          ? `Set "${product.name}" as inactive? It will be hidden from new catalogs until activated again.`
          : `Activate "${product.name}"?`,
      confirmLabel: status === 'inactive' ? 'Set Inactive' : 'Activate',
      cancelLabel: 'Cancel',
      tone: status === 'inactive' ? 'danger' : 'default',
    });
    if (!confirmed) {
      return;
    }
    this.productService.updateProductStatus([product.id], status).subscribe({
      next: () => {
        this.allProducts.update((list) =>
          list.map((p) => (p.id === product.id ? { ...p, accountStatus: status } : p))
        );
        this.toast.success(status === 'active' ? 'Product activated.' : 'Product set inactive.');
      },
    });
  }

  async deleteProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.allProducts.set(this.allProducts().filter((p) => p.id !== product.id));
        const ids = new Set(this.selectedIds());
        ids.delete(product.id);
        this.selectedIds.set(ids);
        this.toast.success('Product deleted.');
      },
    });
  }

  clearSelection(): void {
    this.dataGrid?.clearSelection();
    this.selectedIds.set(new Set());
  }

  onThumbError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const wrap = img.parentElement;
    if (wrap && !wrap.querySelector('.product-thumb-fallback')) {
      const fallback = document.createElement('span');
      fallback.className = 'product-thumb-fallback';
      fallback.innerHTML = '<i class="fa-solid fa-gem"></i>';
      wrap.appendChild(fallback);
    }
    this.hideImagePreview();
  }

  onThumbEnter(event: MouseEvent, product: Product): void {
    if (!product.imageUrl || !this.canHoverPreview()) {
      return;
    }
    this.positionImagePreview(event.currentTarget as HTMLElement, product);
  }

  onThumbMove(event: MouseEvent, product: Product): void {
    if (!this.imagePreview() || !product.imageUrl) {
      return;
    }
    this.positionImagePreview(event.currentTarget as HTMLElement, product);
  }

  hideImagePreview(): void {
    this.imagePreview.set(null);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.imagePreview()) {
      this.hideImagePreview();
    }
  }

  private canHoverPreview(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  private positionImagePreview(anchor: HTMLElement, product: Product): void {
    const rect = anchor.getBoundingClientRect();
    const previewW = 280;
    const previewH = 280;
    const gap = 12;
    const pad = 12;

    let left = rect.right + gap;
    if (left + previewW > window.innerWidth - pad) {
      left = rect.left - previewW - gap;
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - previewW - pad));

    let top = rect.top + rect.height / 2 - previewH / 2;
    top = Math.max(pad, Math.min(top, window.innerHeight - previewH - pad));

    this.imagePreview.set({
      url: product.imageUrl!,
      name: product.name || 'Product',
      style: {
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${previewW}px`,
        height: `${previewH}px`,
      },
    });
  }

  private normalizeStockKey(status?: string | null): string {
    const value = (status || 'in_stock').toLowerCase().replace(/\s+/g, '_');
    if (value === 'out_of_stock') return 'out_of_stock';
    if (value === 'make_to_order') return 'make_to_order';
    if (value === 'inactive') return 'inactive';
    return 'in_stock';
  }
}
