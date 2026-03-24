/**
 * Analytics domain models
 * Monthly analytics (migration 031) — written exclusively by DB triggers.
 * All monetary values are integer cents.
 */

export interface CreatorMonthlyAnalytics {
  id: string;
  creator_id: string;
  /** First day of the calendar month, e.g. '2026-03-01' */
  month: string;

  // Messages (paid DMs — does NOT include support tips)
  message_count: number;
  message_gross: number;
  message_platform_fee: number;
  message_net: number;
  message_refund_count: number;
  message_refund_amount: number;

  // Support tips / donations (fan-initiated, no response expected)
  support_count: number;
  support_gross: number;
  support_platform_fee: number;
  support_net: number;
  support_refund_count: number;
  support_refund_amount: number;

  // Calls
  call_count: number;
  call_gross: number;
  call_platform_fee: number;
  call_net: number;
  call_refund_count: number;
  call_refund_amount: number;

  // Shop orders
  shop_order_count: number;
  shop_gross: number;
  shop_platform_fee: number;
  shop_net: number;
  shop_refund_count: number;
  shop_refund_amount: number;

  // Cross-stream totals
  total_gross: number;
  total_platform_fee: number;
  total_net: number;
  total_refunds: number;

  created_at: string;
  updated_at: string;
}
