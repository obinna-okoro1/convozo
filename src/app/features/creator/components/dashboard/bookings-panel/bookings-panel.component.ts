/**
 * Bookings Panel Component
 *
 * Displays consultation bookings as a scheduling management view — not an inbox.
 * Cards lead with date/time; upcoming sessions have full inline actions;
 * past sessions are visually muted with a delete option.
 *
 * Physical (in-person) sessions show a CVZ code input instead of a video join button.
 * The expert enters the client's code to confirm the meeting took place.
 *
 * Inputs:  bookings[] — all CallBooking records for this expert
 * Outputs: markCompleted, cancelBooking, confirmDelete, joinCall, verifyPhysicalMeeting
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CallBooking } from '@core/models';

interface FilterTab {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'app-bookings-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsPanelComponent {
  public readonly bookings = input.required<CallBooking[]>();

  public readonly markCompleted = output<CallBooking>();
  public readonly cancelBooking = output<CallBooking>();
  public readonly confirmDelete = output<CallBooking>();
  public readonly joinCall = output<CallBooking>();
  /** Emitted when the expert submits a CVZ verification code for a physical session. */
  public readonly verifyPhysicalMeeting = output<{ bookingId: string; code: string }>();

  protected readonly bookingFilterStatus = signal<string>('all');
  /** Per-booking CVZ code input values. Key = booking.id. */
  protected readonly codeInputs = signal<Record<string, string>>({});

  protected readonly bookingStats = computed(() => {
    const bookings = this.bookings();
    const upcoming = bookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'in_progress',
    ).length;
    const inProgress = bookings.filter((b) => b.status === 'in_progress').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const noShow = bookings.filter((b) => b.status === 'no_show').length;
    const totalRevenue =
      Math.round((bookings.reduce((sum, b) => sum + (b.amount_paid ?? 0), 0) / 100) * 100) / 100;
    const past = completed + cancelled + noShow;
    return { total: bookings.length, upcoming, inProgress, completed, cancelled, noShow, totalRevenue, past };
  });

  protected readonly filterTabs = computed<FilterTab[]>(() => {
    const s = this.bookingStats();
    return [
      { value: 'all', label: `All (${s.total})` },
      { value: 'upcoming', label: `Upcoming (${s.upcoming})` },
      { value: 'past', label: `Past (${s.past})` },
    ];
  });

  /** Upcoming sorted soonest-first; past sorted most-recent-first. */
  protected readonly filteredBookings = computed(() => {
    const bookings = this.bookings();
    const filter = this.bookingFilterStatus();

    const isUpcoming = (b: CallBooking): boolean =>
      b.status === 'confirmed' || b.status === 'in_progress';

    const sortAsc = (a: CallBooking, b: CallBooking): number => {
      const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return da - db;
    };

    const sortDesc = (a: CallBooking, b: CallBooking): number => {
      const da = a.scheduled_at
        ? new Date(a.scheduled_at).getTime()
        : new Date(a.created_at).getTime();
      const db = b.scheduled_at
        ? new Date(b.scheduled_at).getTime()
        : new Date(b.created_at).getTime();
      return db - da;
    };

    if (filter === 'upcoming') return bookings.filter(isUpcoming).sort(sortAsc);
    if (filter === 'past') return bookings.filter((b) => !isUpcoming(b)).sort(sortDesc);

    // All: upcoming first (soonest → latest), then past (newest → oldest)
    return [
      ...bookings.filter(isUpcoming).sort(sortAsc),
      ...bookings.filter((b) => !isUpcoming(b)).sort(sortDesc),
    ];
  });

  protected onFilterChange(value: string): void {
    this.bookingFilterStatus.set(value);
  }

  protected markBookingCompleted(booking: CallBooking): void {
    this.markCompleted.emit(booking);
  }

  protected onCancelBooking(booking: CallBooking): void {
    this.cancelBooking.emit(booking);
  }

  protected onConfirmDelete(booking: CallBooking): void {
    this.confirmDelete.emit(booking);
  }

  protected onJoinCall(booking: CallBooking): void {
    this.joinCall.emit(booking);
  }

  protected onCodeInput(bookingId: string, value: string): void {
    this.codeInputs.update((m) => ({ ...m, [bookingId]: value }));
  }

  protected onVerifyPhysicalMeeting(booking: CallBooking): void {
    const code = (this.codeInputs()[booking.id] ?? '').trim();
    if (!code) return;
    this.verifyPhysicalMeeting.emit({ bookingId: booking.id, code });
  }
}
