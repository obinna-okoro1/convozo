/**
 * Video Room Component
 *
 * Full-screen video call interface using Daily.co embedded iframe.
 * Handles:
 * - Loading the booking and joining the call
 * - Displaying a waiting room when one participant arrives first
 * - Countdown timer during the call
 * - Auto-complete when timer expires
 * - Manual end-call button for the creator
 * - Post-call summary screen
 *
 * Route: /call/:bookingId?role=creator|fan
 */

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RealtimeChannel } from '@supabase/supabase-js';
import { VideoCallService, VideoCallState } from '../../services/video-call.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { CallBooking, CompleteCallResponse } from '../../../../core/models';

@Component({
  selector: 'app-video-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Loading state -->
    @if (loading()) {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="w-[3rem] h-[3rem] border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-[1rem]"></div>
          <p class="text-white text-lg">Connecting to your call...</p>
        </div>
      </div>
    }

    <!-- Error state -->
    @if (videoCallService.callState() === 'error') {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center max-w-md mx-auto px-[1.5rem]">
          <div class="w-[4rem] h-[4rem] rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-[1.5rem]">
            <svg class="w-[2rem] h-[2rem] text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-white text-xl font-bold mb-[0.5rem]">Unable to join call</h2>
          <p class="text-slate-400 mb-[1.5rem]">{{ videoCallService.errorMessage() }}</p>
          <button
            (click)="goBack()"
            class="px-[1.5rem] py-[0.75rem] bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors">
            Go Back
          </button>
        </div>
      </div>
    }

    <!-- Waiting room -->
    @if (videoCallService.callState() === 'waiting') {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center max-w-md mx-auto px-[1.5rem]">
          <div class="w-[5rem] h-[5rem] rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-[1.5rem] animate-pulse">
            <svg class="w-[2.5rem] h-[2.5rem] text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 class="text-white text-2xl font-bold mb-[0.5rem]">Waiting for {{ otherParticipantName() }}</h2>
          <p class="text-slate-400 mb-[0.5rem]">
            {{ videoCallService.currentBooking()?.duration }} minute call
          </p>
          <p class="text-slate-500 text-sm">The call will start automatically when both parties are connected</p>

          <!-- Daily iframe loads in background while waiting -->
          @if (iframeUrl()) {
            <div class="mt-[2rem] rounded-2xl overflow-hidden border border-white/10 aspect-video">
              <iframe
                #dailyIframe
                [src]="iframeUrl()"
                class="w-full h-full"
                allow="camera; microphone; autoplay; display-capture"
                allowfullscreen>
              </iframe>
            </div>
          }
        </div>
      </div>
    }

    <!-- Active call -->
    @if (videoCallService.callState() === 'in_progress') {
      <div class="fixed inset-0 bg-black z-50 flex flex-col">
        <!-- Top bar: timer + info -->
        <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-[1rem] py-[0.75rem] bg-gradient-to-b from-black/80 to-transparent">
          <div class="flex items-center gap-[0.75rem]">
            <div class="w-[0.5rem] h-[0.5rem] rounded-full bg-green-500 animate-pulse"></div>
            <span class="text-white text-sm font-medium">Live</span>
            <span class="text-slate-400 text-sm">•</span>
            <span class="text-white text-sm">{{ otherParticipantName() }}</span>
          </div>

          <!-- Countdown timer -->
          <div class="flex items-center gap-[0.5rem]" [class.text-red-400]="videoCallService.remainingSeconds() < 60" [class.text-white]="videoCallService.remainingSeconds() >= 60">
            <svg class="w-[1.125rem] h-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="font-mono font-bold text-lg">{{ videoCallService.formattedTimeRemaining() }}</span>
          </div>
        </div>

        <!-- Daily video iframe -->
        <iframe
          #dailyIframe
          [src]="iframeUrl()"
          class="flex-1 w-full h-full"
          allow="camera; microphone; autoplay; display-capture"
          allowfullscreen>
        </iframe>

        <!-- Bottom bar: controls -->
        <div class="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-[1rem] py-[1.25rem] bg-gradient-to-t from-black/80 to-transparent">
          @if (isCreator()) {
            <button
              (click)="endCall()"
              class="flex items-center gap-[0.5rem] px-[1.5rem] py-[0.75rem] bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-colors min-h-[2.75rem]">
              <svg class="w-[1.25rem] h-[1.25rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
              End Call
            </button>
          }
        </div>

        <!-- Low time warning -->
        @if (videoCallService.remainingSeconds() <= 60 && videoCallService.remainingSeconds() > 0) {
          <div class="absolute top-[4rem] left-1/2 -translate-x-1/2 z-20 bg-red-600/90 text-white px-[1rem] py-[0.5rem] rounded-full text-sm font-medium animate-pulse">
            ⏱ Less than 1 minute remaining
          </div>
        }
      </div>
    }

    <!-- Call ending -->
    @if (videoCallService.callState() === 'ending') {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="w-[3rem] h-[3rem] border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-[1rem]"></div>
          <p class="text-white text-lg">Ending call...</p>
        </div>
      </div>
    }

    <!-- Call completed summary -->
    @if (videoCallService.callState() === 'completed') {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center max-w-md mx-auto px-[1.5rem]">
          <div class="w-[5rem] h-[5rem] rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-[1.5rem]">
            <svg class="w-[2.5rem] h-[2.5rem] text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-white text-2xl font-bold mb-[0.5rem]">Call Complete! 🎉</h2>

          @if (completionResult()) {
            <div class="bg-slate-800 rounded-xl p-[1.25rem] mb-[1.5rem] text-left">
              <div class="flex justify-between text-sm mb-[0.5rem]">
                <span class="text-slate-400">Duration</span>
                <span class="text-white font-medium">{{ formatDuration(completionResult()!.actual_duration_seconds) }}</span>
              </div>
              <div class="flex justify-between text-sm mb-[0.5rem]">
                <span class="text-slate-400">Booked</span>
                <span class="text-white font-medium">{{ formatDuration(completionResult()!.booked_duration_seconds) }}</span>
              </div>
              @if (isCreator()) {
                <hr class="border-slate-700 my-[0.75rem]" />
                <div class="flex justify-between text-sm">
                  <span class="text-slate-400">Payout</span>
                  <span [class]="completionResult()!.payout_released ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'">
                    {{ completionResult()!.payout_released ? '✅ Released' : '⏳ Pending review' }}
                  </span>
                </div>
              }
            </div>
          }

          <button
            (click)="goBack()"
            class="px-[1.5rem] py-[0.75rem] bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors">
            {{ isCreator() ? 'Back to Dashboard' : 'Done' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class VideoRoomComponent implements OnInit, OnDestroy {
  @ViewChild('dailyIframe') dailyIframeRef!: ElementRef<HTMLIFrameElement>;

  readonly loading = signal(true);
  readonly completionResult = signal<CompleteCallResponse | null>(null);

  private bookingId = '';
  private role: 'creator' | 'fan' = 'fan';
  private realtimeChannel: RealtimeChannel | null = null;
  private autoCompleteTimeout: ReturnType<typeof setTimeout> | null = null;

  // Derived from booking data
  readonly otherParticipantName = computed(() => {
    const booking = this.videoCallService.currentBooking();
    if (!booking) return 'participant';
    return this.role === 'creator' ? booking.booker_name : 'Creator';
  });

  readonly isCreator = computed(() => this.role === 'creator');

  readonly iframeUrl = computed(() => {
    const url = this.videoCallService.getDailyIframeUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer,
    readonly videoCallService: VideoCallService,
    private readonly supabaseService: SupabaseService,
  ) {
    // Watch for timer expiry → auto-complete the call
    effect(() => {
      const remaining = this.videoCallService.remainingSeconds();
      const state = this.videoCallService.callState();

      if (remaining <= 0 && state === 'in_progress' && this.isCreator()) {
        // Timer expired — auto-end the call after a brief delay
        if (!this.autoCompleteTimeout) {
          this.autoCompleteTimeout = setTimeout(() => void this.endCall(), 3000);
        }
      }
    });
  }

  ngOnInit(): void {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') || '';
    this.role = (this.route.snapshot.queryParamMap.get('role') as 'creator' | 'fan') || 'fan';

    if (!this.bookingId) {
      this.videoCallService.callState.set('error');
      this.videoCallService.errorMessage.set('No booking ID provided');
      this.loading.set(false);
      return;
    }

    void this.initializeCall();
  }

  ngOnDestroy(): void {
    this.videoCallService.reset();
    this.unsubscribeRealtime();

    if (this.autoCompleteTimeout) {
      clearTimeout(this.autoCompleteTimeout);
    }
  }

  private async initializeCall(): Promise<void> {
    // Load booking details first
    const { error } = await this.videoCallService.loadBooking(this.bookingId);
    if (error) {
      this.videoCallService.callState.set('error');
      this.videoCallService.errorMessage.set('Booking not found');
      this.loading.set(false);
      return;
    }

    // Join the call
    const joinResult = await this.videoCallService.joinCall(this.bookingId, this.role);
    this.loading.set(false);

    if (!joinResult) return; // Error state already set by the service

    // Subscribe to realtime booking updates (to detect other participant joining)
    this.subscribeToBookingUpdates();
  }

  /**
   * Subscribe to realtime changes on this specific booking.
   * When the other participant joins, the booking status changes to 'in_progress'.
   */
  private subscribeToBookingUpdates(): void {
    this.realtimeChannel = this.supabaseService.client
      .channel(`call_booking:${this.bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_bookings',
          filter: `id=eq.${this.bookingId}`,
        },
        (payload) => {
          const updated = payload.new as CallBooking;
          this.videoCallService.currentBooking.set(updated);
          this.videoCallService.onOtherParticipantJoined(updated);
        },
      )
      .subscribe();
  }

  private unsubscribeRealtime(): void {
    if (this.realtimeChannel) {
      void this.supabaseService.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  async endCall(): Promise<void> {
    const result = await this.videoCallService.completeCall(
      this.bookingId,
      this.isCreator() ? 'creator' : 'fan',
    );
    if (result) {
      this.completionResult.set(result);
    }
  }

  goBack(): void {
    if (this.isCreator()) {
      void this.router.navigate(['/creator/dashboard']);
    } else {
      void this.router.navigate(['/']);
    }
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }
}
