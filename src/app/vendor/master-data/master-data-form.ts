import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiClientError } from '../../core/api/api.types';
import { MasterDataService } from '../services/master-data.service';

export type MasterDataType = 'categories' | 'metals';

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

  readonly mode = signal<'add' | 'edit'>('add');
  readonly type = signal<MasterDataType>('categories');
  readonly itemId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly pageError = signal('');

  formName = '';
  formStatus: 'active' | 'inactive' = 'active';

  ngOnInit(): void {
    const typeParam = (this.route.snapshot.queryParamMap.get('type') || 'categories') as MasterDataType;
    this.type.set(typeParam === 'metals' ? 'metals' : 'categories');

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.itemId.set(Number(idParam));
      this.loadItem(Number(idParam));
    }
  }

  entityLabel(): string {
    return this.type() === 'categories' ? 'Category' : 'Metal Type';
  }

  placeholder(): string {
    return this.type() === 'categories' ? 'e.g. Rings' : 'e.g. Gold';
  }

  goBack(): void {
    if (this.isSubmitting()) {
      return;
    }
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

    this.isSubmitting.set(true);
    this.formError.set('');
    const isCategory = this.type() === 'categories';
    const id = this.itemId();

    const request =
      this.mode() === 'edit' && id != null
        ? isCategory
          ? this.masterData.updateCategory(id, { name, status: this.formStatus })
          : this.masterData.updateMetalType(id, { name, status: this.formStatus })
        : isCategory
          ? this.masterData.createCategory(name, this.formStatus)
          : this.masterData.createMetalType(name, this.formStatus);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.goBack();
      },
      error: (err: unknown) => {
        this.formError.set(this.errMsg(err, 'Failed to save.'));
        this.isSubmitting.set(false);
      },
    });
  }

  private loadItem(id: number): void {
    this.isLoading.set(true);
    const request =
      this.type() === 'categories'
        ? this.masterData.getCategories()
        : this.masterData.getMetalTypes();

    request.subscribe({
      next: (items) => {
        const item = items.find((row) => row.id === id);
        if (!item) {
          this.pageError.set(`${this.entityLabel()} not found.`);
          this.isLoading.set(false);
          return;
        }
        this.formName = item.name;
        this.formStatus = item.status === 'inactive' ? 'inactive' : 'active';
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.pageError.set(this.errMsg(err, `Unable to load ${this.entityLabel().toLowerCase()}.`));
        this.isLoading.set(false);
      },
    });
  }

  private errMsg(err: unknown, fallback: string): string {
    return err instanceof ApiClientError ? err.message : fallback;
  }
}
