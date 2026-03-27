/**
 * Owner Toolbar Component
 *
 * Sticky top bar visible ONLY to the authenticated profile owner.
 * Desktop: inline row — Inbox | Bookings | Analytics | Settings | Sign Out
 * Mobile:  a compact "Manage" button that reveals a dropdown of the same actions.
 *
 * PANEL STRATEGY:
 *   All four panels (Inbox / Bookings / Analytics / Settings) use child routes
 *   (/:slug/<panel>) so the URL updates consistently, the back button closes the
 *   drawer naturally, and the active panel can be bookmarked / shared.
 *   The signal is kept in sync with the URL via a NavigationEnd subscription.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { OwnerSettingsPanelComponent } from './owner-settings-panel.component';
import { AnalyticsDashboardComponent } from '../../../../creator/components/analytics-dashboard/analytics-dashboard.component';
import { BookingsPanelComponent } from '../../../../creator/components/dashboard/bookings-panel/bookings-panel.component';
import { DeleteConfirmModalComponent } from '../../../../creator/components/dashboard/delete-confirm-modal/delete-confirm-modal.component';
import { InboxPanelComponent } from '../../../../creator/components/dashboard/inbox-panel/inbox-panel.component';
import { ProfileOwnerService } from '../services/profile-owner.service';

type ActivePanel = 'inbox' | 'bookings' | 'analytics' | 'settings' | null;

@Component({
  selector: 'app-owner-toolbar',
  standalone: true,
  imports: [
    InboxPanelComponent,
    BookingsPanelComponent,
    AnalyticsDashboardComponent,
    DeleteConfirmModalComponent,
    OwnerSettingsPanelComponent,
  ],
  templateUrl: './owner-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerToolbarComponent {
  protected readonly ownerState = inject(ProfileOwnerService);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly activePanel = signal<ActivePanel>(null);

  private readonly router = inject(Router);
  /** Stored to satisfy rxjs/no-ignored-subscription; takeUntilDestroyed() cleans it up. */
  private readonly _navSub: Subscription;

  constructor() {
    // Derive the active panel from the current URL for all four panels.
    const syncFromUrl = (): void => {
      const url = this.router.url;
      if (/\/inbox(\?|\/|$)/.test(url)) {
        this.activePanel.set('inbox');
      } else if (/\/bookings(\?|\/|$)/.test(url)) {
        this.activePanel.set('bookings');
      } else if (/\/analytics(\?|\/|$)/.test(url)) {
        this.activePanel.set('analytics');
      } else if (/\/settings(\?|\/|$)/.test(url)) {
        this.activePanel.set('settings');
      } else {
        this.activePanel.set(null);
      }
    };

    // Seed the signal from the current URL immediately (handles direct navigation).
    syncFromUrl();

    // Keep the signal in sync on every subsequent navigation.
    // Stored to satisfy rxjs/no-ignored-subscription; takeUntilDestroyed() cleans it up.
    this._navSub = this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        syncFromUrl();
      });
  }

  /**
   * Open a panel drawer and navigate to /:slug/<panel> so the URL updates
   * consistently across all four panels (inbox, bookings, analytics, settings).
   * The signal is set immediately (optimistic) so the active highlight appears
   * at once; syncFromUrl() on NavigationEnd will confirm/correct it.
   */
  protected openPanel(panel: ActivePanel): void {
    this.activePanel.set(panel);
    this.mobileMenuOpen.set(false);
    if (panel !== null) {
      const slug = this.ownerState.creatorSlug();
      if (slug) {
        void this.router.navigate([`/${slug}/${panel}`]);
      }
    }
  }

  /**
   * Close the active panel by navigating back to /:slug.
   * The URL change triggers syncFromUrl() which sets activePanel to null.
   */
  protected closePanel(): void {
    const slug = this.ownerState.creatorSlug();
    void this.router.navigate([slug ? `/${slug}` : '/home']);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  /**
   * Returns the full CSS class string for a toolbar panel tab button.
   * Using a method (rather than split static+dynamic bindings) ensures exactly
   * one set of classes is ever present, avoiding CSS cascade conflicts between
   * e.g. text-content-secondary and text-accent having equal specificity.
   */
  protected tabClass(panel: ActivePanel, relative = false): string {
    const rel = relative ? 'relative ' : '';
    if (this.activePanel() === panel) {
      return (
        rel +
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 bg-accent/10 text-accent'
      );
    }
    return (
      rel +
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 text-content-secondary hover:bg-accent/10 hover:text-content'
    );
  }

  /** Returns the CSS class string for the mobile settings icon button. */
  protected settingsIconClass(): string {
    if (this.activePanel() === 'settings') {
      return 'sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 bg-accent/10 text-accent';
    }
    return 'sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 text-content-secondary hover:bg-accent/10 hover:text-content';
  }

  protected async signOut(): Promise<void> {
    await this.ownerState.signOut();
  }
}
