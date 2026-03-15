/**
 * Core data models for the Convozo application
 */

export interface Creator {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  slug: string;
  phone_number: string;
  instagram_username: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorSettings {
  id: string;
  creator_id: string;
  message_price: number;
  messages_enabled: boolean;
  call_price: number | null;
  call_duration: number | null;
  calls_enabled: boolean;
  follow_back_price: number | null;
  follow_back_enabled: boolean;
  tips_enabled: boolean;
  shop_enabled: boolean;
  response_expectation: string | null;
  auto_reply_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  creator_id: string;
  sender_name: string;
  sender_email: string;
  sender_instagram: string | null;
  message_content: string;
  amount_paid: number;
  message_type: MessageType;
  is_handled: boolean;
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeAccount {
  id: string;
  creator_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile extends Creator {
  creator_settings: CreatorSettings;
}

export type MessageType = 'message' | 'call' | 'follow_back' | 'support';
export type FilterStatus = 'all' | 'unhandled' | 'handled';
export type CallBookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'refunded';
export type PayoutStatus = 'held' | 'released' | 'refunded';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

export interface AvailabilitySlot {
  id: string;
  creator_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallBooking {
  id: string;
  creator_id: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
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
  // Secret token for fan call access — sent in their email link
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
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageStats {
  total: number;
  unhandled: number;
  handled: number;
  totalRevenue: number;
}

export interface CheckoutSessionPayload {
  creator_slug: string;
  message_content: string;
  sender_name: string;
  sender_email: string;
  sender_instagram?: string;
  message_type: MessageType;
  price: number;
}

export interface CallBookingPayload {
  creator_slug: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  message_content: string; // Optional message about preferred times
  price: number;
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

export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}

export interface StripeConnectResponse {
  url: string;
  account_id: string;
}

export interface StripeAccountStatus {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
}

// ── Link-in-Bio ──────────────────────────────────────────────────────

export interface CreatorLink {
  id: string;
  creator_id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface LinkClick {
  id: string;
  link_id: string;
  creator_id: string;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
}

// ── Digital Shop ─────────────────────────────────────────────────────────────

export type ShopItemType = 'video' | 'audio' | 'pdf' | 'image' | 'shoutout_request';

export interface ShopItem {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  /** Price in cents — minimum 100 ($1.00) */
  price: number;
  item_type: ShopItemType;
  /** Download / delivery URL. Null for request-based items. */
  file_url: string | null;
  thumbnail_url: string | null;
  preview_text: string | null;
  delivery_note: string | null;
  is_active: boolean;
  /** True when creator must manually fulfil (e.g. shoutout_request). */
  is_request_based: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShopOrder {
  id: string;
  item_id: string;
  creator_id: string;
  buyer_name: string;
  buyer_email: string;
  /** Amount paid in cents */
  amount_paid: number;
  stripe_session_id: string;
  idempotency_key: string;
  status: 'pending' | 'completed' | 'refunded';
  request_details: string | null;
  fulfillment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopCheckoutPayload {
  creator_slug: string;
  item_id: string;
  buyer_name: string;
  buyer_email: string;
  request_details?: string;
}
