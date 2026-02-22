/**
 * Creator Profile Header Component
 * Displays the creator's avatar, name, bio, and status.
 * Used on the public message page.
 */

import { Component, input, computed } from '@angular/core';
import { CreatorProfile } from '../../../../core/models';

@Component({
  selector: 'app-creator-profile-header',
  standalone: true,
  template: `
    <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-all duration-500">
      <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
        <!-- Avatar with glow effect -->
        <div class="relative group">
          @if (creator().profile_image_url) {
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300 animate-pulse-slow"></div>
            <img
              [src]="creator().profile_image_url!"
              [alt]="creator().display_name"
              class="relative w-32 h-32 rounded-full border-4 border-white/20 shadow-2xl object-cover ring-2 ring-purple-500/50 group-hover:scale-105 transition-transform duration-300"
            />
          } @else {
            <div class="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
            <div class="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center border-4 border-white/20 shadow-2xl ring-2 ring-purple-500/50 group-hover:scale-105 transition-transform duration-300">
              <span class="text-white font-bold text-4xl">{{ initial() }}</span>
            </div>
          }
          <!-- Verified badge -->
          <div class="absolute -bottom-1 -right-1 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full p-1.5 shadow-lg border-2 border-slate-900">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>

        <div class="flex-1 text-center md:text-left">
          <div class="flex items-center justify-center md:justify-start gap-3 mb-2">
            <h1 class="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              {{ creator().display_name }}
            </h1>
            <span class="px-3 py-1 bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold rounded-full backdrop-blur-sm">
              PRO
            </span>
          </div>

          @if (creator().bio) {
            <p class="text-lg text-slate-300 max-w-2xl mb-4 leading-relaxed">{{ creator().bio }}</p>
          }

          <!-- Stats row -->
          <div class="flex items-center justify-center md:justify-start gap-6 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span class="text-slate-400">Active now</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              <span class="text-slate-400">Replies in {{ responseExpectation() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CreatorProfileHeaderComponent {
  readonly creator = input.required<CreatorProfile>();
  readonly responseExpectation = input<string>('24-48 hours');

  protected readonly initial = computed(() => {
    const name = this.creator()?.display_name;
    return name ? name.charAt(0) : 'C';
  });
}
