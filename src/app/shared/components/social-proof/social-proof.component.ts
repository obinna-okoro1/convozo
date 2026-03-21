/**
 * Social Proof Component
 * Displays social proof metrics to build trust with potential message senders
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';

export interface SocialProofData {
  totalMessages: number;
  responseRate: number;
  avgResponseTime: number; // in hours
  totalEarnings?: number;
  verifiedCreator?: boolean;
  joinedDate?: string;
}

@Component({
  selector: 'app-social-proof',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-proof.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SocialProofComponent {
  public data = input<SocialProofData>({
    totalMessages: 0,
    responseRate: 0,
    avgResponseTime: 24,
  });

  // Computed values
  protected readonly responseRating = computed(() => {
    const hours = this.data().avgResponseTime;
    if (hours <= 2) {
      return 'excellent';
    }
    if (hours <= 8) {
      return 'fast';
    }
    if (hours <= 24) {
      return 'good';
    }
    if (hours <= 48) {
      return 'average';
    }
    return 'slow';
  });

  protected readonly responseRateColor = computed(() => {
    const rate = this.data().responseRate;
    if (rate >= 90) {
      return 'text-success-600';
    }
    if (rate >= 70) {
      return 'text-warning-600';
    }
    return 'text-neutral-600';
  });

  protected readonly responseBadgeClass = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent':
        return 'bg-success-100 text-success-700';
      case 'fast':
        return 'bg-blue-100 text-blue-700';
      case 'good':
        return 'bg-primary-100 text-primary-700';
      case 'average':
        return 'bg-warning-100 text-warning-700';
      case 'slow':
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  });

  protected readonly responseBarClass = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent':
        return 'bg-success-500';
      case 'fast':
        return 'bg-blue-500';
      case 'good':
        return 'bg-primary-500';
      case 'average':
        return 'bg-warning-500';
      case 'slow':
      default:
        return 'bg-neutral-400';
    }
  });

  protected readonly responseBarWidth = computed(() => {
    const rating = this.responseRating();
    switch (rating) {
      case 'excellent':
        return 100;
      case 'fast':
        return 85;
      case 'good':
        return 70;
      case 'average':
        return 50;
      case 'slow':
      default:
        return 30;
    }
  });

  protected readonly responseDescription = computed(() => {
    const rating = this.responseRating();
    const hours = this.data().avgResponseTime;
    switch (rating) {
      case 'excellent':
        return `Typically responds in under ${String(Math.ceil(hours))} hours`;
      case 'fast':
        return `Usually responds within ${String(Math.ceil(hours))} hours`;
      case 'good':
        return `Responds within 24 hours`;
      case 'average':
        return `Usually responds within 2 days`;
      case 'slow':
      default:
        return `May take a few days to respond`;
    }
  });

  public formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  }

  public formatFollowers(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }

  public formatResponseTime(): string {
    const hours = this.data().avgResponseTime;
    if (hours < 1) {
      return '<1h';
    }
    if (hours < 24) {
      return `${String(Math.ceil(hours))}h`;
    }
    const days = Math.ceil(hours / 24);
    return `${String(days)}d`;
  }

  public formatJoinDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}
