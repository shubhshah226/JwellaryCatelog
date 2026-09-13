import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize, forkJoin, of, switchMap } from 'rxjs';
import { DataGridComponent } from '@common/components/data-grid/data-grid';
import {
  DataGridActionEvent,
  DataGridConfig,
} from '@common/components/data-grid/data-grid.types';
import { ConfirmDialogService } from '@common/services/confirm-dialog.service';
import { ToastService } from '@common/services/toast.service';
import {
  AddCategoryParamModel,
  CategoryParamModel,
  MasterDataItem,
  MasterDataService,
} from '../../services/master-data.service';

/** UI sections — categories use category APIs; others use /master/masterList. */
export type MasterTab = 'categories' | 'metals' | 'purities' | 'colors';

interface TabMeta {
  label: string;
  plural: string;
  header: string;
  title: string;
  description: string;
  example: string;
  addLabel: string;
  icon: string;
  placeholder: string;
  masterType: string | null;
}

const TAB_META: Record<MasterTab, TabMeta> = {
  categories: {
    label: 'Category',
    plural: 'categories',
    header: 'Category',
    title: 'Categories',
    description: 'Product groups like Ring, Chain, Pendant. Used when you add products.',
    example: 'Examples: Ring, Necklace, Bracelet',
    addLabel: '+ Add Category',
    icon: 'fa-solid fa-tags',
    placeholder: 'e.g. Ring',
    masterType: null,
  },
  metals: {
    label: 'Metal Type',
    plural: 'metal types',
    header: 'Metal Type',
    title: 'Metal Types',
    description: 'Metal used in jewellery. Shown in product forms and filters.',
    example: 'Examples: Gold, Silver, Platinum',
    addLabel: '+ Add Metal Type',
    icon: 'fa-solid fa-coins',
    placeholder: 'e.g. Gold',
    masterType: 'metal_type',
  },
  purities: {
    label: 'Purity',
    plural: 'purities',
    header: 'Purity',
    title: 'Purities',
    description: 'Purity / karat values for metal products.',
    example: 'Examples: 22K, 18K, 925',
    addLabel: '+ Add Purity',
    icon: 'fa-solid fa-certificate',
    placeholder: 'e.g. 22K',
    masterType: 'purity',
  },
  colors: {
    label: 'Color',
    plural: 'colors',
    header: 'Color',
    title: 'Colors',
    description: 'Metal or stone colors shown on products.',
    example: 'Examples: Yellow, Rose Gold, White',
    addLabel: '+ Add Color',
    icon: 'fa-solid fa-palette',
    placeholder: 'e.g. Rose Gold',
    masterType: 'color',
  },
};

const VALID_TABS = Object.keys(TAB_META) as MasterTab[];

@Component({
  selector: 'app-vendor-master-data',
  imports: [FormsModule, DataGridComponent],
  templateUrl: './master-data.html',
  styleUrls: ['../../shared/vendor-page.css', './master-data.css'],
})
export class VendorMasterData implements OnInit {
  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;

  private readonly masterData = inject(MasterDataService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tabs = VALID_TABS;
  readonly activeTab = signal<MasterTab>('categories');
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly categories = signal<MasterDataItem[]>([]);
  readonly metalTypes = signal<MasterDataItem[]>([]);
  readonly purities = signal<MasterDataItem[]>([]);
  readonly colors = signal<MasterDataItem[]>([]);

  readonly formOpen = signal(false);
  readonly formMode = signal<'add' | 'edit'>('add');
  readonly editingId = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');

  formName = '';
  formIsActive = true;

  readonly activeRows = computed(() => {
    switch (this.activeTab()) {
      case 'metals':
        return this.metalTypes();
      case 'purities':
        return this.purities();
      case 'colors':
        return this.colors();
      default:
        return this.categories();
    }
  });

  readonly activeMeta = computed(() => TAB_META[this.activeTab()]);

  readonly totalCount = computed(() => this.activeRows().length);

  readonly activeCount = computed(
    () => this.activeRows().filter((i) => i.status === 'active').length
  );

  readonly formTitle = computed(() => {
    const label = this.activeMeta().label;
    return this.formMode() === 'edit' ? `Edit ${label}` : `Add ${label}`;
  });

  readonly gridConfig = computed<DataGridConfig<MasterDataItem>>(() => {
    const meta = TAB_META[this.activeTab()];

    return {
      rowId: 'id',
      selectable: false,
      entityLabel: meta.plural,
      emptyMessage: `No ${meta.plural} yet. Click "${meta.addLabel}" to create one.`,
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50],
      filters: [
        {
          key: 'search',
          type: 'search',
          placeholder: `Search ${meta.plural}...`,
          searchFields: ['name'],
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
      ],
      columns: [
        {
          key: 'name',
          header: meta.header,
          sortable: true,
          cellType: 'text',
          value: (row) => row.name,
          sortValue: (row) => row.name,
        },
        {
          key: 'status',
          header: 'Status',
          sortable: true,
          cellType: 'badge',
          value: (row) => row.status,
          badgeClass: (row) => `status-${row.status}`,
          sortValue: (row) => row.status,
        },
      ],
      actions: [
        { id: 'edit', label: 'Edit', icon: 'fa-solid fa-pen' },
        { id: 'delete', label: 'Delete', icon: 'fa-solid fa-trash' },
      ],
    };
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as MasterTab | null;
    if (tab && VALID_TABS.includes(tab)) {
      this.activeTab.set(tab);
    }
    this.loadAll();
  }

  tabMeta(tab: MasterTab): TabMeta {
    return TAB_META[tab];
  }

  tabCount(tab: MasterTab): number {
    switch (tab) {
      case 'metals':
        return this.metalTypes().length;
      case 'purities':
        return this.purities().length;
      case 'colors':
        return this.colors().length;
      default:
        return this.categories().length;
    }
  }

  setTab(tab: MasterTab): void {
    this.activeTab.set(tab);
    this.closeForm();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      categories: this.masterData.getCategories(),
      metals: this.masterData.getMetalTypes(),
      purities: this.masterData.getPurities(),
      colors: this.masterData.getColors(),
    }).subscribe({
      next: (data) => {
        this.categories.set(data.categories);
        this.metalTypes.set(data.metals);
        this.purities.set(data.purities);
        this.colors.set(data.colors);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load product options.');
        this.isLoading.set(false);
      },
    });
  }

  openAddForm(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.formMode.set('add');
    this.editingId.set(null);
    this.formName = '';
    this.formIsActive = true;
    this.formError.set('');
    this.formOpen.set(true);
    this.focusNameInput(false);
  }

  openEditForm(item: MasterDataItem): void {
    this.formMode.set('edit');
    this.editingId.set(item.id);
    this.formName = item.name;
    this.formIsActive = item.status !== 'inactive';
    this.formError.set('');
    this.formOpen.set(true);
    this.focusNameInput(true);
  }

  closeForm(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formError.set('');
    this.formName = '';
    this.formIsActive = true;
  }

  onGridAction(event: DataGridActionEvent<MasterDataItem>): void {
    if (event.actionId === 'edit') {
      this.openEditForm(event.row);
      return;
    }
    if (event.actionId === 'delete') {
      void this.deleteItem(event.row);
    }
  }

  submitForm(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError.set(`${this.activeMeta().label} name is required.`);
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const tab = this.activeTab();
    const label = TAB_META[tab].label;
    const status = this.formIsActive ? 'active' : 'inactive';
    const editingId = this.editingId();

    const request =
      this.formMode() === 'edit' && editingId
        ? this.buildUpdateRequest(tab, editingId, name, status)
        : this.buildCreateRequest(tab, name, status);

    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (saved) => {
        this.upsertInList(tab, saved);
        this.toast.success(
          this.formMode() === 'edit'
            ? `${label} updated successfully.`
            : `${label} added successfully.`
        );
        this.isSubmitting.set(false);
        this.closeForm();
      },
    });
  }

  async deleteItem(item: MasterDataItem): Promise<void> {
    const label = TAB_META[this.activeTab()].label;
    const confirmed = await this.confirmDialog.confirm({
      title: `Delete ${label}`,
      message: `Are you sure you want to delete "${item.name}"? This will deactivate it from product options.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    const tab = this.activeTab();
    const request =
      tab === 'categories'
        ? this.masterData.deleteCategory(item.id)
        : tab === 'metals'
          ? this.masterData.deleteMetalType(item.id)
          : tab === 'purities'
            ? this.masterData.deletePurity(item.id)
            : this.masterData.deleteColor(item.id);

    request.subscribe({
      next: () => {
        this.removeFromList(tab, item.id);
        if (this.editingId() === item.id) {
          this.isSubmitting.set(false);
          this.closeForm();
        }
        this.toast.success(`${TAB_META[tab].label} removed successfully.`);
      },
    });
  }

  private focusNameInput(selectText: boolean): void {
    setTimeout(() => {
      const input = this.nameInput?.nativeElement;
      if (!input) {
        return;
      }
      input.focus();
      if (selectText) {
        input.select();
      }
      input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }

  private buildCreateRequest(
    tab: MasterTab,
    name: string,
    status: 'active' | 'inactive'
  ): Observable<MasterDataItem> {
    if (tab === 'categories') {
      const category = new CategoryParamModel();
      category.categoryName = name;
      category.parentId = null;
      category.sortOrder = null;

      const param = new AddCategoryParamModel();
      param.tenantId = null;
      param.categories = [category];

      return this.masterData.createCategory(param).pipe(
        switchMap((created) => {
          if (status === 'active') {
            return of(created);
          }
          return this.masterData.updateCategory(created.id, { name, status });
        })
      );
    }

    const masterType = TAB_META[tab].masterType!;
    return this.masterData.createMaster(masterType, name, status).pipe(
      switchMap((created) => {
        if (status === 'active') {
          return of(created);
        }
        return this.masterData.updateMaster(created.id, { name, status });
      })
    );
  }

  private buildUpdateRequest(
    tab: MasterTab,
    id: string,
    name: string,
    status: 'active' | 'inactive'
  ): Observable<MasterDataItem> {
    if (tab === 'categories') {
      return this.masterData.updateCategory(id, {
        name,
        status,
        parentId: null,
        sortOrder: null,
      });
    }
    return this.masterData.updateMaster(id, { name, status });
  }

  private upsertInList(tab: MasterTab, item: MasterDataItem): void {
    const upsert = (list: MasterDataItem[]) => {
      const index = list.findIndex((row) => row.id === item.id);
      if (index === -1) {
        return [item, ...list];
      }
      const next = [...list];
      next[index] = { ...list[index], ...item };
      return next;
    };

    switch (tab) {
      case 'metals':
        this.metalTypes.update(upsert);
        break;
      case 'purities':
        this.purities.update(upsert);
        break;
      case 'colors':
        this.colors.update(upsert);
        break;
      default:
        this.categories.update(upsert);
    }
  }

  private removeFromList(tab: MasterTab, id: string): void {
    const drop = (list: MasterDataItem[]) => list.filter((i) => i.id !== id);
    switch (tab) {
      case 'metals':
        this.metalTypes.update(drop);
        break;
      case 'purities':
        this.purities.update(drop);
        break;
      case 'colors':
        this.colors.update(drop);
        break;
      default:
        this.categories.update(drop);
    }
  }
}
