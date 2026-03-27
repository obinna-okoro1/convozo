/**
 * ResetPasswordComponent
 *
 * Handles the Supabase password-reset callback:
 *   1. Reads the PKCE `code` query param from the URL (injected by Supabase's reset email).
 *   2. Exchanges the code for a recovery session via exchangeCodeForSession().
 *   3. Shows a form for the user to enter and confirm their new password.
 *   4. Calls supabase.auth.updateUser({ password }) then signs out and redirects to login.
 *
 * Error states:
 *   - Missing / expired code → show link to /auth/forgot-password
 *   - Password mismatch / too short → inline field error
 *   - updateUser failure → inline form error
 */

import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  /** True while exchanging the PKCE code for a session. */
  protected readonly sessionLoading = signal(true);
  /** Set when the code is missing/expired. Renders an error screen instead of the form. */
  protected readonly sessionError = signal<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly supabaseService: SupabaseService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  public ngOnInit(): void {
    void this.exchangeSession();
  }

  /** Exchange the one-time PKCE code in the URL for a Supabase recovery session. */
  private async exchangeSession(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code) {
      this.sessionError.set(
        'Invalid or missing reset link. Please request a new password reset.',
      );
      this.sessionLoading.set(false);
      return;
    }

    try {
      const { error } = await this.supabaseService.client.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    } catch {
      this.sessionError.set(
        'This reset link has expired or has already been used. Please request a new one.',
      );
    }

    this.sessionLoading.set(false);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected updateNewPassword(value: string): void {
    this.newPassword.set(value);
    this.error.set(null);
  }

  protected updateConfirmPassword(value: string): void {
    this.confirmPassword.set(value);
    this.error.set(null);
  }

  protected async handleResetPassword(): Promise<void> {
    const pw = this.newPassword();
    const cpw = this.confirmPassword();

    if (pw.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    if (pw !== cpw) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.updatePassword(pw);

    if (result.success) {
      this.success.set(true);
      // Sign out the temporary recovery session — user should log in fresh
      await this.supabaseService.client.auth.signOut();
    } else {
      this.error.set(result.error ?? 'Failed to update password. Please try again.');
    }

    this.loading.set(false);
  }
}
