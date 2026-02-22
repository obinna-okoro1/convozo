/**
 * Settings Component
 * Allows creators to manage their profile and pricing settings
 */

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CreatorService } from '../../services/creator.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import type { Creator, CreatorSettings, StripeAccount } from '../../../../core/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  loading = signal(false);
  saving = signal(false);
  uploading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);
  activeTab = signal<'profile' | 'pricing' | 'payments'>('profile');
  stripeConnecting = signal(false);

  // Profile fields
  displayName = signal('');
  slug = signal('');
  bio = signal('');
  profileImageUrl = signal('');
  profileImagePreview = signal<string | null>(null);
  instagramUsername = signal(''); // Manual Instagram handle input

  // Pricing fields
  messagePrice = signal(1000); // in cents
  callPrice = signal(5000); // in cents
  callDuration = signal(30); // in minutes
  callsEnabled = signal(false);
  responseExpectation = signal('');

  creator = signal<Creator | null>(null);
  settings = signal<CreatorSettings | null>(null);
  stripeAccount = signal<StripeAccount | null>(null);

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

  constructor(
    private readonly creatorService: CreatorService,
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCreatorData();
  }

  async loadCreatorData(): Promise<void> {
    this.loading.set(true);

    const creatorData = await this.creatorService.getCurrentCreator();
    if (creatorData) {
      this.creator.set(creatorData);
      this.displayName.set(creatorData.display_name);
      this.slug.set(creatorData.slug);
      this.bio.set(creatorData.bio || '');
      this.profileImageUrl.set(creatorData.profile_image_url || '');
      this.instagramUsername.set(creatorData.instagram_username || '');
      if (creatorData.profile_image_url) {
        this.profileImagePreview.set(creatorData.profile_image_url);
      }

      const settingsData = await this.creatorService.getCreatorSettings(creatorData.id);
      if (settingsData.data) {
        this.settings.set(settingsData.data);
        this.messagePrice.set(settingsData.data.message_price);
        this.callPrice.set(settingsData.data.call_price || 5000);
        this.callDuration.set(settingsData.data.call_duration || 30);
        this.callsEnabled.set(settingsData.data.calls_enabled);
        this.responseExpectation.set(settingsData.data.response_expectation || '');
      }

      // Load Stripe account
      await this.loadStripeAccount(creatorData.id);
    }

    this.loading.set(false);
  }

  async loadStripeAccount(creatorId: string): Promise<void> {
    const { data } = await this.supabaseService.client
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    
    if (data) {
      this.stripeAccount.set(data);
    }
  }

  async handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error.set('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      this.error.set('Image must be less than 2MB');
      return;
    }

    this.uploading.set(true);
    this.error.set(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profileImagePreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const userId = this.supabaseService.getCurrentUser()?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error } = await this.supabaseService.uploadFile(
        'public',
        filePath,
        file
      );

      if (error) throw error;

      if (data?.publicUrl) {
        this.profileImageUrl.set(data.publicUrl);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to upload image');
      this.profileImagePreview.set(null);
    } finally {
      this.uploading.set(false);
    }
  }

  removeProfileImage(): void {
    this.profileImageUrl.set('');
    this.profileImagePreview.set(null);
  }

  setTab(tab: 'profile' | 'pricing' | 'payments'): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.success.set(false);
  }

  async saveProfile(): Promise<void> {
    if (!this.displayName() || !this.slug()) {
      this.error.set('Display name and slug are required');
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
      profileImageUrl: this.profileImageUrl() || undefined,
      instagramUsername: this.instagramUsername() || undefined
    });

    this.saving.set(false);

    if (updated) {
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } else {
      this.error.set('Failed to update profile');
    }
  }

  async savePricing(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const updated = await this.creatorService.updateCreatorSettings({
      settingsId: this.settings()!.id,
      messagePrice: this.messagePrice(),
      callPrice: this.callsEnabled() ? this.callPrice() : undefined,
      callDuration: this.callsEnabled() ? this.callDuration() : undefined,
      callsEnabled: this.callsEnabled(),
      responseExpectation: this.responseExpectation() || ""
    });

    this.saving.set(false);

    if (updated) {
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } else {
      this.error.set('Failed to update pricing');
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/creator/dashboard']);
  }

  async connectStripe(): Promise<void> {
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
        creator.display_name
      );

      if (error || !data?.url) {
        throw error || new Error('Failed to create Stripe Connect account');
      }

      // Redirect to Stripe OAuth
      window.location.href = data.url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to connect Stripe account');
      this.stripeConnecting.set(false);
    }
  }

  async reconnectStripe(): Promise<void> {
    await this.connectStripe();
  }
}

