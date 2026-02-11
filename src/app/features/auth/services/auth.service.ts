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
