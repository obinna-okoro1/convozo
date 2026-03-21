import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/functions-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Creator,
  CreatorSettings,
  Message,
  StripeAccount,
  CheckoutSessionPayload,
  CallBookingPayload,
  ShopItem,
  ShopOrder,
  ShopCheckoutPayload,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus,
} from '../models';

interface SupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

// Unwrap real server error from Edge Function non-2xx responses.
// FunctionsHttpError.message is always generic — the actual error is in error.context.json().
async function invokeFunction<T>(
  invokeFn: () => Promise<{ data: T | null; error: unknown }>,
): Promise<EdgeFunctionResponse<T>> {
  const { data, error } = await invokeFn();
  if (!error) {
    return { data: data ?? undefined, error: undefined };
  }

  // Unwrap FunctionsHttpError: read the real JSON error body from the response
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json() as { error?: string };
      const message = body?.error ?? error.message;
      return { data: undefined, error: { message } };
    } catch {
      return { data: undefined, error: { message: error.message } };
    }
  }

  // Fallback for any other error type
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { data: undefined, error: { message } };
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  // Expose client for direct access by feature services
  public readonly client: SupabaseClient;
  public readonly currentUser$: Observable<User | null>;

  private readonly currentUserSubject: BehaviorSubject<User | null>;
  private sessionInitialized = false;
  private sessionInitPromise: Promise<void> | null = null;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);

    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.initializeAuthState();
  }

  public async waitForSession(): Promise<User | null> {
    if (!this.sessionInitialized && this.sessionInitPromise) {
      await this.sessionInitPromise;
    }
    return this.currentUserSubject.value;
  }

  // Auth

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

  // Storage

  public async uploadFile(
    bucket: string,
    path: string,
    file: File,
  ): Promise<{ data: { path: string; publicUrl: string } | null; error: Error | null }> {
    try {
      const { data, error } = await this.client.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        throw error;
      }

      const {
        data: { publicUrl },
      } = this.client.storage.from(bucket).getPublicUrl(path);

      return {
        data: {
          path: data.path,
          publicUrl,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Upload failed'),
      };
    }
  }

  public async deleteFile(bucket: string, path: string): Promise<{ error: Error | null }> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    return { error };
  }

  /**
   * Upload a digital file to the private shop-files bucket.
   * Returns the storage path (never a public URL — access via signed URLs only).
   * Path format: {creatorId}/{timestamp}_{safeFilename}
   */
  public async uploadShopFile(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; error: Error | null }> {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `${creatorId}/${Date.now()}_${safeName}`;
      const { data, error } = await this.client.storage
        .from('shop-files')
        .upload(path, file, { upsert: false });
      if (error) throw error;
      return { path: data.path, error: null };
    } catch (error) {
      return { path: null, error: error instanceof Error ? error : new Error('Upload failed') };
    }
  }

  /**
   * Upload a thumbnail to the public shop-thumbnails bucket.
   * Returns both the storage path and the derived public URL.
   */
  public async uploadShopThumbnail(
    creatorId: string,
    file: File,
  ): Promise<{ path: string | null; publicUrl: string | null; error: Error | null }> {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `${creatorId}/${Date.now()}_${safeName}`;
      const { data, error } = await this.client.storage
        .from('shop-thumbnails')
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = this.client.storage.from('shop-thumbnails').getPublicUrl(data.path);
      return { path: data.path, publicUrl, error: null };
    } catch (error) {
      return { path: null, publicUrl: null, error: error instanceof Error ? error : new Error('Upload failed') };
    }
  }

  /**
   * Fetch a short-lived signed download URL for a purchased shop item.
   * Calls the get-shop-download edge function with the Stripe session ID.
   * No auth token needed — the session ID is proof of purchase.
   */
  public async getShopDownloadUrl(
    sessionId: string,
  ): Promise<EdgeFunctionResponse<{ url: string; filename: string }>> {
    return invokeFunction(() =>
      this.client.functions.invoke('get-shop-download', { body: { session_id: sessionId } }),
    );
  }

  // Creator

  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('creators')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data: data as Creator | null, error };
  }

  public async getCreatorBySlug(slug: string): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('creators')
      .select('*, creator_settings(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    return { data: data as Creator | null, error };
  }

  public async createCreator(creator: Partial<Creator>): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client.from('creators').insert(creator).select().single();
    return { data: data as Creator | null, error };
  }

  public async updateCreator(
    id: string,
    updates: Partial<Creator>,
  ): Promise<SupabaseResponse<Creator>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Creator | null, error };
  }

  // Creator settings

  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('creator_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  // Stripe account

  public async getStripeAccount(creatorId: string): Promise<SupabaseResponse<StripeAccount>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .maybeSingle();
    return { data: data as StripeAccount | null, error };
  }

  // Messages

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.client
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Message | null, error };
  }

  // Edge functions

  public async createCheckoutSession(
    payload: CheckoutSessionPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return invokeFunction(() =>
      this.client.functions.invoke('create-checkout-session', { body: payload }),
    );
  }

  public async createCallBookingSession(
    payload: CallBookingPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return invokeFunction(() =>
      this.client.functions.invoke('create-call-booking-session', { body: payload }),
    );
  }

  public async sendReplyEmail(
    messageId: string,
    replyContent: string,
  ): Promise<EdgeFunctionResponse<void>> {
    return invokeFunction(() =>
      this.client.functions.invoke('send-reply-email', {
        body: { message_id: messageId, reply_content: replyContent },
      }),
    );
  }

  public async createConnectAccount(
    creatorId: string,
    email: string,
    displayName: string,
  ): Promise<EdgeFunctionResponse<StripeConnectResponse>> {
    return invokeFunction(() =>
      this.client.functions.invoke('create-connect-account', {
        body: { creator_id: creatorId, email, display_name: displayName },
      }),
    );
  }

  public async verifyConnectAccount(
    accountId: string,
  ): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    return invokeFunction(() =>
      this.client.functions.invoke('verify-connect-account', { body: { account_id: accountId } }),
    );
  }

  // Shop

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

  public async createShopCheckout(
    payload: ShopCheckoutPayload,
  ): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    return invokeFunction(() =>
      this.client.functions.invoke('create-shop-checkout', { body: payload }),
    );
  }

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
