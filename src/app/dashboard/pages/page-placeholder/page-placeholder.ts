import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-placeholder',
  imports: [],
  template: `
    <div class="placeholder-page">
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
    </div>
  `,
  styles: [`
    .placeholder-page {
      padding: 2rem;
      border-radius: 14px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
    }
    h2 { margin: 0 0 0.5rem; color: var(--app-text); }
    p { margin: 0; color: var(--app-text-muted); }
  `],
})
export class PagePlaceholder {
  title = input('Coming Soon');
  message = input('This section is under development.');
}
