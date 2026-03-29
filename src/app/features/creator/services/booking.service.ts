import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { CallBooking, SupabaseResponse } from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  constructor(private readonly supabaseService: SupabaseService) {}

  public async getCallBookings(creatorId: string): Promise<SupabaseResponse<CallBooking[]>> {
    const { data, error } = await this.supabaseService.client
      .from('call_bookings')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    return { data, error };
  }

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

  public unsubscribeFromCallBookings(channel: RealtimeChannel): void {
    void this.supabaseService.client.removeChannel(channel);
  }

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

  public async deleteCallBooking(bookingId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('call_bookings')
      .delete()
      .eq('id', bookingId);

    return { data: undefined, error };
  }
}
