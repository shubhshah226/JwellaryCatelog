import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DataGridComponent } from '@common/components/data-grid/data-grid';
import {
  DataGridActionEvent,
  DataGridConfig,
} from '@common/components/data-grid/data-grid.types';
import { ToastService } from '@common/services/toast.service';
import { MasterDataItem, MasterDataService } from '../../services/master-data.service';

/** UI sections â€” categories use category APIs; others use /master/masterList. */
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
  },
};

const VALID_TABS = Object.keys(TAB_META) as MasterTab[];

@Component({
  selector: 'app-vendor-master-data',
  imports: [DataGridComponent],
  templateUrl: './master-data.html',
  styleUrls: ['../../shared/vendor-page.css', './master-data.css'],
})
export class VendorMasterData implements OnInit {
  private readonly masterData = inject(MasterDataService);
  private readonly toast = inject(ToastService);
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

  readonly gridConfig = computed<DataGridConfig<MasterDataItem>>(() => {
    const tab = this.activeTab();
    const meta = TAB_META[tab];
    const isCategories = tab === 'categories';

    const columns: DataGridConfig<MasterDataItem>['columns'] = [
      {
        key: 'name',
        header: meta.header,
        sortable: true,
        cellType: 'text',
        value: (row) => row.name,
        sortValue: (row) => row.name,
      },
    ];

    if (isCategories) {
      columns.push(
        {
          key: 'parentName',
          header: 'Parent',
          sortable: true,
          cellType: 'text',
          value: (row) => row.parentName || 'Top level',
          sortValue: (row) => row.parentName || '',
        },
        {
          key: 'sortOrder',
          header: 'Display order',
          sortable: true,
          cellType: 'text',
          value: (row) => (row.sortOrder != null ? row.sortOrder : 'â€”'),
          sortValue: (row) => row.sortOrder ?? Number.MAX_SAFE_INTEGER,
        }
      );
    }

    columns.push({
      key: 'status',
      header: 'Status',
      sortable: true,
      cellType: 'badge',
      value: (row) => row.status,
      badgeClass: (row) => `status-${row.status}`,
      sortValue: (row) => row.status,
    });

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
          searchFields: isCategories ? ['name', 'parentName'] : ['name'],
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
      columns,
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

  openAddPage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    void this.router.navigate(['/vendor/master-data/new'], {
      queryParams: { type: this.activeTab() },
    });
  }

  onGridAction(event: DataGridActionEvent<MasterDataItem>): void {
    if (event.actionId === 'edit') {
      this.openEditPage(event.row);
      return;
    }
    if (event.actionId === 'delete') {
      this.deleteItem(event.row);
    }
  }

  openEditPage(item: MasterDataItem): void {
    void this.router.navigate([`/vendor/master-data/${item.id}/edit`], {
      queryParams: { type: this.activeTab() },
    });
  }

  deleteItem(item: MasterDataItem): void {
    const label = TAB_META[this.activeTab()].label.toLowerCase();
    if (!confirm(`Remove ${label} "${item.name}"?`)) {
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
        this.toast.success(`${TAB_META[tab].label} removed successfully.`);
      },
    });
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
