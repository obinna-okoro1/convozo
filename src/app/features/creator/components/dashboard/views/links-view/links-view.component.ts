import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardStateService } from '../../dashboard-state.service';
import { EditLinksComponent } from '../../../../../link-in-bio/pages/edit-links/edit-links.component';

@Component({
  selector: 'app-links-view',
  imports: [EditLinksComponent],
  templateUrl: './links-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksViewComponent {
  constructor(protected readonly state: DashboardStateService) {}
}
