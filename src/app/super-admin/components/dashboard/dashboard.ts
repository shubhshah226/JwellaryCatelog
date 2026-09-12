import { Component, OnInit, inject, signal } from '@angular/core';
import { DashboardData } from '@common/models/dashboard.model';
import { DashboardService } from '@common/services/dashboard.service';
import { DecimalPipe } from '@angular/common';

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
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load dashboard data.');
        this.isLoading.set(false);
      },
    });
  }
}
