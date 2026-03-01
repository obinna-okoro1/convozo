/**
 * Settings Component
 * Allows creators to manage their profile and pricing settings
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Creator, CreatorSettings, StripeAccount } from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { FormValidators } from '../../../../core/validators/form-validators';
import { CreatorService } from '../../services/creator.service';
import { ImageUploadComponent, ImageChangeEvent } from '../../../../shared/components/ui/image-upload/image-upload.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, ImageUploadComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTab = signal<'profile' | 'pricing' | 'payments'>('profile');
  protected readonly stripeConnecting = signal(false);

  // Profile fields
  protected readonly displayName = signal('');
  protected readonly slug = signal('');
  protected readonly slugStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  private originalSlug = '';
  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly bio = signal('');
  protected readonly profileImageUrl = signal('');
  protected readonly phoneNumber = signal('');
  protected readonly instagramUsername = signal(''); // Manual Instagram handle input

  // Computed: can save profile
  protected readonly canSaveProfile = computed(
    () =>
      !!this.displayName() &&
      !!this.slug() &&
      !!this.phoneNumber() &&
      this.slugStatus() !== 'checking' &&
      this.slugStatus() !== 'taken' &&
      this.slugStatus() !== 'invalid',
  );

  // Pricing fields
  protected readonly messagePrice = signal(1000); // in cents
  protected readonly callPrice = signal(5000); // in cents
  protected readonly callDuration = signal(30); // in minutes
  protected readonly callsEnabled = signal(false);
  protected readonly responseExpectation = signal('');

  protected readonly creator = signal<Creator | null>(null);
  protected readonly settings = signal<CreatorSettings | null>(null);
  protected readonly stripeAccount = signal<StripeAccount | null>(null);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  public ngOnInit(): void {
    void this.loadCreatorData();
  }

  /**
   * Extract string value from an input/textarea/select event
   */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /**
   * Extract numeric value from an input event
   */
  protected inputNumber(event: Event): number {
    return +(event.target as HTMLInputElement).value;
  }

  /**
   * Extract checked state from a checkbox event
   */
  protected inputChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected onImageChanged(event: ImageChangeEvent): void {
    this.profileImageUrl.set(event.url);
  }

  protected onImageUploadError(message: string): void {
    this.error.set(message);
  }

  /**
   * Update slug from direct user input (sanitize + check availability)
   */
  protected updateSlug(value: string): void {
    const sanitized = FormValidators.sanitizeSlug(value);
    this.slug.set(sanitized);
    this.debouncedSlugCheck(sanitized);
  }

  private debouncedSlugCheck(slug: string): void {
    if (this.slugCheckTimer) {
      clearTimeout(this.slugCheckTimer);
    }

    // If unchanged from the saved value, mark idle (it's their own slug)
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

  protected setTab(tab: 'profile' | 'pricing' | 'payments'): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.success.set(false);
  }

  protected async saveProfile(): Promise<void> {
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
      instagramUsername: this.instagramUsername() || undefined,
    });

    this.saving.set(false);

    if (updated.data != null && updated.error == null) {
      this.originalSlug = this.slug(); // update reference after successful save
      this.slugStatus.set('idle');
      this.success.set(true);
      setTimeout(() => {
        this.success.set(false);
      }, 3000);
    } else {
      // Check for unique violation
      const errMsg = updated.error?.message ?? '';
      if (errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('slug')) {
        this.slugStatus.set('taken');
        this.error.set('This slug is already taken — please choose a different one');
      } else {
        this.error.set('Failed to update profile');
      }
    }
  }

  protected async savePricing(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const updated = await this.creatorService.updateCreatorSettings({
      settingsId: this.settings()!.id,
      messagePrice: this.messagePrice(),
      callPrice: this.callsEnabled() ? this.callPrice() : undefined,
      callDuration: this.callsEnabled() ? this.callDuration() : undefined,
      callsEnabled: this.callsEnabled(),
      responseExpectation: this.responseExpectation() || '',
    });

    this.saving.set(false);

    if (updated.data != null && updated.error == null) {
      this.success.set(true);
      setTimeout(() => {
        this.success.set(false);
      }, 3000);
    } else {
      this.error.set('Failed to update pricing');
    }
  }

  protected goToDashboard(): void {
    void this.router.navigate(['/creator/dashboard']);
  }

  protected async connectStripe(): Promise<void> {
    this.stripeConnecting.set(true);
    this.error.set(null);

    const creator = this.creator();
    if (!creator) {
      this.error.set('Creator profile not found');
      this.stripeConnecting.set(false);
      return;
    }

    try {
      const user = this.supabaseService.getCurrentUser();
      const { data, error } = await this.creatorService.createStripeConnectAccount(
        creator.id,
        user?.email || '',
        creator.display_name,
      );

      if (error != null || !data?.url) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to create Stripe Connect account',
        );
      }

      // Redirect to Stripe OAuth
      window.location.href = data.url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to connect Stripe account');
      this.stripeConnecting.set(false);
    }
  }

  protected async reconnectStripe(): Promise<void> {
    await this.connectStripe();
  }

  private async loadCreatorData(): Promise<void> {
    this.loading.set(true);

    const creatorData = await this.creatorService.getCurrentCreator();
    if (creatorData) {
      this.creator.set(creatorData);
      this.displayName.set(creatorData.display_name);
      this.slug.set(creatorData.slug);
      this.originalSlug = creatorData.slug;
      this.bio.set(creatorData.bio || '');
      this.profileImageUrl.set(creatorData.profile_image_url || '');
      this.phoneNumber.set(creatorData.phone_number || '');
      this.instagramUsername.set(creatorData.instagram_username || '');

      const settingsData = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData.data) {
        this.settings.set(settingsData.data);
        this.messagePrice.set(settingsData.data.message_price);
        this.callPrice.set(settingsData.data.call_price ?? 5000);
        this.callDuration.set(settingsData.data.call_duration ?? 30);
        this.callsEnabled.set(settingsData.data.calls_enabled);
        this.responseExpectation.set(settingsData.data.response_expectation || '');
      }

      // Load Stripe account
      await this.loadStripeAccount(creatorData.id);
    }

    this.loading.set(false);
  }

  private async loadStripeAccount(creatorId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data } = await this.supabaseService.client
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (data != null) {
      this.stripeAccount.set(data as StripeAccount);
    }
  }
}
