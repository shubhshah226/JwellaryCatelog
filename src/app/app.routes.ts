import { Routes } from '@angular/router';
import { authGuard, loginGuard, roleGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  // Public marketing home
  {
    path: '',
    loadComponent: () =>
      import('./marketing/landing/landing').then((m) => m.Landing),
    pathMatch: 'full',
  },

  // Login
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
    canActivate: [loginGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
    canActivate: [loginGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/forgot-password/reset-password').then((m) => m.ResetPassword),
    canActivate: [loginGuard],
  },
  // API email links may use /reset?token=…
  {
    path: 'reset',
    loadComponent: () =>
      import('./auth/forgot-password/reset-password').then((m) => m.ResetPassword),
    canActivate: [loginGuard],
  },

  // Shared authenticated pages (same component for all roles)
  {
    path: 'common',
    loadComponent: () =>
      import('./dashboard/layout/dashboard-layout').then((m) => m.DashboardLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'changepassword',
        loadComponent: () =>
          import('./auth/change-password/change-password').then((m) => m.ChangePassword),
      },
      {
        path: 'access-denied',
        loadComponent: () =>
          import('./auth/access-denied/access-denied').then((m) => m.AccessDenied),
      },
    ],
  },

  // Super Admin routes (same pages as before; role renamed admin → superadmin)
  {
    path: 'superAdmin',
    loadComponent: () =>
      import('./dashboard/layout/dashboard-layout').then((m) => m.DashboardLayout),
    canActivate: [roleGuard('superadmin')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/dashboard/dashboard').then((m) => m.DashboardHome),
      },
      {
        path: 'vendors',
        loadComponent: () =>
          import('./admin/vendors/vendors').then((m) => m.Vendors),
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./auth/user-profile/user-profile').then((m) => m.UserProfilePage),
      },
      { path: 'change-password', redirectTo: '/common/changepassword', pathMatch: 'full' },
    ],
  },

  // Vendor routes
  {
    path: 'vendor',
    loadComponent: () =>
      import('./dashboard/layout/dashboard-layout').then((m) => m.DashboardLayout),
    canActivate: [roleGuard('vendor')],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/dashboard/dashboard').then((m) => m.DashboardHome),
      },
      {
        path: 'catalogs/new',
        loadComponent: () =>
          import('./vendor/catalogs/catalog-form').then((m) => m.VendorCatalogForm),
      },
      {
        path: 'catalogs/:id/edit',
        loadComponent: () =>
          import('./vendor/catalogs/catalog-form').then((m) => m.VendorCatalogForm),
      },
      {
        path: 'catalogs',
        loadComponent: () =>
          import('./vendor/catalogs/catalogs').then((m) => m.VendorCatalogs),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./vendor/products/product-form').then((m) => m.VendorProductForm),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./vendor/products/product-form').then((m) => m.VendorProductForm),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./vendor/products/products').then((m) => m.VendorProducts),
      },
      {
        path: 'master-data/new',
        loadComponent: () =>
          import('./vendor/master-data/master-data-form').then((m) => m.VendorMasterDataForm),
      },
      {
        path: 'master-data/:id/edit',
        loadComponent: () =>
          import('./vendor/master-data/master-data-form').then((m) => m.VendorMasterDataForm),
      },
      {
        path: 'master-data',
        loadComponent: () =>
          import('./vendor/master-data/master-data').then((m) => m.VendorMasterData),
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./vendor/leads/leads').then((m) => m.VendorLeads),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./vendor/profile/profile').then((m) => m.VendorProfile),
      },
      { path: 'change-password', redirectTo: '/common/changepassword', pathMatch: 'full' },
    ],
  },

  // Public shared catalog — matches API: {publicBaseUrl}/c/{token}
  {
    path: 'c/:token',
    loadComponent: () =>
      import('./storefront/pages/public-products/public-products').then(
        (m) => m.PublicProducts
      ),
  },

  // Legacy public storefront routes — /:storeCode/...
  {
    path: ':storeCode',
    children: [
      {
        path: 'home',
        redirectTo: 'products',
        pathMatch: 'full',
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./storefront/pages/public-products/public-products').then(
            (m) => m.PublicProducts
          ),
      },
      {
        // Legacy /:storeCode/c/:token — same page as /c/:token
        path: 'c/:shortCode',
        loadComponent: () =>
          import('./storefront/pages/public-products/public-products').then(
            (m) => m.PublicProducts
          ),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./storefront/pages/public-interest-cart/public-interest-cart').then(
            (m) => m.PublicInterestCart
          ),
      },
      { path: '', redirectTo: 'products', pathMatch: 'full' },
    ],
  },

  // Unknown paths → public home (not login)
  { path: '**', redirectTo: '' },
];
