/**
 * Analytics Service
 * Provides analytics data and calculations for the dashboard
 */

import { Injectable, signal } from '@angular/core';
import { Message, CallBooking } from '../models';

export interface DailyStats {
  date: string;
  revenue: number;
  messageCount: number;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalMessages: number;
  avgMessageValue: number;
  responseRate: number;
  avgResponseTime: number; // in hours
  revenueGrowth: number; // percentage
  messageGrowth: number; // percentage
  topSenders: { name: string; email: string; totalSpent: number; messageCount: number }[];
  dailyStats: DailyStats[];
  messageTypeBreakdown: { type: string; count: number; revenue: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly messages = signal<Message[]>([]);

  /**
   * Update messages data
   */
  public setMessages(messages: Message[]): void {
    this.messages.set(messages);
  }

  /**
   * Calculate comprehensive analytics from messages
   */
  public calculateAnalytics(
    messages: Message[],
    bookings: CallBooking[] = [],
    viewMonth?: { year: number; month: number },
  ): AnalyticsData {
    if (messages.length === 0 && bookings.length === 0) {
      return this.getEmptyAnalytics();
    }

    // Basic stats — revenue includes both messages and call bookings
    const messageRevenue = messages.reduce((sum, m) => sum + m.amount_paid, 0) / 100;
    const bookingRevenue = bookings.reduce((sum, b) => sum + b.amount_paid, 0) / 100;
    const totalRevenue = messageRevenue + bookingRevenue;
    const totalMessages = messages.length;
    const totalItems = totalMessages + bookings.length;
    const avgMessageValue = totalItems > 0 ? totalRevenue / totalItems : 0;

    // Response stats
    const handledMessages = messages.filter((m) => m.is_handled);
    const responseRate = totalMessages > 0 ? (handledMessages.length / totalMessages) * 100 : 0;
    const avgResponseTime = this.calculateAvgResponseTime(messages);

    // Growth — only meaningful in the rolling "all" view, not when a month is pinned
    const { revenueGrowth, messageGrowth } = viewMonth
      ? { revenueGrowth: 0, messageGrowth: 0 }
      : this.calculateGrowth(messages, bookings);

    // Top senders
    const topSenders = this.calculateTopSenders(messages);

    // Daily stats: for a specific month use the pre-filtered messages so the
    // chart reflects the correct calendar days; otherwise rolling 30-day window.
    const dailyStats = this.calculateDailyStats(
      viewMonth ? messages : this.filterLast30Days(messages),
      viewMonth ? bookings : this.filterLast30Days(bookings),
      viewMonth,
    );

    // Type breakdown — includes call bookings as a separate category
    const messageTypeBreakdown = this.calculateMessageTypeBreakdown(messages, bookings);

    return {
      totalRevenue,
      totalMessages,
      avgMessageValue,
      responseRate,
      avgResponseTime,
      revenueGrowth,
      messageGrowth,
      topSenders,
      dailyStats,
      messageTypeBreakdown,
    };
  }

  /**
   * Format currency
   */
  public formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Format percentage
   */
  public formatPercentage(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  /**
   * Get projected monthly revenue
   */
  public getProjectedRevenue(messages: Message[], bookings: CallBooking[] = []): number {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();

    const messageRevenue =
      messages
        .filter((m) => new Date(m.created_at) >= startOfMonth)
        .reduce((sum, m) => sum + m.amount_paid, 0) / 100;

    const bookingRevenue =
      bookings
        .filter((b) => new Date(b.created_at) >= startOfMonth)
        .reduce((sum, b) => sum + b.amount_paid, 0) / 100;

    const monthRevenue = messageRevenue + bookingRevenue;
    return (monthRevenue / daysPassed) * daysInMonth;
  }

  /** Filters an array of date-stamped objects to those created in the last 30 days. */
  private filterLast30Days<T extends { created_at: string }>(items: T[]): T[] {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return items.filter((i) => new Date(i.created_at) >= cutoff);
  }

  /** Average hours between message creation and reply, for replied messages only. */
  private calculateAvgResponseTime(messages: Message[]): number {
    // Type predicate so TypeScript knows replied_at is a string inside the reducer
    const replied = messages.filter(
      (m): m is Message & { replied_at: string } => m.replied_at !== null,
    );
    if (replied.length === 0) {
      return 0;
    }
    const totalMs = replied.reduce((sum, m) => {
      const created = new Date(m.created_at).getTime();
      const repliedAt = new Date(m.replied_at).getTime();
      return sum + (repliedAt - created);
    }, 0);
    return totalMs / replied.length / (1000 * 60 * 60);
  }

  /**
   * Revenue and message growth: compares the last 30 days against the
   * preceding 30-day window. Returns 0 for both when there is no prior data.
   */
  private calculateGrowth(
    messages: Message[],
    bookings: CallBooking[],
  ): { revenueGrowth: number; messageGrowth: number } {
    const now = Date.now();
    const t30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const t60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const last30Msgs = messages.filter((m) => new Date(m.created_at) >= t30);
    const prev30Msgs = messages.filter((m) => {
      const d = new Date(m.created_at);
      return d >= t60 && d < t30;
    });
    const last30Book = bookings.filter((b) => new Date(b.created_at) >= t30);
    const prev30Book = bookings.filter((b) => {
      const d = new Date(b.created_at);
      return d >= t60 && d < t30;
    });

    const curRev =
      last30Msgs.reduce((s, m) => s + m.amount_paid, 0) / 100 +
      last30Book.reduce((s, b) => s + b.amount_paid, 0) / 100;
    const prevRev =
      prev30Msgs.reduce((s, m) => s + m.amount_paid, 0) / 100 +
      prev30Book.reduce((s, b) => s + b.amount_paid, 0) / 100;

    const revenueGrowth = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : 0;
    const messageGrowth =
      prev30Msgs.length > 0
        ? ((last30Msgs.length - prev30Msgs.length) / prev30Msgs.length) * 100
        : 0;

    return { revenueGrowth, messageGrowth };
  }

  /** Top 5 senders by total amount spent. */
  private calculateTopSenders(
    messages: Message[],
  ): { name: string; email: string; totalSpent: number; messageCount: number }[] {
    const senderMap = new Map<
      string,
      { name: string; email: string; totalSpent: number; messageCount: number }
    >();
    messages.forEach((m) => {
      const existing = senderMap.get(m.sender_email) ?? {
        name: m.sender_name,
        email: m.sender_email,
        totalSpent: 0,
        messageCount: 0,
      };
      existing.totalSpent += m.amount_paid / 100;
      existing.messageCount += 1;
      senderMap.set(m.sender_email, existing);
    });
    return Array.from(senderMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);
  }

  /**
   * Calculate daily stats for the last 30 days
   */
  private calculateDailyStats(
    messages: Message[],
    bookings: CallBooking[] = [],
    viewMonth?: { year: number; month: number },
  ): DailyStats[] {
    const dailyMap = new Map<string, DailyStats>();

    if (viewMonth) {
      // Initialise every day of the selected calendar month
      const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${String(viewMonth.year)}-${String(viewMonth.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, messageCount: 0 });
      }
    } else {
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, messageCount: 0 });
      }
    }

    // Populate with message data
    messages.forEach((m) => {
      const dateStr = new Date(m.created_at).toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.revenue += m.amount_paid / 100;
        existing.messageCount += 1;
      }
    });

    // Add booking revenue
    bookings.forEach((b) => {
      const dateStr = new Date(b.created_at).toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.revenue += b.amount_paid / 100;
        existing.messageCount += 1;
      }
    });

    return Array.from(dailyMap.values());
  }

  /**
   * Calculate message type breakdown
   */
  private calculateMessageTypeBreakdown(
    messages: Message[],
    bookings: CallBooking[] = [],
  ): { type: string; count: number; revenue: number }[] {
    const typeMap = new Map<string, { count: number; revenue: number }>();

    messages.forEach((m) => {
      const type = m.message_type;
      const existing = typeMap.get(type) ?? { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += m.amount_paid / 100;
      typeMap.set(type, existing);
    });

    // Add call bookings as their own category
    if (bookings.length > 0) {
      const bookingData = {
        count: bookings.length,
        revenue: bookings.reduce((sum, b) => sum + b.amount_paid, 0) / 100,
      };
      typeMap.set('session', bookingData);
    }

    return Array.from(typeMap.entries()).map(([type, data]) => ({ type, ...data }));
  }

  /**
   * Get empty analytics object
   */
  private getEmptyAnalytics(): AnalyticsData {
    return {
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
    };
  }
}
