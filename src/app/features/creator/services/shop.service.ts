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
}
