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
  readonly instagramUsername = signal('');

  private originalSlug = '';
  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Monetization fields ────────────────────────────────────────────
  readonly messagePrice = signal(1000);
  readonly messagesEnabled = signal(false);
  readonly callPrice = signal(5000);
  readonly callDuration = signal(30);
  readonly callsEnabled = signal(false);
  readonly followBackPrice = signal(2000);
  readonly followBackEnabled = signal(false);
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
    instagramUsername: '',
  });
  readonly originalMonetization = signal({
    messagePrice: 1000,
    messagesEnabled: false,
    callPrice: 5000,
    callDuration: 30,
    callsEnabled: false,
    followBackPrice: 2000,
    followBackEnabled: false,
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
      this.phoneNumber() !== o.phoneNumber ||
      this.instagramUsername() !== o.instagramUsername
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
      this.followBackPrice() !== o.followBackPrice ||
      this.followBackEnabled() !== o.followBackEnabled ||
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
      instagramUsername: this.instagramUsername() || undefined,
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
        instagramUsername: this.instagramUsername(),
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
      followBackPrice: this.followBackEnabled() ? this.followBackPrice() : undefined,
      followBackEnabled: this.followBackEnabled(),
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
        followBackPrice: this.followBackPrice(),
        followBackEnabled: this.followBackEnabled(),
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        const body = (data as any)?.error ?? (error as any)?.message ?? '';
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
      this.instagramUsername.set(creatorData.instagram_username || '');
      this.originalProfile.set({
        displayName: creatorData.display_name,
        slug: creatorData.slug,
        bio: creatorData.bio || '',
        profileImageUrl: creatorData.profile_image_url || '',
        bannerImageUrl: creatorData.banner_image_url || '',
        phoneNumber: creatorData.phone_number || '',
        instagramUsername: creatorData.instagram_username || '',
      });

      const settingsData = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData.data) {
        this.settings.set(settingsData.data);
        this.messagePrice.set(settingsData.data.message_price);
        this.messagesEnabled.set(settingsData.data.messages_enabled ?? false);
        this.callPrice.set(settingsData.data.call_price ?? 5000);
        this.callDuration.set(settingsData.data.call_duration ?? 30);
        this.callsEnabled.set(settingsData.data.calls_enabled);
        this.followBackPrice.set(settingsData.data.follow_back_price ?? 2000);
        this.followBackEnabled.set(settingsData.data.follow_back_enabled);
        this.tipsEnabled.set(settingsData.data.tips_enabled ?? false);
        this.shopEnabled.set(settingsData.data.shop_enabled ?? false);
        this.responseExpectation.set(settingsData.data.response_expectation || '');
        this.originalMonetization.set({
          messagePrice: settingsData.data.message_price,
          messagesEnabled: settingsData.data.messages_enabled ?? false,
          callPrice: settingsData.data.call_price ?? 5000,
          callDuration: settingsData.data.call_duration ?? 30,
          callsEnabled: settingsData.data.calls_enabled,
          followBackPrice: settingsData.data.follow_back_price ?? 2000,
          followBackEnabled: settingsData.data.follow_back_enabled,
          tipsEnabled: settingsData.data.tips_enabled ?? false,
          shopEnabled: settingsData.data.shop_enabled ?? false,
          responseExpectation: settingsData.data.response_expectation || '',
        });
      }

      // Load payment account
      await this.loadPaymentAccount(creatorData.id);
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
}
