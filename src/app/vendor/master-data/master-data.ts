import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiClientError } from '../../core/api/api.types';
import { MasterDataItem, MasterDataService } from '../services/master-data.service';

type MasterTab = 'categories' | 'metals';
type SortKey = 'name' | 'status' | 'id';

@Component({
  selector: 'app-vendor-master-data',
  imports: [FormsModule],
  templateUrl: './master-data.html',
  styleUrls: ['../shared/vendor-page.css', './master-data.css'],
})
export class VendorMasterData implements OnInit {
  private readonly masterData = inject(MasterDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = signal<MasterTab>('categories');
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly categories = signal<MasterDataItem[]>([]);
  readonly metalTypes = signal<MasterDataItem[]>([]);
  readonly openMenuId = signal<number | null>(null);

  readonly search = signal('');
  readonly status = signal('all');
  readonly sortBy = signal<SortKey>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly filteredItems = computed(() => {
    const source =
      this.activeTab() === 'categories' ? this.categories() : this.metalTypes();
    return this.masterData.filterItems(
      source,
      this.search(),
      this.status(),
      this.sortBy(),
      this.sortDir()
    );
  });

  readonly activeCount = computed(
    () => this.filteredItems().filter((i) => i.status === 'active').length
  );

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'metals' || tab === 'categories') {
      this.activeTab.set(tab);
    }
    this.loadAll();
  }

  setTab(tab: MasterTab): void {
    this.activeTab.set(tab);
    this.openMenuId.set(null);
    this.search.set('');
    this.status.set('all');
    this.sortBy.set('name');
    this.sortDir.set('asc');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  toggleSort(column: SortKey): void {
    if (this.sortBy() === column) {
      this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
  }

  sortIcon(column: SortKey): string {
    if (this.sortBy() !== column) {
      return 'fa-solid fa-sort';
    }
    return this.sortDir() === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isLoading.set(false);
      }
    };

    this.masterData.getCategories().subscribe({
      next: (items) => {
        this.categories.set(items);
        done();
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.errMsg(err, 'Unable to load categories.'));
        done();
      },
    });

    this.masterData.getMetalTypes().subscribe({
      next: (items) => {
        this.metalTypes.set(items);
        done();
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.errMsg(err, 'Unable to load metal types.'));
        done();
      },
    });
  }

  onSearchChange(value: string): void {
    this.search.set(value ?? '');
  }

  onStatusChange(value: string): void {
    this.status.set(value || 'all');
  }

  resetFilters(): void {
    this.search.set('');
    this.status.set('all');
    this.sortBy.set('name');
    this.sortDir.set('asc');
  }

  openAddPage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    void this.router.navigate(['/vendor/master-data/new'], {
      queryParams: { type: this.activeTab() },
    });
  }

  openEditPage(item: MasterDataItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    void this.router.navigate([`/vendor/master-data/${item.id}/edit`], {
      queryParams: { type: this.activeTab() },
    });
  }

  toggleMenu(event: MouseEvent, id: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  deleteItem(item: MasterDataItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openMenuId.set(null);
    const label = this.activeTab() === 'categories' ? 'category' : 'metal type';
    if (!confirm(`Delete ${label} "${item.name}"?`)) {
      return;
    }

    const request =
      this.activeTab() === 'categories'
        ? this.masterData.deleteCategory(item.id)
        : this.masterData.deleteMetalType(item.id);

    request.subscribe({
      next: () => {
        if (this.activeTab() === 'categories') {
          this.categories.update((list) => list.filter((i) => i.id !== item.id));
        } else {
          this.metalTypes.update((list) => list.filter((i) => i.id !== item.id));
        }
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.errMsg(err, 'Failed to delete.'));
      },
    });
  }

  entityLabel(): string {
    return this.activeTab() === 'categories' ? 'Category' : 'Metal Type';
  }

  private errMsg(err: unknown, fallback: string): string {
    return err instanceof ApiClientError ? err.message : fallback;
  }
}
