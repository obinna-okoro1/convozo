import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallBooking } from '../../../../../core/models';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../../../../shared/components/ui/searchable-select/searchable-select.component';

@Component({
  selector: 'app-bookings-panel',
  imports: [CommonModule, SearchableSelectComponent],
  templateUrl: './bookings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsPanelComponent {
  public readonly bookings = input.required<CallBooking[]>();

  public readonly markCompleted = output<CallBooking>();
  public readonly cancelBooking = output<CallBooking>();
  public readonly confirmDelete = output<CallBooking>();

  protected readonly selectedBooking = signal<CallBooking | null>(null);
  protected readonly showBookingModal = signal<boolean>(false);
  protected readonly bookingFilterStatus = signal<'all' | 'confirmed' | 'completed' | 'cancelled'>(
    'all',
  );

  protected readonly bookingStats = computed(() => {
    const bookings = this.bookings();
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const totalRevenue =
      Math.round((bookings.reduce((sum, b) => sum + (b.amount_paid ?? 0), 0) / 100) * 100) / 100;
    return { total: bookings.length, confirmed, completed, cancelled, totalRevenue };
  });

  protected readonly filteredBookings = computed(() => {
    const bookings = this.bookings();
    const status = this.bookingFilterStatus();
    if (status === 'confirmed') {
      return bookings.filter((b) => b.status === 'confirmed');
    } else if (status === 'completed') {
      return bookings.filter((b) => b.status === 'completed');
    } else if (status === 'cancelled') {
      return bookings.filter((b) => b.status === 'cancelled');
    }
    return bookings;
  });

  protected readonly bookingFilterOptions = computed<SelectOption[]>(() => {
    const s = this.bookingStats();
    return [
      { value: 'all', label: `All (${s.total})` },
      { value: 'confirmed', label: `Confirmed (${s.confirmed})` },
      { value: 'completed', label: `Completed (${s.completed})` },
      { value: 'cancelled', label: `Cancelled (${s.cancelled})` },
    ];
  });

  protected onBookingFilterChange(value: string): void {
    this.bookingFilterStatus.set(
      value as 'all' | 'confirmed' | 'completed' | 'cancelled',
    );
  }

  protected handleBookingClick(booking: CallBooking): void {
    this.selectedBooking.set(booking);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.showBookingModal.set(true);
    }
  }

  protected closeBookingModal(): void {
    this.showBookingModal.set(false);
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

  protected markBookingCompletedFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.markCompleted.emit(booking);
  }

  protected cancelBookingFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.cancelBooking.emit(booking);
  }

  protected confirmDeleteBookingFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.confirmDelete.emit(booking);
  }
}
