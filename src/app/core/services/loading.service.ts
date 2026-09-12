import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly zone = inject(NgZone);
  /** In-flight API request count (always decremented immediately on hide). */
  private readonly pendingCount = signal(0);
  /** UI visibility — can lag behind pendingCount for a short min-visible time. */
  private readonly uiVisible = signal(false);
  private shownAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minVisibleMs = 280;

  readonly isLoading = computed(() => this.uiVisible());

  show(): void {
    this.zone.run(() => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      const wasIdle = this.pendingCount() === 0;
      this.pendingCount.update((n) => n + 1);
      if (wasIdle) {
        this.shownAt = Date.now();
      }
      this.uiVisible.set(true);
    });
  }

  hide(): void {
    this.zone.run(() => {
      this.pendingCount.update((n) => Math.max(0, n - 1));
      if (this.pendingCount() > 0) {
        return;
      }

      const elapsed = Date.now() - this.shownAt;
      const remaining = Math.max(0, this.minVisibleMs - elapsed);

      if (remaining === 0) {
        this.uiVisible.set(false);
        return;
      }

      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
      }
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null;
        this.zone.run(() => {
          if (this.pendingCount() === 0) {
            this.uiVisible.set(false);
          }
        });
      }, remaining);
    });
  }

  reset(): void {
    this.zone.run(() => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      this.pendingCount.set(0);
      this.uiVisible.set(false);
    });
  }
}
