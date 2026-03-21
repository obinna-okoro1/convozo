/**
 * Call Booking Form Component
 * Public-facing form for fans to book a video call with a creator.
 *
 * Slot generation:
 *   - Reads creator's weekly availability_slots (day_of_week, start_time, end_time)
 *   - Reads the creator's call_duration setting (minutes)
 *   - Generates concrete bookable slots for the next 5 available days at
 *     call_duration-minute intervals within each availability window
 *
 * UX: two-step selection — pick a day first, then pick a time.
 *
 * Form output:
 *   scheduledAt — ISO 8601 UTC string of the selected slot
 *   timezone    — fan's browser IANA timezone (e.g. "America/New_York")
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONSTANTS } from '../../../../core/constants';
import { AvailabilitySlot, DayOfWeek } from '../../../../core/models';
import { TrustIndicatorsComponent } from '../../../../shared/components/trust-indicators/trust-indicators.component';

export interface CallBookingFormData {
  senderName: string;
  senderEmail: string;
  instagramHandle: string;
  messageContent: string;
  /** ISO 8601 UTC datetime of the fan's selected call slot */
  scheduledAt: string;
  /** IANA timezone string captured from fan's browser (e.g. "America/New_York") */
  timezone: string;
}

interface SlotGroup {
  date: string;
  times: { iso: string; label: string }[];
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

  /** Selected day label — drives the time options list. */
  protected readonly selectedDate = signal<string>('');

  /** ISO datetime of the chosen time slot — resets whenever the day changes. */
  protected selectedIso = '';

  /** Fan's local timezone, captured once from the browser. */
  protected readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  protected readonly priceInDollars = computed(
    () => (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  /**
   * Generates all concrete bookable slots across the next 5 available days,
   * grouped by date label. Steps through each availability window at
   * callDuration-minute intervals, skipping past slots.
   */
  protected readonly availableDays = computed<SlotGroup[]>(() => {
    const duration = this.callDuration();
    const availability = this.availabilitySlots();

    if (!availability.length || duration <= 0) return [];

    const now = new Date();
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Build map: dayOfWeek → [{startMin, endMin}]
    const availMap = new Map<number, { startMin: number; endMin: number }[]>();
    for (const slot of availability) {
      const [sh, sm] = slot.start_time.substring(0, 5).split(':').map(Number);
      const [eh, em] = slot.end_time.substring(0, 5).split(':').map(Number);
      if (!availMap.has(slot.day_of_week)) availMap.set(slot.day_of_week, []);
      availMap.get(slot.day_of_week)!.push({ startMin: sh * 60 + sm, endMin: eh * 60 + em });
    }

    const groups: SlotGroup[] = [];

    // Scan up to 60 calendar days but stop once we have 5 days with slots
    for (let offset = 1; offset <= 60 && groups.length < 5; offset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      date.setHours(0, 0, 0, 0);

      const dow = date.getDay() as DayOfWeek;
      const windows = availMap.get(dow);
      if (!windows) continue;

      const dayLabel = `${DAY_NAMES[dow]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
      const times: { iso: string; label: string }[] = [];

      for (const { startMin, endMin } of windows) {
        for (let s = startMin; s + duration <= endMin; s += duration) {
          const slotDate = new Date(date);
          slotDate.setHours(Math.floor(s / 60), s % 60, 0, 0);
          if (slotDate <= now) continue;
          times.push({
            iso: slotDate.toISOString(),
            label: `${this.fmt(s)} – ${this.fmt(s + duration)}`,
          });
        }
      }

      if (times.length > 0) {
        groups.push({ date: dayLabel, times });
      }
    }

    return groups;
  });

  /** Time options for whichever day the fan has selected. */
  protected readonly timesForSelectedDay = computed<{ iso: string; label: string }[]>(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.availableDays().find((g) => g.date === date)?.times ?? [];
  });

  /** Confirmation chip text once both day + time are chosen. */
  protected readonly selectedSlotLabel = computed<string | null>(() => {
    const date = this.selectedDate();
    if (!date || !this.selectedIso) return null;
    const time = this.timesForSelectedDay().find((s) => s.iso === this.selectedIso);
    return time ? `${date} · ${time.label}` : null;
  });

  /** Called when the day dropdown changes — resets the time selection. */
  protected onDayChange(date: string): void {
    this.selectedDate.set(date);
    this.selectedIso = '';
  }

  protected onSubmit(): void {
    if (!this.selectedIso) return;
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      instagramHandle: this.instagramHandle.replace(/^@/, ''),
      messageContent: this.messageContent,
      scheduledAt: this.selectedIso,
      timezone: this.timezone,
    });
  }

  /** Convert total minutes-from-midnight to a 12-hour label ("2:30 PM"). */
  private fmt(totalMins: number): string {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  }
}



