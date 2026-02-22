/**
 * Message page component with proper access modifiers and clean architecture
 * Now includes social proof for trust building
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { InstagramPublicService } from '../../../../core/services/instagram-public.service';
import { CreatorProfile, MessageType, AvailabilitySlot } from '../../../../core/models';
import { FormValidators } from '../../../../core/validators/form-validators';
import { APP_CONSTANTS, ERROR_MESSAGES } from '../../../../core/constants';
import { environment } from '../../../../../environments/environment';
import { SocialProofComponent, SocialProofData } from '../../../../shared/components/social-proof/social-proof.component';

@Component({
  selector: 'app-message-page',
  imports: [CommonModule, FormsModule, RouterLink, SocialProofComponent],
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
  protected readonly hasAvailability = computed(() => this.availabilitySlots().length > 0);

  // Instagram data
  protected readonly instagramUsername = signal<string | null>(null);
  protected readonly instagramProfileUrl = computed(() => {
    const username = this.instagramUsername();
    return username ? this.instagramService.getProfileUrl(username) : null;
  });

  // Form signals
  protected readonly activeTab = signal<'message' | 'call'>('message');
  protected readonly senderName = signal<string>('');
  protected readonly senderEmail = signal<string>('');
  protected readonly messageContent = signal<string>('');
  protected readonly instagramHandle = signal<string>(''); // For call bookings
  protected readonly messageType = signal<MessageType>('message');
  protected readonly submitting = signal<boolean>(false);

  // Computed values
  protected readonly selectedPrice = computed<number>(() => this.calculateSelectedPrice());
  protected readonly characterCount = computed<number>(() => this.messageContent().length);
  protected readonly maxCharacters = APP_CONSTANTS.MESSAGE_MAX_LENGTH;
  
  // Expose settings to template
  protected settings() {
    return this.creatorSettings();
  }

  private stripe: Stripe | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
    private readonly instagramService: InstagramPublicService
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
        console.log('DEBUG: Creator settings loaded:', settings);
        console.log('DEBUG: calls_enabled:', settings.calls_enabled);
        console.log('DEBUG: call_price:', settings.call_price);
        console.log('DEBUG: call_duration:', settings.call_duration);
        this.creatorSettings.set(settings);
        this.setDefaultMessageType(data as CreatorProfile);
      } else {
        console.log('DEBUG: No settings found for creator');
      }
      
      // Load social proof data
      await this.loadSocialProofData((data as CreatorProfile).id);
      
      // Load availability slots for call bookings
      await this.loadAvailabilitySlots((data as CreatorProfile).id);
    } catch (err) {
      console.error('DEBUG: Error loading creator:', err);
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load social proof data for the creator
   */
  private async loadSocialProofData(creatorId: string): Promise<void> {
    try {
      // For now, we'll use mock data - in production, this would fetch from the database
      // This can be extended to call an edge function that returns aggregated stats
      const mockData: SocialProofData = {
        totalMessages: Math.floor(Math.random() * 500) + 50, // Simulated for demo
        responseRate: Math.floor(Math.random() * 20) + 80, // 80-100%
        avgResponseTime: Math.floor(Math.random() * 12) + 2, // 2-14 hours
        verifiedCreator: true,
        joinedDate: this.creator()?.created_at || new Date().toISOString(),
      };
      
      this.socialProofData.set(mockData);
    } catch (err) {
      console.error('Failed to load social proof data:', err);
      // Silently fail - social proof is not critical
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
   * Get availability grouped by day
   */
  protected getAvailabilityByDay(): { day: string; slots: { start: string; end: string }[] }[] {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = new Map<number, { start: string; end: string }[]>();

    for (const slot of this.availabilitySlots()) {
      if (!grouped.has(slot.day_of_week)) {
        grouped.set(slot.day_of_week, []);
      }
      grouped.get(slot.day_of_week)!.push({
        start: this.formatTime(slot.start_time),
        end: this.formatTime(slot.end_time),
      });
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, slots]) => ({ day: dayNames[day], slots }));
  }

  /**
   * Format time from 24h to 12h
   */
  protected formatTime(time: string): string {
    const [hours, minutes] = time.substring(0, 5).split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Set default message type based on creator pricing
   */
  private setDefaultMessageType(creator: CreatorProfile): void {
    this.messageType.set('message');
  }

  /**
   * Calculate selected price based on message type
   */
  private calculateSelectedPrice(): number {
    const creatorData = this.creator();
    if (!creatorData) return 0;

    const settings = creatorData.creator_settings;
    if (!settings) return 0;

    if (this.activeTab() === 'call' && settings.call_price) {
      return (settings.call_price || 0) / APP_CONSTANTS.PRICE_MULTIPLIER;
    }

    return (settings.message_price || 0) / APP_CONSTANTS.PRICE_MULTIPLIER;
  }

  /**
   * Submit message and process payment
   */
  protected async submitMessage(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    if (!this.stripe) {
      alert(ERROR_MESSAGES.PAYMENT.NOT_INITIALIZED);
      return;
    }

    this.submitting.set(true);

    try {
      await this.createCheckoutSession();
    } catch (err) {
      console.error('Checkout session error:', err);
      this.handleError(err, ERROR_MESSAGES.PAYMENT.FAILED_TO_PROCESS);
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Create Stripe checkout session and redirect
   */
  private async createCheckoutSession(): Promise<void> {
    const priceInCents = this.selectedPrice() * APP_CONSTANTS.PRICE_MULTIPLIER;
    const creatorData = this.creator();

    if (!creatorData) {
      throw new Error('Creator data not loaded');
    }

    // For call bookings, use a different payload structure
    if (this.activeTab() === 'call') {
      const { data, error } = await this.supabaseService.createCallBookingSession({
        creator_slug: creatorData.slug,
        booker_name: this.senderName(),
        booker_email: this.senderEmail(),
        booker_instagram: this.instagramHandle(),
        message_content: this.messageContent() || '', // Optional message
        price: priceInCents,
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to create call booking session');
      }

      window.location.href = data.url;
      return;
    }

    // For regular messages
    const { data, error } = await this.supabaseService.createCheckoutSession({
      creator_slug: creatorData.slug,
      message_content: this.messageContent(),
      sender_name: this.senderName(),
      sender_email: this.senderEmail(),
      message_type: this.messageType(),
      price: priceInCents,
    });

    console.log('Checkout session response:', { data, error });

    if (error || !data?.sessionId) {
      console.error('Checkout session failed:', error);
      throw new Error(error?.message || 'Failed to create checkout session');
    }

    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL received');
    }
  }

  /**
   * Validate form inputs
   */
  private validateForm(): boolean {
    if (!FormValidators.isNotEmpty(this.senderName())) {
      alert(ERROR_MESSAGES.MESSAGE.NAME_REQUIRED);
      return false;
    }

    if (!FormValidators.isValidEmail(this.senderEmail())) {
      alert(ERROR_MESSAGES.MESSAGE.EMAIL_REQUIRED);
      return false;
    }

    // For calls, Instagram handle is required, message is optional
    if (this.activeTab() === 'call') {
      if (!FormValidators.isNotEmpty(this.instagramHandle())) {
        alert('Instagram handle is required for call bookings');
        return false;
      }
      // Message content is optional for calls
      return true;
    }

    // For messages, content is required
    if (!FormValidators.isNotEmpty(this.messageContent())) {
      alert(ERROR_MESSAGES.MESSAGE.CONTENT_REQUIRED);
      return false;
    }

    if (!FormValidators.isValidMessageLength(this.messageContent())) {
      alert(ERROR_MESSAGES.MESSAGE.CONTENT_TOO_LONG);
      return false;
    }

    return true;
  }

  /**
   * Handle errors consistently
   */
  private handleError(err: unknown, defaultMessage: string): void {
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    alert(`${defaultMessage}: ${errorMessage}`);
  }
}
