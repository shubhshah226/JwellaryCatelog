import { Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PublicProduct } from '../../models/storefront.model';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { InterestCartService } from '../../services/interest-cart.service';
import { formatRs, hasDisplayPrice, StorefrontService } from '../../services/storefront.service';
import { lockBodyScroll, unlockBodyScroll } from '../../../core/utils/body-scroll-lock';

type ViewerStep = 'auth' | 'otp' | 'details';

@Component({
  selector: 'app-product-viewer-modal',
  imports: [FormsModule],
  templateUrl: './product-viewer-modal.html',
  styleUrl: './product-viewer-modal.css',
})
export class ProductViewerModal implements OnDestroy {
  private readonly customerAuth = inject(CustomerAuthService);
  private readonly storefrontService = inject(StorefrontService);
  readonly interestCart = inject(InterestCartService);
  private readonly router = inject(Router);

  readonly open = input(false);
  readonly product = input<PublicProduct | null>(null);
  readonly vendorId = input(0);
  readonly vendorName = input('');
  readonly storeCode = input('');

  readonly closed = output<void>();
  readonly addedToCart = output<void>();
  readonly verified = output<void>();
  readonly productHydrated = output<PublicProduct>();

  readonly step = signal<ViewerStep>('auth');
  readonly isSendingOtp = signal(false);
  readonly isVerifying = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly demoOtp = signal('');
  readonly justAdded = signal(false);
  readonly activeImageIndex = signal(0);
  readonly detail = signal<PublicProduct | null>(null);
  readonly isVerified = computed(() => {
    this.customerAuth.authTick();
    return this.customerAuth.isVerified(this.storeCode());
  });

  customerName = '';
  customerPhone = '';
  otpCode = '';

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
        this.customerAuth.setActiveStore(code);
      }

      if (isOpen && !this.wasOpen && product) {
        this.resetState();
      } else if (isOpen && this.wasOpen && !this.isVerified() && this.step() === 'details') {
        this.lockToAuth();
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

  sendOtp(event?: Event): void {
    event?.preventDefault();
    this.errorMessage.set('');
    this.isSendingOtp.set(true);

    this.customerAuth.sendOtp(this.storeCode(), this.customerName, this.customerPhone).subscribe({
      next: (result) => {
        this.isSendingOtp.set(false);
        if (!result.success) {
          this.errorMessage.set(result.error ?? 'Failed to send OTP.');
          return;
        }
        this.demoOtp.set(result.demoOtp ?? '');
        this.step.set('otp');
      },
      error: () => {
        this.isSendingOtp.set(false);
        this.errorMessage.set('Failed to send OTP.');
      },
    });
  }

  verifyOtp(event?: Event): void {
    event?.preventDefault();
    this.errorMessage.set('');
    this.isVerifying.set(true);

    this.customerAuth
      .verifyOtp(this.storeCode(), this.customerPhone, this.otpCode)
      .subscribe({
        next: (result) => {
          this.isVerifying.set(false);
          if (!result.success) {
            this.errorMessage.set(result.error ?? 'Verification failed.');
            return;
          }
          if (!this.customerAuth.isVerified(this.storeCode())) {
            this.lockToAuth();
            return;
          }
          this.step.set('details');
          this.verified.emit();
          this.loadVerifiedImages();
        },
        error: () => {
          this.isVerifying.set(false);
          this.errorMessage.set('Verification failed.');
        },
      });
  }

  resendOtp(): void {
    this.otpCode = '';
    this.step.set('auth');
    this.demoOtp.set('');
  }

  isInCart(): boolean {
    const product = this.viewedProduct();
    return !!product && this.interestCart.has(product.id);
  }

  addToCart(): void {
    const product = this.viewedProduct();
    if (!product || !this.isVerified()) {
      this.lockToAuth();
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

  maskedPhone(): string {
    const session = this.customerAuth.getSession(this.storeCode());
    if (!session) {
      return '';
    }
    const p = session.phone;
    return `+91 ${p.slice(0, 2)}****${p.slice(-4)}`;
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
    const cover = product.imageUrl ? [product.imageUrl] : [];
    if (!this.isVerified() || this.step() !== 'details') {
      return cover.length ? cover : (product.images ?? []).slice(0, 1);
    }
    return product.images?.length ? product.images : cover;
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
    if (!track) {
      return;
    }
    const width = track.clientWidth || 1;
    const index = Math.round(track.scrollLeft / width);
    if (index !== this.activeImageIndex() && index >= 0 && index < this.displayImages().length) {
      this.activeImageIndex.set(index);
    }
  }

  currentImage(): string {
    const images = this.displayImages();
    return images[this.activeImageIndex()] ?? images[0] ?? '';
  }

  private loadVerifiedImages(): void {
    const product = this.product();
    const session = this.customerAuth.getSession(this.storeCode());
    if (!product || !session?.sessionToken) {
      this.lockToAuth();
      return;
    }

    const requestId = ++this.detailRequestId;
    this.storefrontService
      .getPublicProductDetail(this.storeCode(), product.id, session.sessionToken)
      .subscribe({
        next: (full) => {
          if (requestId !== this.detailRequestId || !this.isVerified()) {
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

  private lockToAuth(): void {
    this.detailRequestId += 1;
    this.step.set('auth');
    const product = this.product();
    this.detail.set(
      product
        ? {
            ...product,
            description: undefined,
            images: product.imageUrl ? [product.imageUrl] : [],
          }
        : null
    );
    this.activeImageIndex.set(0);
    this.justAdded.set(false);
    this.successMessage.set('');
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
            images: product.imageUrl ? [product.imageUrl] : [],
          }
        : null
    );
    this.activeImageIndex.set(0);

    const session = this.customerAuth.getSession(this.storeCode());
    if (session) {
      this.customerName = session.name;
      this.customerPhone = session.phone;
      this.step.set('details');
      this.loadVerifiedImages();
    } else {
      this.lockToAuth();
      this.customerName = '';
      this.customerPhone = '';
    }
    this.otpCode = '';
    this.demoOtp.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
    this.justAdded.set(false);
  }
}
