/**
 * Settings State Service
 * Shared state for the settings shell and child route components.
 * Holds creator data, settings, Stripe account, and form-level state.
 */

import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Creator,
  CreatorSettings,
  StripeAccount,
  PaystackSubaccount,
  PaystackBank,
} from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { FormValidators } from '../../../../core/validators/form-validators';
import { CreatorService } from '../../services/creator.service';
import { errorMessage } from '../../../../shared/utils/error.utils';

@Injectable()
export class SettingsStateService {
  // ── Core data ──────────────────────────────────────────────────────
  readonly creator = signal<Creator | null>(null);
  readonly settings = signal<CreatorSettings | null>(null);
  readonly paymentAccount = signal<StripeAccount | null>(null);
  /** Paystack subaccount for NG/ZA creators. Null until loaded or not set up yet. */
  readonly paystackSubaccount = signal<PaystackSubaccount | null>(null);
  /** Bank list for the Paystack bank picker. */
  readonly paystackBanks = signal<PaystackBank[]>([]);
  /** True while the Paystack bank list is loading. */
  readonly paystackBanksLoading = signal(false);
  /** True while the Paystack subaccount is being created. */
  readonly paystackConnecting = signal(false);

  // ── Shared UI state ────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);
  readonly paymentConnecting = signal(false);

  // ── Profile fields ─────────────────────────────────────────────────
  readonly displayName = signal('');
  readonly slug = signal('');
  readonly slugStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  readonly bio = signal('');
  readonly profileImageUrl = signal('');
  readonly bannerImageUrl = signal('');
  readonly phoneNumber = signal('');

  private originalSlug = '';
  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Monetization fields ────────────────────────────────────────────
  readonly messagePrice = signal(500);
  readonly messagesEnabled = signal(false);
  readonly callPrice = signal(2000);
  readonly callDuration = signal(10);
  readonly callsEnabled = signal(false);
  readonly tipsEnabled = signal(false);
  readonly shopEnabled = signal(false);
  readonly responseExpectation = signal('');

  // ── Dirty-state tracking ───────────────────────────────────────────
  readonly originalProfile = signal({
    displayName: '',
    slug: '',
    bio: '',
    profileImageUrl: '',
    bannerImageUrl: '',
    phoneNumber: '',
  });
  readonly originalMonetization = signal({
    messagePrice: 500,
    messagesEnabled: false,
    callPrice: 2000,
    callDuration: 10,
    callsEnabled: false,
    tipsEnabled: false,
    shopEnabled: false,
    responseExpectation: '',
  });

  // ── Computed ───────────────────────────────────────────────────────
  readonly profileDirty = computed(() => {
    const o = this.originalProfile();
    return (
      this.displayName() !== o.displayName ||
      this.slug() !== o.slug ||
      this.bio() !== o.bio ||
      this.profileImageUrl() !== o.profileImageUrl ||
      this.bannerImageUrl() !== o.bannerImageUrl ||
      this.phoneNumber() !== o.phoneNumber
    );
  });

  readonly canSaveProfile = computed(
    () =>
      this.profileDirty() &&
      !!this.displayName() &&
      !!this.slug() &&
      !!this.phoneNumber() &&
      this.slugStatus() !== 'checking' &&
      this.slugStatus() !== 'taken' &&
      this.slugStatus() !== 'invalid',
  );

  readonly monetizationDirty = computed(() => {
    const o = this.originalMonetization();
    return (
      this.messagePrice() !== o.messagePrice ||
      this.messagesEnabled() !== o.messagesEnabled ||
      this.callPrice() !== o.callPrice ||
      this.callDuration() !== o.callDuration ||
      this.callsEnabled() !== o.callsEnabled ||
      this.tipsEnabled() !== o.tipsEnabled ||
      this.shopEnabled() !== o.shopEnabled ||
      this.responseExpectation() !== o.responseExpectation
    );
  });

  readonly canSaveMonetization = computed(() => this.monetizationDirty());

  /** True only when Stripe account is fully connected and onboarding is complete */
  readonly isStripeConnected = computed(() => {
    const account = this.paymentAccount();
    return !!(account?.onboarding_completed && account?.charges_enabled);
  });

  /** True when this creator uses Paystack (NG/ZA). */
  readonly isPaystackCreator = computed(
    () => this.creator()?.payment_provider === 'paystack',
  );

  /**
   * True when the Paystack subaccount is set up and active.
   * We do NOT require is_verified here — Paystack verifies asynchronously (can take
   * several business days). The subaccount can receive split payments as soon as it
   * is active. is_verified is shown as an informational badge in the UI only.
   */
  readonly isPaystackConnected = computed(
    () => !!(this.paystackSubaccount()?.is_active),
  );

  /**
   * True when payments are ready to accept — regardless of provider.
   * Stripe creators: onboarding completed + charges enabled.
   * Paystack creators: bank account active and verified by Paystack.
   * Used to gate the Monetization and Shop settings views.
   */
  readonly isPaymentReady = computed(
    () => this.isStripeConnected() || this.isPaystackConnected(),
  );

  constructor(
    private readonly creatorService: CreatorService,
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  inputNumber(event: Event): number {
    return +(event.target as HTMLInputElement).value;
  }

  inputChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  clearMessages(): void {
    this.error.set(null);
    this.success.set(false);
  }

  // ── Slug validation ────────────────────────────────────────────────

  updateSlug(value: string): void {
    const sanitized = FormValidators.sanitizeSlug(value);
    this.slug.set(sanitized);
    this.debouncedSlugCheck(sanitized);
  }

  private debouncedSlugCheck(slug: string): void {
    if (this.slugCheckTimer != null) {
      clearTimeout(this.slugCheckTimer);
    }

    if (slug === this.originalSlug) {
      this.slugStatus.set('idle');
      return;
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

    const creatorId = this.creator()?.id;
    const { available } = await this.creatorService.checkSlugAvailability(slug, creatorId);
    if (this.slug() !== slug) return;

    this.slugStatus.set(available ? 'available' : 'taken');
  }

  // ── Profile actions ────────────────────────────────────────────────

  async saveProfile(): Promise<void> {
    if (!this.canSaveProfile()) {
      this.error.set('Please fix the errors above before saving');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const updated = await this.creatorService.updateCreatorProfile({
      creatorId: this.creator()!.id,
      displayName: this.displayName(),
      slug: this.slug(),
      bio: this.bio(),
      phoneNumber: this.phoneNumber(),
      profileImageUrl: this.profileImageUrl() || undefined,
      bannerImageUrl: this.bannerImageUrl() || undefined,
    });

    this.saving.set(false);

    if (updated.data != null && updated.error == null) {
      this.originalSlug = this.slug();
      this.originalProfile.set({
        displayName: this.displayName(),
        slug: this.slug(),
        bio: this.bio(),
        profileImageUrl: this.profileImageUrl(),
        bannerImageUrl: this.bannerImageUrl(),
        phoneNumber: this.phoneNumber(),
      });
      this.slugStatus.set('idle');
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } else {
      const errMsg = updated.error?.message ?? '';
      if (errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('slug')) {
        this.slugStatus.set('taken');
        this.error.set('This slug is already taken — please choose a different one');
      } else {
        this.error.set('Failed to update profile');
      }
    }
  }

  // ── Monetization actions ───────────────────────────────────────────

  async saveMonetization(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const updated = await this.creatorService.updateCreatorSettings({
      settingsId: this.settings()!.id,
      messagePrice: this.messagesEnabled() ? this.messagePrice() : undefined,
      messagesEnabled: this.messagesEnabled(),
      callPrice: this.callsEnabled() ? this.callPrice() : undefined,
      callDuration: this.callsEnabled() ? this.callDuration() : undefined,
      callsEnabled: this.callsEnabled(),
      tipsEnabled: this.tipsEnabled(),
      shopEnabled: this.shopEnabled(),
      responseExpectation: this.responseExpectation() || '',
    });

    this.saving.set(false);

    if (updated.data != null && updated.error == null) {
      this.originalMonetization.set({
        messagePrice: this.messagePrice(),
        messagesEnabled: this.messagesEnabled(),
        callPrice: this.callPrice(),
        callDuration: this.callDuration(),
        callsEnabled: this.callsEnabled(),
        tipsEnabled: this.tipsEnabled(),
        shopEnabled: this.shopEnabled(),
        responseExpectation: this.responseExpectation(),
      });
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } else {
      this.error.set('Failed to update monetization');
    }
  }

  // ── Payment actions ────────────────────────────────────────────────

  async connectPayment(): Promise<void> {
    this.paymentConnecting.set(true);
    this.error.set(null);

    const creator = this.creator();
    if (!creator) {
      this.error.set('Creator profile not found');
      this.paymentConnecting.set(false);
      return;
    }

    try {
      const { data: { user } } = await this.supabaseService.client.auth.getUser();
      if (!user) {
        this.error.set('Your session has expired. Please sign in again.');
        this.paymentConnecting.set(false);
        return;
      }

      const { data, error } = await this.creatorService.createStripeConnectAccount(
        creator.id,
        user.email || '',
        creator.display_name,
      );

      if (error != null || !data?.url) {
        const body = (data as { error?: string } | null)?.error
          ?? (error as { message?: string } | null)?.message
          ?? '';
        const msg = typeof body === 'string' && body.length > 0
          ? body
          : 'Failed to create payment account. Please try again.';
        throw new Error(msg);
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      this.error.set(errorMessage(err, 'Failed to connect payment account'));
      this.paymentConnecting.set(false);
    }
  }

  /**
   * Refresh Stripe account status (called after returning from Stripe onboarding)
   */
  async refreshStripeStatus(): Promise<void> {
    const creator = this.creator();
    const account = this.paymentAccount();
    if (!creator || !account) return;

    try {
      const { data, error } = await this.creatorService.verifyStripeAccount(
        account.stripe_account_id,
      );
      if (error != null) {
        console.error('[refreshStripeStatus] verify failed:', error);
        return;
      }
      if (data != null) {
        // Update the signal with the fresh values returned by the edge function
        // so the UI reflects the real Stripe account status immediately.
        this.paymentAccount.set({
          ...account,
          charges_enabled: data.charges_enabled ?? account.charges_enabled,
          payouts_enabled: data.payouts_enabled ?? account.payouts_enabled,
          details_submitted: data.details_submitted ?? account.details_submitted,
          onboarding_completed: data.onboarding_completed ?? account.onboarding_completed,
        });
      }
    } catch {
      // Silently fail — stale UI is better than a crash
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────

  goToDashboard(): void {
    void this.router.navigate(['/creator/dashboard']);
  }

  // ── Initialization ─────────────────────────────────────────────────

  async loadCreatorData(): Promise<void> {
    this.loading.set(true);

    const creatorData = await this.creatorService.getCurrentCreator();
    if (creatorData) {
      this.creator.set(creatorData);
      this.displayName.set(creatorData.display_name);
      this.slug.set(creatorData.slug);
      this.originalSlug = creatorData.slug;
      this.bio.set(creatorData.bio || '');
      this.profileImageUrl.set(creatorData.profile_image_url || '');
      this.bannerImageUrl.set(creatorData.banner_image_url || '');
      this.phoneNumber.set(creatorData.phone_number || '');
      this.originalProfile.set({
        displayName: creatorData.display_name,
        slug: creatorData.slug,
        bio: creatorData.bio || '',
        profileImageUrl: creatorData.profile_image_url || '',
        bannerImageUrl: creatorData.banner_image_url || '',
        phoneNumber: creatorData.phone_number || '',
      });

      const settingsData = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData.data) {
        this.settings.set(settingsData.data);
        this.messagePrice.set(settingsData.data.message_price);
        this.messagesEnabled.set(settingsData.data.messages_enabled ?? false);
        this.callPrice.set(settingsData.data.call_price ?? 2000);
        this.callDuration.set(settingsData.data.call_duration ?? 10);
        this.callsEnabled.set(settingsData.data.calls_enabled);
        this.tipsEnabled.set(settingsData.data.tips_enabled ?? false);
        this.shopEnabled.set(settingsData.data.shop_enabled ?? false);
        this.responseExpectation.set(settingsData.data.response_expectation || '');
        this.originalMonetization.set({
          messagePrice: settingsData.data.message_price,
          messagesEnabled: settingsData.data.messages_enabled ?? false,
          callPrice: settingsData.data.call_price ?? 2000,
          callDuration: settingsData.data.call_duration ?? 10,
          callsEnabled: settingsData.data.calls_enabled,
          tipsEnabled: settingsData.data.tips_enabled ?? false,
          shopEnabled: settingsData.data.shop_enabled ?? false,
          responseExpectation: settingsData.data.response_expectation || '',
        });
      }

      // Load payment account based on the creator's provider
      if (creatorData.payment_provider === 'paystack') {
        await this.loadPaystackSubaccount(creatorData.id);
      } else {
        await this.loadPaymentAccount(creatorData.id);
      }
    }

    this.loading.set(false);
  }

  private async loadPaymentAccount(creatorId: string): Promise<void> {
    const { data } = await this.supabaseService.getStripeAccount(creatorId);

    if (data != null) {
      this.paymentAccount.set(data);
      // If the account isn't fully onboarded yet, pull the latest status from
      // Stripe immediately so the user always sees current data without needing
      // to manually click refresh.
      if (!data.onboarding_completed || !data.charges_enabled) {
        await this.refreshStripeStatus();
      }
    }
  }

  private async loadPaystackSubaccount(creatorId: string): Promise<void> {
    const { data } = await this.creatorService.getPaystackSubaccount(creatorId);
    if (data) {
      this.paystackSubaccount.set(data);
    }
  }

  /**
   * Resolve a bank account number to the registered account name.
   * Used by the UI to verify the account before submitting bank setup.
   */
  async resolvePaystackAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string | null; error: string | null }> {
    try {
      const { data, error } = await this.creatorService.resolvePaystackAccount(
        accountNumber,
        bankCode,
      );
      if (error) {
        return { accountName: null, error: 'Could not verify account. Please check the details.' };
      }
      const name = (data as unknown as { account_name?: string })?.account_name ?? null;
      return { accountName: name, error: null };
    } catch {
      return { accountName: null, error: 'Account verification failed. Please try again.' };
    }
  }

  /**
   * Load the bank list for the creator's country (NG or ZA).
   * Called lazily when the creator opens the Paystack bank setup form.
   */
  async loadPaystackBanks(): Promise<void> {
    const country = this.creator()?.country;
    if (!country) return;

    this.paystackBanksLoading.set(true);
    try {
      const { data, error } = await this.creatorService.getPaystackBanks(country);
      if (error) {
        this.error.set('Failed to load bank list. Please try again.');
        return;
      }
      // Edge function returns { banks: [...] } — extract the array
      const responseData = data as unknown as { banks?: PaystackBank[] } | PaystackBank[] | null;
      const banks: PaystackBank[] = Array.isArray(responseData)
        ? responseData
        : (responseData as { banks?: PaystackBank[] } | null)?.banks ?? [];
      this.paystackBanks.set(banks);
    } catch {
      this.error.set('Failed to load bank list. Please try again.');
    } finally {
      this.paystackBanksLoading.set(false);
    }
  }

  /**
   * Submit the creator's bank account details to set up a Paystack subaccount.
   * Called from Settings → Payments for NG/ZA creators.
   */
  async connectPaystack(params: {
    bankCode: string;
    accountNumber: string;
    businessName: string;
  }): Promise<void> {
    const country = this.creator()?.country;
    if (!country) return;

    this.paystackConnecting.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.creatorService.createPaystackSubaccount({
        bankCode: params.bankCode,
        accountNumber: params.accountNumber,
        businessName: params.businessName,
        country,
      });

      if (error) {
        this.error.set((error as { message?: string })?.message ?? 'Failed to set up bank account');
        return;
      }

      this.paystackSubaccount.set(data as unknown as PaystackSubaccount);
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } catch {
      this.error.set('An unexpected error occurred. Please try again.');
    } finally {
      this.paystackConnecting.set(false);
    }
  }

  /**
   * Re-fetch is_verified / is_active from Paystack's API and update our DB.
   * Called when the creator clicks "Refresh Status" on the Payments view.
   * Paystack verifies bank accounts asynchronously after subaccount creation,
   * so the creator may need to refresh once Paystack has completed verification.
   */
  async refreshPaystackStatus(): Promise<void> {
    this.error.set(null);
    try {
      const { data, error } = await this.creatorService.syncPaystackStatus();
      if (error) {
        this.error.set((error as { message?: string })?.message ?? 'Failed to refresh status');
        return;
      }
      if (data) {
        this.paystackSubaccount.set(data as unknown as PaystackSubaccount);
      }
    } catch {
      this.error.set('Failed to refresh Paystack status. Please try again.');
    }
  }
}
