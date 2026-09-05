import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly zone = inject(NgZone);
  private readonly activeCount = signal(0);
  private shownAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minVisibleMs = 280;

  readonly isLoading = computed(() => this.activeCount() > 0);

  show(): void {
    this.zone.run(() => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      if (this.activeCount() === 0) {
        this.shownAt = Date.now();
      }
      this.activeCount.update((n) => n + 1);
    });
  }

  hide(): void {
    this.zone.run(() => {
      const next = Math.max(0, this.activeCount() - 1);
      if (next > 0) {
        this.activeCount.set(next);
        return;
      }

      const elapsed = Date.now() - this.shownAt;
      const remaining = Math.max(0, this.minVisibleMs - elapsed);

      if (remaining === 0) {
        this.activeCount.set(0);
        return;
      }

      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
      }
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null;
        this.zone.run(() => this.activeCount.set(0));
      }, remaining);
    });
  }

  reset(): void {
    this.zone.run(() => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      this.activeCount.set(0);
    });
  }
}
