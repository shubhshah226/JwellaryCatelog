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
import { FilterOptions, MasterDataService } from '../../services/master-data.service';
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
  private readonly masterDataService = inject(MasterDataService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(DataGridComponent) private dataGrid?: DataGridComponent<Product>;

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allProducts = signal<Product[]>([]);
  readonly filterOptions = signal<FilterOptions | null>(null);

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
    const opts = this.filterOptions();
    const categoryOptions = [
      { label: 'All Categories', value: 'all' },
      ...(opts?.categories ?? [])
        .filter((c) => c.status === 'active')
        .map((c) => ({ label: c.name, value: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    const metalOptions = [
      { label: 'All Metals', value: 'all' },
      ...(opts?.metalTypes ?? [])
        .filter((m) => m.status === 'active')
        .map((m) => ({ label: m.name, value: m.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    const stockOptions = [
      { label: 'All Stock', value: 'all' },
      ...(opts?.stockStatuses ?? PRODUCT_STOCK_STATUSES.map((s) => s.value)).map((value) => {
        const known = PRODUCT_STOCK_STATUSES.find((s) => s.value === value);
        return {
          label: known?.label || value.replace(/_/g, ' '),
          value,
        };
      }),
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
          value: (row) => row.name,
          subtitle: (row) => row.sku || 'â€”',
        },
        {
          key: 'category',
          header: 'Category',
          sortable: true,
          cellType: 'stack',
          value: (row) => row.category || 'â€”',
          subtitle: (row) =>
            [row.metalType, row.purity, row.weight ? `${row.weight}g` : '']
              .filter(Boolean)
              .join(' Â· ') || 'â€”',
        },
        {
          key: 'price',
          header: 'Price',
          sortable: true,
          cellType: 'template',
          templateKey: 'price',
          sortValue: (row) => row.price ?? -1,
        },
        {
          key: 'stockStatus',
          header: 'Stock',
          sortable: true,
          cellType: 'badge',
          value: (row) => this.stockLabel(row.stockStatus || row.status),
          badgeClass: (row) => `status-${this.normalizeStockKey(row.stockStatus || row.status)}`,
          sortValue: (row) => row.stockStatus || row.status || '',
        },
        {
          key: 'accountStatus',
          header: 'Status',
          sortable: true,
          cellType: 'badge',
          value: (row) => (row.accountStatus === 'inactive' ? 'Inactive' : 'Active'),
          badgeClass: (row) =>
            row.accountStatus === 'inactive' ? 'status-inactive' : 'status-active',
          sortValue: (row) => row.accountStatus || 'active',
        },
        {
          key: 'imageCount',
          header: 'Photos',
          sortable: true,
          cellType: 'text',
          value: (row) => row.imageCount ?? 0,
          sortValue: (row) => row.imageCount ?? 0,
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
    this.masterDataService
      .getFilterOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opts) => this.filterOptions.set(opts),
        error: () => this.filterOptions.set(null),
      });
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

  setAccountStatus(product: Product, status: 'active' | 'inactive'): void {
    this.productService.updateProductStatus([product.id], status).subscribe({
      next: () => {
        this.allProducts.update((list) =>
          list.map((p) => (p.id === product.id ? { ...p, accountStatus: status } : p))
        );
        this.toast.success(status === 'active' ? 'Product activated.' : 'Product set inactive.');
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
