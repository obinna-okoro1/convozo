import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SettingsStateService } from '../../settings-state.service';

@Component({
  selector: 'app-monetization-view',
  imports: [CommonModule, RouterLink],
  templateUrl: './monetization-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonetizationViewComponent {
  constructor(protected readonly state: SettingsStateService) {}
}
