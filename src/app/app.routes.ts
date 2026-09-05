import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { loginGuard, roleGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  // Login
  {
    path: 'login',
    component: Login,
    canActivate: [loginGuard],
  },

  // Admin routes
  {
    path: 'admin',
    loadComponent: () =>
      import('./dashboard/layout/dashboard-layout').then((m) => m.DashboardLayout),
    canActivate: [roleGuard('admin')],
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
        path: 'change-password',
        loadComponent: () =>
          import('./auth/change-password/change-password').then((m) => m.ChangePassword),
      },
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
      // {
      //   path: 'storefront',
      //   loadComponent: () =>
      //     import('./vendor/storefront/storefront').then((m) => m.VendorStorefront),
      // },
      {
        path: 'profile',
        loadComponent: () =>
          import('./vendor/profile/profile').then((m) => m.VendorProfile),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./auth/change-password/change-password').then((m) => m.ChangePassword),
      },
    ],
  },

  // Public storefront routes — /:storeCode/...
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

  // Default redirect
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
