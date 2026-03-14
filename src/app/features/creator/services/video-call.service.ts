/**
 * Video Call Service
 *
 * Handles all video call operations:
 * - Joining a call (creator or fan) via the join-call Edge Function
 * - Completing a call via the complete-call Edge Function
 * - Loading bookings from the database
 * - Tracking reactive call state (idle → joining → waiting → in_progress → completed)
 *
 * The VideoRoomComponent uses @daily-co/daily-js for real-time participant events
 * and calls this service for state management and backend communication.
 *
 * Expects: SupabaseService for Edge Function invocations and DB queries
 * Returns: typed responses
 * Errors: all methods handle errors internally and never throw to callers
 */

import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  CallBooking,
  JoinCallResponse,
  CompleteCallResponse,
  SupabaseResponse,
} from '../../../core/models';
export type VideoCallState =
  | 'idle'
  | 'joining'
  | 'waiting'      // Waiting for the other participant
  | 'in_progress'  // Both participants in the call
  | 'ending'
  | 'completed'
  | 'error';

@Injectable({
  providedIn: 'root',
})
export class VideoCallService {
  // Reactive state for the video call
  readonly callState = signal<VideoCallState>('idle');
  readonly currentBooking = signal<CallBooking | null>(null);
  readonly roomUrl = signal<string | null>(null);
  readonly meetingToken = signal<string | null>(null);
  readonly callStartedAt = signal<Date | null>(null);
  readonly remainingSeconds = signal<number>(0);
  readonly errorMessage = signal<string | null>(null);

  // Secret token for fan auth against complete-call (set when fan joins via joinCall)
  private fanAccessToken: string | null = null;

  // Computed: formatted time remaining (MM:SS)
  readonly formattedTimeRemaining = computed(() => {
    const total = this.remainingSeconds();
    if (total <= 0) return '00:00';
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  readonly isCallActive = computed(() =>
    this.callState() === 'in_progress' || this.callState() === 'waiting',
  );

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Join a video call as either 'creator' or 'fan'.
   * Calls the join-call Edge Function to get room URL + meeting token.
   */
  async joinCall(bookingId: string, role: 'creator' | 'fan', fanAccessToken?: string): Promise<JoinCallResponse | null> {
    this.callState.set('joining');
    this.errorMessage.set(null);
    // Store for use in completeCall when the fan ends the call
    this.fanAccessToken = role === 'fan' ? (fanAccessToken ?? null) : null;

    try {
      // Creator role requires a valid JWT. Call refreshSession() to ensure
      // any expired access token is swapped for a fresh one before invoking the Edge Function.
      if (role === 'creator') {
        const { error: refreshErr } = await this.supabaseService.client.auth.refreshSession();
        if (refreshErr) {
          this.callState.set('error');
          this.errorMessage.set('Session expired — please log in again');
          return null;
        }
      }

      const { data, error } = await this.supabaseService.client.functions.invoke('join-call', {
        body: {
          booking_id: bookingId,
          role,
          ...(role === 'fan' && fanAccessToken ? { fan_access_token: fanAccessToken } : {}),
        },
      });

      if (error) {
        this.callState.set('error');
        this.errorMessage.set(error.message || 'Failed to join call');
        return null;
      }

      const response = data as JoinCallResponse;
      this.roomUrl.set(response.room_url);
      this.meetingToken.set(response.token);

      // Set currentBooking from Edge Function response so the UI has booking
      // data even for fans who can't query call_bookings directly (RLS blocks it).
      // This ensures the waiting overlay, timer, and participant name all render.
      if (!this.currentBooking()) {
        this.currentBooking.set({
          id: response.booking.id,
          status: response.booking.status,
          duration: response.booking.duration,
          booker_name: response.booking.booker_name,
          call_started_at: response.booking.call_started_at,
        } as CallBooking);
      }

      // If call already started (both parties in), go to in_progress
      if (response.booking.call_started_at) {
        this.callState.set('in_progress');
        this.callStartedAt.set(new Date(response.booking.call_started_at));
        this.startCountdown(response.booking.duration);
      } else {
        this.callState.set('waiting');
      }

      return response;
    } catch (err) {
      this.callState.set('error');
      this.errorMessage.set((err as Error).message || 'Failed to join call');
      return null;
    }
  }

  /**
   * Complete the call — called when the timer expires or either participant ends.
   * Creator: authenticated via JWT.
   * Fan: authenticated via fan_access_token issued at booking time.
   * If the call is already completed (409), treat it as success — the other
   * party already triggered completion.
   */
  async completeCall(bookingId: string, endedBy: 'creator' | 'fan' | 'system' = 'system', fanAccessToken?: string): Promise<CompleteCallResponse | null> {
    this.callState.set('ending');
    this.stopCountdown();

    // Resolve which token to use: explicit param → stored token from joinCall
    const tokenToUse = fanAccessToken ?? this.fanAccessToken ?? undefined;

    try {
      const { data, error } = await this.supabaseService.client.functions.invoke('complete-call', {
        body: {
          booking_id: bookingId,
          ended_by: endedBy,
          ...(tokenToUse ? { fan_access_token: tokenToUse } : {}),
        },
      });

      if (error) {
        // 409 means the call was already completed by the other party — that's fine.
        // Show the completed screen without treating it as an error.
        if (error.message?.includes('409') || error.message?.includes('already')) {
          this.callState.set('completed');
          return null;
        }
        this.callState.set('error');
        this.errorMessage.set(error.message || 'Failed to complete call');
        return null;
      }

      this.callState.set('completed');
      return data as CompleteCallResponse;
    } catch (err) {
      this.callState.set('error');
      this.errorMessage.set((err as Error).message || 'Failed to complete call');
      return null;
    }
  }

  /**
   * Load a booking by ID (used by VideoRoomComponent on init and after participant-joined)
   */
  async loadBooking(bookingId: string): Promise<SupabaseResponse<CallBooking>> {
    const { data, error } = await this.supabaseService.client
      .from('call_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (data) {
      this.currentBooking.set(data as CallBooking);
    }

    return { data: data as CallBooking | null, error };
  }

  /**
   * Stop the countdown timer.
   */
  startCountdown(durationMinutes: number): void {
    this.stopCountdown(); // Clear any existing timer

    const startedAt = this.callStartedAt();
    if (!startedAt) return;

    const totalSeconds = durationMinutes * 60;
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    this.remainingSeconds.set(Math.max(0, totalSeconds - elapsed));

    this.countdownInterval = setInterval(() => {
      const current = this.remainingSeconds();
      if (current <= 0) {
        this.stopCountdown();
        return;
      }
      this.remainingSeconds.set(current - 1);
    }, 1000);
  }

  /**
   * Stop the countdown timer.
   */
  stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Reset all state — called by VideoRoomComponent on ngOnDestroy.
   */
  reset(): void {
    this.stopCountdown();
    this.callState.set('idle');
    this.currentBooking.set(null);
    this.roomUrl.set(null);
    this.meetingToken.set(null);
    this.callStartedAt.set(null);
    this.remainingSeconds.set(0);
    this.errorMessage.set(null);
    this.fanAccessToken = null;
  }
}
