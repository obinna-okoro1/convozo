/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics for creators
 */

import { Component, OnInit, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService, AnalyticsData } from '../../../../core/services/analytics.service';
import { Message, CallBooking } from '../../../../core/models';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/50">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">Analytics</h2>
            <p class="text-slate-400 text-sm mt-0.5">Track your performance and earnings</p>
          </div>
        </div>
        <div class="flex gap-2 bg-white/5 border border-white/10 rounded-xl p-1 backdrop-blur-xl">
          <button
            (click)="setTimeRange('7d')"
            [class]="timeRange() === '7d' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'"
            class="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300"
          >
            7 days
          </button>
          <button
            (click)="setTimeRange('30d')"
            [class]="timeRange() === '30d' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'"
            class="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300"
          >
            30 days
          </button>
          <button
            (click)="setTimeRange('all')"
            [class]="timeRange() === 'all' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'"
            class="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300"
          >
            All time
          </button>
        </div>
      </div>

      <!-- Key Metrics Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total Revenue -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 hover:scale-105 group animate-fade-in">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-slate-400">Total Revenue</span>
            <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/50 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">{{ formatCurrency(analytics().totalRevenue) }}</div>
          @if (analytics().revenueGrowth !== 0) {
            <div class="flex items-center gap-1.5 mt-2">
              <span [class]="analytics().revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'" class="text-xs font-bold">
                {{ analytics().revenueGrowth >= 0 ? '↑' : '↓' }} {{ formatPercentage(Math.abs(analytics().revenueGrowth)) }}
              </span>
              <span class="text-xs text-slate-500">vs last period</span>
            </div>
          }
        </div>

        <!-- Messages -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 hover:scale-105 group animate-fade-in" style="animation-delay: 50ms">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-slate-400">Messages</span>
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-white">{{ analytics().totalMessages }}</div>
          @if (analytics().messageGrowth !== 0) {
            <div class="flex items-center gap-1.5 mt-2">
              <span [class]="analytics().messageGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'" class="text-xs font-bold">
                {{ analytics().messageGrowth >= 0 ? '↑' : '↓' }} {{ formatPercentage(Math.abs(analytics().messageGrowth)) }}
              </span>
              <span class="text-xs text-slate-500">vs last period</span>
            </div>
          }
        </div>

        <!-- Avg Message Value -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 hover:scale-105 group animate-fade-in" style="animation-delay: 100ms">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-slate-400">Avg. Value</span>
            <div class="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/50 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-white">{{ formatCurrency(analytics().avgMessageValue) }}</div>
          <div class="text-xs text-slate-500 mt-2">per message</div>
        </div>

        <!-- Response Rate -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 hover:scale-105 group animate-fade-in" style="animation-delay: 150ms">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-slate-400">Response Rate</span>
            <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{{ analytics().responseRate.toFixed(0) }}%</div>
          <div class="text-xs text-slate-500 mt-2">~{{ analytics().avgResponseTime.toFixed(1) }}h avg response</div>
        </div>
      </div>

      <!-- Projected Revenue -->
      <div class="bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-2xl border border-purple-500/30 rounded-2xl p-6 shadow-lg shadow-purple-500/20 animate-slide-up">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-purple-300 mb-1 uppercase tracking-wider">Projected This Month</div>
            <div class="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{{ formatCurrency(projectedRevenue()) }}</div>
            <div class="text-sm text-slate-400 mt-2">Based on your current pace</div>
          </div>
          <div class="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/50">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Revenue Chart -->
      <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 animate-fade-in">
        <h3 class="font-bold text-white mb-5 flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Revenue Trend (Last 30 Days)
        </h3>
        <div class="h-44 flex items-end justify-between gap-[3px]">
          @for (day of analytics().dailyStats; track day.date) {
            <div
              class="flex-1 bg-gradient-to-t from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 rounded-t-lg transition-all duration-200 cursor-pointer group relative min-h-[3px] opacity-80 hover:opacity-100"
              [style.height.%]="getBarHeight(day.revenue)"
              [title]="day.date + ': ' + formatCurrency(day.revenue)"
            >
              <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap border border-white/10 shadow-xl z-10">
                {{ formatCurrency(day.revenue) }}
                <div class="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-r border-b border-white/10"></div>
              </div>
            </div>
          }
        </div>
        <div class="flex justify-between mt-3 text-xs text-slate-500 font-medium">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Senders -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 animate-fade-in">
          <h3 class="font-bold text-white mb-5 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Top Supporters
          </h3>
          @if (analytics().topSenders.length > 0) {
            <div class="space-y-3">
              @for (sender of analytics().topSenders; track sender.email; let i = $index) {
                <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/30">
                    {{ i + 1 }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white truncate text-sm">{{ sender.name }}</div>
                    <div class="text-xs text-slate-400">{{ sender.messageCount }} message{{ sender.messageCount > 1 ? 's' : '' }}</div>
                  </div>
                  <div class="text-emerald-400 font-bold text-sm">{{ formatCurrency(sender.totalSpent) }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="text-center py-12">
              <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                <svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p class="text-slate-400 text-sm font-medium">No supporters yet</p>
            </div>
          }
        </div>

        <!-- Peak Hours -->
        <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 animate-fade-in">
          <h3 class="font-bold text-white mb-5 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Best Times to Post
          </h3>
          <div class="grid grid-cols-6 gap-2">
            @for (hour of topPeakHours(); track hour.hour) {
              <div
                class="aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110 cursor-default"
                [class]="getHourHeatClass(hour.count)"
                [title]="formatHour(hour.hour) + ': ' + hour.count + ' messages'"
              >
                {{ formatHourShort(hour.hour) }}
              </div>
            }
          </div>
          <div class="flex items-center justify-center gap-5 mt-5 text-xs text-slate-400 font-medium">
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded bg-white/5 border border-white/10"></span> Low
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded bg-purple-500/40"></span> Medium
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded bg-gradient-to-br from-purple-600 to-pink-600"></span> High
            </span>
          </div>
        </div>
      </div>

      <!-- Message Type Breakdown -->
      <div class="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 animate-fade-in">
        <h3 class="font-bold text-white mb-5 flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          Message & Booking Breakdown
        </h3>
        @if (analytics().messageTypeBreakdown.length > 0) {
          <div class="space-y-4">
            @for (type of analytics().messageTypeBreakdown; track type.type) {
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-semibold text-white capitalize">{{ type.type }}</span>
                  <span class="text-sm text-slate-400">{{ type.count }} · {{ formatCurrency(type.revenue) }}</span>
                </div>
                <div class="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    class="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-700 shadow-lg shadow-purple-500/30"
                    [style.width.%]="getTypePercentage(type.count)"
                  ></div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
              <svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            </div>
            <p class="text-slate-400 text-sm font-medium">No data yet</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class AnalyticsDashboardComponent implements OnInit {
  messages = input<Message[]>([]);
  callBookings = input<CallBooking[]>([]);
  
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
    weeklyStats: [],
    peakHours: [],
    messageTypeBreakdown: [],
  });

  protected readonly projectedRevenue = computed(() => 
    this.analyticsService.getProjectedRevenue(this.messages(), this.callBookings())
  );

  protected readonly topPeakHours = computed(() => 
    [...this.analytics().peakHours].sort((a, b) => b.count - a.count).slice(0, 12)
  );

  protected Math = Math;

  constructor(private readonly analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    this.updateAnalytics();
  }

  setTimeRange(range: '7d' | '30d' | 'all'): void {
    this.timeRange.set(range);
    this.updateAnalytics();
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
    
    if (range === 'all') return allMessages;

    const now = new Date();
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return allMessages.filter(m => new Date(m.created_at) >= cutoff);
  }

  private filterBookingsByTimeRange(): CallBooking[] {
    const range = this.timeRange();
    const allBookings = this.callBookings();
    
    if (range === 'all') return allBookings;

    const now = new Date();
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return allBookings.filter(b => new Date(b.created_at) >= cutoff);
  }

  formatCurrency(value: number): string {
    return this.analyticsService.formatCurrency(value);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  getBarHeight(revenue: number): number {
    const maxRevenue = Math.max(...this.analytics().dailyStats.map(d => d.revenue), 1);
    return Math.max((revenue / maxRevenue) * 100, 2);
  }

  getTypePercentage(count: number): number {
    const total = (this.analytics().totalMessages + this.callBookings().length) || 1;
    return (count / total) * 100;
  }

  formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  }

  formatHourShort(hour: number): string {
    const period = hour >= 12 ? 'p' : 'a';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  }

  getHourHeatClass(count: number): string {
    const maxCount = Math.max(...this.analytics().peakHours.map(h => h.count), 1);
    const ratio = count / maxCount;
    
    if (ratio > 0.7) return 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30';
    if (ratio > 0.4) return 'bg-purple-500/40 text-purple-200';
    if (ratio > 0.1) return 'bg-purple-500/20 text-purple-300';
    return 'bg-white/5 text-slate-500 border border-white/10';
  }
}
