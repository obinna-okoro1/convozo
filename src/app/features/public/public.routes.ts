import { Routes } from '@angular/router';
import { MessagePageStateService } from './components/message-page/message-page-state.service';

export const PUBLIC_ROUTES: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./components/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'success',
    loadComponent: () =>
      import('./components/success/success.component').then((m) => m.SuccessComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./components/message-page/message-page.component').then(
        (m) => m.MessagePageComponent,
      ),
    providers: [MessagePageStateService],
    loadChildren: () =>
      import('./components/message-page/message-page.routes').then(
        (m) => m.MESSAGE_PAGE_ROUTES,
      ),
  },
];
