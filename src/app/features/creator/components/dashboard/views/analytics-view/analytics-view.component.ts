import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { AnalyticsDashboardComponent } from '../../../analytics-dashboard/analytics-dashboard.component';

@Component({
  selector: 'app-analytics-view',
  imports: [AnalyticsDashboardComponent],
  templateUrl: './analytics-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsViewComponent {
  constructor(protected readonly state: DashboardStateService) {}
}
