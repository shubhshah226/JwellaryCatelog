import { DecimalPipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  VendorAccount,
  VendorFilters,
  VendorFormData,
  VendorStats,
  createEmptyVendorForm,
} from '../../dashboard/models/vendor.model';
import { VendorService } from '../../dashboard/services/vendor.service';

type DrawerMode = 'add' | 'edit';

@Component({
  selector: 'app-vendors',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './vendors.html',
  styleUrl: './vendors.css',
})
export class Vendors implements OnInit {
  private readonly vendorService = inject(VendorService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allVendors = signal<VendorAccount[]>([]);
  readonly stats = signal<VendorStats | null>(null);
  readonly filteredVendors = signal<VendorAccount[]>([]);
  readonly currentPage = signal(1);
  readonly rowsPerPage = signal(10);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly isDrawerOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<DrawerMode>('add');
  readonly editingVendorId = signal<number | null>(null);
  readonly openActionsMenuId = signal<number | null>(null);

  vendorForm: VendorFormData = createEmptyVendorForm();

  filters: VendorFilters = {
    search: '',
    status: 'all',
    plan: 'all',
    subscription: 'all',
    joinedDate: '',
  };

  draftFilters: VendorFilters = { ...this.filters };

  readonly paginatedVendors = computed(() => {
    const start = (this.currentPage() - 1) * this.rowsPerPage();
    return this.filteredVendors().slice(start, start + this.rowsPerPage());
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredVendors().length / this.rowsPerPage()))
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    for (let page = 1; page <= Math.min(total, 5); page++) {
      pages.push(page);
    }

    if (total > 5 && !pages.includes(current) && current <= total) {
      pages.push(current);
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  });

  readonly paginationStart = computed(() => {
    if (!this.filteredVendors().length) {
      return 0;
    }
    return (this.currentPage() - 1) * this.rowsPerPage() + 1;
  });

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.rowsPerPage(), this.filteredVendors().length)
  );

  readonly drawerTitle = computed(() => (this.drawerMode() === 'edit' ? 'Edit Vendor' : 'Add Vendor'));

  readonly drawerSubtitle = computed(() =>
    this.drawerMode() === 'edit'
      ? 'Update vendor account information.'
      : 'Create a new vendor account on the platform.'
  );

  readonly submitButtonLabel = computed(() => {
    if (this.isSubmitting()) {
      return 'Saving...';
    }

    return this.drawerMode() === 'edit' ? 'Update Vendor' : 'Add Vendor';
  });

  ngOnInit(): void {
    this.vendorService.getVendorsData().subscribe({
      next: ({ vendors, stats }) => {
        this.allVendors.set(vendors);
        this.stats.set(stats);
        this.filteredVendors.set(vendors);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load vendors. Please start json-server.');
        this.isLoading.set(false);
      },
    });
  }

  @HostListener('document:click')
  closeActionsMenu(): void {
    this.openActionsMenuId.set(null);
  }

  applyFilters(): void {
    this.filters = { ...this.draftFilters };
    const filtered = this.vendorService.filterVendors(this.allVendors(), this.filters);
    this.filteredVendors.set(filtered);
    this.currentPage.set(1);
    this.selectedIds.set(new Set());
  }

  resetFilters(): void {
    this.draftFilters = {
      search: '',
      status: 'all',
      plan: 'all',
      subscription: 'all',
      joinedDate: '',
    };
    this.applyFilters();
  }

  onRowsPerPageChange(value: string): void {
    this.rowsPerPage.set(Number(value));
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.set(new Set(this.paginatedVendors().map((vendor) => vendor.id)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  toggleSelect(vendorId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const updated = new Set(this.selectedIds());

    if (checked) {
      updated.add(vendorId);
    } else {
      updated.delete(vendorId);
    }

    this.selectedIds.set(updated);
  }

  isSelected(vendorId: number): boolean {
    return this.selectedIds().has(vendorId);
  }

  isAllSelected(): boolean {
    const pageIds = this.paginatedVendors().map((vendor) => vendor.id);
    return pageIds.length > 0 && pageIds.every((id) => this.selectedIds().has(id));
  }

  toggleActionsMenu(vendorId: number, event: Event): void {
    event.stopPropagation();
    this.openActionsMenuId.set(this.openActionsMenuId() === vendorId ? null : vendorId);
  }

  getSparklinePath(points: number[]): string {
    if (!points.length) {
      return '';
    }

    const max = Math.max(...points, 1);
    const step = 100 / Math.max(points.length - 1, 1);

    return points
      .map((point, index) => {
        const x = index * step;
        const y = 100 - (point / max) * 100;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  formatPlan(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  openAddVendorDrawer(): void {
    this.drawerMode.set('add');
    this.editingVendorId.set(null);
    this.vendorForm = createEmptyVendorForm();
    this.formError.set('');
    this.openActionsMenuId.set(null);
    this.isDrawerOpen.set(true);
  }

  openEditVendorDrawer(vendor: VendorAccount, event?: Event): void {
    event?.stopPropagation();
    this.drawerMode.set('edit');
    this.editingVendorId.set(vendor.id);
    this.vendorForm = this.vendorService.mapVendorToForm(vendor);
    this.formError.set('');
    this.openActionsMenuId.set(null);
    this.isDrawerOpen.set(true);
  }

  closeVendorDrawer(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.isDrawerOpen.set(false);
    this.formError.set('');
    this.editingVendorId.set(null);
    this.drawerMode.set('add');
  }

  submitVendorForm(): void {
    if (!this.vendorForm.name.trim() || !this.vendorForm.email.trim() || !this.vendorForm.phone.trim()) {
      this.formError.set('Please fill in vendor name, email, and phone.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.drawerMode() === 'edit') {
      const vendorId = this.editingVendorId();
      const existingVendor = this.allVendors().find((vendor) => vendor.id === vendorId);

      if (!existingVendor) {
        this.isSubmitting.set(false);
        this.formError.set('Vendor not found.');
        return;
      }

      this.vendorService.updateVendor(existingVendor, this.vendorForm).subscribe({
        next: (updatedVendor) => this.handleVendorSaved(updatedVendor, false),
        error: () => {
          this.isSubmitting.set(false);
          this.formError.set('Failed to update vendor. Please try again.');
        },
      });

      return;
    }

    this.vendorService.createVendor(this.vendorForm, this.allVendors()).subscribe({
      next: (vendor) => this.handleVendorSaved(vendor, true),
      error: () => {
        this.isSubmitting.set(false);
        this.formError.set('Failed to add vendor. Please try again.');
      },
    });
  }

  private handleVendorSaved(vendor: VendorAccount, isNew: boolean): void {
    if (isNew) {
      const updatedVendors = [vendor, ...this.allVendors()];
      this.allVendors.set(updatedVendors);

      const currentStats = this.stats();
      if (currentStats) {
        this.stats.set({
          ...currentStats,
          total: currentStats.total + 1,
          active: vendor.status === 'active' ? currentStats.active + 1 : currentStats.active,
          inactive: vendor.status === 'inactive' ? currentStats.inactive + 1 : currentStats.inactive,
          trial: vendor.status === 'trial' ? currentStats.trial + 1 : currentStats.trial,
        });
      }
    } else {
      const updatedVendors = this.allVendors().map((item) =>
        item.id === vendor.id ? vendor : item
      );
      this.allVendors.set(updatedVendors);
    }

    this.applyFilters();
    this.isSubmitting.set(false);
    this.isDrawerOpen.set(false);
    this.vendorForm = createEmptyVendorForm();
    this.editingVendorId.set(null);
    this.drawerMode.set('add');
  }
}
