/**
 * Message Service
 * Handles all message-related business logic:
 * fetching, real-time subscriptions, replying, marking handled,
 * deleting, and computing stats.
 *
 * Expects: creatorId (string)
 * Returns: typed SupabaseResponse<T> or { success, error } objects
 * Errors: all methods handle errors internally and never throw to callers
 */

import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message, MessageStats, SupabaseResponse } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Load messages for a creator (excludes call-type messages)
   */
  public async getMessages(creatorId: string): Promise<SupabaseResponse<Message[]>> {
    const { data, error } = await this.supabaseService.client
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId)
      .neq('message_type', 'call')
      .order('created_at', { ascending: false });

    return { data, error };
  }

  /**
   * Subscribe to real-time changes on the messages table for a creator.
   * Calls the provided callback with the full refreshed list on any change.
   */
  public subscribeToMessages(
    creatorId: string,
    onchange: (messages: Message[]) => void,
  ): RealtimeChannel {
    return this.supabaseService.client
      .channel(`messages:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `creator_id=eq.${creatorId}`,
        },
        () => {
          void (async () => {
            const { data } = await this.getMessages(creatorId);
            if (data) {
              onchange(data);
            }
          })();
        },
      )
      .subscribe();
  }

  /**
   * Unsubscribe from a real-time messages channel
   */
  public unsubscribeFromMessages(channel: RealtimeChannel): void {
    void this.supabaseService.client.removeChannel(channel);
  }

  /**
   * Reply to a message via the send-reply-email Edge Function.
   * Updates the DB and sends an email notification.
   */
  public async replyToMessage(
    messageId: string,
    replyContent: string,
    _senderEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: functionError } = await this.supabaseService.sendReplyEmail(
        messageId,
        replyContent,
      );

      if (functionError != null) {
        console.error('[MessageService] Reply function error:', functionError);
        throw functionError;
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reply';
      return { success: false, error: message };
    }
  }

  /**
   * Mark a message as handled
   */
  public async markAsHandled(messageId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('messages')
      .update({ is_handled: true })
      .eq('id', messageId);

    return { data: undefined, error };
  }

  /**
   * Delete a message
   */
  public async deleteMessage(messageId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('messages')
      .delete()
      .eq('id', messageId);

    return { data: undefined, error };
  }

  /**
   * Calculate message statistics.
   * Revenue is converted from cents to dollars for display.
   */
  public calculateStats(messages: Message[]): MessageStats {
    const total = messages.length;
    const unhandled = messages.filter((m) => !m.is_handled).length;
    const handled = messages.filter((m) => m.is_handled).length;
    const totalRevenueCents = messages.reduce((sum, m) => sum + (m.amount_paid ?? 0), 0);
    const totalRevenue = Math.round((totalRevenueCents / 100) * 100) / 100;

    return { total, unhandled, handled, totalRevenue };
  }
}
