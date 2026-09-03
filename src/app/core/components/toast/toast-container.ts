import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toastService.messages(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.type" role="status">
          <span class="toast-message">{{ toast.message }}</span>
          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss">
            âœ•
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      max-width: min(360px, calc(100vw - 2rem));
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      pointer-events: auto;
      animation: toastIn 0.25s ease;
      border: 1px solid transparent;
    }

    .toast-message {
      flex: 1;
      font-size: 0.9rem;
      line-height: 1.4;
      font-weight: 500;
    }

    .toast-close {
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.7;
      cursor: pointer;
      padding: 0;
      font-size: 0.85rem;
      line-height: 1;
    }

    .toast-close:hover {
      opacity: 1;
    }

    .toast-error {
      background: #7f1d1d;
      color: #fee2e2;
      border-color: rgba(254, 226, 226, 0.25);
    }

    .toast-success {
      background: #14532d;
      color: #dcfce7;
      border-color: rgba(220, 252, 231, 0.25);
    }

    .toast-info {
      background: #1e3a5f;
      color: #dbeafe;
      border-color: rgba(219, 234, 254, 0.25);
    }

    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
}
