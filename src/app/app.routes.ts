import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { 
    path: 'home', 
    loadComponent: () => import('./public/landing/landing.component').then(m => m.LandingComponent)
  },
  { 
    path: 'auth/login', 
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  { 
    path: 'auth/callback', 
    loadComponent: () => import('./auth/callback/callback.component').then(m => m.CallbackComponent)
  },
  { 
    path: 'creator/onboarding', 
    loadComponent: () => import('./creator/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  { 
    path: 'creator/dashboard', 
    loadComponent: () => import('./creator/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  { 
    path: 'success', 
    loadComponent: () => import('./public/success/success.component').then(m => m.SuccessComponent)
  },
  { 
    path: ':slug', 
    loadComponent: () => import('./public/message-page/message-page.component').then(m => m.MessagePageComponent)
  },
];
