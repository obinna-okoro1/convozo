/**
 * Message Page Child Routes
 * Lazy-loaded views for each tab on the public message page.
 */

import { Routes } from '@angular/router';

export const MESSAGE_PAGE_ROUTES: Routes = [
  { path: '', redirectTo: 'links', pathMatch: 'full' },
  {
    path: 'links',
    loadComponent: () =>
      import('./views/links-view/links-view.component').then((m) => m.LinksViewComponent),
  },
  {
    path: 'message',
    loadComponent: () =>
      import('./views/message-view/message-view.component').then((m) => m.MessageViewComponent),
  },
  {
    path: 'follow-back',
    loadComponent: () =>
      import('./views/follow-back-view/follow-back-view.component').then(
        (m) => m.FollowBackViewComponent,
      ),
  },
  {
    path: 'call',
    loadComponent: () =>
      import('./views/call-view/call-view.component').then((m) => m.CallViewComponent),
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./views/support-view/support-view.component').then((m) => m.SupportViewComponent),
  },
  {
    path: 'shop',
    loadComponent: () =>
      import('./views/shop-view/shop-view.component').then((m) => m.ShopViewComponent),
  },
];
