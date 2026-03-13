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
 *
 * Two-phase persistence:
 *   The creator DB row may be written at Step 2 (when the user clicks "Connect Stripe")
 *   or deferred until Step 4 (if they skip). `_savedCreatorId` caches the id once the
 *   row exists so later steps avoid redundant DB round-trips and know whether to
 *   UPDATE vs INSERT.
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

  /**
   * Monetization toggles are only interactive when Stripe is connected.
   * Without payment setup, creators can view the step but cannot turn anything on.
   */
  readonly canEnableMonetization = computed(() => this.paymentConnected());

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
  // Set by ensureCreator(); lets completeOnboarding() skip a redundant lookup.
  private readonly _savedCreatorId = signal<string | null>(null);

  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private stripePollingTimer: ReturnType<typeof setInterval> | null = null;

  /** True while we have a Stripe tab open and are polling for completion */
  readonly stripeTabOpen = signal<boolean>(false);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
  ) {}

  ngOnDestroy(): void {
    this.stopStripePolling();
    if (this.slugCheckTimer != null) {
      clearTimeout(this.slugCheckTimer);
      this.slugCheckTimer = null;
    }
  }

  // ── Initialization ─────────────────────────────────────────────────

  async initialize(returnedFromStripe = false): Promise<void> {
    this.selectedCountryIndex.set(detectCountryIndex());

    if (returnedFromStripe) {
      await this.handleStripeReturn();
      return;
    }

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

  /**
   * Handles the return trip from Stripe Connect onboarding.
   *
   * Called when the URL contains ?stripe_connected=true (set as the return_url
   * in create-connect-account). Skips the normal dashboard-redirect guard,
   * restores form signals from the creator row that was saved before the
   * Stripe redirect, marks the payment step complete, and advances to step 3.
   */
  private async handleStripeReturn(): Promise<void> {
    try {
      const user = await this.requireUser();
      const { data: creator } = await this.creatorService.getCreatorByUserId(user.id);

      if (creator) {
        // Cache the id so completeOnboarding() UPDATE path is used (not INSERT).
        this._savedCreatorId.set(creator.id);

        // Restore form signals so profileFormFields() has correct values when
        // completeOnboarding() calls updateCreatorProfile() at step 4.
        this.displayName.set(creator.display_name ?? '');
        this.bio.set(creator.bio ?? '');
        this.slug.set(creator.slug ?? '');
        this.slugStatus.set('available'); // slug was valid when first saved
        this.profileImageUrl.set(creator.profile_image_url ?? '');
        this.instagramUsername.set(creator.instagram_username ?? '');

        // Best-effort phone parse: match the longest country code prefix so
        // the country selector and local number field are populated correctly.
        const storedPhone = creator.phone_number ?? '';
        const match = [...COUNTRY_CODES]
          .map((cc, i) => ({ cc, i }))
          .sort((a, b) => b.cc.code.length - a.cc.code.length)
          .find(({ cc }) => storedPhone.startsWith(cc.code + ' '));

        if (match) {
          this.selectedCountryIndex.set(match.i);
          this.phoneNumber.set(storedPhone.slice(match.cc.code.length + 1));
        } else {
          this.phoneNumber.set(storedPhone);
        }
      }

      // Mark payment connected and advance past the Stripe step.
      this.paymentConnected.set(true);
      this.currentStep.set(3);
    } catch {
      // If restoration fails, still advance — the Stripe connection succeeded
      // and the user shouldn't be stuck. completeOnboarding() will handle any
      // missing data gracefully via the ensureCreator() fallback.
      this.paymentConnected.set(true);
      this.currentStep.set(3);
    }
  }

  private async checkExistingProfile(): Promise<void> {    const user = this.authService.getCurrentUser();
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
      // If leaving step 3 without payment connected, force all monetization off.
      // The user can view the step but cannot activate paid channels.
      if (this.currentStep() === 3 && !this.paymentConnected()) {
        this.messagesEnabled.set(false);
        this.callsEnabled.set(false);
        this.followBackEnabled.set(false);
        this.tipsEnabled.set(false);
      }
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
      instagramUsername: this.instagramUsername() || undefined,
    };
  }

  /**
   * Ensures a creator row exists in the DB and returns its id.
   *
   * Precedence:
   *   1. In-memory cache (_savedCreatorId) — zero DB calls.
   *   2. Existing DB row — handles page refreshes mid-flow.
   *   3. INSERT a new row from the current form state.
   */
  private async ensureCreator(userId: string, email: string): Promise<string> {
    const cached = this._savedCreatorId();
    if (cached) return cached;

    const { data: existing } = await this.creatorService.getCreatorByUserId(userId);
    if (existing) {
      this._savedCreatorId.set(existing.id);
      return existing.id;
    }

    const { data: created, error } = await this.creatorService.createCreator({
      userId,
      email,
      ...this.profileFormFields(),
    });
    if (error || !created) {
      throw new Error('Failed to save your profile. Please check your details and try again.');
    }
    this._savedCreatorId.set(created.id);
    return created.id;
  }

  // ── Actions ────────────────────────────────────────────────────────

  /**
   * Step 2: Persist the creator row (if not yet done), then open Stripe
   * onboarding in a new tab. Polls the Stripe account status every 3 seconds
   * until the user completes setup, then auto-advances to step 3.
   *
   * Opening in a new tab preserves all in-memory form signals — no need to
   * restore from the DB when the user comes back.
   */
  async connectPayment(): Promise<void> {
    this.paymentConnecting.set(true);
    this.error.set(null);

    // IMPORTANT: Open a blank window SYNCHRONOUSLY before any await.
    // Browsers only allow window.open() within the synchronous call stack of a user
    // gesture. After any await the gesture context is lost and popup blockers fire —
    // even with strict settings disabled. We reserve the window handle here, then
    // point it to the real Stripe URL once the async call resolves.
    const stripeWindow = window.open('', '_blank');

    try {
      const user = await this.requireUser();
      const creatorId = await this.ensureCreator(user.id, user.email ?? '');

      const { data, error } = await this.creatorService.createStripeConnectAccount(
        creatorId,
        user.email ?? '',
        this.displayName(),
      );
      if (error || !data?.url || !data?.account_id) {
        throw error instanceof Error ? error : new Error('Failed to create payment account');
      }

      if (stripeWindow !== null) {
        // Navigate the pre-opened window to the Stripe URL — never blocked
        stripeWindow.location.href = data.url;
        this.stripeTabOpen.set(true);
        this.paymentConnecting.set(false);
        // Poll every 3 s until the Stripe account has charges_enabled
        this.startStripePolling(data.account_id);
      } else {
        // Popup was blocked at the OS/extension level — redirect in the current tab.
        // handleStripeReturn() will restore state when the user comes back via ?stripe_connected=true
        window.location.href = data.url;
      }
    } catch (err) {
      // Close the blank tab if the API call failed — avoids a dangling empty tab
      stripeWindow?.close();
      this.error.set(errorMessage(err, ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR));
      this.paymentConnecting.set(false);
    }
  }

  /**
   * Polls `verify-connect-account` every 3 seconds.
   * Stops when the account is fully connected (charges_enabled) or after 10 min timeout.
   */
  private startStripePolling(accountId: string): void {
    this.stopStripePolling();

    const POLL_INTERVAL_MS = 3_000;
    const MAX_POLL_DURATION_MS = 5 * 60 * 1_000; // 5 minutes
    const startTime = Date.now();

    this.stripePollingTimer = setInterval(async () => {
      // Timeout guard — stop polling after 10 min
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        this.stopStripePolling();
        return;
      }

      try {
        const { data } = await this.creatorService.verifyStripeAccount(accountId);
        if (data?.charges_enabled) {
          this.stopStripePolling();
          this.paymentConnected.set(true);
          this.currentStep.set(3);
        }
      } catch {
        // Swallow individual poll failures — network blip shouldn't kill the flow
      }
    }, POLL_INTERVAL_MS);
  }

  private stopStripePolling(): void {
    if (this.stripePollingTimer != null) {
      clearInterval(this.stripePollingTimer);
      this.stripePollingTimer = null;
    }
    this.stripeTabOpen.set(false);
  }

  /**
   * Step 4: Finalise onboarding.
   *
   * If _savedCreatorId is set (creator was persisted at Step 2), sync any profile
   * edits made after that point. Otherwise Stripe was skipped, so INSERT now.
   * Settings are always created fresh at this final step.
   */
  async completeOnboarding(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const user = await this.requireUser();
      const savedId = this._savedCreatorId();

      if (savedId) {
        // Sync any Step 1 edits made after Stripe connect.
        const { error } = await this.creatorService.updateCreatorProfile({
          creatorId: savedId,
          ...this.profileFormFields(),
        });
        if (error) throw error;
      } else {
        // Stripe was skipped — create the row now.
        const { data: creator, error } = await this.creatorService.createCreator({
          userId: user.id,
          email: user.email ?? '',
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
      const { error: settingsError } = await this.creatorService.createCreatorSettings({
        creatorId,
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
