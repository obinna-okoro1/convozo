/**
 * Dashboard State Service
 * Shared state for dashboard shell and child route components.
 * Holds creator data, messages, bookings, and provides actions.
 */

import { computed, Injectable, signal } from '@angular/core';
import {
  Creator,
  CreatorSettings,
  Message,
  CallBooking,
  StripeAccount,
} from '../../../../core/models';
import { MessageService } from '../../services/message.service';
import { BookingService } from '../../services/booking.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { errorMessage } from '../../../../shared/utils/error.utils';

@Injectable()
export class DashboardStateService {
  // ── State signals ──────────────────────────────────────────────────
  readonly creator = signal<Creator | null>(null);
  readonly settings = signal<CreatorSettings | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly callBookings = signal<CallBooking[]>([]);
  readonly stripeAccount = signal<StripeAccount | null>(null);

  // ── Computed ───────────────────────────────────────────────────────
  readonly unhandledMessageCount = computed(
    () => this.messages().filter((m) => !m.is_handled).length,
  );
  readonly confirmedBookingCount = computed(
    () => this.callBookings().filter((b) => b.status === 'confirmed').length,
  );
  readonly publicUrl = computed<string>(() => {
    const slug = this.creator()?.slug;
    if (!slug) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/${slug}`;
  });
  readonly isStripeConnected = computed(() => {
    const account = this.stripeAccount();
    return !!(account?.onboarding_completed && account?.charges_enabled);
  });

  // ── Delete confirmation state ─────────────────────────────────────
  readonly showDeleteConfirm = signal<boolean>(false);
  readonly messageToDelete = signal<Message | CallBooking | null>(null);
  readonly deleting = signal<boolean>(false);

  readonly itemToDeleteName = computed(() => {
    const item = this.messageToDelete();
    if (!item) return '';
    return 'message_content' in item ? item.sender_name : item.booker_name;
  });

  readonly isItemToDeleteMessage = computed(() => {
    const item = this.messageToDelete();
    return item && 'message_content' in item;
  });

  constructor(
    private readonly messageService: MessageService,
    private readonly bookingService: BookingService,
    private readonly toast: ToastService,
  ) {}

  // ── Actions ────────────────────────────────────────────────────────

  async markAsHandled(message: Message): Promise<void> {
    const { error } = await this.messageService.markAsHandled(message.id);
    if (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to mark as handled');
    }
  }

  async markBookingCompleted(booking: CallBooking): Promise<void> {
    const { error } = await this.bookingService.updateBookingStatus(booking.id, 'completed');
    if (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to update booking');
    } else {
      this.toast.success('Booking marked as completed!');
    }
  }

  async cancelBooking(booking: CallBooking): Promise<void> {
    const { error } = await this.bookingService.updateBookingStatus(booking.id, 'cancelled');
    if (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to cancel booking');
    } else {
      this.toast.success('Booking cancelled');
    }
  }

  confirmDelete(item: Message | CallBooking): void {
    this.messageToDelete.set(item);
    this.showDeleteConfirm.set(true);
  }

  async deleteItem(): Promise<void> {
    const item = this.messageToDelete();
    if (!item) return;

    this.deleting.set(true);
    try {
      const isMessage = 'message_content' in item;

      if (isMessage) {
        await this.messageService.deleteMessage(item.id);
        this.messages.update((msgs) => msgs.filter((m) => m.id !== item.id));
      } else {
        await this.bookingService.deleteCallBooking(item.id);
        this.callBookings.update((bookings) => bookings.filter((b) => b.id !== item.id));
      }

      this.toast.success(`${isMessage ? 'Message' : 'Call booking'} deleted successfully`);
    } catch (err) {
      this.toast.error(errorMessage(err, 'Failed to delete item'));
    } finally {
      this.deleting.set(false);
      this.showDeleteConfirm.set(false);
      this.messageToDelete.set(null);
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.messageToDelete.set(null);
  }

  copyPublicUrl(): void {
    const url = this.publicUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(
        () => this.toast.success('URL copied to clipboard!'),
        () => this.toast.error('Failed to copy URL'),
      );
    }
  }
}
