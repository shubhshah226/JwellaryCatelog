import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataGridComponent } from '../../core/components/data-grid/data-grid';
import {
  DataGridActionEvent,
  DataGridConfig,
} from '../../core/components/data-grid/data-grid.types';
import { ToastService } from '../../core/services/toast.service';
import {
  ResetOwnerPasswordParamModel,
  UpdateTenantStatusParamModel,
  VendorAccount,
  VendorFormData,
  VendorLoginCredentials,
  VendorStats,
  createEmptyVendorForm,
} from '../../dashboard/models/vendor.model';
import { VendorService } from '../../dashboard/services/vendor.service';

type DrawerMode = 'add' | 'edit';
type CredentialsModalMode = 'created' | 'reset';

@Component({
  selector: 'app-vendors',
  imports: [FormsModule, DecimalPipe, DataGridComponent],
  templateUrl: './vendors.html',
  styleUrl: './vendors.css',
})
export class Vendors implements OnInit {
  private readonly vendorService = inject(VendorService);
  private readonly toastService = inject(ToastService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allVendors = signal<VendorAccount[]>([]);
  readonly stats = signal<VendorStats | null>(null);
  readonly isDrawerOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<DrawerMode>('add');
  readonly editingVendorId = signal<string | null>(null);
  readonly statusUpdatingId = signal<string | null>(null);
  readonly resetPasswordVendor = signal<VendorAccount | null>(null);
  readonly isResettingPassword = signal(false);
  readonly resetPasswordError = signal('');
  readonly createdCredentials = signal<VendorLoginCredentials | null>(null);
  readonly createdVendorName = signal('');
  readonly credentialsModalMode = signal<CredentialsModalMode>('created');

  vendorForm: VendorFormData = createEmptyVendorForm();
  resetPasswordForm = new ResetOwnerPasswordParamModel();
  categoryDraft = '';
  metalTypeDraft = '';
  purityDraft = '';
  colorDraft = '';

  readonly vendorGridConfig = computed<DataGridConfig<VendorAccount>>(() => ({
    rowId: 'id',
    selectable: false,
    entityLabel: 'vendors',
    emptyMessage: 'No vendors found matching your filters.',
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    filters: [
      {
        key: 'search',
        type: 'search',
        placeholder: 'Search vendors...',
        searchFields: ['name', 'email', 'phone', 'website', 'id', 'storeCode', 'contactPerson'],
      },
      {
        key: 'status',
        type: 'select',
        defaultValue: 'all',
        matchField: 'status',
        matchMode: 'equals',
        options: [
          { label: 'All Status', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      {
        key: 'joinedDate',
        type: 'date',
        placeholder: 'Joined Date',
        matchField: 'joinedOn',
      },
    ],
    columns: [
      {
        key: 'name',
        header: 'Vendor',
        sortable: true,
        cellType: 'avatar',
        value: (row) => row.name,
        subtitle: (row) => row.website,
        avatarText: (row) => row.initials,
      },
      {
        key: 'email',
        header: 'Contact',
        sortable: true,
        cellType: 'stack',
        value: (row) => row.email,
        subtitle: (row) => row.phone,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        cellType: 'badge',
        value: (row) => this.formatStatus(row.status),
        badgeClass: (row) => `status-${row.status}`,
        sortValue: (row) => row.status,
      },
      {
        key: 'joinedOn',
        header: 'Joined On',
        sortable: true,
        cellType: 'date',
        value: (row) => row.joinedOn,
        sortValue: (row) => row.joinedOn,
      },
    ],
    actions: [
      {
        id: 'edit',
        label: 'Edit',
        icon: 'fa-solid fa-pen',
      },
      {
        id: 'set-inactive',
        label: (row) => (this.statusUpdatingId() === row.id ? 'Updating...' : 'Set Inactive'),
        icon: 'fa-solid fa-ban',
        visible: (row) => row.status === 'active',
        disabled: (row) => this.statusUpdatingId() === row.id,
      },
      {
        id: 'set-active',
        label: (row) => (this.statusUpdatingId() === row.id ? 'Updating...' : 'Set Active'),
        icon: 'fa-solid fa-circle-check',
        visible: (row) => row.status !== 'active',
        disabled: (row) => this.statusUpdatingId() === row.id,
      },
      {
        id: 'reset-password',
        label: 'Reset Password',
        icon: 'fa-solid fa-key',
      },
    ],
  }));

  readonly drawerTitle = computed(() =>
    this.drawerMode() === 'edit' ? 'Edit Vendor' : 'Add Vendor'
  );

  readonly drawerSubtitle = computed(() =>
    this.drawerMode() === 'edit'
      ? 'Update jeweller account information.'
      : 'Create a jeweller account. Login credentials will be emailed automatically.'
  );

  readonly submitButtonLabel = computed(() => {
    if (this.isSubmitting()) {
      return 'Saving...';
    }

    return this.drawerMode() === 'edit' ? 'Update Vendor' : 'Add Vendor';
  });

  readonly credentialsModalTitle = computed(() =>
    this.credentialsModalMode() === 'reset'
      ? 'Owner password reset'
      : 'Vendor login created'
  );

  ngOnInit(): void {
    this.vendorService.getVendorsData().subscribe({
      next: ({ vendors, stats }) => {
        this.allVendors.set(vendors);
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load vendors. Please ensure the API is running on port 8400.');
        this.isLoading.set(false);
      },
    });
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  onBrandColorChange(value: string): void {
    const normalized = this.normalizeBrandColor(value);
    this.vendorForm.brandColor = normalized || '#8B0000';
  }

  brandColorPickerValue(): string {
    return this.normalizeBrandColor(this.vendorForm.brandColor) || '#8B0000';
  }

  private normalizeBrandColor(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    let hex = value.trim();
    if (!hex) {
      return '';
    }
    if (!hex.startsWith('#')) {
      hex = `#${hex}`;
    }
    const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
    if (short) {
      const [r, g, b] = short[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return hex.toLowerCase();
    }
    return '';
  }

  onGridAction(event: DataGridActionEvent<VendorAccount>): void {
    const vendor = event.row;
    switch (event.actionId) {
      case 'edit':
        this.openEditVendorDrawer(vendor);
        break;
      case 'set-active':
        this.changeVendorStatus(vendor, 'active');
        break;
      case 'set-inactive':
        this.changeVendorStatus(vendor, 'inactive');
        break;
      case 'reset-password':
        this.openResetPasswordModal(vendor);
        break;
    }
  }

  openAddVendorDrawer(): void {
    this.drawerMode.set('add');
    this.editingVendorId.set(null);
    this.vendorForm = createEmptyVendorForm();
    this.categoryDraft = '';
    this.metalTypeDraft = '';
    this.purityDraft = '';
    this.colorDraft = '';
    this.formError.set('');
    this.createdCredentials.set(null);
    this.isDrawerOpen.set(true);
  }

  openEditVendorDrawer(vendor: VendorAccount): void {
    this.drawerMode.set('edit');
    this.editingVendorId.set(vendor.id);
    this.vendorForm = this.vendorService.mapVendorToForm(vendor);
    this.formError.set('');
    this.isDrawerOpen.set(true);
  }

  changeVendorStatus(vendor: VendorAccount, uiStatus: 'active' | 'inactive'): void {
    if (this.statusUpdatingId()) {
      return;
    }

    const param = new UpdateTenantStatusParamModel();
    param.tenantId = vendor.id;
    param.accountStatus = uiStatus === 'inactive' ? 'suspended' : 'active';

    this.statusUpdatingId.set(vendor.id);
    this.vendorService.updateTenantStatus(param).subscribe({
      next: (result) => {
        const previousStatus = vendor.status;
        const updatedVendor: VendorAccount = {
          ...vendor,
          status: result.status,
          subscriptionType: result.status === 'inactive' ? 'expiry' : 'renewal',
        };

        this.allVendors.set(
          this.allVendors().map((item) => (item.id === vendor.id ? updatedVendor : item))
        );

        const currentStats = this.stats();
        if (currentStats && previousStatus !== result.status) {
          this.stats.set({
            ...currentStats,
            active:
              currentStats.active +
              (result.status === 'active' ? 1 : 0) -
              (previousStatus === 'active' ? 1 : 0),
            inactive:
              currentStats.inactive +
              (result.status === 'inactive' ? 1 : 0) -
              (previousStatus === 'inactive' ? 1 : 0),
          });
        }

        this.statusUpdatingId.set(null);
        this.toastService.success(
          result.message ||
            (result.status === 'active'
              ? 'Vendor set to active.'
              : 'Vendor set to inactive.')
        );
      },
      error: (err: unknown) => {
        this.statusUpdatingId.set(null);
        const message =
          err instanceof Error ? err.message : 'Unable to update vendor status.';
        this.toastService.error(message);
      },
    });
  }

  openResetPasswordModal(vendor: VendorAccount): void {
    this.resetPasswordError.set('');
    this.resetPasswordForm = new ResetOwnerPasswordParamModel();
    this.resetPasswordForm.tenantId = vendor.id;
    this.resetPasswordForm.newPassword = '';
    this.resetPasswordVendor.set(vendor);
  }

  closeResetPasswordModal(): void {
    if (this.isResettingPassword()) {
      return;
    }
    this.resetPasswordVendor.set(null);
    this.resetPasswordError.set('');
    this.resetPasswordForm = new ResetOwnerPasswordParamModel();
  }

  submitResetPassword(): void {
    const vendor = this.resetPasswordVendor();
    if (!vendor) {
      return;
    }

    const newPassword = this.resetPasswordForm.newPassword.trim();
    if (!newPassword) {
      this.resetPasswordError.set('Please enter a new password.');
      return;
    }

    const param = new ResetOwnerPasswordParamModel();
    param.tenantId = vendor.id;
    param.newPassword = newPassword;

    this.isResettingPassword.set(true);
    this.resetPasswordError.set('');

    this.vendorService.resetOwnerPassword(param).subscribe({
      next: (result) => {
        this.isResettingPassword.set(false);
        this.resetPasswordVendor.set(null);
        this.credentialsModalMode.set('reset');
        this.createdVendorName.set(vendor.name);
        this.createdCredentials.set({
          username: result.username || vendor.email,
          password: result.password,
          emailSent: false,
        });
        this.toastService.success(result.message || 'Owner password reset successfully.');
      },
      error: (err: unknown) => {
        this.isResettingPassword.set(false);
        const message =
          err instanceof Error ? err.message : 'Unable to reset owner password.';
        this.resetPasswordError.set(message);
        this.toastService.error(message);
      },
    });
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

  closeCredentialsModal(): void {
    this.createdCredentials.set(null);
    this.createdVendorName.set('');
    this.credentialsModalMode.set('created');
  }

  submitVendorForm(): void {
    if (!this.vendorForm.businessName.trim() || !this.vendorForm.ownerEmail.trim()) {
      this.formError.set('Please fill in business name and owner email.');
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
        next: (updatedVendor) => this.handleVendorSaved(updatedVendor),
        error: (err: Error) => {
          this.isSubmitting.set(false);
          this.formError.set(err.message || 'Failed to update vendor. Please try again.');
        },
      });

      return;
    }

    this.vendorService.createVendor(this.vendorForm).subscribe({
      next: ({ vendor, loginCredentials }) => {
        this.handleVendorSaved(vendor);
        if (loginCredentials) {
          this.credentialsModalMode.set('created');
          this.createdVendorName.set(vendor.name);
          this.createdCredentials.set(loginCredentials);
        }
      },
      error: (err: Error) => {
        this.isSubmitting.set(false);
        this.formError.set(err.message || 'Failed to add vendor. Please try again.');
      },
    });
  }

  addCategory(): void {
    this.pushUnique(this.vendorForm.categories, this.categoryDraft);
    this.categoryDraft = '';
  }

  removeCategory(index: number): void {
    this.vendorForm.categories.splice(index, 1);
  }

  addMetalType(): void {
    this.pushUnique(this.vendorForm.metalTypes, this.metalTypeDraft);
    this.metalTypeDraft = '';
  }

  removeMetalType(index: number): void {
    this.vendorForm.metalTypes.splice(index, 1);
  }

  addPurity(): void {
    this.pushUnique(this.vendorForm.purities, this.purityDraft);
    this.purityDraft = '';
  }

  removePurity(index: number): void {
    this.vendorForm.purities.splice(index, 1);
  }

  addColor(): void {
    this.pushUnique(this.vendorForm.colors, this.colorDraft);
    this.colorDraft = '';
  }

  removeColor(index: number): void {
    this.vendorForm.colors.splice(index, 1);
  }

  private pushUnique(list: string[], raw: string): void {
    const value = raw.trim();
    if (!value) {
      return;
    }
    const exists = list.some((item) => item.toLowerCase() === value.toLowerCase());
    if (!exists) {
      list.push(value);
    }
  }

  private handleVendorSaved(vendor: VendorAccount): void {
    const isNew = !this.allVendors().some((item) => item.id === vendor.id);
    if (isNew) {
      this.allVendors.set([vendor, ...this.allVendors()]);

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
      this.allVendors.set(
        this.allVendors().map((item) => (item.id === vendor.id ? vendor : item))
      );
    }

    this.isSubmitting.set(false);
    this.isDrawerOpen.set(false);
    this.vendorForm = createEmptyVendorForm();
    this.editingVendorId.set(null);
    this.drawerMode.set('add');
  }
}
