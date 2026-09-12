import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ApiClientError } from '../../core/api/api.types';
import { ToastService } from '../../core/services/toast.service';
import {
  AddCategoryParamModel,
  CategoryParamModel,
  MasterDataItem,
  MasterDataService,
} from '../services/master-data.service';

/** Same keys as Product Options sections. */
export type MasterDataType = 'categories' | 'metals' | 'purities' | 'colors';

const TYPE_META: Record<
  MasterDataType,
  {
    label: string;
    placeholder: string;
    masterType: string | null;
    titleAdd: string;
    titleEdit: string;
    help: string;
  }
> = {
  categories: {
    label: 'Category',
    placeholder: 'e.g. Ring',
    masterType: null,
    titleAdd: 'Add Category',
    titleEdit: 'Edit Category',
    help: 'Categories group your products (Ring, Chain, Pendant).',
  },
  metals: {
    label: 'Metal Type',
    placeholder: 'e.g. Gold',
    masterType: 'metal_type',
    titleAdd: 'Add Metal Type',
    titleEdit: 'Edit Metal Type',
    help: 'Metal types appear when you create a product.',
  },
  purities: {
    label: 'Purity',
    placeholder: 'e.g. 22K',
    masterType: 'purity',
    titleAdd: 'Add Purity',
    titleEdit: 'Edit Purity',
    help: 'Purity values like 22K or 18K for metal products.',
  },
  colors: {
    label: 'Color',
    placeholder: 'e.g. Rose Gold',
    masterType: 'color',
    titleAdd: 'Add Color',
    titleEdit: 'Edit Color',
    help: 'Colors such as Yellow, White, or Rose Gold.',
  },
};

const VALID_TYPES = Object.keys(TYPE_META) as MasterDataType[];

@Component({
  selector: 'app-vendor-master-data-form',
  imports: [FormsModule],
  templateUrl: './master-data-form.html',
  styleUrls: ['../shared/vendor-page.css', './master-data-form.css'],
})
export class VendorMasterDataForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly masterData = inject(MasterDataService);
  private readonly toast = inject(ToastService);

  readonly mode = signal<'add' | 'edit'>('add');
  readonly type = signal<MasterDataType>('categories');
  readonly itemId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly pageError = signal('');
  readonly parentOptions = signal<MasterDataItem[]>([]);
  /** Cached categories for unique sort-order checks */
  private existingCategories: MasterDataItem[] = [];

  formName = '';
  formStatus: 'active' | 'inactive' = 'active';
  /** Empty string = top-level (parentId null) */
  formParentId = '';
  formSortOrder: number | null = 1;

  ngOnInit(): void {
    const typeParam = (this.route.snapshot.queryParamMap.get('type') ||
      'categories') as MasterDataType;
    this.type.set(VALID_TYPES.includes(typeParam) ? typeParam : 'categories');

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.itemId.set(idParam);
      this.loadItem(idParam);
    } else if (this.type() === 'categories') {
      this.loadParentOptions();
      this.loadCategoriesForSortOrder();
    }
  }

  pageTitle(): string {
    const meta = TYPE_META[this.type()];
    return this.mode() === 'edit' ? meta.titleEdit : meta.titleAdd;
  }

  pageHelp(): string {
    return TYPE_META[this.type()].help;
  }

  entityLabel(): string {
    return TYPE_META[this.type()].label;
  }

  placeholder(): string {
    return TYPE_META[this.type()].placeholder;
  }

  goBack(): void {
    void this.router.navigate(['/vendor/master-data'], {
      queryParams: { tab: this.type() },
    });
  }

  submit(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError.set(`${this.entityLabel()} name is required.`);
      return;
    }

    const isCategory = this.type() === 'categories';
    const id = this.itemId();

    if (isCategory) {
      const sortOrder = this.formSortOrder;
      if (sortOrder == null || Number.isNaN(Number(sortOrder))) {
        this.formError.set('Display order is required.');
        return;
      }
      if (this.isSortOrderTaken(Number(sortOrder), id)) {
        this.formError.set(
          `Display order ${sortOrder} is already used. Choose a different number.`
        );
        return;
      }
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    const label = this.entityLabel();
    if (this.mode() === 'edit' && id != null) {
      this.runSave(this.buildUpdateRequest(id, name), `${label} updated successfully.`);
      return;
    }

    this.runSave(this.buildCreateRequest(name), `${label} added successfully.`);
  }

  private buildCreateRequest(name: string): Observable<MasterDataItem> {
    if (this.type() === 'categories') {
      const category = new CategoryParamModel();
      category.categoryName = name;
      category.parentId = this.formParentId || null;
      category.sortOrder = Number(this.formSortOrder);

      const param = new AddCategoryParamModel();
      param.tenantId = null;
      param.categories = [category];
      return this.masterData.createCategory(param);
    }

    const masterType = TYPE_META[this.type()].masterType!;
    return this.masterData.createMaster(masterType, name, this.formStatus);
  }

  private buildUpdateRequest(id: string, name: string): Observable<MasterDataItem> {
    if (this.type() === 'categories') {
      return this.masterData.updateCategory(id, {
        name,
        status: this.formStatus,
        parentId: this.formParentId || null,
        sortOrder: this.formSortOrder,
      });
    }
    return this.masterData.updateMaster(id, { name, status: this.formStatus });
  }

  private runSave(request: Observable<MasterDataItem>, successMessage: string): void {
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        this.toast.success(successMessage);
        this.goBack();
      },
      error: (err: unknown) => {
        const message = this.errMsg(err, 'Failed to save.');
        this.formError.set(message);
        this.toast.error(message);
      },
    });
  }

  private isSortOrderTaken(sortOrder: number, excludeId?: string | null): boolean {
    return this.existingCategories.some(
      (item) =>
        item.sortOrder != null &&
        Number(item.sortOrder) === sortOrder &&
        (!excludeId || item.id !== excludeId)
    );
  }

  private loadParentOptions(excludeId?: string | null): void {
    this.masterData.getParentCategoryOptions(excludeId).subscribe({
      next: (items) => this.parentOptions.set(items),
      error: () => this.parentOptions.set([]),
    });
  }

  private loadCategoriesForSortOrder(): void {
    this.masterData.getCategories().subscribe({
      next: (items) => {
        this.existingCategories = items;
        const max = items.reduce((acc, item) => Math.max(acc, item.sortOrder ?? 0), 0);
        this.formSortOrder = max + 1;
      },
      error: () => {
        this.existingCategories = [];
        this.formSortOrder = 1;
      },
    });
  }

  private loadListForType(): Observable<MasterDataItem[]> {
    switch (this.type()) {
      case 'metals':
        return this.masterData.getMetalTypes();
      case 'purities':
        return this.masterData.getPurities();
      case 'colors':
        return this.masterData.getColors();
      default:
        return this.masterData.getCategories();
    }
  }

  private loadItem(id: string): void {
    this.isLoading.set(true);
    this.loadListForType().subscribe({
      next: (items) => {
        if (this.type() === 'categories') {
          this.existingCategories = items;
        }
        const found = items.find((item) => item.id === id);
        if (!found) {
          this.pageError.set(`${this.entityLabel()} not found.`);
          this.isLoading.set(false);
          return;
        }
        this.formName = found.name;
        this.formStatus = found.status === 'inactive' ? 'inactive' : 'active';
        this.formParentId = found.parentId || '';
        this.formSortOrder = found.sortOrder ?? 1;
        if (this.type() === 'categories') {
          this.loadParentOptions(id);
        }
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.pageError.set(this.errMsg(err, 'Unable to load item.'));
        this.isLoading.set(false);
      },
    });
  }

  private errMsg(err: unknown, fallback: string): string {
    if (err instanceof ApiClientError) {
      return err.message || fallback;
    }
    if (err instanceof Error) {
      return err.message || fallback;
    }
    return fallback;
  }
}
