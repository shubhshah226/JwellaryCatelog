import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'jc_app_theme';
  readonly theme = signal<AppTheme>('dark');

  init(): void {
    const saved = sessionStorage.getItem(this.storageKey) as AppTheme | null;
    this.applyTheme(saved === 'light' ? 'light' : 'dark', false);
  }

  resetToDark(): void {
    sessionStorage.removeItem(this.storageKey);
    this.applyTheme('dark', false);
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme, true);
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  private applyTheme(theme: AppTheme, persist: boolean): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);

    if (persist) {
      sessionStorage.setItem(this.storageKey, theme);
    }
  }
}
