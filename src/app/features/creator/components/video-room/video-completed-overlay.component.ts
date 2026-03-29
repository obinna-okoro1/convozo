/**
 * Video Completed Overlay — Presentational Component
 *
 * Shown after a call completes. Displays duration summary,
 * payout status (for creators), and a navigation button.
 */

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CompleteCallResponse } from '@core/models';

@Component({
  selector: 'app-video-completed-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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

        @if (completionResult(); as result) {
          <div class="rounded-2xl p-5 mb-7 text-left space-y-3.5"
               style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);">
            <div class="flex justify-between items-center text-sm">
              <span style="color: rgba(255,255,255,0.45);">Duration</span>
              <span class="font-semibold" style="color: #fff;">
                {{ formatDuration(result.actual_duration_seconds) }}
              </span>
            </div>
            <div class="h-px" style="background: rgba(255,255,255,0.06);"></div>
            <div class="flex justify-between items-center text-sm">
              <span style="color: rgba(255,255,255,0.45);">Booked</span>
              <span class="font-semibold" style="color: #fff;">
                {{ formatDuration(result.booked_duration_seconds) }}
              </span>
            </div>
            @if (isCreator()) {
              <div class="h-px" style="background: rgba(255,255,255,0.06);"></div>
              <div class="flex justify-between items-center text-sm">
                <span style="color: rgba(255,255,255,0.45);">Payout</span>
                <span class="font-semibold flex items-center gap-1.5"
                      [style.color]="result.payout_released ? '#4ade80' : '#fbbf24'">
                  @if (result.payout_released) {
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
          (click)="goBackClicked.emit()"
          class="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
          style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);">
          {{ isCreator() ? 'Back to Profile' : 'Done' }}
        </button>
      </div>
    </div>
  `,
})
export class VideoCompletedOverlayComponent {
  readonly completionResult = input<CompleteCallResponse | null>(null);
  readonly isCreator = input.required<boolean>();

  readonly goBackClicked = output();

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }
}
