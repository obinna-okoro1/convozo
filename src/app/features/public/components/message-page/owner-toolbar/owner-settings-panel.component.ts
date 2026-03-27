/**
 * Owner Settings Panel Component
 *
 * Renders the full settings UI inside the owner toolbar's bottom-sheet drawer.
 * Provides SettingsStateService at the component level so all four settings views
 * (Profile, Monetization, Payments, Shop) resolve the correct service instance.
 *
 * Uses signal-based tab switching instead of router-based navigation, so it can live
 * inside the drawer overlay without requiring a nested RouterOutlet.
 *
 * The Cancel / goToProfile() calls inside the view components navigate to /:slug, which
 * naturally closes the settings drawer (the toolbar reads the URL and hides the drawer).
 */

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { SettingsStateService } from '../../../../creator/components/settings/settings-state.service';
import { MonetizationViewComponent } from '../../../../creator/components/settings/views/monetization-view/monetization-view.component';
import { PaymentsViewComponent } from '../../../../creator/components/settings/views/payments-view/payments-view.component';
import { ProfileViewComponent } from '../../../../creator/components/settings/views/profile-view/profile-view.component';
import { ShopViewComponent } from '../../../../creator/components/settings/views/shop-view/shop-view.component';

type SettingsTab = 'profile' | 'monetization' | 'payments' | 'shop';

interface SettingsTabDef {
  readonly id: SettingsTab;
  readonly label: string;
  readonly mobileLabel: string;
  readonly iconPath: string;
  readonly iconFill: boolean;
}

@Component({
  selector: 'app-owner-settings-panel',
  standalone: true,
  imports: [
    ProfileViewComponent,
    MonetizationViewComponent,
    PaymentsViewComponent,
    ShopViewComponent,
  ],
  /** Each time the drawer opens a fresh instance is created — provides clean isolated state. */
  providers: [SettingsStateService],
  templateUrl: './owner-settings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerSettingsPanelComponent implements OnInit {
  protected readonly state = inject(SettingsStateService);
  protected readonly currentTab = signal<SettingsTab>('profile');

  protected readonly tabs: SettingsTabDef[] = [
    {
      id: 'profile',
      label: 'Profile',
      mobileLabel: 'Profile',
      iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      iconFill: false,
    },
    {
      id: 'monetization',
      label: 'Monetization',
      mobileLabel: 'Monetize',
      iconPath:
        'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconFill: false,
    },
    {
      id: 'payments',
      label: 'Payments',
      mobileLabel: 'Pay',
      iconPath:
        'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      iconFill: false,
    },
    {
      id: 'shop',
      label: 'Shop',
      mobileLabel: 'Shop',
      iconPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
      iconFill: false,
    },
  ];

  public ngOnInit(): void {
    void this.state.loadCreatorData();
  }

  protected setTab(tab: SettingsTab): void {
    this.currentTab.set(tab);
  }
}
