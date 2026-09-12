import { Component, OnInit, inject, signal } from '@angular/core';
import { DashboardData } from '../../dashboard/models/dashboard.model';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-dashboard-home',
  imports: [DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardHome implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly toast = inject(ToastService);

  readonly data = signal<DashboardData | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        const detail =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message || '')
            : '';
        this.toast.error(
          detail ||
            'Unable to load dashboard data. Please ensure the API is running on port 8400.'
        );
        this.errorMessage.set('Unable to load dashboard data.');
        this.isLoading.set(false);
      },
    });
  }
}
