/**
 * Application Routes
 * Main routing configuration using feature-based lazy loading
 */

import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'creator',
    loadChildren: () => import('./features/creator/creator.routes').then(m => m.CREATOR_ROUTES),
  },
  // Public routes are at root level
  { 
    path: 'home', 
    loadComponent: () => import('./features/public/components/landing/landing.component').then(m => m.LandingComponent)
  },
  { 
    path: 'success', 
    loadComponent: () => import('./features/public/components/success/success.component').then(m => m.SuccessComponent)
  },
  { 
    path: ':slug', 
    loadComponent: () => import('./features/public/components/message-page/message-page.component').then(m => m.MessagePageComponent)
  },
];
