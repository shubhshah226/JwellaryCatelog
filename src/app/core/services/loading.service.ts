import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly activeCount = signal(0);

  readonly isLoading = computed(() => this.activeCount() > 0);

  show(): void {
    this.activeCount.update((n) => n + 1);
  }

  hide(): void {
    this.activeCount.update((n) => Math.max(0, n - 1));
  }

  reset(): void {
    this.activeCount.set(0);
  }
}
