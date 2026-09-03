import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalLoader } from './core/components/global-loader/global-loader';
import { ToastContainer } from './core/components/toast/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalLoader, ToastContainer],
  template: `
    <router-outlet></router-outlet>
    <app-global-loader></app-global-loader>
    <app-toast-container></app-toast-container>
  `,
})
export class App {
  protected readonly title = signal('jwellary-catelog');
}
