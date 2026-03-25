/**
 * Shop Service
 * Handles CRUD operations for a creator's digital shop items and their orders.
 *
 * Provided in root — used by the creator-side shop management view and
 * the public shop view (for loading active items + initiating checkout).
 */

import { Injectable } from '@angular/core';
import { ShopItem, ShopOrder, ShopCheckoutPayload, EdgeFunctionResponse } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ── Creator-side (authenticated) ──────────────────────────────────────────

  /**
   * Load all shop items for the creator (includes inactive drafts).
   * Only the authenticated creator can read their own inactive items via RLS.
   */
  public async getShopItems(creatorId: string): Promise<{ data: ShopItem[] | null; error: unknown }> {
    return this.supabaseService.getShopItems(creatorId);
  }

  /**
   * Create a new shop item.
   * @param item — all fields except id, created_at, updated_at
   */
  public async createShopItem(
    item: Omit<ShopItem, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<{ data: ShopItem | null; error: unknown }> {
    return this.supabaseService.createShopItem(item);
  }

  /**
   * Update an existing shop item.
   * Only non-immutable fields may be updated.
   */
  public async updateShopItem(
    id: string,
    updates: Partial<Omit<ShopItem, 'id' | 'creator_id' | 'created_at' | 'updated_at'>>,
  ): Promise<{ data: ShopItem | null; error: unknown }> {
    return this.supabaseService.updateShopItem(id, updates);
  }

  /**
   * Permanently delete a shop item.
   * NOTE: associated shop_orders are retained for financial record-keeping.
   */
  public async deleteShopItem(id: string): Promise<{ error: unknown }> {
    return this.supabaseService.deleteShopItem(id);
  }

  /**
   * Load all orders for the creator's shop (creator-side view).
   */
  public async getShopOrders(creatorId: string): Promise<{ data: ShopOrder[] | null; error: unknown }> {
    return this.supabaseService.getShopOrders(creatorId);
  }

  // ── Public-side (unauthenticated) ─────────────────────────────────────────

  /**
   * Load all active shop items for a creator (fan-facing storefront).
   * RLS returns only active items to anonymous users.
   */
  public async getActiveShopItems(creatorId: string): Promise<{ data: ShopItem[] | null; error: unknown }> {
    return this.supabaseService.getActiveShopItems(creatorId);
  }

  /**
   * Initiate Stripe Checkout for a shop item purchase via Edge Function.
   */
  public async createShopCheckout(
    payload: ShopCheckoutPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return this.supabaseService.createShopCheckout(payload);
  }

  // ── File storage ──────────────────────────────────────────────────────────

  /**
   * Upload a digital file to the private shop-files bucket.
   * Returns the storage path — never a public URL.
   */
  public async uploadShopFile(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; error: Error | null }> {
    return this.supabaseService.uploadShopFile(creatorId, file);
  }

  /**
   * Upload a thumbnail image to the public shop-thumbnails bucket.
   * Returns the path and the derived public URL for display.
   */
  public async uploadShopThumbnail(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; publicUrl: string | null; error: Error | null }> {
    return this.supabaseService.uploadShopThumbnail(creatorId, file);
  }

  /**
   * Derive the public thumbnail URL for a shop item.
   * Prefers the Supabase Storage path (thumbnail_storage_path), falls back to the legacy
   * thumbnail_url field, and returns null when neither is present.
   */
  public getItemThumbnailUrl(item: ShopItem): string | null {
    if (item.thumbnail_storage_path) {
      const { data } = this.supabaseService.client.storage
        .from('shop-thumbnails')
        .getPublicUrl(item.thumbnail_storage_path);
      return data.publicUrl ?? null;
    }
    return item.thumbnail_url ?? null;
  }

  /**
   * Fetch a signed download URL for a verified purchaser.
   * Calls the get-shop-download edge function — no auth required (session_id proves purchase).
   */
  public async getShopDownloadUrl(
    sessionId: string,
  ): Promise<EdgeFunctionResponse<{ url: string; filename: string }>> {
    return this.supabaseService.getShopDownloadUrl(sessionId);
  }
}
