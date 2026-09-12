import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import {
  AppRole,
  RoleFormData,
  RoleSortField,
  SortDirection,
  createEmptyRoleForm,
} from '../models/role.model';
import { RoleService } from '../services/role.service';

type DrawerMode = 'add' | 'edit';

@Component({
  selector: 'app-admin-roles',
  imports: [FormsModule],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
})
export class AdminRoles implements OnInit, OnDestroy, AfterViewChecked {
  private readonly roleService = inject(RoleService);
  private readonly toast = inject(ToastService);

  @ViewChild('actionsPortal')
  private actionsPortal?: ElementRef<HTMLElement>;

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly allRoles = signal<AppRole[]>([]);
  readonly isDrawerOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly drawerMode = signal<DrawerMode>('add');
  readonly editingRoleId = signal<number | null>(null);
  readonly openActionsMenuId = signal<number | null>(null);
  readonly menuPosition = signal<{ top: number; left: number } | null>(null);
  readonly sortColumn = signal<RoleSortField>('name');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly searchQuery = signal('');
  readonly statusFilter = signal('all');
  private portalPinnedToBody = false;
  private readonly onAnyScroll = (): void => {
    if (this.openActionsMenuId()) {
      this.closeActionsMenu();
    }
  };

  roleForm: RoleFormData = createEmptyRoleForm();

  readonly displayRoles = computed(() => {
    const filtered = this.roleService.filterRoles(this.allRoles(), {
      search: this.searchQuery(),
      status: this.statusFilter(),
    });
    return this.roleService.sortRoles(filtered, this.sortColumn(), this.sortDirection());
  });

  readonly activeCount = computed(
    () => this.displayRoles().filter((role) => role.status === 'active').length
  );

  readonly inactiveCount = computed(
    () => this.displayRoles().filter((role) => role.status === 'inactive').length
  );

  readonly drawerTitle = computed(() =>
    this.drawerMode() === 'edit' ? 'Edit Role' : 'Add Role'
  );

  readonly drawerSubtitle = computed(() =>
    this.drawerMode() === 'edit'
      ? 'Update role details and status.'
      : 'Create a new role for platform users.'
  );

  readonly submitButtonLabel = computed(() => {
    if (this.isSubmitting()) {
      return 'Saving...';
    }
    return this.drawerMode() === 'edit' ? 'Update Role' : 'Add Role';
  });

  ngOnInit(): void {
    document.addEventListener('scroll', this.onAnyScroll, true);
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.allRoles.set(roles);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(
          err instanceof Error
            ? err.message
            : 'Unable to load roles. Please ensure the API is running on port 8400.'
        );
        this.errorMessage.set('Unable to load roles.');
        this.isLoading.set(false);
      },
    });
  }

  ngAfterViewChecked(): void {
    this.pinActionsPortalToBody();
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onAnyScroll, true);
    this.detachActionsPortal();
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
    this.detachActionsPortal();
    this.openActionsMenuId.set(null);
    this.menuPosition.set(null);
  }

  private pinActionsPortalToBody(): void {
    const el = this.actionsPortal?.nativeElement;
    if (!el || !this.openActionsMenuId()) {
      return;
    }
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
      this.portalPinnedToBody = true;
    }
  }

  private detachActionsPortal(): void {
    const el = this.actionsPortal?.nativeElement;
    if (this.portalPinnedToBody && el?.parentElement === document.body) {
      el.remove();
    }
    this.portalPinnedToBody = false;
  }

  getActiveRole(roleId: number): AppRole | undefined {
    return this.displayRoles().find((role) => role.id === roleId);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
  }

  toggleSort(column: RoleSortField): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }

    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  sortIndicator(column: RoleSortField): string {
    if (this.sortColumn() !== column) {
      return 'fa-solid fa-sort';
    }
    return this.sortDirection() === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  toggleActionsMenu(roleId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.openActionsMenuId() === roleId) {
      this.closeActionsMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 104;
    const gap = 6;

    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    this.menuPosition.set({
      top: Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8)),
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
    this.openActionsMenuId.set(roleId);
  }

  openAddRoleDrawer(): void {
    this.drawerMode.set('add');
    this.editingRoleId.set(null);
    this.roleForm = createEmptyRoleForm();
    this.formError.set('');
    this.closeActionsMenu();
    this.isDrawerOpen.set(true);
  }

  openEditRoleDrawer(role: AppRole, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.drawerMode.set('edit');
    this.editingRoleId.set(role.id);
    this.roleForm = {
      name: role.name,
      code: role.code,
      description: role.description,
      status: role.status,
    };
    this.formError.set('');
    this.closeActionsMenu();
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.formError.set('');
    this.isSubmitting.set(false);
    this.editingRoleId.set(null);
  }

  submitRole(): void {
    if (!this.roleForm.name.trim()) {
      this.formError.set('Role name is required.');
      return;
    }

    if (!this.roleForm.code.trim()) {
      this.formError.set('Role code is required.');
      return;
    }

    const normalizedCode = this.roleService.normalizeCode(this.roleForm.code);
    const editingId = this.editingRoleId();
    const codeExists = this.allRoles().some(
      (role) => role.code === normalizedCode && role.id !== editingId
    );

    if (codeExists) {
      this.formError.set('A role with this code already exists.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.drawerMode() === 'edit' && editingId) {
      const existing = this.allRoles().find((role) => role.id === editingId);
      if (!existing) {
        this.formError.set('Role not found.');
        this.isSubmitting.set(false);
        return;
      }

      this.roleService.updateRole(existing, this.roleForm).subscribe({
        next: (updated) => {
          this.allRoles.set(
            this.allRoles().map((role) => (role.id === updated.id ? updated : role))
          );
          this.closeDrawer();
        },
        error: (err: unknown) => {
          this.toast.error(
            err instanceof Error ? err.message : 'Unable to update role. Please try again.'
          );
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    this.roleService.createRole(this.roleForm, this.allRoles()).subscribe({
      next: (role) => {
        this.allRoles.set([...this.allRoles(), role]);
        this.closeDrawer();
      },
      error: (err: unknown) => {
        this.toast.error(
          err instanceof Error ? err.message : 'Unable to save role. Please try again.'
        );
        this.isSubmitting.set(false);
      },
    });
  }

  deleteRole(role: AppRole, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeActionsMenu();

    if (role.isSystem) {
      return;
    }

    const confirmed = confirm(`Delete role "${role.name}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.roleService.deleteRole(role.id).subscribe({
      next: () => {
        this.allRoles.set(this.allRoles().filter((item) => item.id !== role.id));
      },
      error: (err: unknown) => {
        this.toast.error(
          err instanceof Error ? err.message : 'Unable to delete role. Please try again.'
        );
      },
    });
  }

  formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
