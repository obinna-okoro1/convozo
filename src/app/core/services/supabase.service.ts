/**
 * Supabase service with proper access modifiers and type safety
 */

import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Creator,
  CreatorSettings,
  Message,
  StripeAccount,
  CheckoutSessionPayload,
  CallBookingPayload,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus,
} from '../../core/models';

interface SupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  // Expose client for direct access by feature services
  public readonly client: SupabaseClient;
  private readonly currentUserSubject: BehaviorSubject<User | null>;
  public readonly currentUser$: Observable<User | null>;

  private sessionInitialized = false;
  private sessionInitPromise: Promise<void> | null = null;

  constructor() {
    this.client = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );

    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    this.initializeAuthState();
  }

  /**
   * Initialize authentication state
   */
  private initializeAuthState(): void {
    this.sessionInitPromise = this.client.auth.getSession().then(({ data: { session } }) => {
      this.currentUserSubject.next(session?.user ?? null);
      this.sessionInitialized = true;
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });
  }

  /**
   * Wait for initial session to be loaded
   */
  public async waitForSession(): Promise<User | null> {
    if (!this.sessionInitialized && this.sessionInitPromise) {
      await this.sessionInitPromise;
    }
    return this.currentUserSubject.value;
  }

  // ==================== AUTH METHODS ====================

  /**
   * Sign in with email using magic link
   */
  public async signInWithEmail(email: string): Promise<{ data: unknown; error: Error | null }> {
    const { data, error } = await this.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<{ data: null; error: Error | null }> {
    const { error } = await this.client.auth.signOut();
    return { data: null, error };
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // ==================== STORAGE METHODS ====================

  /**
   * Upload file to Supabase Storage
   */
  public async uploadFile(
    bucket: string,
    path: string,
    file: File
  ): Promise<{ data: { path: string; publicUrl: string } | null; error: Error | null }> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = this.client.storage
        .from(bucket)
        .getPublicUrl(path);

      return {
        data: {
          path: data.path,
          publicUrl
        },
        error: null
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Upload failed')
      };
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  public async deleteFile(bucket: string, path: string): Promise<{ error: Error | null }> {
    const { error } = await this.client.storage
      .from(bucket)
      .remove([path]);
    return { error };
  }

  // ==================== CREATOR METHODS ====================

  /**
   * Get creator by user ID
   */
  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data: data as Creator | null, error };
  }

  /**
   * Get creator by slug with settings
   */
  public async getCreatorBySlug(slug: string): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .select('*, creator_settings(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    return { data: data as Creator | null, error };
  }

  /**
   * Create a new creator profile
   */
  public async createCreator(creator: Partial<Creator>): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .insert(creator)
      .select()
      .single();
    return { data: data as Creator | null, error };
  }

  /**
   * Update creator profile
   */
  public async updateCreator(id: string, updates: Partial<Creator>): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.client
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Creator | null, error };
  }

  // ==================== CREATOR SETTINGS METHODS ====================

  /**
   * Get creator settings by creator ID
   */
  public async getCreatorSettings(creatorId: string): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  /**
   * Create creator settings
   */
  public async createCreatorSettings(settings: Partial<CreatorSettings>): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .insert(settings)
      .select()
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  /**
   * Update creator settings
   */
  public async updateCreatorSettings(id: string, updates: Partial<CreatorSettings>): Promise<SupabaseResponse<CreatorSettings>> {
    const { data, error } = await this.client
      .from('creator_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as CreatorSettings | null, error };
  }

  // ==================== STRIPE ACCOUNT METHODS ====================

  /**
   * Get Stripe account by creator ID
   */
  public async getStripeAccount(creatorId: string): Promise<SupabaseResponse<StripeAccount>> {
    const { data, error } = await this.client
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .single();
    return { data: data as StripeAccount | null, error };
  }

  /**
   * Create Stripe account record
   */
  public async createStripeAccount(account: Partial<StripeAccount>): Promise<SupabaseResponse<StripeAccount>> {
    const { data, error } = await this.client
      .from('stripe_accounts')
      .insert(account)
      .select()
      .single();
    return { data: data as StripeAccount | null, error };
  }

  /**
   * Update Stripe account record
   */
  public async updateStripeAccount(id: string, updates: Partial<StripeAccount>): Promise<SupabaseResponse<StripeAccount>> {
    const { data, error } = await this.client
      .from('stripe_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as StripeAccount | null, error };
  }

  // ==================== MESSAGE METHODS ====================

  /**
   * Get all messages for a creator
   */
  public async getMessages(creatorId: string): Promise<SupabaseResponse<Message[]>> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });
    return { data: data as Message[] | null, error };
  }

  /**
   * Update a message
   */
  public async updateMessage(id: string, updates: Partial<Message>): Promise<SupabaseResponse<Message>> {
    const { data, error } = await this.client
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data as Message | null, error };
  }

  // ==================== EDGE FUNCTION METHODS ====================

  /**
   * Create Stripe checkout session via Edge Function
   */
  public async createCheckoutSession(payload: CheckoutSessionPayload): Promise<EdgeFunctionResponse<{ sessionId: string; url: string }>> {
    const { data, error } = await this.client.functions.invoke('create-checkout-session', {
      body: payload,
    });
    return { data, error };
  }

  /**
   * Create call booking checkout session via Edge Function
   */
  public async createCallBookingSession(payload: CallBookingPayload): Promise<EdgeFunctionResponse<{ url: string }>> {
    const { data, error } = await this.client.functions.invoke('create-call-booking-session', {
      body: payload,
    });
    return { data, error };
  }

  /**
   * Send reply email via Edge Function
   */
  public async sendReplyEmail(messageId: string, replyContent: string): Promise<EdgeFunctionResponse<void>> {
    const { data, error } = await this.client.functions.invoke('send-reply-email', {
      body: { message_id: messageId, reply_content: replyContent },
    });
    return { data, error };
  }

  /**
   * Create Stripe Connect account via Edge Function
   */
  public async createConnectAccount(
    creatorId: string,
    email: string,
    displayName: string
  ): Promise<EdgeFunctionResponse<StripeConnectResponse>> {
    const { data, error } = await this.client.functions.invoke('create-connect-account', {
      body: { creator_id: creatorId, email, display_name: displayName },
    });
    return { data, error };
  }

  /**
   * Verify Stripe Connect account status via Edge Function
   */
  public async verifyConnectAccount(accountId: string): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    const { data, error } = await this.client.functions.invoke('verify-connect-account', {
      body: { account_id: accountId },
    });
    return { data, error };
  }
}
