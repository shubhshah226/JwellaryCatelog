import { HomepageTextItem } from '../../models/storefront.model';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { InterestCartService } from '../../services/interest-cart.service';
import { lockBodyScroll, unlockBodyScroll } from '../../../core/utils/body-scroll-lock';

@Component({
  selector: 'app-public-store-nav',
  imports: [RouterLink, FormsModule],
  templateUrl: './public-store-nav.html',
  styleUrl: './public-store-nav.css',
  host: {
    class: 'public-nav-host',
  },
})
export class PublicStoreNav {
  private readonly router = inject(Router);
  private readonly customerAuth = inject(CustomerAuthService);
  readonly cart = inject(InterestCartService);

  storeCode = input.required<string>();
  vendorName = input.required<string>();
  logoUrl = input('');
  isAvailable = input(true);
  topBarItems = input<HomepageTextItem[]>([]);

  readonly menuOpen = signal(false);
  readonly signInOpen = signal(false);
  customerName = '';
  customerPhone = '';
  otpCode = '';
  demoOtp = '';
  authError = '';
  authStep: 'form' | 'otp' = 'form';
  authBusy = false;
  private navScrollLocked = false;

  constructor() {
    effect(() => {
      const code = this.storeCode();
      if (code) {
        this.cart.setStore(code);
        this.customerAuth.setActiveStore(code);
      }
    });

    effect(() => {
      const lock = this.menuOpen() || this.signInOpen();
      if (lock && !this.navScrollLocked) {
        lockBodyScroll();
        this.navScrollLocked = true;
      } else if (!lock && this.navScrollLocked) {
        unlockBodyScroll();
        this.navScrollLocked = false;
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.navScrollLocked) {
        unlockBodyScroll();
        this.navScrollLocked = false;
      }
    });
  }

  vendorInitials(): string {
    return this.vendorName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  currentPath(): string {
    return this.router.url.split('?')[0];
  }

  fragment(): string {
    return this.router.url.split('#')[1] ?? '';
  }

  isHomeActive(): boolean {
    const url = this.currentPath().split('#')[0];
    const code = this.storeCode();
    const frag = this.fragment();
    return (
      (url === `/${code}/home` || url === `/${code}`) &&
      !frag
    );
  }

  isCollectionsActive(): boolean {
    return this.isOnHome() && this.fragment() === 'collection';
  }

  isProductsActive(): boolean {
    const code = this.storeCode();
    const url = this.currentPath().split('#')[0];
    return (
      url.startsWith(`/${code}/products`) ||
      url.startsWith(`/${code}/catalog`) ||
      url.startsWith(`/${code}/c/`)
    );
  }

  isCartActive(): boolean {
    const code = this.storeCode();
    return this.currentPath().split('#')[0].startsWith(`/${code}/cart`);
  }

  isAboutActive(): boolean {
    return this.isOnHome() && this.fragment() === 'about';
  }

  isVisitActive(): boolean {
    const frag = this.fragment();
    return this.isOnHome() && (frag === 'visit' || frag === 'stores' || frag === 'contact');
  }

  isSignedIn(): boolean {
    this.customerAuth.authTick();
    return this.customerAuth.isVerified(this.storeCode());
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  goHome(): void {
    this.closeMenu();
    void this.router.navigateByUrl(`/${this.storeCode()}/home`).then(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  goSection(fragment: string): void {
    this.closeMenu();
    void this.router.navigate(['/', this.storeCode(), 'home'], { fragment }).then(() => {
      this.scrollTo(fragment);
    });
  }

  goProducts(): void {
    this.closeMenu();
    void this.router.navigate(['/', this.storeCode(), 'products']);
  }

  private isOnHome(): boolean {
    const url = this.currentPath().split('#')[0];
    const code = this.storeCode();
    return url === `/${code}/home` || url === `/${code}`;
  }

  private scrollTo(id: string): void {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  toggleSignIn(): void {
    this.signInOpen.set(true);
    this.authError = '';
    if (!this.isSignedIn()) {
      this.authStep = 'form';
    }
  }

  openLoginFromMenu(): void {
    this.closeMenu();
    this.authStep = 'form';
    this.authError = '';
    this.signInOpen.set(true);
  }

  openAccountFromMenu(): void {
    this.closeMenu();
    this.signInOpen.set(true);
  }

  signOut(): void {
    this.customerAuth.logout(this.storeCode());
    this.signInOpen.set(false);
  }

  closeAuth(): void {
    this.signInOpen.set(false);
  }

  sendOtp(): void {
    this.authBusy = true;
    this.authError = '';
    this.customerAuth.sendOtp(this.storeCode(), this.customerName, this.customerPhone).subscribe({
      next: (res) => {
        this.authBusy = false;
        if (!res.success) {
          this.authError = res.error ?? 'Could not send OTP.';
          return;
        }
        this.demoOtp = res.demoOtp ?? '';
        this.authStep = 'otp';
      },
    });
  }

  verifyOtp(): void {
    this.authBusy = true;
    this.authError = '';
    this.customerAuth.verifyOtp(this.storeCode(), this.customerPhone, this.otpCode).subscribe({
      next: (res) => {
        this.authBusy = false;
        if (!res.success) {
          this.authError = res.error ?? 'Invalid OTP.';
          return;
        }
        this.signInOpen.set(false);
        this.authStep = 'form';
        this.otpCode = '';
      },
    });
  }
}
