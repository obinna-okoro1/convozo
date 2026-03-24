/**
 * Video Status Overlay — Presentational Component
 *
 * Renders loading, connecting, ending, and error overlays for the video call.
 * Consolidates four simple overlay states into a single reusable component.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export type VideoOverlayStatus = 'loading' | 'connecting' | 'ending' | 'error';

@Component({
  selector: 'app-video-status-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('connecting') {
        <div class="fixed inset-0 z-40 flex items-center justify-center"
             style="background: rgba(10,10,10,0.85); backdrop-filter: blur(1rem);
                    animation: fadeIn 200ms ease-out;">
          <div class="text-center">
            <div class="relative w-16 h-16 mx-auto mb-5">
              <div class="absolute inset-0 rounded-full animate-spin"
                   style="background: conic-gradient(from 0deg, transparent 0%, #4ade80 60%, #22d3ee 100%);
                          mask: radial-gradient(farthest-side, transparent 62%, black 63%);
                          -webkit-mask: radial-gradient(farthest-side, transparent 62%, black 63%);
                          animation-duration: 0.8s;"></div>
              <div class="absolute inset-[0.25rem] rounded-full flex items-center justify-center"
                   style="background: #0a0a0a;">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                     style="color: #4ade80;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </div>
            </div>
            <p class="text-base font-semibold" style="color: #4ade80;">Connected</p>
            <p class="text-xs mt-1" style="color: rgba(255,255,255,0.4);">Starting call…</p>
          </div>
        </div>
      }

      @case ('loading') {
        <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #0a0a0a;">
          <div class="text-center">
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

      @case ('error') {
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
              {{ errorMessage() }}
            </p>
            <button
              (click)="actionClicked.emit()"
              class="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
              style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);">
              Go Back
            </button>
          </div>
        </div>
      }

      @case ('ending') {
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
    }
  `,
})
export class VideoStatusOverlayComponent {
  readonly status = input.required<VideoOverlayStatus>();
  readonly errorMessage = input<string | null>();

  readonly actionClicked = output();
}
