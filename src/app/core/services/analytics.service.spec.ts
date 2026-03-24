/**
 * Unit tests for AnalyticsService
 * Covers: empty state, revenue/message calculations, growth metrics,
 * top senders, daily stats, type breakdown, and formatting helpers.
 */

import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from './analytics.service';
import { Message, CallBooking } from '../models';

// ── Test data factories ──────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  const now = new Date().toISOString();
  return {
    id: 'msg-1',
    creator_id: 'creator-1',
    sender_name: 'Alice',
    sender_email: 'alice@example.com',
    message_content: 'Hello',
    amount_paid: 1000, // $10.00 in cents
    message_type: 'message',
    is_handled: false,
    reply_content: null,
    replied_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<CallBooking> = {}): CallBooking {
  const now = new Date().toISOString();
  return {
    id: 'booking-1',
    creator_id: 'creator-1',
    booker_name: 'Bob',
    booker_email: 'bob@example.com',
    scheduled_at: null,
    duration: 30,
    amount_paid: 5000, // $50.00 in cents
    status: 'completed',
    call_notes: null,
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    daily_room_name: null,
    daily_room_url: null,
    creator_meeting_token: null,
    fan_meeting_token: null,
    fan_access_token: 'tok-1',
    creator_joined_at: null,
    fan_joined_at: null,
    call_started_at: null,
    call_ended_at: null,
    actual_duration_seconds: null,
    payout_status: 'held',
    payout_released_at: null,
    refunded_at: null,
    fan_timezone: 'UTC',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('calculateAnalytics() with no data', () => {
    it('returns zeros for all numeric fields', () => {
      const result = service.calculateAnalytics([], []);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalMessages).toBe(0);
      expect(result.avgMessageValue).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.avgResponseTime).toBe(0);
      expect(result.revenueGrowth).toBe(0);
      expect(result.messageGrowth).toBe(0);
    });

    it('returns empty arrays for collections', () => {
      const result = service.calculateAnalytics([], []);
      expect(result.topSenders).toEqual([]);
      expect(result.dailyStats).toEqual([]);
      expect(result.messageTypeBreakdown).toEqual([]);
    });
  });

  // ── Revenue ───────────────────────────────────────────────────────────────

  describe('calculateAnalytics() revenue', () => {
    it('sums message revenue from cents to dollars', () => {
      const messages = [
        makeMessage({ amount_paid: 1000 }), // $10
        makeMessage({ id: 'msg-2', amount_paid: 2000 }), // $20
      ];
      const result = service.calculateAnalytics(messages);
      expect(result.totalRevenue).toBeCloseTo(30);
    });

    it('adds booking revenue to total', () => {
      const messages = [makeMessage({ amount_paid: 1000 })]; // $10
      const bookings = [makeBooking({ amount_paid: 5000 })]; // $50
      const result = service.calculateAnalytics(messages, bookings);
      expect(result.totalRevenue).toBeCloseTo(60);
    });

    it('calculates average value across messages and bookings', () => {
      const messages = [makeMessage({ amount_paid: 2000 })]; // $20
      const bookings = [makeBooking({ amount_paid: 2000 })]; // $20
      const result = service.calculateAnalytics(messages, bookings);
      // 2 items totalling $40 => avg $20
      expect(result.avgMessageValue).toBeCloseTo(20);
    });
  });

  // ── Response stats ────────────────────────────────────────────────────────

  describe('calculateAnalytics() response stats', () => {
    it('calculates 100% response rate when all messages are handled', () => {
      const messages = [
        makeMessage({ is_handled: true }),
        makeMessage({ id: 'msg-2', is_handled: true }),
      ];
      const result = service.calculateAnalytics(messages);
      expect(result.responseRate).toBe(100);
    });

    it('calculates 50% response rate when half the messages are handled', () => {
      const messages = [
        makeMessage({ is_handled: true }),
        makeMessage({ id: 'msg-2', is_handled: false }),
      ];
      const result = service.calculateAnalytics(messages);
      expect(result.responseRate).toBe(50);
    });

    it('calculates average response time in hours', () => {
      const sentAt = new Date('2025-01-01T10:00:00Z').toISOString();
      const repliedAt = new Date('2025-01-01T12:00:00Z').toISOString(); // 2 h later
      const msg = makeMessage({ created_at: sentAt, replied_at: repliedAt });
      const result = service.calculateAnalytics([msg]);
      expect(result.avgResponseTime).toBeCloseTo(2);
    });

    it('returns 0 avg response time when no replies exist', () => {
      const messages = [makeMessage({ replied_at: null })];
      const result = service.calculateAnalytics(messages);
      expect(result.avgResponseTime).toBe(0);
    });
  });

  // ── Top senders ───────────────────────────────────────────────────────────

  describe('calculateAnalytics() topSenders', () => {
    it('returns senders sorted by total spend descending', () => {
      const messages = [
        makeMessage({ sender_email: 'high@test.com', sender_name: 'High', amount_paid: 5000 }),
        makeMessage({
          id: 'msg-2',
          sender_email: 'low@test.com',
          sender_name: 'Low',
          amount_paid: 1000,
        }),
      ];
      const result = service.calculateAnalytics(messages);
      expect(result.topSenders[0].email).toBe('high@test.com');
    });

    it('aggregates multiple messages from the same sender', () => {
      const messages = [
        makeMessage({ amount_paid: 1000 }),
        makeMessage({ id: 'msg-2', amount_paid: 2000 }),
      ];
      const result = service.calculateAnalytics(messages);
      expect(result.topSenders.length).toBe(1);
      expect(result.topSenders[0].totalSpent).toBeCloseTo(30);
      expect(result.topSenders[0].messageCount).toBe(2);
    });
  });

  // ── Message type breakdown ────────────────────────────────────────────────

  describe('calculateAnalytics() messageTypeBreakdown', () => {
    it('groups messages by type', () => {
      const messages = [
        makeMessage({ message_type: 'message' }),
        makeMessage({ id: 'msg-2', message_type: 'support' }),
        makeMessage({ id: 'msg-3', message_type: 'message' }),
      ];
      const result = service.calculateAnalytics(messages);
      const msgEntry = result.messageTypeBreakdown.find((e) => e.type === 'message');
      const supportEntry = result.messageTypeBreakdown.find((e) => e.type === 'support');
      expect(msgEntry?.count).toBe(2);
      expect(supportEntry?.count).toBe(1);
    });

    it('adds call bookings as a separate category', () => {
      const bookings = [makeBooking(), makeBooking({ id: 'b-2' })];
      const result = service.calculateAnalytics([], bookings);
      const callEntry = result.messageTypeBreakdown.find((e) => e.type === 'call booking');
      expect(callEntry?.count).toBe(2);
    });
  });

  // ── Formatting helpers ────────────────────────────────────────────────────

  describe('formatCurrency()', () => {
    it('formats whole dollar amounts with $ sign', () => {
      expect(service.formatCurrency(10)).toContain('$');
      expect(service.formatCurrency(10)).toContain('10');
    });

    it('formats zero as $0', () => {
      expect(service.formatCurrency(0)).toContain('0');
    });
  });

  describe('formatPercentage()', () => {
    it('prepends + for positive values', () => {
      expect(service.formatPercentage(5.5)).toBe('+5.5%');
    });

    it('keeps - for negative values', () => {
      expect(service.formatPercentage(-3.2)).toBe('-3.2%');
    });

    it('formats zero as +0.0%', () => {
      expect(service.formatPercentage(0)).toBe('+0.0%');
    });
  });
});
