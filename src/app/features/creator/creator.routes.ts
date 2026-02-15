/**
 * Creator Feature Routes
 * Handles creator-specific routes (dashboard, onboarding)
 * All routes are protected with authGuard
 */

import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CREATOR_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./components/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
