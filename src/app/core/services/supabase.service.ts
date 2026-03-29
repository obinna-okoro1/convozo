import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  Creator,
  CreatorSettings,
  Message,
  StripeAccount,
  CreatorMonthlyAnalytics,
  ShopItem,
  ShopOrder,
} from '../models';

interface SupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Core Supabase Client Provider
 *
 * Owns the Supabase client instance and auth state.
 * Domain-specific queries live in their respective feature services.
 * Storage operations → StorageService
 * Edge Function calls → EdgeFunctionService
 *
 * This service is intentionally thin: it provides the client and auth state.
 * Feature services inject it to access `client` directly for their queries.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  /**
   * The raw Supabase client.
   *
   * ⚠️ SECURITY: Do NOT inject this into components or call it from templates.
   * All database access must go through typed feature services (SettingsStateService,
   * DashboardService, etc.) to preserve type safety and audit-ability.
   * This is `public` only because Angular's DI doesn't have package-scoped access
   * modifiers — treat it as internal-to-services.
   */
  public readonly client: SupabaseClient;
  public readonly currentUser$: Observable<User | null>;

  private readonly currentUserSubject: BehaviorSubject<User | null>;
  private sessionInitialized = false;
  private sessionInitPromise: Promise<void> | null = null;

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey) as SupabaseClient;

    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.initializeAuthState();
  }

  // ── Auth ────────────────────────────────────────────────────────────

  public async waitForSession(): Promise<User | null> {
    if (!this.sessionInitialized && this.sessionInitPromise) {
      await this.sessionInitPromise;
    }
    return this.currentUserSubject.value;
  }

  public async signInWithEmail(email: string): Promise<{ data: unknown; error: Error | null }> {
    const { data, error } = await this.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  }

  public async signOut(): Promise<{ data: null; error: Error | null }> {
    const { error } = await this.client.auth.signOut();
    return { data: null, error };
  }

  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // ── Creator queries (delegated from feature services) ──────────────

  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data: data as Creator | null, error };
  }

  public async getCreatorBySlug(slug: string): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .select('*, creator_settings(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    return { data: data as Creator | null, error };
  }

  public async createCreator(creator: Partial<Creator>): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client.from('creators').insert(creator).select().single();
    return { data: data as Creator | null, error };
  }

  public async updateCreator(
    id: string,
    updates: Partial<Creator>,
  ): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Creator | null, error };
  }

  // ── Creator settings ───────────────────────────────────────────────

  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    return { data: data as CreatorSettings | null, error };
  }

  public async createCreatorSettings(
    settings: Partial<CreatorSettings>,
  ): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .insert(settings)
      .select()
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  public async updateCreatorSettings(
    id: string,
    updates: Partial<CreatorSettings>,
  ): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  // ── Stripe account ─────────────────────────────────────────────────

  public async getStripeAccount(creatorId: string): Promise<SupabaseResponse<StripeAccount>> {
    const { data, error } = await this.client
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    return { data: data as StripeAccount | null, error };
  }

  // ── Messages ───────────────────────────────────────────────────────

  public async getMessages(creatorId: string): Promise<SupabaseResponse<Message[]>> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });
    return { data: data as Message[] | null, error };
  }

  public async updateMessage(
    id: string,
    updates: Partial<Message>,
  ): Promise<SupabaseResponse<Message>> {
    const { data, error } = await this.client
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Message | null, error };
  }

  // ── Shop ───────────────────────────────────────────────────────────

  public async getShopItems(creatorId: string): Promise<{ data: ShopItem[] | null; error: unknown }> {
    const { data, error } = await this.client
      .from('shop_items')
      .select('*')
      .eq('creator_id', creatorId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    return { data: data as ShopItem[] | null, error };
  }

  public async getActiveShopItems(creatorId: string): Promise<{ data: ShopItem[] | null; error: unknown }> {
    const { data, error } = await this.client
      .from('shop_items')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    return { data: data as ShopItem[] | null, error };
  }

  public async createShopItem(
    item: Omit<ShopItem, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<{ data: ShopItem | null; error: unknown }> {
    const { data, error } = await this.client
      .from('shop_items')
      .insert(item)
      .select()
      .single();
    return { data: data as ShopItem | null, error };
  }

  public async updateShopItem(
    id: string,
    updates: Partial<Omit<ShopItem, 'id' | 'creator_id' | 'created_at' | 'updated_at'>>,
  ): Promise<{ data: ShopItem | null; error: unknown }> {
    const { data, error } = await this.client
      .from('shop_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as ShopItem | null, error };
  }

  public async deleteShopItem(id: string): Promise<{ error: unknown }> {
    const { error } = await this.client
      .from('shop_items')
      .delete()
      .eq('id', id);
    return { error };
  }

  public async getShopOrders(creatorId: string): Promise<{ data: ShopOrder[] | null; error: unknown }> {
    const { data, error } = await this.client
      .from('shop_orders')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });
    return { data: data as ShopOrder[] | null, error };
  }

  // ── Analytics ──────────────────────────────────────────────────────

  /**
   * Fetch retained monthly analytics for a creator, most-recent month first.
   * These rows are immune to message/booking deletions — only account deletion removes them.
   */
  public async getMonthlyAnalytics(
    creatorId: string,
  ): Promise<{ data: CreatorMonthlyAnalytics[] | null; error: unknown }> {
    const { data, error } = await this.client
      .from('creator_monthly_analytics')
      .select('*')
      .eq('creator_id', creatorId)
      .order('month', { ascending: false });
    return { data: data as CreatorMonthlyAnalytics[] | null, error };
  }

  // ── Edge Functions (backward-compat — prefer EdgeFunctionService) ──
  // These methods delegate to EdgeFunctionService internally for consumers
  // that haven't migrated yet. New code should inject EdgeFunctionService directly.

  /** @deprecated Use EdgeFunctionService.createCheckoutSession() */
  public async createCheckoutSession(
    payload: import('../models').CheckoutSessionPayload,
  ): Promise<import('../models').EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    // Dynamic import — not ideal but preserves backward compat without circular deps
    // TODO: migrate all callers to EdgeFunctionService directly
    return new EdgeFunctionService(this).createCheckoutSession(payload);
  }

  /** @deprecated Use EdgeFunctionService.createCallBookingSession() */
  public async createCallBookingSession(
    payload: import('../models').CallBookingPayload,
  ): Promise<import('../models').EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).createCallBookingSession(payload);
  }

  /** @deprecated Use EdgeFunctionService.sendReplyEmail() */
  public async sendReplyEmail(
    messageId: string,
    replyContent: string,
  ): Promise<import('../models').EdgeFunctionResponse<void>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).sendReplyEmail(messageId, replyContent);
  }

  /** @deprecated Use EdgeFunctionService.createConnectAccount() */
  public async createConnectAccount(
    creatorId: string,
    email: string,
    displayName: string,
  ): Promise<import('../models').EdgeFunctionResponse<import('../models').StripeConnectResponse>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).createConnectAccount(creatorId, email, displayName);
  }

  /** @deprecated Use EdgeFunctionService.verifyConnectAccount() */
  public async verifyConnectAccount(
    accountId: string,
  ): Promise<import('../models').EdgeFunctionResponse<import('../models').StripeAccountStatus>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).verifyConnectAccount(accountId);
  }

  /** @deprecated Use EdgeFunctionService.getShopDownloadUrl() */
  public async getShopDownloadUrl(
    sessionId: string,
  ): Promise<import('../models').EdgeFunctionResponse<{ url: string; filename: string }>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).getShopDownloadUrl(sessionId);
  }

  /** @deprecated Use EdgeFunctionService.createShopCheckout() */
  public async createShopCheckout(
    payload: import('../models').ShopCheckoutPayload,
  ): Promise<import('../models').EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    const { EdgeFunctionService } = await import('./edge-function.service');
    return new EdgeFunctionService(this).createShopCheckout(payload);
  }

  // ── Storage (backward-compat — prefer StorageService) ──────────────

  /** @deprecated Use StorageService.uploadPublicFile() */
  public async uploadFile(
    bucket: string,
    path: string,
    file: File,
  ): Promise<{ data: { path: string; publicUrl: string } | null; error: Error | null }> {
    const { StorageService } = await import('./storage.service');
    return new StorageService(this).uploadPublicFile(bucket, path, file);
  }

  /** @deprecated Use StorageService.deleteFile() */
  public async deleteFile(bucket: string, path: string): Promise<{ error: Error | null }> {
    const { StorageService } = await import('./storage.service');
    return new StorageService(this).deleteFile(bucket, path);
  }

  /** @deprecated Use StorageService.uploadShopFile() */
  public async uploadShopFile(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; error: Error | null }> {
    const { StorageService } = await import('./storage.service');
    return new StorageService(this).uploadShopFile(creatorId, file);
  }

  /** @deprecated Use StorageService.uploadShopThumbnail() */
  public async uploadShopThumbnail(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; publicUrl: string | null; error: Error | null }> {
    const { StorageService } = await import('./storage.service');
    return new StorageService(this).uploadShopThumbnail(creatorId, file);
  }

  // ── Private ────────────────────────────────────────────────────────

  private initializeAuthState(): void {
    this.sessionInitPromise = this.client.auth.getSession().then(({ data: { session } }) => {
      this.currentUserSubject.next(session?.user ?? null);
      this.sessionInitialized = true;
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });
  }
}
