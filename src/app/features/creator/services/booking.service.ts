/**
 * Booking Service
 * Handles all call booking business logic:
 * fetching, real-time subscriptions, updating status, and deleting.
 *
 * Expects: creatorId (string), bookingId (string)
 * Returns: typed SupabaseResponse<T> objects
 * Errors: all methods handle errors internally and never throw to callers
 */

import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { CallBooking, SupabaseResponse } from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Load call bookings for a creator, newest first
   */
  public async getCallBookings(creatorId: string): Promise<SupabaseResponse<CallBooking[]>> {
    const { data, error } = await this.supabaseService.client
      .from('call_bookings')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    return { data, error };
  }

  /**
   * Subscribe to real-time changes on the call_bookings table for a creator.
   * Calls the provided callback with the full refreshed list on any change.
   */
  public subscribeToCallBookings(
    creatorId: string,
    onchange: (bookings: CallBooking[]) => void,
  ): RealtimeChannel {
    return this.supabaseService.client
      .channel(`call_bookings:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_bookings',
          filter: `creator_id=eq.${creatorId}`,
        },
        () => {
          void (async () => {
            const { data } = await this.getCallBookings(creatorId);
            if (data) {
              onchange(data);
            }
          })();
        },
      )
      .subscribe();
  }

  /**
   * Unsubscribe from a real-time call bookings channel
   */
  public unsubscribeFromCallBookings(channel: RealtimeChannel): void {
    void this.supabaseService.client.removeChannel(channel);
  }

  /**
   * Update call booking status (e.g. 'confirmed' → 'completed' or 'cancelled')
   */
  public async updateBookingStatus(
    bookingId: string,
    status: string,
  ): Promise<SupabaseResponse<CallBooking>> {
    const { data, error } = await this.supabaseService.client
      .from('call_bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    return { data: data as CallBooking | null, error };
  }

  /**
   * Delete a call booking record
   */
  public async deleteCallBooking(bookingId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('call_bookings')
      .delete()
      .eq('id', bookingId);

    return { data: undefined, error };
  }
}
