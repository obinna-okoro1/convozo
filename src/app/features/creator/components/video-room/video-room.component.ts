/**
 * Video Room Component
 *
 * Full-screen video call interface using Daily.co's daily-js SDK.
 *
 * Integration approach:
 *   - A single <iframe #dailyIframe> stays mounted in the DOM at all times so
 *     DailyIframe.wrap() can manage it throughout the call lifecycle.
 *   - State-specific screens (loading, waiting, completed, error) are delegated
 *     to dedicated presentational sub-components rendered as fixed overlays.
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
import { RealtimeChannel } from '@supabase/supabase-js';
import { VideoCallService } from '../../services/video-call.service';
import { CompleteCallResponse } from '@core/models';
import { SupabaseService } from '@core/services/supabase.service';
import { VideoCallToolbarComponent } from './video-call-toolbar.component';
import { VideoWaitingOverlayComponent } from './video-waiting-overlay.component';
import { VideoStatusOverlayComponent } from './video-status-overlay.component';
import { VideoCompletedOverlayComponent } from './video-completed-overlay.component';

@Component({
  selector: 'app-video-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-room.component.html',
  styles: `:host { display: block; }`,
  imports: [
    VideoCallToolbarComponent,
    VideoWaitingOverlayComponent,
    VideoStatusOverlayComponent,
    VideoCompletedOverlayComponent,
  ],
})
export class VideoRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dailyIframe') dailyIframeRef!: ElementRef<HTMLIFrameElement>;

  readonly loading = signal(true);
  readonly connecting = signal(false);
  readonly completionResult = signal<CompleteCallResponse | null>(null);
  /** Populated during initializeCall() — used to navigate back to /:slug/settings after a call. */
  readonly creatorSlug = signal<string | null>(null);

  private bookingId = '';
  private role: 'creator' | 'fan' = 'fan';
  private fanAccessToken = '';
  private dailyCall: DailyCall | null = null;
  private autoCompleteTimeout: ReturnType<typeof setTimeout> | null = null;
  // Polls participants() every 2s as a fallback for the participant-joined event,
  // which can be unreliable in iframe-wrapped Daily sessions.
  private participantPollInterval: ReturnType<typeof setInterval> | null = null;
  // Polls get_call_status RPC every 3s — guaranteed fallback that transitions the
  // waiting screen within 3s even if Realtime broadcast and Daily.co events both miss.
  private callStatusPollInterval: ReturnType<typeof setInterval> | null = null;
  // Supabase Realtime channel — authoritative signal for when the other party joins.
  // Fires as soon as the join-call Edge Function sets call_started_at on the DB row.
  private bookingChannel: RealtimeChannel | null = null;

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
      // This is the BEST moment to do a one-shot participant check because:
      //   1. The local user is now in the room and participants() is reliable
      //   2. If the other party joined DURING our WebRTC handshake, they're
      //      already in participants() but participant-joined may have been missed
      //   3. Polling + presence might not have started/connected yet
      .on('joined-meeting', () => {
        this.ngZone.run(() => {
          if (!this.dailyCall || this.videoCallService.callState() !== 'waiting') return;

          // Immediate participant check — catches the race window
          const count = Object.keys(this.dailyCall.participants()).length;
          if (count >= 2) {
            void this.transitionToInProgress();
            return;
          }

          // Also do an immediate DB check in case the Edge Function already
          // set call_started_at but the broadcast was missed
          void this.videoCallService.loadCallStatus(this.bookingId).then(({ data }) => {
            if (data?.call_started_at && this.videoCallService.callState() === 'waiting') {
              void this.transitionToInProgress(data.call_started_at as string);
            }
          });
        });
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
            // Auto-end the call when the other participant disconnects.
            // For creators: calls complete-call to finalize payout.
            // For fans: just leaves and shows completion screen.
            void this.endCall();
          }
        });
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
   *
   * Can be triggered by three sources (first one wins due to state guard):
   *   1. Supabase Realtime UPDATE on the booking row — most reliable, fires immediately
   *      when the join-call Edge Function sets call_started_at on the DB.
   *   2. Daily.co participant-joined event — fires when the other party enters the room.
   *   3. Daily.co participant poll (every 2s) — fallback if events don't fire.
   *
   * @param callStartedAt - Pre-fetched ISO timestamp from Realtime payload (skips DB round-trip).
   *                        When undefined, falls back to an optimistic 'now' then re-fetches.
   */
  private async transitionToInProgress(callStartedAt?: string): Promise<void> {
    // Guard: if we already moved past waiting (multiple sources may fire), do nothing.
    // Accept transition from both 'waiting' (normal) and 'connecting' (already transitioning).
    const currentState = this.videoCallService.callState();
    if (currentState !== 'waiting') return;
    const booking = this.videoCallService.currentBooking();
    if (!booking) return;

    // ── Stop all detection mechanisms — we have the signal ──
    this.stopParticipantPolling();
    this.stopCallStatusPolling();
    this.unsubscribeBookingRealtime();

    // ── Show brief "Connected" overlay — FaceTime-style feedback ──
    // Setting callState away from 'waiting' hides the waiting overlay.
    // The 'connecting' signal shows a brief green spinner + "Connected" text.
    // This gives both sides immediate visual feedback that the other party
    // has been detected, even before the Daily.co video fully renders.
    this.connecting.set(true);
    this.videoCallService.callState.set('joining'); // hides waiting overlay, not 'in_progress' yet

    // Use server-authoritative timestamp if available (from Realtime payload or DB fetch).
    // Fall back to 'now' for an immediate optimistic UX start.
    let startedAt = callStartedAt ? new Date(callStartedAt) : new Date();

    // If we didn't have a timestamp from the trigger source, fetch it from DB
    if (!callStartedAt) {
      try {
        const loadFn = this.role === 'fan'
          ? this.videoCallService.loadCallStatus(this.bookingId)
          : this.videoCallService.loadBooking(this.bookingId);
        const { data: fresh } = await loadFn;
        if (fresh?.call_started_at) {
          startedAt = new Date(fresh.call_started_at as string);
        }
      } catch {
        // Continue with optimistic timer on any unexpected error
      }
    }

    // Brief pause so the "Connected" overlay is visible — feels intentional,
    // like FaceTime's "Connecting..." → video transition. 600 ms is enough
    // to register visually without feeling sluggish.
    await new Promise(resolve => setTimeout(resolve, 600));

    // ── Transition to live call ──
    this.connecting.set(false);
    this.videoCallService.callState.set('in_progress');
    this.videoCallService.callStartedAt.set(startedAt);
    this.videoCallService.startCountdown(booking.duration);
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
      // Fetch creator slug so goBack() can navigate to /:slug/settings
      const creatorId = this.videoCallService.currentBooking()?.creator_id;
      if (creatorId) {
        const { data: creatorData } = await this.supabaseService.client
          .from('creators')
          .select('slug')
          .eq('id', creatorId)
          .single();
        if (creatorData) {
          this.creatorSlug.set((creatorData as { slug: string }).slug);
        }
      }
    }

    const joinResult = await this.videoCallService.joinCall(this.bookingId, this.role, this.fanAccessToken);
    this.loading.set(false);

    if (!joinResult) return; // joinCall already set error state

    // Start warming up camera/mic permissions immediately so the browser prompt
    // appears on the waiting screen — not after the call begins.
    void this.requestMediaPermissions();

    // If the call was already in progress when we joined (e.g. reconnecting),
    // skip the 'waiting' state and go straight to 'in_progress'.
    if (joinResult.booking.call_started_at) {
      this.videoCallService.callState.set('in_progress');
      this.videoCallService.callStartedAt.set(new Date(joinResult.booking.call_started_at));
      this.videoCallService.startCountdown(joinResult.booking.duration);
    }

    // ── Start ALL detection mechanisms BEFORE joinDailyRoom ──────────────
    //
    // joinDailyRoom() is async and blocks for 2-5 seconds (WebRTC handshake,
    // STUN/TURN, iframe load). If the other participant joins during this window,
    // we need every mechanism active to catch it:
    //
    //   1. Supabase Presence — instant mutual detection (primary)
    //   2. Supabase Broadcast — server-authoritative timestamp from Edge Function
    //   3. DB status poll — guaranteed fallback, checks call_started_at
    //   4. Daily.co participant poll — catches iframe-level joins
    //   5. Daily.co joined-meeting event — one-shot check on connect (see setupDailyEvents)
    //
    // Starting them BEFORE the blocking joinDailyRoom() call ensures they're
    // active during the entire WebRTC handshake window.
    if (this.videoCallService.callState() === 'waiting') {
      this.subscribeToBookingRealtime();
      this.startParticipantPolling();
      this.startCallStatusPolling();
    }

    // Join the Daily room via the SDK. The SDK:
    //  1. Sets the iframe src to the Daily Prebuilt UI
    //  2. Passes the scoped meeting token for access control
    //  3. Handles camera/mic permission prompts
    await this.joinDailyRoom(joinResult.room_url, joinResult.token);
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
   * Poll get_call_status RPC every 3 seconds while in the 'waiting' state.
   *
   * This is the most reliable fallback mechanism. It is independent of:
   *   - Supabase Realtime delivery (which can miss broadcasts if the subscription
   *     isn't established before the broadcast fires)
   *   - Daily.co iframe events (which can be delayed in cross-origin iframe mode)
   *
   * The get_call_status RPC (migration 029) is accessible to both anon (fans) and
   * authenticated (creators), so this works for both roles without special-casing.
   *
   * As soon as call_started_at is non-null in the DB, the waiting screen disappears
   * within 3 seconds, guaranteed.
   */
  private startCallStatusPolling(): void {
    if (this.callStatusPollInterval) return;

    // Do an immediate first check (no initial delay) then poll every 1.5s.
    // This catches the case where call_started_at was set before any mechanism
    // had time to detect it (e.g. during WebRTC handshake).
    const doCheck = (): void => {
      if (this.videoCallService.callState() !== 'waiting') {
        this.stopCallStatusPolling();
        return;
      }
      void this.videoCallService.loadCallStatus(this.bookingId).then(({ data }) => {
        if (data?.call_started_at) {
          this.ngZone.run(() => {
            void this.transitionToInProgress(data.call_started_at as string);
          });
        }
      });
    };

    // Immediate first check
    doCheck();
    this.callStatusPollInterval = setInterval(doCheck, 1500);
  }

  private stopCallStatusPolling(): void {
    if (this.callStatusPollInterval) {
      clearInterval(this.callStatusPollInterval);
      this.callStatusPollInterval = null;
    }
  }

  /**
   * Pre-request camera and microphone permissions while the user is still on
   * the waiting screen, so the browser's "Allow Camera & Microphone" prompt
   * appears before the call starts rather than interrupting it mid-join.
   *
   * Strategy: open a native getUserMedia stream, immediately stop every track
   * (no actual media is consumed), then let Daily.co open its own stream when
   * join() is called. The browser caches the permission grant, so Daily's
   * internal getUserMedia goes through without triggering a second prompt.
   *
   * Non-fatal: if the user denies or the device has no camera/mic, Daily.co
   * will surface its own in-room error state when join() is called.
   */
  private async requestMediaPermissions(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return; // unsupported environment
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Release immediately — Daily.co reopens its own stream during join()
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      // Permission denied or no devices — non-fatal, Daily.co handles its own error
      console.warn('[Media] Early permission request failed (non-fatal):', (err as Error).message);
    }
  }

  /**
   * Subscribe to Supabase Realtime presence + broadcast on the call channel.
   *
   * Since migration 029 removed the anon SELECT policy on call_bookings, fans
   * can no longer use postgres_changes (which requires SELECT access). Instead,
   * the join-call Edge Function broadcasts a 'call_started' event via the
   * Supabase Realtime REST API when both parties have joined. This subscription
   * receives that broadcast — no table permission required.
   *
   * Works for both creator and fan. Unsubscribed as soon as the call transitions
   * away from 'waiting'.
   */
  private subscribeToBookingRealtime(): void {
    if (this.bookingChannel) return; // already subscribed

    this.bookingChannel = this.supabaseService.client
      .channel(`call_room_${this.bookingId}`, {
        // Each participant uses a UNIQUE presence key (bookingId:role) so Supabase
        // tracks them as separate entries. Using the same key for both would cause
        // the second tracker to overwrite the first, making the sync event only
        // ever show one participant.
        config: { presence: { key: `${this.bookingId}:${this.role}` } },
      })

      // ── PRIMARY: Presence sync ─────────────────────────────────────────────
      // Each participant tracks { role } on this shared channel. Every time the
      // presence state changes (join or leave), ALL subscribers get a 'sync' event
      // with the complete current state. When we see both 'creator' and 'fan' in
      // the state, we transition immediately — no Edge Function broadcast required.
      //
      // Advantages over broadcast:
      //   - Works even if the second participant joined before the first subscribed
      //     (presence state is replayed on subscription, broadcast is not)
      //   - Both sides fire independently from the same event — no coordination needed
      //   - Heartbeat-based: if a participant disconnects, their presence expires
      //     automatically (~10 s) so state stays accurate
      .on('presence', { event: 'sync' }, () => {
        this.ngZone.run(() => {
          if (this.videoCallService.callState() !== 'waiting' || !this.bookingChannel) return;

          const state = this.bookingChannel.presenceState<{ role: string }>();
          const presences = Object.values(state).flat();
          const hasCreator = presences.some(p => p['role'] === 'creator');
          const hasFan = presences.some(p => p['role'] === 'fan');

          if (hasCreator && hasFan) {
            void this.transitionToInProgress();
          }
        });
      })

      // ── SECONDARY: Broadcast from join-call Edge Function ─────────────────
      // The join-call Edge Function still broadcasts 'call_started' with the
      // authoritative call_started_at timestamp. Use it to get the exact server
      // timestamp for the countdown timer rather than relying on client clocks.
      .on(
        'broadcast',
        { event: 'call_started' },
        (payload) => {
          this.ngZone.run(() => {
            if (this.videoCallService.callState() !== 'waiting') return;

            // The broadcast payload contains { call_started_at, status }
            // (nested under payload.payload in the Supabase broadcast envelope).
            const data = (payload as { payload?: { call_started_at?: string; status?: string } }).payload ?? {};
            const callStartedAt = data.call_started_at ?? undefined;

            if (callStartedAt || data.status === 'in_progress') {
              void this.transitionToInProgress(callStartedAt);
            }
          });
        },
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && this.bookingChannel) {
          // Announce this participant's role so the other side's presence sync fires.
          // Both sides track immediately on subscribe so neither needs to re-join to
          // detect the other.
          void this.bookingChannel
            .track({ role: this.role, joined_at: new Date().toISOString() })
            .catch(err => console.warn('[Presence] track() failed (non-fatal):', err));
        }
      });
  }

  private unsubscribeBookingRealtime(): void {
    if (this.bookingChannel) {
      // Untrack presence first so the other participant's 'sync' fires immediately
      // on our departure rather than waiting for the ~10 s heartbeat timeout.
      void this.bookingChannel.untrack().catch(() => { /* non-fatal */ });
      void this.supabaseService.client.removeChannel(this.bookingChannel);
      this.bookingChannel = null;
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
      const slug = this.creatorSlug();
      void this.router.navigate(slug ? [`/${slug}/settings`] : ['/home']);
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

  ngOnDestroy(): void {
    if (this.autoCompleteTimeout) {
      clearTimeout(this.autoCompleteTimeout);
    }
    this.stopParticipantPolling();
    this.stopCallStatusPolling();
    this.unsubscribeBookingRealtime();

    // If the creator navigates away while the call is in_progress, fire-and-forget
    // a complete-call request so the booking doesn't stay stuck in 'in_progress'.
    const state = this.videoCallService.callState();
    if (this.isCreator() && (state === 'in_progress' || state === 'waiting' || state === 'joining')) {
      void this.videoCallService.completeCall(this.bookingId, 'creator');
    }

    this.connecting.set(false);
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
