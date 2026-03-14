/**
 * Video Room Component
 *
 * Full-screen video call interface using Daily.co's daily-js SDK.
 *
 * Integration approach:
 *   - A single <iframe #dailyIframe> stays mounted in the DOM at all times so
 *     DailyIframe.wrap() can manage it throughout the call lifecycle.
 *   - State-specific screens (loading, waiting, completed, error) are absolute/
 *     fixed overlays rendered on top of the iframe — they never unmount the iframe.
 *   - Daily.co events (participant-joined, participant-left, error) drive state
 *     transitions directly, replacing the previous Supabase Realtime subscription.
 *   - call.leave() is called before completeCall() to release camera/mic.
 *   - call.destroy() is called on ngOnDestroy to free all SDK resources.
 *
 * Route: /call/:bookingId?role=creator|fan
 */

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  effect,
  ElementRef,
  ViewChild,
  NgZone,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { VideoCallService } from '../../services/video-call.service';
import { CompleteCallResponse } from '../../../../core/models';
import { SupabaseService } from '../../../../core/services/supabase.service';

@Component({
  selector: 'app-video-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ─── Daily.co iframe: always mounted so the SDK can manage it ─── -->
    <!-- The SDK sets the iframe src via call.join() — never bind [src] here. -->
    <div class="fixed inset-0 bg-black">
      <iframe
        #dailyIframe
        class="w-full h-full border-0"
        allow="camera; microphone; autoplay; display-capture"
        allowfullscreen>
      </iframe>
    </div>

    <!-- ─── In-call overlays (timer + end button) ─── -->
    @if (videoCallService.callState() === 'in_progress') {
      <!-- Top bar: live indicator + countdown timer -->
      <div class="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-[1rem] py-[0.75rem] bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div class="flex items-center gap-[0.75rem]">
          <div class="w-[0.5rem] h-[0.5rem] rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-white text-sm font-medium">Live</span>
          <span class="text-slate-400 text-sm">•</span>
          <span class="text-white text-sm">{{ otherParticipantName() }}</span>
        </div>
        <div class="flex items-center gap-[0.5rem]"
             [class.text-red-400]="videoCallService.remainingSeconds() < 60"
             [class.text-white]="videoCallService.remainingSeconds() >= 60">
          <svg class="w-[1.125rem] h-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-mono font-bold text-lg">{{ videoCallService.formattedTimeRemaining() }}</span>
        </div>
      </div>

      <!-- Bottom bar: end call button (both creator and fan) -->
      <div class="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-center py-[1.25rem] bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <button
          (click)="endCall()"
          class="pointer-events-auto flex items-center gap-[0.5rem] px-[1.5rem] py-[0.75rem] bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-colors min-h-[2.75rem]">
          <svg class="w-[1.25rem] h-[1.25rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          {{ isCreator() ? 'End Call' : 'Leave Call' }}
        </button>
      </div>

      <!-- Low time warning banner -->
      @if (videoCallService.remainingSeconds() <= 60 && videoCallService.remainingSeconds() > 0) {
        <div class="fixed top-[4rem] left-1/2 -translate-x-1/2 z-20 bg-red-600/90 text-white px-[1rem] py-[0.5rem] rounded-full text-sm font-medium animate-pulse">
          ⏱ Less than 1 minute remaining
        </div>
      }
    }

    <!-- ─── Waiting overlay: first participant waiting for the other ─── -->
    @if (videoCallService.callState() === 'waiting') {
      <div class="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-40">
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
          <p class="text-slate-500 text-sm">The call will start when both parties are connected</p>
        </div>
      </div>
    }

    <!-- ─── Loading overlay ─── -->
    @if (loading()) {
      <div class="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="w-[3rem] h-[3rem] border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-[1rem]"></div>
          <p class="text-white text-lg">Connecting to your call...</p>
        </div>
      </div>
    }

    <!-- ─── Error overlay ─── -->
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

    <!-- ─── Ending overlay ─── -->
    @if (videoCallService.callState() === 'ending') {
      <div class="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="w-[3rem] h-[3rem] border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-[1rem]"></div>
          <p class="text-white text-lg">Ending call...</p>
        </div>
      </div>
    }

    <!-- ─── Completed summary overlay ─── -->
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
  styles: `:host { display: block; }`,
})
export class VideoRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dailyIframe') dailyIframeRef!: ElementRef<HTMLIFrameElement>;

  readonly loading = signal(true);
  readonly completionResult = signal<CompleteCallResponse | null>(null);

  private bookingId = '';
  private role: 'creator' | 'fan' = 'fan';
  private dailyCall: DailyCall | null = null;
  private autoCompleteTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly otherParticipantName = computed(() => {
    const booking = this.videoCallService.currentBooking();
    if (!booking) return 'participant';
    return this.role === 'creator' ? booking.booker_name : 'Creator';
  });

  readonly isCreator = computed(() => this.role === 'creator');

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ngZone: NgZone,
    readonly videoCallService: VideoCallService,
    private readonly supabaseService: SupabaseService,
  ) {
    // Watch for timer expiry → auto-complete the call (creator only)
    effect(() => {
      const remaining = this.videoCallService.remainingSeconds();
      const state = this.videoCallService.callState();

      if (remaining <= 0 && state === 'in_progress' && this.isCreator()) {
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

  private async checkCreatorAuth(): Promise<boolean> {
    // Creators must be authenticated — the join-call Edge Function requires a valid JWT
    // for the creator role. If the session is missing or expired, redirect to login.
    if (this.role !== 'creator') return true;

    const user = await this.supabaseService.waitForSession();
    if (!user) {
      // Preserve the intended destination so login can redirect back
      const returnUrl = `/call/${this.bookingId}?role=creator`;
      void this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
      return false;
    }
    return true;
  }

  /**
   * Wrap the iframe with daily-js and set up event listeners.
   * Must happen here (not ngOnInit) because the DOM element must exist first.
   * By the time the async initializeCall() resolves (~1-2s Edge Function round-trip),
   * ngAfterViewInit will always have already run, so dailyCall is guaranteed to be set.
   */
  ngAfterViewInit(): void {
    // Destroy any lingering Daily.co singleton before wrapping.
    // This prevents "Duplicate DailyIframe instances are not allowed" when
    // the component is remounted (e.g. Angular hot reload or fast navigation)
    // before the async ngOnDestroy cleanup has fully resolved.
    // Retry multiple times to ensure the instance is fully destroyed.
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const existingInstance = DailyIframe.getCallInstance();
        if (!existingInstance) break; // No instance to destroy
        existingInstance.destroy();
        // Small yield to allow async cleanup
        break;
      } catch (err) {
        // Instance may already be destroyed or invalid — continue
      }
      attempts++;
    }

    this.dailyCall = DailyIframe.wrap(this.dailyIframeRef.nativeElement, {
      // We provide our own End Call button and timer overlay.
      // NOTE: iframeStyle cannot be passed to wrap() — it only works with createFrame().
      // The iframe is already styled full-screen via CSS classes in the template.
      showLeaveButton: false,
      showFullscreenButton: false,
    });

    this.setupDailyEvents();
  }

  /**
   * Set up Daily.co SDK event listeners.
   *
   * All event callbacks run outside Angular's zone, so signal writes are
   * wrapped in ngZone.run() to ensure change detection is triggered.
   */
  private setupDailyEvents(): void {
    if (!this.dailyCall) return;

    this.dailyCall
      // Fires when the local user successfully enters the meeting room.
      .on('joined-meeting', () => {
        console.log('[Daily] Joined meeting room');
      })

      // Fires when ANY participant (local or remote) joins.
      // participant-joined fires for the local user first, then again for each remote.
      // When we see 2 participants total, both parties are present.
      .on('participant-joined', () => {
        this.ngZone.run(() => {
          if (!this.dailyCall || this.videoCallService.callState() !== 'waiting') return;
          const count = Object.keys(this.dailyCall.participants()).length;
          if (count >= 2) {
            void this.transitionToInProgress();
          }
        });
      })

      // Fires when a participant disconnects mid-call.
      .on('participant-left', () => {
        this.ngZone.run(() => {
          if (!this.dailyCall || this.videoCallService.callState() !== 'in_progress') return;
          const count = Object.keys(this.dailyCall.participants()).length;
          if (count < 2) {
            // Remote participant left — log it; the creator's End Call button
            // or the auto-complete timer handles cleanup.
            console.log('[Daily] Remote participant left the call');
          }
        });
      })

      // Fires when the local user leaves (via call.leave() or network drop).
      .on('left-meeting', () => {
        console.log('[Daily] Left the meeting');
      })

      // Fires on SDK or network errors (e.g. bad token, room expired).
      .on('error', (event) => {
        this.ngZone.run(() => {
          const e = event as { errorMsg?: string };
          console.error('[Daily] Error:', e);
          this.videoCallService.callState.set('error');
          this.videoCallService.errorMessage.set(
            e.errorMsg ?? 'An error occurred in the video call',
          );
        });
      });
  }

  /**
   * Transition from 'waiting' to 'in_progress' when both participants are in the room.
   * Optimistically starts the countdown, then refreshes from DB for the authoritative
   * call_started_at so both parties see the same timer.
   */
  private async transitionToInProgress(): Promise<void> {
    const booking = this.videoCallService.currentBooking();
    if (!booking) return;

    // Optimistic: start countdown from now for immediate UX
    this.videoCallService.callState.set('in_progress');
    this.videoCallService.callStartedAt.set(new Date());
    this.videoCallService.startCountdown(booking.duration);

    // Authoritative: re-fetch booking to get server-recorded call_started_at
    const { data: fresh } = await this.videoCallService.loadBooking(this.bookingId);
    if (fresh?.call_started_at) {
      this.videoCallService.callStartedAt.set(new Date(fresh.call_started_at));
      this.videoCallService.startCountdown(fresh.duration);
    }
  }

  private async initializeCall(): Promise<void> {
    // Verify creator auth before making any Edge Function calls
    const isAuthed = await this.checkCreatorAuth();
    if (!isAuthed) return;

    const { error } = await this.videoCallService.loadBooking(this.bookingId);
    if (error) {
      this.videoCallService.callState.set('error');
      this.videoCallService.errorMessage.set('Booking not found');
      this.loading.set(false);
      return;
    }

    const joinResult = await this.videoCallService.joinCall(this.bookingId, this.role);
    this.loading.set(false);

    if (!joinResult) return; // joinCall already set error state

    // If the call was already in progress when we joined (e.g. reconnecting),
    // skip the 'waiting' state and go straight to 'in_progress'.
    if (joinResult.booking.call_started_at) {
      this.videoCallService.callState.set('in_progress');
      this.videoCallService.callStartedAt.set(new Date(joinResult.booking.call_started_at));
      this.videoCallService.startCountdown(joinResult.booking.duration);
    }

    // Join the Daily room via the SDK. The SDK:
    //  1. Sets the iframe src to the Daily Prebuilt UI
    //  2. Passes the scoped meeting token for access control
    //  3. Handles camera/mic permission prompts
    await this.joinDailyRoom(joinResult.room_url, joinResult.token);
  }

  /**
   * Join the Daily.co room using the SDK.
   * The token is a scoped JWT generated by the join-call Edge Function
   * that grants access to exactly this room with the correct participant role.
   */
  private async joinDailyRoom(roomUrl: string, token: string): Promise<void> {
    if (!this.dailyCall) {
      // This should never happen: ngAfterViewInit fires before the async Edge Function returns
      console.error('[Daily] Call object not ready');
      return;
    }

    try {
      await this.dailyCall.join({ url: roomUrl, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to video room';
      console.error('[Daily] join() failed:', err);
      this.videoCallService.callState.set('error');
      this.videoCallService.errorMessage.set(message);
    }
  }

  /**
   * End the call: leave the Daily room first (releases camera/mic),
   * then call the complete-call Edge Function to record duration and release payout.
   */
  async endCall(): Promise<void> {
    if (this.dailyCall) {
      try {
        await this.dailyCall.leave();
      } catch (err) {
        console.error('[Daily] Leave error:', err);
      }
    }

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

  ngOnDestroy(): void {
    this.videoCallService.reset();

    if (this.autoCompleteTimeout) {
      clearTimeout(this.autoCompleteTimeout);
    }

    // Leave and destroy the Daily call object to release all camera/mic resources.
    if (this.dailyCall) {
      void this.dailyCall
        .leave()
        .catch(() => { /* already left or no active session — safe to ignore */ })
        .finally(() => {
          void this.dailyCall!.destroy();
          this.dailyCall = null;
        });
    }
  }
}
