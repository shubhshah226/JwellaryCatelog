import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VendorAccount } from '../../dashboard/models/vendor.model';
import { VendorService } from '../../dashboard/services/vendor.service';
import {
  AppUser,
  AppUserRole,
  SortDirection,
  UserFormData,
  UserSortField,
  createEmptyUserForm,
} from '../models/user.model';
import { UserService } from '../services/user.service';

type DrawerMode = 'add' | 'edit';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class AdminUsers implements OnInit {
  private readonly userService = inject(UserService);
  private readonly vendorService = inject(VendorService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allUsers = signal<AppUser[]>([]);
  readonly vendors = signal<VendorAccount[]>([]);
  readonly isDrawerOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<DrawerMode>('add');
  readonly editingUserId = signal<number | null>(null);
  readonly openActionsMenuId = signal<number | null>(null);
  readonly menuPosition = signal<{ top: number; left: number } | null>(null);
  readonly sortColumn = signal<UserSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly searchQuery = signal('');
  readonly roleFilter = signal('all');

  userForm: UserFormData = createEmptyUserForm();

  readonly displayUsers = computed(() => {
    const filtered = this.userService.filterUsers(this.allUsers(), {
      search: this.searchQuery(),
      role: this.roleFilter(),
    });
    return this.userService.sortUsers(filtered, this.sortColumn(), this.sortDirection());
  });

  readonly adminCount = computed(
    () => this.displayUsers().filter((user) => user.role === 'admin').length
  );
  readonly vendorCount = computed(
    () => this.displayUsers().filter((user) => user.role === 'vendor').length
  );

  readonly drawerTitle = computed(() =>
    this.drawerMode() === 'edit' ? 'Edit User' : 'Add User'
  );

  readonly drawerSubtitle = computed(() =>
    this.drawerMode() === 'edit'
      ? 'Update user account details and access.'
      : 'Create a new platform user account.'
  );

  readonly submitButtonLabel = computed(() => {
    if (this.isSubmitting()) {
      return 'Saving...';
    }
    return this.drawerMode() === 'edit' ? 'Update User' : 'Add User';
  });

  ngOnInit(): void {
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.allUsers.set(users);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load users. Please ensure the API is running on port 8001.');
        this.isLoading.set(false);
      },
    });

    this.vendorService.getVendorsData().subscribe({
      next: ({ vendors }) => this.vendors.set(vendors),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDrawerOpen()) {
      this.closeDrawer();
    } else {
      this.closeActionsMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.actions-menu-wrap') || target.closest('.actions-dropdown-fixed')) {
      return;
    }
    this.closeActionsMenu();
  }

  closeActionsMenu(): void {
    this.openActionsMenuId.set(null);
    this.menuPosition.set(null);
  }

  getActiveUser(userId: number): AppUser | undefined {
    return this.displayUsers().find((user) => user.id === userId);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  onRoleFilterChange(value: string): void {
    this.roleFilter.set(value);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set('all');
  }

  toggleSort(column: UserSortField): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }

    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  sortIndicator(column: UserSortField): 'none' | 'asc' | 'desc' {
    if (this.sortColumn() !== column) {
      return 'none';
    }
    return this.sortDirection();
  }

  toggleActionsMenu(userId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.openActionsMenuId() === userId) {
      this.closeActionsMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 140;
    const menuHeight = 92;
    const gap = 6;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap;
    }

    this.menuPosition.set({
      top: Math.max(8, top),
      left: Math.max(8, rect.right - menuWidth),
    });
    this.openActionsMenuId.set(userId);
  }

  openAddUserDrawer(): void {
    this.drawerMode.set('add');
    this.editingUserId.set(null);
    this.userForm = createEmptyUserForm();
    this.formError.set('');
    this.closeActionsMenu();
    this.isDrawerOpen.set(true);
  }

  openEditUserDrawer(user: AppUser, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.drawerMode.set('edit');
    this.editingUserId.set(user.id);
    this.userForm = this.userService.mapUserToForm(user);
    this.formError.set('');
    this.closeActionsMenu();
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.formError.set('');
    this.isSubmitting.set(false);
    this.editingUserId.set(null);
  }

  onRoleChange(role: AppUserRole): void {
    this.userForm.role = role;
    if (role !== 'vendor') {
      this.userForm.vendorId = '';
    }
  }

  submitUser(): void {
    if (!this.userForm.firstName.trim() || !this.userForm.lastName.trim()) {
      this.formError.set('First name and last name are required.');
      return;
    }

    if (!this.userForm.username.trim()) {
      this.formError.set('Username is required.');
      return;
    }

    if (!this.userForm.email.trim()) {
      this.formError.set('Email is required.');
      return;
    }

    if (this.drawerMode() === 'add' && !this.userForm.password.trim()) {
      this.formError.set('Password is required for new users.');
      return;
    }

    if (this.userForm.role === 'vendor' && !this.userForm.vendorId) {
      this.formError.set('Please select a vendor for vendor users.');
      return;
    }

    const username = this.userForm.username.trim().toLowerCase();
    const editingId = this.editingUserId();
    const usernameExists = this.allUsers().some(
      (user) => user.username.toLowerCase() === username && user.id !== editingId
    );

    if (usernameExists) {
      this.formError.set('A user with this username already exists.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.drawerMode() === 'edit' && editingId) {
      const existing = this.allUsers().find((user) => user.id === editingId);
      if (!existing) {
        this.formError.set('User not found.');
        this.isSubmitting.set(false);
        return;
      }

      this.userService
        .updateUser(existing, this.userForm, this.userForm.password)
        .subscribe({
          next: (updated) => {
            this.allUsers.set(
              this.allUsers().map((user) => (user.id === updated.id ? updated : user))
            );
            this.closeDrawer();
          },
          error: () => {
            this.formError.set('Unable to update user. Please try again.');
            this.isSubmitting.set(false);
          },
        });
      return;
    }

    this.userService.createUser(this.userForm, this.allUsers()).subscribe({
      next: (user) => {
        this.allUsers.set([...this.allUsers(), user]);
        this.closeDrawer();
      },
      error: () => {
        this.formError.set('Unable to save user. Please try again.');
        this.isSubmitting.set(false);
      },
    });
  }

  deleteUser(user: AppUser, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeActionsMenu();

    const confirmed = confirm(`Delete user "${user.name}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.allUsers.set(this.allUsers().filter((item) => item.id !== user.id));
      },
      error: () => {
        alert('Unable to delete user. Please try again.');
      },
    });
  }

  getInitials(user: AppUser): string {
    return `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase();
  }

  formatRole(role: string): string {
    return role === 'admin' ? 'Super Admin' : 'Vendor';
  }

  getVendorName(vendorId?: number): string {
    if (!vendorId) {
      return '-';
    }
    return this.vendors().find((vendor) => vendor.id === vendorId)?.name ?? `Vendor #${vendorId}`;
  }
}
