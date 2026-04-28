/**
 * Unit tests for VideoCallService
 * Covers: initial state, computed signals (formattedTimeRemaining, isCallActive),
 *         reset(), startCountdown(), stopCountdown(), joinCall(), completeCall(),
 *         loadBooking(), loadCallStatus().
 *
 * Uses jasmine.clock() for timer control (app is zoneless — no fakeAsync).
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { VideoCallService } from './video-call.service';
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

describe('VideoCallService', () => {
  let service: VideoCallService;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let mockClient: any;
  let mockAuth: any;
  let mockFunctions: any;

  beforeEach(() => {
    mockAuth = {
      refreshSession: jasmine
        .createSpy('refreshSession')
        .and.returnValue(Promise.resolve({ error: null })),
    };

    mockFunctions = {
      invoke: jasmine.createSpy('invoke'),
    };

    mockClient = {
      from: jasmine.createSpy('from'),
      rpc: jasmine.createSpy('rpc'),
      auth: mockAuth,
      functions: mockFunctions,
    };

    supabaseSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', [], {
      client: mockClient,
    });

    TestBed.configureTestingModule({
      providers: [VideoCallService, { provide: SupabaseService, useValue: supabaseSpy }],
    });

    service = TestBed.inject(VideoCallService);
  });

  afterEach(() => {
    service.reset();
    jasmine.clock().uninstall();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('callState is idle', () => {
      expect(service.callState()).toBe('idle');
    });

    it('currentBooking is null', () => {
      expect(service.currentBooking()).toBeNull();
    });

    it('roomUrl is null', () => {
      expect(service.roomUrl()).toBeNull();
    });

    it('meetingToken is null', () => {
      expect(service.meetingToken()).toBeNull();
    });

    it('callStartedAt is null', () => {
      expect(service.callStartedAt()).toBeNull();
    });

    it('remainingSeconds is 0', () => {
      expect(service.remainingSeconds()).toBe(0);
    });

    it('errorMessage is null', () => {
      expect(service.errorMessage()).toBeNull();
    });
  });

  // ── Computed: formattedTimeRemaining ──────────────────────────────────────

  describe('formattedTimeRemaining', () => {
    it('returns 00:00 when remainingSeconds is 0', () => {
      service.remainingSeconds.set(0);
      expect(service.formattedTimeRemaining()).toBe('00:00');
    });

    it('returns 00:00 when remainingSeconds is negative', () => {
      service.remainingSeconds.set(-5);
      expect(service.formattedTimeRemaining()).toBe('00:00');
    });

    it('formats single-digit minutes and seconds with padding', () => {
      service.remainingSeconds.set(65); // 1 min 5 sec
      expect(service.formattedTimeRemaining()).toBe('01:05');
    });

    it('formats exactly 1 minute', () => {
      service.remainingSeconds.set(60);
      expect(service.formattedTimeRemaining()).toBe('01:00');
    });

    it('formats 30 minutes', () => {
      service.remainingSeconds.set(1800); // 30 * 60
      expect(service.formattedTimeRemaining()).toBe('30:00');
    });

    it('formats 59:59 correctly', () => {
      service.remainingSeconds.set(3599);
      expect(service.formattedTimeRemaining()).toBe('59:59');
    });
  });

  // ── Computed: isCallActive ────────────────────────────────────────────────

  describe('isCallActive', () => {
    it('is false when state is idle', () => {
      service.callState.set('idle');
      expect(service.isCallActive()).toBeFalse();
    });

    it('is false when state is joining', () => {
      service.callState.set('joining');
      expect(service.isCallActive()).toBeFalse();
    });

    it('is true when state is waiting', () => {
      service.callState.set('waiting');
      expect(service.isCallActive()).toBeTrue();
    });

    it('is true when state is in_progress', () => {
      service.callState.set('in_progress');
      expect(service.isCallActive()).toBeTrue();
    });

    it('is false when state is ending', () => {
      service.callState.set('ending');
      expect(service.isCallActive()).toBeFalse();
    });

    it('is false when state is completed', () => {
      service.callState.set('completed');
      expect(service.isCallActive()).toBeFalse();
    });

    it('is false when state is error', () => {
      service.callState.set('error');
      expect(service.isCallActive()).toBeFalse();
    });
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears all signals back to defaults', () => {
      service.callState.set('in_progress');
      service.currentBooking.set(makeBooking());
      service.roomUrl.set('https://room.daily.co/test');
      service.meetingToken.set('tok-abc');
      service.callStartedAt.set(new Date());
      service.remainingSeconds.set(120);
      service.errorMessage.set('some error');

      service.reset();

      expect(service.callState()).toBe('idle');
      expect(service.currentBooking()).toBeNull();
      expect(service.roomUrl()).toBeNull();
      expect(service.meetingToken()).toBeNull();
      expect(service.callStartedAt()).toBeNull();
      expect(service.remainingSeconds()).toBe(0);
      expect(service.errorMessage()).toBeNull();
    });

    it('stops the countdown timer on reset', () => {
      jasmine.clock().install();
      service.callStartedAt.set(new Date());
      service.startCountdown(1); // 1 minute
      expect(service.remainingSeconds()).toBe(60);

      service.reset();

      // Tick 2 seconds — counter should NOT decrement after reset
      jasmine.clock().tick(2000);
      expect(service.remainingSeconds()).toBe(0);
      jasmine.clock().uninstall();
    });
  });

  // ── startCountdown / stopCountdown ────────────────────────────────────────

  describe('startCountdown()', () => {
    it('sets remainingSeconds based on durationMinutes', () => {
      jasmine.clock().install();
      service.callStartedAt.set(new Date());
      service.startCountdown(5); // 5 minutes = 300 seconds
      expect(service.remainingSeconds()).toBe(300);
      jasmine.clock().uninstall();
    });

    it('decrements remainingSeconds every second', () => {
      jasmine.clock().install();
      service.callStartedAt.set(new Date());
      service.startCountdown(1); // 60 seconds

      jasmine.clock().tick(3000); // 3 seconds

      expect(service.remainingSeconds()).toBe(57);
      jasmine.clock().uninstall();
    });

    it('stops decrementing at 0', () => {
      jasmine.clock().install();
      service.callStartedAt.set(new Date());
      service.startCountdown(1); // 60 seconds

      jasmine.clock().tick(65000); // Tick past the end

      expect(service.remainingSeconds()).toBe(0);
      jasmine.clock().uninstall();
    });

    it('does nothing when callStartedAt is null', () => {
      // callStartedAt is null by default
      service.startCountdown(5);
      expect(service.remainingSeconds()).toBe(0);
    });

    it('accounts for elapsed time since call started', () => {
      jasmine.clock().install();
      // Set a fixed base date so Date.now() is predictable
      const baseDate = new Date(2024, 0, 1, 12, 0, 0);
      jasmine.clock().mockDate(baseDate);
      service.callStartedAt.set(new Date()); // records baseDate

      jasmine.clock().tick(10000); // advance mock clock by 10 seconds
      service.startCountdown(1); // 60 total seconds, 10 elapsed → 50 remaining

      expect(service.remainingSeconds()).toBe(50);
      jasmine.clock().uninstall();
    });
  });

  describe('stopCountdown()', () => {
    it('stops the countdown from decrementing', () => {
      jasmine.clock().install();
      service.callStartedAt.set(new Date());
      service.startCountdown(1); // 60 seconds

      jasmine.clock().tick(2000); // 2 seconds pass
      expect(service.remainingSeconds()).toBe(58);

      service.stopCountdown();
      jasmine.clock().tick(5000); // 5 more seconds

      // Should still be 58 — countdown stopped
      expect(service.remainingSeconds()).toBe(58);
      jasmine.clock().uninstall();
    });

    it('is safe to call when no countdown is running', () => {
      expect(() => {
        service.stopCountdown();
      }).not.toThrow();
    });
  });

  // ── joinCall() ────────────────────────────────────────────────────────────

  describe('joinCall()', () => {
    it('sets callState to joining before the request', async () => {
      let stateOnCall: string | null = null;

      mockFunctions.invoke.and.callFake(() => {
        stateOnCall = service.callState();
        return Promise.resolve({ data: null, error: { message: 'test fail' } });
      });

      await service.joinCall('booking-1', 'fan');

      expect(stateOnCall as unknown as string).toEqual('joining');
    });

    it('sets callState to waiting when no call_started_at in response', async () => {
      const booking = makeBooking({ call_started_at: null });
      const response = {
        room_url: 'https://room.daily.co/test',
        token: 'tok-abc',
        booking: {
          id: 'booking-1',
          status: 'confirmed',
          duration: 30,
          booker_name: 'Bob',
          call_started_at: null,
        },
      };
      mockFunctions.invoke.and.returnValue(Promise.resolve({ data: response, error: null }));

      await service.joinCall('booking-1', 'fan');

      expect(service.callState()).toBe('waiting');
      expect(service.roomUrl()).toBe('https://room.daily.co/test');
      expect(service.meetingToken()).toBe('tok-abc');
      void booking;
    });

    it('sets callState to in_progress when call_started_at is present', async () => {
      const startedAt = new Date().toISOString();
      const response = {
        room_url: 'https://room.daily.co/test',
        token: 'tok-xyz',
        booking: {
          id: 'booking-1',
          status: 'in_progress',
          duration: 30,
          booker_name: 'Bob',
          call_started_at: startedAt,
        },
      };
      mockFunctions.invoke.and.returnValue(Promise.resolve({ data: response, error: null }));

      await service.joinCall('booking-1', 'fan');

      expect(service.callState()).toBe('in_progress');
    });

    it('sets callState to error on edge function failure', async () => {
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: null, error: { message: 'Edge error' } }),
      );

      const result = await service.joinCall('booking-1', 'fan');

      expect(result).toBeNull();
      expect(service.callState()).toBe('error');
      expect(service.errorMessage()).toBe('Edge error');
    });

    it('refreshes session for creator role before invoking', async () => {
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: null, error: { message: 'fail' } }),
      );

      await service.joinCall('booking-1', 'creator');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAuth.refreshSession).toHaveBeenCalled();
    });

    it('sets callState to error when session refresh fails (creator role)', async () => {
      mockAuth.refreshSession.and.returnValue(
        Promise.resolve({ error: new Error('Session expired') }),
      );

      const result = await service.joinCall('booking-1', 'creator');

      expect(result).toBeNull();
      expect(service.callState()).toBe('error');
    });

    it('clears error message before the request', async () => {
      service.errorMessage.set('old error');
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: null, error: { message: 'new error' } }),
      );

      await service.joinCall('booking-1', 'fan');

      expect(service.errorMessage()).toBe('new error');
    });
  });

  // ── completeCall() ────────────────────────────────────────────────────────

  describe('completeCall()', () => {
    it('sets callState to completed on success', async () => {
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: { success: true }, error: null }),
      );

      await service.completeCall('booking-1', 'creator');

      expect(service.callState()).toBe('completed');
    });

    it('sets callState to error on failure', async () => {
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: null, error: { message: 'Complete failed' } }),
      );

      await service.completeCall('booking-1', 'creator');

      expect(service.callState()).toBe('error');
      expect(service.errorMessage()).toBe('Complete failed');
    });

    it('treats 409 "already completed" as success', async () => {
      mockFunctions.invoke.and.returnValue(
        Promise.resolve({ data: null, error: { message: '409 already completed' } }),
      );

      await service.completeCall('booking-1', 'fan');

      // 409 = the other party already ended the call, which is fine
      expect(service.callState()).toBe('completed');
    });

    it('sets callState to ending before the request', async () => {
      let stateOnCall: string | null = null;
      mockFunctions.invoke.and.callFake(() => {
        stateOnCall = service.callState();
        return Promise.resolve({ data: null, error: { message: 'fail' } });
      });

      await service.completeCall('booking-1', 'system');

      expect(stateOnCall as unknown as string).toEqual('ending');
    });
  });

  // ── loadBooking() ─────────────────────────────────────────────────────────

  describe('loadBooking()', () => {
    it('sets currentBooking and returns data', async () => {
      const booking = makeBooking();
      const chain: any = {
        select: jasmine.createSpy('select').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        single: jasmine
          .createSpy('single')
          .and.returnValue(Promise.resolve({ data: booking, error: null })),
      };
      chain.select.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      const result = await service.loadBooking('booking-1');

      expect(service.currentBooking()).toEqual(booking);
      expect(result.data).toEqual(booking);
      expect(result.error).toBeNull();
    });

    it('does not set currentBooking on error', async () => {
      const dbError = { message: 'Not found', code: '404', details: '', hint: '' };
      const chain: any = {
        select: jasmine.createSpy('select').and.returnValue(null as any),
        eq: jasmine.createSpy('eq').and.returnValue(null as any),
        single: jasmine
          .createSpy('single')
          .and.returnValue(Promise.resolve({ data: null, error: dbError })),
      };
      chain.select.and.returnValue(chain);
      chain.eq.and.returnValue(chain);
      mockClient.from.and.returnValue(chain);

      await service.loadBooking('booking-1');

      expect(service.currentBooking()).toBeNull();
    });
  });

  // ── loadCallStatus() ──────────────────────────────────────────────────────

  describe('loadCallStatus()', () => {
    it('calls rpc with get_call_status', async () => {
      mockClient.rpc.and.returnValue(
        Promise.resolve({ data: [{ id: 'booking-1', status: 'confirmed' }], error: null }),
      );

      await service.loadCallStatus('booking-1');

      expect(mockClient.rpc).toHaveBeenCalledWith('get_call_status', {
        p_booking_id: 'booking-1',
      });
    });

    it('returns error when rpc fails', async () => {
      const rpcError = { message: 'RPC error', code: '500', details: '', hint: '' };
      mockClient.rpc.and.returnValue(Promise.resolve({ data: null, error: rpcError }));

      const result = await service.loadCallStatus('booking-1');

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it('merges status into currentBooking when result exists', async () => {
      const existing = makeBooking();
      service.currentBooking.set(existing);
      mockClient.rpc.and.returnValue(
        Promise.resolve({ data: [{ status: 'in_progress' }], error: null }),
      );

      await service.loadCallStatus('booking-1');

      expect(service.currentBooking()?.status).toBe('in_progress');
    });
  });
});
