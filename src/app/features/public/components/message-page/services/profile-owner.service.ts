/**
 * Profile Owner Service
 *
 * Detects whether the currently authenticated user owns the viewed public profile.
 * When they do, eagerly loads their inbox, bookings, and analytics so the
 * owner toolbar can function without navigating away to /creator/dashboard.
 *
 * Provided at the :slug route level so all child views share the same instance.
 *
 * What it does:   Checks user_id == creator.user_id, then loads all owner data.
 * What it returns: Signals for isOwner, messages, callBookings, monthlyAnalytics, etc.
 * Errors: All async methods catch internally and surface via ToastService.
 */

import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  CreatorProfile,
  CreatorSettings,
  Message,
  CallBooking,
  CreatorMonthlyAnalytics,
  StripeAccount,
  FlutterwaveSubaccount,
} from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';
import { AuthService } from '@features/auth/services/auth.service';
import { CreatorService } from '@features/creator/services/creator.service';
import { MessageService } from '@features/creator/services/message.service';
import { BookingService } from '@features/creator/services/booking.service';

import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';

@Injectable()
export class ProfileOwnerService {
  // ── Ownership ──────────────────────────────────────────────────────
  readonly isOwner = signal(false);
  readonly isOwnerLoading = signal(true);
  readonly creatorId = signal<string | null>(null);
  readonly creatorSlug = signal<string | null>(null);
  readonly settings = signal<CreatorSettings | null>(null);
  private readonly paymentProvider = signal<'stripe' | 'flutterwave'>('stripe');

  // ── Data signals ──────────────────────────────────────────────
  readonly messages = signal<Message[]>([]);
  readonly callBookings = signal<CallBooking[]>([]);
  readonly monthlyAnalytics = signal<CreatorMonthlyAnalytics[]>([]);
  readonly stripeAccount = signal<StripeAccount | null>(null);
  readonly flutterwaveSubaccount = signal<FlutterwaveSubaccount | null>(null);

  // ── Computed ───────────────────────────────────────────────────────
  readonly unreadCount = computed(() => this.messages().filter((m) => !m.is_handled).length);
  readonly confirmedBookingCount = computed(
    () => this.callBookings().filter((b) => b.status === 'confirmed').length,
  );
  readonly callsEnabled = computed(() => this.settings()?.calls_enabled ?? false);
  readonly isStripeConnected = computed(() => {
    const account = this.stripeAccount();
    return !!(account?.onboarding_completed && account?.charges_enabled);
  });
  readonly isPaymentReady = computed(() => {
    if (this.paymentProvider() === 'flutterwave') {
      return !!(this.flutterwaveSubaccount()?.is_active);
    }
    return this.isStripeConnected();
  });

  // ── Delete confirmation state ──────────────────────────────────────
  readonly showDeleteConfirm = signal(false);
  readonly messageToDelete = signal<Message | CallBooking | null>(null);
  readonly deleting = signal(false);
  readonly itemToDeleteName = computed(() => {
    const item = this.messageToDelete();
    if (!item) return '';
    return 'message_content' in item ? item.sender_name : item.booker_name;
  });

  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly creatorService: CreatorService,
    private readonly messageService: MessageService,
    private readonly bookingService: BookingService,
    private readonly toast: ToastService,
    private readonly router: Router,
  ) {}

  // ── Initialization ─────────────────────────────────────────────────

  async initialize(creator: CreatorProfile): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.isOwnerLoading.set(false);
      return;
    }

    if (creator.user_id === user.id) {
      this.isOwner.set(true);
      this.creatorId.set(creator.id);
      this.creatorSlug.set(creator.slug);
      this.paymentProvider.set(creator.payment_provider);
      this.settings.set(creator.creator_settings);
      await this.loadOwnerData(creator);
    }

    this.isOwnerLoading.set(false);
  }

  // ── Actions ────────────────────────────────────────────────────────

  async markAsHandled(message: Message): Promise<void> {
    const { error } = await this.messageService.markAsHandled(message.id);
    if (error) {
      this.toast.error('Failed to mark as handled');
      return;
    }
    this.messages.update((msgs) =>
      msgs.map((m) => (m.id === message.id ? { ...m, is_handled: true } : m)),
    );
  }

  async markBookingCompleted(booking: CallBooking): Promise<void> {
    const { error } = await this.bookingService.updateBookingStatus(booking.id, 'completed');
    if (error) {
      this.toast.error('Failed to update booking');
      return;
    }
    this.callBookings.update((bks) =>
      bks.map((b) => (b.id === booking.id ? { ...b, status: 'completed' as const } : b)),
    );
    this.toast.success('Booking marked as completed!');
  }

  async cancelBooking(booking: CallBooking): Promise<void> {
    const { error } = await this.bookingService.updateBookingStatus(booking.id, 'cancelled');
    if (error) {
      this.toast.error('Failed to cancel booking');
      return;
    }
    this.callBookings.update((bks) =>
      bks.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' as const } : b)),
    );
    this.toast.success('Booking cancelled');
  }

  joinVideoCall(booking: CallBooking): void {
    void this.router.navigate(['/call', booking.id], { queryParams: { role: 'creator' } });
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
        this.callBookings.update((bks) => bks.filter((b) => b.id !== item.id));
      }
      this.toast.success(`${isMessage ? 'Message' : 'Call booking'} deleted`);
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

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  // ── Private ────────────────────────────────────────────────────────

  private async loadOwnerData(creator: CreatorProfile): Promise<void> {
    const [messagesRes, bookingsRes, stripeRes, analyticsRes] = await Promise.all([
      this.messageService.getMessages(creator.id),
      this.bookingService.getCallBookings(creator.id),
      this.creatorService.getStripeAccount(creator.id),
      this.supabase.getMonthlyAnalytics(creator.id),
    ]);

    if (messagesRes.data) this.messages.set(messagesRes.data);
    if (bookingsRes.data) this.callBookings.set(bookingsRes.data);
    if (stripeRes.data) this.stripeAccount.set(stripeRes.data);
    if (analyticsRes.data) this.monthlyAnalytics.set(analyticsRes.data);

    if (creator.payment_provider === 'flutterwave') {
      const { data: flw } = await this.creatorService.getFlutterwaveSubaccount(creator.id);
      this.flutterwaveSubaccount.set(flw ?? null);
    }
  }
}
