/**
 * Creator Service
 * Handles all creator-related business logic
 */

import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  Creator,
  CreatorSettings,
  Message,
  MessageStats,
  SupabaseResponse,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus
} from '../../../core/models';

@Injectable({
  providedIn: 'root'
})
export class CreatorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Load creator by user ID
   */
  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    return this.supabaseService.getCreatorByUserId(userId);
  }

  /**
   * Get current creator for logged-in user
   */
  public async getCurrentCreator(): Promise<Creator | null> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) return null;

    const { data } = await this.supabaseService.getCreatorByUserId(user.id);
    return data;
  }

  /**
   * Update creator profile
   */
  public async updateCreatorProfile(data: {
    creatorId: string;
    displayName: string;
    slug: string;
    bio: string | null;
    profileImageUrl?: string;
    instagramUsername?: string;
  }): Promise<SupabaseResponse<Creator>> {
    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .update({
        display_name: data.displayName,
        slug: data.slug,
        bio: data.bio,
        profile_image_url: data.profileImageUrl,
        instagram_username: data.instagramUsername
      })
      .eq('id', data.creatorId)
      .select()
      .single();

    return { data: creator, error };
  }

  /**
   * Load creator settings
   */
  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.supabaseService.client
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    return { data, error };
  }

  /**
   * Load messages for a creator
   */
  public async getMessages(creatorId: string): Promise<SupabaseResponse<Message[]>> {
    const { data, error } = await this.supabaseService.client
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    return { data, error };
  }

  /**
   * Calculate message statistics
   */
  public calculateStats(messages: Message[]): MessageStats {
    const total = messages.length;
    const unhandled = messages.filter(m => !m.is_handled).length;
    const handled = messages.filter(m => m.is_handled).length;
    const totalRevenue = messages.reduce((sum, m) => sum + (m.amount_paid || 0), 0);

    return { total, unhandled, handled, totalRevenue };
  }

  /**
   * Build public URL for creator
   */
  public buildPublicUrl(slug: string | undefined): string {
    if (!slug) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/${slug}`;
  }

  /**
   * Reply to a message
   */
  public async replyToMessage(
    messageId: string,
    replyContent: string,
    senderEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Send reply via Edge Function which updates DB and sends email
      const { error: functionError } = await this.supabaseService.client.functions.invoke('send-reply-email', {
        body: {
          message_id: messageId,
          reply_content: replyContent
        }
      });

      if (functionError) {
        console.error('Reply function error:', functionError);
        throw functionError;
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reply';
      return { success: false, error: message };
    }
  }

  /**
   * Mark message as handled
   */
  public async markAsHandled(messageId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('messages')
      .update({ is_handled: true })
      .eq('id', messageId);

    return { data: undefined, error };
  }

  /**
   * Create creator profile
   */
  public async createCreator(data: {
    userId: string;
    displayName: string;
    bio: string;
    slug: string;
    profileImageUrl?: string;
    instagramUsername?: string;
  }): Promise<SupabaseResponse<Creator>> {
    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .insert([{
        user_id: data.userId,
        display_name: data.displayName,
        bio: data.bio,
        slug: data.slug,
        profile_image_url: data.profileImageUrl || null,
        instagram_username: data.instagramUsername || null
      }])
      .select()
      .single();

    return { data: creator, error };
  }

  /**
   * Create creator settings
   */
  public async createCreatorSettings(data: {
    creatorId: string;
    messagePrice: number;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .insert([{
        creator_id: data.creatorId,
        message_price: data.messagePrice,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        response_expectation: data.responseExpectation
      }])
      .select()
      .single();

    return { data: settings, error };
  }

  /**
   * Update creator settings
   */
  public async updateCreatorSettings(data: {
    settingsId: string;
    messagePrice: number;
    callPrice?: number;
    callDuration?: number;
    callsEnabled: boolean;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .update({
        message_price: data.messagePrice,
        call_price: data.callPrice,
        call_duration: data.callDuration,
        calls_enabled: data.callsEnabled,
        response_expectation: data.responseExpectation
      })
      .eq('id', data.settingsId)
      .select()
      .single();

    return { data: settings, error };
  }

  /**
   * Generate auto-reply text for Instagram
   */
  public generateAutoReplyText(displayName: string, slug: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `Hey! Thanks for reaching out. To ensure I see your message, please send it through my priority inbox: ${baseUrl}/${slug} 💌`;
  }

  /**
   * Calculate single price from tiered pricing
   */
  public calculateSinglePrice(fanPrice: number, businessPrice: number): number {
    return Math.round((fanPrice + businessPrice) / 2);
  }

  /**
   * Create Stripe Connect account
   */
  public async createStripeConnectAccount(
    creatorId: string,
    email: string,
    displayName: string
  ): Promise<EdgeFunctionResponse<StripeConnectResponse>> {
    return this.supabaseService.createConnectAccount(creatorId, email, displayName);
  }

  /**
   * Verify Stripe Connect account status
   */
  public async verifyStripeAccount(accountId: string): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    return this.supabaseService.verifyConnectAccount(accountId);
  }
}
