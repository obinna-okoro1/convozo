/**
 * Supabase service with proper access modifiers and type safety
 */

import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Creator,
  CreatorSettings,
  Message,
  StripeAccount,
  CheckoutSessionPayload,
  EdgeFunctionResponse,
  StripeConnectResponse,
  StripeAccountStatus,
} from '../core/models';

interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;
  private readonly currentUserSubject: BehaviorSubject<User | null>;
  public readonly currentUser$: Observable<User | null>;

  constructor() {
    this.supabase = createClient(
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
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });
  }

  // ==================== AUTH METHODS ====================

  /**
   * Sign in with email using magic link
   */
  public async signInWithEmail(email: string): Promise<SupabaseResponse<unknown>> {
    const { data, error } = await this.supabase.auth.signInWithOtp({
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
  public async signOut(): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabase.auth.signOut();
    return { data: null, error };
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // ==================== CREATOR METHODS ====================

  /**
   * Get creator by user ID
   */
  public async getCreatorByUserId(userId: string): Promise<SupabaseResponse<Creator>> {
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase.functions.invoke('create-checkout-session', {
      body: payload,
    });
    return { data, error };
  }

  /**
   * Send reply email via Edge Function
   */
  public async sendReplyEmail(messageId: string, replyContent: string): Promise<EdgeFunctionResponse<void>> {
    const { data, error } = await this.supabase.functions.invoke('send-reply-email', {
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
    const { data, error } = await this.supabase.functions.invoke('create-connect-account', {
      body: { creator_id: creatorId, email, display_name: displayName },
    });
    return { data, error };
  }

  /**
   * Verify Stripe Connect account status via Edge Function
   */
  public async verifyConnectAccount(accountId: string): Promise<EdgeFunctionResponse<StripeAccountStatus>> {
    const { data, error } = await this.supabase.functions.invoke('verify-connect-account', {
      body: { account_id: accountId },
    });
    return { data, error };
  }
}
