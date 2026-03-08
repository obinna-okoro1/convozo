import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { InboxPanelComponent } from '../../inbox-panel/inbox-panel.component';

@Component({
  selector: 'app-inbox-view',
  imports: [InboxPanelComponent],
  templateUrl: './inbox-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxViewComponent {
  constructor(protected readonly state: DashboardStateService) {}
}
