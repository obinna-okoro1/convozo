/**
 * Auth Service
 * Handles all authentication-related business logic
 */

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ROUTES, ERROR_MESSAGES } from '../../../core/constants';
import { FormValidators } from '../../../core/validators/form-validators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  /**
   * Sign in with email and password
   */
  public async signInWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!FormValidators.isValidEmail(email)) {
      return { success: false, error: ERROR_MESSAGES.AUTH.INVALID_EMAIL };
    }

    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Check if user has a creator profile
        const { data: creator } = await this.supabaseService.getCreatorByUserId(data.user.id);

        if (creator) {
          await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
        } else {
          await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
        }
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.AUTH.LOGIN_FAILED;
      return { success: false, error: message };
    }
  }

  /**
   * Sign up new user with email and password
   */
  public async signUp(email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    if (!FormValidators.isValidEmail(email)) {
      return { success: false, error: ERROR_MESSAGES.AUTH.INVALID_EMAIL };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    try {
      const { data, error } = await this.supabaseService.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      return { success: false, error: message };
    }
  }

  /**
   * Send magic link to email
   */
  public async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    if (!FormValidators.isValidEmail(email)) {
      return { success: false, error: ERROR_MESSAGES.AUTH.INVALID_EMAIL };
    }

    try {
      const { error } = await this.supabaseService.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.AUTH.LOGIN_FAILED;
      return { success: false, error: message };
    }
  }

  /**
   * Sign in with OAuth provider (Instagram, Google, etc.)
   */
  public async signInWithOAuth(provider: 'instagram' | 'google'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseService.client.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'instagram' ? 'user_profile' : undefined
        }
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth authentication failed';
      return { success: false, error: message };
    }
  }

  /**
   * Handle authentication callback
   */
  public async handleAuthCallback(): Promise<void> {
    // Wait for auth state to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = this.supabaseService.getCurrentUser();

    if (!user) {
      await this.router.navigate([ROUTES.AUTH.LOGIN]);
      return;
    }

    // Check if user has a creator profile
    const { data: creator } = await this.supabaseService.getCreatorByUserId(user.id);

    if (creator) {
      // Existing creator, go to dashboard
      await this.router.navigate([ROUTES.CREATOR.DASHBOARD]);
    } else {
      // New creator, go to onboarding
      await this.router.navigate([ROUTES.CREATOR.ONBOARDING]);
    }
  }

  /**
   * Get current user
   */
  public getCurrentUser() {
    return this.supabaseService.getCurrentUser();
  }

  /**
   * Sign out current user
   */
  public async signOut(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
    await this.router.navigate([ROUTES.AUTH.LOGIN]);
  }
}
