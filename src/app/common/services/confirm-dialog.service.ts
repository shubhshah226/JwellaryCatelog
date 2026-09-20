import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use danger styling for destructive actions */
  tone?: 'default' | 'danger';
}

export interface ConfirmDialogState extends Required<
  Pick<ConfirmDialogOptions, 'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'tone'>
> {
  open: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private resolveFn: ((value: boolean) => void) | null = null;

  readonly state = signal<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'default',
  });

  /** Opens the confirmation dialog. Resolves `true` on confirm, `false` on cancel/dismiss. */
  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (this.resolveFn) {
      this.resolveFn(false);
      this.resolveFn = null;
    }

    this.state.set({
      open: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel?.trim() || 'Confirm',
      cancelLabel: options.cancelLabel?.trim() || 'Cancel',
      tone: options.tone ?? 'default',
    });

    return new Promise<boolean>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  accept(): void {
    this.close(true);
  }

  dismiss(): void {
    this.close(false);
  }

  private close(result: boolean): void {
    const resolve = this.resolveFn;
    this.resolveFn = null;
    this.state.update((current) => ({ ...current, open: false }));
    resolve?.(result);
  }
}
