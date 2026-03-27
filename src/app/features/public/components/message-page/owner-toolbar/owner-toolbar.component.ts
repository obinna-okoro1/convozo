/**
 * Owner Toolbar Component
 *
 * Sticky top bar visible ONLY to the authenticated profile owner.
 * Desktop: inline row — Inbox | Bookings | Analytics | Settings | Sign Out
 * Mobile:  a compact "Manage ≡" button that reveals a dropdown of the same actions.
 *
 * Clicking Inbox / Bookings / Analytics opens a 90 vh bottom-sheet drawer
 * that renders the existing panel components (which accept data as inputs,
 * so no DashboardStateService injection required here).
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileOwnerService } from '../services/profile-owner.service';
import { InboxPanelComponent } from '../../../../creator/components/dashboard/inbox-panel/inbox-panel.component';
import { BookingsPanelComponent } from '../../../../creator/components/dashboard/bookings-panel/bookings-panel.component';
import { AnalyticsDashboardComponent } from '../../../../creator/components/analytics-dashboard/analytics-dashboard.component';
import { DeleteConfirmModalComponent } from '../../../../creator/components/dashboard/delete-confirm-modal/delete-confirm-modal.component';

type ActivePanel = 'inbox' | 'bookings' | 'analytics' | null;

@Component({
  selector: 'app-owner-toolbar',
  standalone: true,
  imports: [
    RouterLink,
    InboxPanelComponent,
    BookingsPanelComponent,
    AnalyticsDashboardComponent,
    DeleteConfirmModalComponent,
  ],
  templateUrl: './owner-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerToolbarComponent {
  protected readonly ownerState = inject(ProfileOwnerService);

  /** Currently open drawer — null = all panels closed. */
  protected readonly activePanel = signal<ActivePanel>(null);

  /** Whether the mobile dropdown is open. */
  protected readonly mobileMenuOpen = signal(false);

  protected openPanel(panel: ActivePanel): void {
    this.activePanel.set(panel);
    this.mobileMenuOpen.set(false);
  }

  protected closePanel(): void {
    this.activePanel.set(null);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.ownerState.signOut();
  }
}
