/**
 * Message Form Component
 * Handles the paid message submission form on the public message page.
 * Contains pricing card, sender fields, message textarea, and submit button.
 */

import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrustIndicatorsComponent } from '../../../../shared/components/trust-indicators/trust-indicators.component';
import { APP_CONSTANTS } from '../../../../core/constants';

export interface MessageFormData {
  senderName: string;
  senderEmail: string;
  senderInstagram: string;
  messageContent: string;
}

@Component({
  selector: 'app-message-form',
  standalone: true,
  imports: [FormsModule, TrustIndicatorsComponent],
  template: `
    <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
      <form (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Message Price Display -->
        <div class="mb-8 text-center">
          <div class="inline-block relative">
            <div class="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-30 animate-pulse-slow"></div>
            <div class="relative bg-gradient-to-br from-purple-600 to-pink-600 px-10 py-6 rounded-3xl shadow-2xl border border-purple-400/20">
              <div class="text-sm text-purple-100 mb-2 font-medium uppercase tracking-wider">Priority Message</div>
              <div class="flex items-baseline justify-center gap-2">
                <span class="text-5xl font-bold text-white">\${{ priceInDollars() }}</span>
                <span class="text-purple-200 text-lg">per message</span>
              </div>
              <div class="mt-3 flex items-center justify-center gap-2 text-purple-100 text-sm">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                </svg>
                <span>Response within {{ responseExpectation() }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sender Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
              <span>Your Name</span>
              <span class="text-pink-400">*</span>
            </label>
            <input
              type="text"
              [(ngModel)]="senderName"
              name="senderName"
              placeholder="Enter your name"
              class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <span>Your Email</span>
              <span class="text-pink-400">*</span>
            </label>
            <input
              type="email"
              [(ngModel)]="senderEmail"
              name="senderEmail"
              placeholder="you&#64;example.com"
              class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
              required
            />
          </div>
        </div>

        <!-- Instagram Handle -->
        <div>
          <label class="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            <span>Instagram Handle</span>
            <span class="text-slate-500 text-xs font-normal">(optional)</span>
          </label>
          <div class="relative">
            <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-base font-medium">&#64;</span>
            <input
              type="text"
              [(ngModel)]="senderInstagram"
              name="senderInstagram"
              placeholder="your_username"
              class="w-full pl-10 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
            />
          </div>
        </div>

        <!-- Message Content -->
        <div>
          <label class="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd" />
            </svg>
            <span>Your Message</span>
            <span class="text-pink-400">*</span>
          </label>
          <textarea
            [(ngModel)]="messageContent"
            name="messageContent"
            placeholder="Share your thoughts, questions, or feedback..."
            rows="6"
            maxlength="1000"
            class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10 resize-none"
            required
          ></textarea>
          <div class="flex justify-between items-center mt-3">
            <p class="text-xs text-slate-400 flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Sent directly to {{ creatorName() }}'s inbox</span>
            </p>
            <p class="text-xs font-medium"
               [class.text-pink-400]="charCount() > 900"
               [class.text-slate-400]="charCount() <= 900">
              {{ charCount() }}/1000
            </p>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          [disabled]="submitting()"
          class="relative w-full group overflow-hidden"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] animate-gradient"></div>
          <div class="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-white/20 to-purple-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <div class="relative px-8 py-5 flex items-center justify-center gap-3 rounded-2xl border-2 border-white/20">
            @if (submitting()) {
              <svg class="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-white font-bold text-lg">Processing Payment...</span>
            } @else {
              <svg class="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span class="text-white font-bold text-lg">Pay \${{ priceInDollars() }} &amp; Send Message</span>
              <svg class="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            }
          </div>
        </button>

        <app-trust-indicators />
      </form>
    </div>
  `,
})
export class MessageFormComponent {
  readonly priceCents = input.required<number>();
  readonly creatorName = input.required<string>();
  readonly responseExpectation = input<string>('24-48 hours');
  readonly submitting = input<boolean>(false);

  readonly formSubmit = output<MessageFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected senderInstagram = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(() =>
    (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER
  );

  protected readonly charCount = computed(() => this.messageContent.length);

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      senderInstagram: this.senderInstagram.replace(/^@/, ''),
      messageContent: this.messageContent,
    });
  }
}
