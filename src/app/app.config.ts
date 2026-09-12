import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { AuthService } from './auth/services/auth.service';
import { authInterceptor } from './core/api/auth.interceptor';
import { loadingInterceptor } from './core/api/loading.interceptor';
import { customerSessionInterceptor } from './core/api/customer-session.interceptor';

/** Decrypt session into memory before first navigation / API call. */
function initAuthSession(auth: AuthService): () => Promise<void> {
  return () => auth.ensureSessionLoaded();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuthSession,
      deps: [AuthService],
      multi: true,
    },
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([authInterceptor, customerSessionInterceptor, loadingInterceptor])
    ),
    provideAnimations(),
    provideToastr({
      positionClass: 'toast-bottom-right',
      timeOut: 3500,
      preventDuplicates: true,
      progressBar: false,
      closeButton: false,
      newestOnTop: true,
      tapToDismiss: true,
    }),
  ],
};
