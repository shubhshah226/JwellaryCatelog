import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { GlobalLoader } from './core/components/global-loader/global-loader';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalLoader],
  template: `
    <router-outlet></router-outlet>
    <app-global-loader></app-global-loader>
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = signal('jwellary-catelog');

  constructor() {
    // After each navigation, clear a stuck overlay only when no requests remain.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        queueMicrotask(() => this.loading.reconcile());
      });
  }
}
