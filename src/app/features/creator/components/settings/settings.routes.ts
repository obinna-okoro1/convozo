import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'profile',
    loadComponent: () =>
      import('app/shared/domain/creator-settings/views/profile-view/profile-view.component').then((m) => m.ProfileViewComponent),
  },
  {
    path: 'monetization',
    loadComponent: () =>
      import('app/shared/domain/creator-settings/views/monetization-view/monetization-view.component').then((m) => m.MonetizationViewComponent),
  },
  {
    path: 'shop',
    loadComponent: () =>
      import('app/shared/domain/creator-settings/views/shop-view/shop-view.component').then((m) => m.ShopViewComponent),
  },
  {
    path: 'payments',
    loadComponent: () =>
      import('app/shared/domain/creator-settings/views/payments-view/payments-view.component').then((m) => m.PaymentsViewComponent),
  },
  {
    path: '',
    redirectTo: 'profile',
    pathMatch: 'full',
  },
];
