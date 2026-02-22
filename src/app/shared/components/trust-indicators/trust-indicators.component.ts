/**
 * Trust Indicators Component
 * Displays encryption, Stripe, and privacy indicators at the bottom of forms.
 * Reused across message and call booking forms.
 */

import { Component } from '@angular/core';

@Component({
  selector: 'app-trust-indicators',
  standalone: true,
  template: `
    <div class="mt-6 pt-6 border-t border-white/10">
      <div class="flex items-center justify-center gap-8 flex-wrap text-sm">
        <div class="flex items-center gap-2 text-emerald-300">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="font-medium">256-bit Encryption</span>
        </div>
        <div class="flex items-center gap-2 text-blue-300">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="font-medium">Powered by Stripe</span>
        </div>
        <div class="flex items-center gap-2 text-purple-300">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
          </svg>
          <span class="font-medium">Private &amp; Confidential</span>
        </div>
      </div>
    </div>
  `,
})
export class TrustIndicatorsComponent {}
