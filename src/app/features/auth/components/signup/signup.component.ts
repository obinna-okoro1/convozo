/**
 * Signup Component
 * Handles new creator registration
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AnimatedBackgroundComponent } from '../../../../shared/components/animated-background/animated-background.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedBackgroundComponent],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly fullName = signal('');
  protected readonly loading = signal(false);
  protected readonly success = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor(private readonly authService: AuthService) {}

  /**
   * Extract string value from an input event
   */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async handleOAuthSignup(provider: 'google'): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.signInWithOAuth(provider);

    if (!result.success) {
      this.loading.set(false);
      this.error.set(result.error || `Failed to sign up with ${provider}`);
    }
    // If successful, user will be redirected to OAuth flow
  }

  protected updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null);
  }

  protected updatePassword(value: string): void {
    this.password.set(value);
    this.error.set(null);
  }

  protected updateConfirmPassword(value: string): void {
    this.confirmPassword.set(value);
    this.error.set(null);
  }

  protected updateFullName(value: string): void {
    this.fullName.set(value);
    this.error.set(null);
  }

  protected async handleSignup(): Promise<void> {
    if (this.loading()) {
      return;
    }

    // Validation
    if (!this.email() || !this.password() || !this.fullName()) {
      this.error.set('Please fill in all required fields');
      return;
    }

    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.signUp(this.email(), this.password(), this.fullName());

    this.loading.set(false);

    if (result.success) {
      this.success.set(true);
    } else {
      this.error.set(result.error || 'Failed to create account');
    }
  }
}
