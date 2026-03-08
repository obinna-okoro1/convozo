/**
 * Dashboard Component
 * Lean component that delegates business logic to CreatorService
 * Enhanced with analytics, templates, and push notifications
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { ROUTES } from '../../../../core/constants';
import {
  Creator,
  CreatorSettings,
  Message,
  MessageStats,
  CallBooking,
  FilterStatus,
} from '../../../../core/models';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { ResponseTemplateService } from '../../../../core/services/response-template.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CreatorService } from '../../services/creator.service';
import { AnalyticsDashboardComponent } from '../analytics-dashboard/analytics-dashboard.component';
import { AvailabilityManagerComponent } from '../availability-manager/availability-manager.component';
import { TemplatePickerComponent } from '../template-picker/template-picker.component';
import { EditLinksComponent } from '../../../link-in-bio/pages/edit-links/edit-links.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AnalyticsDashboardComponent,
    TemplatePickerComponent,
    AvailabilityManagerComponent,
    EditLinksComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  // State signals
  protected readonly creator = signal<Creator | null>(null);
  protected readonly settings = signal<CreatorSettings | null>(null);
  protected readonly messages = signal<Message[]>([]);
  protected readonly callBookings = signal<CallBooking[]>([]);
  protected readonly selectedMessage = signal<Message | null>(null);
  protected readonly selectedBooking = signal<CallBooking | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stripeSetupIncomplete = signal<boolean>(false);

  // Reply modal state
  protected readonly showReplyModal = signal<boolean>(false);
  protected readonly replyContent = signal<string>('');
  protected readonly sendingReply = signal<boolean>(false);

  // Template picker state
  protected readonly showTemplatePicker = signal<boolean>(false);

  // View state (dashboard overview vs inbox vs analytics vs bookings vs availability)
  protected readonly activeView = signal<'dashboard' | 'inbox' | 'analytics' | 'bookings' | 'availability' | 'links'>(
    'dashboard',
  );

  // Delete confirmation state
  protected readonly showDeleteConfirm = signal<boolean>(false);
  protected readonly messageToDelete = signal<Message | CallBooking | null>(null);
  protected readonly deleting = signal<boolean>(false);

  // Computed property to safely get the name from the item to delete
  protected readonly itemToDeleteName = computed(() => {
    const item = this.messageToDelete();
    if (!item) return '';
    
    // Check if it's a Message (has message_content) or CallBooking (has booker_name)
    if ('message_content' in item) {
      return (item as Message).sender_name;
    } else {
      return (item as CallBooking).booker_name;
    }
  });

  // Computed property to check if the item to delete is a message
  protected readonly isItemToDeleteMessage = computed(() => {
    const item = this.messageToDelete();
    return item && 'message_content' in item;
  });

  // Push notifications
  protected readonly pushEnabled = signal<boolean>(false);
  protected readonly pushLoading = signal<boolean>(false);

  // Filter state
  protected readonly filterStatus = signal<FilterStatus>('all');
  protected readonly bookingFilterStatus = signal<'all' | 'confirmed' | 'completed' | 'cancelled'>('all');

  // Mobile modal state
  protected readonly showMessageModal = signal<boolean>(false);
  protected readonly showBookingModal = signal<boolean>(false);

  // Computed values — revenue includes both messages and call bookings
  protected readonly stats = computed<MessageStats>(() => {
    const msgStats = this.creatorService.calculateStats(this.messages());
    const bookingRevenueCents = this.callBookings().reduce(
      (sum, b) => sum + (b.amount_paid ?? 0),
      0,
    );
    const bookingRevenue = Math.round((bookingRevenueCents / 100) * 100) / 100;
    return { ...msgStats, totalRevenue: msgStats.totalRevenue + bookingRevenue };
  });
  protected readonly publicUrl = computed<string>(() =>
    this.creatorService.buildPublicUrl(this.creator()?.slug),
  );

  protected readonly isPushSupported = computed(() => this.pushService.isSupported());

  // Filtered messages as a computed signal (avoids recalculation every CD cycle)
  protected readonly filteredMessages = computed<Message[]>(() => {
    const msgs = this.messages();
    const status = this.filterStatus();
    if (status === 'unhandled') {
      return msgs.filter((m) => !m.is_handled);
    }
    if (status === 'handled') {
      return msgs.filter((m) => m.is_handled);
    }
    return msgs;
  });

  // Booking stats
  protected readonly bookingStats = computed(() => {
    const bookings = this.callBookings();
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const totalRevenue =
      Math.round((bookings.reduce((sum, b) => sum + (b.amount_paid ?? 0), 0) / 100) * 100) / 100;
    return { total: bookings.length, confirmed, completed, cancelled, totalRevenue };
  });

  // Filtered bookings based on status
  protected readonly filteredBookings = computed(() => {
    const bookings = this.callBookings();
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

  private queryParamsSubscription?: Subscription;
  private realtimeChannel?: RealtimeChannel;
  private bookingsRealtimeChannel?: RealtimeChannel;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly pushService: PushNotificationService,
    private readonly templateService: ResponseTemplateService,
    private readonly toast: ToastService,
  ) {}

  // ── Public methods ──────────────────────────────────────────────────

  public ngOnInit(): void {
    void this.initialize();
  }

  public ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.realtimeChannel) {
      this.creatorService.unsubscribeFromMessages(this.realtimeChannel);
    }
    if (this.bookingsRealtimeChannel) {
      this.creatorService.unsubscribeFromCallBookings(this.bookingsRealtimeChannel);
    }
  }

  // ── Protected methods ───────────────────────────────────────────────

  /**
   * Extract string value from an input/textarea/select event
   */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /**
   * Handle filter status change from select element
   */
  protected onFilterChange(event: Event): void {
    this.filterStatus.set((event.target as HTMLSelectElement).value as FilterStatus);
  }

  /**
   * Handle booking filter status change
   */
  protected onBookingFilterChange(event: Event): void {
    this.bookingFilterStatus.set((event.target as HTMLSelectElement).value as 'all' | 'confirmed' | 'completed' | 'cancelled');
  }

  /**
   * Toggle push notifications
   */
  protected async togglePushNotifications(): Promise<void> {
    this.pushLoading.set(true);

    if (this.pushEnabled()) {
      const result = await this.pushService.unsubscribe();
      if (result.success) {
        this.pushEnabled.set(false);
      }
    } else {
      const result = await this.pushService.subscribe();
      if (result.success) {
        this.pushEnabled.set(true);
        // Show a test notification
        await this.pushService.sendLocalNotification(
          'Notifications enabled! 🎉',
          "You'll now receive alerts for new messages.",
        );
      } else if (result.error) {
        this.toast.error(result.error);
      }
    }

    this.pushLoading.set(false);
  }

  /**
   * Handle message click - responsive behavior
   */
  protected handleMessageClick(message: Message): void {
    this.selectedMessage.set(message);
    
    // On mobile (width < 1024px), show modal
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.showMessageModal.set(true);
    }
    
    // Mark as handled if not already
    if (!message.is_handled) {
      this.markAsHandled(message);
    }
  }

  /**
   * Close message modal (mobile)
   */
  protected closeMessageModal(): void {
    this.showMessageModal.set(false);
  }

  /**
   * Open reply modal from mobile modal
   */
  protected openReplyModalFromMobile(message: Message): void {
    this.closeMessageModal();
    this.openReplyModal(message);
  }

  /**
   * Mark as handled from mobile modal
   */
  protected markAsHandledFromMobile(message: Message): void {
    this.closeMessageModal();
    this.markAsHandled(message);
  }

  /**
   * Confirm delete from mobile modal
   */
  protected confirmDeleteFromMobile(message: Message): void {
    this.closeMessageModal();
    this.confirmDelete(message);
  }

  /**
   * Select a message and mark as handled if needed
   */
  protected selectMessage(message: Message): void {
    this.selectedMessage.set(message);
    
    // Mark as handled if it's not already
    if (!message.is_handled) {
      this.markAsHandled(message);
    }
  }

  /**
   * Open reply modal
   */
  protected openReplyModal(message: Message): void {
    this.selectedMessage.set(message);
    this.replyContent.set('');
    this.showReplyModal.set(true);
  }

  /**
   * Close reply modal
   */
  protected closeReplyModal(): void {
    this.showReplyModal.set(false);
    this.replyContent.set('');
    this.sendingReply.set(false);
    this.showTemplatePicker.set(false);
  }

  /**
   * Open template picker
   */
  protected openTemplatePicker(): void {
    this.showTemplatePicker.set(true);
  }

  /**
   * Handle template selection
   */
  protected onTemplateSelected(content: string): void {
    // Replace sender_name placeholder with actual name
    const message = this.selectedMessage();
    if (message) {
      content = content.replace(/\{sender_name\}/g, message.sender_name);
    }
    this.replyContent.set(content);
    this.showTemplatePicker.set(false);
  }

  /**
   * Send reply
   */
  protected async sendReply(): Promise<void> {
    const message = this.selectedMessage();
    const content = this.replyContent().trim();

    if (!message || !content) {
      return;
    }

    this.sendingReply.set(true);

    const result = await this.creatorService.replyToMessage(
      message.id,
      content,
      message.sender_email,
    );

    if (result.success) {
      this.toast.success('Reply sent!');
      this.closeReplyModal();
    } else {
      this.handleError(result.error, 'Failed to send reply');
    }

    this.sendingReply.set(false);
  }

  /**
   * Mark message as handled
   */
  protected async markAsHandled(message: Message): Promise<void> {
    const { error } = await this.creatorService.markAsHandled(message.id);

    if (error) {
      this.handleError(error, 'Failed to mark as handled');
    }
    // The realtime subscription will automatically refresh the messages list
  }

  /**
   * Sign out
   */
  protected async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  /**
   * Copy public URL
   */
  protected copyPublicUrl(): void {
    const url = this.publicUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(
        () => {
          this.toast.success('URL copied to clipboard!');
        },
        () => {
          this.toast.error('Failed to copy URL');
        },
      );
    }
  }

  /**
   * Select a call booking (desktop only, e.g. from overview)
   */
  protected selectBooking(booking: CallBooking): void {
    this.selectedBooking.set(booking);
  }

  /**
   * Handle booking click - responsive behavior
   */
  protected handleBookingClick(booking: CallBooking): void {
    this.selectedBooking.set(booking);

    // On mobile (width < 1024px), show modal
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.showBookingModal.set(true);
    }
  }

  /**
   * Close booking modal (mobile)
   */
  protected closeBookingModal(): void {
    this.showBookingModal.set(false);
  }

  /**
   * Mark booking completed from mobile modal
   */
  protected markBookingCompletedFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.markBookingCompleted(booking);
  }

  /**
   * Cancel booking from mobile modal
   */
  protected cancelBookingFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.cancelBooking(booking);
  }

  /**
   * Confirm delete booking from mobile modal
   */
  protected confirmDeleteBookingFromMobile(booking: CallBooking): void {
    this.closeBookingModal();
    this.confirmDelete(booking);
  }

  /**
   * Mark a booking as completed
   */
  protected async markBookingCompleted(booking: CallBooking): Promise<void> {
    const { error } = await this.creatorService.updateBookingStatus(booking.id, 'completed');
    if (error) {
      this.handleError(error, 'Failed to update booking');
    } else {
      this.toast.success('Booking marked as completed!');
    }
  }

  /**
   * Mark a booking as cancelled
   */
  protected async cancelBooking(booking: CallBooking): Promise<void> {
    const { error } = await this.creatorService.updateBookingStatus(booking.id, 'cancelled');
    if (error) {
      this.handleError(error, 'Failed to cancel booking');
    } else {
      this.toast.success('Booking cancelled');
    }
  }

  // ── Private methods ─────────────────────────────────────────────────

  private async initialize(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    this.subscribeToQueryParams();
    await this.loadDashboardData(user.id);
    this.checkPushSubscription();
  }

  /**
   * Subscribe to query parameters
   */
  private subscribeToQueryParams(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params['stripe_setup'] === 'incomplete') {
        this.stripeSetupIncomplete.set(true);
      }
      if (params['view'] === 'availability') {
        this.activeView.set('availability');
      }
    });
  }

  /**
   * Check current push notification subscription status
   */
  private checkPushSubscription(): void {
    this.pushEnabled.set(this.pushService.isSubscribed());
  }

  /**
   * Load all dashboard data
   */
  private async loadDashboardData(userId: string): Promise<void> {
    try {
      const { data: creatorData, error: creatorError } =
        await this.creatorService.getCreatorByUserId(userId);

      if (creatorError || !creatorData) {
        await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
        return;
      }

      this.creator.set(creatorData);

      // Initialize templates for this creator
      this.templateService.initializeTemplates(creatorData.id);

      const { data: settingsData } = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData) {
        this.settings.set(settingsData);
      }

      const { data: messagesData } = await this.creatorService.getMessages(creatorData.id);
      if (messagesData) {
        this.messages.set(messagesData);
      }

      const { data: bookingsData } = await this.creatorService.getCallBookings(creatorData.id);
      if (bookingsData) {
        this.callBookings.set(bookingsData);
      }

      // Subscribe to real-time updates so the inbox refreshes instantly
      this.realtimeChannel = this.creatorService.subscribeToMessages(
        creatorData.id,
        (updatedMessages) => {
          this.messages.set(updatedMessages);
          // Keep the selected message detail pane in sync
          const selected = this.selectedMessage();
          if (selected) {
            const refreshed = updatedMessages.find((m) => m.id === selected.id);
            if (refreshed) {
              this.selectedMessage.set(refreshed);
            }
          }
        },
      );

      // Subscribe to real-time call booking updates
      this.bookingsRealtimeChannel = this.creatorService.subscribeToCallBookings(
        creatorData.id,
        (updatedBookings) => {
          this.callBookings.set(updatedBookings);
          const selected = this.selectedBooking();
          if (selected) {
            const refreshed = updatedBookings.find((b) => b.id === selected.id);
            if (refreshed) {
              this.selectedBooking.set(refreshed);
            }
          }
        },
      );
    } catch (err) {
      this.handleError(err, 'Failed to load dashboard');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Delete functionality for messages and call bookings
   */
  protected confirmDelete(item: Message | CallBooking): void {
    this.messageToDelete.set(item);
    this.showDeleteConfirm.set(true);
  }

  protected async deleteMessage(): Promise<void> {
    const item = this.messageToDelete();
    if (!item) return;

    this.deleting.set(true);
    try {
      // Check if it's a message or call booking by checking for message_content property
      const isMessage = 'message_content' in item;
      
      if (isMessage) {
        await this.creatorService.deleteMessage(item.id);
        // Remove from local state
        this.messages.update(messages => messages.filter(m => m.id !== item.id));
        // Clear selection if this was the selected message
        if (this.selectedMessage()?.id === item.id) {
          this.selectedMessage.set(null);
        }
      } else {
        await this.creatorService.deleteCallBooking(item.id);
        // Remove from local state
        this.callBookings.update(bookings => bookings.filter(b => b.id !== item.id));
        // Clear selection if this was the selected booking
        if (this.selectedBooking()?.id === item.id) {
          this.selectedBooking.set(null);
        }
      }

      this.toast.success(`${isMessage ? 'Message' : 'Call booking'} deleted successfully`);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      this.deleting.set(false);
      this.showDeleteConfirm.set(false);
      this.messageToDelete.set(null);
    }
  }

  protected cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.messageToDelete.set(null);
  }

  /**
   * Handle errors
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    this.toast.error(errorMessage);
  }
}
