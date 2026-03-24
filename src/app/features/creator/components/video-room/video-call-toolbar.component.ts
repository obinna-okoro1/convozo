/**
 * Video Call Toolbar — Presentational Component
 *
 * Top bar overlay during an active video call showing:
 * - Live indicator + participant name
 * - Countdown timer
 * - End/Leave button
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-video-call-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-0 left-0 right-0 z-20 flex items-center justify-between
                px-4 pt-3 pb-3
                bg-gradient-to-b from-black/80 via-black/50 to-transparent pointer-events-none">
      <!-- Left: live dot + participant name -->
      <div class="flex items-center gap-2.5">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style="background: #4ade80;"></span>
          <span class="relative inline-flex rounded-full h-2 w-2" style="background: #4ade80;"></span>
        </span>
        <span class="text-white text-sm font-medium tracking-wide">Live</span>
        <span class="w-px h-3 opacity-30" style="background: white;"></span>
        <span class="text-sm" style="color: rgba(255,255,255,0.65);">{{ otherParticipantName() }}</span>
      </div>

      <!-- Right: countdown timer + end/leave button -->
      <div class="flex items-center gap-3 pointer-events-auto">
        <!-- Countdown timer -->
        <div class="flex items-center gap-1.5 tabular-nums transition-colors duration-300"
             [style.color]="remainingSeconds() < 60 ? '#f87171' : 'rgba(255,255,255,0.85)'">
          <svg class="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-mono font-bold text-sm">{{ formattedTimeRemaining() }}</span>
        </div>

        <!-- Divider -->
        <span class="w-px h-4 opacity-25" style="background: white;"></span>

        <!-- End / Leave button -->
        <button
          (click)="endCallClicked.emit()"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                 font-semibold text-xs text-white transition-all duration-150
                 shadow-lg min-h-[2rem] hover:brightness-110"
          style="background: rgba(239,68,68,0.85); backdrop-filter: blur(0.5rem);">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24
                     1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17
                     0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          {{ isCreator() ? 'End Call' : 'Leave' }}
        </button>
      </div>
    </div>
  `,
})
export class VideoCallToolbarComponent {
  readonly otherParticipantName = input.required<string>();
  readonly remainingSeconds = input.required<number>();
  readonly formattedTimeRemaining = input.required<string>();
  readonly isCreator = input.required<boolean>();

  readonly endCallClicked = output();
}
