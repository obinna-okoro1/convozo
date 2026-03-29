/**
 * ForgotPasswordComponent
 *
 * Accepts an email address and calls Supabase Auth resetPasswordForEmail().
 * In production the resulting email is sent via Resend (smtp.resend.com).
 * The email contains a link → /auth/reset-password?code=XXXX.
 */

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ERROR_MESSAGES } from '@core/constants';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  protected readonly email = signal('');
  protected readonly loading = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(private readonly authService: AuthService) {}

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null);
  }

  protected async handleSubmit(): Promise<void> {
    const emailValue = this.email().trim();

    if (!emailValue) {
      this.error.set(ERROR_MESSAGES.AUTH.EMAIL_REQUIRED);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.sendPasswordResetEmail(emailValue);

    if (result.success) {
      this.success.set(true);
    } else {
      this.error.set(result.error ?? 'Failed to send reset email. Please try again.');
    }

    this.loading.set(false);
  }
}
