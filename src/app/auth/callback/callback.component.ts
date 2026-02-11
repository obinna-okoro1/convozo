import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../shared/supabase.service';

@Component({
  selector: 'app-callback',
  imports: [],
  template: `
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Signing you in...</p>
      </div>
    </div>
  `
})
export class CallbackComponent implements OnInit {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Wait a moment for auth state to update
    setTimeout(async () => {
      const user = this.supabaseService.getCurrentUser();
      
      if (user) {
        // Check if user has a creator profile
        const { data: creator } = await this.supabaseService.getCreatorByUserId(user.id);
        
        if (creator) {
          // Existing creator, go to dashboard
          this.router.navigate(['/creator/dashboard']);
        } else {
          // New creator, go to onboarding
          this.router.navigate(['/creator/onboarding']);
        }
      } else {
        // No user, go to login
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }
}
