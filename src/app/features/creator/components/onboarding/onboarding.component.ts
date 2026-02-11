/**
 * Onboarding component with proper access modifiers and clean architecture
 */

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { PricingType } from '../../../../core/models';
import { FormValidators } from '../../../../core/validators/form-validators';
import { APP_CONSTANTS, ROUTES, ERROR_MESSAGES } from '../../../../core/constants';

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  // Step management
  protected readonly currentStep = signal<number>(1);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  // Profile form data
  protected readonly displayName = signal<string>('');
  protected readonly bio = signal<string>('');
  protected readonly slug = signal<string>('');
  protected readonly profileImageUrl = signal<string>('');
  
  // Pricing form data
  protected readonly pricingType = signal<PricingType>('single');
  protected readonly singlePrice = signal<number>(50);
  protected readonly fanPrice = signal<number>(25);
  protected readonly businessPrice = signal<number>(100);
  protected readonly responseExpectation = signal<string>(APP_CONSTANTS.DEFAULT_RESPONSE_EXPECTATION);

  // Constants exposed to template
  protected readonly TOTAL_STEPS = 3;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.checkExistingProfile();
  }

  /**
   * Check if user already has a creator profile
   */
  private async checkExistingProfile(): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    const { data: creator } = await this.supabaseService.getCreatorByUserId(user.id);
    if (creator) {
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    }
  }

  /**
   * Advance to next step
   */
  protected nextStep(): void {
    if (this.currentStep() < this.TOTAL_STEPS) {
      this.currentStep.update(s => s + 1);
    }
  }

  /**
   * Go back to previous step
   */
  protected prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  /**
   * Update display name and auto-generate slug
   */
  protected updateDisplayName(value: string): void {
    this.displayName.set(value);
    if (!this.slug()) {
      this.slug.set(FormValidators.generateSlug(value));
    }
  }

  /**
   * Complete the onboarding process
   */
  protected async completeOnboarding(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      this.error.set(ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED);
      this.loading.set(false);
      return;
    }

    try {
      const creator = await this.createCreatorProfile(user.id, user.email!);
      await this.createCreatorSettings(creator.id);
      await this.setupStripeConnect(creator.id, user.email!);
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Create creator profile in database
   */
  private async createCreatorProfile(userId: string, email: string) {
    const { data: creator, error: creatorError } = await this.supabaseService.createCreator({
      user_id: userId,
      email,
      display_name: this.displayName(),
      bio: this.bio() || null,
      slug: this.slug(),
      profile_image_url: this.profileImageUrl() || null,
    });

    if (creatorError || !creator) {
      throw creatorError || new Error('Failed to create creator');
    }

    return creator;
  }

  /**
   * Create creator settings
   */
  private async createCreatorSettings(creatorId: string): Promise<void> {
    const { error: settingsError } = await this.supabaseService.createCreatorSettings({
      creator_id: creatorId,
      has_tiered_pricing: this.pricingType() === 'tiered',
      single_price: this.calculateSinglePrice(),
      fan_price: this.calculateFanPrice(),
      business_price: this.calculateBusinessPrice(),
      response_expectation: this.responseExpectation(),
      auto_reply_text: this.generateAutoReplyText(),
    });

    if (settingsError) {
      throw settingsError;
    }
  }

  /**
   * Setup Stripe Connect account
   */
  private async setupStripeConnect(creatorId: string, email: string): Promise<void> {
    const { data: connectData, error: connectError } = await this.supabaseService.createConnectAccount(
      creatorId,
      email,
      this.displayName()
    );

    if (connectError || !connectData?.url) {
      console.error('Stripe Connect setup failed:', connectError);
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD], {
        queryParams: { stripe_setup: 'incomplete' }
      });
      return;
    }

    window.location.href = connectData.url;
  }

  /**
   * Calculate single price in cents
   */
  private calculateSinglePrice(): number | null {
    return this.pricingType() === 'single' 
      ? this.singlePrice() * APP_CONSTANTS.PRICE_MULTIPLIER 
      : null;
  }

  /**
   * Calculate fan price in cents
   */
  private calculateFanPrice(): number | null {
    return this.pricingType() === 'tiered' 
      ? this.fanPrice() * APP_CONSTANTS.PRICE_MULTIPLIER 
      : null;
  }

  /**
   * Calculate business price in cents
   */
  private calculateBusinessPrice(): number | null {
    return this.pricingType() === 'tiered' 
      ? this.businessPrice() * APP_CONSTANTS.PRICE_MULTIPLIER 
      : null;
  }

  /**
   * Generate auto-reply text
   */
  private generateAutoReplyText(): string {
    const slug = this.slug();
    return `Thanks for your message! Visit my Convozo page to send a priority message: ${window.location.origin}/${slug}`;
  }

  /**
   * Handle errors consistently
   */
  private handleError(err: unknown): void {
    this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
  }
}
