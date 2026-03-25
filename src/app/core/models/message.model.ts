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
  /** UUID token used to identify the conversation without auth (client-facing URL). */
  conversation_token: string;
  created_at: string;
  updated_at: string;
}

/**
 * A single message in a threaded conversation.
 * Populated from the `message_replies` table.
 */
export interface MessageReply {
  id: string;
  message_id: string;
  /** 'expert' = the creator replied; 'client' = the paying client replied back. */
  sender_type: 'expert' | 'client';
  content: string;
  created_at: string;
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
