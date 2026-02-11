/**
 * Onboarding Component
 * Lean component that delegates business logic to CreatorService
 */

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreatorService } from '../../services/creator.service';
import { AuthService } from '../../../auth/services/auth.service';
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

  // Constants
  protected readonly TOTAL_STEPS = 3;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  public async ngOnInit(): Promise<void> {
    await this.checkExistingProfile();
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
        profileImageUrl: this.profileImageUrl() || undefined
      });

      if (creatorError || !creator) {
        throw creatorError || new Error('Failed to create creator');
      }

      // Create creator settings
      const singlePriceValue = this.pricingType() === 'single' ? this.singlePrice() : undefined;
      const fanPriceValue = this.pricingType() === 'tiered' ? this.fanPrice() : undefined;
      const businessPriceValue = this.pricingType() === 'tiered' ? this.businessPrice() : undefined;

      const { error: settingsError } = await this.creatorService.createCreatorSettings({
        creatorId: creator.id,
        pricingType: this.pricingType(),
        singlePrice: singlePriceValue,
        fanPrice: fanPriceValue,
        businessPrice: businessPriceValue,
        responseExpectation: this.responseExpectation()
      });

      if (settingsError) {
        throw settingsError;
      }

      // Redirect to dashboard (Stripe Connect setup happens separately)
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
    } finally {
      this.loading.set(false);
    }
  }
}
