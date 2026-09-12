import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PRODUCT_STOCK_STATUSES,
  ProductFormData,
  createEmptyProductForm,
} from '../../dashboard/models/dashboard.model';
import { ToastService } from '../../core/services/toast.service';
import { MasterDataItem, MasterDataService } from '../services/master-data.service';
import { ProductExistingImage, ProductService } from '../services/product.service';

type PhotoSlot =
  | { kind: 'existing'; imageId: string }
  | { kind: 'new'; dataUrl: string };

@Component({
  selector: 'app-vendor-product-form',
  imports: [FormsModule],
  templateUrl: './product-form.html',
  styleUrls: ['../shared/vendor-page.css', './product-form.css'],
})
export class VendorProductForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly masterDataService = inject(MasterDataService);
  private readonly toast = inject(ToastService);

  readonly mode = signal<'add' | 'edit'>('add');
  readonly productId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly pageError = signal('');
  readonly categories = signal<MasterDataItem[]>([]);
  readonly metalTypes = signal<MasterDataItem[]>([]);
  readonly purities = signal<MasterDataItem[]>([]);
  readonly colors = signal<MasterDataItem[]>([]);
  readonly photoSlots = signal<PhotoSlot[]>([]);
  readonly dragPhotoIndex = signal<number | null>(null);
  readonly existingImageCount = signal(0);

  private initialExistingIds = new Set<string>();

  productForm: ProductFormData = createEmptyProductForm();
  readonly stockStatuses = PRODUCT_STOCK_STATUSES;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.productId.set(idParam);
    }

    this.masterDataService.getCategories().subscribe({
      next: (items) => {
        this.categories.set(items);
        if (this.mode() === 'add' && !this.productForm.categoryId) {
          const first = items.find((c) => c.status === 'active');
          if (first) {
            this.productForm.categoryId = first.id;
            this.productForm.category = first.name;
          }
        }
      },
    });
    this.masterDataService.getMetalTypes().subscribe({
      next: (items) => {
        this.metalTypes.set(items);
        if (this.mode() === 'add' && !this.productForm.metalTypeId) {
          const first = items.find((m) => m.status === 'active');
          if (first) {
            this.productForm.metalTypeId = first.id;
            this.productForm.metalType = first.name;
          }
        }
      },
    });
    this.masterDataService.getPurities().subscribe({
      next: (items) => this.purities.set(items),
    });
    this.masterDataService.getColors().subscribe({
      next: (items) => this.colors.set(items),
    });

    if (this.mode() === 'edit' && this.productId()) {
      this.loadProduct(this.productId()!);
    } else {
      this.resetForAdd();
      this.isLoading.set(false);
    }
  }

  categoryOptionsForForm(): MasterDataItem[] {
    return this.optionsWithLegacy(this.categories(), this.productForm.categoryId, this.productForm.category);
  }

  metalOptionsForForm(): MasterDataItem[] {
    return this.optionsWithLegacy(this.metalTypes(), this.productForm.metalTypeId, this.productForm.metalType);
  }

  purityOptionsForForm(): MasterDataItem[] {
    return this.optionsWithLegacy(this.purities(), this.productForm.purityId, this.productForm.purity);
  }

  colorOptionsForForm(): MasterDataItem[] {
    return this.optionsWithLegacy(this.colors(), this.productForm.colorId, this.productForm.color);
  }

  onCategoryChange(id: string): void {
    this.productForm.categoryId = id || null;
    this.productForm.category = this.categories().find((c) => c.id === id)?.name || '';
  }

  onMetalChange(id: string): void {
    this.productForm.metalTypeId = id || null;
    this.productForm.metalType = this.metalTypes().find((m) => m.id === id)?.name || '';
  }

  onPurityChange(id: string): void {
    this.productForm.purityId = id || null;
    this.productForm.purity = this.purities().find((p) => p.id === id)?.name || '';
  }

  onColorChange(id: string): void {
    this.productForm.colorId = id || null;
    this.productForm.color = this.colors().find((c) => c.id === id)?.name || '';
  }

  goBack(): void {
    if (this.isSubmitting()) {
      return;
    }
    void this.router.navigateByUrl('/vendor/products');
  }

  submitProduct(): void {
    this.syncNamesFromIds();

    if (!this.productForm.name.trim()) {
      this.toast.error('Product name is required.');
      return;
    }
    if (!this.productForm.categoryId && !this.productForm.category) {
      this.toast.error('Please select a category from Product Options.');
      return;
    }
    if (!this.productForm.metalTypeId && !this.productForm.metalType) {
      this.toast.error('Please select a metal type from Product Options.');
      return;
    }
    if (!this.productForm.sku.trim()) {
      this.toast.error('Product code (SKU) is required.');
      return;
    }
    const weightNum = Number(String(this.productForm.weight).replace(/[^\d.]/g, ''));
    if (!this.productForm.weight.trim() || !Number.isFinite(weightNum) || weightNum <= 0) {
      this.toast.error('Weight in grams is required.');
      return;
    }

    const slots = this.photoSlots();
    if (!slots.length) {
      this.toast.error('Please upload at least one photo (first image is the cover).');
      return;
    }

    this.applyNewPhotosToForm(slots);
    this.isSubmitting.set(true);

    if (this.mode() === 'edit' && this.productId()) {
      const currentExistingIds = slots
        .filter((s): s is Extract<PhotoSlot, { kind: 'existing' }> => s.kind === 'existing')
        .map((s) => s.imageId);
      const removedImageIds = [...this.initialExistingIds].filter(
        (id) => !currentExistingIds.includes(id)
      );
      const newImageFiles = this.productService.collectImageFiles(this.productForm);
      const cover = slots[0];
      const primaryImageId = cover?.kind === 'existing' ? cover.imageId : null;

      this.productService
        .updateProduct(this.productId()!, this.productForm, {
          newImageFiles,
          removedImageIds,
          primaryImageId,
          preferFirstNewAsPrimary: cover?.kind === 'new',
        })
        .subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.toast.success('Product updated successfully.');
            void this.router.navigateByUrl('/vendor/products');
          },
          error: (err: Error) => {
            this.toast.error(err.message || 'Failed to update product.');
            this.isSubmitting.set(false);
          },
        });
      return;
    }

    this.productService.createProduct(this.productForm).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.success('Product added successfully.');
        void this.router.navigateByUrl('/vendor/products');
      },
      error: (err: Error) => {
        this.toast.error(err.message || 'Failed to add product.');
        this.isSubmitting.set(false);
      },
    });
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }
    Array.from(files).forEach((file) => {
      this.readFileAsBase64(file, (base64) => {
        this.photoSlots.update((slots) => [...slots, { kind: 'new', dataUrl: base64 }]);
      });
    });
    input.value = '';
  }

  removePhoto(index: number): void {
    this.photoSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  onPhotoDragStart(index: number, event: DragEvent): void {
    this.dragPhotoIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onPhotoDrop(toIndex: number, event: DragEvent): void {
    event.preventDefault();
    const fromIndex = this.dragPhotoIndex();
    this.dragPhotoIndex.set(null);
    if (fromIndex == null || fromIndex === toIndex) {
      return;
    }
    const photos = [...this.photoSlots()];
    const [moved] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, moved);
    this.photoSlots.set(photos);
  }

  onPhotoDragEnd(): void {
    this.dragPhotoIndex.set(null);
  }

  movePhoto(fromIndex: number, toIndex: number): void {
    const photos = [...this.photoSlots()];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= photos.length || toIndex >= photos.length) {
      return;
    }
    const [moved] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, moved);
    this.photoSlots.set(photos);
  }

  photoPreview(slot: PhotoSlot): string {
    if (slot.kind === 'new') {
      return slot.dataUrl;
    }
    return this.productService.panelImageUrl(slot.imageId, 'grid');
  }

  isExistingPhoto(slot: PhotoSlot): boolean {
    return slot.kind === 'existing';
  }

  private applyNewPhotosToForm(slots: PhotoSlot[]): void {
    const newUrls = slots
      .filter((s): s is Extract<PhotoSlot, { kind: 'new' }> => s.kind === 'new')
      .map((s) => s.dataUrl);
    this.productForm.imageUrl = newUrls[0] ?? '';
    this.productForm.galleryImages = newUrls.slice(1);
    this.productForm.images = newUrls;
  }

  private syncNamesFromIds(): void {
    if (this.productForm.categoryId) {
      this.productForm.category =
        this.categories().find((c) => c.id === this.productForm.categoryId)?.name ||
        this.productForm.category;
    }
    if (this.productForm.metalTypeId) {
      this.productForm.metalType =
        this.metalTypes().find((m) => m.id === this.productForm.metalTypeId)?.name ||
        this.productForm.metalType;
    }
    if (this.productForm.purityId) {
      this.productForm.purity =
        this.purities().find((p) => p.id === this.productForm.purityId)?.name ||
        this.productForm.purity;
    }
    if (this.productForm.colorId) {
      this.productForm.color =
        this.colors().find((c) => c.id === this.productForm.colorId)?.name ||
        this.productForm.color;
    }
  }

  private optionsWithLegacy(
    items: MasterDataItem[],
    currentId: string | null,
    currentName: string
  ): MasterDataItem[] {
    const active = items.filter((i) => i.status === 'active');
    if (currentId && !active.some((i) => i.id === currentId)) {
      return [
        {
          id: currentId,
          vendorId: null,
          name: currentName || 'Previously selected',
          status: 'active',
        },
        ...active,
      ];
    }
    return active;
  }

  private resetForAdd(): void {
    this.productForm = createEmptyProductForm();
    const cats = this.categories().filter((c) => c.status === 'active');
    const metals = this.metalTypes().filter((m) => m.status === 'active');
    if (cats.length) {
      this.productForm.categoryId = cats[0].id;
      this.productForm.category = cats[0].name;
    }
    if (metals.length) {
      this.productForm.metalTypeId = metals[0].id;
      this.productForm.metalType = metals[0].name;
    }
    this.photoSlots.set([]);
    this.initialExistingIds = new Set();
    this.existingImageCount.set(0);
  }

  private loadProduct(id: string): void {
    this.productService.getProductDetail(id).subscribe({
      next: ({ product, images }) => {
        this.productForm = this.productService.mapToForm(product);
        const slots: PhotoSlot[] = images.map((img: ProductExistingImage) => ({
          kind: 'existing' as const,
          imageId: img.imageId,
        }));
        this.photoSlots.set(slots);
        this.initialExistingIds = new Set(images.map((i) => i.imageId));
        this.existingImageCount.set(images.length);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toast.error(err.message || 'Unable to load product.');
        this.pageError.set('Unable to load product.');
        this.isLoading.set(false);
      },
    });
  }

  private readFileAsBase64(file: File, onDone: (base64: string) => void): void {
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please select an image file.');
      return;
    }
    if (file.size > 5_000_000) {
      this.toast.error('Each image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        onDone(result);
      }
    };
    reader.onerror = () => {
      this.toast.error('Could not read image file.');
    };
    reader.readAsDataURL(file);
  }
}
