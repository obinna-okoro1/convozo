/**
 * Dashboard Child Routes
 * Each tab view is a lazy-loaded child route under /creator/dashboard/
 */

import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'links',
    loadComponent: () =>
      import('./views/links-view/links-view.component').then((m) => m.LinksViewComponent),
  },
  {
    path: 'inbox',
    loadComponent: () =>
      import('./views/inbox-view/inbox-view.component').then((m) => m.InboxViewComponent),
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./views/bookings-view/bookings-view.component').then((m) => m.BookingsViewComponent),
  },
  {
    // Availability is now embedded in Settings > Monetization > Video Calls.
    // Redirect any old bookmarked links gracefully.
    path: 'availability',
    redirectTo: 'bookings',
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./views/analytics-view/analytics-view.component').then(
        (m) => m.AnalyticsViewComponent,
      ),
  },
  {
    path: '',
    redirectTo: 'links',
    pathMatch: 'full',
  },
];
