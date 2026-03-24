import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface Tab {
  readonly path: string;
  readonly label: string;
  readonly mobileLabel: string;
  readonly iconPath: string;
  readonly iconFill: boolean;
}

@Component({
  selector: 'app-settings-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './settings-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsTabsComponent {
  protected readonly tabs: Tab[] = [
    {
      path: 'profile',
      label: 'Profile',
      mobileLabel: 'Profile',
      iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      iconFill: false,
    },
    {
      path: 'monetization',
      label: 'Monetization',
      mobileLabel: 'Monetize',
      iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconFill: false,
    },
    {
      path: 'shop',
      label: 'Products',
      mobileLabel: 'Products',
      iconPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
      iconFill: false,
    },
    {
      path: 'payments',
      label: 'Payments',
      mobileLabel: 'Pay',
      iconPath: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 1.315 0 2.036.598 2.117 1.441h1.885c-.088-1.564-1.223-2.861-2.858-3.186V2h-2.183v1.721c-1.556.37-2.873 1.556-2.873 3.177 0 2.032 1.703 3.015 4.153 3.916 2.235.811 2.687 1.613 2.687 2.549 0 .679-.458 1.531-1.901 1.531-1.509 0-2.354-.733-2.472-1.774H8.292c.113 1.976 1.697 3.025 3.436 3.303V18h2.183v-1.636c1.556-.413 2.873-1.649 2.873-3.347 0-2.718-2.636-3.664-4.808-4.867z',
      iconFill: true,
    },
  ];
}
