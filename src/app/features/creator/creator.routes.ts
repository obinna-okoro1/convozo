/**
 * Creator Feature Routes
 * Handles creator-specific routes (onboarding).
 * All routes are protected with authGuard.
 *
 * NOTE: Settings are no longer at /creator/settings — they live at /:slug/settings
 * as a ghost route that opens the owner settings drawer panel.
 */

import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CREATOR_ROUTES: Routes = [
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./components/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'onboarding',
    pathMatch: 'full',
  },
];
