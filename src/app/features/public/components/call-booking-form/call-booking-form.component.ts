import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APP_CONSTANTS } from '@core/constants';
import { AvailabilitySlot, DayOfWeek } from '@core/models';

export interface CallBookingFormData {
  senderName: string;
  senderEmail: string;
  messageContent: string;
  scheduledAt: string;
  timezone: string;
  /** Which mode the client chose at booking time. */
  sessionType: 'online' | 'physical';
}

interface SlotGroup {
  date: string;
  label: string;
  times: { iso: string; label: string }[];
}

interface CalendarCell {
  date: Date | null;
  key: string | null;
  day: number | null;
  available: boolean;
  past: boolean;
  today: boolean;
}

@Component({
  selector: 'app-call-booking-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './call-booking-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallBookingFormComponent {
  public readonly priceCents = input.required<number>();
  public readonly callDuration = input.required<number>();
  public readonly creatorName = input.required<string>();
  public readonly availabilitySlots = input<AvailabilitySlot[]>([]);
  /**
   * ISO strings of slots that are already confirmed or in-progress.
   * These are filtered out of the time-slot picker so clients can never
   * attempt to book a taken slot.
   */
  public readonly bookedIsos = input<string[]>([]);
  public readonly submitting = input<boolean>(false);
  /** Session type offered by the expert: 'online', 'physical', or 'both'. */
  public readonly sessionType = input<'online' | 'physical' | 'both'>('online');
  /** Physical address shown when sessionType is 'physical' or 'both'. */
  public readonly physicalAddress = input<string>('');

  public readonly formSubmit = output<CallBookingFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected messageContent = '';
  /** The mode chosen by the client when the expert offers both. Defaults to online. */
  protected readonly selectedSessionType = signal<'online' | 'physical'>('online');

  protected readonly selectedDate = signal<string>('');
  protected selectedIso = '';
  protected readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // declared before computed signals that reference it
  private readonly _today = new Date();
  protected readonly calendarYear = signal<number>(this._today.getFullYear());
  protected readonly calendarMonth = signal<number>(this._today.getMonth()); // 0-indexed

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

  protected readonly calendarMonthLabel = computed<string>(() => {
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${MONTH_NAMES[this.calendarMonth()]} ${String(this.calendarYear())}`;
  });

  protected readonly canGoPrev = computed<boolean>(() => {
    const today = this._today;
    return (
      this.calendarYear() > today.getFullYear() ||
      (this.calendarYear() === today.getFullYear() && this.calendarMonth() > today.getMonth())
    );
  });

  protected readonly slotMap = computed<Map<string, SlotGroup>>(() => {
    const duration = this.callDuration();
    const availability = this.availabilitySlots();
    // Build a fast lookup set from the parent-supplied booked ISO timestamps
    const bookedSet = new Set(this.bookedIsos());
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
          const iso = slotDate.toISOString();
          if (slotDate <= now) { continue; }
          // Skip slots that are already taken by another confirmed booking
          if (bookedSet.has(iso)) { continue; }
          times.push({
            iso,
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

  protected readonly hasAvailableDays = computed<boolean>(() => this.slotMap().size > 0);

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

  protected readonly timesForSelectedDay = computed<{ iso: string; label: string }[]>(() => {
    const key = this.selectedDate();
    if (!key) { return []; }
    return this.slotMap().get(key)?.times ?? [];
  });

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

  protected selectDay(cell: CalendarCell): void {
    if (!cell.key || cell.past || !cell.available) { return; }
    this.selectedDate.set(cell.key);
    this.selectedIso = '';
  }

  protected onSubmit(): void {
    if (!this.selectedIso) { return; }
    // If expert only offers one mode, use that; otherwise use what client picked.
    const resolvedType: 'online' | 'physical' =
      this.sessionType() === 'both' ? this.selectedSessionType() : (this.sessionType() as 'online' | 'physical');
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      messageContent: this.messageContent,
      scheduledAt: this.selectedIso,
      timezone: this.timezone,
      sessionType: resolvedType,
    });
  }

  private fmt(totalMins: number): string {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(displayH)}:${m.toString().padStart(2, '0')} ${period}`;
  }
}



