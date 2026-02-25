/**
 * Call Booking Form Component
 * Handles the paid call booking form on the public message page.
 * Contains pricing, availability display, contact fields, and submit button.
 */

import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONSTANTS } from '../../../../core/constants';
import { AvailabilitySlot } from '../../../../core/models';
import { TrustIndicatorsComponent } from '../../../../shared/components/trust-indicators/trust-indicators.component';

export interface CallBookingFormData {
  senderName: string;
  senderEmail: string;
  instagramHandle: string;
  messageContent: string;
}

interface AvailabilityByDay {
  day: string;
  slots: { start: string; end: string }[];
}

@Component({
  selector: 'app-call-booking-form',
  standalone: true,
  imports: [FormsModule, TrustIndicatorsComponent],
  templateUrl: './call-booking-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallBookingFormComponent {
  public readonly priceCents = input.required<number>();
  public readonly callDuration = input.required<number>();
  public readonly creatorName = input.required<string>();
  public readonly availabilitySlots = input<AvailabilitySlot[]>([]);
  public readonly submitting = input<boolean>(false);

  public readonly formSubmit = output<CallBookingFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected instagramHandle = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(
    () => (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  protected readonly availabilityByDay = computed<AvailabilityByDay[]>(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = new Map<number, { start: string; end: string }[]>();

    for (const slot of this.availabilitySlots()) {
      if (!grouped.has(slot.day_of_week)) {
        grouped.set(slot.day_of_week, []);
      }
      grouped.get(slot.day_of_week)?.push({
        start: this.formatTime(slot.start_time),
        end: this.formatTime(slot.end_time),
      });
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, slots]) => ({ day: dayNames[day], slots }));
  });

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      instagramHandle: this.instagramHandle.replace(/^@/, ''),
      messageContent: this.messageContent,
    });
  }

  private formatTime(time: string): string {
    const [hours, minutes] = time.substring(0, 5).split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${String(displayHour)}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
