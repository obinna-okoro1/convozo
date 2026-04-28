/**
 * Unit tests for BookingService
 * Covers: getCallBookings, updateBookingStatus, deleteCallBooking,
 *         subscribeToCallBookings, unsubscribeFromCallBookings.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { BookingService } from './booking.service';
import { CallBooking } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<CallBooking> = {}): CallBooking {
  const now = new Date().toISOString();
  return {
    id: 'booking-1',
    creator_id: 'creator-1',
    booker_name: 'Bob',
    booker_email: 'bob@example.com',
    scheduled_at: null,
    duration: 30,
    amount_paid: 5000,
    status: 'confirmed',
    call_notes: null,
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    daily_room_name: null,
    daily_room_url: null,
    creator_meeting_token: null,
    fan_meeting_token: null,
    fan_access_token: 'tok-1',
    creator_joined_at: null,
    fan_joined_at: null,
    call_started_at: null,
    call_ended_at: null,
    actual_duration_seconds: null,
    payout_status: 'held',
    payout_released_at: null,
    payout_release_at: null,
    refunded_at: null,
    refund_id: null,
    dispute_id: null,
    dispute_frozen_at: null,
    capture_method: 'manual',
    fan_timezone: 'UTC',
    session_type: 'online' as const,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('BookingService', () => {
  let service: BookingService;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: jasmine.createSpy('from'),
      channel: jasmine.createSpy('channel'),
      removeChannel: jasmine.createSpy('removeChannel').and.returnValue(Promise.resolve()),
    };

    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', [], {
      client: mockClient,
    });

    TestBed.configureTestingModule({
      providers: [BookingService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(BookingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── getCallBookings ───────────────────────────────────────────────────────

  describe('getCallBookings()', () => {
    it('returns bookings on success', async () => {
      const bookings = [makeBooking()];
      const chain: any = {
        select: jasmine.createSpy('select').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        order: jasmine
          .createSpy('order')
          .and.returnValue(Promise.resolve({ data: bookings, error: null })),
      };
      chain.select.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.getCallBookings('creator-1');

      expect(mockClient.from).toHaveBeenCalledWith('call_bookings');
      expect(chain.eq).toHaveBeenCalledWith('creator_id', 'creator-1');
      expect(result.data).toEqual(bookings);
      expect(result.error).toBeNull();
    });

    it('orders results by created_at descending', async () => {
      const chain: any = {
        select: jasmine.createSpy('select').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        order: jasmine
          .createSpy('order')
          .and.returnValue(Promise.resolve({ data: [], error: null })),
      };
      chain.select.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      await service.getCallBookings('creator-1');

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns error on failure', async () => {
      const dbError = { message: 'DB error', code: '500', details: '', hint: '' };
      const chain: any = {
        select: jasmine.createSpy('select').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        order: jasmine
          .createSpy('order')
          .and.returnValue(Promise.resolve({ data: null, error: dbError })),
      };
      chain.select.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.getCallBookings('creator-1');

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });

  // ── updateBookingStatus ───────────────────────────────────────────────────

  describe('updateBookingStatus()', () => {
    it('updates the status and returns the updated booking', async () => {
      const updated = makeBooking({ status: 'completed' });
      const chain: any = {
        update: jasmine.createSpy('update').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        select: jasmine.createSpy('select').and.returnValue(null as any),
        single: jasmine
          .createSpy('single')
          .and.returnValue(Promise.resolve({ data: updated, error: null })),
      };
      chain.update.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      chain.select.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.updateBookingStatus('booking-1', 'completed');

      expect(mockClient.from).toHaveBeenCalledWith('call_bookings');
      expect(chain.update).toHaveBeenCalledWith({ status: 'completed' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'booking-1');
      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });

    it('returns error when update fails', async () => {
      const dbError = { message: 'Update failed', code: '500', details: '', hint: '' };
      const chain: any = {
        update: jasmine.createSpy('update').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        select: jasmine.createSpy('select').and.returnValue(null as any),
        single: jasmine
          .createSpy('single')
          .and.returnValue(Promise.resolve({ data: null, error: dbError })),
      };
      chain.update.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      chain.select.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.updateBookingStatus('booking-1', 'cancelled');

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });

  // ── deleteCallBooking ─────────────────────────────────────────────────────

  describe('deleteCallBooking()', () => {
    it('deletes a booking by id', async () => {
      const chain: any = {
        delete: jasmine.createSpy('delete').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: null })),
      };
      chain.delete.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.deleteCallBooking('booking-1');

      expect(mockClient.from).toHaveBeenCalledWith('call_bookings');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'booking-1');
      expect(result.error).toBeNull();
    });

    it('returns error when delete fails', async () => {
      const dbError = { message: 'Delete failed', code: '500', details: '', hint: '' };
      const chain: any = {
        delete: jasmine.createSpy('delete').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(Promise.resolve({ error: dbError })),
      };
      chain.delete.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.deleteCallBooking('booking-1');

      expect(result.error).not.toBeNull();
    });
  });

  // ── subscribeToCallBookings ───────────────────────────────────────────────

  describe('subscribeToCallBookings()', () => {
    it('creates a channel for the creator and subscribes', () => {
      const mockChannel = {
        on: jasmine.createSpy('on').and.returnValue(null as any),
        subscribe: jasmine.createSpy('subscribe').and.returnValue({}),
      };
      mockChannel.on.and.returnValue(mockChannel);
      mockClient.channel.and.returnValue(mockChannel);

      service.subscribeToCallBookings('creator-1', jasmine.createSpy());

      expect(mockClient.channel).toHaveBeenCalledWith('call_bookings:creator-1');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  // ── unsubscribeFromCallBookings ───────────────────────────────────────────

  describe('unsubscribeFromCallBookings()', () => {
    it('calls removeChannel with the provided channel', () => {
      const mockChannel = {} as any;
      service.unsubscribeFromCallBookings(mockChannel);
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
