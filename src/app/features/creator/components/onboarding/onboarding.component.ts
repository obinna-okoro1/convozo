/**
 * Onboarding Component
 * Lean component that delegates business logic to CreatorService
 * Now with OAuth auto-import support
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONSTANTS, ROUTES, ERROR_MESSAGES } from '../../../../core/constants';
import { FormValidators } from '../../../../core/validators/form-validators';
import { AnimatedBackgroundComponent } from '../../../../shared/components/animated-background/animated-background.component';
import {
  ImageUploadComponent,
  ImageChangeEvent,
} from '../../../../shared/components/ui/image-upload/image-upload.component';
import {
  SearchableSelectComponent,
  SelectOption,
} from '../../../../shared/components/ui/searchable-select/searchable-select.component';
import { AuthService } from '../../../auth/services/auth.service';
import { CreatorService } from '../../services/creator.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

/**
 * Country code entry for the phone number dropdown
 */
interface CountryCode {
  code: string; // dial code e.g. "+1"
  country: string; // country name
  flag: string; // emoji flag
  iso: string; // ISO 3166-1 alpha-2
}

/**
 * Common country codes for the phone number dropdown
 */
const COUNTRY_CODES: CountryCode[] = [
  { code: '+1', country: 'United States', flag: '🇺🇸', iso: 'US' },
  { code: '+1', country: 'Canada', flag: '🇨🇦', iso: 'CA' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', iso: 'GB' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', iso: 'AU' },
  { code: '+91', country: 'India', flag: '🇮🇳', iso: 'IN' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', iso: 'DE' },
  { code: '+33', country: 'France', flag: '🇫🇷', iso: 'FR' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', iso: 'JP' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', iso: 'KR' },
  { code: '+86', country: 'China', flag: '🇨🇳', iso: 'CN' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', iso: 'BR' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽', iso: 'MX' },
  { code: '+39', country: 'Italy', flag: '🇮🇹', iso: 'IT' },
  { code: '+34', country: 'Spain', flag: '🇪🇸', iso: 'ES' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', iso: 'NL' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪', iso: 'SE' },
  { code: '+47', country: 'Norway', flag: '🇳🇴', iso: 'NO' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰', iso: 'DK' },
  { code: '+358', country: 'Finland', flag: '🇫🇮', iso: 'FI' },
  { code: '+48', country: 'Poland', flag: '🇵🇱', iso: 'PL' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭', iso: 'CH' },
  { code: '+43', country: 'Austria', flag: '🇦🇹', iso: 'AT' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪', iso: 'BE' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹', iso: 'PT' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪', iso: 'IE' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', iso: 'NZ' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', iso: 'SG' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰', iso: 'HK' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', iso: 'AE' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', iso: 'SA' },
  { code: '+972', country: 'Israel', flag: '🇮🇱', iso: 'IL' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', iso: 'TR' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', iso: 'ZA' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', iso: 'NG' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', iso: 'KE' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', iso: 'EG' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', iso: 'PH' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭', iso: 'TH' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', iso: 'MY' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩', iso: 'ID' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳', iso: 'VN' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', iso: 'PK' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', iso: 'BD' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', iso: 'LK' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', iso: 'CO' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', iso: 'CL' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷', iso: 'AR' },
  { code: '+51', country: 'Peru', flag: '🇵🇪', iso: 'PE' },
  { code: '+7', country: 'Russia', flag: '🇷🇺', iso: 'RU' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦', iso: 'UA' },
  { code: '+40', country: 'Romania', flag: '🇷🇴', iso: 'RO' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿', iso: 'CZ' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺', iso: 'HU' },
  { code: '+30', country: 'Greece', flag: '🇬🇷', iso: 'GR' },
];

/**
 * Map timezone to ISO country code for auto-detection
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Detroit': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Adelaide': 'AU',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Brussels': 'BE',
  'Europe/Lisbon': 'PT',
  'Pacific/Auckland': 'NZ',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Jerusalem': 'IL',
  'Europe/Istanbul': 'TR',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  'Asia/Manila': 'PH',
  'Asia/Bangkok': 'TH',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'America/Bogota': 'CO',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Lima': 'PE',
  'Europe/Moscow': 'RU',
  'Europe/Kiev': 'UA',
  'Europe/Bucharest': 'RO',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Athens': 'GR',
};

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, FormsModule, ImageUploadComponent, AnimatedBackgroundComponent, SearchableSelectComponent],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly slugStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(
    'idle',
  );
  protected readonly slugManuallyEdited = signal<boolean>(false);
  protected readonly profileImageUrl = signal<string>('');
  protected readonly instagramUsername = signal<string>(''); // Manual text input, not OAuth

  // Phone number
  protected readonly countryCodes = COUNTRY_CODES;
  protected readonly selectedCountryIndex = signal<number>(0); // index into COUNTRY_CODES
  protected readonly phoneNumber = signal<string>(''); // local number without country code

  protected readonly countryCodeOptions: SelectOption[] = COUNTRY_CODES.map((cc, i) => ({
    value: String(i),
    label: `${cc.flag} ${cc.country} (${cc.code})`,
  }));

  protected readonly String = String;

  protected readonly fullPhoneNumber = computed(() => {
    const country = COUNTRY_CODES[this.selectedCountryIndex()];
    const local = this.phoneNumber().trim();
    if (!local) {
      return '';
    }
    return `${country.code} ${local}`;
  });

  // Pricing form data
  protected readonly messagePrice = signal<number>(1000); // in cents ($10)
  protected readonly messagesEnabled = signal<boolean>(false);
  protected readonly callPrice = signal<number>(5000); // in cents ($50)
  protected readonly callDuration = signal<number>(30); // minutes
  protected readonly callsEnabled = signal<boolean>(false);
  protected readonly followBackEnabled = signal<boolean>(false);
  protected readonly followBackPrice = signal<number>(2000); // in cents ($20)
  protected readonly tipsEnabled = signal<boolean>(false);
  protected readonly responseExpectation = signal<string>(
    APP_CONSTANTS.DEFAULT_RESPONSE_EXPECTATION,
  );

  // Payment setup (Stripe Connect)
  protected readonly paymentConnecting = signal<boolean>(false);
  protected readonly paymentConnected = signal<boolean>(false);

  // OAuth import indicator
  protected readonly hasOAuthData = signal<boolean>(false);
  protected readonly oauthProvider = signal<string>('');

  // Constants
  protected readonly TOTAL_STEPS = 4;

  // Slug check debounce
  private slugCheckTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed: can proceed past step 1
  protected readonly canProceedStep1 = computed(
    () =>
      !!this.displayName() &&
      !!this.slug() &&
      !!this.phoneNumber() &&
      this.slugStatus() !== 'checking' &&
      this.slugStatus() !== 'taken' &&
      this.slugStatus() !== 'invalid',
  );

  constructor(
    private readonly creatorService: CreatorService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
  ) {}

  public ngOnInit(): void {
    void this.initialize();
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

  /**
   * Navigate steps
   */
  protected nextStep(): void {
    if (this.currentStep() < this.TOTAL_STEPS) {
      this.currentStep.update((s) => s + 1);
    }
  }

  protected prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  /**
   * Update display name and auto-generate slug (unless manually edited)
   */
  protected updateDisplayName(value: string): void {
    this.displayName.set(value);
    if (!this.slugManuallyEdited()) {
      const generated = FormValidators.generateSlug(value);
      this.slug.set(generated);
      this.debouncedSlugCheck(generated);
    }
  }

  /**
   * Update slug from direct user input (sanitize + check)
   */
  protected updateSlug(value: string): void {
    const sanitized = FormValidators.sanitizeSlug(value);
    this.slug.set(sanitized);
    this.slugManuallyEdited.set(true);
    this.debouncedSlugCheck(sanitized);
  }

  /**
   * Debounced slug availability check
   */
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
    // Guard: slug may have changed since the timer was set
    if (this.slug() !== slug) {
      return;
    }

    const { available } = await this.creatorService.checkSlugAvailability(slug);
    // Guard: slug may have changed during the async call
    if (this.slug() !== slug) {
      return;
    }

    this.slugStatus.set(available ? 'available' : 'taken');
  }

  /**
   * Handle image upload/remove from the shared ImageUploadComponent
   */
  protected onImageChanged(event: ImageChangeEvent): void {
    this.profileImageUrl.set(event.url);
  }

  protected onImageUploadError(message: string): void {
    this.error.set(message);
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
          this.currentStep.set(1); // go back to profile step
          throw new Error(
            'This URL slug is already taken — please go back and choose a different one',
          );
        }
        throw creatorError || new Error('Failed to create creator');
      }

      // Create creator settings
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

      // Navigate directly to dashboard (Stripe Connect was already offered at step 2)
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Don't leak raw database errors to the user
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

  /**
   * Connect Stripe payment account (redirect to Stripe Express onboarding)
   */
  protected async connectPayment(): Promise<void> {
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

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
      this.paymentConnecting.set(false);
    }
  }

  /**
   * Skip payment setup for now — advance to the monetization step
   */
  protected skipPaymentSetup(): void {
    this.nextStep();
  }

  private async initialize(): Promise<void> {
    this.detectCountryCode();
    await this.checkExistingProfile();
    this.loadOAuthData();
  }

  /**
   * Auto-detect country code from browser timezone
   */
  private detectCountryCode(): void {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const iso = TIMEZONE_TO_COUNTRY[tz];
      if (iso) {
        const idx = COUNTRY_CODES.findIndex((c) => c.iso === iso);
        if (idx >= 0) {
          this.selectedCountryIndex.set(idx);
        }
      }
    } catch {
      // Fallback: default to US (index 0)
    }
  }

  /**
   * Load OAuth data if available and auto-fill form
   */
  private loadOAuthData(): void {
    const oauthData = this.authService.getStoredOAuthData();
    if (!oauthData) {
      return;
    }

    this.hasOAuthData.set(true);
    this.oauthProvider.set(oauthData.provider || '');

    // Auto-fill form fields
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
}
