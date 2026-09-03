import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const loginGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureSessionLoaded();

  if (authService.isAuthenticated()) {
    return router.createUrlTree([authService.getDashboardRoute()]);
  }

  return true;
};

export const roleGuard = (role: UserRole): CanActivateFn => {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.ensureSessionLoaded();

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (authService.getRole() !== role) {
      return router.createUrlTree([authService.getDashboardRoute()]);
    }

    return true;
  };
};
