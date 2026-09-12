import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalLoader } from './core/components/global-loader/global-loader';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalLoader],
  template: `
    <router-outlet></router-outlet>
    <app-global-loader></app-global-loader>
  `,
})
export class App {
  protected readonly title = signal('jwellary-catelog');
}
