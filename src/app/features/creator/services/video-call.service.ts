/**
 * Video Call Service
 *
 * Handles all video call operations:
 * - Joining a call (creator or fan)
 * - Completing a call
 * - Loading the Daily.co iframe
 * - Tracking call state
 *
 * Uses Daily.co's prebuilt UI via iframe embedding for MVP.
 * Future: switch to daily-js SDK for custom UI.
 *
 * Expects: SupabaseService for Edge Function invocations
 * Returns: typed responses
 * Errors: all methods handle errors and never throw to callers
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
  async joinCall(bookingId: string, role: 'creator' | 'fan'): Promise<JoinCallResponse | null> {
    this.callState.set('joining');
    this.errorMessage.set(null);

    try {
      const { data, error } = await this.supabaseService.client.functions.invoke('join-call', {
        body: { booking_id: bookingId, role },
      });

      if (error) {
        this.callState.set('error');
        this.errorMessage.set(error.message || 'Failed to join call');
        return null;
      }

      const response = data as JoinCallResponse;
      this.roomUrl.set(response.room_url);
      this.meetingToken.set(response.token);

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
   * Complete the call — called when the timer expires or creator ends manually.
   * Only authenticated creators can call this.
   */
  async completeCall(bookingId: string, endedBy: 'creator' | 'fan' | 'system' = 'system'): Promise<CompleteCallResponse | null> {
    this.callState.set('ending');
    this.stopCountdown();

    try {
      const { data, error } = await this.supabaseService.client.functions.invoke('complete-call', {
        body: { booking_id: bookingId, ended_by: endedBy },
      });

      if (error) {
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
   * Load a booking by ID (for the video room component)
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
   * Build the full Daily iframe URL with meeting token.
   * Format: https://yourdomain.daily.co/room-name?t=TOKEN
   */
  getDailyIframeUrl(): string | null {
    const url = this.roomUrl();
    const token = this.meetingToken();
    if (!url || !token) return null;
    return `${url}?t=${token}`;
  }

  /**
   * Start the countdown timer for the booked duration.
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
   * Notify that the other participant has joined (called from realtime subscription).
   * Transitions from 'waiting' to 'in_progress' and starts the countdown.
   */
  onOtherParticipantJoined(booking: CallBooking): void {
    if (this.callState() === 'waiting' && booking.call_started_at) {
      this.callState.set('in_progress');
      this.callStartedAt.set(new Date(booking.call_started_at));
      this.startCountdown(booking.duration);
    }
  }

  /**
   * Reset all state — call when navigating away from the video room.
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
  }
}
