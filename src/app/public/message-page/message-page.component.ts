import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../shared/supabase.service';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';

interface CreatorProfile {
  id: string;
  display_name: string;
  bio: string | null;
  profile_image_url: string | null;
  slug: string;
  creator_settings: {
    has_tiered_pricing: boolean;
    single_price: number | null;
    fan_price: number | null;
    business_price: number | null;
    response_expectation: string | null;
  }[];
}

@Component({
  selector: 'app-message-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './message-page.component.html',
  styleUrls: ['./message-page.component.css']
})
export class MessagePageComponent implements OnInit {
  creator = signal<CreatorProfile | null>(null);
  settings = signal<{ has_tiered_pricing: boolean; single_price: number | null; fan_price: number | null; business_price: number | null; response_expectation: string | null; } | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Form data
  senderName = signal('');
  senderEmail = signal('');
  messageContent = signal('');
  messageType = signal<'fan' | 'business' | 'single'>('single');
  
  submitting = signal(false);
  
  private stripe: Stripe | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Initialize Stripe
    this.stripe = await loadStripe(environment.stripe.publishableKey);

    // Get creator slug from URL
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Invalid URL');
      this.loading.set(false);
      return;
    }

    // Load creator profile
    await this.loadCreator(slug);
  }

  async loadCreator(slug: string) {
    try {
      const { data, error } = await this.supabaseService.getCreatorBySlug(slug);
      
      if (error || !data) {
        this.error.set('Creator not found');
        return;
      }

      this.creator.set(data as CreatorProfile);
      
      // Set settings
      const settingsData = data.creator_settings?.[0];
      if (settingsData) {
        this.settings.set(settingsData);
        
        // Set default message type based on pricing
        if (settingsData.has_tiered_pricing) {
          this.messageType.set('fan');
        } else {
          this.messageType.set('single');
        }
      }
    } catch (err) {
      this.error.set('Failed to load creator');
    } finally {
      this.loading.set(false);
    }
  }

  get selectedPrice(): number {
    const settingsData = this.settings();
    if (!settingsData) return 0;

    if (settingsData.has_tiered_pricing) {
      return this.messageType() === 'business'
        ? (settingsData.business_price || 0) / 100
        : (settingsData.fan_price || 0) / 100;
    }

    return (settingsData.single_price || 0) / 100;
  }

  async submitMessage() {
    if (!this.validateForm()) {
      return;
    }

    if (!this.stripe) {
      alert('Payment system not initialized');
      return;
    }

    this.submitting.set(true);

    try {
      const priceInCents = this.selectedPrice * 100;

      // Create checkout session via Edge Function
      const { data, error } = await this.supabaseService.createCheckoutSession({
        creator_slug: this.creator()!.slug,
        message_content: this.messageContent(),
        sender_name: this.senderName(),
        sender_email: this.senderEmail(),
        message_type: this.messageType(),
        price: priceInCents,
      });

      if (error || !data?.sessionId) {
        throw new Error(error?.message || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      alert('Failed to process payment: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      this.submitting.set(false);
    }
  }

  validateForm(): boolean {
    if (!this.senderName().trim()) {
      alert('Please enter your name');
      return false;
    }

    if (!this.senderEmail().trim() || !this.isValidEmail(this.senderEmail())) {
      alert('Please enter a valid email');
      return false;
    }

    if (!this.messageContent().trim()) {
      alert('Please enter your message');
      return false;
    }

    if (this.messageContent().length > 1000) {
      alert('Message is too long (max 1000 characters)');
      return false;
    }

    return true;
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  get characterCount() {
    return this.messageContent().length;
  }
}
