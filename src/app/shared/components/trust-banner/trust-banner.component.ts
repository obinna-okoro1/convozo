/**
 * Trust Banner Component
 * Displays payment security and delivery trust indicators.
 * Reused across message and call booking forms.
 */

import { Component } from '@angular/core';

@Component({
  selector: 'app-trust-banner',
  standalone: true,
  template: `
    <div class="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4">
      <div class="flex items-center justify-center gap-6 flex-wrap">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-emerald-300">100% Secure Payment</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-blue-300">Direct Delivery</span>
        </div>
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-purple-300">Instant Delivery</span>
        </div>
      </div>
    </div>
  `,
})
export class TrustBannerComponent {}
