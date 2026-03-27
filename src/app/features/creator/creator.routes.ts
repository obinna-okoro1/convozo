/**
 * Creator Feature Routes
 * Handles creator-specific routes (dashboard, onboarding)
 * All routes are protected with authGuard
 */

import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { SettingsStateService } from './components/settings/settings-state.service';

export const CREATOR_ROUTES: Routes = [
  {
    path: 'links',
    loadComponent: () =>
      import('../link-in-bio/pages/edit-links/edit-links.component').then(
        (m) => m.EditLinksComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
    providers: [SettingsStateService],
    loadChildren: () =>
      import('./components/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./components/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: 'settings',
    pathMatch: 'full',
  },
];
