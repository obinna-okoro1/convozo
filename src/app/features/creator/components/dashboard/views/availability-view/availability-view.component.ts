import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { AvailabilityManagerComponent } from '../../../availability-manager/availability-manager.component';

@Component({
  selector: 'app-availability-view',
  imports: [AvailabilityManagerComponent],
  templateUrl: './availability-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityViewComponent {
  constructor(protected readonly state: DashboardStateService) {}
}
