/**
 * Auth Feature Routes
 * Handles authentication-related routes (login, callback)
 */

import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent),
  },
  {
    path: 'callback',
    loadComponent: () => import('./components/callback/callback.component').then(m => m.CallbackComponent),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
