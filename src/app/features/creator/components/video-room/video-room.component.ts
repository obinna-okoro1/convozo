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
      <div class="fixed top-0 left-0 right-0 z-20 flex items-center justify-between
                  px-4 pt-safe-top pb-3 pt-3
                  bg-gradient-to-b from-black/75 via-black/40 to-transparent pointer-events-none">
        <div class="flex items-center gap-2.5">
          <!-- Pulsing live dot -->
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style="background: #4ade80;"></span>
            <span class="relative inline-flex rounded-full h-2 w-2" style="background: #4ade80;"></span>
          </span>
          <span class="text-white text-sm font-medium tracking-wide">Live</span>
          <span class="w-px h-3 opacity-30" style="background: white;"></span>
          <span class="text-sm" style="color: rgba(255,255,255,0.65);">{{ otherParticipantName() }}</span>
        </div>
        <!-- Countdown timer -->
        <div class="flex items-center gap-1.5 tabular-nums transition-colors duration-300"
             [style.color]="videoCallService.remainingSeconds() < 60 ? '#f87171' : 'rgba(255,255,255,0.9)'">
          <svg class="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-mono font-bold text-base">{{ videoCallService.formattedTimeRemaining() }}</span>
        </div>
      </div>

      <!-- Bottom bar: end call button -->
      <div class="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center
                  py-6 bg-gradient-to-t from-black/75 via-black/40 to-transparent pointer-events-none">
        <button
          (click)="endCall()"
          class="pointer-events-auto flex items-center gap-2 px-7 py-3.5 rounded-full
                 font-semibold text-sm text-white transition-all duration-200
                 shadow-xl min-h-[2.75rem]"
          style="background: #ef4444; box-shadow: 0 0.5rem 1.5rem rgba(239,68,68,0.35);"
          onmouseover="this.style.background='#dc2626';"
          onmouseout="this.style.background='#ef4444';">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24
                     1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17
                     0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          {{ isCreator() ? 'End Call' : 'Leave Call' }}
        </button>
      </div>

      <!-- Low-time warning pill — replaces the old animate-pulse banner -->
      @if (videoCallService.remainingSeconds() <= 60 && videoCallService.remainingSeconds() > 0) {
        <div class="fixed top-14 left-1/2 -translate-x-1/2 z-30 animate-fade-in
                    flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white"
             style="background: rgba(239,68,68,0.85); backdrop-filter: blur(0.5rem);">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Less than 1 minute remaining
        </div>
      }
    }

    <!-- ─── Waiting overlay ─── -->
    @if (videoCallService.callState() === 'waiting') {
      <div class="fixed inset-0 z-40 flex items-center justify-center animate-fade-in"
           style="background: #0a0a0a;">
        <div class="text-center max-w-xs mx-auto px-6">
          <!-- Animated avatar ring with brand gradient -->
          <div class="relative w-[5.5rem] h-[5.5rem] mx-auto mb-8">
            <div class="absolute inset-0 rounded-full animate-ping"
                 style="background: rgba(124,58,237,0.12);"></div>
            <div class="absolute inset-[-0.25rem] rounded-full animate-spin"
                 style="background: conic-gradient(from 0deg, transparent 60%, #7c3aed 80%, #ec4899 100%);
                        animation-duration: 3s;"></div>
            <div class="absolute inset-0 rounded-full flex items-center justify-center"
                 style="background: #161616; border: 1px solid rgba(124,58,237,0.2);">
              <svg class="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                   style="color: rgba(167,139,250,0.8);">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          </div>

          <h2 class="text-2xl font-bold mb-2" style="color: #fff;">
            Waiting for {{ otherParticipantName() }}
          </h2>
          <p class="text-sm mb-1" style="color: rgba(255,255,255,0.45);">
            {{ videoCallService.currentBooking()?.duration }}-minute call
          </p>
          <p class="text-xs mb-10" style="color: rgba(255,255,255,0.28);">
            The call begins when both participants are connected
          </p>

          <!-- Animated dots -->
          <div class="flex items-center justify-center gap-1.5 mb-10">
            @for (i of [0, 1, 2]; track i) {
              <div class="w-1.5 h-1.5 rounded-full animate-bounce"
                   style="background: rgba(124,58,237,0.65);"
                   [style.animation-delay]="(i * 160) + 'ms'"></div>
            }
          </div>

          <button
            (click)="leaveWaiting()"
            class="text-sm font-medium transition-all duration-200 px-5 py-2.5 rounded-xl min-h-[2.75rem]"
            style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05);
                   border: 1px solid rgba(255,255,255,0.09);"
            onmouseover="this.style.color='rgba(255,255,255,0.7)'; this.style.background='rgba(255,255,255,0.09)';"
            onmouseout="this.style.color='rgba(255,255,255,0.4)'; this.style.background='rgba(255,255,255,0.05)';">
            Leave
          </button>
        </div>
      </div>
    }

    <!-- ─── Loading overlay ─── -->
    @if (loading()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #0a0a0a;">
        <div class="text-center">
          <!-- Brand gradient spinner ring -->
          <div class="relative w-16 h-16 mx-auto mb-6">
            <div class="absolute inset-0 rounded-full animate-spin"
                 style="background: conic-gradient(from 0deg, transparent 0%, #7c3aed 35%, #ec4899 100%);
                        mask: radial-gradient(farthest-side, transparent 62%, black 63%);
                        -webkit-mask: radial-gradient(farthest-side, transparent 62%, black 63%);
                        animation-duration: 1.1s;"></div>
            <div class="absolute inset-[0.25rem] rounded-full flex items-center justify-center"
                 style="background: #0a0a0a;">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                   style="color: rgba(167,139,250,0.7);">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </div>
          </div>
          <p class="text-base font-medium" style="color: rgba(255,255,255,0.65);">
            Connecting to your call…
          </p>
          <p class="text-xs mt-1.5" style="color: rgba(255,255,255,0.3);">
            This may take a moment
          </p>
        </div>
      </div>
    }

    <!-- ─── Error overlay ─── -->
    @if (videoCallService.callState() === 'error') {
      <div class="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
           style="background: #0a0a0a;">
        <div class="text-center max-w-sm mx-auto px-6 w-full">
          <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
               style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.18);">
            <svg class="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                 style="color: #f87171;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4
                       c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold mb-2" style="color: #fff;">Connection Failed</h2>
          <p class="text-sm mb-8 leading-relaxed" style="color: rgba(255,255,255,0.45);">
            {{ videoCallService.errorMessage() }}
          </p>
          <button
            (click)="goBack()"
            class="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
            style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);">
            Go Back
          </button>
        </div>
      </div>
    }

    <!-- ─── Ending overlay ─── -->
    @if (videoCallService.callState() === 'ending') {
      <div class="fixed inset-0 z-50 flex items-center justify-center"
           style="background: rgba(10,10,10,0.92); backdrop-filter: blur(0.25rem);">
        <div class="text-center">
          <div class="relative w-14 h-14 mx-auto mb-5">
            <div class="absolute inset-0 rounded-full animate-spin"
                 style="background: conic-gradient(from 0deg, transparent 0%, #7c3aed 35%, #ec4899 100%);
                        mask: radial-gradient(farthest-side, transparent 62%, black 63%);
                        -webkit-mask: radial-gradient(farthest-side, transparent 62%, black 63%);"></div>
          </div>
          <p class="font-medium" style="color: rgba(255,255,255,0.6);">Wrapping up…</p>
        </div>
      </div>
    }

    <!-- ─── Completed overlay ─── -->
    @if (videoCallService.callState() === 'completed') {
      <div class="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
           style="background: #0a0a0a;">
        <div class="text-center max-w-sm mx-auto px-6 w-full">
          <!-- Checkmark circle -->
          <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-7"
               style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);">
            <svg class="w-11 h-11" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                 style="color: #4ade80;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>

          <h2 class="text-2xl font-bold mb-1.5" style="color: #fff;">Call Completed</h2>
          <p class="text-sm mb-8" style="color: rgba(255,255,255,0.4);">
            Thanks for the great conversation
          </p>

          @if (completionResult()) {
            <div class="rounded-2xl p-5 mb-7 text-left space-y-3.5"
                 style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);">
              <div class="flex justify-between items-center text-sm">
                <span style="color: rgba(255,255,255,0.45);">Duration</span>
                <span class="font-semibold" style="color: #fff;">
                  {{ formatDuration(completionResult()!.actual_duration_seconds) }}
                </span>
              </div>
              <div class="h-px" style="background: rgba(255,255,255,0.06);"></div>
              <div class="flex justify-between items-center text-sm">
                <span style="color: rgba(255,255,255,0.45);">Booked</span>
                <span class="font-semibold" style="color: #fff;">
                  {{ formatDuration(completionResult()!.booked_duration_seconds) }}
                </span>
              </div>
              @if (isCreator()) {
                <div class="h-px" style="background: rgba(255,255,255,0.06);"></div>
                <div class="flex justify-between items-center text-sm">
                  <span style="color: rgba(255,255,255,0.45);">Payout</span>
                  <span class="font-semibold flex items-center gap-1.5"
                        [style.color]="completionResult()!.payout_released ? '#4ade80' : '#fbbf24'">
                    @if (completionResult()!.payout_released) {
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                      </svg>
                      Released
                    } @else {
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                      </svg>
                      Pending review
                    }
                  </span>
                </div>
              }
            </div>
          }

          <button
            (click)="goBack()"
            class="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
            style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);">
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
  private fanAccessToken = '';
  private dailyCall: DailyCall | null = null;
  private autoCompleteTimeout: ReturnType<typeof setTimeout> | null = null;
  // Polls participants() every 2s as a fallback for the participant-joined event,
  // which can be unreliable in iframe-wrapped Daily sessions.
  private participantPollInterval: ReturnType<typeof setInterval> | null = null;

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
    this.fanAccessToken = this.route.snapshot.queryParamMap.get('token') || '';

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
            console.log('[Daily] Remote participant left — auto-ending call');
            // Auto-end the call when the other participant disconnects.
            // For creators: calls complete-call to finalize payout.
            // For fans: just leaves and shows completion screen.
            void this.endCall();
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
    // Guard: if we already moved past waiting (event + poll both fired), do nothing
    if (this.videoCallService.callState() !== 'waiting') return;
    const booking = this.videoCallService.currentBooking();
    if (!booking) return;

    // Stop polling — we got the signal, no need to keep checking
    this.stopParticipantPolling();

    // Optimistic: start countdown from now for immediate UX
    this.videoCallService.callState.set('in_progress');
    this.videoCallService.callStartedAt.set(new Date());
    this.videoCallService.startCountdown(booking.duration);

    // Authoritative: re-fetch booking to get server-recorded call_started_at.
    // This query may fail for fans (RLS blocks unauthenticated SELECT), so
    // treat it as a best-effort refresh — the optimistic values above are
    // close enough for a smooth UX.
    try {
      const { data: fresh } = await this.videoCallService.loadBooking(this.bookingId);
      if (fresh?.call_started_at) {
        this.videoCallService.callStartedAt.set(new Date(fresh.call_started_at));
        this.videoCallService.startCountdown(fresh.duration);
      }
    } catch {
      // Fan RLS blocked — continue with optimistic timer
    }
  }

  private async initializeCall(): Promise<void> {
    // Verify creator auth before making any Edge Function calls
    const isAuthed = await this.checkCreatorAuth();
    if (!isAuthed) return;

    // Creators are authenticated and can query call_bookings directly via RLS.
    // Fans are unauthenticated — RLS blocks their SELECT, so skip the client-side
    // query entirely. The join-call Edge Function (service role) will fetch the
    // booking and return all needed data in its response.
    if (this.role === 'creator') {
      const { error } = await this.videoCallService.loadBooking(this.bookingId);
      if (error) {
        this.videoCallService.callState.set('error');
        this.videoCallService.errorMessage.set('Booking not found');
        this.loading.set(false);
        return;
      }
    }

    const joinResult = await this.videoCallService.joinCall(this.bookingId, this.role, this.fanAccessToken);
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

    // Start polling as a safety net in case participant-joined doesn't fire.
    // Cleared automatically once the call transitions to in_progress.
    this.startParticipantPolling();
  }

  /**
   * Poll Daily.co participants() every 2 seconds while in the 'waiting' state.
   * This is a reliable fallback for the participant-joined SDK event, which can
   * be missed in iframe-wrapped sessions (e.g. cross-origin iframe message delays).
   * Stops automatically when the call moves to any non-waiting state.
   */
  private startParticipantPolling(): void {
    if (this.participantPollInterval) return; // already polling

    this.participantPollInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.videoCallService.callState() !== 'waiting') {
          this.stopParticipantPolling();
          return;
        }
        if (!this.dailyCall) return;

        const count = Object.keys(this.dailyCall.participants()).length;
        if (count >= 2) {
          console.log('[Daily] Poll detected 2 participants — transitioning to in_progress');
          this.stopParticipantPolling();
          void this.transitionToInProgress();
        }
      });
    }, 2000);
  }

  private stopParticipantPolling(): void {
    if (this.participantPollInterval) {
      clearInterval(this.participantPollInterval);
      this.participantPollInterval = null;
    }
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
   * then call complete-call for BOTH roles.
   *
   * Creator: authenticated via JWT.
   * Fan: authenticated via fan_access_token (stored in VideoCallService from joinCall).
   * Both paths hit the same complete-call Edge Function — if both race simultaneously,
   * the second caller gets a 409 which is handled gracefully (shows completed screen).
   */
  async endCall(): Promise<void> {
    // Prevent double-ending
    const currentState = this.videoCallService.callState();
    if (currentState === 'ending' || currentState === 'completed') return;

    if (this.dailyCall) {
      try {
        await this.dailyCall.leave();
      } catch (err) {
        console.error('[Daily] Leave error:', err);
      }
    }

    // Both creator and fan call complete-call. The Edge Function accepts:
    //   - Creator: via Bearer JWT
    //   - Fan: via fan_access_token in the request body
    // The second caller (if both race) gets a 409 and shows the completed screen.
    const endedBy = this.isCreator() ? 'creator' : 'fan';
    const result = await this.videoCallService.completeCall(this.bookingId, endedBy);
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

  /**
   * Leave the waiting screen without triggering call completion.
   * The call never started so there's nothing to finalize — just disconnect
   * from Daily and navigate back. The booking stays 'confirmed' so they
   * can rejoin later.
   */
  async leaveWaiting(): Promise<void> {
    if (this.dailyCall) {
      try {
        await this.dailyCall.leave();
      } catch (err) {
        console.error('[Daily] Leave error during waiting exit:', err);
      }
    }
    this.videoCallService.reset();
    this.goBack();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  ngOnDestroy(): void {
    if (this.autoCompleteTimeout) {
      clearTimeout(this.autoCompleteTimeout);
    }
    this.stopParticipantPolling();

    // If the creator navigates away while the call is in_progress, fire-and-forget
    // a complete-call request so the booking doesn't stay stuck in 'in_progress'.
    const state = this.videoCallService.callState();
    if (this.isCreator() && (state === 'in_progress' || state === 'waiting')) {
      void this.videoCallService.completeCall(this.bookingId, 'creator');
    }

    this.videoCallService.reset();

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
