/**
 * Message domain models
 * Paid messages (DMs), support tips, and related payloads.
 */

export type MessageType = 'message' | 'call' | 'support';
export type FilterStatus = 'all' | 'unhandled' | 'handled';

export interface Message {
  id: string;
  creator_id: string;
  sender_name: string;
  sender_email: string;
  message_content: string;
  amount_paid: number;
  message_type: MessageType;
  is_handled: boolean;
  reply_content: string | null;
  replied_at: string | null;
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
  message_type: MessageType;
  price: number;
}
