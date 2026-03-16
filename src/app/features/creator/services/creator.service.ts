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
  SupabaseResponse,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus,
} from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

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
    instagramUsername?: string;
  }): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        instagram_username: data.instagramUsername ?? null,
      })
      .select()
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { data: creator, error };
  }

  public async updateCreatorProfile(data: {
    creatorId: string;
    displayName: string;
    slug: string;
    bio: string | null;
    phoneNumber: string;
    profileImageUrl?: string;
    bannerImageUrl?: string;
    instagramUsername?: string;
  }): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .update({
        display_name: data.displayName,
        slug: data.slug,
        bio: data.bio,
        phone_number: data.phoneNumber,
        profile_image_url: data.profileImageUrl,
        banner_image_url: data.bannerImageUrl,
        instagram_username: data.instagramUsername,
      })
      .eq('id', data.creatorId)
      .select()
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { data: creator, error };
  }

  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.supabaseService.client
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { data, error };
  }

  public async createCreatorSettings(data: {
    creatorId: string;
    messagePrice: number;
    messagesEnabled: boolean;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    followBackPrice?: number;
    followBackEnabled: boolean;
    tipsEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .insert({
        creator_id: data.creatorId,
        message_price: data.messagePrice,
        messages_enabled: data.messagesEnabled,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        follow_back_price: data.followBackPrice,
        follow_back_enabled: data.followBackEnabled,
        tips_enabled: data.tipsEnabled,
        response_expectation: data.responseExpectation,
      })
      .select()
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { data: settings, error };
  }

  public async updateCreatorSettings(data: {
    settingsId: string;
    messagePrice?: number;
    messagesEnabled: boolean;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    followBackPrice?: number;
    followBackEnabled: boolean;
    tipsEnabled: boolean;
    shopEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .update({
        message_price: data.messagePrice,
        messages_enabled: data.messagesEnabled,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        follow_back_price: data.followBackPrice,
        follow_back_enabled: data.followBackEnabled,
        tips_enabled: data.tipsEnabled,
        shop_enabled: data.shopEnabled,
        response_expectation: data.responseExpectation,
      })
      .eq('id', data.settingsId)
      .select()
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { data: settings, error };
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
}
