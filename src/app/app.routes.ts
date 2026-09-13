import { Routes } from '@angular/router';
import { authGuard, loginGuard, roleGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  // Public marketing home
  {
    path: '',
    loadComponent: () =>
      import('./marketing/components/landing/landing').then((m) => m.Landing),
    pathMatch: 'full',
  },

  // Login / password recovery
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/components/login/login').then((m) => m.Login),
    canActivate: [loginGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./auth/components/forgot-password/forgot-password').then(
        (m) => m.ForgotPassword
      ),
    canActivate: [loginGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/components/forgot-password/reset-password').then(
        (m) => m.ResetPassword
      ),
    canActivate: [loginGuard],
  },
  {
    path: 'reset',
    loadComponent: () =>
      import('./auth/components/forgot-password/reset-password').then(
        (m) => m.ResetPassword
      ),
    canActivate: [loginGuard],
  },

  // Shared authenticated pages
  {
    path: 'common',
    loadComponent: () =>
      import('./common/components/dashboard-layout/dashboard-layout').then(
        (m) => m.DashboardLayout
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'changepassword',
        loadComponent: () =>
          import('./auth/components/change-password/change-password').then(
            (m) => m.ChangePassword
          ),
      },
      {
        path: 'access-denied',
        loadComponent: () =>
          import('./auth/components/access-denied/access-denied').then(
            (m) => m.AccessDenied
          ),
      },
    ],
  },

  // Super Admin
  {
    path: 'superAdmin',
    loadComponent: () =>
      import('./common/components/dashboard-layout/dashboard-layout').then(
        (m) => m.DashboardLayout
      ),
    canActivate: [roleGuard('superadmin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./super-admin/components/dashboard/dashboard').then(
            (m) => m.DashboardHome
          ),
      },
      {
        path: 'vendors',
        loadComponent: () =>
          import('./super-admin/components/vendors/vendors').then((m) => m.Vendors),
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./auth/components/user-profile/user-profile').then(
            (m) => m.UserProfilePage
          ),
      },
      { path: 'change-password', redirectTo: '/common/changepassword', pathMatch: 'full' },
    ],
  },

  // Owner (tenant) — URL stays /vendor for compatibility
  {
    path: 'vendor',
    loadComponent: () =>
      import('./common/components/dashboard-layout/dashboard-layout').then(
        (m) => m.DashboardLayout
      ),
    canActivate: [roleGuard('owner')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./super-admin/components/dashboard/dashboard').then(
            (m) => m.DashboardHome
          ),
      },
      {
        path: 'catalogs/new',
        loadComponent: () =>
          import('./owner/components/catalogs/catalog-form').then(
            (m) => m.VendorCatalogForm
          ),
      },
      {
        path: 'catalogs/:id/edit',
        loadComponent: () =>
          import('./owner/components/catalogs/catalog-form').then(
            (m) => m.VendorCatalogForm
          ),
      },
      {
        path: 'catalogs',
        loadComponent: () =>
          import('./owner/components/catalogs/catalogs').then((m) => m.VendorCatalogs),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./owner/components/products/product-form').then(
            (m) => m.VendorProductForm
          ),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./owner/components/products/product-form').then(
            (m) => m.VendorProductForm
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./owner/components/products/products').then((m) => m.VendorProducts),
      },
      {
        path: 'master-data/new',
        redirectTo: 'master-data',
        pathMatch: 'full',
      },
      {
        path: 'master-data/:id/edit',
        redirectTo: 'master-data',
        pathMatch: 'full',
      },
      {
        path: 'master-data',
        loadComponent: () =>
          import('./owner/components/master-data/master-data').then(
            (m) => m.VendorMasterData
          ),
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./owner/components/leads/leads').then((m) => m.VendorLeads),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./owner/components/profile/profile').then((m) => m.VendorProfile),
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./auth/components/user-profile/user-profile').then(
            (m) => m.UserProfilePage
          ),
      },
      { path: 'change-password', redirectTo: '/common/changepassword', pathMatch: 'full' },
    ],
  },

  // Public shared catalog — /c/{token}
  {
    path: 'c/:token/cart',
    loadComponent: () =>
      import('./public/components/public-interest-cart/public-interest-cart').then(
        (m) => m.PublicInterestCart
      ),
  },
  {
    path: 'c/:token',
    loadComponent: () =>
      import('./public/components/public-products/public-products').then(
        (m) => m.PublicProducts
      ),
  },

  // Unknown / invalid URLs
  {
    path: '**',
    loadComponent: () =>
      import('./common/components/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
