/**
 * Social Proof Component
 * Displays social proof metrics to build trust with potential message senders
 */

import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SocialProofData {
  totalMessages: number;
  responseRate: number;
  avgResponseTime: number; // in hours
  totalEarnings?: number;
  verifiedCreator?: boolean;
  joinedDate?: string;
  instagramFollowers?: number;
}

@Component({
  selector: 'app-social-proof',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Trust Badges -->
      <div class="flex flex-wrap gap-2">
        @if (data().verifiedCreator) {
          <div class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Verified Creator
          </div>
        }
        
        @if (responseRating() === 'excellent') {
          <div class="flex items-center gap-1.5 px-3 py-1.5 bg-success-50 text-success-700 rounded-full text-sm font-medium">
            <span>⚡</span>
            Fast Responder
          </div>
        }

        @if (data().totalMessages >= 100) {
          <div class="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
            <span>🏆</span>
            Top Creator
          </div>
        }
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-3 gap-3">
        <!-- Messages Received -->
        <div class="bg-neutral-50 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-neutral-900">{{ formatNumber(data().totalMessages) }}</div>
          <div class="text-xs text-neutral-500">Messages</div>
        </div>

        <!-- Response Rate -->
        <div class="bg-neutral-50 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold" [class]="responseRateColor()">{{ data().responseRate.toFixed(0) }}%</div>
          <div class="text-xs text-neutral-500">Response Rate</div>
        </div>

        <!-- Avg Response Time -->
        <div class="bg-neutral-50 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-neutral-900">{{ formatResponseTime() }}</div>
          <div class="text-xs text-neutral-500">Avg. Response</div>
        </div>
      </div>

      <!-- Response Time Indicator -->
      <div class="bg-neutral-50 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-neutral-700">Response Speed</span>
          <span class="text-xs px-2 py-1 rounded-full" [class]="responseBadgeClass()">
            {{ responseRating() | titlecase }}
          </span>
        </div>
        <div class="h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500"
            [class]="responseBarClass()"
            [style.width.%]="responseBarWidth()"
          ></div>
        </div>
        <p class="text-xs text-neutral-500 mt-2">
          {{ responseDescription() }}
        </p>
      </div>

      <!-- Trust Indicators -->
      @if (data().instagramFollowers) {
        <div class="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
            </svg>
          </div>
          <div>
            <div class="font-semibold text-neutral-900">{{ formatFollowers(data().instagramFollowers!) }} followers</div>
            <div class="text-xs text-neutral-500">on Instagram</div>
          </div>
        </div>
      }

      <!-- Member Since -->
      @if (data().joinedDate) {
        <div class="text-center text-xs text-neutral-400">
          Member since {{ formatJoinDate(data().joinedDate!) }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SocialProofComponent {
  data = input<SocialProofData>({
    totalMessages: 0,
    responseRate: 0,
    avgResponseTime: 24,
  });

  // Computed values
  protected readonly responseRating = computed(() => {
    const hours = this.data().avgResponseTime;
    if (hours <= 2) return 'excellent';
    if (hours <= 8) return 'fast';
    if (hours <= 24) return 'good';
    if (hours <= 48) return 'average';
    return 'slow';
  });

  protected readonly responseRateColor = computed(() => {
    const rate = this.data().responseRate;
    if (rate >= 90) return 'text-success-600';
    if (rate >= 70) return 'text-warning-600';
    return 'text-neutral-600';
  });

  protected readonly responseBadgeClass = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent': return 'bg-success-100 text-success-700';
      case 'fast': return 'bg-blue-100 text-blue-700';
      case 'good': return 'bg-primary-100 text-primary-700';
      case 'average': return 'bg-warning-100 text-warning-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  });

  protected readonly responseBarClass = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent': return 'bg-success-500';
      case 'fast': return 'bg-blue-500';
      case 'good': return 'bg-primary-500';
      case 'average': return 'bg-warning-500';
      default: return 'bg-neutral-400';
    }
  });

  protected readonly responseBarWidth = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent': return 100;
      case 'fast': return 85;
      case 'good': return 70;
      case 'average': return 50;
      default: return 30;
    }
  });

  protected readonly responseDescription = computed(() => {
    const rating = this.responseRating();
    const hours = this.data().avgResponseTime;
    switch (rating) {
      case 'excellent': return `Typically responds in under ${Math.ceil(hours)} hours`;
      case 'fast': return `Usually responds within ${Math.ceil(hours)} hours`;
      case 'good': return `Responds within 24 hours`;
      case 'average': return `Usually responds within 2 days`;
      default: return `May take a few days to respond`;
    }
  });

  formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  }

  formatFollowers(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }

  formatResponseTime(): string {
    const hours = this.data().avgResponseTime;
    if (hours < 1) return '<1h';
    if (hours < 24) return `${Math.ceil(hours)}h`;
    const days = Math.ceil(hours / 24);
    return `${days}d`;
  }

  formatJoinDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}
