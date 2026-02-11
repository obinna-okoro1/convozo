/**
 * Creator Service
 * Handles all creator-related business logic
 */

import { Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Creator, CreatorSettings, Message, MessageStats, SupabaseResponse } from '../../../core/models';

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
      // Update message with reply
      const { error: updateError } = await this.supabaseService.client
        .from('messages')
        .update({ 
          reply: replyContent,
          handled: true 
        })
        .eq('id', messageId);

      if (updateError) throw updateError;

      // Send email notification via Edge Function
      const { error: emailError } = await this.supabaseService.client.functions.invoke('send-reply-email', {
        body: {
          to: senderEmail,
          replyContent
        }
      });

      if (emailError) {
        console.error('Email notification failed:', emailError);
        // Don't fail the whole operation if email fails
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
      .update({ handled: true })
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
  }): Promise<SupabaseResponse<Creator>> {
    const { data: creator, error } = await this.supabaseService.client
      .from('creators')
      .insert([{
        user_id: data.userId,
        display_name: data.displayName,
        bio: data.bio,
        slug: data.slug,
        profile_image_url: data.profileImageUrl || null
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
    pricingType: 'single' | 'tiered';
    singlePrice?: number;
    fanPrice?: number;
    businessPrice?: number;
    responseExpectation: string;
  }): Promise<SupabaseResponse<CreatorSettings>> {
    const { data: settings, error } = await this.supabaseService.client
      .from('creator_settings')
      .insert([{
        creator_id: data.creatorId,
        pricing_type: data.pricingType,
        single_price: data.singlePrice,
        fan_price: data.fanPrice,
        business_price: data.businessPrice,
        response_expectation: data.responseExpectation
      }])
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
}
