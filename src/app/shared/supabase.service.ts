import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Creator {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorSettings {
  id: string;
  creator_id: string;
  has_tiered_pricing: boolean;
  fan_price: number | null;
  business_price: number | null;
  single_price: number | null;
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
  message_content: string;
  amount_paid: number;
  message_type: string;
  is_handled: boolean;
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeAccount {
  id: string;
  creator_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );

    // Initialize auth state
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });
  }

  // Auth methods
  async signInWithEmail(email: string) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Creator methods
  async getCreatorByUserId(userId: string) {
    const { data, error } = await this.supabase
      .from('creators')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  }

  async getCreatorBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('creators')
      .select('*, creator_settings(*)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    return { data, error };
  }

  async createCreator(creator: Partial<Creator>) {
    const { data, error } = await this.supabase
      .from('creators')
      .insert(creator)
      .select()
      .single();
    return { data, error };
  }

  async updateCreator(id: string, updates: Partial<Creator>) {
    const { data, error } = await this.supabase
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // Creator Settings methods
  async getCreatorSettings(creatorId: string) {
    const { data, error } = await this.supabase
      .from('creator_settings')
      .select('*')
      .eq('creator_id', creatorId)
      .single();
    return { data, error };
  }

  async createCreatorSettings(settings: Partial<CreatorSettings>) {
    const { data, error } = await this.supabase
      .from('creator_settings')
      .insert(settings)
      .select()
      .single();
    return { data, error };
  }

  async updateCreatorSettings(id: string, updates: Partial<CreatorSettings>) {
    const { data, error } = await this.supabase
      .from('creator_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // Stripe Account methods
  async getStripeAccount(creatorId: string) {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .select('*')
      .eq('creator_id', creatorId)
      .single();
    return { data, error };
  }

  async createStripeAccount(account: Partial<StripeAccount>) {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .insert(account)
      .select()
      .single();
    return { data, error };
  }

  async updateStripeAccount(id: string, updates: Partial<StripeAccount>) {
    const { data, error } = await this.supabase
      .from('stripe_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // Message methods
  async getMessages(creatorId: string) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });
    return { data, error };
  }

  async updateMessage(id: string, updates: Partial<Message>) {
    const { data, error } = await this.supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // Edge Function calls
  async createCheckoutSession(payload: {
    creator_slug: string;
    message_content: string;
    sender_name: string;
    sender_email: string;
    message_type: string;
    price: number;
  }) {
    const { data, error } = await this.supabase.functions.invoke('create-checkout-session', {
      body: payload,
    });
    return { data, error };
  }

  async sendReplyEmail(messageId: string, replyContent: string) {
    const { data, error } = await this.supabase.functions.invoke('send-reply-email', {
      body: { message_id: messageId, reply_content: replyContent },
    });
    return { data, error };
  }

  // Stripe Connect methods
  async createConnectAccount(creatorId: string, email: string, displayName: string) {
    const { data, error } = await this.supabase.functions.invoke('create-connect-account', {
      body: { creator_id: creatorId, email, display_name: displayName },
    });
    return { data, error };
  }

  async verifyConnectAccount(accountId: string) {
    const { data, error } = await this.supabase.functions.invoke('verify-connect-account', {
      body: { account_id: accountId },
    });
    return { data, error };
  }
}
