import { Component, ElementRef, OnDestroy, ViewChild, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PublicProduct } from '../../models/storefront.model';
import { InterestCartService } from '../../services/interest-cart.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';
import { lockBodyScroll, unlockBodyScroll } from '@common/utils/body-scroll-lock';

@Component({
  selector: 'app-product-viewer-modal',
  imports: [],
  templateUrl: './product-viewer-modal.html',
  styleUrl: './product-viewer-modal.css',
})
export class ProductViewerModal implements OnDestroy {
  private readonly storefrontService = inject(StorefrontService);
  readonly interestCart = inject(InterestCartService);
  private readonly router = inject(Router);

  readonly open = input(false);
  readonly product = input<PublicProduct | null>(null);
  readonly vendorId = input<number | string>(0);
  readonly vendorName = input('');
  readonly storeCode = input('');
  readonly brandColor = input('');
  readonly contactPhone = input('');

  readonly closed = output<void>();
  readonly addedToCart = output<void>();
  readonly productHydrated = output<PublicProduct>();

  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly justAdded = signal(false);
  readonly activeImageIndex = signal(0);
  readonly detail = signal<PublicProduct | null>(null);

  private wasOpen = false;
  private detailRequestId = 0;
  private modalScrollLocked = false;

  @ViewChild('carouselTrack') carouselTrack?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const product = this.product();
      const code = this.storeCode();

      if (code) {
        this.interestCart.setStore(code);
      }

      if (isOpen && !this.wasOpen && product) {
        this.resetState();
      }

      this.wasOpen = isOpen;
      if (isOpen && !this.modalScrollLocked) {
        lockBodyScroll();
        this.modalScrollLocked = true;
      } else if (!isOpen && this.modalScrollLocked) {
        unlockBodyScroll();
        this.modalScrollLocked = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.modalScrollLocked) {
      unlockBodyScroll();
      this.modalScrollLocked = false;
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('pvm-backdrop')) {
      this.close();
    }
  }

  isInCart(): boolean {
    const product = this.viewedProduct();
    return !!product && this.interestCart.has(product.id);
  }

  addToCart(): void {
    const product = this.viewedProduct();
    if (!product) {
      return;
    }
    this.errorMessage.set('');
    const result = this.interestCart.add(product);
    if (result.alreadyInCart) {
      this.successMessage.set('Already in your interest list.');
    } else {
      this.successMessage.set('Added to interest list.');
      this.addedToCart.emit();
    }
    this.justAdded.set(true);
  }

  goToCart(): void {
    this.close();
    void this.router.navigate(['/', this.storeCode(), 'cart']);
  }

  viewedProduct(): PublicProduct | null {
    return this.detail() ?? this.product();
  }

  hasPrice(product: PublicProduct | null): boolean {
    return hasDisplayPrice(product?.price);
  }

  priceLabel(product: PublicProduct | null): string {
    return formatRs(product?.price);
  }

  formatListRs(amount?: number | null): string {
    return formatRs(amount);
  }

  skuLabel(product: PublicProduct): string {
    return product.sku || `P${product.id}`;
  }

  displayImages(): string[] {
    const product = this.viewedProduct();
    if (!product) {
      return [];
    }
    if (product.images?.length) {
      return product.images;
    }
    return product.imageUrl ? [product.imageUrl] : [];
  }

  selectImage(index: number): void {
    const images = this.displayImages();
    const next = Math.max(0, Math.min(index, images.length - 1));
    this.activeImageIndex.set(next);
    this.scrollCarouselTo(next);
  }

  prevImage(): void {
    const total = this.displayImages().length;
    if (!total) {
      return;
    }
    this.selectImage((this.activeImageIndex() - 1 + total) % total);
  }

  nextImage(): void {
    const total = this.displayImages().length;
    if (!total) {
      return;
    }
    this.selectImage((this.activeImageIndex() + 1) % total);
  }

  onCarouselScroll(): void {
    const track = this.carouselTrack?.nativeElement;
    if (!track || !track.clientWidth) {
      return;
    }
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== this.activeImageIndex() && index >= 0 && index < this.displayImages().length) {
      this.activeImageIndex.set(index);
    }
  }

  private loadDetail(): void {
    const product = this.product();
    const token = this.storeCode();
    if (!product || !token) {
      return;
    }

    const requestId = ++this.detailRequestId;
    this.storefrontService.getPublicProductDetail(token, product.id).subscribe({
      next: (full) => {
        if (requestId !== this.detailRequestId) {
          return;
        }
        if (!full) {
          return;
        }
        this.detail.set({
          ...product,
          ...full,
          images: full.images?.length ? full.images : product.imageUrl ? [product.imageUrl] : [],
          ...(product.isSpecialPrice
            ? {
                price: product.price,
                listPrice: product.listPrice,
                isSpecialPrice: true,
              }
            : {}),
        });
        this.productHydrated.emit(this.detail()!);
        this.activeImageIndex.set(0);
        requestAnimationFrame(() => this.scrollCarouselTo(0));
      },
    });
  }

  private scrollCarouselTo(index: number): void {
    const track = this.carouselTrack?.nativeElement;
    if (!track) {
      return;
    }
    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
  }

  private resetState(): void {
    const product = this.product();
    this.detail.set(
      product
        ? {
            ...product,
            images: product.images?.length
              ? product.images
              : product.imageUrl
                ? [product.imageUrl]
                : [],
          }
        : null
    );
    this.activeImageIndex.set(0);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.justAdded.set(false);
    this.loadDetail();
  }
}
