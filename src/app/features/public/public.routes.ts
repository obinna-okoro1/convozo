/**
 * Public Feature Routes
 * Handles public-facing routes (landing, message pages, success)
 */

import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'success',
    loadComponent: () => import('./components/success/success.component').then(m => m.SuccessComponent),
  },
  {
    path: ':slug',
    loadComponent: () => import('./components/message-page/message-page.component').then(m => m.MessagePageComponent),
  },
];
