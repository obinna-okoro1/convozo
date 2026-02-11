import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../shared/supabase.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = signal('');
  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async handleLogin() {
    if (!this.email()) {
      this.error.set('Please enter your email');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.supabaseService.signInWithEmail(this.email());

    this.loading.set(false);

    if (error) {
      this.error.set(error.message);
    } else {
      this.success.set(true);
    }
  }

  updateEmail(value: string) {
    this.email.set(value);
  }
}
