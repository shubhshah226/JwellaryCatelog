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
  /** Live drag offset in px while swiping. */
  readonly dragOffsetPx = signal(0);
  readonly isDragging = signal(false);

  private wasOpen = false;
  private detailRequestId = 0;
  private modalScrollLocked = false;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeDeltaX = 0;
  private swipeAxis: 'x' | 'y' | null = null;
  private swipeTracking = false;
  private galleryEl: HTMLElement | null = null;

  private readonly onTouchStart = (event: TouchEvent): void => this.handleSwipeStart(event);
  private readonly onTouchMove = (event: TouchEvent): void => this.handleSwipeMove(event);
  private readonly onTouchEnd = (): void => this.handleSwipeEnd();

  @ViewChild('galleryFrame')
  set galleryFrame(ref: ElementRef<HTMLElement> | undefined) {
    this.unbindGallerySwipe();
    this.galleryEl = ref?.nativeElement ?? null;
    if (this.galleryEl) {
      this.bindGallerySwipe(this.galleryEl);
    }
  }

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
    this.unbindGallerySwipe();
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
    void this.router.navigate(['/c', this.storeCode(), 'cart']);
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

  trackTransform(): string {
    const index = this.activeImageIndex();
    const drag = this.dragOffsetPx();
    const width = this.galleryEl?.clientWidth || 0;
    const dragPercent = width ? (drag / width) * 100 : 0;
    return `translate3d(calc(${-index * 100}% + ${dragPercent}%), 0, 0)`;
  }

  selectImage(index: number): void {
    const images = this.displayImages();
    const next = Math.max(0, Math.min(index, images.length - 1));
    this.activeImageIndex.set(next);
    this.dragOffsetPx.set(0);
    this.isDragging.set(false);
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

  private handleSwipeStart(event: TouchEvent): void {
    if (this.displayImages().length < 2 || !event.touches.length) {
      return;
    }
    this.swipeTracking = true;
    this.swipeAxis = null;
    this.swipeDeltaX = 0;
    this.swipeStartX = event.touches[0].clientX;
    this.swipeStartY = event.touches[0].clientY;
    this.isDragging.set(false);
    this.dragOffsetPx.set(0);
  }

  private handleSwipeMove(event: TouchEvent): void {
    if (!this.swipeTracking || !event.touches.length) {
      return;
    }
    const dx = event.touches[0].clientX - this.swipeStartX;
    const dy = event.touches[0].clientY - this.swipeStartY;

    if (!this.swipeAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        return;
      }
      this.swipeAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (this.swipeAxis === 'x') {
        this.isDragging.set(true);
      }
    }

    if (this.swipeAxis === 'x') {
      event.preventDefault();
      this.swipeDeltaX = dx;
      this.dragOffsetPx.set(dx);
    }
  }

  private handleSwipeEnd(): void {
    if (!this.swipeTracking) {
      return;
    }
    const width = this.galleryEl?.clientWidth || 1;
    const shouldFlip = this.swipeAxis === 'x' && Math.abs(this.swipeDeltaX) > Math.min(56, width * 0.18);
    const delta = this.swipeDeltaX;
    this.swipeTracking = false;
    this.swipeAxis = null;
    this.swipeDeltaX = 0;
    this.isDragging.set(false);
    this.dragOffsetPx.set(0);

    if (!shouldFlip) {
      return;
    }
    if (delta < 0) {
      this.nextImage();
    } else {
      this.prevImage();
    }
  }

  private bindGallerySwipe(el: HTMLElement): void {
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  private unbindGallerySwipe(): void {
    if (!this.galleryEl) {
      return;
    }
    this.galleryEl.removeEventListener('touchstart', this.onTouchStart);
    this.galleryEl.removeEventListener('touchmove', this.onTouchMove);
    this.galleryEl.removeEventListener('touchend', this.onTouchEnd);
    this.galleryEl.removeEventListener('touchcancel', this.onTouchEnd);
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
        this.selectImage(0);
      },
    });
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
    this.selectImage(0);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.justAdded.set(false);
    this.loadDetail();
  }
}
