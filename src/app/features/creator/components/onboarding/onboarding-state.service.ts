/**
 * Onboarding State Service
 * Owns all form state, validation, and actions for the multi-step onboarding flow.
 * The OnboardingComponent is a thin shell that delegates everything here.
 *
 * Steps:
 *   1 - Creator profile (display name, slug, phone, bio, avatar)
 *   2 - Payment info (read-only explainer — connect Stripe later in Settings)
 *   3 - Monetization preview (locked toggles — enable after Stripe in Settings)
 *   4 - Review & complete
 *
 * The creator row and default settings are written at step 4. All monetization
 * (Stripe connection, pricing, toggle activation) happens post-onboarding in Settings.
 */

import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_CONSTANTS, ROUTES, ERROR_MESSAGES } from '../../../../core/constants';
import { FormValidators } from '../../../../core/validators/form-validators';
import { AuthService } from '../../../auth/services/auth.service';
import { CreatorService } from '../../services/creator.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import {
  COUNTRY_CODES,
  detectCountryIndex,
} from './phone-country-codes.data';
import type { SelectOption } from '../../../../shared/components/ui/searchable-select/searchable-select.component';
import { errorMessage } from '../../../../shared/utils/error.utils';

@Injectable()
export class OnboardingStateService implements OnDestroy {
  // ── Step management ────────────────────────────────────────────────
  readonly currentStep = signal<number>(1);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly TOTAL_STEPS = 4;

  // ── Profile fields ─────────────────────────────────────────────────
  readonly displayName = signal<string>('');
  readonly bio = signal<string>('');
  readonly slug = signal<string>('');
  readonly slugStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  readonly slugManuallyEdited = signal<boolean>(false);
  readonly profileImageUrl = signal<string>('');

  // ── Phone number ───────────────────────────────────────────────────
  readonly countryCodes = COUNTRY_CODES;
  readonly selectedCountryIndex = signal<number>(0);
  readonly phoneNumber = signal<string>('');

  readonly countryCodeOptions: SelectOption[] = COUNTRY_CODES.map((cc, i) => ({
    value: String(i),
    label: `${cc.flag} ${cc.country} (${cc.code})`,
  }));

  // Exposed so the template can reference String() for type conversion
  readonly String = String;

  readonly fullPhoneNumber = computed(() => {
    const country = COUNTRY_CODES[this.selectedCountryIndex()];
    const local = this.phoneNumber().trim();
    if (!local) return '';
    return `${country.code} ${local}`;
  });

  // ── OAuth import indicator ─────────────────────────────────────────
  readonly hasOAuthData = signal<boolean>(false);
  readonly oauthProvider = signal<string>('');

  // ── Validation ─────────────────────────────────────────────────────
  readonly canProceedStep1 = computed(
    () =>
      !!this.displayName() &&
      !!this.slug() &&
      !!this.phoneNumber() &&
      this.slugStatus() !== 'checking' &&
      this.slugStatus() !== 'taken' &&
      this.slugStatus() !== 'invalid',
  );

  // Tracks a creator row already written to the DB during this session.
  // Set by completeOnboarding() so an update path is used on re-submit.
  private readonly _savedCreatorId = signal<string | null>(null);

  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
  ) {}

  ngOnDestroy(): void {
    if (this.slugCheckTimer != null) {
      clearTimeout(this.slugCheckTimer);
      this.slugCheckTimer = null;
    }
  }

  // ── Initialization ─────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.selectedCountryIndex.set(detectCountryIndex());
    await this.checkExistingProfile();
    this.loadOAuthData();
  }

  private loadOAuthData(): void {
    const oauthData = this.authService.getStoredOAuthData();
    if (!oauthData) return;

    this.hasOAuthData.set(true);
    this.oauthProvider.set(oauthData.provider || '');

    if (oauthData.full_name) {
      this.displayName.set(oauthData.full_name);
      const generated = FormValidators.generateSlug(oauthData.full_name);
      this.slug.set(generated);
      this.debouncedSlugCheck(generated);
    }

    if (oauthData.avatar_url) {
      this.profileImageUrl.set(oauthData.avatar_url);
    }
  }

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

  // ── Navigation ─────────────────────────────────────────────────────

  nextStep(): void {
    if (this.currentStep() < this.TOTAL_STEPS) {
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  // ── Profile field updates ──────────────────────────────────────────

  updateDisplayName(value: string): void {
    this.displayName.set(value);
    if (!this.slugManuallyEdited()) {
      const generated = FormValidators.generateSlug(value);
      this.slug.set(generated);
      this.debouncedSlugCheck(generated);
    }
  }

  updateSlug(value: string): void {
    const sanitized = FormValidators.sanitizeSlug(value);
    this.slug.set(sanitized);
    this.slugManuallyEdited.set(true);
    this.debouncedSlugCheck(sanitized);
  }

  // ── Slug availability debounce ─────────────────────────────────────

  private debouncedSlugCheck(slug: string): void {
    if (this.slugCheckTimer != null) {
      clearTimeout(this.slugCheckTimer);
    }

    if (!slug || !FormValidators.isValidSlug(slug)) {
      this.slugStatus.set(slug ? 'invalid' : 'idle');
      return;
    }

    this.slugStatus.set('checking');
    this.slugCheckTimer = setTimeout(() => {
      void this.performSlugCheck(slug);
    }, 400);
  }

  private async performSlugCheck(slug: string): Promise<void> {
    if (this.slug() !== slug) return;

    const { available } = await this.creatorService.checkSlugAvailability(slug);
    if (this.slug() !== slug) return;

    this.slugStatus.set(available ? 'available' : 'taken');
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Returns the authenticated user via a fresh network check.
   * Redirects to login and throws if the session is gone.
   */
  private async requireUser() {
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    if (!user) {
      void this.router.navigate([ROUTES.AUTH.LOGIN]);
      throw new Error('Your session has expired. Please sign in again.');
    }
    return user;
  }

  /**
   * Builds the editable profile fields from current form signals.
   * Single source of truth — spread into both create and update calls.
   */
  private profileFormFields() {
    return {
      displayName: this.displayName(),
      bio: this.bio(),
      slug: this.slug(),
      phoneNumber: this.fullPhoneNumber(),
      profileImageUrl: this.profileImageUrl() || undefined,
    };
  }

  // ── Actions ────────────────────────────────────────────────────────

  /**
   * Finalise onboarding: create the creator row + default settings (all channels off),
   * then navigate to the dashboard. Stripe connection and monetization activation
   * happen post-onboarding in Settings -> Payments.
   */
  async completeOnboarding(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const user = await this.requireUser();
      const savedId = this._savedCreatorId();

      if (savedId) {
        const { error } = await this.creatorService.updateCreatorProfile({
          creatorId: savedId,
          ...this.profileFormFields(),
        });
        if (error) throw error;
      } else {
        const { data: creator, error } = await this.creatorService.createCreator({
          userId: user.id,
          email: user.email ?? '',
          // The ISO code of the selected phone prefix — determines payment_provider in the DB.
          country: COUNTRY_CODES[this.selectedCountryIndex()].iso,
          ...this.profileFormFields(),
        });
        if (error || !creator) {
          const msg = (error as { message?: string } | null)?.message ?? '';
          if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('slug')) {
            this.slugStatus.set('taken');
            this.currentStep.set(1);
            throw new Error(
              'This URL slug is already taken — please go back and choose a different one',
            );
          }
          throw error ?? new Error('Failed to create creator profile');
        }
        this._savedCreatorId.set(creator.id);
      }

      const creatorId = this._savedCreatorId()!;

      // All channels off by default — creator enables them after connecting Stripe
      // in Settings -> Payments.
      const { error: settingsError } = await this.creatorService.createCreatorSettings({
        creatorId,
        messagePrice: 500,
        messagesEnabled: false,
        callPrice: 2000,
        callDuration: 10,
        callsEnabled: false,
        followBackPrice: 2000,
        followBackEnabled: false,
        tipsEnabled: false,
        responseExpectation: APP_CONSTANTS.DEFAULT_RESPONSE_EXPECTATION,
      });
      if (settingsError) throw settingsError;

      // Verify settings were actually created (guard against future database issues)
      const { data: settingsCheck } = await this.creatorService.getCreatorSettings(creatorId);
      if (!settingsCheck) {
        throw new Error('Failed to verify creator settings were saved. Please try again.');
      }

      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    } catch (err) {
      const msg = errorMessage(err, '');
      if (
        msg.includes('row-level security') ||
        msg.includes('violates') ||
        msg.includes('constraint')
      ) {
        this.error.set('Something went wrong saving your profile. Please log out and try again.');
      } else {
        this.error.set(msg || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
