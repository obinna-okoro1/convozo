/**
 * Application Routes
 * Main routing configuration using feature-based lazy loading
 */

import { Routes } from '@angular/router';
import { MessagePageStateService } from './features/public/components/message-page/message-page-state.service';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'creator',
    loadChildren: () => import('./features/creator/creator.routes').then((m) => m.CREATOR_ROUTES),
  },
  // Public routes are at root level
  {
    path: 'home',
    loadComponent: () =>
      import('./features/public/components/landing/landing.component').then(
        (m) => m.LandingComponent,
      ),
  },
  {
    path: 'success',
    loadComponent: () =>
      import('./features/public/components/success/success.component').then(
        (m) => m.SuccessComponent,
      ),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/public/components/privacy-policy/privacy-policy.component').then(
        (m) => m.PrivacyPolicyComponent,
      ),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./features/public/components/terms-of-service/terms-of-service.component').then(
        (m) => m.TermsOfServiceComponent,
      ),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./features/public/components/message-page/message-page.component').then(
        (m) => m.MessagePageComponent,
      ),
    providers: [MessagePageStateService],
    loadChildren: () =>
      import('./features/public/components/message-page/message-page.routes').then(
        (m) => m.MESSAGE_PAGE_ROUTES,
      ),
  },
  {
    path: '**',
    redirectTo: '/home',
  },
];
