/**
 * Call View Component
 * Displays the call booking form on the public message page.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessagePageStateService } from '../../message-page-state.service';
import {
  CallBookingFormComponent,
  CallBookingFormData,
} from '../../../call-booking-form/call-booking-form.component';

@Component({
  selector: 'app-call-view',
  imports: [RouterLink, CallBookingFormComponent],
  templateUrl: './call-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onCallBookingSubmit(formData: CallBookingFormData): void {
    void this.state.onCallBookingSubmit(formData);
  }
}
