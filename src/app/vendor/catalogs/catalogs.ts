import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Catalog } from '../../dashboard/models/dashboard.model';
import { ApiClientError } from '../../core/api/api.types';
import { resolveShareUrl } from '../../core/utils/store-code.util';
import { VendorDataService } from '../services/vendor-data.service';

type SortKey = 'name' | 'products' | 'status';

@Component({
  selector: 'app-vendor-catalogs',
  imports: [FormsModule],
  templateUrl: './catalogs.html',
  styleUrls: ['../shared/vendor-page.css', './catalogs.css'],
})
export class VendorCatalogs implements OnInit {
  private readonly vendorData = inject(VendorDataService);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allCatalogs = signal<Catalog[]>([]);
  readonly filteredCatalogs = signal<Catalog[]>([]);
  readonly storeCode = signal('');
  readonly openMenuId = signal<number | null>(null);
  readonly shareCopied = signal(false);
  readonly sortBy = signal<SortKey>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  search = '';
  status = 'all';

  readonly activeCount = computed(
    () => this.filteredCatalogs().filter((c) => this.normalizeStatus(c.status) === 'active').length
  );
  readonly inactiveCount = computed(
    () => this.filteredCatalogs().filter((c) => this.normalizeStatus(c.status) !== 'active').length
  );

  ngOnInit(): void {
    this.loadCatalogs();
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        this.storeCode.set(profile?.storeCode || '');
        this.refreshShareUrls();
      },
      error: () => this.storeCode.set(''),
    });
  }

  private normalizeStatus(status: string | undefined): 'active' | 'inactive' {
    return (status || '').toLowerCase() === 'active' ? 'active' : 'inactive';
  }

  private toPublicShareUrl(catalog: Partial<Catalog> | null | undefined): string {
    if (!catalog || this.normalizeStatus(catalog.status) !== 'active') {
      return '';
    }
    return resolveShareUrl(catalog.shareUrl, this.storeCode() || undefined, catalog.shortCode);
  }

  private refreshShareUrls(): void {
    this.allCatalogs.update((list) =>
      list.map((c) => ({
        ...c,
        shareUrl: this.toPublicShareUrl(c) || null,
      }))
    );
  }

  loadCatalogs(): void {
    this.isLoading.set(true);
    this.vendorData.getCatalogs().subscribe({
      next: (catalogs) => {
        this.allCatalogs.set(
          catalogs.map((c) => ({
            ...c,
            status: this.normalizeStatus(c.status),
            shareUrl: this.toPublicShareUrl({ ...c, status: this.normalizeStatus(c.status) }) || null,
          }))
        );
        this.applyFilters();
        this.isLoading.set(false);
        this.errorMessage.set('');
      },
      error: (err: unknown) => {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to load catalogs. Please ensure the API is running on port 8001.';
        this.errorMessage.set(message);
        this.isLoading.set(false);
      },
    });
  }

  applyFilters(): void {
    let list = this.vendorData.filterCatalogs(this.allCatalogs(), this.search, this.status);
    const key = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (key === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (key === 'products') {
        cmp = (a.productCount ?? 0) - (b.productCount ?? 0);
      } else {
        cmp = this.normalizeStatus(a.status).localeCompare(this.normalizeStatus(b.status));
      }
      return cmp * dir;
    });
    this.filteredCatalogs.set(list);
  }

  toggleSort(column: SortKey): void {
    if (this.sortBy() === column) {
      this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
    this.applyFilters();
  }

  sortIcon(column: SortKey): string {
    if (this.sortBy() !== column) {
      return 'fa-solid fa-sort';
    }
    return this.sortDir() === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  resetFilters(): void {
    this.search = '';
    this.status = 'all';
    this.sortBy.set('name');
    this.sortDir.set('asc');
    this.applyFilters();
  }

  openAddPage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    void this.router.navigate(['/vendor/catalogs/new']);
  }

  openEditPage(catalog: Catalog, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    void this.router.navigate([`/vendor/catalogs/${catalog.id}/edit`]);
  }

  toggleMenu(event: MouseEvent, catalogId: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.update((id) => (id === catalogId ? null : catalogId));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  copyShareLink(catalog: Catalog, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);

    if (this.normalizeStatus(catalog.status) !== 'active') {
      this.errorMessage.set('Activate the catalog before copying a share link.');
      return;
    }

    const link = this.toPublicShareUrl(catalog);
    if (link) {
      void navigator.clipboard.writeText(link).then(() => {
        this.shareCopied.set(true);
        setTimeout(() => this.shareCopied.set(false), 2000);
      });
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
        void navigator.clipboard.writeText(publicUrl).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 2000);
        });
      },
      error: (err: unknown) => {
        const message =
          err instanceof ApiClientError ? err.message : 'Failed to create share link.';
        this.errorMessage.set(message);
      },
    });
  }

  deleteCatalog(catalog: Catalog, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    if (!confirm(`Delete catalog "${catalog.name}"? Products will move back to Default.`)) {
      return;
    }

    this.vendorData.deleteCatalog(catalog.id).subscribe({
      next: () => {
        this.allCatalogs.update((list) => list.filter((item) => item.id !== catalog.id));
        this.applyFilters();
      },
      error: (err: unknown) => {
        const message =
          err instanceof ApiClientError ? err.message : 'Failed to delete catalog.';
        this.errorMessage.set(message);
      },
    });
  }

  formatStatus(status: string): string {
    return this.normalizeStatus(status);
  }
}
