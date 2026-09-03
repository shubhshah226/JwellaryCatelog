import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messagesSignal = signal<ToastMessage[]>([]);
  private nextId = 1;

  readonly messages = this.messagesSignal.asReadonly();

  success(message: string, durationMs = 3500): void {
    this.show('success', message, durationMs);
  }

  error(message: string, durationMs = 4000): void {
    this.show('error', message, durationMs);
  }

  info(message: string, durationMs = 3500): void {
    this.show('info', message, durationMs);
  }

  dismiss(id: number): void {
    this.messagesSignal.update((list) => list.filter((t) => t.id !== id));
  }

  private show(type: ToastType, message: string, durationMs: number): void {
    const id = this.nextId++;
    this.messagesSignal.update((list) => [...list, { id, type, message }]);
    window.setTimeout(() => this.dismiss(id), durationMs);
  }
}
