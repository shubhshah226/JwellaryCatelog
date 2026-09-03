import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../auth/services/auth.service';

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
  logs: 'fa-solid fa-scroll',
};

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);

  readonly isSidebarOpen = signal(this.isDesktopViewport());

  readonly user = this.authService.getSession()?.user;
  readonly isAdmin = this.user?.role === 'admin';
  readonly baseRoute = this.isAdmin ? '/admin' : '/vendor';
  readonly roleLabel = this.isAdmin ? 'Super Admin' : 'Vendor';

  readonly adminNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Vendors', route: '/admin/vendors', icon: 'vendors' },
    { label: 'Users', route: '/admin/users', icon: 'users' },
    { label: 'Manage Roles', route: '/admin/roles', icon: 'roles' },
  ];

  readonly vendorNavItems: NavItem[] = [
    { label: 'Dashboard', route: '/vendor/dashboard', icon: 'dashboard' },
    { label: 'Catalogs', route: '/vendor/catalogs', icon: 'catalogs' },
    { label: 'Manage Products', route: '/vendor/products', icon: 'products' },
    { label: 'Manage Leads', route: '/vendor/leads', icon: 'leads' },
    { label: 'My Website', route: '/vendor/storefront', icon: 'storefront' },
    { label: 'Profile', route: '/vendor/profile', icon: 'profile' },
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
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncSidebarWithViewport();
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
    const current = this.visibleNavItems().find((item) => this.isNavActive(item.route));
    return current?.label ?? 'Dashboard';
  }

  isNavActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(`${route}/`);
  }

  logout(): void {
    this.authService.logout();
  }

  private isDesktopViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth > 900;
  }

  private syncSidebarWithViewport(): void {
    if (this.isDesktopViewport()) {
      this.isSidebarOpen.set(true);
    }
  }
}
