/**
 * Onboarding Component
 * Lean component that delegates business logic to CreatorService
 * Now with OAuth auto-import support
 */

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreatorService } from '../../services/creator.service';
import { AuthService, OAuthUserData } from '../../../auth/services/auth.service';
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
  protected readonly instagramUsername = signal<string>(''); // Manual text input, not OAuth
  
  // Pricing form data
  protected readonly messagePrice = signal<number>(1000); // in cents ($10)
  protected readonly callPrice = signal<number>(5000); // in cents ($50)
  protected readonly callDuration = signal<number>(30); // minutes
  protected readonly callsEnabled = signal<boolean>(false);
  protected readonly responseExpectation = signal<string>(APP_CONSTANTS.DEFAULT_RESPONSE_EXPECTATION);

  // Stripe Connect
  protected readonly stripeConnecting = signal<boolean>(false);
  protected readonly stripeConnected = signal<boolean>(false);
  
  // OAuth import indicator
  protected readonly hasOAuthData = signal<boolean>(false);
  protected readonly oauthProvider = signal<string>('');

  // Constants
  protected readonly TOTAL_STEPS = 4;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.checkExistingProfile();
    this.loadOAuthData();
  }

  /**
   * Load OAuth data if available and auto-fill form
   */
  private loadOAuthData(): void {
    const oauthData = this.authService.getStoredOAuthData();
    if (!oauthData) return;

    this.hasOAuthData.set(true);
    this.oauthProvider.set(oauthData.provider || '');

    // Auto-fill form fields
    if (oauthData.full_name) {
      this.displayName.set(oauthData.full_name);
      this.slug.set(FormValidators.generateSlug(oauthData.full_name));
    }

    if (oauthData.avatar_url) {
      this.profileImageUrl.set(oauthData.avatar_url);
    }
  }

  /**
   * Check if user already has a profile
   */
  private async checkExistingProfile(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    const { data: creator } = await this.creatorService.getCreatorByUserId(user.id);
    if (creator) {
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    }
  }

  /**
   * Navigate steps
   */
  protected nextStep(): void {
    if (this.currentStep() < this.TOTAL_STEPS) {
      this.currentStep.update(s => s + 1);
    }
  }

  protected prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  /**
   * Update display name and generate slug
   */
  protected updateDisplayName(value: string): void {
    this.displayName.set(value);
    if (!this.slug()) {
      this.slug.set(FormValidators.generateSlug(value));
    }
  }

  /**
   * Complete onboarding
   */
  protected async completeOnboarding(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error.set(ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED);
      this.loading.set(false);
      return;
    }

    try {
      // Create creator profile
      const { data: creator, error: creatorError } = await this.creatorService.createCreator({
        userId: user.id,
        displayName: this.displayName(),
        bio: this.bio(),
        slug: this.slug(),
        profileImageUrl: this.profileImageUrl() || undefined,
        instagramUsername: this.instagramUsername() || undefined
      });

      if (creatorError || !creator) {
        throw creatorError || new Error('Failed to create creator');
      }

      // Create creator settings
      const { error: settingsError } = await this.creatorService.createCreatorSettings({
        creatorId: creator.id,
        messagePrice: this.messagePrice(),
        callPrice: this.callsEnabled() ? this.callPrice() : undefined,
        callDuration: this.callsEnabled() ? this.callDuration() : undefined,
        callsEnabled: this.callsEnabled(),
        responseExpectation: this.responseExpectation()
      });

      if (settingsError) {
        throw settingsError;
      }

      // Move to Stripe Connect step
      this.nextStep();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Connect Stripe account
   */
  protected async connectStripe(): Promise<void> {
    this.stripeConnecting.set(true);
    this.error.set(null);

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error.set(ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED);
      this.stripeConnecting.set(false);
      return;
    }

    try {
      const { data: creator } = await this.creatorService.getCreatorByUserId(user.id);
      if (!creator) {
        throw new Error('Creator profile not found');
      }

      const { data, error } = await this.creatorService.createStripeConnectAccount(
        creator.id,
        user.email || '',
        this.displayName()
      );

      if (error || !data?.url) {
        throw error || new Error('Failed to create Stripe Connect account');
      }

      // Redirect to Stripe OAuth
      window.location.href = data.url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
      this.stripeConnecting.set(false);
    }
  }

  /**
   * Skip Stripe setup for now
   */
  protected skipStripeSetup(): void {
    this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
  }
}
