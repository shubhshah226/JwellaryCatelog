import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { AuthService } from '../../auth/services/auth.service';
import { DashboardData, DashboardSummary, StatCard } from '../models/dashboard.model';

/** Response from POST /admin/platformSummary (camel or snake). */
interface PlatformSummary {
  tenantCount?: number;
  activeTenantCount?: number;
  suspendedTenantCount?: number;
  newTenantCount?: number;
  productCount?: number;
  catalogCount?: number;
  viewedCatalogCount?: number;
  enquiryCount?: number;
  newEnquiryCount?: number;
  tenant_count?: number;
  active_tenant_count?: number;
  suspended_tenant_count?: number;
  new_tenant_count?: number;
  product_count?: number;
  catalog_count?: number;
  viewed_catalog_count?: number;
  enquiry_count?: number;
  new_enquiry_count?: number;
}

interface OwnerDashboardSummary {
  summary?: {
    productCount?: number;
    activeProductCount?: number;
    outOfStockCount?: number;
    catalogCount?: number;
    liveCatalogCount?: number;
    enquiryCount?: number;
    newEnquiryCount?: number;
    unreadCount?: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly api = inject(ApiHttpService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Raw platform summary from POST /admin/platformSummary */
  getDashboard(): Observable<DashboardSummary> {
    return this.api.post<PlatformSummary>('/admin/platformSummary', {}).pipe(
      map((res) => {
        const n = this.normalizePlatformSummary(res);
        const summary = new DashboardSummary();
        summary.tenantCount = n.tenantCount;
        summary.activeTenantCount = n.activeTenantCount;
        summary.suspendedTenantCount = n.suspendedTenantCount;
        summary.newTenantCount = n.newTenantCount;
        summary.productCount = n.productCount;
        summary.catalogCount = n.catalogCount;
        summary.viewedCatalogCount = n.viewedCatalogCount;
        summary.enquiryCount = n.enquiryCount;
        summary.newEnquiryCount = n.newEnquiryCount;
        return summary;
      })
    );
  }

  getDashboardData(): Observable<DashboardData> {
    const session = this.authService.getSession();
    const userName = session?.user?.name || 'User';
    const isAdmin =
      this.authService.getRole() === 'superadmin' ||
      this.router.url.toLowerCase().includes('/superadmin');

    if (isAdmin) {
      return this.getDashboard().pipe(
        map((summary) => this.buildAdminDashboard(summary, userName))
      );
    }

    return this.api.post<OwnerDashboardSummary>('/dashboard/dashboardSummary', {}).pipe(
      map((summary) => this.buildOwnerDashboard(summary, userName)),
      catchError(() =>
        of(
          this.emptyDashboard(false, userName, 'Owner', 'Last 30 days', [
            this.stat('Products', 0, 'products', '#3b82f6'),
            this.stat('Catalogs', 0, 'catalogs', '#10b981'),
            this.stat('Enquiries', 0, 'enquiries', '#a855f7'),
            this.stat('Active Products', 0, 'vendors', '#f59e0b'),
          ])
        )
      )
    );
  }

  private normalizePlatformSummary(raw: PlatformSummary | null | undefined) {
    const s = raw ?? {};
    const n = (...vals: unknown[]) => {
      for (const v of vals) {
        if (v != null && v !== '') {
          const num = Number(v);
          if (Number.isFinite(num)) {
            return num;
          }
        }
      }
      return 0;
    };

    return {
      tenantCount: n(s.tenantCount, s.tenant_count),
      activeTenantCount: n(s.activeTenantCount, s.active_tenant_count),
      suspendedTenantCount: n(s.suspendedTenantCount, s.suspended_tenant_count),
      newTenantCount: n(s.newTenantCount, s.new_tenant_count),
      productCount: n(s.productCount, s.product_count),
      catalogCount: n(s.catalogCount, s.catalog_count),
      viewedCatalogCount: n(s.viewedCatalogCount, s.viewed_catalog_count),
      enquiryCount: n(s.enquiryCount, s.enquiry_count),
      newEnquiryCount: n(s.newEnquiryCount, s.new_enquiry_count),
    };
  }

  private buildAdminDashboard(summary: DashboardSummary, userName: string): DashboardData {
    return this.emptyDashboard(true, userName, 'Super Admin', 'Platform', [
      this.stat('Vendors', summary.tenantCount, 'vendors', '#3b82f6'),
      this.stat('Active', summary.activeTenantCount, 'products', '#10b981'),
      this.stat('Suspended', summary.suspendedTenantCount, 'enquiries', '#f59e0b'),
      this.stat('New Vendors', summary.newTenantCount, 'vendors', '#6366f1'),
      this.stat('Products', summary.productCount, 'products', '#a855f7'),
      this.stat('Catalogs', summary.catalogCount, 'catalogs', '#14b8a6'),
      this.stat('Viewed Catalogs', summary.viewedCatalogCount, 'catalogs', '#0ea5e9'),
      this.stat('Enquiries', summary.enquiryCount, 'enquiries', '#ec4899'),
      this.stat('New Enquiries', summary.newEnquiryCount, 'enquiries', '#f43f5e'),
    ]);
  }

  private buildOwnerDashboard(summary: OwnerDashboardSummary, userName: string): DashboardData {
    const s = summary?.summary ?? {};
    return this.emptyDashboard(false, userName, 'Owner', 'Last 30 days', [
      this.stat('Products', Number(s.productCount ?? 0), 'products', '#3b82f6'),
      this.stat('Active Products', Number(s.activeProductCount ?? 0), 'vendors', '#10b981'),
      this.stat('Out of Stock', Number(s.outOfStockCount ?? 0), 'enquiries', '#f59e0b'),
      this.stat('Catalogs', Number(s.catalogCount ?? 0), 'catalogs', '#14b8a6'),
      this.stat('Live Catalogs', Number(s.liveCatalogCount ?? 0), 'catalogs', '#0ea5e9'),
      this.stat('Enquiries', Number(s.enquiryCount ?? 0), 'enquiries', '#a855f7'),
      this.stat('New Enquiries', Number(s.newEnquiryCount ?? 0), 'enquiries', '#ec4899'),
      this.stat('Unread', Number(s.unreadCount ?? 0), 'enquiries', '#f43f5e'),
    ]);
  }

  private emptyDashboard(
    isAdmin: boolean,
    userName: string,
    roleLabel: string,
    dateRange: string,
    stats: StatCard[]
  ): DashboardData {
    return {
      isAdmin,
      userName,
      roleLabel,
      dateRange,
      stats,
      salesChart: [],
      salesMax: 1,
      topVendors: [],
      enquirySegments: [],
      enquiryTotal: 0,
      catalogSegments: [],
      catalogTotal: 0,
      recentEnquiries: [],
      vendorSalesTotal: 0,
    };
  }

  private stat(
    label: string,
    value: number,
    icon: StatCard['icon'],
    color: string
  ): StatCard {
    return { label, value, change: 0, icon, color };
  }
}
