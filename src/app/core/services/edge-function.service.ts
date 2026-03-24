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
} from '../models';
import { SupabaseService } from './supabase.service';

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

  // ── Shop Downloads ─────────────────────────────────────────────────

  async getShopDownloadUrl(
    sessionId: string,
  ): Promise<EdgeFunctionResponse<{ url: string; filename: string }>> {
    return this.invoke('get-shop-download', { session_id: sessionId });
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
}
