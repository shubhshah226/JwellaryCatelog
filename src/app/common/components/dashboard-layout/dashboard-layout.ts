import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThemeService } from '@common/services/theme.service';
import { AuthService } from '@auth/services/auth.service';
import { relativeTimeFromUtc } from '@common/utils/date-time.util';
import {
  DashboardNotification,
  DashboardService,
} from '@common/services/dashboard.service';
import { VendorDataService } from '@owner/services/vendor-data.service';

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
  private readonly dashboardService = inject(DashboardService);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly themeService = inject(ThemeService);
  private routerSub?: Subscription;
  private syncTimer?: ReturnType<typeof setTimeout>;

  readonly isSidebarOpen = signal(this.isDesktopViewport());
  readonly vendorLogo = signal('');
  private vendorLogoObjectUrl: string | null = null;
  readonly vendorDisplayName = signal('');

  readonly notificationsOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly notifications = signal<DashboardNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly notificationsLoading = signal(false);
  readonly markReadBusy = signal(false);

  /** Only unread items appear in the panel. */
  readonly unreadNotifications = computed(() =>
    this.notifications().filter((n) => !n.isRead)
  );

  readonly unreadBadge = computed(() => {
    const n = this.unreadCount();
    if (n <= 0) {
      return '';
    }
    return n > 9 ? '9+' : String(n);
  });

  readonly user = this.authService.getSession()?.user;
  readonly isAdmin = this.user?.role === 'superadmin';
  readonly baseRoute = this.isAdmin ? '/superAdmin' : '/vendor';
  readonly roleLabel = this.isAdmin ? 'Super Admin' : 'Owner';

  readonly adminNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/superAdmin/dashboard', icon: 'dashboard' },
    { label: 'Manage Vendors', route: '/superAdmin/vendors', icon: 'vendors' },
    { label: 'Change Password', route: '/common/changepassword', icon: 'password' },
  ];

  readonly vendorNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/vendor/dashboard', icon: 'dashboard' },
    { label: 'Product Options', route: '/vendor/master-data', icon: 'categories' },
    { label: 'Manage Products', route: '/vendor/products', icon: 'products' },
    { label: 'Catalogs', route: '/vendor/catalogs', icon: 'catalogs' },
    { label: 'Manage Leads', route: '/vendor/leads', icon: 'leads' },
    // { label: 'My Website', route: '/vendor/storefront', icon: 'storefront' },
    { label: 'Business Profile', route: '/vendor/profile', icon: 'profile' },
    { label: 'Change Password', route: '/common/changepassword', icon: 'password' },
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
    this.refreshNotificationsIfDashboard(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.notificationsOpen.set(false);
        this.userMenuOpen.set(false);
        this.queueMobileScrollSync();
        this.refreshNotificationsIfDashboard(event.urlAfterRedirects);
      });
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
    if (url.includes('/common/access-denied')) {
      return 'Access Denied';
    }
    if (url.includes('/user-profile')) {
      return 'User Profile';
    }
    if (url.includes('/catalogs/new')) {
      return 'Add Catalog';
    }
    if (/\/catalogs\/[^/]+\/edit/.test(url)) {
      return 'Edit Catalog';
    }
    if (url.includes('/products/new')) {
      return 'Add Product';
    }
    if (/\/products\/[^/]+\/edit/.test(url)) {
      return 'Edit Product';
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

  toggleNotifications(event?: Event): void {
    event?.stopPropagation();
    if (this.isAdmin) {
      return;
    }
    this.userMenuOpen.set(false);
    this.notificationsOpen.update((open) => !open);
  }

  toggleUserMenu(event?: Event): void {
    event?.stopPropagation();
    this.notificationsOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  goToUserProfile(): void {
    this.closeUserMenu();
    const route = this.isAdmin ? '/superAdmin/user-profile' : '/vendor/user-profile';
    void this.router.navigateByUrl(route);
  }

  closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  notificationTime(item: DashboardNotification): string {
    return relativeTimeFromUtc(item.createdAt) || '';
  }

  markAllRead(): void {
    if (this.isAdmin || this.markReadBusy() || this.unreadCount() <= 0) {
      return;
    }
    this.markReadBusy.set(true);
    this.dashboardService.markNotificationsRead().subscribe({
      next: (res) => {
        this.unreadCount.set(res.unreadCount);
        this.notifications.set([]);
        this.markReadBusy.set(false);
      },
      error: () => this.markReadBusy.set(false),
    });
  }

  openNotification(item: DashboardNotification): void {
    const go = () => {
      this.closeNotifications();
      if (item.type === 'enquiry_received') {
        void this.router.navigateByUrl('/vendor/leads');
        return;
      }
      if (item.type === 'catalog_viewed') {
        void this.router.navigateByUrl('/vendor/catalogs');
        return;
      }
      void this.router.navigateByUrl('/vendor/dashboard');
    };

    if (!item.isRead) {
      this.dashboardService.markNotificationsRead([item.id]).subscribe({
        next: (res) => {
          this.unreadCount.set(res.unreadCount);
          this.notifications.update((list) => list.filter((n) => n.id !== item.id));
          go();
        },
        error: () => go(),
      });
      return;
    }
    go();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.notificationsOpen() && !target?.closest('.notification-wrap')) {
      this.closeNotifications();
    }
    if (this.userMenuOpen() && !target?.closest('.user-menu-wrap')) {
      this.closeUserMenu();
    }
  }

  private refreshNotificationsIfDashboard(url: string): void {
    if (this.isAdmin) {
      return;
    }
    const path = url.split('?')[0].split('#')[0];
    if (path === '/vendor/dashboard') {
      this.loadNotifications();
    }
  }

  private loadNotifications(): void {
    if (this.isAdmin) {
      return;
    }
    this.notificationsLoading.set(true);
    this.dashboardService.getOwnerDashboard().subscribe({
      next: (payload) => {
        this.notifications.set(payload.notifications.filter((n) => !n.isRead));
        this.unreadCount.set(payload.summary.unreadCount);
        this.notificationsLoading.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.unreadCount.set(0);
        this.notificationsLoading.set(false);
      },
    });
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

  /** Force a real scrollport on mobile â€” CSS flex height is unreliable in DevTools device mode. */
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
