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
  public calculateAnalytics(messages: Message[], bookings: CallBooking[] = []): AnalyticsData {
    if (messages.length === 0 && bookings.length === 0) {
      return this.getEmptyAnalytics();
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Filter messages for different periods
    const last30Days = messages.filter((m) => new Date(m.created_at) >= thirtyDaysAgo);
    const prev30Days = messages.filter((m) => {
      const date = new Date(m.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

    // Filter bookings for different periods
    const bookingsLast30 = bookings.filter((b) => new Date(b.created_at) >= thirtyDaysAgo);
    const bookingsPrev30 = bookings.filter((b) => {
      const date = new Date(b.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

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

    // Average response time (for messages with replies)
    const repliedMessages = messages.filter((m) => m.replied_at);
    let avgResponseTime = 0;
    if (repliedMessages.length > 0) {
      const totalResponseTime = repliedMessages.reduce((sum, m) => {
        const created = new Date(m.created_at).getTime();
        const replied = new Date(m.replied_at!).getTime();
        return sum + (replied - created);
      }, 0);
      avgResponseTime = totalResponseTime / repliedMessages.length / (1000 * 60 * 60); // Convert to hours
    }

    // Growth calculations — include booking revenue
    const currentRevenue =
      last30Days.reduce((sum, m) => sum + m.amount_paid, 0) / 100 +
      bookingsLast30.reduce((sum, b) => sum + b.amount_paid, 0) / 100;
    const prevRevenue =
      prev30Days.reduce((sum, m) => sum + m.amount_paid, 0) / 100 +
      bookingsPrev30.reduce((sum, b) => sum + b.amount_paid, 0) / 100;
    const revenueGrowth =
      prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    const currentMessages = last30Days.length;
    const prevMessages = prev30Days.length;
    const messageGrowth =
      prevMessages > 0 ? ((currentMessages - prevMessages) / prevMessages) * 100 : 0;

    // Top senders
    const senderMap = new Map<
      string,
      { name: string; email: string; totalSpent: number; messageCount: number }
    >();
    messages.forEach((m) => {
      const existing = senderMap.get(m.sender_email) || {
        name: m.sender_name,
        email: m.sender_email,
        totalSpent: 0,
        messageCount: 0,
      };
      existing.totalSpent += m.amount_paid / 100;
      existing.messageCount += 1;
      senderMap.set(m.sender_email, existing);
    });
    const topSenders = Array.from(senderMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Daily stats (last 30 days) — include booking revenue
    const dailyStats = this.calculateDailyStats(last30Days, bookingsLast30);

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

  /**
   * Calculate daily stats for the last 30 days
   */
  private calculateDailyStats(messages: Message[], bookings: CallBooking[] = []): DailyStats[] {
    const dailyMap = new Map<string, DailyStats>();

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, revenue: 0, messageCount: 0 });
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
      const type = m.message_type || 'message';
      const existing = typeMap.get(type) || { count: 0, revenue: 0 };
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
      typeMap.set('call booking', bookingData);
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
