import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DashboardStateService } from '../dashboard-state.service';

interface Tab {
  path: string;
  label: string;
  mobileLabel: string;
  icon: string;
  badgeCount?: () => number;
  badgeColor: string;
}

@Component({
  selector: 'app-dashboard-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './dashboard-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTabsComponent {
  protected readonly tabs = computed<Tab[]>(() => [
    {
      path: 'links',
      label: 'Links',
      mobileLabel: 'Links',
      icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      badgeColor: '',
    },
    {
      path: 'inbox',
      label: 'Inbox',
      mobileLabel: 'Inbox',
      icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
      badgeCount: () => this.state.unhandledMessageCount(),
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    },
    {
      path: 'bookings',
      label: 'Bookings',
      mobileLabel: 'Calls',
      icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
      badgeCount: () => this.state.confirmedBookingCount(),
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      path: 'availability',
      label: 'Availability',
      mobileLabel: 'Times',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      badgeColor: '',
    },
    {
      path: 'analytics',
      label: 'Analytics',
      mobileLabel: 'Stats',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      badgeColor: '',
    },
  ]);

  constructor(protected readonly state: DashboardStateService) {}
}
