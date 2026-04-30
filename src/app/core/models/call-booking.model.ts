/**
 * Call Booking domain models
 * Video call bookings, events, and related payloads.
 */

import { PayoutStatus } from './payment.model';

export type CallBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refunded';

export interface CallBooking {
  id: string;
  creator_id: string;
  booker_name: string;
  booker_email: string;
  scheduled_at: string | null;
  duration: number;
  amount_paid: number;
  status: CallBookingStatus;
  call_notes: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  // Daily.co video call fields
  daily_room_name: string | null;
  daily_room_url: string | null;
  creator_meeting_token: string | null;
  fan_meeting_token: string | null;
  /** Secret token for fan call access — sent in their email link */
  fan_access_token: string;
  // Attendance tracking
  creator_joined_at: string | null;
  fan_joined_at: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  actual_duration_seconds: number | null;
  // Escrow payout tracking
  payout_status: PayoutStatus;
  payout_released_at: string | null;
  /** When the 7-day hold expires and payout can be released to expert */
  payout_release_at: string | null;
  refunded_at: string | null;
  /** Stripe refund ID (re_xxx) — set by create-refund, null until refunded */
  refund_id: string | null;
  /** Stripe dispute ID (dp_xxx) — set by dispute handler on chargeback */
  dispute_id: string | null;
  /** Timestamp when a chargeback froze the payout */
  dispute_frozen_at: string | null;
  /** Whether payment was authorized only ('manual') or captured at checkout ('automatic') */
  capture_method: 'manual' | 'automatic';
  /** Fan timezone captured at booking time (IANA, e.g. "America/New_York") */
  fan_timezone: string;
  /** Session mode: 'online' (video call) or 'physical' (in-person). */
  session_type: 'online' | 'physical';
  /**
   * One-time CVZ verification code for physical sessions.
   * Generated at checkout, emailed to the client, entered by the expert to confirm
   * the in-person meeting took place. Nulled out after successful verification.
   * Always null for online sessions.
   */
  meeting_verification_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  message_content: string;
  price: number;
  /** ISO 8601 UTC datetime of the fan's chosen time slot */
  scheduled_at: string;
  /** IANA timezone string captured from fan's browser (e.g. "America/New_York") */
  fan_timezone: string;
  /** Session mode the client chose: 'online' or 'physical'. */
  session_type: 'online' | 'physical';
}

// ── Video Call Types ─────────────────────────────────────────────────────────

export type CallEventType =
  | 'room_created'
  | 'creator_joined'
  | 'fan_joined'
  | 'call_started'
  | 'creator_left'
  | 'fan_left'
  | 'call_ended'
  | 'call_completed'
  | 'no_show_creator'
  | 'no_show_fan'
  | 'payout_released'
  | 'refund_issued';

export interface CallEvent {
  id: string;
  booking_id: string;
  event_type: CallEventType;
  actor: 'creator' | 'fan' | 'system';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JoinCallResponse {
  room_url: string;
  token: string;
  booking: {
    id: string;
    status: CallBookingStatus;
    duration: number;
    booker_name: string;
    creator_name: string;
    call_started_at: string | null;
  };
}

export interface CompleteCallResponse {
  status: string;
  actual_duration_seconds: number;
  booked_duration_seconds: number;
  meets_threshold: boolean;
  payout_released: boolean;
}
