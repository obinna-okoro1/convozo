/**
 * Login component with proper access modifiers and clean architecture
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { FormValidators } from '../../core/validators/form-validators';
import { ERROR_MESSAGES } from '../../core/constants';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  protected readonly email = signal<string>('');
  protected readonly loading = signal<boolean>(false);
  protected readonly success = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  /**
   * Handle login form submission
   */
  protected async handleLogin(): Promise<void> {
    if (!this.validateEmail()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabaseService.signInWithEmail(this.email());

      if (error) {
        this.error.set(error.message);
      } else {
        this.success.set(true);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Update email value
   */
  protected updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null); // Clear error when user types
  }

  /**
   * Validate email before submission
   */
  private validateEmail(): boolean {
    const emailValue = this.email().trim();

    if (!emailValue) {
      this.error.set(ERROR_MESSAGES.AUTH.EMAIL_REQUIRED);
      return false;
    }

    if (!FormValidators.isValidEmail(emailValue)) {
      this.error.set(ERROR_MESSAGES.AUTH.EMAIL_INVALID);
      return false;
    }

    return true;
  }
}
