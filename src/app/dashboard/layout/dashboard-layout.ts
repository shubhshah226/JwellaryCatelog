import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../auth/services/auth.service';
import { resolveMediaUrl } from '../../core/utils/media-url.util';
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
  readonly vendorDisplayName = signal('');

  readonly user = this.authService.getSession()?.user;
  readonly isAdmin = this.user?.role === 'admin';
  readonly baseRoute = this.isAdmin ? '/admin' : '/vendor';
  readonly roleLabel = this.isAdmin ? 'Super Admin' : 'Vendor';

  readonly adminNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Manage Vendors', route: '/admin/vendors', icon: 'vendors' },
    { label: 'Change Password', route: '/admin/change-password', icon: 'password' },
  ];

  readonly vendorNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/vendor/dashboard', icon: 'dashboard' },
    { label: 'Catalogs', route: '/vendor/catalogs', icon: 'catalogs' },
    { label: 'Manage Products', route: '/vendor/products', icon: 'products' },
    { label: 'Master Data', route: '/vendor/master-data', icon: 'categories' },
    { label: 'Manage Leads', route: '/vendor/leads', icon: 'leads' },
    // { label: 'My Website', route: '/vendor/storefront', icon: 'storefront' },
    { label: 'Profile', route: '/vendor/profile', icon: 'profile' },
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
  }

  onBrandLogoError(): void {
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
      return url.includes('type=metals') ? 'Add Metal Type' : 'Add Category';
    }
    if (/\/master-data\/\d+\/edit/.test(url)) {
      return url.includes('type=metals') ? 'Edit Metal Type' : 'Edit Category';
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
        this.vendorLogo.set(resolveMediaUrl(profile.logoUrl || '') || '');
      },
      error: () => {
        /* keep default brand */
      },
    });
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
