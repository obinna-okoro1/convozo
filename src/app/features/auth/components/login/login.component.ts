/**
 * Login Component
 * Lean component that delegates auth logic to AuthService
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ERROR_MESSAGES } from '../../../../core/constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  protected readonly email = signal<string>('');
  protected readonly password = signal<string>('');
  protected readonly usePassword = signal<boolean>(true); // Default to password for local dev
  protected readonly loading = signal<boolean>(false);
  protected readonly success = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  /**
   * Handle OAuth login
   */
  protected async handleOAuthLogin(provider: 'google'): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.signInWithOAuth(provider);

    if (!result.success) {
      this.loading.set(false);
      this.error.set(result.error || `Failed to sign in with ${provider}`);
    }
    // If successful, user will be redirected to OAuth flow
  }

  /**
   * Handle login form submission
   */
  protected async handleLogin(): Promise<void> {
    const emailValue = this.email().trim();
    const passwordValue = this.password().trim();

    if (!emailValue) {
      this.error.set(ERROR_MESSAGES.AUTH.EMAIL_REQUIRED);
      return;
    }

    if (this.usePassword() && !passwordValue) {
      this.error.set('Password is required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = this.usePassword()
      ? await this.authService.signInWithPassword(emailValue, passwordValue)
      : await this.authService.sendMagicLink(emailValue);

    if (result.success) {
      if (!this.usePassword()) {
        this.success.set(true);
      }
      // For password login, navigation is handled in the service
    } else {
      this.error.set(result.error || ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
    }

    this.loading.set(false);
  }

  /**
   * Update email value
   */
  protected updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null);
  }

  /**
   * Update password value
   */
  protected updatePassword(value: string): void {
    this.password.set(value);
    this.error.set(null);
  }

  /**
   * Toggle authentication method
   */
  protected toggleAuthMethod(): void {
    this.usePassword.update(value => !value);
    this.error.set(null);
  }
}
