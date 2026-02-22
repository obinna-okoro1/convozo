/**
 * Analytics Dashboard Component
 * Displays comprehensive analytics for creators
 */

import { Component, OnInit, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService, AnalyticsData } from '../../../../core/services/analytics.service';
import { Message } from '../../../../core/models';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-neutral-900">Analytics</h2>
          <p class="text-sm text-neutral-500">Track your performance and earnings</p>
        </div>
        <div class="flex gap-2">
          <button 
            (click)="setTimeRange('7d')"
            [class.bg-primary-100]="timeRange() === '7d'"
            [class.text-primary-700]="timeRange() === '7d'"
            class="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            7 days
          </button>
          <button 
            (click)="setTimeRange('30d')"
            [class.bg-primary-100]="timeRange() === '30d'"
            [class.text-primary-700]="timeRange() === '30d'"
            class="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            30 days
          </button>
          <button 
            (click)="setTimeRange('all')"
            [class.bg-primary-100]="timeRange() === 'all'"
            [class.text-primary-700]="timeRange() === 'all'"
            class="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            All time
          </button>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total Revenue -->
        <div class="card p-4 hover:shadow-soft-lg transition-all duration-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-neutral-500">Total Revenue</span>
            <span class="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center">
              💰
            </span>
          </div>
          <div class="text-2xl font-bold text-neutral-900">{{ formatCurrency(analytics().totalRevenue) }}</div>
          @if (analytics().revenueGrowth !== 0) {
            <div class="flex items-center gap-1 mt-1">
              <span [class]="analytics().revenueGrowth >= 0 ? 'text-success-600' : 'text-danger-600'" class="text-xs font-medium">
                {{ analytics().revenueGrowth >= 0 ? '↑' : '↓' }} {{ formatPercentage(Math.abs(analytics().revenueGrowth)) }}
              </span>
              <span class="text-xs text-neutral-400">vs last period</span>
            </div>
          }
        </div>

        <!-- Messages -->
        <div class="card p-4 hover:shadow-soft-lg transition-all duration-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-neutral-500">Messages</span>
            <span class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              ✉️
            </span>
          </div>
          <div class="text-2xl font-bold text-neutral-900">{{ analytics().totalMessages }}</div>
          @if (analytics().messageGrowth !== 0) {
            <div class="flex items-center gap-1 mt-1">
              <span [class]="analytics().messageGrowth >= 0 ? 'text-success-600' : 'text-danger-600'" class="text-xs font-medium">
                {{ analytics().messageGrowth >= 0 ? '↑' : '↓' }} {{ formatPercentage(Math.abs(analytics().messageGrowth)) }}
              </span>
              <span class="text-xs text-neutral-400">vs last period</span>
            </div>
          }
        </div>

        <!-- Avg Message Value -->
        <div class="card p-4 hover:shadow-soft-lg transition-all duration-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-neutral-500">Avg. Value</span>
            <span class="w-8 h-8 rounded-lg bg-warning-100 flex items-center justify-center">
              📊
            </span>
          </div>
          <div class="text-2xl font-bold text-neutral-900">{{ formatCurrency(analytics().avgMessageValue) }}</div>
          <div class="text-xs text-neutral-400 mt-1">per message</div>
        </div>

        <!-- Response Rate -->
        <div class="card p-4 hover:shadow-soft-lg transition-all duration-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-neutral-500">Response Rate</span>
            <span class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              ⚡
            </span>
          </div>
          <div class="text-2xl font-bold text-neutral-900">{{ analytics().responseRate.toFixed(0) }}%</div>
          <div class="text-xs text-neutral-400 mt-1">
            ~{{ analytics().avgResponseTime.toFixed(1) }}h avg response
          </div>
        </div>
      </div>

      <!-- Projected Revenue Card -->
      <div class="card p-5 bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-primary-700 mb-1">Projected This Month</div>
            <div class="text-3xl font-bold text-neutral-900">{{ formatCurrency(projectedRevenue()) }}</div>
            <div class="text-sm text-neutral-600 mt-1">Based on your current pace</div>
          </div>
          <div class="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-soft">
            <span class="text-3xl">🚀</span>
          </div>
        </div>
      </div>

      <!-- Revenue Chart (Simple Bar Visualization) -->
      <div class="card p-5">
        <h3 class="font-semibold text-neutral-900 mb-4">Revenue Trend (Last 30 Days)</h3>
        <div class="h-40 flex items-end justify-between gap-1">
          @for (day of analytics().dailyStats; track day.date) {
            <div 
              class="flex-1 bg-primary-200 hover:bg-primary-400 rounded-t transition-colors cursor-pointer group relative"
              [style.height.%]="getBarHeight(day.revenue)"
              [title]="day.date + ': ' + formatCurrency(day.revenue)"
            >
              <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded whitespace-nowrap">
                {{ formatCurrency(day.revenue) }}
              </div>
            </div>
          }
        </div>
        <div class="flex justify-between mt-2 text-xs text-neutral-400">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Senders -->
        <div class="card p-5">
          <h3 class="font-semibold text-neutral-900 mb-4">Top Supporters</h3>
          @if (analytics().topSenders.length > 0) {
            <div class="space-y-3">
              @for (sender of analytics().topSenders; track sender.email; let i = $index) {
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {{ i + 1 }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-neutral-900 truncate">{{ sender.name }}</div>
                    <div class="text-xs text-neutral-500">{{ sender.messageCount }} message{{ sender.messageCount > 1 ? 's' : '' }}</div>
                  </div>
                  <div class="text-success-600 font-bold">{{ formatCurrency(sender.totalSpent) }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="text-center py-8 text-neutral-500">
              <span class="text-3xl mb-2 block">👥</span>
              No supporters yet
            </div>
          }
        </div>

        <!-- Peak Hours -->
        <div class="card p-5">
          <h3 class="font-semibold text-neutral-900 mb-4">Best Times to Post</h3>
          <div class="grid grid-cols-6 gap-1.5">
            @for (hour of topPeakHours(); track hour.hour) {
              <div 
                class="aspect-square rounded-lg flex items-center justify-center text-xs font-medium"
                [class]="getHourHeatClass(hour.count)"
                [title]="formatHour(hour.hour) + ': ' + hour.count + ' messages'"
              >
                {{ formatHourShort(hour.hour) }}
              </div>
            }
          </div>
          <div class="flex items-center justify-center gap-4 mt-4 text-xs text-neutral-500">
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded bg-primary-100"></span> Low
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded bg-primary-300"></span> Medium
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded bg-primary-600"></span> High
            </span>
          </div>
        </div>
      </div>

      <!-- Message Type Breakdown -->
      <div class="card p-5">
        <h3 class="font-semibold text-neutral-900 mb-4">Message Breakdown</h3>
        @if (analytics().messageTypeBreakdown.length > 0) {
          <div class="space-y-3">
            @for (type of analytics().messageTypeBreakdown; track type.type) {
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium text-neutral-700 capitalize">{{ type.type }}</span>
                  <span class="text-sm text-neutral-500">{{ type.count }} ({{ formatCurrency(type.revenue) }})</span>
                </div>
                <div class="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500"
                    [style.width.%]="getTypePercentage(type.count)"
                  ></div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-8 text-neutral-500">
            <span class="text-3xl mb-2 block">📈</span>
            No data yet
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
    this.analyticsService.getProjectedRevenue(this.messages())
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
    const analytics = this.analyticsService.calculateAnalytics(messages);
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
    const total = this.analytics().totalMessages || 1;
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
    
    if (ratio > 0.7) return 'bg-primary-600 text-white';
    if (ratio > 0.4) return 'bg-primary-300 text-primary-900';
    if (ratio > 0.1) return 'bg-primary-100 text-primary-700';
    return 'bg-neutral-100 text-neutral-400';
  }
}
