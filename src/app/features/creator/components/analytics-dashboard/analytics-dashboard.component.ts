/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics for creators
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, OnInit, signal } from '@angular/core';
import { Message, CallBooking } from '../../../../core/models';
import { AnalyticsService, AnalyticsData } from '../../../../core/services/analytics.service';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AnalyticsDashboardComponent implements OnInit {
  public messages = input<Message[]>([]);
  public callBookings = input<CallBooking[]>([]);

  protected readonly timeRange = signal<'7d' | '30d' | 'all'>('30d');
  protected readonly analytics = signal<AnalyticsData>({
    totalRevenue: 0,
    totalMessages: 0,
    avgMessageValue: 0,
    responseRate: 0,
    avgResponseTime: 0,
    revenueGrowth: 0,
    messageGrowth: 0,
    topSenders: [],
    dailyStats: [],
    messageTypeBreakdown: [],
  });

  protected readonly projectedRevenue = computed(() =>
    this.analyticsService.getProjectedRevenue(this.messages(), this.callBookings()),
  );

  protected Math = Math;

  constructor(private readonly analyticsService: AnalyticsService) {}

  public ngOnInit(): void {
    this.updateAnalytics();
  }

  protected setTimeRange(range: '7d' | '30d' | 'all'): void {
    this.timeRange.set(range);
    this.updateAnalytics();
  }

  protected formatCurrency(value: number): string {
    return this.analyticsService.formatCurrency(value);
  }

  protected formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  protected getBarHeight(revenue: number): number {
    const maxRevenue = Math.max(...this.analytics().dailyStats.map((d) => d.revenue), 1);
    return Math.max((revenue / maxRevenue) * 100, 2);
  }

  protected getTypePercentage(count: number): number {
    const sum = this.analytics().totalMessages + this.callBookings().length;
    const total = sum !== 0 ? sum : 1;
    return (count / total) * 100;
  }

  private updateAnalytics(): void {
    const messages = this.filterMessagesByTimeRange();
    const bookings = this.filterBookingsByTimeRange();
    const analytics = this.analyticsService.calculateAnalytics(messages, bookings);
    this.analytics.set(analytics);
  }

  private filterMessagesByTimeRange(): Message[] {
    const range = this.timeRange();
    const allMessages = this.messages();

    if (range === 'all') {
      return allMessages;
    }

    const now = new Date();
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return allMessages.filter((m) => new Date(m.created_at) >= cutoff);
  }

  private filterBookingsByTimeRange(): CallBooking[] {
    const range = this.timeRange();
    const allBookings = this.callBookings();

    if (range === 'all') {
      return allBookings;
    }

    const now = new Date();
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return allBookings.filter((b) => new Date(b.created_at) >= cutoff);
  }
}
