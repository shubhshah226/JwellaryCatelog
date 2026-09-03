import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Catalog, CatalogStatus } from '../../dashboard/models/dashboard.model';
import { ApiClientError } from '../../core/api/api.types';
import { VendorDataService } from '../services/vendor-data.service';

@Component({
  selector: 'app-vendor-catalogs',
  imports: [FormsModule],
  templateUrl: './catalogs.html',
  styleUrls: ['../shared/vendor-page.css', './catalogs.css'],
})
export class VendorCatalogs implements OnInit {
  private readonly vendorData = inject(VendorDataService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allCatalogs = signal<Catalog[]>([]);
  readonly filteredCatalogs = signal<Catalog[]>([]);

  readonly isDrawerOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<'add' | 'edit'>('add');
  readonly editingId = signal<number | null>(null);
  readonly openMenuId = signal<number | null>(null);

  search = '';
  status = 'all';
  formName = '';
  formStatus: CatalogStatus = 'active';

  readonly activeCount = computed(
    () => this.filteredCatalogs().filter((c) => c.status === 'active').length
  );
  readonly pendingCount = computed(
    () => this.filteredCatalogs().filter((c) => c.status === 'pending').length
  );

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.isLoading.set(true);
    this.vendorData.getCatalogs().subscribe({
      next: (catalogs) => {
        this.allCatalogs.set(catalogs);
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
    this.filteredCatalogs.set(
      this.vendorData.filterCatalogs(this.allCatalogs(), this.search, this.status)
    );
  }

  resetFilters(): void {
    this.search = '';
    this.status = 'all';
    this.applyFilters();
  }

  openAddDrawer(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.drawerMode.set('add');
    this.editingId.set(null);
    this.formName = '';
    this.formStatus = 'active';
    this.formError.set('');
    this.openMenuId.set(null);
    // Defer so the opening click cannot immediately hit the backdrop
    queueMicrotask(() => this.isDrawerOpen.set(true));
  }

  openEditDrawer(catalog: Catalog, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.drawerMode.set('edit');
    this.editingId.set(catalog.id);
    this.formName = catalog.name;
    this.formStatus = catalog.status;
    this.formError.set('');
    this.openMenuId.set(null);
    queueMicrotask(() => this.isDrawerOpen.set(true));
  }

  closeDrawer(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isSubmitting()) {
      return;
    }
    this.isDrawerOpen.set(false);
    this.formError.set('');
  }

  toggleMenu(event: MouseEvent, catalogId: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.update((id) => (id === catalogId ? null : catalogId));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  submitCatalog(event?: Event): void {
    event?.preventDefault();
    const name = this.formName.trim();
    if (!name) {
      this.formError.set('Catalog name is required.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const request =
      this.drawerMode() === 'edit' && this.editingId() != null
        ? this.vendorData.updateCatalog(this.editingId()!, {
            name,
            status: this.formStatus,
          })
        : this.vendorData.createCatalog(name, this.formStatus);

    request.subscribe({
      next: (catalog) => {
        if (this.drawerMode() === 'edit') {
          this.allCatalogs.update((list) =>
            list.map((item) => (item.id === catalog.id ? catalog : item))
          );
        } else {
          this.allCatalogs.update((list) => [catalog, ...list]);
        }
        this.applyFilters();
        this.isSubmitting.set(false);
        this.isDrawerOpen.set(false);
      },
      error: (err: unknown) => {
        const message =
          err instanceof ApiClientError ? err.message : 'Failed to save catalog.';
        this.formError.set(message);
        this.isSubmitting.set(false);
      },
    });
  }

  deleteCatalog(catalog: Catalog, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    if (!confirm(`Delete catalog "${catalog.name}"?`)) {
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
    return status.replace('_', ' ');
  }
}
