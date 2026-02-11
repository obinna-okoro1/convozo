/**
 * Message page component with proper access modifiers and clean architecture
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { CreatorProfile, MessageType } from '../../../../core/models';
import { FormValidators } from '../../../../core/validators/form-validators';
import { APP_CONSTANTS, ERROR_MESSAGES } from '../../../../core/constants';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-message-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css']
})
export class MessagePageComponent implements OnInit {
  // State signals
  protected readonly creator = signal<CreatorProfile | null>(null);
  private readonly creatorSettings = signal<CreatorProfile['creator_settings'][0] | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // Form signals
  protected readonly senderName = signal<string>('');
  protected readonly senderEmail = signal<string>('');
  protected readonly messageContent = signal<string>('');
  protected readonly messageType = signal<MessageType>('single');
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
    private readonly supabaseService: SupabaseService
  ) {}

  public async ngOnInit(): Promise<void> {
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
      
      const settings = (data as CreatorProfile).creator_settings?.[0];
      if (settings) {
        this.creatorSettings.set(settings);
        this.setDefaultMessageType(data as CreatorProfile);
      }
    } catch (err) {
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Set default message type based on creator pricing
   */
  private setDefaultMessageType(creator: CreatorProfile): void {
    const settings = creator.creator_settings?.[0];
    if (settings?.has_tiered_pricing) {
      this.messageType.set('fan');
    } else {
      this.messageType.set('single');
    }
  }

  /**
   * Calculate selected price based on message type
   */
  private calculateSelectedPrice(): number {
    const creatorData = this.creator();
    if (!creatorData) return 0;

    const settings = creatorData.creator_settings?.[0];
    if (!settings) return 0;

    if (settings.has_tiered_pricing) {
      return this.messageType() === 'business'
        ? (settings.business_price || 0) / APP_CONSTANTS.PRICE_MULTIPLIER
        : (settings.fan_price || 0) / APP_CONSTANTS.PRICE_MULTIPLIER;
    }

    return (settings.single_price || 0) / APP_CONSTANTS.PRICE_MULTIPLIER;
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

    const { data, error } = await this.supabaseService.createCheckoutSession({
      creator_slug: creatorData.slug,
      message_content: this.messageContent(),
      sender_name: this.senderName(),
      sender_email: this.senderEmail(),
      message_type: this.messageType(),
      price: priceInCents,
    });

    if (error || !data?.sessionId) {
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
