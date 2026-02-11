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
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  /**
   * Handle login form submission
   */
  protected async handleLogin(): Promise<void> {
    const emailValue = this.email().trim();

    if (!emailValue) {
      this.error.set(ERROR_MESSAGES.AUTH.EMAIL_REQUIRED);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const result = await this.authService.sendMagicLink(emailValue);

    if (result.success) {
      this.success.set(true);
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
}
