/**
 * Call Booking Form Component
 * Public-facing form for clients to book a video consultation with an expert.
 *
 * Slot generation:
 *   - Reads expert's weekly availability_slots (day_of_week, start_time, end_time)
 *   - Reads the expert's call_duration setting (minutes)
 *   - Generates concrete bookable slots for the next 5 available days at
 *     call_duration-minute intervals within each availability window
 *
 * UX: two-step selection — interactive calendar grid to pick a day, then time pills.
 *
 * Form output:
 *   scheduledAt — ISO 8601 UTC string of the selected slot
 *   timezone    — client's browser IANA timezone (e.g. "America/New_York")
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONSTANTS } from '@core/constants';
import { AvailabilitySlot, DayOfWeek } from '@core/models';

export interface CallBookingFormData {
  senderName: string;
  senderEmail: string;
  messageContent: string;
  /** ISO 8601 UTC datetime of the client's selected call slot */
  scheduledAt: string;
  /** IANA timezone string captured from client's browser (e.g. "America/New_York") */
  timezone: string;
}

interface SlotGroup {
  /** Canonical date key: "YYYY-MM-DD" */
  date: string;
  /** Human-readable label shown in the confirmation chip */
  label: string;
  times: { iso: string; label: string }[];
}

/** One cell in the calendar grid */
interface CalendarCell {
  /** Date object for this cell, or null for empty leading cells */
  date: Date | null;
  /** "YYYY-MM-DD" key, or null for empty cells */
  key: string | null;
  /** Day number to display */
  day: number | null;
  /** Whether this day has bookable slots */
  available: boolean;
  /** Whether this day is in the past (unselectable) */
  past: boolean;
  /** Whether this is today */
  today: boolean;
}

@Component({
  selector: 'app-call-booking-form',
  standalone: true,
  imports: [FormsModule],
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
  protected messageContent = '';

  /** Selected day key "YYYY-MM-DD" — drives the time options list. */
  protected readonly selectedDate = signal<string>('');

  /** ISO datetime of the chosen time slot — resets whenever the day changes. */
  protected selectedIso = '';

  /** Client's local timezone, captured once from the browser. */
  protected readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** Reference to today — used for calendar past/present checks. Must be declared before computed signals. */
  private readonly _today = new Date();

  /** Calendar navigation: which month/year the calendar is showing */
  protected readonly calendarYear = signal<number>(this._today.getFullYear());
  protected readonly calendarMonth = signal<number>(this._today.getMonth()); // 0-indexed

  /** Human-readable timezone label (e.g. "America/New_York — EDT") */
  protected readonly timezoneLabel = (() => {
    const tz = this.timezone;
    try {
      const abbr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
      return `${tz.replace(/_/g, ' ')} (${abbr})`;
    } catch {
      return tz.replace(/_/g, ' ');
    }
  })();

  protected readonly priceInDollars = computed(
    () => this.priceCents() / APP_CONSTANTS.PRICE_MULTIPLIER,
  );

  /** Month label shown in the calendar header ("March 2026") */
  protected readonly calendarMonthLabel = computed<string>(() => {
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${MONTH_NAMES[this.calendarMonth()]} ${String(this.calendarYear())}`;
  });

  /** Whether we can go back (never before current month) */
  protected readonly canGoPrev = computed<boolean>(() => {
    const today = this._today;
    return (
      this.calendarYear() > today.getFullYear() ||
      (this.calendarYear() === today.getFullYear() && this.calendarMonth() > today.getMonth())
    );
  });

  /**
   * Generates all concrete bookable slots across the next 60 days,
   * grouped by "YYYY-MM-DD" key. Returns a Map for O(1) lookup.
   */
  protected readonly slotMap = computed<Map<string, SlotGroup>>(() => {
    const duration = this.callDuration();
    const availability = this.availabilitySlots();
    const map = new Map<string, SlotGroup>();

    if (!availability.length || duration <= 0) { return map; }

    const now = new Date();
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Build map: dayOfWeek → [{startMin, endMin}]
    const availMap = new Map<number, { startMin: number; endMin: number }[]>();
    for (const slot of availability) {
      const [sh, sm] = slot.start_time.substring(0, 5).split(':').map(Number) as [number, number];
      const [eh, em] = slot.end_time.substring(0, 5).split(':').map(Number) as [number, number];
      if (!availMap.has(slot.day_of_week)) { availMap.set(slot.day_of_week, []); }
      availMap.get(slot.day_of_week)?.push({ startMin: sh * 60 + sm, endMin: eh * 60 + em });
    }

    for (let offset = 1; offset <= 60; offset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      date.setHours(0, 0, 0, 0);

      const dow = date.getDay() as DayOfWeek;
      const windows = availMap.get(dow);
      if (!windows) { continue; }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const key = `${String(year)}-${month}-${day}`;
      const label = `${DAY_NAMES[dow]}, ${MONTHS[date.getMonth()]} ${String(date.getDate())}`;

      const times: { iso: string; label: string }[] = [];
      for (const { startMin, endMin } of windows) {
        for (let s = startMin; s + duration <= endMin; s += duration) {
          const slotDate = new Date(date);
          slotDate.setHours(Math.floor(s / 60), s % 60, 0, 0);
          if (slotDate <= now) { continue; }
          times.push({
            iso: slotDate.toISOString(),
            label: `${this.fmt(s)} – ${this.fmt(s + duration)}`,
          });
        }
      }

      if (times.length > 0) {
        map.set(key, { date: key, label, times });
      }
    }

    return map;
  });

  /** Whether there are any bookable days at all (for the empty state) */
  protected readonly hasAvailableDays = computed<boolean>(() => this.slotMap().size > 0);

  /**
   * Builds the 6-row × 7-col calendar grid for the currently displayed month.
   * Each cell is either empty (leading/trailing) or a day with availability metadata.
   */
  protected readonly calendarGrid = computed<CalendarCell[]>(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const today = this._today;
    const slots = this.slotMap();

    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: CalendarCell[] = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      cells.push({ date: null, key: null, day: null, available: false, past: false, today: false });
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayMonth = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const key = `${String(year)}-${dayMonth}-${dayStr}`;

      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      // Past = strictly before today (today itself is still "past" since we start from offset=1)
      const isPast = date <= today;

      cells.push({
        date,
        key,
        day: d,
        available: slots.has(key),
        past: isPast,
        today: isToday,
      });
    }

    return cells;
  });

  /** Time slots for the currently selected day */
  protected readonly timesForSelectedDay = computed<{ iso: string; label: string }[]>(() => {
    const key = this.selectedDate();
    if (!key) { return []; }
    return this.slotMap().get(key)?.times ?? [];
  });

  /** Confirmation chip text once both day + time are chosen. */
  protected readonly selectedSlotLabel = computed<string | null>(() => {
    const key = this.selectedDate();
    if (!key || !this.selectedIso) { return null; }
    const group = this.slotMap().get(key);
    if (!group) { return null; }
    const time = group.times.find((s) => s.iso === this.selectedIso);
    return time ? `${group.label} · ${time.label}` : null;
  });

  // ── Calendar navigation ──────────────────────────────────────────

  protected prevMonth(): void {
    if (!this.canGoPrev()) { return; }
    let m = this.calendarMonth() - 1;
    let y = this.calendarYear();
    if (m < 0) { m = 11; y -= 1; }
    this.calendarMonth.set(m);
    this.calendarYear.set(y);
  }

  protected nextMonth(): void {
    let m = this.calendarMonth() + 1;
    let y = this.calendarYear();
    if (m > 11) { m = 0; y += 1; }
    this.calendarMonth.set(m);
    this.calendarYear.set(y);
  }

  /** Select a calendar day — resets time selection. */
  protected selectDay(cell: CalendarCell): void {
    if (!cell.key || cell.past || !cell.available) { return; }
    this.selectedDate.set(cell.key);
    this.selectedIso = '';
  }

  protected onSubmit(): void {
    if (!this.selectedIso) { return; }
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
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
    return `${String(displayH)}:${m.toString().padStart(2, '0')} ${period}`;
  }
}



