/**
 * Call View Component
 * Displays the call booking form on the public message page.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  CallBookingFormComponent,
  CallBookingFormData,
} from 'app/features/public/components/call-booking-form/call-booking-form.component';

import { MessagePageStateService } from '../../message-page-state.service';

@Component({
  selector: 'app-call-view',
  imports: [CallBookingFormComponent],
  templateUrl: './call-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallViewComponent {
  protected readonly state = inject(MessagePageStateService);

  protected onCallBookingSubmit(formData: CallBookingFormData): void {
    void this.state.onCallBookingSubmit(formData);
  }
}
