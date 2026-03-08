import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { BookingsPanelComponent } from '../../bookings-panel/bookings-panel.component';

@Component({
  selector: 'app-bookings-view',
  imports: [BookingsPanelComponent],
  templateUrl: './bookings-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsViewComponent {
  constructor(protected readonly state: DashboardStateService) {}
}
