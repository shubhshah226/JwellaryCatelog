import { HomepageTextItem } from '../../models/storefront.model';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InterestCartService } from '../../services/interest-cart.service';
import { lockBodyScroll, unlockBodyScroll } from '@common/utils/body-scroll-lock';

@Component({
  selector: 'app-public-store-nav',
  imports: [RouterLink],
  templateUrl: './public-store-nav.html',
  styleUrl: './public-store-nav.css',
  host: {
    class: 'public-nav-host',
  },
})
export class PublicStoreNav {
  private readonly router = inject(Router);
  readonly cart = inject(InterestCartService);

  storeCode = input.required<string>();
  vendorName = input.required<string>();
  logoUrl = input('');
  contactPhone = input('');
  brandColor = input('');
  isAvailable = input(true);
  topBarItems = input<HomepageTextItem[]>([]);

  readonly menuOpen = signal(false);
  private navScrollLocked = false;

  constructor() {
    effect(() => {
      const code = this.storeCode();
      if (code) {
        this.cart.setStore(code);
      }
    });

    effect(() => {
      const lock = this.menuOpen();
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

  isCartActive(): boolean {
    const code = this.storeCode();
    return this.router.url.split('?')[0].startsWith(`/${code}/cart`);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  goCatalog(): void {
    this.closeMenu();
    void this.router.navigate(['/c', this.storeCode()]);
  }

  goCart(): void {
    this.closeMenu();
    void this.router.navigate(['/', this.storeCode(), 'cart']);
  }
}
