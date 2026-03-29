/**
 * Creator Service
 * Handles creator profile, settings, and Stripe Connect business logic.
 *
 * For messages     → MessageService
 * For bookings     → BookingService
 * For availability → AvailabilityService
 */

import { Injectable } from '@angular/core';
import {
  Creator,
  CreatorSettings,
  PaystackSubaccount,
  PaystackBank,
  SupabaseResponse,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus,
} from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class CreatorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    return this.supabaseService.getCreatorByUserId(userId);
  }

  public async getCurrentCreator(): Promise<Creator | null> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) return null;
    const { data } = await this.supabaseService.getCreatorByUserId(user.id);
    return data;
  }

  /**
   * Create a new creator profile.
   * NOTE: A database trigger automatically creates default creator_settings.
   * If overriding settings after this call, ensure they complete successfully.
   */
  public async createCreator(data: {
    userId: string;
    email: string;
    displayName: string;
    bio: string;
    slug: string;
    phoneNumber: string;
    profileImageUrl?: string;
    /**
     * ISO 3166-1 alpha-2 country code detected from the phone code picker.
     * Determines payment_provider: NG/ZA → 'paystack'; all others → 'stripe'.
     */
    country: string;
    // ── Expertise (optional — collected in onboarding step 2) ──────────────
    category?: string;
    subcategory?: string;
    professionTitle?: string;
    yearsOfExperience?: number | null;
    linkedinUrl?: string;
  }): Promise<SupabaseResponse<Creator>> {
    // Determine the payment provider based on country.
    // NG and ZA creators use Paystack; all others use Stripe.
    const PAYSTACK_COUNTRIES = new Set(['NG', 'ZA']);
    const paymentProvider = PAYSTACK_COUNTRIES.has(data.country.toUpperCase()) ? 'paystack' : 'stripe';

    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .insert({
        user_id: data.userId,
        email: data.email,
        display_name: data.displayName,
        bio: data.bio,
        slug: data.slug,
        phone_number: data.phoneNumber,
        profile_image_url: data.profileImageUrl ?? null,
        country: data.country.toUpperCase(),
        payment_provider: paymentProvider,
        category: data.category ?? null,
        subcategory: data.subcategory ?? null,
        profession_title: data.professionTitle ?? null,
        years_of_experience: data.yearsOfExperience ?? null,
        linkedin_url: data.linkedinUrl ?? null,
      })
      .select()
      .single();
    return { data: creator as Creator | null, error };
  }

  public async updateCreatorProfile(data: {
    creatorId: string;
    displayName: string;
    slug: string;
    bio: string | null;
    phoneNumber: string;
    profileImageUrl?: string;
    bannerImageUrl?: string;
    // ── Expertise ──────────────────────────────────────────────────────────
    category?: string | null;
    subcategory?: string | null;
    professionTitle?: string | null;
    yearsOfExperience?: number | null;
    linkedinUrl?: string | null;
  }): Promise<SupabaseResponse<Creator>> {
    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .update({
        display_name: data.displayName,
        slug: data.slug,
        bio: data.bio,
        phone_number: data.phoneNumber,
        profile_image_url: data.profileImageUrl,
        banner_image_url: data.bannerImageUrl,
        category: data.category,
        subcategory: data.subcategory,
        profession_title: data.professionTitle,
        years_of_experience: data.yearsOfExperience,
        linkedin_url: data.linkedinUrl,
      })
      .eq('id', data.creatorId)
      .select()
      .single();
    return { data: creator as Creator | null, error };
  }

  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.supabaseService.client
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    return { data: data as CreatorSettings | null, error };
  }

  public async createCreatorSettings(data: {
    creatorId: string;
    messagePrice: number;
    messagesEnabled: boolean;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    tipsEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .insert({
        creator_id: data.creatorId,
        message_price: data.messagePrice,
        messages_enabled: data.messagesEnabled,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        tips_enabled: data.tipsEnabled,
        response_expectation: data.responseExpectation,
      })
      .select()
      .single();
    return { data: settings as CreatorSettings | null, error };
  }

  public async updateCreatorSettings(data: {
    settingsId: string;
    messagePrice?: number;
    messagesEnabled: boolean;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    tipsEnabled: boolean;
    shopEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .update({
        message_price: data.messagePrice,
        messages_enabled: data.messagesEnabled,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        tips_enabled: data.tipsEnabled,
        shop_enabled: data.shopEnabled,
        response_expectation: data.responseExpectation,
      })
      .eq('id', data.settingsId)
      .select()
      .single();
    return { data: settings as CreatorSettings | null, error };
  }

  public async checkSlugAvailability(
    slug: string,
    excludeCreatorId?: string,
  ): Promise<{ available: boolean; error?: string }> {
    try {
      let query = this.supabaseService.client
        .from('creators')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug);
      if (excludeCreatorId) {
        query = query.neq('id', excludeCreatorId);
      }
      const { count, error } = await query;
      if (error) {
        return { available: false, error: error.message };
      }
      return { available: (count ?? 0) === 0 };
    } catch {
      return { available: false, error: 'Failed to check slug availability' };
    }
  }

  public async getStripeAccount(creatorId: string) {
    return this.supabaseService.getStripeAccount(creatorId);
  }

  public async createStripeConnectAccount(
    creatorId: string,
    email: string,
    displayName: string,
  ): Promise<EdgeFunctionResponse<StripeConnectResponse>> {
    return this.supabaseService.createConnectAccount(creatorId, email, displayName);
  }

  public async verifyStripeAccount(
    accountId: string,
  ): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    return this.supabaseService.verifyConnectAccount(accountId);
  }

  // ── Paystack ─────────────────────────────────────────────────────────────────

  /**
   * Fetch the creator's Paystack subaccount, if one has been set up.
   * Returns null data if no subaccount exists yet.
   */
  public async getPaystackSubaccount(
    creatorId: string,
  ): Promise<SupabaseResponse<PaystackSubaccount | null>> {
    const { data, error } = await this.supabaseService.client
      .from('paystack_subaccounts')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    return { data: data as PaystackSubaccount | null, error };
  }

  /**
   * Fetch the list of banks for the given country from the Paystack API (via Edge Function).
   * Returns bank name + code pairs used to populate the bank picker in Settings.
   */
  public async getPaystackBanks(
    country: string,
  ): Promise<EdgeFunctionResponse<PaystackBank[]>> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'get-paystack-banks',
      { body: { country } },
    );
    return { data: data as PaystackBank[] | undefined, error };
  }

  /**
   * Resolve a bank account number to the registered account name.
   * Called before the creator confirms their bank setup in Settings.
   */
  public async resolvePaystackAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<EdgeFunctionResponse<{ account_name: string }>> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'get-paystack-banks',
      { body: { resolve: true, account_number: accountNumber, bank_code: bankCode } },
    );
    return { data: data as { account_name: string } | undefined, error };
  }

  /**
   * Register the creator's bank account as a Paystack subaccount.
   * Called from Settings → Payments when the creator submits their bank details.
   */
  public async createPaystackSubaccount(params: {
    bankCode: string;
    accountNumber: string;
    businessName: string;
    country: string;
  }): Promise<EdgeFunctionResponse<PaystackSubaccount>> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'create-paystack-subaccount',
      {
        body: {
          bank_code: params.bankCode,
          account_number: params.accountNumber,
          business_name: params.businessName,
          country: params.country,
        },
      },
    );
    return { data: data as PaystackSubaccount | undefined, error };
  }

  /**
   * Re-fetch the creator's Paystack subaccount verification status from Paystack's
   * API and update the DB record. Called when the creator clicks "Refresh Status"
   * in Settings → Payments. Paystack verifies bank accounts asynchronously after
   * subaccount creation, so the creator may need to refresh once Paystack is done.
   */
  public async syncPaystackStatus(): Promise<EdgeFunctionResponse<PaystackSubaccount>> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'create-paystack-subaccount',
      { body: { sync_status: true } },
    );
    return { data: data as PaystackSubaccount | undefined, error };
  }
}
