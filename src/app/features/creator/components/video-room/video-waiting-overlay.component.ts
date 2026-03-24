/**
 * Video Waiting Overlay — Presentational Component
 *
 * Full-screen overlay shown while waiting for the other participant to join.
 * Displays animated avatar ring, call duration info, and a leave button.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-video-waiting-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
          {{ callDuration() }}-minute call
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
          (click)="leaveClicked.emit()"
          class="text-sm font-medium transition-all duration-200 px-5 py-2.5 rounded-xl
                 min-h-[2.75rem] hover:text-white/70 hover:bg-white/[0.09]"
          style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05);
                 border: 1px solid rgba(255,255,255,0.09);">
          Leave
        </button>
      </div>
    </div>
  `,
})
export class VideoWaitingOverlayComponent {
  readonly otherParticipantName = input.required<string>();
  readonly callDuration = input<number | undefined>();

  readonly leaveClicked = output();
}
