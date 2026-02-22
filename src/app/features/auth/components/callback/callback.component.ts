/**
 * Callback Component
 * Handles OAuth callbacks for Supabase, and Instagram (login + connect)
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css']
})
export class CallbackComponent implements OnInit {
  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  public async ngOnInit(): Promise<void> {
    // Check for OAuth errors
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error) {
      console.error('OAuth error:', error);
      await this.router.navigate(['/auth/login'], {
        queryParams: { error: 'oauth_failed' }
      });
      return;
    }

    // Handle Supabase auth callback (Google, magic link, etc.)
    await this.authService.handleAuthCallback();
  }
}
