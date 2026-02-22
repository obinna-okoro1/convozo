/**
 * Message page component with proper access modifiers and clean architecture
 * Now includes social proof for trust building
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { InstagramPublicService } from '../../../../core/services/instagram-public.service';
import { CreatorProfile, AvailabilitySlot, MessageType, CheckoutSessionPayload } from '../../../../core/models';
import { FormValidators } from '../../../../core/validators/form-validators';
import { APP_CONSTANTS, ERROR_MESSAGES } from '../../../../core/constants';
import { environment } from '../../../../../environments/environment';
import { SocialProofComponent, SocialProofData } from '../../../../shared/components/social-proof/social-proof.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { TrustBannerComponent } from '../../../../shared/components/trust-banner/trust-banner.component';
import { CreatorProfileHeaderComponent } from '../creator-profile-header/creator-profile-header.component';
import { MessageFormComponent, MessageFormData } from '../message-form/message-form.component';
import { CallBookingFormComponent, CallBookingFormData } from '../call-booking-form/call-booking-form.component';

@Component({
  selector: 'app-message-page',
  imports: [
    RouterLink,
    SocialProofComponent,
    TrustBannerComponent,
    CreatorProfileHeaderComponent,
    MessageFormComponent,
    CallBookingFormComponent,
  ],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css']
})
export class MessagePageComponent implements OnInit {
  // State signals
  protected readonly creator = signal<CreatorProfile | null>(null);
  private readonly creatorSettings = signal<CreatorProfile['creator_settings'] | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  
  // Social proof data
  protected readonly socialProofData = signal<SocialProofData>({
    totalMessages: 0,
    responseRate: 0,
    avgResponseTime: 24,
    verifiedCreator: false,
  });

  // Availability data
  protected readonly availabilitySlots = signal<AvailabilitySlot[]>([]);

  // Instagram data
  protected readonly instagramUsername = signal<string | null>(null);
  protected readonly instagramProfileUrl = computed(() => {
    const username = this.instagramUsername();
    return username ? this.instagramService.getProfileUrl(username) : null;
  });

  // UI state
  protected readonly activeTab = signal<'message' | 'call'>('message');
  protected readonly submitting = signal<boolean>(false);

  // Computed values
  protected readonly settings = computed(() => this.creatorSettings());
  protected readonly messagePriceCents = computed(() => this.settings()?.message_price ?? 0);
  protected readonly callPriceCents = computed(() => this.settings()?.call_price ?? 0);
  protected readonly callDuration = computed(() => this.settings()?.call_duration ?? 30);
  protected readonly responseExpectation = computed(() => this.settings()?.response_expectation ?? '24-48 hours');

  private stripe: Stripe | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
    private readonly instagramService: InstagramPublicService,
    private readonly toast: ToastService
  ) {}

  public async ngOnInit(): Promise<void> {
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
      if (settings) {
        this.creatorSettings.set(settings);
      }
      
      // Load social proof data
      await this.loadSocialProofData((data as CreatorProfile).id);
      
      // Load availability slots for call bookings
      await this.loadAvailabilitySlots((data as CreatorProfile).id);
    } catch {
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load real social proof data for the creator from the database
   */
  private async loadSocialProofData(creatorId: string): Promise<void> {
    try {
      const { data: messages, error } = await this.supabaseService.client
        .from('messages')
        .select('id, is_handled, created_at, replied_at')
        .eq('creator_id', creatorId);

      if (error || !messages) {
        return;
      }

      const totalMessages = messages.length;

      // Calculate response rate: messages that have been replied to
      const replied = messages.filter(m => m.replied_at).length;
      const responseRate = totalMessages > 0 ? Math.round((replied / totalMessages) * 100) : 0;

      // Calculate average response time in hours (for messages that have a reply)
      let avgResponseTime = 24;
      const repliedMessages = messages.filter(m => m.replied_at && m.created_at);
      if (repliedMessages.length > 0) {
        const totalHours = repliedMessages.reduce((sum, m) => {
          const created = new Date(m.created_at).getTime();
          const replied = new Date(m.replied_at).getTime();
          return sum + (replied - created) / (1000 * 60 * 60);
        }, 0);
        avgResponseTime = Math.max(1, Math.round(totalHours / repliedMessages.length));
      }

      this.socialProofData.set({
        totalMessages,
        responseRate,
        avgResponseTime,
        verifiedCreator: true,
        joinedDate: this.creator()?.created_at || new Date().toISOString(),
      });
    } catch {
      // Silently fail — social proof is not critical
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

      if (!error && data) {
        this.availabilitySlots.set(data);
      }
    } catch (err) {
      console.error('Failed to load availability slots:', err);
    }
  }

  /**
   * Handle message form submission from MessageFormComponent
   */
  protected async onMessageSubmit(formData: MessageFormData): Promise<void> {
    if (!this.validateMessageForm(formData)) return;
    await this.processCheckout(formData.senderName, formData.senderEmail, formData.senderInstagram, formData.messageContent, 'message');
  }

  /**
   * Handle call booking submission from CallBookingFormComponent
   */
  protected async onCallBookingSubmit(formData: CallBookingFormData): Promise<void> {
    if (!this.validateCallForm(formData)) return;
    await this.processCallCheckout(formData);
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
  private async processCheckout(senderName: string, senderEmail: string, senderInstagram: string, messageContent: string, messageType: MessageType): Promise<void> {
    if (!this.stripe) {
      this.toast.error(ERROR_MESSAGES.PAYMENT.NOT_INITIALIZED);
      return;
    }

    const creatorData = this.creator();
    if (!creatorData) return;

    this.submitting.set(true);
    try {
      const payload: CheckoutSessionPayload = {
        creator_slug: creatorData.slug,
        message_content: messageContent,
        sender_name: senderName,
        sender_email: senderEmail,
        message_type: messageType,
        price: this.messagePriceCents(),
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
    if (!creatorData) return;

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
