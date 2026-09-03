import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DashboardData } from '../../dashboard/models/dashboard.model';
import { DashboardService } from '../../dashboard/services/dashboard.service';

@Component({
  selector: 'app-dashboard-home',
  imports: [DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardHome implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  readonly data = signal<DashboardData | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load dashboard data. Please start json-server.');
        this.isLoading.set(false);
      },
    });
  }

  formatCurrency(amount: number): string {
    return this.dashboardService.formatCurrency(amount);
  }

  formatCompactCurrency(amount: number): string {
    return this.dashboardService.formatCompactCurrency(amount);
  }

  visibleSalesLabels(points: { date: string; label: string }[]): { date: string; label: string }[] {
    if (points.length <= 6) {
      return points;
    }
    const last = points.length - 1;
    const step = Math.max(1, Math.ceil(last / 5));
    const picked: { date: string; label: string }[] = [];
    for (let i = 0; i < points.length; i += step) {
      picked.push(points[i]);
    }
    const lastPoint = points[last];
    if (picked[picked.length - 1]?.date !== lastPoint.date) {
      picked.push(lastPoint);
    }
    return picked;
  }

  getSalesPath(points: { x: number; y: number }[]): string {
    if (!points.length) {
      return '';
    }

    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }

  getSalesAreaPath(points: { x: number; y: number }[]): string {
    if (!points.length) {
      return '';
    }

    const line = this.getSalesPath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${line} L ${last.x} 100 L ${first.x} 100 Z`;
  }

  getDonutSegments(segments: { percentage: number; color: string; offset: number }[]): string {
    return segments
      .map(
        (segment) =>
          `${segment.color} ${segment.offset}% ${segment.offset + segment.percentage}%`
      )
      .join(', ');
  }

  getEnquiryStatusClass(status: string): string {
    return `status-${status.replace('_', '-')}`;
  }
}
