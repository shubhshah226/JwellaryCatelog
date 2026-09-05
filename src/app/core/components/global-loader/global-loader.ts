import { Component, inject } from '@angular/core';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-global-loader',
  template: `
    @if (loading.isLoading()) {
      <div class="global-loader" role="status" aria-live="polite" aria-label="Loading">
        <div class="loader-panel">
          <svg viewBox="25 25 50 50" aria-hidden="true">
            <circle r="20" cy="50" cx="50"></circle>
          </svg>
          <p>Loading...</p>
        </div>
      </div>
    }
  `,
  styles: `
    .global-loader {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: grid;
      place-items: center;
      background: rgba(11, 15, 25, 0.45);
      backdrop-filter: blur(2px);
      pointer-events: all;
    }

    .loader-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    }

    .loader-panel p {
      margin: 0;
      font-size: 0.85rem;
      color: #e2e8f0;
      letter-spacing: 0.02em;
    }

    svg {
      width: 3.25em;
      transform-origin: center;
      animation: rotate4 2s linear infinite;
    }

    circle {
      fill: none;
      stroke: hsl(214, 97%, 59%);
      stroke-width: 2;
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
      stroke-linecap: round;
      animation: dash4 1.5s ease-in-out infinite;
    }

    @keyframes rotate4 {
      100% {
        transform: rotate(360deg);
      }
    }

    @keyframes dash4 {
      0% {
        stroke-dasharray: 1, 200;
        stroke-dashoffset: 0;
      }

      50% {
        stroke-dasharray: 90, 200;
        stroke-dashoffset: -35px;
      }

      100% {
        stroke-dashoffset: -125px;
      }
    }
  `,
})
export class GlobalLoader {
  readonly loading = inject(LoadingService);
}
