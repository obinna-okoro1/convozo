import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SettingsStateService } from '../../settings-state.service';

@Component({
  selector: 'app-payments-view',
  imports: [],
  templateUrl: './payments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsViewComponent {
  constructor(protected readonly state: SettingsStateService) {}
}
