/**
 * Onboarding State Service
 * Owns all form state, validation, and actions for the multi-step onboarding flow.
 * The OnboardingComponent is a thin shell that delegates everything here.
 *
 * Steps:
 *   1 – Creator profile (display name, slug, phone, bio, avatar)
 *   2 – Stripe Connect setup (optional, can skip)
 *   3 – Monetization (pricing toggles)
 *   4 – Review & complete
 */

import { computed, Injectable, signal } from '@angular/core';
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

@Injectable()
export class OnboardingStateService {
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
  readonly instagramUsername = signal<string>('');

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

  // ── Monetization fields ────────────────────────────────────────────
  readonly messagePrice = signal<number>(1000);        // cents ($10)
  readonly messagesEnabled = signal<boolean>(false);
  readonly callPrice = signal<number>(5000);           // cents ($50)
  readonly callDuration = signal<number>(30);          // minutes
  readonly callsEnabled = signal<boolean>(false);
  readonly followBackEnabled = signal<boolean>(false);
  readonly followBackPrice = signal<number>(2000);     // cents ($20)
  readonly tipsEnabled = signal<boolean>(false);
  readonly responseExpectation = signal<string>(APP_CONSTANTS.DEFAULT_RESPONSE_EXPECTATION);

  // ── Payment setup ──────────────────────────────────────────────────
  readonly paymentConnecting = signal<boolean>(false);
  readonly paymentConnected = signal<boolean>(false);

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

  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
  ) {}

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

  skipPaymentSetup(): void {
    this.nextStep();
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

  // ── Completion ─────────────────────────────────────────────────────

  async completeOnboarding(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error.set(ERROR_MESSAGES.AUTH.NOT_AUTHENTICATED);
      this.loading.set(false);
      return;
    }

    try {
      const { data: creator, error: creatorError } = await this.creatorService.createCreator({
        userId: user.id,
        email: user.email || '',
        displayName: this.displayName(),
        bio: this.bio(),
        slug: this.slug(),
        phoneNumber: this.fullPhoneNumber(),
        profileImageUrl: this.profileImageUrl() || undefined,
        instagramUsername: this.instagramUsername() || undefined,
      });

      if (creatorError || !creator) {
        const errMsg = creatorError?.message ?? '';
        if (errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('slug')) {
          this.slugStatus.set('taken');
          this.currentStep.set(1);
          throw new Error(
            'This URL slug is already taken — please go back and choose a different one',
          );
        }
        throw creatorError || new Error('Failed to create creator');
      }

      const { error: settingsError } = await this.creatorService.createCreatorSettings({
        creatorId: creator.id,
        messagePrice: this.messagePrice(),
        messagesEnabled: this.messagesEnabled(),
        callPrice: this.callsEnabled() ? this.callPrice() : undefined,
        callDuration: this.callsEnabled() ? this.callDuration() : undefined,
        callsEnabled: this.callsEnabled(),
        followBackPrice: this.followBackEnabled() ? this.followBackPrice() : undefined,
        followBackEnabled: this.followBackEnabled(),
        tipsEnabled: this.tipsEnabled(),
        responseExpectation: this.responseExpectation(),
      });

      if (settingsError) {
        throw settingsError;
      }

      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('row-level security') ||
        msg.includes('violates') ||
        msg.includes('constraint')
      ) {
        this.error.set('Something went wrong saving your profile. Please log out and try again.');
      } else if (msg) {
        this.error.set(msg);
      } else {
        this.error.set(ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async connectPayment(): Promise<void> {
    this.paymentConnecting.set(true);
    this.error.set(null);

    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();
      if (!user) {
        this.error.set('Your session has expired. Please sign in again.');
        this.paymentConnecting.set(false);
        void this.router.navigate(['/auth/login']);
        return;
      }

      const { data: creator } = await this.creatorService.getCreatorByUserId(user.id);
      if (!creator) {
        throw new Error('Creator profile not found');
      }

      const { data, error } = await this.creatorService.createStripeConnectAccount(
        creator.id,
        user.email || '',
        this.displayName(),
      );

      if (error || !data?.url) {
        throw error instanceof Error ? error : new Error('Failed to create payment account');
      }

      window.location.href = data.url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
      this.paymentConnecting.set(false);
    }
  }
}
