/**
 * Refund Service
 *
 * Calls the create-refund Edge Function to issue Stripe refunds.
 * Only the authenticated expert (profile owner) can trigger this.
 *
 * Returns a typed result object — never throws.
 */
import { Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';

export interface RefundResult {
  success: boolean;
  refund_id: string | null;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RefundService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Issue a full refund for a paid message.
   * Expert must be authenticated and own the message.
   */
  public async refundMessage(messageId: string): Promise<RefundResult> {
    return this.callRefundFunction('message', messageId);
  }

  /**
   * Issue a full refund (or void authorization) for a call booking.
   * Expert must be authenticated and own the booking.
   */
  public async refundBooking(bookingId: string): Promise<RefundResult> {
    return this.callRefundFunction('call_booking', bookingId);
  }

  private async callRefundFunction(
    type: 'message' | 'call_booking',
    id: string,
  ): Promise<RefundResult> {
    try {
      const { data, error } = await this.supabaseService.client.functions.invoke('create-refund', {
        body: { type, id },
      });

      if (error) {
        // Supabase wraps Edge Function errors — extract the message
        const msg =
          (error as { context?: { json?: () => Promise<{ error?: string }> } }).context != null
            ? await (error as { context: { json: () => Promise<{ error?: string }> } }).context
                .json()
                .then((b) => b.error ?? error.message)
                .catch(() => error.message)
            : error.message;
        return { success: false, refund_id: null, error: msg };
      }

      return {
        success: true,
        refund_id: (data as { refund_id: string | null }).refund_id ?? null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Refund failed';
      return { success: false, refund_id: null, error: msg };
    }
  }
}
