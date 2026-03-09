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

export interface FlutterwaveSubaccount {
  id: string;
  creator_id: string;
  subaccount_id: string;
  bank_name: string | null;
  account_number: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile extends Creator {
  creator_settings: CreatorSettings;
}

export type MessageType = 'message' | 'call' | 'follow_back' | 'support';
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
  flw_tx_ref: string | null;
  flw_transaction_id: string | null;
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

export interface FlutterwaveSubaccountResponse {
  subaccount_id?: string;
  already_exists?: boolean;
}

export interface FlutterwaveSubaccountStatus {
  is_active: boolean;
  subaccount_id: string;
  bank_name: string | null;
  account_number: string | null;
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
