/**
 * Edge Function Service
 *
 * Provides a typed, error-unwrapping wrapper around Supabase Edge Function invocations.
 * All edge function calls should go through this service to ensure consistent
 * error handling and response typing.
 *
 * Extracted from SupabaseService to follow Single Responsibility Principle.
 */

import { Injectable } from '@angular/core';
import { FunctionsHttpError } from '@supabase/functions-js';
import {
  EdgeFunctionResponse,
  CheckoutSessionPayload,
  CallBookingPayload,
  ShopCheckoutPayload,
  StripeConnectResponse,
  StripeAccountStatus,
  MessageReply,
} from '../models';
import { SupabaseService } from './supabase.service';
import { environment } from '@env/environment';

// ── Conversation types (public, token-based access) ────────────────────────

export interface ConversationMessage {
  id: string;
  sender_name: string;
  message_content: string;
  amount_paid: number;
  message_type: string;
  created_at: string;
}

export interface ConversationCreator {
  display_name: string;
  slug: string;
  profile_image_url: string | null;
}

export interface ConversationData {
  message: ConversationMessage;
  creator: ConversationCreator;
  replies: MessageReply[];
}

// ── Client portal types (authenticated, magic-link session) ─────────────────

export interface PortalCreator {
  display_name: string;
  slug: string;
  profile_picture_url: string | null;
}

export interface PortalReply {
  content: string;
  sender_type: 'expert' | 'client';
  created_at: string;
}

export interface PortalMessage {
  id: string;
  message_content: string;
  amount_paid: number;
  message_type: string;
  is_handled: boolean;
  replied_at: string | null;
  created_at: string;
  conversation_token: string;
  sender_name: string;
  creator: PortalCreator;
  replies: PortalReply[];
}

export interface PortalBooking {
  id: string;
  duration: number;
  amount_paid: number;
  status: string;
  scheduled_at: string | null;
  fan_timezone: string | null;
  fan_access_token: string;
  call_notes: string | null;
  created_at: string;
  booker_name: string;
  creator: PortalCreator;
}

export interface ClientPortalData {
  messages: PortalMessage[];
  bookings: PortalBooking[];
}

@Injectable({
  providedIn: 'root',
})
export class EdgeFunctionService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Checkout ───────────────────────────────────────────────────────

  async createCheckoutSession(
    payload: CheckoutSessionPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return this.invoke('create-checkout-session', payload);
  }

  async createCallBookingSession(
    payload: CallBookingPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return this.invoke('create-call-booking-session', payload);
  }

  async createShopCheckout(
    payload: ShopCheckoutPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return this.invoke('create-shop-checkout', payload);
  }

  // ── Stripe Connect ─────────────────────────────────────────────────

  async createConnectAccount(
    creatorId: string,
    email: string,
    displayName: string,
  ): Promise<EdgeFunctionResponse<StripeConnectResponse>> {
    return this.invoke('create-connect-account', {
      creator_id: creatorId,
      email,
      display_name: displayName,
    });
  }

  async verifyConnectAccount(
    accountId: string,
  ): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    return this.invoke('verify-connect-account', { account_id: accountId });
  }

  // ── Email ──────────────────────────────────────────────────────────

  async sendReplyEmail(
    messageId: string,
    replyContent: string,
  ): Promise<EdgeFunctionResponse<void>> {
    return this.invoke('send-reply-email', {
      message_id: messageId,
      reply_content: replyContent,
    });
  }

  // ── Conversation (public, token-based) ────────────────────────────

  /**
   * Fetch a full conversation (original message + all threaded replies)
   * using the client-facing token. No auth required — called from the
   * public `/conversation/:token` page.
   */
  async getConversation(
    token: string,
  ): Promise<EdgeFunctionResponse<ConversationData>> {
    return this.invokePublic('get-conversation', { token });
  }

  /**
   * Post a client reply to a conversation.
   * No auth required — uses the conversation token for ownership.
   */
  async postClientReply(
    token: string,
    content: string,
  ): Promise<EdgeFunctionResponse<{ reply: Pick<MessageReply, 'id' | 'created_at'> }>> {
    return this.invokePublic('post-client-reply', { token, content });
  }

  // ── Shop Downloads ─────────────────────────────────────────────────

  async getShopDownloadUrl(
    sessionId: string,
  ): Promise<EdgeFunctionResponse<{ url: string; filename: string }>> {
    return this.invoke('get-shop-download', { session_id: sessionId });
  }

  // ── Client Portal ──────────────────────────────────────────────────

  /**
   * Fetch all messages and call bookings for the authenticated client.
   * Requires a valid Supabase JWT (from a magic-link session).
   * The edge function filters by auth.email() — clients only see their own data.
   */
  async getClientPortal(): Promise<EdgeFunctionResponse<ClientPortalData>> {
    return this.invoke('get-client-portal', {});
  }

  // ── Generic invocation with error unwrapping ───────────────────────

  /**
   * Invoke a Supabase Edge Function with automatic error unwrapping.
   *
   * FunctionsHttpError.message is always generic — the actual error is
   * in error.context.json(). This method unwraps it automatically.
   */
  private async invoke<T>(
    functionName: string,
    body: object,
  ): Promise<EdgeFunctionResponse<T>> {
    const { data, error } = await this.supabase.client.functions.invoke(functionName, { body });

    if (!error) {
      return { data: (data ?? undefined) as T | undefined, error: undefined };
    }

    // Unwrap FunctionsHttpError: read the real JSON body from the response
    if (error instanceof FunctionsHttpError) {
      try {
        const responseBody = await error.context.json() as { error?: string };
        const message = responseBody?.error ?? error.message;
        return { data: undefined, error: { message } };
      } catch {
        return { data: undefined, error: { message: error.message } };
      }
    }

    // Fallback for any other error type
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { data: undefined, error: { message } };
  }

  /**
   * Invoke a public Edge Function (no Supabase auth header) using a raw
   * fetch so the Supabase client doesn't inject the user's JWT.
   * Used for token-based public endpoints (get-conversation, post-client-reply).
   */
  private async invokePublic<T>(
    functionName: string,
    body: object,
  ): Promise<EdgeFunctionResponse<T>> {
    // Build the functions URL from the configured Supabase URL
    const baseUrl = environment.supabase.url.replace(/\/$/, '');
    const url = `${baseUrl}/functions/v1/${functionName}`;
    const anonKey = environment.supabase.anonKey;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const message = typeof json['error'] === 'string' ? json['error'] : 'An unexpected error occurred';
        return { data: undefined, error: { message } };
      }

      return { data: json as T, error: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { data: undefined, error: { message } };
    }
  }
}
