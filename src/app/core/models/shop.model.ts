/**
 * Digital Shop domain models
 * Shop items, orders, and checkout payloads.
 */

export type ShopItemType = 'video' | 'audio' | 'pdf' | 'image' | 'shoutout_request';

export interface ShopItem {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  /** Price in cents — minimum 100 ($1.00) */
  price: number;
  item_type: ShopItemType;
  /**
   * Path in the private shop-files Supabase Storage bucket.
   * Buyers receive a short-lived signed URL via the get-shop-download edge function.
   * Null for request-based items.
   */
  file_storage_path: string | null;
  /**
   * Path in the public shop-thumbnails bucket.
   * Derive the public URL via supabase.storage.from('shop-thumbnails').getPublicUrl(path).
   */
  thumbnail_storage_path: string | null;
  /** Legacy external URL — kept for backward compat; superseded by file_storage_path. */
  file_url: string | null;
  /** Legacy external thumbnail URL — superseded by thumbnail_storage_path. */
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
