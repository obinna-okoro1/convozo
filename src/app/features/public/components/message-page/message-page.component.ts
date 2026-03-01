/**
 * Message page component — public-facing page where fans send paid messages or book calls.
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../../../environments/environment';
import { ERROR_MESSAGES } from '../../../../core/constants';
import {
  CreatorProfile,
  AvailabilitySlot,
  MessageType,
  CheckoutSessionPayload,
} from '../../../../core/models';
import { InstagramPublicService } from '../../../../core/services/instagram-public.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { FormValidators } from '../../../../core/validators/form-validators';
import { TrustBannerComponent } from '../../../../shared/components/trust-banner/trust-banner.component';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  CallBookingFormComponent,
  CallBookingFormData,
} from '../call-booking-form/call-booking-form.component';
import { CreatorProfileHeaderComponent } from '../creator-profile-header/creator-profile-header.component';
import { MessageFormComponent, MessageFormData } from '../message-form/message-form.component';

@Component({
  selector: 'app-message-page',
  imports: [
    RouterLink,
    TrustBannerComponent,
    CreatorProfileHeaderComponent,
    MessageFormComponent,
    CallBookingFormComponent,
  ],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagePageComponent implements OnInit {
  // State signals
  protected readonly creator = signal<CreatorProfile | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // Availability data
  protected readonly availabilitySlots = signal<AvailabilitySlot[]>([]);

  // Instagram data
  protected readonly instagramUsername = signal<string | null>(null);
  protected readonly instagramProfileUrl = computed(() => {
    const username = this.instagramUsername();
    return username ? this.instagramService.getProfileUrl(username) : null;
  });

  // UI state
  protected readonly activeTab = signal<'message' | 'call' | 'follow_back'>('message');
  protected readonly submitting = signal<boolean>(false);

  // Computed values
  protected readonly settings = computed(() => this.creatorSettings());
  protected readonly messagePriceCents = computed(() => this.settings()?.message_price ?? 0);
  protected readonly followBackPriceCents = computed(() => this.settings()?.follow_back_price ?? 0);
  protected readonly followBackEnabled = computed(() => this.settings()?.follow_back_enabled ?? false);
  protected readonly callPriceCents = computed(() => this.settings()?.call_price ?? 0);
  protected readonly callDuration = computed(() => this.settings()?.call_duration ?? 30);
  protected readonly responseExpectation = computed(
    () => this.settings()?.response_expectation ?? '24-48 hours',
  );

  private readonly creatorSettings = signal<CreatorProfile['creator_settings'] | null>(null);
  private stripe: Stripe | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
    private readonly instagramService: InstagramPublicService,
    private readonly toast: ToastService,
  ) {}

  public ngOnInit(): void {
    void this.initialize();
  }

  /**
   * Handle message form submission from MessageFormComponent
   */
  protected async onMessageSubmit(formData: MessageFormData): Promise<void> {
    if (!this.validateMessageForm(formData)) {
      return;
    }
    await this.processCheckout(
      formData.senderName,
      formData.senderEmail,
      formData.senderInstagram,
      formData.messageContent,
      'message',
    );
  }

  /**
   * Handle follow-back request submission — uses the same message flow with different pricing
   */
  protected async onFollowBackSubmit(formData: MessageFormData): Promise<void> {
    if (!this.validateMessageForm(formData)) {
      return;
    }
    await this.processCheckout(
      formData.senderName,
      formData.senderEmail,
      formData.senderInstagram,
      formData.messageContent,
      'follow_back',
    );
  }

  /**
   * Handle call booking submission from CallBookingFormComponent
   */
  protected async onCallBookingSubmit(formData: CallBookingFormData): Promise<void> {
    if (!this.validateCallForm(formData)) {
      return;
    }
    await this.processCallCheckout(formData);
  }

  private async initialize(): Promise<void> {
    // Handle ?tab=call query parameter for deep-linking
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'call') {
      this.activeTab.set('call');
    }

    await this.initializeStripe();
    await this.loadCreatorFromUrl();
  }

  /**
   * Initialize Stripe client
   */
  private async initializeStripe(): Promise<void> {
    this.stripe = await loadStripe(environment.stripe.publishableKey);
  }

  /**
   * Load creator from URL slug
   */
  private async loadCreatorFromUrl(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Invalid URL');
      this.loading.set(false);
      return;
    }

    await this.loadCreator(slug);
  }

  /**
   * Load creator profile
   */
  private async loadCreator(slug: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getCreatorBySlug(slug);

      if (error || !data) {
        this.error.set('Creator not found');
        return;
      }

      this.creator.set(data as CreatorProfile);

      // Load Instagram username if available
      if ((data as CreatorProfile).instagram_username) {
        this.instagramUsername.set((data as CreatorProfile).instagram_username);
      }

      const settings = (data as CreatorProfile).creator_settings;
      if (settings != null) {
        this.creatorSettings.set(settings);
      }

      // Load availability slots for call bookings
      await this.loadAvailabilitySlots((data as CreatorProfile).id);
    } catch {
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load availability slots for the creator
   */
  private async loadAvailabilitySlots(creatorId: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('availability_slots')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error == null && data != null) {
        this.availabilitySlots.set(data as AvailabilitySlot[]);
      }
    } catch (err) {
      console.error('Failed to load availability slots:', err);
    }
  }

  /**
   * Validate message form inputs
   */
  private validateMessageForm(data: MessageFormData): boolean {
    if (!FormValidators.isNotEmpty(data.senderName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidEmail(data.senderEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return false;
    }
    if (!FormValidators.isNotEmpty(data.messageContent)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.CONTENT_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidMessageLength(data.messageContent)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.CONTENT_TOO_LONG);
      return false;
    }
    return true;
  }

  /**
   * Validate call booking form inputs
   */
  private validateCallForm(data: CallBookingFormData): boolean {
    if (!FormValidators.isNotEmpty(data.senderName)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return false;
    }
    if (!FormValidators.isValidEmail(data.senderEmail)) {
      this.toast.error(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return false;
    }
    if (!FormValidators.isNotEmpty(data.instagramHandle)) {
      this.toast.error('Instagram handle is required for call bookings');
      return false;
    }
    return true;
  }

  /**
   * Process message checkout via Stripe
   */
  private async processCheckout(
    senderName: string,
    senderEmail: string,
    senderInstagram: string,
    messageContent: string,
    messageType: MessageType,
  ): Promise<void> {
    if (!this.stripe) {
      this.toast.error(ERROR_MESSAGES.PAYMENT.NOT_INITIALIZED);
      return;
    }

    const creatorData = this.creator();
    if (!creatorData) {
      return;
    }

    this.submitting.set(true);
    try {
      const priceCents = messageType === 'follow_back' ? this.followBackPriceCents() : this.messagePriceCents();

      const payload: CheckoutSessionPayload = {
        creator_slug: creatorData.slug,
        message_content: messageContent,
        sender_name: senderName,
        sender_email: senderEmail,
        message_type: messageType,
        price: priceCents,
      };

      // Only include sender_instagram if provided
      if (senderInstagram.trim()) {
        payload.sender_instagram = senderInstagram.trim();
      }

      const { data, error } = await this.supabaseService.createCheckoutSession(payload);

      if (error || !data?.sessionId) {
        throw new Error(error?.message || 'Failed to create checkout session');
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Process call booking checkout via Stripe
   */
  private async processCallCheckout(formData: CallBookingFormData): Promise<void> {
    if (!this.stripe) {
      this.toast.error(ERROR_MESSAGES.PAYMENT.NOT_INITIALIZED);
      return;
    }

    const creatorData = this.creator();
    if (!creatorData) {
      return;
    }

    this.submitting.set(true);
    try {
      const { data, error } = await this.supabaseService.createCallBookingSession({
        creator_slug: creatorData.slug,
        booker_name: formData.senderName,
        booker_email: formData.senderEmail,
        booker_instagram: formData.instagramHandle,
        message_content: formData.messageContent || '',
        price: this.callPriceCents(),
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to create call booking session');
      }
      window.location.href = data.url;
    } catch (err) {
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    this.toast.error(`${defaultMessage}: ${errorMessage}`);
  }
}
