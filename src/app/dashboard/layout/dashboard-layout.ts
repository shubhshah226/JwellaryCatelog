import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../auth/services/auth.service';
import { VendorDataService } from '../../vendor/services/vendor-data.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

const NAV_FA_ICONS: Record<string, string> = {
  dashboard: 'fa-solid fa-house',
  vendors: 'fa-solid fa-store',
  users: 'fa-solid fa-user-plus',
  roles: 'fa-solid fa-shield-halved',
  catalogs: 'fa-solid fa-folder-open',
  products: 'fa-solid fa-gem',
  categories: 'fa-solid fa-table-cells-large',
  collections: 'fa-solid fa-layer-group',
  orders: 'fa-solid fa-clipboard-check',
  subscriptions: 'fa-solid fa-id-card',
  payments: 'fa-solid fa-credit-card',
  reports: 'fa-solid fa-chart-column',
  settings: 'fa-solid fa-gear',
  leads: 'fa-solid fa-comments',
  storefront: 'fa-solid fa-globe',
  profile: 'fa-solid fa-user',
  password: 'fa-solid fa-key',
  logs: 'fa-solid fa-scroll',
};

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly vendorData = inject(VendorDataService);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly themeService = inject(ThemeService);
  private routerSub?: Subscription;
  private syncTimer?: ReturnType<typeof setTimeout>;

  readonly isSidebarOpen = signal(this.isDesktopViewport());
  readonly vendorLogo = signal('');
  private vendorLogoObjectUrl: string | null = null;
  readonly vendorDisplayName = signal('');

  readonly user = this.authService.getSession()?.user;
  readonly isAdmin = this.user?.role === 'superadmin';
  readonly baseRoute = this.isAdmin ? '/superAdmin' : '/vendor';
  readonly roleLabel = this.isAdmin ? 'Super Admin' : 'Vendor';

  readonly adminNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/superAdmin/dashboard', icon: 'dashboard' },
    { label: 'Manage Vendors', route: '/superAdmin/vendors', icon: 'vendors' },
    { label: 'User Profile', route: '/superAdmin/user-profile', icon: 'profile' },
    { label: 'Change Password', route: '/superAdmin/change-password', icon: 'password' },
  ];

  readonly vendorNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/vendor/dashboard', icon: 'dashboard' },
    { label: 'Product Options', route: '/vendor/master-data', icon: 'categories' },
    { label: 'Manage Products', route: '/vendor/products', icon: 'products' },
    { label: 'Catalogs', route: '/vendor/catalogs', icon: 'catalogs' },
    { label: 'Manage Leads', route: '/vendor/leads', icon: 'leads' },
    // { label: 'My Website', route: '/vendor/storefront', icon: 'storefront' },
    { label: 'Business Profile', route: '/vendor/profile', icon: 'profile' },
    { label: 'Change Password', route: '/vendor/change-password', icon: 'password' },
  ];

  visibleNavItems(): NavItem[] {
    return this.isAdmin ? this.adminNavItems : this.vendorNavItems;
  }

  faIcon(icon: string): string {
    return NAV_FA_ICONS[icon] ?? 'fa-solid fa-circle';
  }

  ngOnInit(): void {
    this.themeService.init();
    this.syncSidebarWithViewport();
    this.loadVendorBrand();
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.queueMobileScrollSync());
  }

  ngAfterViewInit(): void {
    this.queueMobileScrollSync();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.clearMobileScrollArea();
    this.clearVendorLogoObjectUrl();
  }

  onBrandLogoError(): void {
    this.clearVendorLogoObjectUrl();
    this.vendorLogo.set('');
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncSidebarWithViewport();
    this.queueMobileScrollSync();
  }

  @HostListener('window:orientationchange')
  onOrientationChange(): void {
    this.queueMobileScrollSync();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  onNavItemClick(): void {
    if (!this.isDesktopViewport()) {
      this.closeSidebar();
    }
  }

  pageTitle(): string {
    const url = this.router.url;
    if (url.includes('/catalogs/new')) {
      return 'Add Catalog';
    }
    if (/\/catalogs\/\d+\/edit/.test(url)) {
      return 'Edit Catalog';
    }
    if (url.includes('/products/new')) {
      return 'Add Product';
    }
    if (/\/products\/\d+\/edit/.test(url)) {
      return 'Edit Product';
    }
    if (url.includes('/master-data/new')) {
      if (url.includes('type=metals')) return 'Add Metal Type';
      if (url.includes('type=purities')) return 'Add Purity';
      if (url.includes('type=colors')) return 'Add Color';
      return 'Add Category';
    }
    if (/\/master-data\/[^/]+\/edit/.test(url)) {
      if (url.includes('type=metals')) return 'Edit Metal Type';
      if (url.includes('type=purities')) return 'Edit Purity';
      if (url.includes('type=colors')) return 'Edit Color';
      return 'Edit Category';
    }
    const current = this.visibleNavItems().find((item) => this.isNavActive(item.route));
    return current?.label ?? 'Dashboard';
  }

  isNavActive(route: string): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === route || path.startsWith(`${route}/`);
  }

  logout(): void {
    this.authService.logout();
  }

  private loadVendorBrand(): void {
    if (this.isAdmin) {
      return;
    }
    this.vendorData.getProfile().subscribe({
      next: (profile) => {
        if (!profile) {
          return;
        }
        this.vendorDisplayName.set(profile.name || '');
        if (!profile.logoUrl) {
          this.clearVendorLogoObjectUrl();
          this.vendorLogo.set('');
          return;
        }
        this.vendorData.resolveBusinessLogoUrl().subscribe({
          next: (url) => {
            this.clearVendorLogoObjectUrl();
            this.vendorLogo.set(url);
          },
          error: () => {
            this.clearVendorLogoObjectUrl();
            this.vendorLogo.set('');
          },
        });
      },
      error: () => {
        /* keep default brand */
      },
    });
  }

  private clearVendorLogoObjectUrl(): void {
    if (this.vendorLogoObjectUrl) {
      URL.revokeObjectURL(this.vendorLogoObjectUrl);
      this.vendorLogoObjectUrl = null;
    }
  }

  private isDesktopViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth > 900;
  }

  private syncSidebarWithViewport(): void {
    if (this.isDesktopViewport()) {
      this.isSidebarOpen.set(true);
    }
  }

  /** Force a real scrollport on mobile — CSS flex height is unreliable in DevTools device mode. */
  private queueMobileScrollSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => this.syncMobileScrollArea(), 0);
  }

  private syncMobileScrollArea(): void {
    const scrollRoot = this.host.nativeElement.querySelector(
      '#dashboard-scroll-root'
    ) as HTMLElement | null;
    if (!scrollRoot) {
      return;
    }

    if (this.isDesktopViewport()) {
      this.clearMobileScrollArea(scrollRoot);
      return;
    }

    const header = this.host.nativeElement.querySelector('.top-header') as HTMLElement | null;
    const headerH = header?.getBoundingClientRect().height ?? 60;
    const available = Math.max(160, Math.round(window.innerHeight - headerH));

    scrollRoot.style.setProperty('box-sizing', 'border-box', 'important');
    scrollRoot.style.setProperty('height', `${available}px`, 'important');
    scrollRoot.style.setProperty('max-height', `${available}px`, 'important');
    scrollRoot.style.setProperty('overflow-x', 'hidden', 'important');
    scrollRoot.style.setProperty('overflow-y', 'auto', 'important');
    scrollRoot.style.setProperty('-webkit-overflow-scrolling', 'touch');
    scrollRoot.style.setProperty('touch-action', 'pan-y', 'important');
  }

  private clearMobileScrollArea(scrollRoot?: HTMLElement | null): void {
    const el =
      scrollRoot ??
      (this.host.nativeElement.querySelector('#dashboard-scroll-root') as HTMLElement | null);
    if (!el) {
      return;
    }
    el.style.removeProperty('height');
    el.style.removeProperty('max-height');
    el.style.removeProperty('overflow-x');
    el.style.removeProperty('overflow-y');
    el.style.removeProperty('-webkit-overflow-scrolling');
    el.style.removeProperty('touch-action');
    el.style.removeProperty('box-sizing');
  }
}
