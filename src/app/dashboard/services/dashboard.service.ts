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

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  refId: string | null;
  isRead: boolean;
  createdAt?: string;
}

export interface OwnerDashboardPayload {
  summary: {
    productCount: number;
    activeProductCount: number;
    outOfStockCount: number;
    catalogCount: number;
    liveCatalogCount: number;
    enquiryCount: number;
    newEnquiryCount: number;
    unreadCount: number;
  };
  notifications: DashboardNotification[];
}

interface ApiNotification {
  notificationId?: string;
  notificationType?: string;
  title?: string | null;
  body?: string | null;
  refId?: string | null;
  isRead?: boolean;
  createdAt?: string;
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
  notifications?: ApiNotification[];
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

  /** POST /dashboard/dashboardSummary — full owner payload including notifications. */
  getOwnerDashboard(): Observable<OwnerDashboardPayload> {
    return this.api.post<OwnerDashboardSummary>('/dashboard/dashboardSummary', {}).pipe(
      map((res) => this.normalizeOwnerPayload(res))
    );
  }

  /** POST /dashboard/markRead — mark selected (or all unread) notifications. */
  markNotificationsRead(notificationIds?: string[]): Observable<{ markedCount: number; unreadCount: number }> {
    return this.api
      .post<{
        success?: boolean;
        markedCount?: number;
        unreadCount?: number;
        message?: string | null;
      }>('/dashboard/markRead', {
        notificationIds: notificationIds?.length ? notificationIds : null,
      })
      .pipe(
        map((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || 'Unable to mark notifications read.');
          }
          return {
            markedCount: Number(res?.markedCount ?? 0),
            unreadCount: Number(res?.unreadCount ?? 0),
          };
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

    return this.getOwnerDashboard().pipe(
      map((payload) => this.buildOwnerDashboard(payload, userName)),
      catchError(() =>
        of(
          this.emptyDashboard(false, userName, 'Owner', 'Last 30 days', [
            this.stat('Products', 0, 'products', '#3b82f6'),
            this.stat('Catalogs', 0, 'catalogs', '#10b981'),
            this.stat('Enquiries', 0, 'enquiries', '#c9a227'),
            this.stat('Active Products', 0, 'vendors', '#f59e0b'),
          ])
        )
      )
    );
  }

  private normalizeOwnerPayload(res: OwnerDashboardSummary | null | undefined): OwnerDashboardPayload {
    const s = res?.summary ?? {};
    return {
      summary: {
        productCount: Number(s.productCount ?? 0),
        activeProductCount: Number(s.activeProductCount ?? 0),
        outOfStockCount: Number(s.outOfStockCount ?? 0),
        catalogCount: Number(s.catalogCount ?? 0),
        liveCatalogCount: Number(s.liveCatalogCount ?? 0),
        enquiryCount: Number(s.enquiryCount ?? 0),
        newEnquiryCount: Number(s.newEnquiryCount ?? 0),
        unreadCount: Number(s.unreadCount ?? 0),
      },
      notifications: (res?.notifications ?? []).map((n) => ({
        id: String(n.notificationId || ''),
        type: (n.notificationType || '').toLowerCase(),
        title: n.title || 'Notification',
        body: n.body || '',
        refId: n.refId ? String(n.refId) : null,
        isRead: !!n.isRead,
        createdAt: n.createdAt,
      })),
    };
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
      this.stat('New Vendors', summary.newTenantCount, 'vendors', '#c9a227'),
      this.stat('Products', summary.productCount, 'products', '#a8841a'),
      this.stat('Catalogs', summary.catalogCount, 'catalogs', '#14b8a6'),
      this.stat('Viewed Catalogs', summary.viewedCatalogCount, 'catalogs', '#0ea5e9'),
      this.stat('Enquiries', summary.enquiryCount, 'enquiries', '#ec4899'),
      this.stat('New Enquiries', summary.newEnquiryCount, 'enquiries', '#f43f5e'),
    ]);
  }

  private buildOwnerDashboard(payload: OwnerDashboardPayload, userName: string): DashboardData {
    const s = payload.summary;
    return this.emptyDashboard(false, userName, 'Owner', 'Last 30 days', [
      this.stat('Products', s.productCount, 'products', '#3b82f6'),
      this.stat('Active Products', s.activeProductCount, 'vendors', '#10b981'),
      this.stat('Out of Stock', s.outOfStockCount, 'enquiries', '#f59e0b'),
      this.stat('Catalogs', s.catalogCount, 'catalogs', '#14b8a6'),
      this.stat('Live Catalogs', s.liveCatalogCount, 'catalogs', '#0ea5e9'),
      this.stat('Enquiries', s.enquiryCount, 'enquiries', '#c9a227'),
      this.stat('New Enquiries', s.newEnquiryCount, 'enquiries', '#ec4899'),
      this.stat('Unread', s.unreadCount, 'enquiries', '#f43f5e'),
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
