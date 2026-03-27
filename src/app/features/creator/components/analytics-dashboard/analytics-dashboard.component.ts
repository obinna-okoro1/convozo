/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics for creators
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, OnInit, signal } from '@angular/core';
import { Message, CallBooking, CreatorMonthlyAnalytics } from '../../../../core/models';
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
  /** Retained monthly analytics from the DB — immune to message/booking deletions. */
  public monthlyAnalytics = input<CreatorMonthlyAnalytics[]>([]);

  /**
   * Selected filter: 'all' or a 'YYYY-MM' month key (e.g. '2026-03').
   * Drives both the inbox filter for live stats and the refund scoping.
   */
  protected readonly selectedFilter = signal<string>('all');

  /** Last 6 calendar months + "All time" option for the dropdown. */
  protected readonly monthOptions = computed<{ value: string; label: string }[]>(() => {
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'All time' }];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  });

  /** Human-readable label for the currently selected period. */
  protected readonly selectedLabel = computed<string>(
    () => this.monthOptions().find((o) => o.value === this.selectedFilter())?.label ?? 'All time',
  );

  /** Retained DB row for the selected month, or null when 'All time' is selected. */
  protected readonly selectedMonthRow = computed<CreatorMonthlyAnalytics | null>(() => {
    const filter = this.selectedFilter();
    if (filter === 'all') {
      return null;
    }
    // DB stores month as first-of-month date string: 'YYYY-MM-01'
    return this.monthlyAnalytics().find((r) => r.month === `${filter}-01`) ?? null;
  });

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

  // ── Refund aggregates — scoped to the selected month (or all months for 'all') ───
  protected readonly refundRows = computed<CreatorMonthlyAnalytics[]>(() => {
    const filter = this.selectedFilter();
    if (filter === 'all') {
      return this.monthlyAnalytics();
    }
    const row = this.selectedMonthRow();
    return row !== null ? [row] : [];
  });

  protected readonly totalRefundsAmount = computed<number>(
    () => this.refundRows().reduce((sum, r) => sum + r.total_refunds, 0) / 100,
  );

  protected readonly totalRefundCount = computed<number>(() =>
    this.refundRows().reduce(
      (sum, r) =>
        sum +
        r.message_refund_count +
        r.support_refund_count +
        r.call_refund_count +
        r.shop_refund_count,
      0,
    ),
  );

  protected readonly hasRefunds = computed<boolean>(() => this.totalRefundsAmount() > 0);

  protected readonly refundBreakdown = computed(() => [
    {
      label: 'Messages',
      count: this.refundRows().reduce((s, r) => s + r.message_refund_count, 0),
      amount: this.refundRows().reduce((s, r) => s + r.message_refund_amount, 0) / 100,
    },
    {
      label: 'Donations',
      count: this.refundRows().reduce((s, r) => s + r.support_refund_count, 0),
      amount: this.refundRows().reduce((s, r) => s + r.support_refund_amount, 0) / 100,
    },
    {
      label: 'Sessions',
      count: this.refundRows().reduce((s, r) => s + r.call_refund_count, 0),
      amount: this.refundRows().reduce((s, r) => s + r.call_refund_amount, 0) / 100,
    },
    {
      label: 'Shop',
      count: this.refundRows().reduce((s, r) => s + r.shop_refund_count, 0),
      amount: this.refundRows().reduce((s, r) => s + r.shop_refund_amount, 0) / 100,
    },
  ]);

  protected Math = Math;

  /**
   * Gross revenue from retained DB rows — immune to deletions.
   * Null when no monthly rows exist yet (new creator); falls back to live calc.
   */
  protected readonly retainedRevenue = computed<number | null>(() => {
    const rows = this.refundRows();
    if (rows.length === 0) {
      return null;
    }
    return rows.reduce((sum, r) => sum + r.total_gross, 0) / 100;
  });

  /** Creator net revenue (after 22% platform fee) from retained DB rows. */
  protected readonly retainedNetRevenue = computed<number | null>(() => {
    const rows = this.refundRows();
    if (rows.length === 0) {
      return null;
    }
    return rows.reduce((sum, r) => sum + r.total_net, 0) / 100;
  });

  /**
   * Per-stream breakdown (messages / calls / shop) from retained DB rows.
   * Immune to deletions. Null when no rows exist — template falls back to live calc.
   */
  protected readonly retainedTypeBreakdown = computed<
    { type: string; count: number; revenue: number }[] | null
  >(() => {
    const rows = this.refundRows();
    if (rows.length === 0) {
      return null;
    }
    const msgs = {
      type: 'Messages',
      count: rows.reduce((s, r) => s + r.message_count, 0),
      revenue: rows.reduce((s, r) => s + r.message_gross, 0) / 100,
    };
    const donations = {
      type: 'Donations',
      count: rows.reduce((s, r) => s + r.support_count, 0),
      revenue: rows.reduce((s, r) => s + r.support_gross, 0) / 100,
    };
    const calls = {
      type: 'Sessions',
      count: rows.reduce((s, r) => s + r.call_count, 0),
      revenue: rows.reduce((s, r) => s + r.call_gross, 0) / 100,
    };
    const shop = {
      type: 'Shop',
      count: rows.reduce((s, r) => s + r.shop_order_count, 0),
      revenue: rows.reduce((s, r) => s + r.shop_gross, 0) / 100,
    };
    // Only include streams that have activity
    return [msgs, donations, calls, shop].filter((s) => s.count > 0);
  });

  /**
   * Month-over-month growth derived from retained DB rows.
   * Compares the selected month against the preceding month's retained row.
   * For 'all' view, falls back to the live growth calculation.
   * Null when insufficient retained data for comparison.
   */
  protected readonly retainedGrowth = computed<{
    revenueGrowth: number;
    messageGrowth: number;
  } | null>(() => {
    const filter = this.selectedFilter();
    const allRows = this.monthlyAnalytics();
    if (allRows.length < 2 || filter === 'all') {
      return null;
    }
    const currentRow = this.selectedMonthRow();
    if (!currentRow) {
      return null;
    }
    // Find the row for the preceding calendar month
    const [cy, cm] = currentRow.month.split('-').map(Number);
    const prevDate = new Date(cy, cm - 2, 1); // month is 1-based, subtract 2 for prev
    const prevKey = `${String(prevDate.getFullYear())}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
    const prevRow = allRows.find((r) => r.month === prevKey);
    if (!prevRow) {
      return null;
    }
    const revenueGrowth =
      prevRow.total_gross === 0
        ? 0
        : ((currentRow.total_gross - prevRow.total_gross) / prevRow.total_gross) * 100;
    const prevCount = prevRow.message_count + prevRow.call_count + prevRow.shop_order_count;
    const currCount =
      currentRow.message_count + currentRow.call_count + currentRow.shop_order_count;
    const messageGrowth = prevCount === 0 ? 0 : ((currCount - prevCount) / prevCount) * 100;
    return { revenueGrowth, messageGrowth };
  });

  constructor(private readonly analyticsService: AnalyticsService) {}

  public ngOnInit(): void {
    this.updateAnalytics();
  }

  /** Bar width for the type breakdown — computed from retained rows only. */
  protected getRetainedTypePercentage(count: number): number {
    const breakdown = this.retainedTypeBreakdown();
    if (!breakdown) {
      return 0;
    }
    const total = breakdown.reduce((s, t) => s + t.count, 0);
    return total > 0 ? (count / total) * 100 : 0;
  }

  protected onFilterChange(value: string): void {
    this.selectedFilter.set(value);
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

  private updateAnalytics(): void {
    const filter = this.selectedFilter();
    const monthDates = this.getMonthDateRange(filter);

    const messages = monthDates
      ? this.messages().filter((m) => {
          const d = new Date(m.created_at);
          return d >= monthDates.start && d < monthDates.end;
        })
      : this.messages();

    const bookings = monthDates
      ? this.callBookings().filter((b) => {
          const d = new Date(b.created_at);
          return d >= monthDates.start && d < monthDates.end;
        })
      : this.callBookings();

    // Pass the selected month so calculateDailyStats initialises the correct days
    const viewMonth = monthDates
      ? { year: monthDates.start.getFullYear(), month: monthDates.start.getMonth() + 1 }
      : undefined;

    this.analytics.set(this.analyticsService.calculateAnalytics(messages, bookings, viewMonth));
  }

  /**
   * Returns the inclusive start and exclusive end Date for a 'YYYY-MM' key,
   * or null when the filter is 'all'.
   */
  private getMonthDateRange(filter: string): { start: Date; end: Date } | null {
    if (filter === 'all') {
      return null;
    }
    const [y, m] = filter.split('-').map(Number);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  }
}
