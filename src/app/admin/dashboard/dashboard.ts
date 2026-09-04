import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { EchartComponent } from '../../core/components/echart/echart';
import { ThemeService } from '../../core/services/theme.service';
import { DashboardData } from '../../dashboard/models/dashboard.model';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { buildDonutChartOptions, buildSalesChartOptions } from './dashboard-charts';

@Component({
  selector: 'app-dashboard-home',
  imports: [DecimalPipe, EchartComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardHome implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  readonly themeService = inject(ThemeService);

  readonly data = signal<DashboardData | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  readonly salesChartOptions = computed(() => {
    const dashboard = this.data();
    if (!dashboard) {
      return null;
    }
    return buildSalesChartOptions(dashboard.salesChart, this.themeService.theme() === 'dark');
  });

  readonly enquiryChartOptions = computed(() => {
    const dashboard = this.data();
    if (!dashboard) {
      return null;
    }
    return buildDonutChartOptions(
      dashboard.enquirySegments,
      dashboard.enquiryTotal,
      this.themeService.theme() === 'dark'
    );
  });

  readonly catalogChartOptions = computed(() => {
    const dashboard = this.data();
    if (!dashboard) {
      return null;
    }
    return buildDonutChartOptions(
      dashboard.catalogSegments,
      dashboard.catalogTotal,
      this.themeService.theme() === 'dark'
    );
  });

  ngOnInit(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'Unable to load dashboard data. Please ensure the API is running on port 8001.'
        );
        this.isLoading.set(false);
      },
    });
  }

  formatCurrency(amount: number): string {
    return this.dashboardService.formatCurrency(amount);
  }

  getEnquiryStatusClass(status: string): string {
    return `status-${status.replace('_', '-')}`;
  }
}
