/**
 * Signup Component
 * Handles new creator registration
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent {
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  fullName = signal('');
  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);

  constructor(private readonly authService: AuthService) {}

  async handleOAuthSignup(provider: 'google'): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.signInWithOAuth(provider);

    if (!result.success) {
      this.loading.set(false);
      this.error.set(result.error || `Failed to sign up with ${provider}`);
    }
    // If successful, user will be redirected to OAuth flow
  }

  updateEmail(value: string): void {
    this.email.set(value);
    this.error.set(null);
  }

  updatePassword(value: string): void {
    this.password.set(value);
    this.error.set(null);
  }

  updateConfirmPassword(value: string): void {
    this.confirmPassword.set(value);
    this.error.set(null);
  }

  updateFullName(value: string): void {
    this.fullName.set(value);
    this.error.set(null);
  }

  async handleSignup(): Promise<void> {
    if (this.loading()) return;

    // Validation
    if (!this.email() || !this.password() || !this.fullName()) {
      this.error.set('Please fill in all required fields');
      return;
    }

    if (this.password().length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.signUp(
      this.email(),
      this.password(),
      this.fullName()
    );

    this.loading.set(false);

    if (result.success) {
      this.success.set(true);
    } else {
      this.error.set(result.error || 'Failed to create account');
    }
  }
}
