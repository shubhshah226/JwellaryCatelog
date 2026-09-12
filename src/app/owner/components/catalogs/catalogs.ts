import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Catalog } from '@common/models/dashboard.model';
import { DataGridComponent } from '@common/components/data-grid/data-grid';
import {
  DataGridActionEvent,
  DataGridConfig,
} from '@common/components/data-grid/data-grid.types';
import { resolveShareUrl } from '@common/utils/store-code.util';
import { ToastService } from '@common/services/toast.service';
import { VendorDataService } from '../../services/vendor-data.service';

@Component({
  selector: 'app-vendor-catalogs',
  imports: [DataGridComponent],
  templateUrl: './catalogs.html',
  styleUrls: ['../../shared/vendor-page.css', './catalogs.css'],
})
export class VendorCatalogs implements OnInit {
  private readonly vendorData = inject(VendorDataService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allCatalogs = signal<Catalog[]>([]);
  readonly storeCode = signal('');

  readonly activeCount = computed(
    () => this.allCatalogs().filter((c) => this.isActive(c)).length
  );
  readonly inactiveCount = computed(
    () => this.allCatalogs().filter((c) => !this.isActive(c)).length
  );

  readonly gridConfig = computed<DataGridConfig<Catalog>>(() => ({
    rowId: 'id',
    selectable: false,
    entityLabel: 'catalogs',
    emptyMessage: 'No catalogs yet. Click + Add Catalog or share products from Manage Products.',
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    filters: [
      {
        key: 'search',
        type: 'search',
        placeholder: 'Search catalogs...',
        searchFields: ['name', 'customerName', 'customerPhone', 'id'],
      },
      {
        key: 'status',
        type: 'select',
        defaultValue: 'all',
        matchValue: (row) => ((row as Catalog).status === 'active' ? 'active' : 'inactive'),
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
        key: 'name',
        header: 'Catalog',
        sortable: true,
        cellType: 'stack',
        value: (row) => row.name,
        subtitle: (row) =>
          row.customerName
            ? `${row.customerName}${row.customerPhone ? ' Â· ' + row.customerPhone : ''}`
            : row.shortCode
              ? `Code: ${row.shortCode}`
              : `ID: ${row.id.slice(0, 8)}â€¦`,
      },
      {
        key: 'productCount',
        header: 'Products',
        sortable: true,
        cellType: 'text',
        value: (row) => row.productCount ?? 0,
        sortValue: (row) => row.productCount ?? 0,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        cellType: 'badge',
        value: (row) => this.formatStatus(row.status),
        badgeClass: (row) => `status-${this.isActive(row) ? 'active' : 'inactive'}`,
        sortValue: (row) => row.status,
      },
    ],
    actions: [
      {
        id: 'edit',
        label: 'Edit',
        icon: 'fa-solid fa-pen',
        visible: (row) => this.isActive(row),
      },
      {
        id: 'copy',
        label: 'Copy share link',
        icon: 'fa-solid fa-link',
        visible: (row) => this.isActive(row),
      },
      {
        id: 'revoke',
        label: 'Revoke',
        icon: 'fa-solid fa-ban',
        visible: (row) => this.isActive(row),
      },
    ],
  }));

  ngOnInit(): void {
    this.loadCatalogs();
    this.vendorData
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => this.storeCode.set(profile?.storeCode || ''),
        error: () => this.storeCode.set(''),
      });
  }

  loadCatalogs(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.vendorData
      .getCatalogs()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (catalogs) => {
          this.allCatalogs.set(catalogs);
        },
        error: () => {
          this.errorMessage.set('Unable to load catalogs.');
        },
      });
  }

  onGridAction(event: DataGridActionEvent<Catalog>): void {
    switch (event.actionId) {
      case 'edit':
        this.openEditPage(event.row);
        break;
      case 'copy':
        this.copyShareLink(event.row);
        break;
      case 'revoke':
        this.revokeCatalog(event.row);
        break;
      default:
        break;
    }
  }

  openAddPage(): void {
    void this.router.navigate(['/vendor/catalogs/new']);
  }

  openEditPage(catalog: Catalog): void {
    void this.router.navigate([`/vendor/catalogs/${catalog.id}/edit`]);
  }

  copyShareLink(catalog: Catalog): void {
    if (!this.isActive(catalog)) {
      this.toast.error('Only active catalogs have a share link.');
      return;
    }
    const link = resolveShareUrl(catalog.shareUrl, this.storeCode() || undefined, catalog.shortCode);
    if (link) {
      void navigator.clipboard.writeText(link).then(() => this.toast.success('Share link copied.'));
      return;
    }
    this.vendorData.ensureCatalogShare(catalog.id).subscribe({
      next: (share) => {
        const publicUrl = resolveShareUrl(share.url, this.storeCode() || undefined, share.shortCode);
        this.allCatalogs.update((list) =>
          list.map((item) =>
            item.id === catalog.id
              ? { ...item, shareUrl: publicUrl, shortCode: share.shortCode }
              : item
          )
        );
        void navigator.clipboard.writeText(publicUrl).then(() =>
          this.toast.success('Share link copied.')
        );
      },
    });
  }

  revokeCatalog(catalog: Catalog): void {
    if (
      !confirm(
        `Revoke catalog "${catalog.name}"? The share link will stop working. Products stay in Manage Products.`
      )
    ) {
      return;
    }
    this.vendorData.revokeCatalog(catalog.id).subscribe({
      next: () => {
        this.allCatalogs.update((list) =>
          list.map((item) =>
            item.id === catalog.id ? { ...item, status: 'inactive' as const } : item
          )
        );
        this.toast.success('Catalog revoked.');
      },
    });
  }

  formatStatus(status: string | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'Active';
    if (s === 'expired') return 'Expired';
    return 'Inactive';
  }

  private isActive(catalog: Catalog): boolean {
    return (catalog.status || '').toLowerCase() === 'active';
  }
}
