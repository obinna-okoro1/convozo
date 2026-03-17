import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SettingsStateService } from '../../settings-state.service';
import { AvailabilityManagerComponent } from '../../../availability-manager/availability-manager.component';

@Component({
  selector: 'app-monetization-view',
  imports: [CommonModule, RouterLink, AvailabilityManagerComponent],
  templateUrl: './monetization-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonetizationViewComponent {
  /** Reference to the embedded availability manager so we can call save() on it */
  private readonly availabilityManager = viewChild(AvailabilityManagerComponent);

  /** Allow saving when either monetization settings or the availability schedule has unsaved changes */
  protected readonly canSave = computed(
    () => this.state.canSaveMonetization() || (this.availabilityManager()?.hasChanges() ?? false),
  );

  constructor(protected readonly state: SettingsStateService) {}

  /**
   * Save both monetization settings and the availability schedule in parallel.
   * state.saving is managed internally by saveMonetization() and drives the button spinner.
   */
  protected async saveAll(): Promise<void> {
    await Promise.all([
      this.state.saveMonetization(),
      this.availabilityManager()?.save() ?? Promise.resolve(),
    ]);
  }
}
