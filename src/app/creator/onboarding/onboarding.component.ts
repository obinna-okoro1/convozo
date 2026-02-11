import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../shared/supabase.service';

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  currentStep = signal(1);
  loading = signal(false);
  error = signal<string | null>(null);

  // Form data
  displayName = signal('');
  bio = signal('');
  slug = signal('');
  profileImageUrl = signal('');
  
  pricingType = signal<'single' | 'tiered'>('single');
  singlePrice = signal<number>(50);
  fanPrice = signal<number>(25);
  businessPrice = signal<number>(100);
  responseExpectation = signal('I typically respond within 24-48 hours.');

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Check if already has profile
    const { data: creator } = await this.supabaseService.getCreatorByUserId(user.id);
    if (creator) {
      this.router.navigate(['/creator/dashboard']);
    }
  }

  nextStep() {
    if (this.currentStep() < 3) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  updateDisplayName(value: string) {
    this.displayName.set(value);
    // Auto-generate slug
    if (!this.slug()) {
      this.slug.set(this.generateSlug(value));
    }
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async completeOnboarding() {
    this.loading.set(true);
    this.error.set(null);

    const user = this.supabaseService.getCurrentUser();
    if (!user) {
      this.error.set('Not authenticated');
      this.loading.set(false);
      return;
    }

    try {
      // Create creator profile
      const { data: creator, error: creatorError } = await this.supabaseService.createCreator({
        user_id: user.id,
        email: user.email!,
        display_name: this.displayName(),
        bio: this.bio() || null,
        slug: this.slug(),
        profile_image_url: this.profileImageUrl() || null,
      });

      if (creatorError || !creator) {
        throw creatorError || new Error('Failed to create creator');
      }

      // Create creator settings
      const { error: settingsError } = await this.supabaseService.createCreatorSettings({
        creator_id: creator.id,
        has_tiered_pricing: this.pricingType() === 'tiered',
        single_price: this.pricingType() === 'single' ? this.singlePrice() * 100 : null,
        fan_price: this.pricingType() === 'tiered' ? this.fanPrice() * 100 : null,
        business_price: this.pricingType() === 'tiered' ? this.businessPrice() * 100 : null,
        response_expectation: this.responseExpectation(),
        auto_reply_text: `Thanks for your message! Visit my Convozo page to send a priority message: ${window.location.origin}/${this.slug()}`,
      });

      if (settingsError) {
        throw settingsError;
      }

      // Redirect to Stripe Connect onboarding
      // For MVP, we'll redirect to dashboard with a placeholder
      // In production, you'd create a Stripe Connect account link here
      this.router.navigate(['/creator/dashboard']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      this.loading.set(false);
    }
  }
}
