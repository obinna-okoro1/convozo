/**
 * Call Booking Form Component
 * Handles the paid call booking form on the public message page.
 * Contains pricing, availability display, contact fields, and submit button.
 */

import { Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrustIndicatorsComponent } from '../../../../shared/components/trust-indicators/trust-indicators.component';
import { AvailabilitySlot } from '../../../../core/models';
import { APP_CONSTANTS } from '../../../../core/constants';

export interface CallBookingFormData {
  senderName: string;
  senderEmail: string;
  instagramHandle: string;
  messageContent: string;
}

interface AvailabilityByDay {
  day: string;
  slots: { start: string; end: string }[];
}

@Component({
  selector: 'app-call-booking-form',
  standalone: true,
  imports: [FormsModule, TrustIndicatorsComponent],
  template: `
    <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
      <!-- Call Header -->
      <div class="flex items-center gap-4 mb-8">
        <div class="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/50">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 class="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">Book a Video Call</h2>
          <p class="text-slate-400 text-sm mt-0.5">Get {{ callDuration() }} minutes of 1-on-1 time with {{ creatorName() }}</p>
        </div>
      </div>

      <form (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Call Pricing Card -->
        <div class="mb-8 text-center">
          <div class="inline-block relative">
            <div class="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-30 animate-pulse-slow"></div>
            <div class="relative bg-gradient-to-br from-purple-600 to-pink-600 px-10 py-6 rounded-3xl shadow-2xl border border-purple-400/20">
              <div class="text-sm text-purple-100 mb-2 font-medium uppercase tracking-wider">1-on-1 Video Call</div>
              <div class="flex items-baseline justify-center gap-2">
                <span class="text-5xl font-bold text-white">\${{ priceInDollars() }}</span>
                <span class="text-purple-200 text-lg">/ {{ callDuration() }} min</span>
              </div>
              <div class="mt-3 flex items-center justify-center gap-2 text-purple-100 text-sm">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span>Instant Confirmation</span>
              </div>
            </div>
          </div>
        </div>

        <!-- What's Included -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
          <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-all duration-300">
            <div class="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-white font-semibold text-sm">{{ callDuration() }}-min Call</p>
            <p class="text-slate-400 text-xs mt-1">Private video session</p>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-all duration-300">
            <div class="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-white font-semibold text-sm">Flexible Scheduling</p>
            <p class="text-slate-400 text-xs mt-1">Pick a time that works</p>
          </div>
          <div class="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-all duration-300">
            <div class="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p class="text-white font-semibold text-sm">100% Secure</p>
            <p class="text-slate-400 text-xs mt-1">Secure checkout</p>
          </div>
        </div>

        <!-- How it works -->
        <div class="p-5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 backdrop-blur-2xl rounded-2xl">
          <div class="flex gap-4">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-bold text-white text-sm mb-1">How it works</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 bg-blue-500/30 rounded-full flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">1</span>
                  <p class="text-blue-200/80 text-sm">Submit your info &amp; complete payment</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 bg-blue-500/30 rounded-full flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">2</span>
                  <p class="text-blue-200/80 text-sm">{{ creatorName() }} contacts you on Instagram to schedule</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 bg-blue-500/30 rounded-full flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">3</span>
                  <p class="text-blue-200/80 text-sm">Enjoy your private {{ callDuration() }}-minute video call!</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Availability Schedule -->
        @if (availabilityByDay().length > 0) {
          <div class="p-5 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="font-bold text-white text-sm">Available Times</p>
                <p class="text-slate-500 text-xs">{{ creatorName() }}'s weekly schedule</p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              @for (day of availabilityByDay(); track day.day) {
                <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all duration-200">
                  <div class="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                    <span class="text-[10px] font-extrabold text-white uppercase">{{ day.day.substring(0, 2) }}</span>
                  </div>
                  <div class="flex flex-wrap gap-x-3 gap-y-1">
                    @for (slot of day.slots; track $index) {
                      <span class="text-xs text-slate-300 font-medium bg-white/5 px-2 py-0.5 rounded-md">{{ slot.start }} – {{ slot.end }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Contact Info -->
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
              placeholder="John Doe"
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
            <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
            </svg>
            <span>Your Instagram Handle</span>
            <span class="text-pink-400">*</span>
          </label>
          <div class="flex items-center gap-3">
            <span class="text-purple-400 text-xl font-bold">&#64;</span>
            <input
              type="text"
              [(ngModel)]="instagramHandle"
              name="instagramHandle"
              placeholder="yourhandle"
              class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
              required
            />
          </div>
          <p class="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            {{ creatorName() }} will DM you here to schedule
          </p>
        </div>

        <!-- Optional Message -->
        <div>
          <label class="block text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd" />
            </svg>
            <span>Message / Preferred Time</span>
            <span class="text-xs text-slate-500 font-normal ml-1">(Optional)</span>
          </label>
          <textarea
            [(ngModel)]="messageContent"
            name="messageContent"
            [placeholder]="'Let ' + creatorName() + ' know your preferred days/times or topics to discuss...'"
            rows="4"
            class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm hover:bg-white/10 resize-none"
            maxlength="1000"
          ></textarea>
          <div class="flex justify-between text-xs mt-2">
            <span class="text-slate-500">Helps with scheduling your call</span>
            <span class="text-slate-500">{{ messageContent.length }} / 1000</span>
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span class="text-white font-bold text-lg">Book Call — \${{ priceInDollars() }}</span>
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
export class CallBookingFormComponent {
  readonly priceCents = input.required<number>();
  readonly callDuration = input.required<number>();
  readonly creatorName = input.required<string>();
  readonly availabilitySlots = input<AvailabilitySlot[]>([]);
  readonly submitting = input<boolean>(false);

  readonly formSubmit = output<CallBookingFormData>();

  protected senderName = '';
  protected senderEmail = '';
  protected instagramHandle = '';
  protected messageContent = '';

  protected readonly priceInDollars = computed(() =>
    (this.priceCents() ?? 0) / APP_CONSTANTS.PRICE_MULTIPLIER
  );

  protected readonly availabilityByDay = computed<AvailabilityByDay[]>(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = new Map<number, { start: string; end: string }[]>();

    for (const slot of this.availabilitySlots()) {
      if (!grouped.has(slot.day_of_week)) {
        grouped.set(slot.day_of_week, []);
      }
      grouped.get(slot.day_of_week)!.push({
        start: this.formatTime(slot.start_time),
        end: this.formatTime(slot.end_time),
      });
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, slots]) => ({ day: dayNames[day], slots }));
  });

  protected onSubmit(): void {
    this.formSubmit.emit({
      senderName: this.senderName,
      senderEmail: this.senderEmail,
      instagramHandle: this.instagramHandle,
      messageContent: this.messageContent,
    });
  }

  private formatTime(time: string): string {
    const [hours, minutes] = time.substring(0, 5).split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
