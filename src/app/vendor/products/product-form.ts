import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PRODUCT_STOCK_STATUSES,
  ProductFormData,
  createEmptyProductForm,
} from '../../dashboard/models/dashboard.model';
import { MasterDataItem, MasterDataService } from '../services/master-data.service';
import { ProductService } from '../services/product.service';

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

  readonly mode = signal<'add' | 'edit'>('add');
  readonly productId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly formError = signal('');
  readonly pageError = signal('');
  readonly categories = signal<MasterDataItem[]>([]);
  readonly metalTypes = signal<MasterDataItem[]>([]);
  readonly coverImage = signal('');
  readonly galleryImages = signal<string[]>([]);
  readonly dragPhotoIndex = signal<number | null>(null);

  productForm: ProductFormData = createEmptyProductForm();
  readonly stockStatuses = PRODUCT_STOCK_STATUSES;

  /** Ordered photos: index 0 is always cover. */
  allPhotos(): string[] {
    const cover = this.coverImage();
    return cover ? [cover, ...this.galleryImages()] : [...this.galleryImages()];
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.mode.set('edit');
      this.productId.set(idParam);
    }

    this.masterDataService.getCategories().subscribe({
      next: (items) => {
        this.categories.set(items);
        if (this.mode() === 'add' && !this.productForm.category) {
          const first = items.find((c) => c.status === 'active');
          if (first) {
            this.productForm.category = first.name;
          }
        }
      },
    });
    this.masterDataService.getMetalTypes().subscribe({
      next: (items) => {
        this.metalTypes.set(items);
        if (this.mode() === 'add' && !this.productForm.metalType) {
          const first = items.find((m) => m.status === 'active');
          if (first) {
            this.productForm.metalType = first.name;
          }
        }
      },
    });

    if (this.mode() === 'edit' && this.productId()) {
      this.loadProduct(this.productId()!);
    } else {
      this.resetForAdd();
      this.isLoading.set(false);
    }
  }

  categoryOptionsForForm(): MasterDataItem[] {
    const active = this.categories().filter((c) => c.status === 'active');
    const current = this.productForm.category;
    if (current && !active.some((c) => c.name === current)) {
      return [{ id: '__legacy__', vendorId: null, name: current, status: 'active' }, ...active];
    }
    return active;
  }

  metalOptionsForForm(): MasterDataItem[] {
    const active = this.metalTypes().filter((m) => m.status === 'active');
    const current = this.productForm.metalType;
    if (current && !active.some((m) => m.name === current)) {
      return [{ id: '__legacy__', vendorId: null, name: current, status: 'active' }, ...active];
    }
    return active;
  }

  goBack(): void {
    if (this.isSubmitting()) {
      return;
    }
    void this.router.navigateByUrl('/vendor/products');
  }

  submitProduct(): void {
    if (!this.productForm.name.trim()) {
      this.formError.set('Product name is required.');
      return;
    }
    if (!this.productForm.category) {
      this.formError.set('Please select a category from Master Data.');
      return;
    }
    if (!this.productForm.metalType) {
      this.formError.set('Please select a metal type from Master Data.');
      return;
    }

    this.productForm.imageUrl = this.coverImage();
    this.productForm.galleryImages = [...this.galleryImages()];
    this.productForm.images = this.coverImage()
      ? [this.coverImage(), ...this.galleryImages()]
      : [...this.galleryImages()];

    if (!this.productForm.imageUrl) {
      this.formError.set('Please upload at least one photo (first image is the cover).');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set('');

    if (this.mode() === 'edit' && this.productId()) {
      this.productService.getVendorProducts().subscribe({
        next: (products) => {
          const product = products.find((p) => p.id === this.productId());
          if (!product) {
            this.formError.set('Product not found.');
            this.isSubmitting.set(false);
            return;
          }
          this.productService.updateProduct(product, this.productForm).subscribe({
            next: () => {
              this.isSubmitting.set(false);
              void this.router.navigateByUrl('/vendor/products');
            },
            error: (err: Error) => {
              this.formError.set(err.message || 'Failed to update product.');
              this.isSubmitting.set(false);
            },
          });
        },
        error: () => {
          this.formError.set('Unable to load product for update.');
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    this.productService.createProduct(this.productForm, []).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/vendor/products');
      },
      error: (err: Error) => {
        this.formError.set(err.message || 'Failed to add product.');
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
        const photos = this.allPhotos();
        this.setPhotos([...photos, base64]);
        this.formError.set('');
      });
    });
    input.value = '';
  }

  removePhoto(index: number): void {
    const photos = this.allPhotos().filter((_, i) => i !== index);
    this.setPhotos(photos);
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
    const photos = [...this.allPhotos()];
    const [moved] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, moved);
    this.setPhotos(photos);
  }

  onPhotoDragEnd(): void {
    this.dragPhotoIndex.set(null);
  }

  movePhoto(fromIndex: number, toIndex: number): void {
    const photos = [...this.allPhotos()];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= photos.length || toIndex >= photos.length) {
      return;
    }
    const [moved] = photos.splice(fromIndex, 1);
    photos.splice(toIndex, 0, moved);
    this.setPhotos(photos);
  }

  private setPhotos(photos: string[]): void {
    this.coverImage.set(photos[0] ?? '');
    this.galleryImages.set(photos.slice(1));
    this.productForm.imageUrl = photos[0] ?? '';
    this.productForm.galleryImages = photos.slice(1);
  }

  private resetForAdd(): void {
    this.productForm = createEmptyProductForm();
    const cats = this.categories().filter((c) => c.status === 'active');
    const metals = this.metalTypes().filter((m) => m.status === 'active');
    if (cats.length) {
      this.productForm.category = cats[0].name;
    }
    if (metals.length) {
      this.productForm.metalType = metals[0].name;
    }
    this.setPhotos([]);
    this.formError.set('');
  }

  private loadProduct(id: string): void {
    this.productService.getVendorProducts().subscribe({
      next: (products) => {
        const product = products.find((p) => p.id === id);
        if (!product) {
          this.pageError.set('Product not found.');
          this.isLoading.set(false);
          return;
        }
        this.productForm = this.productService.mapToForm(product);
        this.coverImage.set(this.productForm.imageUrl || '');
        this.galleryImages.set([...(this.productForm.galleryImages ?? [])]);
        this.isLoading.set(false);
      },
      error: () => {
        this.pageError.set('Unable to load product.');
        this.isLoading.set(false);
      },
    });
  }

  private readFileAsBase64(file: File, onDone: (base64: string) => void): void {
    if (!file.type.startsWith('image/')) {
      this.formError.set('Please select an image file.');
      return;
    }
    if (file.size > 1_500_000) {
      this.formError.set('Each image must be under 1.5MB.');
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
      this.formError.set('Could not read image file.');
    };
    reader.readAsDataURL(file);
  }
}
