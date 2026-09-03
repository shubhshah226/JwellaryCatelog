import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { ApiHttpService } from '../../core/api/api-http.service';
import { relativeTimeFromUtc } from '../../core/utils/date-time.util';
import { AuthService } from '../../auth/services/auth.service';
import {
  ChartPoint,
  DashboardData,
  DonutSegment,
  Enquiry,
  EnquiryStatus,
  SaleRecord,
  StatCard,
  Vendor,
} from '../models/dashboard.model';
import { VendorAccount } from '../models/vendor.model';

interface DashboardSummary {
  vendorsCount: number;
  catalogsCount: number;
  productsCount: number;
  leadsCount: number;
  sales: SaleRecord[];
  meta: { dateRange: string };
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly api = inject(ApiHttpService);
  private readonly authService = inject(AuthService);

  getDashboardData(): Observable<DashboardData> {
    const session = this.authService.getSession();
    const isAdmin = session?.user.role === 'admin';

    return forkJoin({
      summary: this.api.get<DashboardSummary>('/dashboard/summary'),
      vendors: isAdmin
        ? this.api.get<VendorAccount[]>('/admin/vendors')
        : of([] as VendorAccount[]),
      leads: !isAdmin
        ? this.api.get<Enquiry[]>('/vendor/leads', { page: 1, pageSize: 10 })
        : of([] as Enquiry[]),
    }).pipe(map((data) => this.buildDashboard(data.summary, data.vendors, data.leads, isAdmin)));
  }

  private buildDashboard(
    summary: DashboardSummary,
    vendors: VendorAccount[],
    leads: Enquiry[],
    isAdmin: boolean
  ): DashboardData {
    const session = this.authService.getSession();
    const salesChart = this.buildSalesChart(summary.sales ?? []);
    const salesMax = Math.max(...salesChart.map((point) => point.amount), 1);
    const topVendors: Vendor[] = isAdmin
      ? [...vendors]
          .sort((a, b) => Number(a.rank) - Number(b.rank))
          .slice(0, 5)
          .map((v) => ({
            id: Number(v.id),
            userId: v.userId,
            name: v.name,
            initials: v.initials,
            catalogsCount: Number(v.catalogsCount ?? 0),
            totalSales: Number(v.totalSales ?? 0),
            rank: Number(v.rank ?? 0),
          }))
      : [];

    const recentEnquiries = leads.slice(0, 4).map((l) => ({
      ...l,
      id: Number(l.id),
      timeAgo: l.timeAgo || this.relativeTime(l.createdAt),
      initials: l.initials || this.initials(l.customerName),
    }));

    return {
      isAdmin,
      userName: session?.user.name ?? 'User',
      roleLabel: isAdmin ? 'Super Admin' : 'Vendor',
      dateRange: summary.meta?.dateRange ?? 'Last 30 days',
      stats: this.buildStats(summary, isAdmin),
      salesChart: salesChart.map((point) => ({
        ...point,
        y: 100 - (point.amount / salesMax) * 100,
      })),
      salesMax,
      topVendors,
      enquirySegments: this.buildEnquirySegments(leads, summary.leadsCount),
      enquiryTotal: summary.leadsCount,
      catalogSegments: this.buildSimpleCatalogSegments(summary.catalogsCount),
      catalogTotal: summary.catalogsCount,
      recentEnquiries,
      vendorSalesTotal: (summary.sales ?? []).reduce((sum, sale) => sum + Number(sale.amount), 0),
    };
  }

  private buildStats(summary: DashboardSummary, isAdmin: boolean): StatCard[] {
    return [
      {
        label: 'Total Vendors',
        value: summary.vendorsCount,
        change: 0,
        icon: 'vendors' as const,
        color: '#a855f7',
        hidden: !isAdmin,
      },
      {
        label: 'Total Catalogs',
        value: summary.catalogsCount,
        change: 0,
        icon: 'catalogs' as const,
        color: '#3b82f6',
      },
      {
        label: 'Total Products',
        value: summary.productsCount,
        change: 0,
        icon: 'products' as const,
        color: '#f59e0b',
      },
      {
        label: 'Total Enquiries',
        value: summary.leadsCount,
        change: 0,
        icon: 'enquiries' as const,
        color: '#10b981',
      },
    ].filter((stat) => !stat.hidden);
  }

  private buildSalesChart(sales: SaleRecord[]): ChartPoint[] {
    const grouped = new Map<string, number>();
    sales.forEach((sale) => {
      grouped.set(sale.date, (grouped.get(sale.date) ?? 0) + Number(sale.amount));
    });
    const sortedDates = [...grouped.keys()].sort();
    const maxIndex = Math.max(sortedDates.length - 1, 1);
    return sortedDates.map((date, index) => ({
      date,
      label: this.formatDateLabel(date),
      amount: grouped.get(date) ?? 0,
      x: (index / maxIndex) * 100,
      y: 0,
    }));
  }

  private buildEnquirySegments(leads: Enquiry[], totalCount: number): DonutSegment[] {
    const statuses: { key: EnquiryStatus; label: string; color: string }[] = [
      { key: 'new', label: 'New', color: '#a855f7' },
      { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
      { key: 'responded', label: 'Responded', color: '#f59e0b' },
      { key: 'closed', label: 'Closed', color: '#10b981' },
    ];
    const total = totalCount || leads.length || 1;
    let offset = 0;

    if (!leads.length) {
      return [
        {
          label: 'Leads',
          value: totalCount,
          percentage: 100,
          color: '#a855f7',
          offset: 0,
        },
      ];
    }

    return statuses.map((status) => {
      const value = leads.filter((enquiry) => enquiry.status === status.key).length;
      const segment: DonutSegment = {
        label: status.label,
        value,
        percentage: Math.round((value / total) * 100),
        color: status.color,
        offset,
      };
      offset += (value / total) * 100;
      return segment;
    });
  }

  private buildSimpleCatalogSegments(count: number): DonutSegment[] {
    return [
      {
        label: 'Active',
        value: count,
        percentage: 100,
        color: '#10b981',
        offset: 0,
      },
    ];
  }

  private formatDateLabel(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private relativeTime(iso?: string): string {
    return relativeTimeFromUtc(iso);
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  formatCurrency(amount: number): string {
    return `â‚¹ ${amount.toLocaleString('en-IN')}`;
  }

  formatCompactCurrency(amount: number): string {
    if (amount >= 100000) {
      return `â‚¹ ${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `â‚¹ ${(amount / 1000).toFixed(1)}K`;
    }
    return this.formatCurrency(amount);
  }
}
