/**
 * Message Page Child Routes
 * Lazy-loaded views for each tab on the public message page.
 *
 * Owner-only panel routes (inbox, bookings, analytics, settings) are "ghost" routes:
 * they render an empty placeholder in the RouterOutlet while the OwnerToolbarComponent
 * reads the URL and opens the appropriate bottom-sheet drawer on top.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Routes } from '@angular/router';

/** Renders nothing — the owner toolbar drawer handles the visual content for these routes. */
// eslint-disable-next-line @angular-eslint/component-max-inline-declarations
@Component({ template: '', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class OwnerPanelPlaceholderComponent {}

export const MESSAGE_PAGE_ROUTES: Routes = [
  // ── Home tab (default) — always the background view ──────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./views/links-view/links-view.component').then((m) => m.LinksViewComponent),
  },

  // ── Public panel routes (ghost — drawer rendered by MessagePageComponent) ──
  // These render an empty placeholder in the RouterOutlet while the
  // bottom-sheet drawer shows the real content on top of the links view.
  { path: 'message', component: OwnerPanelPlaceholderComponent },
  { path: 'call', component: OwnerPanelPlaceholderComponent },
  { path: 'shop', component: OwnerPanelPlaceholderComponent },
  { path: 'support', component: OwnerPanelPlaceholderComponent },
  { path: 'posts', component: OwnerPanelPlaceholderComponent },

  // ── Owner-only panel routes (ghost — drawer rendered by OwnerToolbarComponent) ──
  { path: 'inbox', component: OwnerPanelPlaceholderComponent },
  { path: 'bookings', component: OwnerPanelPlaceholderComponent },
  { path: 'analytics', component: OwnerPanelPlaceholderComponent },
  { path: 'settings', component: OwnerPanelPlaceholderComponent },
];
