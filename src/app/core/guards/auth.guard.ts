/**
 * Authentication guard for protected routes
 * Prevents unauthorized access to creator dashboard and settings
 */

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guard that checks if user is authenticated
 * Redirects to login page if not authenticated
 */
export const authGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabaseService.getCurrentUser();
  
  if (!user) {
    router.navigate(['/auth/login']);
    return false;
  }

  return true;
};
