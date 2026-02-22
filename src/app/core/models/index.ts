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
  instagram_username: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorSettings {
  id: string;
  creator_id: string;
  message_price: number;
  call_price: number | null;
  call_duration: number | null;
  calls_enabled: boolean;
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

export type MessageType = 'message' | 'call';
export type FilterStatus = 'all' | 'unhandled' | 'handled';
export type CallBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
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
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
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

export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: { message: string };
}

export interface StripeConnectResponse {
  url?: string;
  account_id?: string;
}

export interface StripeAccountStatus {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
}
